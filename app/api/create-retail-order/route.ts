import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isInventoryEnabledForEvent } from '@/app/lib/inventory';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
  try {
    const body = await req.json();

    const { 
      cart, 
      customerName, 
      customerPhone, 
      customerEmail,
      taxCollected, 
      total, 
      eventSlug, 
      eventName 
    } = body; 

    const currentEvent = eventSlug || 'default';
    const currentEventName = eventName || 'General Event';

    if (!cart || cart.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const hasBackorder = cart.some((item: any) => item.needsShipping);

    // 1. Create the Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName || 'Retail Customer',
          phone: customerPhone || 'N/A', 
          email: customerEmail || '',    
          total_price: parseFloat(total),
          tax_collected: taxCollected,
          status: hasBackorder ? 'pending_shipping' : 'completed',
          cart_data: cart,
          payment_status: 'paid',
          payment_method: 'terminal',
          event_slug: currentEvent,      
          event_name: currentEventName,  
          created_at: new Date().toISOString() 
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. INVENTORY UPDATE & SALES LEDGER (P&L AUTOMATION)
    for (const item of cart) {
        if (item.productId && item.size) {
            
            // --- LOG TO SALES LEDGER ---
            // Try matching by sku (new format) first, then fall back to product_id slug (old format)
            const { data: invMasterBySku } = await supabase
                .from('inventory_master')
                .select('cost_price')
                .eq('sku', item.productId)
                .eq('size', item.size)
                .single();

            const { data: invMasterBySlug } = !invMasterBySku ? await supabase
                .from('inventory_master')
                .select('cost_price')
                .eq('product_id', item.productId)
                .eq('size', item.size)
                .single() : { data: null };

            const costBasis = invMasterBySku?.cost_price || invMasterBySlug?.cost_price || 0;

            await supabase.from('sales_ledger').insert({
                event_slug: currentEvent,
                product_id: item.productId,
                size: item.size,
                qty: 1,
                sale_price: item.finalPrice, 
                cost_basis: costBasis,
                payment_method: 'terminal',
                order_id: order.id
            });
            // --------------------------------

            // EXISTING: STOCK DECREMENT LOGIC
            const { data: candidates } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', item.productId)
                .eq('size', item.size);

            if (candidates && candidates.length > 0) {
                let targetRow = candidates.find(c => c.event_slug === currentEvent);
                if (!targetRow && currentEvent !== 'default') {
                    targetRow = candidates.find(c => c.event_slug === 'default');
                }
                if (!targetRow) {
                    targetRow = candidates.find(c => !c.event_slug || c.event_slug === '');
                }

                if (targetRow) {
                    await supabase
                        .from('inventory')
                        .update({ count: Math.max(0, targetRow.count - 1) })
                        .eq('id', targetRow.id); 
                }
            }
        }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Retail Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

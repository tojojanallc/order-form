import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, guestName, guestId, eventName, eventSlug, customerPhone } = body;

    const currentEvent = (eventSlug && eventSlug !== '') ? eventSlug : 'default';

    // 1. Create the Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: guestName,
          phone: customerPhone || 'N/A',
          total_price: 0, 
          status: 'pending',
          cart_data: cart,
          payment_status: 'paid',
          payment_method: 'hosted',
          event_name: eventName,
          event_slug: currentEvent,
          created_at: new Date()
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. Mark Guest Redeemed
    if (guestId) {
        await supabase.from('guests').update({ has_ordered: true }).eq('id', guestId);
    }

    // 3. INVENTORY UPDATE & SALES LEDGER LOGGING
    for (const item of cart) {
        if (item.productId && item.size) {
            
            // --- NEW: LOG TO SALES LEDGER (Cost of "Free" items) ---
            const { data: invMaster } = await supabase
                .from('inventory_master')
                .select('cost_per_unit')
                .eq('product_id', item.productId)
                .eq('size', item.size)
                .single();

            const costBasis = invMaster?.cost_per_unit || 0;

            await supabase.from('sales_ledger').insert({
                event_slug: currentEvent,
                product_id: item.productId,
                size: item.size,
                qty: 1,
                sale_price: 0, // Guest paid nothing
                cost_basis: costBasis, // But it cost you the blank
                payment_method: 'hosted',
                order_id: order.id
            });
            // -------------------------------------------------------

            // EXISTING: STOCK DECREMENT LOGIC

          const inventoryEnabled = await isInventoryEnabledForEvent(currentEvent);

if (inventoryEnabled) {
            const { data: candidates } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', item.productId)
                .eq('size', item.size);

            if (candidates && candidates.length > 0) {
                let targetRow = candidates.find(c => c.event_slug === currentEvent);
                if (!targetRow) {
                    targetRow = candidates.find(c => c.event_slug === 'default');
                }
                if (!targetRow) {
                    targetRow = candidates.find(c => !c.event_slug);
                }

                if (targetRow) {
                    const newCount = Math.max(0, targetRow.count - 1);
                    await supabase
                        .from('inventory')
                        .update({ count: newCount })
                        .eq('id', targetRow.id);
                }
            }
        }
    }
      }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Hosted Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

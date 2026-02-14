import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, customerName, total, eventSlug } = body; 

    // Normalize slug (handle nulls)
    const currentEvent = eventSlug || 'default';

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
          total_price: parseFloat(total),
          status: hasBackorder ? 'pending_shipping' : 'completed',
          cart_data: cart,
          payment_status: 'paid',
          payment_method: 'terminal',
          event_name: eventName,
          event_slug: currentEvent,
          created_at: new Date()
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. DECREMENT INVENTORY (ID-Based Update)
    for (const item of cart) {
        if (item.productId && item.size) {
            
            // A. Get ALL possible inventory rows for this Product+Size
            // We do not filter by slug yet, so we don't miss anything.
            const { data: candidates } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', item.productId)
                .eq('size', item.size);

            if (candidates && candidates.length > 0) {
                // B. Find the Best Match in Javascript (More reliable than SQL for this)
                // Priority 1: Exact Event Match
                let targetRow = candidates.find(c => c.event_slug === currentEvent);
                
                // Priority 2: 'default' Event (if we aren't already on default)
                if (!targetRow && currentEvent !== 'default') {
                    targetRow = candidates.find(c => c.event_slug === 'default');
                }

                // Priority 3: Legacy Items (Null or Empty Slug)
                if (!targetRow) {
                    targetRow = candidates.find(c => !c.event_slug || c.event_slug === '');
                }

                // C. Update the SPECIFIC ROW by ID
                if (targetRow) {
                    console.log(`📉 Reducing Stock for ID: ${targetRow.id} (Event: ${targetRow.event_slug})`);
                    
                    await supabase
                        .from('inventory')
                        .update({ count: Math.max(0, targetRow.count - 1) })
                        .eq('id', targetRow.id); // <--- UPDATING BY ID IS BULLETPROOF
                } else {
                    console.log(`⚠️ Item exists in Catalog but not in Inventory for this Event: ${item.productId}`);
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

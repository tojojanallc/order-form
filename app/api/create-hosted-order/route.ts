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

    // FORCE DEFAULT if missing
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

    // 3. INVENTORY UPDATE (BRUTE FORCE)
    for (const item of cart) {
        if (item.productId && item.size) {
            
            // A. Get ALL rows for this product/size (Ignore slug for a moment)
            const { data: candidates } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', item.productId)
                .eq('size', item.size);

            if (candidates && candidates.length > 0) {
                // B. Manual Filter in Javascript (More reliable)
                // Look for Exact Slug Match
                let targetRow = candidates.find(c => c.event_slug === currentEvent);

                // If not found, look for 'default'
                if (!targetRow) {
                    targetRow = candidates.find(c => c.event_slug === 'default');
                }

                // If still not found, look for NULL (Legacy)
                if (!targetRow) {
                    targetRow = candidates.find(c => !c.event_slug);
                }

                // C. Update the specific ID
                if (targetRow) {
                    console.log(`📉 FOUND IT! Updating Inventory ID: ${targetRow.id} (Current: ${targetRow.count})`);
                    
                    const newCount = Math.max(0, targetRow.count - 1);
                    
                    await supabase
                        .from('inventory')
                        .update({ count: newCount })
                        .eq('id', targetRow.id); // Update by ID is guaranteed
                        
                } else {
                    console.log(`⚠️ CRITICAL: Item exists in products but NOT in inventory for this event: ${item.productId}`);
                }
            } else {
                console.log(`⚠️ Item not found in ANY inventory: ${item.productId}`);
            }
        }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Hosted Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

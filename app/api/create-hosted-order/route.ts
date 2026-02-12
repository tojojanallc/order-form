import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, guestName, guestId, eventName, eventSlug, customerPhone, customerEmail } = body;

    // Normalize slug
    const currentEvent = eventSlug || 'default';

    const hasBackorder = cart.some((item: any) => item.needsShipping);

    // 1. Create the Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: guestName,
          phone: customerPhone || 'N/A',
          total_price: 0, // Hosted is free for the guest
          status: hasBackorder ? 'pending_shipping' : 'pending',
          cart_data: cart,
          payment_status: 'paid', // Marked paid because the host covers it
          payment_method: 'hosted',
          event_name: eventName,
          event_slug: currentEvent,
          created_at: new Date()
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. Mark Guest as "Redeemed"
    if (guestId) {
        await supabase
            .from('guests')
            .update({ has_ordered: true })
            .eq('id', guestId);
    }

    // 3. DECREMENT INVENTORY (Bulletproof Method)
    for (const item of cart) {
        if (item.productId && item.size) {
            
            // A. Get ALL possible inventory rows
            const { data: candidates } = await supabase
                .from('inventory')
                .select('*')
                .eq('product_id', item.productId)
                .eq('size', item.size);

            if (candidates && candidates.length > 0) {
                // B. Find the Best Match
                let targetRow = candidates.find(c => c.event_slug === currentEvent);
                
                // Fallback: 'default' Event
                if (!targetRow && currentEvent !== 'default') {
                    targetRow = candidates.find(c => c.event_slug === 'default');
                }

                // Fallback: Legacy Items
                if (!targetRow) {
                    targetRow = candidates.find(c => !c.event_slug || c.event_slug === '');
                }

                // C. Update by ID
                if (targetRow) {
                    console.log(`📉 Hosted Order: Reducing Stock for ID: ${targetRow.id}`);
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
    console.error('Hosted Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

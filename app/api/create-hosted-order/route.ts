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
    const { cart, guestName, guestId: incomingGuestId, eventName, eventSlug, customerPhone, shippingInfo, site } = body;

    const currentEvent = (eventSlug && eventSlug !== '') ? eventSlug : 'default';
    const hasShipping = cart.some((i: any) => i.needsShipping);

    // Resolve guest ID — create the guest now if they were new (no ID yet)
    let resolvedGuestId = incomingGuestId;
    if (!resolvedGuestId && guestName) {
      // Check one more time in case a concurrent request created them
      const { data: existing } = await supabase
        .from('guests')
        .select('id, has_ordered')
        .eq('event_slug', currentEvent)
        .ilike('name', guestName.trim())
        .maybeSingle();

      if (existing) {
        if (existing.has_ordered) {
          return NextResponse.json({ success: false, error: 'Guest has already ordered.' }, { status: 409 });
        }
        resolvedGuestId = existing.id;
      } else {
        // First time we're seeing this guest — insert them now that the order is real
        const { data: newGuest, error: insertError } = await supabase
          .from('guests')
          .insert({ name: guestName.trim(), event_slug: currentEvent, has_ordered: false })
          .select('id')
          .single();

        if (insertError) {
          console.error('Guest insert error:', insertError);
          return NextResponse.json({ success: false, error: 'Failed to register guest.' }, { status: 500 });
        }
        resolvedGuestId = newGuest.id;
      }
    }

    // 1. Create the Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: guestName,
          phone: customerPhone || 'N/A',
          total_price: 0, 
          status: hasShipping ? 'pending_shipping' : 'pending',
          cart_data: cart,
          payment_status: 'paid',
          payment_method: 'hosted',
          event_name: eventName,
          event_slug: currentEvent,
          site: site || null,
          shipping_address: shippingInfo?.address || null,
          shipping_city: shippingInfo?.city || null,
          shipping_state: shippingInfo?.state || null,
          shipping_zip: shippingInfo?.zip || null,
          created_at: new Date()
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. Mark Guest Redeemed
    if (resolvedGuestId) {
      await supabase.from('guests').update({ has_ordered: true }).eq('id', resolvedGuestId);
    }

    // 3. INVENTORY UPDATE & SALES LEDGER LOGGING
    for (const item of cart) {
      if (item.productId && item.size) {
        // Log to sales ledger
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
          sale_price: 0,
          cost_basis: costBasis,
          payment_method: 'hosted',
          order_id: order.id
        });

        // Stock decrement
        const inventoryEnabled = await isInventoryEnabledForEvent(currentEvent);
        if (inventoryEnabled) {
          const { data: candidates } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', item.productId)
            .eq('size', item.size);

          if (candidates && candidates.length > 0) {
            let targetRow = candidates.find(c => c.event_slug === currentEvent);
            if (!targetRow) targetRow = candidates.find(c => c.event_slug === 'default');
            if (!targetRow) targetRow = candidates.find(c => !c.event_slug);

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

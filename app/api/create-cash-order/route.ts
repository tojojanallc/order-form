import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, customerName, customerPhone, total, eventName, eventSlug, shippingInfo } = body;

    // Normalize slug
    const currentEvent = eventSlug || 'default';

    const hasBackorder = cart.some((item: any) => item.needsShipping);

    // 1. Create the Order
    // (The Database Trigger 'decrement_inventory_on_order' will see this and update stock automatically)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName,
          phone: customerPhone || 'N/A',
          total_price: parseFloat(total),
          status: hasBackorder ? 'pending_shipping' : 'pending',
          cart_data: cart,
          payment_status: 'unpaid', // Cash is usually unpaid until collected
          payment_method: 'cash',
          event_name: eventName,
          event_slug: currentEvent,
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

    // NO MANUAL INVENTORY UPDATE HERE (The Trigger handles it)

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Cash Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
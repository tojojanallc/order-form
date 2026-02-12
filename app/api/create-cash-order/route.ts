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

    const hasBackorder = cart.some((item: any) => item.needsShipping);

    // 1. Create the Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName,
          phone: customerPhone || 'N/A',
          total_price: parseFloat(total),
          status: hasBackorder ? 'pending_shipping' : 'pending', // Cash starts as pending until paid? Or assuming paid at counter.
          cart_data: cart,
          payment_status: 'unpaid', // Usually cash is marked paid manually, or set to 'paid' if you prefer.
          payment_method: 'cash',
          event_name: eventName,
          event_slug: eventSlug,
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

    // 2. DECREMENT INVENTORY
    for (const item of cart) {
        if (item.productId && item.size) {
            const { data: currentStock } = await supabase
                .from('inventory')
                .select('count')
                .eq('product_id', item.productId)
                .eq('size', item.size)
                .single();

            if (currentStock) {
                await supabase
                    .from('inventory')
                    .update({ count: Math.max(0, currentStock.count - 1) })
                    .eq('product_id', item.productId)
                    .eq('size', item.size);
            }
        }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Required to bypass RLS for ledger logging
);

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, customerName, customerPhone, total, eventName, eventSlug, shippingInfo } = body;

    const currentEvent = eventSlug || 'default';
    const hasBackorder = cart.some((item: any) => item.needsShipping);

    // 1. Create the Order
    // Your trigger 'decrement_inventory_on_order' will still handle the event-level stock count.
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName,
          phone: customerPhone || 'N/A',
          email: customerEmail,
          total_price: parseFloat(total),
          status: hasBackorder ? 'pending_shipping' : 'pending',
          cart_data: cart,
          payment_status: 'paid', // Cash is usually marked paid immediately at the counter
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

    // 2. LOG TO SALES LEDGER (The P&L Automation)
    // This loops through your cart to capture the profit data per item.
    for (const item of cart) {
      // Fetch the cost from the master warehouse table
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
        sale_price: item.finalPrice, 
        cost_basis: costBasis,
        payment_method: 'cash',
        order_id: order.id
      });
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Cash Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
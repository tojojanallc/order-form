import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INBOUND_SECRET = process.env.INBOUND_ORDER_SECRET!;

export async function POST(req: any) {
  try {
    // Simple secret check so random people can't post fake orders
    const authHeader = req.headers.get('x-api-key');
    if (authHeader !== INBOUND_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      customerName,
      customerPhone,
      customerEmail,
      eventSlug,
      eventName,
      cart,         // array of { productId, size, color, quantity, price }
      totalPrice,
      paymentMethod = 'hostinger',
    } = body;

    const currentEvent = eventSlug || 'default';

    // 1. Create the Order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_name: customerName || 'Hostinger Customer',
        phone: customerPhone || 'N/A',
        email: customerEmail || null,
        total_price: totalPrice || 0,
        status: 'pending',
        cart_data: cart,
        payment_status: 'paid',
        payment_method: paymentMethod,
        event_name: eventName || null,
        event_slug: currentEvent,
        created_at: new Date(),
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. Inventory update & sales ledger logging
    for (const item of cart) {
      if (item.productId && item.size) {
        const qty = item.quantity || 1;

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
          qty,
          sale_price: item.price || 0,
          cost_basis: costBasis,
          payment_method: paymentMethod,
          order_id: order.id,
        });

        // Decrement inventory
        const { data: candidates } = await supabase
          .from('inventory')
          .select('*')
          .eq('product_id', item.productId)
          .eq('size', item.size);

        if (candidates && candidates.length > 0) {
          let targetRow = candidates.find(c => c.event_slug === currentEvent)
            || candidates.find(c => c.event_slug === 'default')
            || candidates.find(c => !c.event_slug);

          if (targetRow) {
            const newCount = Math.max(0, targetRow.count - qty);
            await supabase
              .from('inventory')
              .update({ count: newCount })
              .eq('id', targetRow.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Inbound Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
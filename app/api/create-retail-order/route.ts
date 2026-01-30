import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { cart, customerName, total } = await request.json();

    // 1. Decrement Inventory & Validate
    for (const item of cart) {
        if (!item.productId || !item.size) continue;
        const { data: current } = await supabase
            .from('inventory')
            .select('count')
            .eq('product_id', item.productId)
            .eq('size', item.size)
            .single();

        if (!current || current.count < 1) {
            return NextResponse.json({ error: `Out of stock: ${item.productName} (${item.size})` }, { status: 400 });
        }

        await supabase
            .from('inventory')
            .update({ count: current.count - 1 })
            .eq('product_id', item.productId)
            .eq('size', item.size);
    }

    // 2. Create the "Unpaid" Order Row
    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            customer_name: customerName || 'Walk-in Retail',
            cart_data: cart,
            total_price: total,
            status: 'pending', // Order exists...
            payment_status: 'unpaid', // ...but waiting for Terminal
            event_name: 'Retail Kiosk', // Optional: Tag these orders
        })
        .select()
        .single();

    if (error) throw error;

    return NextResponse.json({ success: true, orderId: order.id });

  } catch (error) {
    console.error("Create Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
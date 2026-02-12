import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, customerName, total } = body;

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
          created_at: new Date()
        },
      ])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. DECREMENT INVENTORY (The Fix)
    for (const item of cart) {
        if (item.productId && item.size) {
            // A. Get current stock
            const { data: currentStock } = await supabase
                .from('inventory')
                .select('count')
                .eq('product_id', item.productId)
                .eq('size', item.size)
                .single();

            // B. Subtract 1 and save
            if (currentStock) {
                await supabase
                    .from('inventory')
                    .update({ count: Math.max(0, currentStock.count - 1) }) // Prevent negative numbers
                    .eq('product_id', item.productId)
                    .eq('size', item.size);
            }
        }
    }

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (error: any) {
    console.error('Retail Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

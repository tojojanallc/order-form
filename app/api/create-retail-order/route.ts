import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { cart, customerName, total } = await req.json();

    if (!cart || cart.length === 0) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }

    // 1. Process Inventory (Allow Backorders)
    for (const item of cart) {
      const { productId, size } = item;

      // Check current stock
      const { data: invItem } = await supabase
        .from('inventory')
        .select('count, active')
        .eq('product_id', productId)
        .eq('size', size)
        .single();

      if (invItem) {
        if (invItem.count > 0) {
          // In Stock: Decrement it
          await supabase.from('inventory').update({ count: invItem.count - 1 }).eq('product_id', productId).eq('size', size);
        } else {
          // Out of Stock: Just log it, DO NOT BLOCK (Allow "Ship to Home")
          console.log(`⚠️ Backorder placed for: ${item.productName} (${size})`);
        }
      }
    }

    // 2. Determine Shipping Status
    const hasBackorder = cart.some(item => item.needsShipping); // Frontend flag

    // 3. Create Order
    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName,
          cart_data: cart,
          total_price: total,
          payment_status: 'pending', // Will be updated by Terminal
          status: hasBackorder ? 'pending_shipping' : 'pending', // Flag for shipping if needed
          created_at: new Date(),
        },
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, orderId: data.id });

  } catch (error) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
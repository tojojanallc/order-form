import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { cart, customerName, total } = body;

    // 1. Validate Input
    if (!cart || cart.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 2. Determine Shipping Status
    const hasBackorder = cart.some((item: any) => item.needsShipping);

    // 3. Create Order in Supabase (FIXED COLUMN NAMES)
    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          customer_name: customerName || 'Retail Customer',
          total_price: parseFloat(total), // Fixed: was total_amount
          status: hasBackorder ? 'pending_shipping' : 'completed',
          cart_data: cart, // Fixed: was items
          payment_status: 'paid', 
          payment_method: 'terminal', // Added for clarity
          created_at: new Date()
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, orderId: data.id });
  } catch (error: any) {
    console.error('Retail Order Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
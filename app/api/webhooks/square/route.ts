import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Separate Supabase client for this webhook
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    // 1. Grab the data
    const body = await req.json();
    
    // 2. Check if it is a Terminal Checkout Update
    if (body.type === 'terminal.checkout.updated') {
      const checkout = body.data.object.checkout;
      const orderId = checkout.reference_id; // Retrieve our Supabase Order ID

      console.log(`🔔 Square Event: Order #${orderId} status is ${checkout.status}`);

      // 3. If COMPLETED, mark as PAID
      if (checkout.status === 'COMPLETED') {
        const { error } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'paid', 
            status: 'pending', // Ready to print/ship
            payment_intent_id: checkout.id // Save Square Checkout ID here
          })
          .eq('id', orderId);

        if (error) {
            console.error("❌ DB Update Failed:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        console.log(`✅ Order #${orderId} marked as PAID.`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook Error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
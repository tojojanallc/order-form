import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ⚠️ CRITICAL FIX: Use SERVICE_ROLE_KEY to bypass RLS.
// The "Anon" key will likely be blocked from updating orders by the database policies.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

export async function POST(req) {
  try {
    // 1. Grab the data
    const text = await req.text(); // Get raw text first (safer for parsing)
    const body = JSON.parse(text);
    
    // 2. Filter for Terminal Checkout Updates
    if (body.type === 'terminal.checkout.updated') {
      const checkout = body.data.object.checkout;
      const orderId = checkout.reference_id; // This links back to your Supabase Order ID
      const status = checkout.status;

      console.log(`🔔 Square Webhook: Order #${orderId} is ${status}`);

      // 3. If COMPLETED, update the database
      if (status === 'COMPLETED') {
        const { error } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'paid', 
            status: 'pending', // Order is now active/paid
            payment_intent_id: checkout.id // Saves the Square Transaction ID for refunds
          })
          .eq('id', orderId);

        if (error) {
            console.error("❌ Supabase Update Failed:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        console.log(`✅ Order #${orderId} marked as PAID.`);
      }

      // 4. (Optional) Handle Canceled
      if (status === 'CANCELED') {
          console.log(`🚫 Order #${orderId} was canceled at the terminal.`);
          // Optional: Mark as canceled in DB if you want
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook Error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
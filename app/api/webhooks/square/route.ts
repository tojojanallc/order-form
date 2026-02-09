import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SAFETY: Use Service Role to ensure we can write to the DB
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const text = await req.text();
    const body = JSON.parse(text);
    
    if (body.type === 'terminal.checkout.updated') {
      const checkout = body.data.object.checkout;
      const orderId = checkout.reference_id;
      const status = checkout.status;

      console.log(`🔔 Square Webhook: Order #${orderId} is ${status}`);

      if (status === 'COMPLETED') {
        // --- FIX: GRAB THE REAL PAYMENT ID ---
        // Terminal Checkouts generate a list of payment_ids. We need the first one for refunds.
        const paymentId = checkout.payment_ids ? checkout.payment_ids[0] : null;

        const { error } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'paid', 
            status: 'pending', 
            payment_intent_id: paymentId // <--- NOW SAVING THE CORRECT ID FOR REFUNDS
          })
          .eq('id', orderId);

        if (error) console.error("❌ Supabase Update Failed:", error.message);
        else console.log(`✅ Order #${orderId} marked as PAID (ID: ${paymentId})`);
      }
      
      if (status === 'CANCELED') {
          await supabase.from('orders').update({ status: 'canceled' }).eq('id', orderId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook Error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
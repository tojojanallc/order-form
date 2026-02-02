import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Setup Admin Supabase (Needs Service Role Key to bypass RLS if necessary, or Anon is fine if policies allow update)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Use Service Key for backend updates
);

export async function POST(req) {
  try {
    const text = await req.text(); // Get raw body
    // ideally validate signature here using process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
    
    const event = JSON.parse(text);

    // We care about "terminal.checkout.updated" or "payment.updated"
    if (event.type === 'terminal.checkout.updated') {
        const checkout = event.data.object.checkout;
        const orderId = checkout.reference_id; // We sent this earlier
        const status = checkout.status;

        console.log(`🔔 Webhook: Order ${orderId} is ${status}`);

        if (status === 'COMPLETED') {
            // 1. Update Order in Supabase
            const { error } = await supabase
                .from('orders')
                .update({ 
                    payment_status: 'paid',
                    status: 'pending_shipping', // or 'ready' depending on your flow
                    payment_intent_id: checkout.payment_ids ? checkout.payment_ids[0] : 'terminal_txn'
                })
                .eq('id', orderId);

            if (error) console.error("Supabase Update Error:", error);
            else console.log("✅ Order marked as PAID.");
        }
        
        if (status === 'CANCELED') {
             await supabase.from('orders').update({ status: 'canceled' }).eq('id', orderId);
        }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
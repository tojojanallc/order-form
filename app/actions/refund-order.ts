'use server';

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Client, Environment } from 'square';

// 1. Setup Clients
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function refundOrder(orderId, paymentId) {
  console.log(`💸 Attempting Refund for Order #${orderId} (Payment ID: ${paymentId})`);

  try {
    // 2. FETCH ORDER TOTAL (Required for Square Refunds)
    const { data: order } = await supabase.from('orders').select('total_price').eq('id', orderId).single();
    const amountInCents = Math.round((order?.total_price || 0) * 100);

    let refundId = '';

    // 3. DECIDE: STRIPE OR SQUARE?
    if (paymentId.startsWith('pi_')) {
      // --- STRIPE REFUND ---
      console.log("👉 Detected Stripe Payment");
      const refund = await stripe.refunds.create({
        payment_intent: paymentId,
      });
      refundId = refund.id;

    } else {
      // --- SQUARE REFUND ---
      console.log("👉 Detected Square Payment");
      
      if (!amountInCents) throw new Error("Could not determine refund amount from order.");

      const response = await square.refundsApi.refundPayment({
        idempotencyKey: `refund_${orderId}_${Date.now()}`,
        amountMoney: {
          amount: BigInt(amountInCents),
          currency: 'USD'
        },
        paymentId: paymentId // Requires the Payment ID (from payment_ids[0])
      });

      refundId = response.result.refund.id;
    }

    // 4. UPDATE DATABASE
    await supabase.from('orders').update({ status: 'refunded' }).eq('id', orderId);
    
    return { success: true, message: `Refunded successfully (ID: ${refundId})` };

  } catch (error) {
    console.error("❌ Refund Error:", error);
    // Handle Square's complex error objects
    const msg = error.result ? JSON.stringify(error.result.errors) : error.message;
    return { success: false, message: msg };
  }
}
// @ts-nocheck
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // EVENT: Payment Succeeded
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata.supabase_order_id;
    const customerName = session.metadata.customer_name;
    const amountPaid = session.amount_total / 100;

    console.log(`💰 Payment success for ${customerName}. Order ID: ${orderId}`);

    if (orderId) {
      // 1. UPDATE existing order (The "Ghost" Order)
      const { error } = await supabase
        .from('orders')
        .update({ 
            payment_status: 'paid', 
            status: 'pending', // Ensure it shows as ready
            payment_intent_id: session.payment_intent
        })
        .eq('id', orderId);

      if (error) console.error("Supabase Update Error:", error);
    } else {
      // 2. FALLBACK: If no ID was passed, insert a new row (Safety net)
      const { error } = await supabase.from('orders').insert({
        customer_name: customerName,
        total_price: amountPaid,
        status: 'pending',
        payment_status: 'paid', // Explicitly mark paid
        payment_intent_id: session.payment_intent,
        cart_data: [] // We don't have cart data here if it wasn't passed, but the order is recorded
      });
      if (error) console.error("Supabase Insert Error:", error);
    }
  }

  return NextResponse.json({ received: true });
}
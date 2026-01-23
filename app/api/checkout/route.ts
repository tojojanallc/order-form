// @ts-nocheck
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;
// Safely initialize Stripe. If key is missing, it won't crash the build, but will error on checkout.
const stripe = stripeKey ? new Stripe(stripeKey) : null;

export async function POST(request) {
  if (!stripe) {
    console.error("Stripe Key Missing");
    return NextResponse.json({ error: 'Server Config Error: Missing Stripe Key' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { cart, customerName } = body;

    // Convert your Cart items into Stripe's format
    const lineItems = cart.map((item) => {
        const description = [
            `Size: ${item.size}`,
            ...item.customizations.logos.map(l => `Logo: ${l.type} (${l.position})`),
            ...item.customizations.names.map(n => `Name: ${n.text} (${n.position})`)
        ].join(', ');

        return {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.productName,
                    description: description.substring(0, 400),
                },
                unit_amount: item.finalPrice * 100, 
            },
            quantity: 1,
        };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/success`,
      cancel_url: `${request.headers.get('origin')}/`,
      metadata: { customer_name: customerName },
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error("Stripe Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
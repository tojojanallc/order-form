// @ts-nocheck
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// ⚠️ PASTE YOUR SECRET KEY (sk_test_...) HERE ⚠️
const stripe = new Stripe('sk_test_...');

export async function POST(request) {
  try {
    const body = await request.json();
    const { cart, customerName } = body;

    // Convert your Cart items into Stripe's format
    const lineItems = cart.map((item) => {
        // Create a description of the custom choices
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
                    description: description.substring(0, 400), // Stripe limit
                },
                unit_amount: item.finalPrice * 100, // Stripe expects cents (e.g. $20.00 = 2000)
            },
            quantity: 1,
        };
    });

    // Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/success`,
      cancel_url: `${request.headers.get('origin')}/`,
      metadata: {
        customer_name: customerName,
        // We can store the full order ID here later if needed
      },
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error("Stripe Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
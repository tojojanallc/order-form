// @ts-nocheck
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

export async function POST(request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Server Error: Stripe Key Missing' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { cart, customerName } = body;

    // Convert the Cart into Stripe Line Items
    const lineItems = cart.map((item) => {
        // Create a readable description of all customizations
        const descriptionParts = [
            `Size: ${item.size}`,
            ...item.customizations.logos.map(l => `Logo: ${l.type} (${l.position})`),
            ...item.customizations.names.map(n => `Name: ${n.text} (${n.position})`)
        ];
        
        if (item.customizations.backList) descriptionParts.push("Back List");
        if (item.customizations.metallic) descriptionParts.push("Metallic");

        return {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.productName,
                    description: descriptionParts.join(', ').substring(0, 400), // Max 400 chars
                },
                unit_amount: item.finalPrice * 100, // Convert to cents
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
    console.error("Stripe API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
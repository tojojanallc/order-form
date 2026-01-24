// @ts-nocheck
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 1. Setup Stripe
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// 2. Setup Supabase (Admin Access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(request) {
  if (!stripe || !supabase) {
    return NextResponse.json({ error: 'Server Error: Missing Keys' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { cart, customerName } = body;

    // --- NEW: DECREMENT INVENTORY ---
    // We loop through the cart and subtract 1 for each item found in inventory
    for (const item of cart) {
        // We only decrement if the item HAS an entry in the inventory table
        // (This prevents errors if you add a new product but forget to add it to the DB)
        const { data: currentStock } = await supabase
            .from('inventory')
            .select('count')
            .eq('id', item.id) // Matches 'hoodie_aqua' etc.
            .single();

        if (currentStock) {
            await supabase
                .from('inventory')
                .update({ count: currentStock.count - 1 })
                .eq('id', item.id);
        }
    }
    // --------------------------------

    // Convert Cart to Stripe Items
    const lineItems = cart.map((item) => {
        const descriptionParts = [
            `Size: ${item.size}`,
            ...item.customizations.logos.map(l => `Logo: ${l.type} (${l.position})`),
            ...item.customizations.names.map(n => `Name: ${n.text} (${n.position})`)
        ];
        
        if (item.customizations.backList) descriptionParts.push("Back List");
        if (item.customizations.metallic) descriptionParts.push("Metallic");
        if (item.needsShipping) descriptionParts.push("SHIPPING REQUESTED");

        return {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.productName,
                    description: descriptionParts.join(', ').substring(0, 400),
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
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
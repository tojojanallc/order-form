// @ts-nocheck
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(request) {
  if (!stripe || !supabase) {
    return NextResponse.json({ error: 'Server Error: Missing Keys' }, { status: 500 });
  }

  try {
    const body = await request.json();
    // We now expect an 'orderId' if the order was already created in the frontend
    const { cart, customerName, orderId } = body; 

    // --- DECREMENT INVENTORY ---
    for (const item of cart) {
        if (!item.productId || !item.size) continue;
        const { data: currentStock } = await supabase
            .from('inventory')
            .select('count')
            .eq('product_id', item.productId)
            .eq('size', item.size)
            .single();

        if (currentStock) {
            await supabase
                .from('inventory')
                .update({ count: currentStock.count - 1 })
                .eq('product_id', item.productId)
                .eq('size', item.size);
        }
    }
    // ---------------------------

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
                unit_amount: Math.round(item.finalPrice * 100), // Ensure integer
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
      // CRITICAL: We pass the orderId (if it exists) so the webhook can find it later
      metadata: { 
          customer_name: customerName,
          supabase_order_id: orderId || '' 
      },
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
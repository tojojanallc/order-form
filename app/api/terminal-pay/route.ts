import { NextResponse } from 'next/server';

export async function POST(request) {
  // 1. SAFETY CHECK: Verify Keys
  if (!process.env.SQUARE_ACCESS_TOKEN) {
      console.error("❌ CRITICAL: SQUARE_ACCESS_TOKEN is missing from env variables");
      return NextResponse.json({ error: "Server Configuration Error: Missing Square Token" }, { status: 500 });
  }
  if (!process.env.SQUARE_TERMINAL_ID) {
      console.error("❌ CRITICAL: SQUARE_TERMINAL_ID is missing from env variables");
      return NextResponse.json({ error: "Server Configuration Error: Missing Terminal ID" }, { status: 500 });
  }

  try {
    // 2. Parse Data
    const body = await request.json();
    const { orderId, amount, currency = 'USD' } = body;

    // 3. Validation
    if (!orderId) {
        return NextResponse.json({ error: "Validation Error: Missing Order ID" }, { status: 400 });
    }
    const finalAmount = Math.round(Number(amount) * 100);
    if (isNaN(finalAmount) || finalAmount <= 0) {
        return NextResponse.json({ error: `Validation Error: Invalid Amount (${amount})` }, { status: 400 });
    }

    // 4. FORCE LOAD SQUARE (The Fix)
    // We use 'require' here to bypass the "Client is not a constructor" webpack error.
    const { Client } = require('square');

    const squareClient = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: 'production', 
    });

    // 5. Send to Terminal
    console.log(`🚀 Sending ${finalAmount} cents to Terminal ${process.env.SQUARE_TERMINAL_ID}...`);
    
    const response = await squareClient.terminalApi.createTerminalCheckout({
      idempotencyKey: crypto.randomUUID(),
      checkout: {
        amountMoney: {
          amount: BigInt(finalAmount),
          currency: currency,
        },
        deviceOptions: {
          deviceId: process.env.SQUARE_TERMINAL_ID,
        },
        referenceId: String(orderId), 
        note: `Order #${orderId}`,
      },
    });

    const checkout = response.result.checkout;
    console.log("✅ Square Response Received:", checkout.id);

    // 6. SERIALIZATION FIX
    const safeResponse = JSON.parse(JSON.stringify(checkout, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
    
    return NextResponse.json({ 
      success: true, 
      status: safeResponse.status,
      checkoutId: safeResponse.id 
    });

  } catch (error) {
    console.error("❌ Square API Error:", error);
    let msg = error.message;
    if (error.result && error.result.errors) {
        msg = error.result.errors.map(e => `${e.category}: ${e.detail}`).join(', ');
    }
    return NextResponse.json({ error: "Square Failed", details: msg }, { status: 500 });
  }
}
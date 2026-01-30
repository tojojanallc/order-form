import { NextResponse } from 'next/server';
import { Client, Environment } from 'square';

export async function POST(request) {
  // 1. SAFETY CHECK: Do the keys exist?
  if (!process.env.SQUARE_ACCESS_TOKEN) {
      console.error("MISSING KEY: SQUARE_ACCESS_TOKEN");
      return NextResponse.json({ error: "Server Error: Missing Square Token" }, { status: 500 });
  }
  if (!process.env.SQUARE_TERMINAL_ID) {
      console.error("MISSING KEY: SQUARE_TERMINAL_ID");
      return NextResponse.json({ error: "Server Error: Missing Terminal ID" }, { status: 500 });
  }

  // 2. Initialize Client
  const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production, 
  });

  try {
    const { orderId, amount, currency = 'USD' } = await request.json();

    if (!orderId || !amount) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // 3. Send Request to Square
    const response = await squareClient.terminalApi.createTerminalCheckout({
      idempotencyKey: crypto.randomUUID(),
      checkout: {
        amountMoney: {
          amount: Math.round(amount * 100), // e.g. 1000 cents = $10.00
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

    // 4. BIGINT FIX (CRITICAL)
    // Square returns 'BigInt' values which crash Next.js JSON. 
    // We must convert them to strings manually.
    const safeResponse = JSON.parse(JSON.stringify(checkout, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
    
    return NextResponse.json({ 
      success: true, 
      status: safeResponse.status,
      checkoutId: safeResponse.id 
    });

  } catch (error) {
    // 5. Deep Error Logging
    console.error("Square API Error:", error);
    
    let msg = error.message;
    // If Square sent a detailed error list, grab the first one
    if (error.result && error.result.errors && error.result.errors.length > 0) {
        msg = error.result.errors[0].detail; 
    }

    return NextResponse.json({ error: "Square Failed", details: msg }, { status: 500 });
  }
}
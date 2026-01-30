import { NextResponse } from 'next/server';
import { Client, Environment } from 'square';

export async function POST(request) {
  // 1. Initialize Square INSIDE the function (Lazy Loading)
  // This prevents the build from crashing if keys are missing during compile time.
  const squareClient = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production, 
  });

  try {
    const { orderId, amount, currency = 'USD' } = await request.json();

    if (!orderId || !amount) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // 2. Create the Terminal Checkout Request
    const response = await squareClient.terminalApi.createTerminalCheckout({
      idempotencyKey: crypto.randomUUID(),
      checkout: {
        amountMoney: {
          amount: Math.round(amount * 100), 
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
    
    return NextResponse.json({ 
      success: true, 
      status: checkout.status,
      checkoutId: checkout.id 
    });

  } catch (error) {
    // Enhanced Error Logging
    // If error.result exists, it contains the deep Square API error details
    const details = error.result ? JSON.stringify(error.result, null, 2) : error.message;
    console.error("Terminal API Error:", details);
    
    return NextResponse.json({ error: "Square Error", details }, { status: 500 });
  }
}
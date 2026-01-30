import { NextResponse } from 'next/server';
import { Client, Environment } from 'square';

// Initialize Square Client
// Make sure SQUARE_ACCESS_TOKEN is in your .env.local
const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production, // Must be Production for physical devices
});

export async function POST(request) {
  try {
    const { orderId, amount } = await request.json();

    if (!orderId || !amount) {
      return NextResponse.json({ error: 'Missing orderId or amount' }, { status: 400 });
    }

    console.log(`🚀 Sending $${amount} request to Terminal for Order #${orderId}...`);

    const response = await square.terminalApi.createTerminalCheckout({
      idempotencyKey: crypto.randomUUID(), // Prevents double-charging on network glitches
      checkout: {
        amountMoney: {
          amount: Math.round(amount * 100), // Convert $30.00 to 3000 cents
          currency: 'USD',
        },
        deviceOptions: {
          deviceId: process.env.SQUARE_TERMINAL_ID, // The ID you just got (db_...)
        },
        referenceId: String(orderId), // CRITICAL: This links the payment back to Supabase
        note: `Order #${orderId}`, // Shows on the Terminal screen
      },
    });

    const checkout = response.result.checkout;
    console.log("✅ Terminal request sent:", checkout.id);

    return NextResponse.json({ success: true, checkoutId: checkout.id });

  } catch (error) {
    // Log the deep error details from Square for easier debugging
    const details = error.result ? JSON.stringify(error.result, null, 2) : error.message;
    console.error("Square Terminal Error:", details);
    return NextResponse.json({ error: "Terminal Error", details }, { status: 500 });
  }
}
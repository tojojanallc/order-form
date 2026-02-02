import { NextResponse } from 'next/server';
import { Client, Environment } from 'square';

// Initialize Square Client
const square = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox,
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { orderId, amount, deviceId } = body;

    if (!orderId || !amount || !deviceId) {
      return NextResponse.json({ success: false, error: "Missing order, amount, or terminal ID" }, { status: 400 });
    }

    console.log(`💳 Sending Terminal Checkout to Device: ${deviceId} for Order: ${orderId}`);

    // 1. Convert amount to BigInt (Square requires active integer cents)
    // Multiplied by 100 in frontend? If frontend sends $30.00 as 30, we do * 100. 
    // If frontend sends 3000, we use as is. 
    // Assuming frontend sends RAW DOLLARS (e.g. 30), so we multiply by 100.
    // CHECK YOUR FRONTEND: In the code provided, calculateGrandTotal() sums integers? 
    // Usually standard is cents. Let's assume cents (BigInt).
    
    // Safety check: Cast to BigInt
    const amountMoney = BigInt(Math.round(amount * 100)); // e.g. 30.00 -> 3000

    // 2. Create Terminal Checkout Request
    const response = await square.terminalApi.createTerminalCheckout({
      idempotencyKey: `checkout_${orderId}_${Date.now()}`,
      checkout: {
        amountMoney: {
          amount: amountMoney,
          currency: 'USD',
        },
        deviceOptions: {
          deviceId: deviceId, // <--- THIS IS THE MAGIC LINK
          skipReceiptScreen: true, // Faster checkout
        },
        referenceId: String(orderId), // Links Square txn to Supabase Order
        note: `Order #${orderId}`,
      },
    });

    const checkout = response.result.checkout;
    
    return NextResponse.json({ 
      success: true, 
      checkoutId: checkout.id,
      status: checkout.status 
    });

  } catch (error) {
    console.error("Square Terminal Error:", error);
    // Handle bigInt serialization if error contains bigints
    const errorMessage = error.result ? JSON.stringify(error.result, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ) : error.message;
    
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
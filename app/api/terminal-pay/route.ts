import { NextResponse } from 'next/server';
import { Client } from 'square'; // Removed 'Environment' from import to prevent crash

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

    console.log(`🔌 API Input Received: Order ${orderId}, Amount: ${amount}`);

    // 3. Validation
    if (!orderId) {
        return NextResponse.json({ error: "Validation Error: Missing Order ID" }, { status: 400 });
    }
    
    // Ensure amount is a valid number
    const finalAmount = Math.round(Number(amount) * 100);
    if (isNaN(finalAmount) || finalAmount <= 0) {
        return NextResponse.json({ error: `Validation Error: Invalid Amount (${amount})` }, { status: 400 });
    }

    // 4. Initialize Square (FIXED: Using string 'production' instead of Enum)
    const squareClient = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: 'production', // Direct string avoids the "undefined" crash
    });

    // 5. Send to Terminal
    console.log(`🚀 Sending ${finalAmount} cents to Terminal ${process.env.SQUARE_TERMINAL_ID}...`);
    
    const response = await squareClient.terminalApi.createTerminalCheckout({
      idempotencyKey: crypto.randomUUID(),
      checkout: {
        amountMoney: {
          amount: BigInt(finalAmount), // SDK requires BigInt for money
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

    // 6. SERIALIZATION FIX (Prevents BigInt Crash)
    // Convert BigInts to strings before returning JSON to frontend
    const safeResponse = JSON.parse(JSON.stringify(checkout, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    ));
    
    return NextResponse.json({ 
      success: true, 
      status: safeResponse.status,
      checkoutId: safeResponse.id 
    });

  } catch (error) {
    // 7. Deep Error Logging
    console.error("❌ Square API Error:", error);
    
    let msg = error.message;
    
    // Attempt to extract deep Square errors
    if (error.result && error.result.errors) {
        msg = error.result.errors.map(e => `${e.category}: ${e.detail}`).join(', ');
    } else if (error.body) {
        try {
            const body = JSON.parse(error.body);
            if (body.errors) msg = body.errors[0].detail;
        } catch (e) {}
    }

    return NextResponse.json({ error: "Square Failed", details: msg }, { status: 500 });
  }
}
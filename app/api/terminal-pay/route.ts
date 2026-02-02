import { NextResponse } from 'next/server';

export async function POST(request) {
  // 1. SAFETY CHECK
  if (!process.env.SQUARE_ACCESS_TOKEN) {
      console.error("❌ CRITICAL: SQUARE_ACCESS_TOKEN is missing.");
      return NextResponse.json({ error: "Server Error: Missing Square Token" }, { status: 500 });
  }
  if (!process.env.SQUARE_TERMINAL_ID) {
      console.error("❌ CRITICAL: SQUARE_TERMINAL_ID is missing.");
      return NextResponse.json({ error: "Server Error: Missing Terminal ID" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { orderId, amount, currency = 'USD' } = body;

    // 2. VALIDATION
    const finalAmount = Math.round(Number(amount) * 100); // Cents
    if (!orderId || isNaN(finalAmount) || finalAmount <= 0) {
        return NextResponse.json({ error: "Invalid Data" }, { status: 400 });
    }

    console.log(`🚀 Sending ${finalAmount} cents to Terminal via Raw Fetch...`);

    // 3. RAW FETCH REQUEST (Bypasses SDK Issues)
    const response = await fetch('https://connect.squareup.com/v2/terminals/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        checkout: {
          amount_money: {
            amount: finalAmount, // Raw number is fine here
            currency: currency,
          },
          device_options: {
            device_id: process.env.SQUARE_TERMINAL_ID,
          },
          reference_id: String(orderId),
          note: `Order #${orderId}`,
        },
      }),
    });

    // 4. HANDLE RESPONSE
    const data = await response.json();

    if (!response.ok) {
        console.error("❌ Square API Error:", data);
        const errorMsg = data.errors ? data.errors[0].detail : "Unknown Error";
        return NextResponse.json({ error: "Square Failed", details: errorMsg }, { status: 500 });
    }

    const checkout = data.checkout;
    console.log("✅ Square Response Received:", checkout.id);

    return NextResponse.json({ 
      success: true, 
      status: checkout.status,
      checkoutId: checkout.id 
    });

  } catch (error) {
    console.error("❌ System Error:", error);
    return NextResponse.json({ error: "System Error", details: error.message }, { status: 500 });
  }
}
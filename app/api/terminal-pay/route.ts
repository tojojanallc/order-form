import { NextResponse } from 'next/server';

export async function POST(request) {
  // 1. SAFETY CHECK (Access Token Only)
  if (!process.env.SQUARE_ACCESS_TOKEN) {
      console.error("❌ CRITICAL: SQUARE_ACCESS_TOKEN is missing.");
      return NextResponse.json({ error: "Server Error: Missing Square Token" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { orderId, amount, currency = 'USD', deviceId } = body;

    // 2. DETERMINE TERMINAL ID
    // Priority: 1. ID sent from iPad (Multi-Kiosk) -> 2. ID in .env (Single Kiosk Backup)
    const targetDevice = deviceId || process.env.SQUARE_TERMINAL_ID;

    if (!targetDevice) {
        console.error("❌ No Terminal ID found in request or environment variables.");
        return NextResponse.json({ error: "Setup Error: No Terminal ID linked. Please run setup on the iPad." }, { status: 400 });
    }

    // 3. VALIDATION
    const finalAmount = Math.round(Number(amount) * 100); // Cents
    if (!orderId || isNaN(finalAmount) || finalAmount <= 0) {
        return NextResponse.json({ error: "Invalid Data" }, { status: 400 });
    }

    console.log(`🚀 Sending ${finalAmount} cents to Terminal ${targetDevice}...`);

    // 4. RAW FETCH REQUEST
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
            device_id: targetDevice, // <--- USES THE DYNAMIC ID
          },
          reference_id: String(orderId),
          note: `Order #${orderId}`,
        },
      }),
    });

    // 5. HANDLE RESPONSE
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
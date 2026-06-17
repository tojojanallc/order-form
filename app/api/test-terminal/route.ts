import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { deviceId, amount } = body;

  const squareDeviceId = deviceId?.startsWith('device:') ? deviceId : `device:${deviceId}`;
  const finalAmount = Math.round(Number(amount) * 100);

  const response = await fetch('https://connect.squareup.com/v2/terminals/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      checkout: {
        amount_money: { amount: finalAmount, currency: 'USD' },
        device_options: { device_id: squareDeviceId },
        reference_id: 'test-001',
        note: 'Test payment',
      },
    }),
  });

  const data = await response.json();
  return NextResponse.json({ 
    status: response.status,
    squareDeviceId,
    finalAmount,
    response: data 
  });
}

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name, location_id } = await req.json();

    const res = await fetch('https://connect.squareup.com/v2/devices/codes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        idempotency_key: `device-code-${Date.now()}`,
        device_code: {
          name: name || 'New Terminal',
          product_type: 'TERMINAL_API',
          ...(location_id ? { location_id } : {}),
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.errors?.[0]?.detail || 'Square API error' }, { status: 500 });
    }

    return NextResponse.json({ 
      code: data.device_code?.code,
      id: data.device_code?.id,
      name: data.device_code?.name,
      status: data.device_code?.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  // Get locations so user can pick one
  try {
    const res = await fetch('https://connect.squareup.com/v2/locations', {
      headers: {
        'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18',
      },
    });
    const data = await res.json();
    return NextResponse.json({ locations: data.locations || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
// Debug: added location logging

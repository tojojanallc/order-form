import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Only the Lev portal may call this (Setup → Card terminals): it sends the shared secret kept in the private
// lev_app_secrets table (RLS on, no policies — only the two apps' servers can read it with the service role key).
let secret: string | null = null;
async function allowed(req: Request) {
  if (!secret) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.from('lev_app_secrets').select('value').eq('key', 'kiosk_api').maybeSingle();
    secret = data?.value || null;
  }
  const got = Buffer.from(req.headers.get('x-lev-secret') || '');
  const want = Buffer.from(secret || '');
  return !!secret && got.length === want.length && timingSafeEqual(got, want);
}
const denied = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function POST(req: Request) {
  if (!(await allowed(req))) return denied();
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
          location_id: location_id || 'LZXRJ5FXAXGXE',
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

export async function GET(req: Request) {
  if (!(await allowed(req))) return denied();
  // ?id=<device code id> → pairing status (PAIRED includes the terminal's device_id); otherwise the Square locations
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    try {
      const res = await fetch(`https://connect.squareup.com/v2/devices/codes/${encodeURIComponent(id)}`, {
        headers: { 'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, 'Square-Version': '2024-01-18' },
      });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.errors?.[0]?.detail || 'Square API error' }, { status: 500 });
      const d = data.device_code || {};
      return NextResponse.json({ id: d.id, code: d.code, name: d.name, status: d.status, device_id: d.device_id || null });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
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

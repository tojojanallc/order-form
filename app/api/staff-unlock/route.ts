import { NextResponse } from 'next/server';
import { admin } from '@/app/lib/server';

// Kiosk staff mode: the manager PIN or the staff/admin passcode unlocks the staff-only buttons on the iPad.
// 5 wrong tries from one network in 15 minutes locks it for the rest of that window (lev_sms_log kind 'pin_fail').
export async function POST(request: Request) {
  try {
    const db = admin();
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await db.from('lev_sms_log').select('id', { count: 'exact', head: true }).eq('kind', 'pin_fail').eq('phone', ip).gte('sent_at', since);
    if ((count || 0) >= 5) return NextResponse.json({ success: false, error: 'Too many tries — wait 15 minutes' }, { status: 429 });
    const { pin } = await request.json();
    const ok = typeof pin === 'string' && pin.length > 0 &&
      [process.env.PRICE_OVERRIDE_PIN, process.env.STAFF_PASSWORD, process.env.ADMIN_PASSWORD].some(v => v && v === pin);
    if (!ok) await db.from('lev_sms_log').insert({ kind: 'pin_fail', phone: ip });
    return NextResponse.json({ success: ok }, { status: ok ? 200 : 401 });
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

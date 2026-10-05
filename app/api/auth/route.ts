import { NextResponse, type NextRequest } from 'next/server';
import { admin } from '@/app/lib/server';
import { STAFF_COOKIE, signStaff, verifyStaff } from '@/lib/kioskAuth';

// Kiosk admin passcodes. A right passcode sets a signed httpOnly cookie for 12 hours (role admin or staff).
// 5 wrong tries from one network in 15 minutes locks passcode sign-in for the rest of that window.
export async function POST(request: NextRequest) {
  try {
    const db = admin();
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const { count } = await db.from('lev_sms_log').select('id', { count: 'exact', head: true }).eq('kind', 'pin_fail').eq('phone', ip).gte('sent_at', new Date(Date.now() - 15 * 60_000).toISOString());
    if ((count || 0) >= 5) return NextResponse.json({ success: false, error: 'Too many tries — wait 15 minutes' }, { status: 429 });
    const { password } = await request.json().catch(() => ({}));
    const role = password && password === process.env.ADMIN_PASSWORD ? 'admin' : password && password === process.env.STAFF_PASSWORD ? 'staff' : null;
    if (!role) {
      await db.from('lev_sms_log').insert({ kind: 'pin_fail', phone: ip });
      return NextResponse.json({ success: false }, { status: 401 });
    }
    const res = NextResponse.json({ success: true, role });
    res.cookies.set(STAFF_COOKIE, await signStaff(role), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600 });
    return res;
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

// Which passcode role this browser is signed in with (if any)
export async function GET(request: NextRequest) {
  return NextResponse.json({ role: await verifyStaff(request.cookies.get(STAFF_COOKIE)?.value) });
}

// Sign out of passcode access
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(STAFF_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}

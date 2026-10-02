import { NextResponse } from 'next/server';

// Kiosk staff mode: the manager PIN or the staff/admin passcode unlocks the staff-only buttons on the iPad.
export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    const ok = typeof pin === 'string' && pin.length > 0 &&
      [process.env.PRICE_OVERRIDE_PIN, process.env.STAFF_PASSWORD, process.env.ADMIN_PASSWORD].some(v => v && v === pin);
    return NextResponse.json({ success: ok }, { status: ok ? 200 : 401 });
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    if (pin === process.env.PRICE_OVERRIDE_PIN) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}

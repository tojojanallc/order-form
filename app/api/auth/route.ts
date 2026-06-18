// @ts-nocheck
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { password } = await request.json();
    
    if (password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: true, role: 'admin' });
    } else if (password === process.env.STAFF_PASSWORD) {
      return NextResponse.json({ success: true, role: 'staff' });
    } else {
      return NextResponse.json({ success: false }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
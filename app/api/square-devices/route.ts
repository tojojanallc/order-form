import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch('https://connect.squareup.com/v2/devices', {
    headers: {
      'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': '2024-01-18',
    },
  });
  const data = await res.json();
  return NextResponse.json(data);
}

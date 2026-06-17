import { NextResponse } from 'next/server';

export async function GET() {
  const [locRes, meRes] = await Promise.all([
    fetch('https://connect.squareup.com/v2/locations', {
      headers: { 'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, 'Square-Version': '2024-01-18' },
    }),
    fetch('https://connect.squareup.com/v2/merchants', {
      headers: { 'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`, 'Square-Version': '2024-01-18' },
    }),
  ]);

  const locations = await locRes.json();
  const merchant = await meRes.json();

  return NextResponse.json({ locations: locations.locations, merchant: merchant.merchant });
}

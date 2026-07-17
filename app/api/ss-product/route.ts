import { NextResponse } from 'next/server';

const SS_BASE = 'https://api.ssactivewear.com/v2';
const auth = () => Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const style = searchParams.get('style') || '';

  if (!style) return NextResponse.json({ error: 'style required' }, { status: 400 });

  try {
    const [inventoryRes, pricingRes, mediaRes] = await Promise.all([
      fetch(`${SS_BASE}/inventory/${style}`, { headers: { 'Authorization': `Basic ${auth()}` } }),
      fetch(`${SS_BASE}/pricing/${style}`, { headers: { 'Authorization': `Basic ${auth()}` } }),
      fetch(`${SS_BASE}/media/${style}?mediaType=webp`, { headers: { 'Authorization': `Basic ${auth()}` } }),
    ]);

    const inventory = inventoryRes.ok ? await inventoryRes.json() : [];
    const pricing = pricingRes.ok ? await pricingRes.json() : [];
    const media = mediaRes.ok ? await mediaRes.json() : [];

    return NextResponse.json({ inventory, pricing, media });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

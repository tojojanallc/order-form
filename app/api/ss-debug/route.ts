import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '202';
  const auth = Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64');
  const headers = { 'Authorization': `Basic ${auth}` };

  const urls = [
    `https://api.ssactivewear.com/v2/styles?partNumber=${q}&mediatype=json`,
    `https://api.ssactivewear.com/v2/styles?keywords=${q}&mediatype=json`,
    `https://api.ssactivewear.com/v2/products?partNumber=${q}&mediatype=json`,
    `https://api.ssactivewear.com/v2/products/?style=${q}&mediatype=json`,
  ];

  const results: any[] = [];
  for (const url of urls) {
    const res = await fetch(url, { headers });
    const text = await res.text();
    results.push({ url, status: res.status, body: text.slice(0, 300) });
  }

  return NextResponse.json(results);
}

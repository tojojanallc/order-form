import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '320';
  const auth = Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64');
  const headers = { 'Authorization': `Basic ${auth}` };
  const base = 'https://api.ssactivewear.com/v2';

  const tests = [
    `${base}/styles?styleName=${encodeURIComponent(q)}&mediatype=json`,
    `${base}/products?partNumber=${encodeURIComponent(q)}&mediatype=json`,
    `${base}/styles?keywords=${encodeURIComponent(q)}&mediatype=json`,
  ];

  const results: any[] = [];
  for (const url of tests) {
    const res = await fetch(url, { headers });
    const text = await res.text();
    results.push({ url, status: res.status, count: (text.match(/styleID/g) || text.match(/sku/g) || []).length, preview: text.slice(0, 200) });
  }
  return NextResponse.json(results);
}

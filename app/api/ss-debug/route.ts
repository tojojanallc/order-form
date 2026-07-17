import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || 'Tultex hoodie';
  const auth = Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64');
  const headers = { 'Authorization': `Basic ${auth}` };

  // Step 1: search styles by keyword
  const stylesRes = await fetch(`https://api.ssactivewear.com/v2/styles?keywords=${encodeURIComponent(q)}&mediatype=json`, { headers });
  const styles = await stylesRes.json();
  const firstStyle = Array.isArray(styles) ? styles[0] : null;

  // Step 2: get products for first style using styleID and partNumber
  let products1: any = null, products2: any = null;
  if (firstStyle) {
    const r1 = await fetch(`https://api.ssactivewear.com/v2/products?styleID=${firstStyle.styleID}&mediatype=json`, { headers });
    products1 = { url: r1.url, status: r1.status, body: (await r1.text()).slice(0, 500) };

    const r2 = await fetch(`https://api.ssactivewear.com/v2/products?partNumber=${firstStyle.partNumber}&mediatype=json`, { headers });
    products2 = { url: r2.url, status: r2.status, body: (await r2.text()).slice(0, 500) };
  }

  return NextResponse.json({ firstStyle, products1, products2 });
}

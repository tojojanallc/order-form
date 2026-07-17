import { NextResponse } from 'next/server';

const SS_BASE = 'https://api.ssactivewear.com/v2';
const getHeaders = () => ({ 'Authorization': `Basic ${Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64')}` });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  try {
    // Try exact part number first
    const exactRes = await fetch(`${SS_BASE}/products?partNumber=${encodeURIComponent(query)}&mediatype=json`, { headers: getHeaders() });
    if (exactRes.ok) {
      const skus: any[] = await exactRes.json();
      if (skus.length > 0) {
        // Return as a single style entry
        const first = skus[0];
        return NextResponse.json({ styles: [{
          styleID: first.styleID,
          partNumber: query,
          brandName: first.brandName,
          styleName: first.styleName,
          title: first.title || first.styleName,
          baseCategory: first.baseCategory,
          styleImage: first.colorFrontImage,
        }]});
      }
    }

    // Fall back to keyword search
    const res = await fetch(`${SS_BASE}/styles?keywords=${encodeURIComponent(query)}&mediatype=json`, { headers: getHeaders() });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    const styles = await res.json();
    return NextResponse.json({ styles: Array.isArray(styles) ? styles : [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

const SS_BASE = 'https://api.ssactivewear.com/v2';
const auth = () => Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const style = searchParams.get('style') || '';

  try {
    let url = '';
    if (style) {
      url = `${SS_BASE}/products/${style}?fields=style,title,description,categories,colors,sizes,baseCategory&mediaType=webp`;
    } else {
      url = `${SS_BASE}/products/?keywords=${encodeURIComponent(query)}&fields=style,title,description,categories,colors,sizes,baseCategory&mediaType=webp`;
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ products: Array.isArray(data) ? data : [data] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

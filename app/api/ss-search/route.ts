import { NextResponse } from 'next/server';

const SS_BASE = 'https://api.ssactivewear.com/v2';
const getHeaders = () => ({ 'Authorization': `Basic ${Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64')}` });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get('q') || '').trim();

  try {
    const res = await fetch(`${SS_BASE}/styles?keywords=${encodeURIComponent(query)}&mediatype=json`, { headers: getHeaders() });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    const allStyles: any[] = await res.json();

    // Filter client-side to narrow results
    const q = query.toLowerCase();
    const filtered = allStyles.filter(s => {
      const styleName = (s.styleName || '').toLowerCase();
      const title = (s.title || '').toLowerCase();
      const brand = (s.brandName || '').toLowerCase();
      const unique = (s.uniqueStyleName || '').toLowerCase();
      // Exact style name match, or title/brand contains all query words
      const words = q.split(/\s+/);
      const fullText = `${styleName} ${title} ${brand} ${unique}`;
      return styleName === q || unique === q || words.every(w => fullText.includes(w));
    });

    return NextResponse.json({ styles: filtered.slice(0, 20) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

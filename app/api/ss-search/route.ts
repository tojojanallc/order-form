import { NextResponse } from 'next/server';

const SS_BASE = 'https://api.ssactivewear.com/v2';
const getAuth = () => Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64');
const getHeaders = () => ({ 'Authorization': `Basic ${getAuth()}`, 'Content-Type': 'application/json' });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';

  try {
    // Search styles by keyword or part number
    const url = `${SS_BASE}/styles/${encodeURIComponent(query)}?mediatype=json`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err, status: res.status }, { status: res.status });
    }

    const data = await res.json();
    const styles = Array.isArray(data) ? data : [data];
    return NextResponse.json({ styles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

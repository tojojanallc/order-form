import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '202';
  const auth = Buffer.from(`${process.env.SS_ACCOUNT_NUMBER}:${process.env.SS_API_KEY}`).toString('base64');

  const url = `https://api.ssactivewear.com/v2/styles/${encodeURIComponent(q)}?mediatype=json`;
  const res = await fetch(url, { headers: { 'Authorization': `Basic ${auth}` } });
  const status = res.status;
  const text = await res.text();
  
  return NextResponse.json({ status, url, body: text.slice(0, 2000) });
}

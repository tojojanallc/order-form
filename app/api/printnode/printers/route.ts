import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.PRINTNODE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PRINTNODE_API_KEY not set in environment' }, { status: 500 });
  }

  const res = await fetch('https://api.printnode.com/printers', {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const printers = await res.json();
  return NextResponse.json(printers);
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const printerId = searchParams.get('printerId');

  const apiKey = process.env.PRINTNODE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'PRINTNODE_API_KEY not set in environment' }, { status: 500 });
  }

  // Fetch all printers from PrintNode
  const res = await fetch('https://api.printnode.com/printers', {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: 'PrintNode API error: ' + text }, { status: res.status });
  }

  const printers = await res.json();

  if (!printerId) {
    // Return all printers with their status
    return NextResponse.json({ printers });
  }

  // Find the specific printer
  const printer = printers.find((p: any) => String(p.id) === String(printerId));

  if (!printer) {
    return NextResponse.json({
      found: false,
      message: `Printer ID ${printerId} not found on your PrintNode account. Available IDs: ${printers.map((p: any) => p.id).join(', ')}`,
      printers,
    });
  }

  const isOnline = printer.state === 'online';

  return NextResponse.json({
    found: true,
    online: isOnline,
    name: printer.name,
    state: printer.state,
    description: printer.description,
    computerId: printer.computer?.id,
    computerName: printer.computer?.name,
    computerState: printer.computer?.state,
    message: isOnline
      ? `✅ "${printer.name}" is online and ready to print.`
      : `⚠️ "${printer.name}" is ${printer.state}. Make sure the printer is on and the PrintNode desktop app is running.`,
  });
}

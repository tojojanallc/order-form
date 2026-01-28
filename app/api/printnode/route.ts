import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { Buffer } from 'buffer'; // Explicit import to prevent crashes

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, mode, apiKey, printerId } = body;

    // 1. Create a Standard 4x6 PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([288, 432]); // 4x6 inches
    const { width, height } = page.getSize();

    // 2. DRAW A GIANT BLACK BOX (The "Ink Check")
    // If you don't see this, the printer is not receiving data correctly.
    page.drawRectangle({
        x: 50,
        y: 50,
        width: width - 100,
        height: height - 100,
        color: rgb(0, 0, 0), // Pure Black Fill
    });

    // 3. DRAW A WHITE LINE THROUGH IT
    page.drawLine({
        start: { x: 0, y: 0 },
        end: { x: width, y: height },
        thickness: 5,
        color: rgb(1, 1, 1), // White line
    });

    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    // 4. OUTPUT
    if (mode === 'cloud' && apiKey && printerId) {
        console.log(`Sending Black Box to Printer ${printerId}...`);
        const pnRes = await fetch('https://api.printnode.com/printjobs', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                printerId: parseInt(printerId),
                title: `TEST-BOX-${Date.now()}`,
                contentType: 'pdf_base64',
                content: base64Pdf,
                source: 'Kiosk Admin'
            })
        });

        if (!pnRes.ok) {
            const txt = await pnRes.text();
            throw new Error(txt);
        }
        return NextResponse.json({ success: true, message: "Sent Black Box" });
    } else {
        return NextResponse.json({ success: true, pdfBase64: base64Pdf });
    }

  } catch (error: any) {
    console.error("PDF Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, mode, apiKey, printerId } = body;

    // --- 1. GENERATE PDF LABEL (4x6 inches) ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([288, 432]); // 4x6 inches (72 DPI)
    const { width, height } = page.getSize();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Header (Order ID)
    page.drawText(`ORDER #${String(order.id).slice(0, 8).toUpperCase()}`, { 
        x: 20, y: height - 40, size: 20, font: fontBold 
    });

    // Customer Name
    page.drawText(`${order.customer_name || 'Guest'}`, { 
        x: 20, y: height - 70, size: 16, font: fontReg 
    });

    // Timestamp
    const dateStr = new Date(order.created_at).toLocaleString();
    page.drawText(dateStr, { x: 20, y: height - 90, size: 10, font: fontReg, color: rgb(0.5, 0.5, 0.5) });

    // Divider Line
    page.drawLine({ start: { x: 20, y: height - 100 }, end: { x: width - 20, y: height - 100 }, thickness: 1, color: rgb(0,0,0) });

    // Items List
    let yPos = height - 130;
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];

    items.forEach(item => {
        if (!item) return;
        const itemName = `- ${item.productName} (${item.size})`;
        page.drawText(itemName, { x: 20, y: yPos, size: 12, font: fontReg });
        yPos -= 18;

        // Customizations (Logos/Names)
        const cust = item.customizations || {};
        
        // Main Design
        if (cust.mainDesign) {
             page.drawText(`  • Design: ${cust.mainDesign}`, { x: 30, y: yPos, size: 10, font: fontReg, color: rgb(0.3, 0.3, 0.3) });
             yPos -= 14;
        }

        // Names
        if (Array.isArray(cust.names)) {
            cust.names.forEach(n => {
                page.drawText(`  • Name: ${n.text} (${n.position})`, { x: 30, y: yPos, size: 10, font: fontReg, color: rgb(0.3, 0.3, 0.3) });
                yPos -= 14;
            });
        }
        
        yPos -= 10; // Extra spacing between items
    });

    const pdfBytes = await pdfDoc.save();

    // --- 2. HANDLE OUTPUT MODE ---
    
    // MODE A: Cloud Print (PrintNode)
    if (mode === 'cloud' && apiKey && printerId) {
        const base64Pdf = Buffer.from(pdfBytes).toString('base64');
        
        console.log(`Sending Job to PrintNode (Printer: ${printerId})...`);
        const pnRes = await fetch('https://api.printnode.com/printjobs', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                printerId: parseInt(printerId),
                title: `Order #${order.id}`,
                contentType: 'pdf_base64',
                content: base64Pdf,
                source: 'Kiosk Admin'
            })
        });

        if (!pnRes.ok) {
            const errText = await pnRes.text();
            throw new Error(`PrintNode Error: ${errText}`);
        }
        
        return NextResponse.json({ success: true, message: "Sent to Printer" });
    } 
    
    // MODE B: Download / Preview (Local)
    else {
        const base64 = Buffer.from(pdfBytes).toString('base64');
        return NextResponse.json({ success: true, pdfBase64: base64 });
    }

  } catch (error: any) {
    console.error("Print Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
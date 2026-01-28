import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, mode, apiKey, printerId } = body;

    // --- 1. SETUP PAGE ---
    // We make the PDF wider (8.5") to match what your printer *thinks* it is (Letter).
    // This tricks the printer into printing exactly where we want.
    const PAGE_WIDTH = 612;  // 8.5 inches (Letter width)
    const PAGE_HEIGHT = 432; // 6 inches
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    // Use TIMES ROMAN (Safest Font)
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const black = rgb(0, 0, 0);

    // --- 2. CALCULATE POSITION ---
    // Your printer thinks 0 is the edge of the Letter page.
    // The label is in the middle or left.
    // We start drawing at X = 20. If it prints too far right, we decrease this.
    const START_X = 20; 
    let yPos = 380; // Start from top

    // --- 3. DRAW CONTENT ---
    
    // Draw a Border around the "Label Area" so you can see where it lands
    page.drawRectangle({
        x: START_X,
        y: 10,
        width: 280, // 4 inches wide
        height: 400,
        borderColor: black,
        borderWidth: 3,
    });

    // Header
    page.drawText(`ORDER #${String(order.id).slice(0, 8).toUpperCase()}`, { 
        x: START_X + 10, y: yPos, size: 24, font: fontBold, color: black 
    });
    yPos -= 30;

    // Customer
    page.drawText(`${order.customer_name || 'Guest'}`, { 
        x: START_X + 10, y: yPos, size: 18, font: fontReg, color: black 
    });
    yPos -= 25;

    // Date
    page.drawText(new Date(order.created_at).toLocaleString(), { 
        x: START_X + 10, y: yPos, size: 10, font: fontReg, color: black 
    });
    yPos -= 15;

    // Line
    page.drawLine({ 
        start: { x: START_X + 10, y: yPos }, 
        end: { x: START_X + 270, y: yPos }, 
        thickness: 2, color: black 
    });
    yPos -= 25;

    // Items
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];

    items.forEach(item => {
        if (!item) return;
        const itemName = `• ${item.productName} (${item.size})`;
        const safeName = itemName.length > 30 ? itemName.substring(0, 30) + '...' : itemName;

        page.drawText(safeName, { 
            x: START_X + 10, y: yPos, size: 14, font: fontBold, color: black 
        });
        yPos -= 20;

        // Customizations
        const cust = item.customizations || {};
        if (cust.mainDesign) {
             page.drawText(`   Design: ${cust.mainDesign}`, { x: START_X + 20, y: yPos, size: 12, font: fontReg, color: black });
             yPos -= 16;
        }
        if (Array.isArray(cust.names)) {
            cust.names.forEach(n => {
                page.drawText(`   Name: ${n.text}`, { x: START_X + 20, y: yPos, size: 12, font: fontReg, color: black });
                yPos -= 16;
            });
        }
        yPos -= 10;
    });

    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    // --- 4. SEND (No Fit To Page) ---
    if (mode === 'cloud' && apiKey && printerId) {
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

        if (!pnRes.ok) throw new Error(await pnRes.text());
        return NextResponse.json({ success: true, message: "Sent" });
    } else {
        return NextResponse.json({ success: true, pdfBase64: base64Pdf });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
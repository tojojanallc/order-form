import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, mode, apiKey, printerId } = body;

    // --- 1. SETUP PAGE (Letter Size) ---
    // We use a full Letter page because your printer driver expects it.
    const PAGE_WIDTH = 612;  // 8.5 inches
    const PAGE_HEIGHT = 432; // 6 inches
    
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const black = rgb(0, 0, 0);

    // --- 2. CALCULATE OFFSET (The Magic Fix) ---
    // Your printer skips the first ~2.2 inches. We manually push text past that.
    // 2.25 inches * 72 points/inch = 162 points.
    const OFFSET_X = 165; 
    
    // We set the "Virtual Margin" relative to that offset.
    const MARGIN_LEFT = OFFSET_X + 10;
    
    let yPos = 400; // Start from top

    // --- 3. DRAW CONTENT ---
    
    // Header
    page.drawText(`ORDER #${String(order.id).slice(0, 8).toUpperCase()}`, { 
        x: MARGIN_LEFT, y: yPos, size: 24, font: fontBold, color: black 
    });
    yPos -= 30;

    // Customer
    page.drawText(`${order.customer_name || 'Guest'}`, { 
        x: MARGIN_LEFT, y: yPos, size: 18, font: fontReg, color: black 
    });
    yPos -= 25;

    // Date
    page.drawText(new Date(order.created_at).toLocaleString(), { 
        x: MARGIN_LEFT, y: yPos, size: 10, font: fontReg, color: black 
    });
    yPos -= 15;

    // Divider Line (280 points wide = approx 4 inches)
    page.drawLine({ 
        start: { x: MARGIN_LEFT, y: yPos }, 
        end: { x: MARGIN_LEFT + 260, y: yPos }, 
        thickness: 2, color: black 
    });
    yPos -= 25;

    // Items
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];

    items.forEach(item => {
        if (!item) return;
        const itemName = `• ${item.productName} (${item.size})`;
        // Truncate slightly to ensure it fits the 4 inch width
        const safeName = itemName.length > 28 ? itemName.substring(0, 28) + '...' : itemName;

        page.drawText(safeName, { 
            x: MARGIN_LEFT, y: yPos, size: 14, font: fontBold, color: black 
        });
        yPos -= 20;

        // Customizations
        const cust = item.customizations || {};
        if (cust.mainDesign) {
             page.drawText(`   Design: ${cust.mainDesign}`, { x: MARGIN_LEFT + 15, y: yPos, size: 12, font: fontReg, color: black });
             yPos -= 16;
        }
        if (Array.isArray(cust.names)) {
            cust.names.forEach(n => {
                page.drawText(`   Name: ${n.text}`, { x: MARGIN_LEFT + 15, y: yPos, size: 12, font: fontReg, color: black });
                yPos -= 16;
            });
        }
        yPos -= 10;
    });

    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    // --- 4. SEND (Standard Mode - No Rotation) ---
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
                source: 'Kiosk Admin',
                options: { fit_to_page: false } // Do not scale, just print
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
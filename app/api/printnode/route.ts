import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, mode, apiKey, printerId } = body;

    // --- CONFIG: LANDSCAPE MODE (6x4) ---
    // We swap the dimensions. 6 inches wide, 4 inches tall.
    const PAGE_WIDTH = 432;  // 6 inches
    const PAGE_HEIGHT = 288; // 4 inches
    const MARGIN = 20;
    
    // 1. Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const black = rgb(0, 0, 0);

    // 2. Draw Content
    // Since it's landscape, we have more width (432) and less height (288).
    let yPos = PAGE_HEIGHT - MARGIN - 15;
    
    // Header (Top Left)
    page.drawText(`ORDER #${String(order.id).slice(0, 8).toUpperCase()}`, { 
        x: MARGIN, y: yPos, size: 24, font: fontBold, color: black 
    });

    // Date (Top Right)
    const dateStr = new Date(order.created_at).toLocaleDateString();
    page.drawText(dateStr, { 
        x: PAGE_WIDTH - MARGIN - 60, y: yPos, size: 12, font: fontReg, color: black 
    });

    yPos -= 30;

    // Customer Name
    page.drawText(`${order.customer_name || 'Guest'}`, { 
        x: MARGIN, y: yPos, size: 18, font: fontReg, color: black 
    });

    yPos -= 15;

    // Line
    page.drawLine({ 
        start: { x: MARGIN, y: yPos }, 
        end: { x: PAGE_WIDTH - MARGIN, y: yPos }, 
        thickness: 2, color: black 
    });

    yPos -= 25;

    // Items List
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];

    items.forEach(item => {
        if (!item) return;
        if (yPos < 20) return; // Stop if we run out of paper

        const itemName = `• ${item.productName} (${item.size})`;
        // We have more horizontal space now, so we can truncate less
        const safeName = itemName.length > 45 ? itemName.substring(0, 45) + '...' : itemName;

        page.drawText(safeName, { 
            x: MARGIN, y: yPos, size: 14, font: fontBold, color: black 
        });
        yPos -= 18;

        // Customizations
        const cust = item.customizations || {};
        
        if (cust.mainDesign) {
             page.drawText(`   Design: ${cust.mainDesign}`, { x: MARGIN + 20, y: yPos, size: 12, font: fontReg, color: black });
             yPos -= 16;
        }

        if (Array.isArray(cust.names)) {
            cust.names.forEach(n => {
                page.drawText(`   Name: ${n.text}`, { x: MARGIN + 20, y: yPos, size: 12, font: fontReg, color: black });
                yPos -= 16;
            });
        }
        yPos -= 10;
    });

    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    // 3. Send
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
                // Force rotation if the printer is stubborn
                options: { rotate: 0 } 
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
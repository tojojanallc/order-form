import { NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, mode, apiKey, printerId } = body;

    // --- CONFIG ---
    const PAGE_WIDTH = 288;  // 4 inches
    const PAGE_HEIGHT = 432; // 6 inches
    const MARGIN = 15;
    
    // 1. Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);

    // 2. Draw Content
    let yPos = PAGE_HEIGHT - MARGIN - 20;
    
    // Header
    page.drawText(`ORDER #${String(order.id).slice(0, 8).toUpperCase()}`, { 
        x: MARGIN, y: yPos, size: 24, font: fontBold, color: black 
    });

    yPos -= 30;

    // Customer
    page.drawText(`${order.customer_name || 'Guest'}`, { 
        x: MARGIN, y: yPos, size: 18, font: fontReg, color: black 
    });

    yPos -= 20;

    // Date
    const dateStr = new Date(order.created_at).toLocaleString();
    page.drawText(dateStr, { 
        x: MARGIN, y: yPos, size: 10, font: fontReg, color: black 
    });

    yPos -= 10;

    // Line
    page.drawLine({ 
        start: { x: MARGIN, y: yPos }, 
        end: { x: PAGE_WIDTH - MARGIN, y: yPos }, 
        thickness: 1.5, color: black 
    });

    yPos -= 25;

    // Items
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];

    items.forEach(item => {
        if (!item) return;
        const itemName = `• ${item.productName} (${item.size})`;
        // Truncate if too long
        const safeName = itemName.length > 30 ? itemName.substring(0, 30) + '...' : itemName;

        page.drawText(safeName, { 
            x: MARGIN, y: yPos, size: 14, font: fontBold, color: black 
        });
        yPos -= 18;

        // Customizations
        const cust = item.customizations || {};
        
        if (cust.mainDesign) {
             page.drawText(`   Design: ${cust.mainDesign}`, { x: MARGIN + 10, y: yPos, size: 12, font: fontReg, color: black });
             yPos -= 16;
        }

        if (Array.isArray(cust.names)) {
            cust.names.forEach(n => {
                page.drawText(`   Name: ${n.text} (${n.position})`, { x: MARGIN + 10, y: yPos, size: 12, font: fontReg, color: black });
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
                // *** THE FIX: FORCE FIT TO PAGE ***
                options: { fit_to_page: true } 
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
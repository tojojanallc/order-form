import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { order, printerId, apiKey } = await req.json();

    if (!apiKey || !printerId || !order) {
      return NextResponse.json({ error: "Missing Config" }, { status: 400 });
    }

    // 1. Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 2. Add Page (Standard 4x6)
    // 288 pts wide x 432 pts high
    let page = pdfDoc.addPage([288, 432]);
    const { width } = page.getSize();

    // --- BOTTOM-ANCHORED LAYOUT ---
    // Since your printer is cutting off the top, we will start printing
    // from the MIDDLE (y=250) and work our way down to the bottom (y=0).
    // This forces the content into the "safe zone" you can see.
    let cursorY = 250; 
    const margin = 15; 
    
    const moveDown = (amount: number) => { cursorY -= amount; };

    // --- DEBUG MARKER ---
    // This draws a line where we START printing. If you don't see this, 
    // your printer is cutting off even the middle.
    page.drawLine({ start: { x: margin, y: cursorY }, end: { x: width - margin, y: cursorY }, thickness: 2, color: rgb(0,0,0) });
    moveDown(15);

    // --- HEADER ---
    page.drawText(order.customer_name || 'Guest', {
        x: margin,
        y: cursorY,
        size: 16,
        font: fontBold,
    });
    moveDown(15);

    page.drawText(`Order #${String(order.id).slice(0, 8)}`, {
        x: margin,
        y: cursorY,
        size: 12,
        font: font,
    });
    moveDown(10);
    
    // Date
    page.drawText(new Date().toLocaleDateString(), {
        x: margin,
        y: cursorY,
        size: 10,
        font: font,
    });
    moveDown(15);

    // --- ITEMS ---
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];

    items.forEach((item: any) => {
        // If we get too close to the footer, stop (simple single-page mode for safety)
        if (cursorY < 40) return;

        // Product Name (Bold)
        let pName = item.productName || 'Item';
        if (pName.length > 25) pName = pName.substring(0, 23) + '...';
        
        page.drawText(pName, { x: margin, y: cursorY, size: 12, font: fontBold });
        moveDown(12);

        // Size
        page.drawText(`Size: ${item.size || 'N/A'}`, { x: margin, y: cursorY, size: 12, font: font });
        moveDown(12);

        // Customizations (Compressed)
        if (item.customizations) {
            const c = item.customizations;
            if (c.mainDesign) {
                page.drawText(`Main: ${c.mainDesign}`, { x: margin + 10, y: cursorY, size: 10, font });
                moveDown(10);
            }
            c.names?.forEach((n: any) => {
                if(n.text) {
                    page.drawText(`Name: ${n.text}`, { x: margin + 10, y: cursorY, size: 10, font });
                    moveDown(10);
                }
            });
             c.logos?.forEach((l: any) => {
                if(l.type) {
                    page.drawText(`Logo: ${l.type}`, { x: margin + 10, y: cursorY, size: 10, font });
                    moveDown(10);
                }
            });
        }
        
        moveDown(5);
        // Dash Separator
        page.drawText("- - - - - - - - - - - - -", { x: margin, y: cursorY, size: 8, font });
        moveDown(15);
    });

    // --- FOOTER ---
    page.drawText("Lev Custom", {
        x: margin,
        y: 15, // Absolute bottom
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
    });

    // 3. Output
    const pdfBytes = await pdfDoc.saveAsBase64();

    const response = await fetch('https://api.printnode.com/printjobs', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        printerId: parseInt(printerId),
        title: `Order #${order.id}`,
        contentType: 'pdf_base64', 
        content: pdfBytes, 
        source: 'Lev Custom Admin'
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Print Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
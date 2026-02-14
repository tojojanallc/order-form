import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, printerId, apiKey } = body;

    if (!apiKey || !printerId || !order) {
      return NextResponse.json({ error: "Missing Config" }, { status: 400 });
    }

    // 1. Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 2. Add Page (Standard 4x6 label)
    // 288 pts wide x 432 pts high
    let page = pdfDoc.addPage([288, 432]);
    const { width } = page.getSize();

    // --- BOTTOM-ANCHORED LAYOUT ---
    // Starting from the MIDDLE (y=250) to avoid top cutoff
    let cursorY = 250; 
    const margin = 15; 
    
    // Helper to move the cursor down
    const moveDown = (amount: number) => { cursorY -= amount; };

    // --- DEBUG MARKER (Optional - helps you see where print starts) ---
    page.drawLine({ 
        start: { x: margin, y: cursorY }, 
        end: { x: width - margin, y: cursorY }, 
        thickness: 1, 
        color: rgb(0,0,0) 
    });
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
        if (!item) return;

        // If we get too close to the footer, stop (simple single-page safety)
        if (cursorY < 40) return;

        // A. Product Name (Bold)
        let pName = item.productName || 'Item';
        if (pName.length > 25) pName = pName.substring(0, 23) + '...';
        
        page.drawText(pName, { x: margin, y: cursorY, size: 12, font: fontBold });
        moveDown(12);

        // B. Size
        page.drawText(`Size: ${item.size || 'N/A'}`, { x: margin, y: cursorY, size: 12, font: font });
        moveDown(12);

        // C. Customizations (With Locations)
        if (item.customizations) {
            const c = item.customizations;

            // 1. Main Design
            if (c.mainDesign) {
                page.drawText(`• Design: ${c.mainDesign}`, { x: margin + 10, y: cursorY, size: 10, font });
                moveDown(10);
            }

            // 2. Names
            if (Array.isArray(c.names)) {
                c.names.forEach((n: any) => {
                    if(n.text) {
                        const loc = n.position ? ` [${n.position}]` : '';
                        page.drawText(`• Name: "${n.text}"${loc}`, { x: margin + 10, y: cursorY, size: 10, font });
                        moveDown(10);
                    }
                });
            }

            // 3. Logos/Accents
            if (Array.isArray(c.logos)) {
                c.logos.forEach((l: any) => {
                    if(l.type) {
                        const loc = l.position ? ` [${l.position}]` : '';
                        page.drawText(`• Add-on: ${l.type}${loc}`, { x: margin + 10, y: cursorY, size: 10, font });
                        moveDown(10);
                    }
                });
            }

            // 4. Other Options
            if (c.backList) {
                page.drawText(`• Option: Back Name List`, { x: margin + 10, y: cursorY, size: 10, font });
                moveDown(10);
            }
            if (c.metallic) {
                page.drawText(`• Option: Metallic Upgrade`, { x: margin + 10, y: cursorY, size: 10, font });
                moveDown(10);
            }
        }
        
        moveDown(5);
        // Dash Separator
        page.drawText("- - - - - - - - - - - - -", { x: margin, y: cursorY, size: 8, font });
        moveDown(15);
    });

    // --- FOOTER ---
    page.drawText("Lev Custom Merch", {
        x: margin,
        y: 15, // Absolute bottom
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
    });

    // 3. Output & Send to PrintNode
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
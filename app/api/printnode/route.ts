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
    const page = pdfDoc.addPage([288, 432]);
    
    // --- LAYOUT ADJUSTMENT ---
    // xStart = 0 (Safe Left Edge)
    const xStart = 0; 
    
    // MOVED DOWN A "SMIDGE"
    // Previous was 220. We drop to 200 (~1/4 inch lower).
    let cursorY = 200; 

    // --- CONTENT ---

    // Header (Customer)
    let custName = order.customer_name || 'Guest';
    if (custName.length > 15) custName = custName.substring(0, 15) + '.';
    
    // Font Size 10 (Safe)
    page.drawText(custName, { x: xStart, y: cursorY, size: 10, font: fontBold });
    cursorY -= 15;

    // Order ID - Font Size 8
    page.drawText(`Order #${String(order.id).slice(0, 8)}`, { x: xStart, y: cursorY, size: 8, font: font });
    cursorY -= 12;

    // Date - Font Size 8
    page.drawText(new Date().toLocaleDateString(), { x: xStart, y: cursorY, size: 8, font: font });
    cursorY -= 12;

    // Divider
    page.drawLine({ start: { x: xStart, y: cursorY }, end: { x: 100, y: cursorY }, thickness: 1 });
    cursorY -= 15;

    // Items
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];
    
    if (items.length === 0) {
        page.drawText("No items.", { x: xStart, y: cursorY, size: 8, font });
    }

    items.forEach((item: any) => {
        // Safety Stop
        if (cursorY < 30) return;

        // Product Name - Font Size 8
        let pName = item.productName || 'Item';
        if (pName.length > 18) pName = pName.substring(0, 18) + '.';
        
        page.drawText(pName, { x: xStart, y: cursorY, size: 8, font: fontBold }); 
        cursorY -= 12;

        // Size
        page.drawText(`Size: ${item.size || 'N/A'}`, { x: xStart, y: cursorY, size: 8, font: font });
        cursorY -= 12;

        // Customizations
        if (item.customizations) {
            const c = item.customizations;
            const indent = xStart + 5;
            
            if (c.mainDesign) {
                let main = c.mainDesign;
                if(main.length > 15) main = main.substring(0, 15);
                page.drawText(`+ ${main}`, { x: indent, y: cursorY, size: 7, font });
                cursorY -= 10;
            }
            if (c.names && c.names[0] && c.names[0].text) {
                page.drawText(`+ Name: ${c.names[0].text}`, { x: indent, y: cursorY, size: 7, font });
                cursorY -= 10;
            }
        }
        
        cursorY -= 3;
        // Separator
        page.drawLine({ start: { x: xStart, y: cursorY }, end: { x: 80, y: cursorY }, thickness: 0.5 });
        cursorY -= 12;
    });

    // Footer
    page.drawText("Lev Custom", { x: xStart, y: 15, size: 6, font, color: rgb(0.5, 0.5, 0.5) });

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
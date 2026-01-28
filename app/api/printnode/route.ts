import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const dynamic = 'force-dynamic';

// *** CONFIGURATION ***
// REPLACE THIS WITH YOUR ACTUAL ZEBRA PRINTER ID
const ZEBRA_PRINTER_ID = 0; // e.g. 724192

export async function POST(req: Request) {
  try {
    const { order, printerId, apiKey } = await req.json();

    if (!apiKey || !printerId || !order) {
      return NextResponse.json({ error: "Missing Config" }, { status: 400 });
    }

    const targetPrinter = parseInt(printerId);
    let pdfBytes;

    // --- DECISION LOGIC ---
    if (targetPrinter === ZEBRA_PRINTER_ID) {
        // CASE A: ZEBRA LABEL (4x6)
        console.log("Generating 4x6 Label for Zebra...");
        pdfBytes = await generateLabelPDF(order);
    } else {
        // CASE B: STANDARD PRINTER (8.5x11)
        console.log("Generating Letter Packing Slip...");
        pdfBytes = await generatePackingSlipPDF(order);
    }

    // --- SEND TO PRINTNODE ---
    const response = await fetch('https://api.printnode.com/printjobs', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        printerId: targetPrinter,
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

// ==========================================
// GENERATOR A: ZEBRA LABEL (The one that works!)
// ==========================================
async function generateLabelPDF(order: any) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([288, 432]); // 4x6 inches

    const xStart = 0; 
    let cursorY = 200; 
    const MAX_WIDTH = 170; 

    // Helper: Wrapped Text
    const drawWrappedText = (text: string, size: number, isBold: boolean = false) => {
        const f = isBold ? fontBold : font;
        const avgCharWidth = size * 0.6; 
        const maxChars = Math.floor(MAX_WIDTH / avgCharWidth);
        const words = text.split(' ');
        let currentLine = '';
        words.forEach((word) => {
            if ((currentLine + word).length < maxChars) {
                currentLine += word + ' ';
            } else {
                page.drawText(currentLine.trim(), { x: xStart, y: cursorY, size, font: f });
                cursorY -= (size + 4);
                currentLine = word + ' ';
            }
        });
        if (currentLine.length > 0) {
            page.drawText(currentLine.trim(), { x: xStart, y: cursorY, size, font: f });
            cursorY -= (size + 4);
        }
    };

    // Header
    const custName = order.customer_name || 'Guest';
    drawWrappedText(custName, 12, true);
    cursorY -= 5;

    page.drawText(`Order #${String(order.id).slice(0, 8)}`, { x: xStart, y: cursorY, size: 10, font: font });
    cursorY -= 12;

    page.drawText(new Date().toLocaleDateString(), { x: xStart, y: cursorY, size: 10, font: font });
    cursorY -= 15;

    page.drawLine({ start: { x: xStart, y: cursorY }, end: { x: 100, y: cursorY }, thickness: 1 });
    cursorY -= 15;

    // Items
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];
    items.forEach((item: any) => {
        if (cursorY < 30) return;
        let pName = item.productName || 'Item';
        drawWrappedText(pName, 10, true);
        page.drawText(`Size: ${item.size || 'N/A'}`, { x: xStart, y: cursorY, size: 10, font: font });
        cursorY -= 12;
        if (item.customizations) {
            const c = item.customizations;
            const indent = xStart + 5;
            if (c.mainDesign) {
                page.drawText(`+ ${c.mainDesign.substring(0, 25)}`, { x: indent, y: cursorY, size: 9, font });
                cursorY -= 11;
            }
            if (c.names && c.names[0] && c.names[0].text) {
                page.drawText(`+ Name: ${c.names[0].text}`, { x: indent, y: cursorY, size: 9, font });
                cursorY -= 11;
            }
        }
        cursorY -= 5;
        page.drawLine({ start: { x: xStart, y: cursorY }, end: { x: 80, y: cursorY }, thickness: 0.5 });
        cursorY -= 15;
    });

    page.drawText("Lev Custom", { x: xStart, y: 15, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    return await pdfDoc.saveAsBase64();
}

// ==========================================
// GENERATOR B: STANDARD PACKING SLIP (8.5 x 11)
// ==========================================
async function generatePackingSlipPDF(order: any) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Standard Letter Size (8.5 x 11 inches) = 612 x 792 points
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    
    let cursorY = height - 50;
    const margin = 50;

    // Header
    page.drawText("PACKING SLIP", { x: margin, y: cursorY, size: 24, font: fontBold });
    cursorY -= 35;

    page.drawText(`Lev Custom`, { x: margin, y: cursorY, size: 12, font: fontBold });
    cursorY -= 15;
    page.drawText(`${new Date().toLocaleDateString()}`, { x: margin, y: cursorY, size: 12, font: font });
    cursorY -= 40;

    // Customer Info
    page.drawText(`Order For:`, { x: margin, y: cursorY, size: 10, font: font, color: rgb(0.5,0.5,0.5) });
    cursorY -= 15;
    page.drawText(order.customer_name || 'Guest', { x: margin, y: cursorY, size: 18, font: fontBold });
    cursorY -= 25;
    page.drawText(`Order ID: #${order.id}`, { x: margin, y: cursorY, size: 14, font: font });
    cursorY -= 40;

    // Line Divider
    page.drawLine({ start: { x: margin, y: cursorY }, end: { x: width - margin, y: cursorY }, thickness: 1, color: rgb(0,0,0) });
    cursorY -= 30;

    // Items
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];
    
    if (items.length === 0) {
        page.drawText("No items found.", { x: margin, y: cursorY, size: 12, font });
    }

    items.forEach((item: any) => {
        let pName = item.productName || 'Item';
        let size = item.size || 'N/A';
        
        // Product Line
        page.drawText(pName, { x: margin, y: cursorY, size: 12, font: fontBold });
        // Draw Size on the right side
        page.drawText(`Size: ${size}`, { x: width - margin - 100, y: cursorY, size: 12, font: fontBold });
        cursorY -= 20;

        // Customizations
        if (item.customizations) {
            const c = item.customizations;
            if (c.mainDesign) {
                page.drawText(`   Design: ${c.mainDesign}`, { x: margin, y: cursorY, size: 10, font });
                cursorY -= 15;
            }
            c.names?.forEach((n: any) => {
                if(n.text) {
                    page.drawText(`   Name: ${n.text}`, { x: margin, y: cursorY, size: 10, font });
                    cursorY -= 15;
                }
            });
            c.logos?.forEach((l: any) => {
                if(l.type) {
                    page.drawText(`   Logo: ${l.type}`, { x: margin, y: cursorY, size: 10, font });
                    cursorY -= 15;
                }
            });
        }
        
        cursorY -= 10;
        page.drawLine({ start: { x: margin, y: cursorY }, end: { x: width - margin, y: cursorY }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
        cursorY -= 20;
    });

    return await pdfDoc.saveAsBase64();
}
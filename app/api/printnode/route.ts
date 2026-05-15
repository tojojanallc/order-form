import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, mode, printerId } = body;

    if (!order) {
      return NextResponse.json({ error: "Missing order" }, { status: 400 });
    }

    // API key is a server env var — printer ID is chosen per-event in admin UI
    const apiKey = process.env.PRINTNODE_API_KEY;

    // ── 1. Build PDF ────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 4x6 label: 288 x 432 pts
    const page = pdfDoc.addPage([288, 432]);
    const { width } = page.getSize();

    let cursorY = 400;
    const margin = 15;
    const moveDown = (amount: number) => { cursorY -= amount; };

    // Header line
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: width - margin, y: cursorY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    moveDown(18);

    // Customer name
    page.drawText(order.customer_name || 'Guest', {
      x: margin, y: cursorY, size: 18, font: fontBold,
    });
    moveDown(16);

    // Order ID + date
    page.drawText(`Order #${String(order.id).slice(0, 8)}`, {
      x: margin, y: cursorY, size: 11, font,
    });
    moveDown(11);
    page.drawText(new Date().toLocaleDateString(), {
      x: margin, y: cursorY, size: 10, font,
    });
    moveDown(18);

    // ── 2. Items ────────────────────────────────────────────────────────────────
    const items = Array.isArray(order.cart_data) ? order.cart_data : [];

    items.forEach((item: any) => {
      if (!item || cursorY < 40) return;

      // Product name
      let pName = item.productName || 'Item';
      if (pName.length > 28) pName = pName.substring(0, 26) + '…';
      page.drawText(pName, { x: margin, y: cursorY, size: 12, font: fontBold });
      moveDown(13);

      // Size + color
      const sizeColor = [item.size, item.color].filter(Boolean).join(' / ');
      if (sizeColor) {
        page.drawText(`Size: ${sizeColor}`, { x: margin, y: cursorY, size: 11, font });
        moveDown(12);
      }

      // Customizations
      if (item.customizations) {
        const c = item.customizations;

        if (c.mainDesign) {
          page.drawText(`• Design: ${c.mainDesign}`, { x: margin + 8, y: cursorY, size: 10, font });
          moveDown(11);
        }
        (c.names || []).forEach((n: any) => {
          if (n.text) {
            const loc = n.position ? ` [${n.position}]` : '';
            page.drawText(`• Name: "${n.text}"${loc}`, { x: margin + 8, y: cursorY, size: 10, font });
            moveDown(11);
          }
        });
        (c.numbers || []).forEach((n: any) => {
          if (n.text) {
            const loc = n.position ? ` [${n.position}]` : '';
            page.drawText(`• #${n.text}${loc}`, { x: margin + 8, y: cursorY, size: 10, font });
            moveDown(11);
          }
        });
        (c.logos || []).forEach((l: any) => {
          if (l.type) {
            const loc = l.position ? ` [${l.position}]` : '';
            page.drawText(`• Logo: ${l.type}${loc}`, { x: margin + 8, y: cursorY, size: 10, font });
            moveDown(11);
          }
        });
        if (c.backList) {
          page.drawText(`• Back Name List`, { x: margin + 8, y: cursorY, size: 10, font });
          moveDown(11);
        }
        if (c.metallic) {
          page.drawText(`• Metallic Upgrade`, { x: margin + 8, y: cursorY, size: 10, font });
          moveDown(11);
        }
      }

      moveDown(4);
      page.drawText('- - - - - - - - - - - - - - -', { x: margin, y: cursorY, size: 8, font });
      moveDown(14);
    });

    // Footer
    page.drawText('Lev Custom Merch', {
      x: margin, y: 12, size: 8, font, color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBase64 = await pdfDoc.saveAsBase64();

    // ── 3. Cloud print via PrintNode ────────────────────────────────────────────
    if (mode === 'cloud') {
      if (!apiKey || !printerId) {
        return NextResponse.json({ error: 'Missing PrintNode API key or printer ID' }, { status: 400 });
      }

      const pnRes = await fetch('https://api.printnode.com/printjobs', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          printerId: parseInt(printerId),
          title: `Order #${order.id}`,
          contentType: 'pdf_base64',
          content: pdfBase64,
          source: 'Lev Custom Admin',
        }),
      });

      if (!pnRes.ok) {
        const errText = await pnRes.text();
        console.error('PrintNode error:', errText);
        return NextResponse.json({ error: errText }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ── 4. Download mode — return PDF to browser ────────────────────────────────
    return NextResponse.json({ success: true, pdfBase64 });

  } catch (error: any) {
    console.error('Print Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

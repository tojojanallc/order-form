import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export async function POST(req: any) {
  try {
    const body = await req.json();
    const { email, name, cart, total, orderId, eventName, eventLogo, shippingInfo } = body;

    if (!email) return NextResponse.json({ error: 'No email provided' }, { status: 400 });

    // --- THE FOOLPROOF MATH ---
    // 1. Calculate the exact subtotal directly from the cart items
    const subtotalAmount = cart.reduce((sum: number, item: any) => sum + Number(item.finalPrice || 0), 0);
    
    // 2. Grand total is what the customer actually paid
    const grandTotal = Number(total) || 0;
    
    // 3. Tax is just the difference between the two (rounded to fix JS decimal weirdness)
    const taxAmount = Number(Math.max(0, grandTotal - subtotalAmount).toFixed(2));

    // 1. Dynamic Event Logo
    let eventLogoHtml = '';
    if (eventLogo) {
        const src = eventLogo.startsWith('http') ? eventLogo : `${baseUrl}/${eventLogo}`;
        eventLogoHtml = `<div style="text-align: center; margin-bottom: 20px;"><img src="${src}" alt="${eventName}" style="max-width: 150px; height: auto;" /></div>`;
    }

    // 2. Static Company Logo
    const companyLogoUrl = `https://assets.zyrosite.com/ulxsOaa5kyTQvVNU/lev-150-CtP7sCPqLTeMeyOY.png`;

    const cartRows = cart.map((item: any) => {
        const customizations = [];
        if (item.customizations?.mainDesign) customizations.push(`<strong>Design:</strong> ${item.customizations.mainDesign}`);
        if (item.customizations?.metallic) customizations.push(`<strong>Metallic:</strong> ${item.customizations.metallicName || 'Yes'}`);
        const accentLogos = item.customizations?.logos || [];
        if (accentLogos.length > 0) customizations.push(`<strong>Add-Ons:</strong> ${accentLogos.map((l: any) => `${l.type} (${l.position})`).join(', ')}`);
        const itemNames = item.customizations?.names || [];
        if (itemNames.length > 0) customizations.push(`<strong>Names:</strong> ${itemNames.map((n: any) => `${n.text} (${n.position})`).join(', ')}`);
        const itemNumbers = item.customizations?.numbers || [];
        if (itemNumbers.length > 0) customizations.push(`<strong>Numbers:</strong> ${itemNumbers.map((n: any) => `${n.text} (${n.position})`).join(', ')}`);
        const shipBadge = item.needsShipping ? `<br/><span style="background:#fff3cd;color:#856404;font-size:11px;padding:2px 8px;border-radius:4px;font-weight:bold;display:inline-block;margin-top:4px;">🚚 Ship to Home</span>` : '';
        return `<tr>
            <td style="padding: 12px 8px; border-bottom: 1px solid #ddd;"><strong>${item.productName}</strong><br/><span style="font-size: 12px; color: #555;">Size: ${item.size}</span>${shipBadge}</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #ddd; font-size: 12px;">${customizations.join('<br/>')}</td>
            <td style="padding: 12px 8px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(item.finalPrice).toFixed(2)}</td>
        </tr>`;
    }).join('');

    // --- DYNAMIC TAX ROW ---
    // Only shows up if the math determines tax was actually charged
    let taxRowHtml = '';
    if (taxAmount > 0) {
        taxRowHtml = `
        <tr>
            <td colspan="2" style="padding: 6px 12px; text-align: right; color: #555; font-size: 14px;">Sales Tax</td>
            <td style="padding: 6px 12px; text-align: right; color: #555; font-size: 14px;">$${taxAmount.toFixed(2)}</td>
        </tr>`;
    }

    const data = await resend.emails.send({
      from: 'Lev Custom Merch <orders@receipts.levcustom.com>',
      to: [email],
      subject: `Receipt: ${eventName} - Order #${String(orderId).slice(0, 8)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${eventLogoHtml}
            <h1 style="color: #1e3a8a; text-align: center; margin-bottom: 5px;">Order Confirmed!</h1>
            <p style="text-align: center; color: #555; margin-top: 0;">Order #${String(orderId).slice(0, 8)}</p>
            
            <p style="margin-top: 30px;">Hi ${name},</p>
            <p>Thanks for ordering at <strong>${eventName}</strong>.${shippingInfo ? " We'll ship your item(s) to the address below." : " We'll text you when it's ready."}</p>
            ${shippingInfo ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#0369a1;text-transform:uppercase;letter-spacing:1px;">🚚 Ship To</p><p style="margin:0;font-size:14px;color:#1e293b;">${shippingInfo.address}<br/>${shippingInfo.city}, ${shippingInfo.state} ${shippingInfo.zip}</p></div>` : ''}
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 10px 8px; text-align: left; font-size: 14px; color: #555;">Item</th>
                        <th style="padding: 10px 8px; text-align: left; font-size: 14px; color: #555;">Details</th>
                        <th style="padding: 10px 8px; text-align: right; font-size: 14px; color: #555;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${cartRows}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="padding: 16px 12px 6px; text-align: right; color: #555; font-size: 14px;">Subtotal</td>
                        <td style="padding: 16px 12px 6px; text-align: right; color: #555; font-size: 14px;">$${subtotalAmount.toFixed(2)}</td>
                    </tr>
                    ${taxRowHtml}
                    <tr>
                        <td colspan="2" style="padding: 12px; text-align: right; font-weight: black; font-size: 18px; border-top: 2px solid #eee;">GRAND TOTAL</td>
                        <td style="padding: 12px; text-align: right; font-weight: black; font-size: 18px; color: #1e3a8a; border-top: 2px solid #eee;">$${grandTotal.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <div style="text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 30px;">
                <p style="font-size: 12px; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Powered by</p>
                <img src="${companyLogoUrl}" alt="Lev Custom Merch" style="max-width: 120px; height: auto;" />
                <p style="font-size: 12px; color: #aaa; margin-top: 15px;">2125 W. Hemlock Rd.<br/>Glendale, WI 53209</p>
            </div>
        </div>`,
    });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
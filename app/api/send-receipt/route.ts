import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

// FIX: Added ": Request" to satisfy strict mode
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, name, cart, total, orderId, eventName, eventLogo } = body;

    if (!email) return NextResponse.json({ error: 'No email provided' }, { status: 400 });

    // 1. Dynamic Event Logo
    let eventLogoHtml = '';
    if (eventLogo) {
        const src = eventLogo.startsWith('http') ? eventLogo : `${baseUrl}/${eventLogo}`;
        eventLogoHtml = `<div style="text-align: center; margin-bottom: 20px;"><img src="${src}" alt="${eventName}" style="max-width: 150px; height: auto;" /></div>`;
    }

    // 2. Static Company Logo
    const companyLogoUrl = `${baseUrl}/company-logo.png`;

    // FIX: Added ": any" to item so TypeScript stops complaining
    const cartRows = cart.map((item: any) => {
        const customizations = [];
        if(item.customizations?.mainDesign) customizations.push(`Design: ${item.customizations.mainDesign}`);
        if(item.customizations?.metallic) customizations.push(`Metallic: ${item.customizations.metallicName || 'Yes'}`);
        return `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${item.productName}</strong><br/><span style="font-size: 12px; color: #555;">Size: ${item.size}</span></td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px;">${customizations.join('<br/>')}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.finalPrice}</td>
        </tr>`;
    }).join('');

    const data = await resend.emails.send({
      from: 'Lev Custom Merch <orders@receipts.levcustom.com>',
      to: [email],
      subject: `Receipt: ${eventName} - Order #${String(orderId).slice(0, 8)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            ${eventLogoHtml}
            <h1 style="color: #1e3a8a; text-align: center;">Order Confirmed!</h1>
            <p>Hi ${name},</p>
            <p>Thanks for ordering at <strong>${eventName}</strong>. We'll text you when it's ready.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead><tr style="background: #f3f4f6;"><th style="padding: 8px; text-align: left;">Item</th><th style="padding: 8px; text-align: left;">Details</th><th style="padding: 8px; text-align: right;">Price</th></tr></thead>
                <tbody>${cartRows}</tbody>
                <tfoot><tr><td colspan="2" style="padding: 12px; text-align: right; font-weight: bold;">TOTAL</td><td style="padding: 12px; text-align: right; font-weight: bold;">$${total}</td></tr></tfoot>
            </table>
            <div style="text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
                <p style="font-size: 12px; color: #888; margin-bottom: 10px;">Powered by</p>
                <img src="${companyLogoUrl}" alt="Lev Custom Merch" style="max-width: 120px; height: auto;" />
            </div>
        </div>`,
    });
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
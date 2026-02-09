import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, name, cart, total, orderId, eventName } = body;

    // 1. Basic Validation
    if (!email) return NextResponse.json({ error: 'No email provided' }, { status: 400 });

    // 2. Build the Email HTML
    const cartRows = cart.map(item => {
        const customizations = [];
        if(item.customizations.mainDesign) customizations.push(`Design: ${item.customizations.mainDesign}`);
        if(item.customizations.metallic) customizations.push(`Metallic: ${item.customizations.metallicName || 'Yes'}`);
        // Add names/logos to list...
        return `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">
                <strong>${item.productName}</strong> <br/>
                <span style="font-size: 12px; color: #555;">Size: ${item.size}</span>
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px;">
                ${customizations.join('<br/>')}
            </td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">
                $${item.finalPrice}
            </td>
        </tr>`;
    }).join('');

    // 3. Send the Email
    const data = await resend.emails.send({
      from: 'Lev Custom Merch <orders@receipts.levcustom.com>', // <--- CHANGE THIS TO YOUR VERIFIED DOMAIN
      to: [email],
      subject: `Receipt: ${eventName} - Order #${String(orderId).slice(0, 8)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1e3a8a;">Order Confirmed!</h1>
            <p>Hi ${name},</p>
            <p>Thanks for ordering at <strong>${eventName}</strong>. We'll text you when it's ready.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 8px; text-align: left;">Item</th>
                        <th style="padding: 8px; text-align: left;">Details</th>
                        <th style="padding: 8px; text-align: right;">Price</th>
                    </tr>
                </thead>
                <tbody>${cartRows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="padding: 12px; text-align: right; font-weight: bold;">TOTAL</td>
                        <td style="padding: 12px; text-align: right; font-weight: bold;">$${total}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Email Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
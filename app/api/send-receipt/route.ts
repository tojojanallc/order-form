// @ts-nocheck
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { email, customerName, cart, total } = await request.json();

    // 1. Build the email HTML (The "Receipt")
    const orderItemsHtml = cart.map(item => `
      <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
        <strong>${item.productName}</strong> (${item.size}) - $${item.finalPrice}
        <br/>
        <span style="color: #666; font-size: 12px;">
           ${item.customizations.logos.map(l => `${l.type} (${l.position})`).join(', ')}
           ${item.customizations.names.map(n => `Name: ${n.text}`).join(', ')}
        </span>
      </div>
    `).join('');

    // 2. Send the email
    const data = await resend.emails.send({
      from: 'Swag Store <onboarding@resend.dev>', // Default testing address
      to: email, // This MUST be your own email until you verify a domain
      subject: 'Order Confirmation - 2025 Championships',
      html: `
        <h1>Thanks for your order, ${customerName}!</h1>
        <p>We have received your request. Here are the details:</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 5px;">
          ${orderItemsHtml}
          <h3 style="text-align: right; margin-top: 20px;">Total: $${total}</h3>
        </div>
        <p>You will receive a text when your order is ready for pickup.</p>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Email Error:", error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
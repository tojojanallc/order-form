import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(req) {
  try {
    // 1. Read the data sent from the Admin Panel
    const body = await req.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json({ success: false, error: 'Missing phone or message' }, { status: 400 });
    }

    // 2. Connect to Twilio (using your Vercel Environment Variables)
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
      console.error("Missing Twilio Keys");
      return NextResponse.json({ success: false, error: 'Server missing Twilio keys' }, { status: 500 });
    }

    const client = twilio(accountSid, authToken);

    // 3. Send the Text
    const result = await client.messages.create({
      body: message,
      from: fromPhone,
      to: to,
    });

    return NextResponse.json({ success: true, sid: result.sid });

  } catch (error) {
    console.error('SMS Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
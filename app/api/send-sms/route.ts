import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(req: any) {
  try {
    // 1. Read the data sent from the Admin Panel
    const body = await req.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 });
    }

    // 2. Initialize Twilio
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // 3. Send the Text
    const messageResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    return NextResponse.json({ success: true, sid: messageResponse.sid });
  } catch (error: any) {
    console.error('Twilio Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
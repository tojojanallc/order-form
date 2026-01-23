// @ts-nocheck
import { NextResponse } from 'next/server';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

export async function POST(request) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json({ error: 'Missing phone or message' }, { status: 400 });
    }

    // Send the text
    const result = await client.messages.create({
      body: message,
      from: fromPhone,
      to: phone,
    });

    return NextResponse.json({ success: true, sid: result.sid });

  } catch (error) {
    console.error("Twilio Error:", error);
    return NextResponse.json({ error: 'Failed to send text' }, { status: 500 });
  }
}
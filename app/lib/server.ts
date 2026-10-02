// Server-only helpers shared by the kiosk's API routes
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** One text through the kiosk's Twilio number. Returns false (never throws) when it can't send. */
export async function sendSms(to: string, body: string) {
  const digits = String(to || '').replace(/\D/g, '');
  if (digits.length < 10) return false;
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to: digits.length === 10 ? `+1${digits}` : `+${digits}` });
    return true;
  } catch (e) { console.error('SMS failed:', e); return false; }
}

/** Put one of each cart item back on the event's stock (undoes the decrement_inventory_on_order trigger). */
export async function restockCart(db: ReturnType<typeof admin>, eventSlug: string, cart: any[]) {
  for (const item of cart || []) {
    if (!item?.productId || !item?.size) continue;
    const { data } = await db.from('inventory').select('count').eq('event_slug', eventSlug).eq('product_id', item.productId).eq('size', item.size).maybeSingle();
    if (data) await db.from('inventory').update({ count: (Number(data.count) || 0) + 1 }).eq('event_slug', eventSlug).eq('product_id', item.productId).eq('size', item.size);
  }
}

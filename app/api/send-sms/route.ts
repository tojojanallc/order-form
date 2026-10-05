import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { admin, sendSms } from '@/app/lib/server';
import { readyText } from '@/app/lib/readyText';

// Kiosk texts. Locked down so it can't be used to text any number with any message:
//  • { kind, orderId } — 'confirmation' | 'addon' | 'ready' | 'last_call'. The message is written here and goes
//    only to the phone saved on that order, with a limit on repeats (lev_sms_log).
//  • { phone, message } + x-lev-secret header — the Lev portal's server only ("Text me a sample").

let secret: string | null = null;
async function fromPortal(req: Request, db: ReturnType<typeof admin>) {
  if (!secret) secret = (await db.from('lev_app_secrets').select('value').eq('key', 'kiosk_api').maybeSingle()).data?.value || null;
  const got = Buffer.from(req.headers.get('x-lev-secret') || '');
  const want = Buffer.from(secret || '');
  return !!secret && got.length === want.length && timingSafeEqual(got, want);
}

const last10 = (p: any) => String(p || '').replace(/\D/g, '').slice(-10);
const LIMITS: Record<string, number> = { confirmation: 2, addon: 2, ready: 3, last_call: 2 };

async function recentlySent(db: ReturnType<typeof admin>, match: { order_id?: number; phone?: string }, kind: string) {
  let q = db.from('lev_sms_log').select('sent_at').eq('kind', kind).gte('sent_at', new Date(Date.now() - 24 * 3600e3).toISOString());
  q = match.order_id ? q.eq('order_id', match.order_id) : q.eq('phone', match.phone!);
  const { data } = await q.order('sent_at', { ascending: false });
  const last = data?.[0] ? new Date(data[0].sent_at).getTime() : 0;
  return { count: data?.length || 0, tooSoon: Date.now() - last < 60_000 };
}

export async function POST(req: Request) {
  const db = admin();
  const body = await req.json().catch(() => ({}));
  try {
    // Lev portal (server to server)
    if (body.phone && body.message && await fromPortal(req, db)) {
      const ok = await sendSms(body.phone, String(body.message).slice(0, 640));
      return NextResponse.json({ success: ok }, { status: ok ? 200 : 502 });
    }

    // Texts about an order
    if (body.kind && body.orderId) {
      const kind = String(body.kind);
      if (!LIMITS[kind]) return NextResponse.json({ error: 'Unknown text' }, { status: 400 });
      const { data: o } = await db.from('orders').select('id, customer_name, phone, event_name, event_slug').eq('id', body.orderId).maybeSingle();
      if (!o || last10(o.phone).length < 10) return NextResponse.json({ success: false, error: 'No phone number on that order' }, { status: 400 });
      const seen = await recentlySent(db, { order_id: o.id }, kind);
      if (seen.tooSoon || seen.count >= LIMITS[kind]) return NextResponse.json({ success: false, error: 'Already sent' }, { status: 429 });
      const name = String(o.customer_name || '').trim() || 'there';
      const mins = Math.max(0, Math.min(240, Math.round(Number(body.minutes) || 0)));
      const message =
        kind === 'confirmation' ? `Hi ${name}! Thanks for your order from Lev Custom Merch at ${o.event_name || 'the event'}. Your order number is #${o.id}.${mins ? ` It should be ready in about ${mins} minutes.` : ''} We will text you again when it's ready for pickup!`
        : kind === 'addon' ? `Hi ${name}! Your add-on order #${o.id} from Lev Custom Merch is confirmed. We'll text you when it's ready!`
        : kind === 'ready' ? await readyText(db, name, o.event_slug)
        : `🚨 LAST CALL! Hi ${name}, the Lev Custom Merch tent is packing up soon! Please come grab your order before we leave the venue.`;
      const ok = await sendSms(o.phone, message);
      if (ok) await db.from('lev_sms_log').insert({ order_id: o.id, phone: last10(o.phone), kind });
      return NextResponse.json({ success: ok }, { status: ok ? 200 : 502 });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error: any) {
    console.error('SMS error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

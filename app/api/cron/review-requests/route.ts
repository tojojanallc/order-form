// Next-day Google review texts (event_settings.kiosk_extras.reviewTexts + reviewUrl). Runs daily from vercel.json.
// One text per phone number per event, for orders placed 12–48 hours ago; never refunds or cancelled orders.
import { NextResponse } from 'next/server';
import { admin, sendSms } from '@/app/lib/server';

export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel cron sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const ua = req.headers.get('user-agent') || '';
  if (secret ? auth !== `Bearer ${secret}` : !ua.includes('vercel-cron')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = admin();
  const { data: events } = await db.from('event_settings').select('slug, event_name, kiosk_extras').eq('kiosk_extras->>reviewTexts', 'true');
  const now = Date.now();
  let sent = 0;
  for (const ev of events || []) {
    const url = String(ev.kiosk_extras?.reviewUrl || '').trim();
    if (!/^https?:\/\//.test(url)) continue;
    const { data: orders } = await db.from('orders').select('id, customer_name, phone, status, review_requested_at')
      .eq('event_slug', ev.slug)
      .gte('created_at', new Date(now - 48 * 3600e3).toISOString())
      .lte('created_at', new Date(now - 12 * 3600e3).toISOString())
      .limit(2000);
    const { data: asked } = await db.from('orders').select('phone').eq('event_slug', ev.slug).not('review_requested_at', 'is', null).limit(5000);
    const norm = (p: any) => String(p || '').replace(/\D/g, '').slice(-10);
    const done = new Set((asked || []).map(o => norm(o.phone)));
    const byPhone = new Map<string, any[]>();
    for (const o of orders || []) {
      const p = norm(o.phone);
      if (p.length < 10 || done.has(p) || o.review_requested_at || ['refunded', 'canceled', 'cancelled', 'awaiting_payment'].includes(o.status)) continue;
      (byPhone.get(p) || byPhone.set(p, []).get(p)!).push(o);
    }
    for (const [phone, list] of Array.from(byPhone.entries())) {
      const first = String(list[0].customer_name || '').trim().split(/\s+/)[0] || 'there';
      const ok = await sendSms(phone, `Hi ${first}! Thanks for getting custom gear from Lev Custom Merch at ${ev.event_name || 'the event'}. If you love it, would you leave us a quick review? ${url}`);
      if (ok) { sent++; await db.from('orders').update({ review_requested_at: new Date().toISOString() }).in('id', list.map(o => o.id)); }
    }
  }
  return NextResponse.json({ sent });
}

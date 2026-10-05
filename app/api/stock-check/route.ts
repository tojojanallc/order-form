// Low-stock text alerts (event_settings.kiosk_extras.lowStockOn / lowStockAt; the phone is in lev_event_private).
// The kiosk calls this after each order. Each size alerts once; if it's restocked above the line it can alert again.
import { NextResponse } from 'next/server';
import { admin, sendSms } from '@/app/lib/server';

export async function POST(req: Request) {
  const { eventSlug } = await req.json().catch(() => ({}));
  if (!eventSlug) return NextResponse.json({ sent: 0 });
  const db = admin();
  const { data: ev } = await db.from('event_settings').select('event_name, kiosk_extras, ignore_inventory').eq('slug', eventSlug).maybeSingle();
  const x = ev?.kiosk_extras || {};
  const { data: priv } = await db.from('lev_event_private').select('low_stock_phone').eq('slug', eventSlug).maybeSingle();
  const phone = priv?.low_stock_phone || x.lowStockPhone;
  if (!ev || ev.ignore_inventory || !x.lowStockOn || !phone) return NextResponse.json({ sent: 0 });
  const at = Math.max(1, Number(x.lowStockAt) || 2);

  const [{ data: inv }, { data: done }] = await Promise.all([
    db.from('inventory').select('product_id, size, count').eq('event_slug', eventSlug).eq('active', true).limit(5000),
    db.from('lev_stock_alerts').select('product_id, size').eq('event_slug', eventSlug),
  ]);
  const key = (r: any) => `${r.product_id}|${r.size}`;
  const alerted = new Set((done || []).map(key));
  const low = (inv || []).filter(r => (Number(r.count) || 0) <= at);
  const fresh = low.filter(r => !alerted.has(key(r)));
  // Restocked above the line → may alert again later
  const lowKeys = new Set(low.map(key));
  const restocked = (done || []).filter(r => !lowKeys.has(key(r)));
  for (const r of restocked) await db.from('lev_stock_alerts').delete().eq('event_slug', eventSlug).eq('product_id', r.product_id).eq('size', r.size);
  if (!fresh.length) return NextResponse.json({ sent: 0 });

  await db.from('lev_stock_alerts').upsert(fresh.map(r => ({ event_slug: eventSlug, product_id: r.product_id, size: r.size, count: r.count })), { onConflict: 'event_slug,product_id,size', ignoreDuplicates: true });
  const label = (r: any) => { const [name, , color] = String(r.product_id).split(' | '); return `${name}${color ? ` ${color}` : ''} ${r.size}: ${Math.max(0, Number(r.count) || 0)} left`; };
  const lines = fresh.slice(0, 8).map(label);
  if (fresh.length > 8) lines.push(`+${fresh.length - 8} more`);
  const ok = await sendSms(phone, `Lev low stock — ${ev.event_name || eventSlug}:\n${lines.join('\n')}`);
  return NextResponse.json({ sent: ok ? fresh.length : 0 });
}

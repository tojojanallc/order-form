import { admin, restockCart } from '@/app/lib/server';

/** Pre-orders are on for this event (portal → event → Kiosk extras → Pre-orders), and not past the "until" time. */
export function preorderOpen(ev: any) {
  const x = ev?.kiosk_extras || {};
  if (!ev || ev.status === 'archived' || (ev.payment_mode && ev.payment_mode !== 'retail') || !x.preorderOn) return false;
  if (x.preorderUntil && Date.now() > new Date(x.preorderUntil).getTime()) return false;
  return true;
}

/** Unpaid pre-orders whose Stripe page has expired (31 min) give their stock back. */
export async function releaseAbandoned(db: ReturnType<typeof admin>, slug: string) {
  const { data } = await db.from('orders').select('id, cart_data').eq('event_slug', slug).eq('payment_method', 'stripe_preorder')
    .eq('status', 'awaiting_payment').neq('payment_status', 'paid').lt('created_at', new Date(Date.now() - 35 * 60000).toISOString()).limit(50);
  for (const o of data || []) {
    const { data: hit } = await db.from('orders').update({ status: 'canceled' }).eq('id', o.id).eq('status', 'awaiting_payment').neq('payment_status', 'paid').select('id');
    if (hit?.length) await restockCart(db, slug, o.cart_data || []);
  }
}

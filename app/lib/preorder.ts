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

const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const PREORDER_ALERT_TO = 'info@levcustom.com';
const $ = (n: any) => `$${(Number(n) || 0).toFixed(2)}`;

/** A pre-order was just paid → email the shop (info@) so someone knows to print and make it next morning.
 *  Sent once per order: a lev_sms_log row (unique on order_id for kind 'preorder_alert') is claimed first,
 *  so /success and the Stripe webhook can both call this. Never throws. */
export async function alertPreorderPaid(db: ReturnType<typeof admin>, orderId: string | number) {
  try {
    const { data: o } = await db.from('orders').select('id, customer_name, email, phone, cart_data, total_price, tax_collected, event_name, event_slug, payment_method, payment_status, shipping_address, shipping_city, shipping_state, shipping_zip')
      .eq('id', orderId).maybeSingle();
    if (!o || o.payment_method !== 'stripe_preorder' || o.payment_status !== 'paid') return false;
    if (!process.env.RESEND_API_KEY) { console.error('Pre-order alert: RESEND_API_KEY not set'); return false; }
    const { error: claimErr } = await db.from('lev_sms_log').insert({ order_id: o.id, kind: 'preorder_alert', phone: PREORDER_ALERT_TO });
    if (claimErr) return false;   // already sent (or can't record it — don't risk repeats)

    const cart: any[] = Array.isArray(o.cart_data) ? o.cart_data : [];
    const rows = cart.map(i => {
      const color = i.color || String(i.productId || '').split(' | ')[2] || '';
      const c = i.customizations || {};
      const bits = [
        c.mainDesign ? `Design: ${esc(c.mainDesign)}` : '',
        ...(c.logos || []).map((l: any) => `${esc(l.type)} (${esc(l.position)})`),
        ...(c.names || []).map((n: any) => `Name: ${esc(n.text)} (${esc(n.position)})`),
        ...(c.numbers || []).map((n: any) => `#${esc(n.text)} (${esc(n.position)})`),
        i.needsShipping ? '🚚 Ship to home' : '',
      ].filter(Boolean).join('<br/>');
      return `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><b>${esc(i.productName)}</b><br/><span style="color:#555;font-size:12px">Size: ${esc(i.size)}${color ? ` · Color: ${esc(color)}` : ''}</span></td>`
        + `<td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">${bits}</td>`
        + `<td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${$(i.finalPrice)}</td></tr>`;
    }).join('');
    const ship = o.shipping_address ? `<p style="margin:8px 0 0"><b>Ship to:</b> ${esc(o.shipping_address)}, ${esc(o.shipping_city)}, ${esc(o.shipping_state)} ${esc(o.shipping_zip)}</p>` : '';
    const evName = o.event_name || o.event_slug || 'event';
    const portal = `https://portal.levcustom.com/admin/events/${encodeURIComponent(o.event_slug || '')}`;
    const { Resend } = await import('resend');
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: 'Lev Custom Merch <orders@receipts.levcustom.com>',
      to: [PREORDER_ALERT_TO],
      ...(o.email ? { replyTo: o.email } : {}),
      subject: `🛒 New pre-order #${o.id} — ${evName} — ${o.customer_name || 'customer'} (${$(o.total_price)})`,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:16px">
        <h2 style="color:#0a2342;margin:0 0 4px">New pre-order paid — #${o.id}</h2>
        <p style="color:#555;margin:0 0 16px">${esc(evName)} · ${cart.length} item${cart.length === 1 ? '' : 's'} · ${$(o.total_price)} paid online${Number(o.tax_collected) > 0 ? ` (incl. ${$(o.tax_collected)} tax)` : ''}</p>
        <p style="margin:0"><b>${esc(o.customer_name)}</b>${o.phone ? ` · ${esc(o.phone)}` : ''}${o.email ? ` · ${esc(o.email)}` : ''}</p>
        ${ship}
        <table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#f3f4f6"><th style="text-align:left;padding:8px">Item</th><th style="text-align:left;padding:8px">Details</th><th style="text-align:right;padding:8px">Price</th></tr></thead><tbody>${rows}</tbody></table>
        <p style="font-size:13px;color:#555">It's on the event's order list (tagged PRE-ORDER) — print it with the rest. <a href="${portal}">Open the event in the portal</a></p>
      </div>`,
    });
    if (error) {
      console.error('Pre-order alert email failed:', error);
      await db.from('lev_sms_log').delete().eq('order_id', o.id).eq('kind', 'preorder_alert');   // let the next call retry
      return false;
    }
    return true;
  } catch (e) { console.error('Pre-order alert failed:', e); return false; }
}

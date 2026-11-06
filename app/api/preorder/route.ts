// Pre-orders: the event's QR code opens the kiosk menu on the customer's own phone (/?event=<slug>&preorder=1).
//   POST { eventSlug, cart, customerName, customerPhone, customerEmail, shippingInfo }
//     → prices every item HERE from the event's own prices (never the phone's numbers), saves the order
//       (awaiting_payment — off the production list until paid) and returns a Stripe Checkout url.
//   Paid → /success confirms it (lib/stripePay) → status pending, in the event's order list to print and make.
// Only while the event has pre-orders turned on in the portal (kiosk_extras.preorderOn, optional preorderUntil).
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { admin, restockCart } from '@/app/lib/server';
import { preorderOpen, releaseAbandoned } from '@/app/lib/preorder';

export const dynamic = 'force-dynamic';
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const EXTRA = 5;   // per logo / name / number / roster / metallic — same as the kiosk (calculateItemTotal)
const num = (v: any) => Number(v) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const str = (v: any, n = 120) => String(v ?? '').trim().slice(0, n);

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: 'Payments are not set up' }, { status: 500 });
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const slug = str(b.eventSlug, 80);
  const { data: ev } = await db.from('event_settings').select('slug, event_name, status, payment_mode, tax_enabled, tax_rate, kiosk_extras, ignore_inventory').eq('slug', slug).maybeSingle();
  if (!preorderOpen(ev)) return NextResponse.json({ error: 'Pre-orders are closed for this event' }, { status: 403 });
  await releaseAbandoned(db, slug).catch(() => {});

  const name = str(b.customerName, 80), phone = str(b.customerPhone, 30), email = str(b.customerEmail, 120);
  if (!name) return NextResponse.json({ error: 'Enter your name' }, { status: 400 });
  if (String(phone).replace(/\D/g, '').length < 10) return NextResponse.json({ error: 'Enter your mobile number so we can text you when it’s ready' }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter your email — we send your receipt there' }, { status: 400 });
  const cartIn: any[] = Array.isArray(b.cart) ? b.cart.slice(0, 30) : [];
  if (!cartIn.length) return NextResponse.json({ error: 'Your cart is empty' }, { status: 400 });

  // Event prices and stock for exactly these items
  const ids = Array.from(new Set(cartIn.map(i => str(i?.productId, 200)).filter(Boolean)));
  const [{ data: prods }, { data: inv }] = await Promise.all([
    db.from('products').select('id, name, base_price, add_ons').in('id', ids),
    db.from('inventory').select('product_id, size, count, override_price, active').eq('event_slug', slug).in('product_id', ids),
  ]);
  const prodOf = new Map((prods || []).map(p => [p.id, p]));
  const invOf = new Map((inv || []).map(i => [`${i.product_id}|${i.size}`, i]));
  const bundleMax = Math.max(0, num(ev!.kiosk_extras?.bundleDiscount));

  const cart: any[] = [];
  for (const raw of cartIn) {
    const p = prodOf.get(str(raw?.productId, 200));
    const size = str(raw?.size, 20);
    const stock = invOf.get(`${raw?.productId}|${size}`);
    if (!p || !stock || stock.active === false) return NextResponse.json({ error: `${str(raw?.productName) || 'An item'} isn’t available for pre-order — remove it and try again` }, { status: 400 });
    const c = raw.customizations || {};
    const list = (a: any) => (Array.isArray(a) ? a : []).slice(0, 6)
    const logos = list(c.logos), names = list(c.names).filter((n: any) => str(n?.text)), numbers = list(c.numbers).filter((n: any) => str(n?.text));
    let price = num(stock.override_price) || num(p.base_price);
    price += EXTRA * (logos.length + names.length + numbers.length + (c.backList ? 1 : 0) + (c.metallic ? 1 : 0));
    // Product add-ons: only pieces beyond what's included are charged, capped at the product's max
    const addOns: any[] = [];
    for (const def of Array.isArray(p.add_ons) ? p.add_ons : []) {
      const want = (Array.isArray(c.addOns) ? c.addOns : []).find((a: any) => a?.name === def.name);
      const qty = Math.max(0, Math.min(num(def.max) || 99, Math.floor(num(want?.qty))));
      if (!qty) continue;
      const extra = Math.max(0, qty - num(def.included));
      price += extra * num(def.price);
      addOns.push({ name: def.name, qty, extra, extraCost: extra * num(def.price) });
    }
    // "Add another one" bundle discount — only on 2nd+ items, never more than the event's setting
    const bundle = cart.length && bundleMax ? Math.min(bundleMax, num(c.bundleSavings), price) : 0;
    price = r2(Math.max(0, price - bundle));
    cart.push({
      ...raw, productId: p.id, size, finalPrice: price,
      needsShipping: !!raw.needsShipping, preorder: true,
      customizations: { ...c, logos, names, numbers, addOns, ...(bundle ? { bundleSavings: bundle } : { bundleSavings: undefined }) },
    });
  }
  const subtotal = r2(cart.reduce((s, i) => s + i.finalPrice, 0));
  const tax = ev!.tax_enabled && num(ev!.tax_rate) > 0 ? r2(subtotal * num(ev!.tax_rate) / 100) : 0;
  const total = r2(subtotal + tax);
  const ship = b.shippingInfo && str(b.shippingInfo.address) ? b.shippingInfo : null;

  const { data: order, error } = await db.from('orders').insert([{
    customer_name: name, phone, email: email || null, cart_data: cart, total_price: total, tax_collected: tax,
    status: 'awaiting_payment', payment_status: 'unpaid', payment_method: 'stripe_preorder',
    event_name: ev!.event_name, event_slug: slug,
    shipping_address: ship ? str(ship.address) : null, shipping_city: ship ? str(ship.city, 60) : null,
    shipping_state: ship ? str(ship.state, 20) : null, shipping_zip: ship ? str(ship.zip, 12) : null,
    admin_notes: 'Pre-order (QR) — paid online',
  }]).select('id').single();
  if (error || !order) return NextResponse.json({ error: error?.message || 'Could not save the order' }, { status: 500 });

  try {
    const line = (n: string, amt: number, desc?: string) => ({ price_data: { currency: 'usd', product_data: { name: n.slice(0, 120) || 'Item', ...(desc ? { description: desc.slice(0, 400) } : {}) }, unit_amount: Math.round(amt * 100) }, quantity: 1 });
    const items = cart.map(i => line(i.productName || 'Item', i.finalPrice, [i.size ? `Size: ${i.size}` : '', ...(i.customizations.names || []).map((n: any) => `Name: ${str(n.text, 30)}`), ...(i.customizations.numbers || []).map((n: any) => `#${str(n.text, 6)}`)].filter(Boolean).join(', ') || undefined));
    if (tax > 0) items.push(line('Sales tax', tax));
    const origin = req.headers.get('origin') || new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', line_items: items as any,
      customer_email: email || undefined,
      success_url: `${origin}/success?phone=1&preorder=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?event=${encodeURIComponent(slug)}&preorder=1`,
      metadata: { customer_name: name, supabase_order_id: String(order.id), preorder: '1' },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });
    return NextResponse.json({ orderId: order.id, url: session.url, total });
  } catch (e: any) {
    await db.from('orders').update({ status: 'canceled', payment_status: 'unpaid' }).eq('id', order.id);
    await restockCart(db, slug, cart);
    return NextResponse.json({ error: e.message || 'Payment could not start' }, { status: 500 });
  }
}

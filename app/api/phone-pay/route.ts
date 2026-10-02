// Pay on your own phone: the kiosk shows a QR code for a Stripe Checkout page.
//   POST { action: 'start', cart, customerName, customerPhone, customerEmail, total, taxCollected, eventName, eventSlug, shippingInfo, site }
//        → creates the order (status awaiting_payment — kept off the heat-press queue until paid) and the Stripe session → { orderId, sessionId, url }
//   GET  ?session=cs_…  → asks Stripe; once paid, marks that exact order paid and releases it to production → { paid, orderId }
//   POST { action: 'cancel', orderId } → cancels an unpaid phone order and puts its stock back
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { admin, restockCart } from '@/app/lib/server';
import { confirmSession } from '@/app/lib/stripePay';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Stripe rejects an empty description, so it's only sent when there's text
const product = (name: string, description?: string) => ({ name: name || 'Item', ...(description && description.trim() ? { description: description.trim().slice(0, 400) } : {}) });

function lineItems(cart: any[]) {
  return cart.map((item: any) => ({
    price_data: {
      currency: 'usd',
      product_data: product(item.productName, [item.size ? `Size: ${item.size}` : '', ...(item.customizations?.names || []).map((n: any) => n.text ? `Name: ${n.text}` : ''), ...(item.customizations?.numbers || []).map((n: any) => n.text ? `#${n.text}` : '')].filter(Boolean).join(', ')),
      unit_amount: Math.round(Number(item.finalPrice) * 100),
    },
    quantity: 1,
  }));
}

export async function GET(req: Request) {
  const session = new URL(req.url).searchParams.get('session');
  if (!session) return NextResponse.json({ error: 'Missing session' }, { status: 400 });
  try { return NextResponse.json(await confirmSession(session)); }
  catch (e: any) { return NextResponse.json({ paid: false, error: e.message }, { status: 500 }); }
}

export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  const body = await req.json().catch(() => ({}));
  const db = admin();
  try {
    if (body.action === 'cancel') {
      const { data: order } = await db.from('orders').select('id, status, payment_status, cart_data, event_slug').eq('id', body.orderId).maybeSingle();
      if (!order || order.status !== 'awaiting_payment' || order.payment_status === 'paid') return NextResponse.json({ cancelled: false });
      await db.from('orders').update({ status: 'canceled', payment_status: 'unpaid' }).eq('id', order.id);
      await restockCart(db, order.event_slug || 'default', order.cart_data);
      return NextResponse.json({ cancelled: true });
    }

    const { cart, customerName, customerPhone, customerEmail, total, taxCollected, eventName, eventSlug, shippingInfo, site } = body;
    if (!Array.isArray(cart) || !cart.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    const { data: order, error } = await db.from('orders').insert([{
      customer_name: customerName, phone: customerPhone || 'N/A', email: customerEmail || null,
      cart_data: cart, total_price: Number(total) || 0, tax_collected: Number(taxCollected) || 0,
      status: 'awaiting_payment', payment_status: 'unpaid', payment_method: 'stripe_phone',
      event_name: eventName, event_slug: eventSlug || 'default', site: site || null,
      shipping_address: shippingInfo?.address || null, shipping_city: shippingInfo?.city || null,
      shipping_state: shippingInfo?.state || null, shipping_zip: shippingInfo?.zip || null,
    }]).select('id').single();
    if (error) throw error;

    try {
    const items = lineItems(cart);
    const tax = Math.round((Number(taxCollected) || 0) * 100);
    if (tax > 0) items.push({ price_data: { currency: 'usd', product_data: product('Sales tax'), unit_amount: tax }, quantity: 1 } as any);
    // Discounts: charge the order total, not the sum of the lines
    const lineSum = items.reduce((s: number, l: any) => s + l.price_data.unit_amount, 0);
    const want = Math.round((Number(total) || 0) * 100);
    let discounts: any;
    if (want > 0 && want < lineSum) {
      const coupon = await stripe.coupons.create({ amount_off: lineSum - want, currency: 'usd', duration: 'once', name: 'Event discount' });
      discounts = [{ coupon: coupon.id }];
    }
    const origin = req.headers.get('origin') || new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items,
      ...(discounts ? { discounts } : {}),
      customer_email: customerEmail || undefined,
      success_url: `${origin}/success?phone=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/success?phone=1&cancelled=1`,
      metadata: { customer_name: customerName || '', supabase_order_id: String(order.id) },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });
    return NextResponse.json({ orderId: order.id, sessionId: session.id, url: session.url });
    } catch (e) {
      // Stripe refused: don't leave the unpaid order (and the stock it took) behind
      await db.from('orders').update({ status: 'canceled', payment_status: 'unpaid' }).eq('id', order.id);
      await restockCart(db, eventSlug || 'default', cart);
      throw e;
    }
  } catch (e: any) {
    console.error('Phone pay error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

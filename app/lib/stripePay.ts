// Stripe Checkout confirmation shared by /api/phone-pay and the /success page's API
import Stripe from 'stripe';
import { admin } from '@/app/lib/server';
import { alertPreorderPaid } from '@/app/lib/preorder';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

/** Marks the session's order paid (only that order) once Stripe says it's paid. Shared with /success. */
export async function confirmSession(sessionId: string) {
  if (!stripe) return { paid: false, error: 'Stripe not configured' };
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const orderId = session.metadata?.supabase_order_id;
  if (session.payment_status !== 'paid' || !orderId) return { paid: false, orderId: orderId || null };
  const db = admin();
  const { data: order } = await db.from('orders').select('id, status, payment_status, shipping_address').eq('id', orderId).maybeSingle();
  if (order && order.payment_status !== 'paid') {
    const status = ['awaiting_payment', 'canceled', null, ''].includes(order.status) ? (order.shipping_address ? 'pending_shipping' : 'pending') : order.status;
    await db.from('orders').update({ payment_status: 'paid', status, payment_intent_id: String(session.payment_intent || '') }).eq('id', orderId);
  }
  // Pre-order (event QR) just paid → email info@ (once per order; no-op for other orders)
  if (session.metadata?.preorder === '1') await alertPreorderPaid(db, orderId);
  return { paid: true, orderId };
}


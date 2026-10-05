// Who is signed in to the kiosk admin. Works in middleware (edge) and in API routes.
//  • A Supabase account (email/password or Microsoft 365) with a confirmed @levcustom.com email → full access
//  • The admin passcode → full access; the staff passcode → Event admin + Production board only.
//    Passcodes get a signed, httpOnly cookie from /api/auth (12 hours).
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';

export const STAFF_COOKIE = 'lev_kiosk_staff';
export type KioskRole = 'admin' | 'staff';
export type KioskUser = { role: KioskRole; email?: string; via: 'account' | 'passcode' };

const enc = new TextEncoder();
async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.SUPABASE_SERVICE_ROLE_KEY || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('lev-kiosk-staff:' + data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signStaff(role: KioskRole, hours = 12) {
  const body = `${role}.${Date.now() + hours * 3600e3}`;
  return `${body}.${await hmac(body)}`;
}

export async function verifyStaff(token?: string | null): Promise<KioskRole | null> {
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const [role, exp, sig] = token.split('.');
  if ((role !== 'admin' && role !== 'staff') || !(Number(exp) > Date.now()) || !sig) return null;
  const want = await hmac(`${role}.${exp}`);
  if (want.length !== sig.length) return null;
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? role : null;
}

export const isLevAccount = (u: any) => !!u && !!u.email_confirmed_at && String(u.email || '').toLowerCase().endsWith('@levcustom.com');

/** For API routes: the signed-in kiosk admin, or null. */
export async function kioskUser(req: NextRequest): Promise<KioskUser | null> {
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }) as any);
  if (isLevAccount(user)) return { role: 'admin', email: user!.email, via: 'account' };
  const role = await verifyStaff(req.cookies.get(STAFF_COOKIE)?.value);
  return role ? { role, via: 'passcode' } : null;
}

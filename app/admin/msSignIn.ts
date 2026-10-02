import { supabase } from '@/supabase';

// Microsoft 365 sign-in for the kiosk admin, through Supabase Auth's Azure provider (same Lev tenant as the portal).
// The Supabase session works exactly like the email/password one, so every admin page keeps working.
export async function microsoftEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } });
    const s = await res.json();
    return !!s?.external?.azure;
  } catch { return false; }
}

export async function signInWithMicrosoft(next = '/admin/events') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { scopes: 'email openid profile', redirectTo: `${window.location.origin}${next}` },
  });
  if (error) alert('Microsoft sign-in failed: ' + error.message);
}

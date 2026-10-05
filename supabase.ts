import { createBrowserClient } from '@supabase/ssr';

// One shared client for the kiosk admin. The sign-in session is kept in cookies (not localStorage) so the
// server — middleware.ts and the admin API routes — can check who is signed in.
export const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { STAFF_COOKIE, verifyStaff, isLevAccount } from '@/lib/kioskAuth';

// Kiosk admin gate. Signed-in Lev accounts and the admin passcode open everything; the staff passcode opens
// Event admin and the Production board. Admin-only API routes answer 401 instead of redirecting.
const STAFF_PAGES = ['/admin/events', '/admin/production'];
const ADMIN_APIS = ['/api/create-event', '/api/printnode/printers', '/api/printnode/status', '/api/admin/'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith('/api/');
  if (path === '/admin/login') return NextResponse.next();
  // Microsoft 365 sign-in lands on /admin/events?code=… — the page finishes the sign-in itself
  if (path === '/admin/events' && request.nextUrl.searchParams.has('code')) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (isLevAccount(user)) return response;

  const role = await verifyStaff(request.cookies.get(STAFF_COOKIE)?.value);
  const staffOk = !isApi && STAFF_PAGES.some(p => path === p || path.startsWith(p + '/'));
  if (role === 'admin' || (role === 'staff' && (staffOk || path.startsWith('/api/admin/')))) return response;

  if (isApi) return NextResponse.json({ error: 'Sign in to the kiosk admin first' }, { status: 401 });
  const url = new URL('/admin/login', request.url);
  url.searchParams.set('next', path + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/api/create-event', '/api/printnode/printers', '/api/printnode/status', '/api/admin/:path*'],
};

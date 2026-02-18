import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();

  const isLoginPage = req.nextUrl.pathname === '/admin/login';
  const isAdminPath = req.nextUrl.pathname.startsWith('/admin');

  // 1. If not logged in and trying to access any admin page EXCEPT login
  if (!session && isAdminPath && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  // 2. If logged in and trying to access the login page, skip it and go to dashboard
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*'], 
};
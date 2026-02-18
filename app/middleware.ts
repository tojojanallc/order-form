import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Explicitly setting name, value, and spreading options
          request.cookies.set({
            name: name,
            value: value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name: name,
            value: value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          // Explicitly setting name and spreading options
          request.cookies.set({
            name: name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.delete({
            name: name,
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === '/admin/login';
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');

  if (!user && isAdminPath && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
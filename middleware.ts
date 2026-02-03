import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  // Protect game routes - require authentication
  if (request.nextUrl.pathname.startsWith('/lab') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (request.nextUrl.pathname.startsWith('/terminal') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protect panel route - require authentication
  // Additional panel token verification happens in the page component via server action
  if (request.nextUrl.pathname.startsWith('/panel') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-in users away from auth pages
  if (
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/register') &&
    user
  ) {
    return NextResponse.redirect(new URL('/terminal', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

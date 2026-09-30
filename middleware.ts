import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { loginUrlFor, nextOrDefault } from "@/lib/auth/next";
import { isLoopbackHost } from "@/lib/auth/loopback";

export async function middleware(request: NextRequest) {
  // Desktop build: the bundled server answers only to its loopback address
  // (blocks DNS rebinding from web pages the player visits).
  if (process.env.ELECTRON_RUN === "true" && !isLoopbackHost(request.headers.get("host"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { supabaseResponse, user } = await updateSession(request);

  // Protect game routes - require authentication
  if (request.nextUrl.pathname.startsWith("/lab") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Keep where the player wanted to go (whitelisted), so the login inside
  // the Lab World's terminal overlay returns to the embedded terminal.
  const { pathname, search } = request.nextUrl;
  if ((pathname.startsWith("/world") || pathname.startsWith("/terminal")) && !user) {
    return NextResponse.redirect(new URL(loginUrlFor(pathname + search), request.url));
  }

  // Protect panel route - require authentication
  // Additional panel token verification happens in the page component via server action
  if (request.nextUrl.pathname.startsWith("/panel") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Allow /setup without auth (desktop onboarding)
  if (request.nextUrl.pathname === "/setup") {
    return supabaseResponse;
  }

  // Redirect logged-in users away from auth pages
  if ((request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register") && user) {
    const next = nextOrDefault(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

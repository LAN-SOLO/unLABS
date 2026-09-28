import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nextOrDefault } from "@/lib/auth/next";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Whitelisted relative path only (was an open redirect: `?next=@evil.com`).
  const next = nextOrDefault(searchParams.get("next"), "/terminal");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}

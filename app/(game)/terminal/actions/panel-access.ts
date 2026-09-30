"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PANEL_TOKEN_EXPIRY_MS, issuePanelToken, verifyPanelToken } from "@/lib/panel/panelToken";

const PANEL_ACCESS_COOKIE = "panel_access_token";

/**
 * Generate a secure panel access token.
 * This is called when user runs the panel unlock command in terminal.
 * Token is stored in an HTTP-only cookie that can't be manipulated via JS.
 */
export async function grantPanelAccess(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { success: false, error: "Not authenticated" };
  }

  // HMAC-signed token: userId:timestamp:signature. Fails closed when no
  // signing secret (PANEL_TOKEN_SECRET / service-role key) is configured.
  const token = issuePanelToken(user.id);
  if (!token) {
    return { success: false, error: "Panel access is not configured" };
  }

  const cookieStore = await cookies();
  cookieStore.set(PANEL_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: PANEL_TOKEN_EXPIRY_MS / 1000, // seconds
    path: "/",
  });

  return { success: true };
}

/**
 * Verify panel access token.
 * Called by panel page to check if user has valid access.
 */
export async function verifyPanelAccess(): Promise<{ valid: boolean; userId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { valid: false };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(PANEL_ACCESS_COOKIE)?.value;

  if (!token) {
    return { valid: false };
  }

  const check = verifyPanelToken(token, user.id);
  if (!check.valid) {
    // Clean up expired tokens so the cookie doesn't linger.
    if (check.reason === "expired") cookieStore.delete(PANEL_ACCESS_COOKIE);
    return { valid: false };
  }

  return { valid: true, userId: user.id };
}

/**
 * Revoke panel access (called on logout/shutdown).
 */
export async function revokePanelAccess(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PANEL_ACCESS_COOKIE);
}

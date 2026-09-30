import { createHmac } from "crypto";

/**
 * Local operator accounts of the desktop build (server-only).
 *
 * The desktop app has no password prompt: the /setup page lists the local
 * operators and signs in with a password derived from a per-install secret
 * that the Electron main process passes to the Next.js server
 * (`LOCAL_OPERATOR_SECRET`, stored 0600 in userData). Nothing about it is
 * shared between installs, and on the web build these accounts don't exist.
 */

export const LOCAL_OPERATOR_DOMAIN = "unstablelabs.local";

/** Legacy fixed password of builds ≤ 0.3.0 — only used to recognise old accounts. */
export const LEGACY_OPERATOR_PASSWORD = "unstable-local-operator";

/** True inside the desktop app's bundled server (or a local dev server). */
export function isLocalOperatorMode(): boolean {
  return process.env.ELECTRON_RUN === "true" || process.env.NODE_ENV === "development";
}

export function localOperatorEmail(username: string): string {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@${LOCAL_OPERATOR_DOMAIN}`;
}

/**
 * Per-install password for a local operator. Falls back to the legacy
 * password only in development, where no Electron main process provides a
 * secret.
 */
export function localOperatorPassword(email: string): string | null {
  const secret = process.env.LOCAL_OPERATOR_SECRET;
  if (!secret) return process.env.NODE_ENV === "development" ? LEGACY_OPERATOR_PASSWORD : null;
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Safe post-login destinations
 * ============================
 *
 * The login/registration flow accepts a `next` parameter so a player who
 * logs in inside the Lab World's terminal overlay (`/terminal?embed=1` in an
 * iframe) lands back in the terminal instead of in a nested copy of the
 * world. Anything user-controlled that ends up in a redirect is an open
 * redirect waiting to happen, so `next` is whitelisted: relative paths only,
 * only `/terminal` and `/world`, and the only query kept is `embed=1`.
 */

/** Where a login goes when no (valid) `next` was given. */
export const DEFAULT_AFTER_LOGIN = "/world";

/** The terminal as the Lab World overlay embeds it. */
export const EMBED_TERMINAL_PATH = "/terminal?embed=1";

const ALLOWED_PATHS: ReadonlySet<string> = new Set(["/terminal", "/world"]);

/** Dummy origin for parsing — a result on any other origin is rejected. */
const BASE = "http://unlabs.invalid";

/**
 * Normalise a user-supplied `next` value to a whitelisted relative path, or
 * `null` when it is missing, absolute, protocol-relative, malformed or not
 * on the whitelist. The result is rebuilt from parts, never echoed.
 */
export function sanitizeNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // Backslashes and control characters are normalised by browsers into
  // surprising URLs ("/\evil.com") — refuse them outright.
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || c === 0x5c) return null;
  }
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  if (!ALLOWED_PATHS.has(url.pathname)) return null;
  const embed = url.pathname === "/terminal" && url.searchParams.get("embed") === "1";
  return embed ? EMBED_TERMINAL_PATH : url.pathname;
}

/** `sanitizeNext` with the default destination as fallback. */
export function nextOrDefault(raw: unknown, fallback = DEFAULT_AFTER_LOGIN): string {
  return sanitizeNext(raw) ?? fallback;
}

/** True for the embedded terminal destination (login inside the overlay). */
export function isEmbedNext(next: string | null): boolean {
  return next === EMBED_TERMINAL_PATH;
}

/**
 * Login URL that returns to `next` afterwards (plain `/login` without a
 * valid `next`). Used by the middleware and the terminal page.
 */
export function loginUrlFor(next: unknown): string {
  const safe = sanitizeNext(next);
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

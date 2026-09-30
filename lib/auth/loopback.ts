/**
 * Host header check for the desktop server. It listens on 127.0.0.1 only,
 * but a web page can still reach it through DNS rebinding (evil.example
 * resolving to 127.0.0.1) — then the Host header names the foreign domain.
 */
export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return /^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i.test(host.trim());
}

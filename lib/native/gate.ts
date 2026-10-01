/**
 * Desktop-only gate (pure decision + browser probe).
 * ==================================================
 *
 * The game ships as a native app (macOS DMG, Windows installer, Linux
 * Flatpak — docs/NATIVE.md). Builds made with `NEXT_PUBLIC_DESKTOP_ONLY=1`
 * (the desktop build sets it) refuse to run /world and /terminal in a plain
 * browser and show a "download the app" page instead. Development builds
 * leave the flag off, so `pnpm dev` keeps working in the browser.
 *
 * Inside the app the Electron preload exposes `__ELECTRON_CONFIG__` on the
 * main frame. The terminal also runs embedded in an iframe of the world,
 * where the preload does not run — it asks its (same-origin) top frame.
 */
import type { ElectronConfig } from "@/lib/desktop";

/** Build flag: only the desktop app may run the game. */
export const DESKTOP_ONLY = process.env.NEXT_PUBLIC_DESKTOP_ONLY === "1";

export type GateDecision = "play" | "download";

/** What a page shows: the game, or the download page. */
export function nativeGate(desktopOnly: boolean, isDesktop: boolean): GateDecision {
  return !desktopOnly || isDesktop ? "play" : "download";
}

function configOf(w: unknown): ElectronConfig | undefined {
  if (!w || typeof w !== "object") return undefined;
  const c = (w as Record<string, unknown>).__ELECTRON_CONFIG__;
  return c && typeof c === "object" ? (c as ElectronConfig) : undefined;
}

/** Running inside the desktop app (this frame, or the top frame for embedded pages)? */
export function inDesktopShell(w: Window | undefined = globalThis.window): boolean {
  if (!w) return false;
  if (configOf(w)?.isDesktop === true) return true;
  try {
    // Cross-origin tops throw: then we are not inside the app's own frame.
    return w.top !== w && configOf(w.top)?.isDesktop === true;
  } catch {
    return false;
  }
}

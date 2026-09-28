/**
 * Terminal ↔ Lab World overlay protocol
 * =====================================
 *
 * The Lab World opens the big terminal in-game as an overlay: an iframe on
 * `/terminal?embed=1` (same origin, same cookies, same localStorage). Inside
 * the frame the terminal never navigates back to `/world` (that would nest
 * the world in itself) — it asks the parent window to close the overlay.
 *
 * World changes made by terminal commands reach the parent through the
 * existing localStorage event queue (`lib/world/bridge.ts`): `storage`
 * events fire in every other same-origin document, the embedding parent
 * included. The parent absorbs the queue once more on close as a fallback.
 */

import { EMBED_TERMINAL_PATH } from "@/lib/auth/next";

export { EMBED_TERMINAL_PATH };

/** Message type the embedded terminal posts to close the overlay. */
export const CLOSE_TERMINAL_MESSAGE = "unlabs:close-terminal";

export interface CloseTerminalMessage {
  type: typeof CLOSE_TERMINAL_MESSAGE;
}

export function isCloseTerminalMessage(v: unknown): v is CloseTerminalMessage {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).type === CLOSE_TERMINAL_MESSAGE
  );
}

/** True when this document runs inside a frame (the Lab World overlay). */
export function isEmbeddedFrame(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin top: still framed.
    return true;
  }
}

/**
 * Ask the embedding Lab World to close the terminal overlay. Returns false
 * (and does nothing) when not framed, so callers can fall back to a normal
 * navigation.
 */
export function requestCloseTerminal(): boolean {
  if (!isEmbeddedFrame()) return false;
  const msg: CloseTerminalMessage = { type: CLOSE_TERMINAL_MESSAGE };
  window.parent.postMessage(msg, window.location.origin);
  return true;
}

/**
 * Whether a typed command should leave the embedded terminal: `back` always,
 * `exit`/`quit`/`logout` only when there is no switched user to drop back
 * from (the normal `exit` behaviour — `su` back to operator — wins).
 */
export function isEmbedLeaveCommand(
  cmd: string | undefined,
  args: readonly string[],
  userSwitched: boolean,
): boolean {
  if (!cmd || args.length > 0) return false;
  if (cmd === "back") return true;
  return (cmd === "exit" || cmd === "quit" || cmd === "logout") && !userSwitched;
}

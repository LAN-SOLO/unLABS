/**
 * Save sync — debounced bridge between the in-memory game state and Supabase.
 *
 * Call `scheduleSave(payload)` as often as you like; internally it batches
 * writes to at most one per `DEBOUNCE_MS`. `flushSave()` fires immediately
 * (for unload handlers, logout, etc). `cancelScheduledSave()` drops any
 * pending timer (used on provider unmount).
 *
 * This module is intentionally a module-level singleton: there is only ever
 * one player logged in at a time, so there is no need to thread an instance
 * through React context.
 */

import { savePlayerSave, type PlayerSavePayload } from "@/app/(game)/actions/playerSave";

export const DEBOUNCE_MS = 5_000;

let pendingPayload: PlayerSavePayload | null = null;
let timerId: ReturnType<typeof setTimeout> | null = null;
let inflight = false;

async function fire(): Promise<void> {
  if (!pendingPayload || inflight) return;
  const payload = pendingPayload;
  pendingPayload = null;
  inflight = true;
  try {
    const result = await savePlayerSave(payload);
    if (!result.ok && process.env.NODE_ENV !== "production") {
      // Log but don't throw — a failed save should not crash the game loop.
      console.warn("[saveSync] save failed:", result.error);
    }
  } finally {
    inflight = false;
    // If another payload arrived while we were saving, chain another write.
    if (pendingPayload) {
      scheduleSave(pendingPayload);
    }
  }
}

export function scheduleSave(payload: PlayerSavePayload): void {
  pendingPayload = payload;
  if (timerId) return;
  timerId = setTimeout(() => {
    timerId = null;
    void fire();
  }, DEBOUNCE_MS);
}

export async function flushSave(): Promise<void> {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  await fire();
}

export function cancelScheduledSave(): void {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  pendingPayload = null;
}

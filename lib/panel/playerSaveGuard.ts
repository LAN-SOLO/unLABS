/**
 * Server-side validation for `savePlayerSave` payloads.
 *
 * - The blob must be a plain JSON object no larger than
 *   `PLAYER_SAVE_MAX_BYTES` once serialized (UTF-8).
 * - `lastTickAt` must be a finite, positive epoch-ms number; values in
 *   the future are clamped to `now` so offline catch-up can't be inflated.
 */

export const PLAYER_SAVE_MAX_BYTES = 2 * 1024 * 1024;

export type PlayerSaveGuardResult =
  | { ok: true; data: Record<string, unknown>; lastTickAt: number }
  | { ok: false; error: "invalid_payload" | "save_too_large" | "invalid_last_tick_at" };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function guardPlayerSave(
  payload: unknown,
  nowMs: number = Date.now(),
): PlayerSaveGuardResult {
  if (!isPlainObject(payload) || !isPlainObject(payload.data)) {
    return { ok: false, error: "invalid_payload" };
  }

  const rawTick = payload.lastTickAt;
  if (typeof rawTick !== "number" || !Number.isFinite(rawTick) || rawTick <= 0) {
    return { ok: false, error: "invalid_last_tick_at" };
  }
  const lastTickAt = Math.min(rawTick, nowMs);

  let serialized: string;
  try {
    serialized = JSON.stringify(payload.data);
  } catch {
    return { ok: false, error: "invalid_payload" };
  }
  if (Buffer.byteLength(serialized, "utf8") > PLAYER_SAVE_MAX_BYTES) {
    return { ok: false, error: "save_too_large" };
  }

  return { ok: true, data: payload.data, lastTickAt };
}

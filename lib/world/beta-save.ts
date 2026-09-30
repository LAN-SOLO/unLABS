/**
 * Lab World — beta-save links.
 * ============================
 *
 * The _unLABS Beta Lab (save generator in ../unlabsundevbook) opens
 * `/world#beta-save=<code>` in the browser so a tester can jump to any point
 * of the game. `<code>` is either
 *   - the normal import code (base64 envelope, as `exportSave` writes it), or
 *   - `gz.<base64url>` — the same envelope JSON, gzip-compressed (keeps long
 *     saves well inside URL limits).
 *
 * Safety: a link must never overwrite a save silently. LabWorld reads the
 * fragment once, removes it from the address bar right away and only imports
 * after the player confirmed a slot in a dialog (the target slot's previous
 * save is kept as a restorable backup, see save.ts `backupSlot`).
 *
 * Pure apart from `DecompressionStream` (no storage, no DOM access).
 */
import { tr } from "@/lib/i18n";
import { MAX_IMPORT, computeMeta, parseImport, type SlotMeta } from "@/lib/world/save";
import type { WorldState } from "@/lib/world/types";

export const BETA_SAVE_PARAM = "beta-save";
/** Prefix of a gzip-compressed code. */
export const GZ_PREFIX = "gz.";
/** Largest fragment value accepted (characters, before decoding). */
export const MAX_BETA_LINK = 4_000_000;

/**
 * The raw `beta-save` value of a location hash (`#beta-save=…`, also as one
 * of several `&`-separated parameters), URL-decoded; null when absent.
 * An empty value counts as present ("" → the dialog reports "no code").
 */
export function readBetaSaveHash(hash: string): string | null {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!body) return null;
  for (const part of body.split("&")) {
    const eq = part.indexOf("=");
    const key = eq < 0 ? part : part.slice(0, eq);
    if (key !== BETA_SAVE_PARAM) continue;
    const value = eq < 0 ? "" : part.slice(eq + 1);
    if (value.length > MAX_BETA_LINK) return value; // rejected later as too large (not decoded)
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** The hash without the `beta-save` parameter ("" when nothing else remains). */
export function stripBetaSaveHash(hash: string): string {
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  const rest = body
    .split("&")
    .filter((p) => p && (p.indexOf("=") < 0 ? p : p.slice(0, p.indexOf("="))) !== BETA_SAVE_PARAM);
  return rest.length ? `#${rest.join("&")}` : "";
}

function base64UrlToBytes(b64url: string): Uint8Array | null {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) return null;
  try {
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Gunzip with a hard output cap (a tiny link must not inflate into gigabytes). */
async function gunzipCapped(
  bytes: Uint8Array,
  maxChars: number,
): Promise<string | "too-large" | null> {
  if (typeof DecompressionStream === "undefined") return null;
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new TextDecoderStream());
    const reader = stream.getReader();
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += value;
      if (out.length > maxChars) {
        await reader.cancel();
        return "too-large";
      }
    }
    return out;
  } catch {
    return null;
  }
}

/** sessionStorage key: a beta-save code parked while the player logs in. */
export const PENDING_BETA_SAVE_KEY = "unlabs.betaSave.pending";
/** Parked codes older than this are dropped (ms). */
export const PENDING_BETA_SAVE_TTL = 10 * 60 * 1000;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The login page receives `/login?next=/world#beta-save=…` (browsers keep the
 * fragment across the auth redirect) but its server-action redirect drops it.
 * Park the code for this tab only; the Lab World picks it up after login and
 * still asks before importing anything.
 */
export function parkBetaSave(code: string, store: StorageLike, now = Date.now()): void {
  if (code.length > MAX_BETA_LINK) return;
  try {
    store.setItem(PENDING_BETA_SAVE_KEY, JSON.stringify({ code, at: now }));
  } catch {
    // storage full or blocked — the tester can reopen the link after login
  }
}

/** Take (and remove) a parked code if it is still fresh. */
export function takeParkedBetaSave(store: StorageLike, now = Date.now()): string | null {
  let raw: string | null = null;
  try {
    raw = store.getItem(PENDING_BETA_SAVE_KEY);
    store.removeItem(PENDING_BETA_SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    const { code, at } = v as { code?: unknown; at?: unknown };
    if (typeof code !== "string" || typeof at !== "number") return null;
    if (now - at > PENDING_BETA_SAVE_TTL || at > now) return null;
    return code;
  } catch {
    return null;
  }
}

export type DecodedBetaSave = { ok: true; text: string } | { ok: false; error: string };

/**
 * Turn a link code into the text `parseImport` / `importSave` accept.
 * Uses the game's existing import error texts.
 */
export async function decodeBetaSave(code: string): Promise<DecodedBetaSave> {
  const c = code.trim();
  if (!c) return { ok: false, error: tr("No save code entered.") };
  if (c.length > MAX_BETA_LINK) return { ok: false, error: tr("Save code is too large.") };
  if (!c.startsWith(GZ_PREFIX)) return { ok: true, text: c };
  const bytes = base64UrlToBytes(c.slice(GZ_PREFIX.length));
  if (!bytes) return { ok: false, error: tr("Save code is damaged or incomplete.") };
  const text = await gunzipCapped(bytes, MAX_IMPORT);
  if (text === "too-large") return { ok: false, error: tr("Save code is too large.") };
  if (text === null) return { ok: false, error: tr("Save code is damaged or incomplete.") };
  return { ok: true, text };
}

export type BetaSavePreview =
  | {
      ok: true;
      /** Text to hand to `importSave` after confirmation. */
      text: string;
      state: WorldState;
      meta: SlotMeta;
      repaired: number;
    }
  | { ok: false; error: string };

/** Decode + validate a link code for the confirmation dialog (no storage access). */
export async function previewBetaSave(code: string): Promise<BetaSavePreview> {
  const d = await decodeBetaSave(code);
  if (!d.ok) return d;
  const p = parseImport(d.text);
  if (!p.ok) return p;
  return {
    ok: true,
    text: d.text,
    state: p.state,
    meta: computeMeta(p.state, p.label),
    repaired: p.repaired,
  };
}

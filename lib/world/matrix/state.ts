/**
 * Matrix state: the empty state and save sanitising (pure, no game imports —
 * game.ts and save-sanitize.ts use it without an import cycle).
 */
import type { MatrixField, MatrixState } from "@/lib/world/types";
import { SLICE_POSITIONS, tokenById } from "@/lib/world/matrix/archive";
import { indexOf } from "@/lib/world/matrix/history";

/** Map prop of the chamber (content/map.ts, Control Room). */
export const MATRIX_PROP = "matrix_chamber";

export const HOUR = 3_600_000;
/** Extraction time: random in [MIN, MAX] hours of real time. */
export const MIN_HOURS = 2;
export const MAX_HOURS = 24;

const FIELDS: readonly number[] = [1, 2, 3, 4, 5];

export function initialMatrix(): MatrixState {
  return { job: null, slices: [], crystals: [], next: 1 };
}

// ── Save robustness ──────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const isField = (v: unknown): v is MatrixField => typeof v === "number" && FIELDS.includes(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Rebuild a Matrix state from untrusted save data (never throws). */
export function sanitizeMatrix(raw: unknown): MatrixState {
  const out = initialMatrix();
  if (!isRecord(raw)) return out;
  if (finite(raw.next) && raw.next >= 1) out.next = Math.floor(raw.next);
  const j = raw.job;
  if (
    isRecord(j) &&
    finite(j.start) &&
    finite(j.end) &&
    j.end >= j.start &&
    j.end - j.start <= MAX_HOURS * HOUR + 1000 &&
    isField(j.field) &&
    typeof j.day === "string" &&
    indexOf(j.day) >= 0 &&
    finite(j.seed)
  )
    out.job = { start: j.start, end: j.end, field: j.field, day: j.day, seed: j.seed >>> 0 };
  const uids = new Set<string>();
  if (Array.isArray(raw.slices))
    for (const x of raw.slices) {
      if (
        !isRecord(x) ||
        typeof x.uid !== "string" ||
        uids.has(x.uid) ||
        !finite(x.token) ||
        !tokenById(x.token) ||
        !finite(x.pos) ||
        x.pos < 1 ||
        x.pos > SLICE_POSITIONS ||
        !finite(x.at) ||
        typeof x.day !== "string" ||
        !isField(x.field)
      )
        continue;
      uids.add(x.uid);
      out.slices.push({
        uid: x.uid,
        token: x.token,
        pos: Math.floor(x.pos),
        at: x.at,
        day: x.day,
        field: x.field,
      });
    }
  const placed = new Set<string>();
  if (Array.isArray(raw.crystals))
    for (const c of raw.crystals) {
      if (!isRecord(c) || typeof c.id !== "string" || !Array.isArray(c.slots)) continue;
      const slots: (string | null)[] = [];
      for (let i = 0; i < SLICE_POSITIONS; i++) {
        const u = c.slots[i];
        // A slice belongs to at most one crystal; unknown slices drop out.
        if (typeof u === "string" && uids.has(u) && !placed.has(u)) {
          placed.add(u);
          slots.push(u);
        } else slots.push(null);
      }
      if (!slots.some(Boolean)) continue;
      out.crystals.push({
        id: c.id,
        name: typeof c.name === "string" ? c.name.slice(0, 40) : "",
        slots,
        at: finite(c.at) ? c.at : 0,
      });
    }
  return out;
}

/**
 * Root lab state (docs/ROOT-LAB.md): what the terminal changed in the
 * lab's system — access ring, sysctl values, firmware clock/voltage per
 * device, cron jobs, saved profiles and the audit trail. Part of the save
 * (`WorldState.root`, save v10). Pure and game-free (no imports from
 * game.ts), so the sanitiser can use it without import cycles.
 */

/** Access rings: 0 operator · 1 wheel (sudo) · 2 root · 3 kernel (ring 0). */
export type Ring = 0 | 1 | 2 | 3;

export interface FwTune {
  /** Core clock in % of the rated clock. */
  clock: number;
  /** Core voltage in % of the rated voltage. */
  volt: number;
}

export interface CronJob {
  id: number;
  /** Seconds between runs. */
  every: number;
  /** Command line run in a root shell (`;` chains). */
  cmd: string;
  /** Ring the job was created with (it never runs higher). */
  ring: Ring;
  /** Play-time seconds of the last run (−1 = never). */
  last: number;
}

export interface RootProfile {
  sysctl: Record<string, number>;
  fw: Record<string, FwTune>;
}

export interface AuditEntry {
  /** Play time (s). */
  t: number;
  /** Where it came from: a terminal id, "cron" or "console". */
  via: string;
  what: string;
}

export interface RootState {
  ring: Ring;
  /** Tunables set away from their defaults (key → value). */
  sysctl: Record<string, number>;
  /** Firmware tuning per device id (absent = rated 100 / 100). */
  fw: Record<string, FwTune>;
  cron: CronJob[];
  nextCron: number;
  profiles: Record<string, RootProfile>;
  audit: AuditEntry[];
}

export const MAX_CRON = 8;
export const MIN_CRON_EVERY = 10;
export const MAX_PROFILES = 6;
export const MAX_AUDIT = 60;
export const MAX_CMD = 200;

export function initialRoot(): RootState {
  return { ring: 0, sysctl: {}, fw: {}, cron: [], nextCron: 1, profiles: {}, audit: [] };
}

const num = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

const KEY = /^[a-z][a-z0-9_.]{0,47}$/;
const DEVICE = /^[A-Z0-9]{2,4}-[0-9]{2,3}$/;
const NAME = /^[a-z0-9_-]{1,24}$/;

function sanitizeSysctl(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof v !== "object" || v === null) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>))
    if (KEY.test(k) && typeof x === "number" && Number.isFinite(x)) out[k] = x;
  return out;
}

function sanitizeFw(v: unknown): Record<string, FwTune> {
  const out: Record<string, FwTune> = {};
  if (typeof v !== "object" || v === null) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (!DEVICE.test(k) || typeof x !== "object" || x === null) continue;
    const r = x as Record<string, unknown>;
    out[k] = { clock: num(r.clock, 10, 200, 100), volt: num(r.volt, 50, 150, 100) };
  }
  return out;
}

/** Never throws: anything malformed falls back to the defaults. */
export function sanitizeRoot(v: unknown): RootState {
  const base = initialRoot();
  if (typeof v !== "object" || v === null) return base;
  const r = v as Record<string, unknown>;
  const ring = num(r.ring, 0, 3, 0);
  const cron: CronJob[] = [];
  if (Array.isArray(r.cron))
    for (const j of r.cron.slice(0, MAX_CRON)) {
      if (typeof j !== "object" || j === null) continue;
      const o = j as Record<string, unknown>;
      if (typeof o.cmd !== "string" || !o.cmd.trim()) continue;
      cron.push({
        id: Math.round(num(o.id, 1, 1e6, cron.length + 1)),
        every: Math.round(num(o.every, MIN_CRON_EVERY, 86400, 60)),
        cmd: o.cmd.slice(0, MAX_CMD),
        ring: Math.round(num(o.ring, 0, 3, 0)) as Ring,
        last: num(o.last, -1, 1e12, -1),
      });
    }
  const profiles: Record<string, RootProfile> = {};
  if (typeof r.profiles === "object" && r.profiles !== null)
    for (const [k, p] of Object.entries(r.profiles as Record<string, unknown>).slice(
      0,
      MAX_PROFILES,
    )) {
      if (!NAME.test(k) || typeof p !== "object" || p === null) continue;
      const o = p as Record<string, unknown>;
      profiles[k] = { sysctl: sanitizeSysctl(o.sysctl), fw: sanitizeFw(o.fw) };
    }
  const audit: AuditEntry[] = [];
  if (Array.isArray(r.audit))
    for (const a of r.audit.slice(-MAX_AUDIT)) {
      if (typeof a !== "object" || a === null) continue;
      const o = a as Record<string, unknown>;
      if (typeof o.what !== "string" || typeof o.via !== "string") continue;
      audit.push({ t: num(o.t, 0, 1e12, 0), via: o.via.slice(0, 32), what: o.what.slice(0, 160) });
    }
  return {
    ring: Math.round(ring) as Ring,
    sysctl: sanitizeSysctl(r.sysctl),
    fw: sanitizeFw(r.fw),
    cron,
    nextCron: Math.round(
      num(
        r.nextCron,
        1,
        1e6,
        cron.reduce((m, j) => Math.max(m, j.id + 1), 1),
      ),
    ),
    profiles,
    audit,
  };
}

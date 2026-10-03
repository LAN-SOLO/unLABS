/**
 * Root lab model (docs/ROOT-LAB.md): what tunables and firmware tuning do
 * to the game, and how root operations change the state. Pure; game.ts
 * reads it from `power()` and the cycle timers, so it must not import game.
 *
 * Firmware: every device runs at `clock` % of its rated clock and `volt` %
 * of its rated voltage (100 / 100 = as built).
 * - draw ×  clock · volt²       (consumers; eco profiles save power)
 * - output × clock              (generators)
 * - heat  =  clock · volt       must stay under the thermal limit:
 *   1.20 on its own, 1.50 × THM-001's clock when linked to a running THM-001
 * - stable while clock ≤ volt² — an undervolted core browns out
 * Benefits beyond watts: a faster AIC-001 shortens the research cycle, a
 * faster EXD-001 the drone turnaround, a faster THM-001 cools more.
 * Costs beyond watts: below `FEATURE_CLOCK` a device drops its firmware
 * update features (firmware.ts `hasFeature`), and every tuned device adds
 * `GOVERNOR_W` of kernel load (the governor that holds its curve).
 */
import type { WorldState } from "@/lib/world/types";
import type { FwTune, Ring, RootProfile, RootState } from "@/lib/world/root/state";
import { MAX_AUDIT, MAX_CRON, MAX_PROFILES } from "@/lib/world/root/state";
import { TUNABLE_BY_KEY, TUNABLES } from "@/lib/world/root/tunables";

export const RING_NAMES: Record<Ring, string> = {
  0: "operator",
  1: "wheel",
  2: "root",
  3: "kernel",
};

const RATED: FwTune = { clock: 100, volt: 100 };

/** Firmware tuning ranges per ring (rings below root may not tune). */
export function fwRange(ring: Ring): { clock: [number, number]; volt: [number, number] } {
  return ring >= 3 ? { clock: [25, 160], volt: [70, 130] } : { clock: [50, 130], volt: [85, 115] };
}

/** Named firmware profiles (`fw <id> profile <name>`). */
export const FW_PROFILES: Record<string, FwTune & { ring: Ring }> = {
  eco: { clock: 80, volt: 92, ring: 2 },
  balanced: { clock: 100, volt: 100, ring: 2 },
  turbo: { clock: 120, volt: 110, ring: 2 },
  overdrive: { clock: 145, volt: 122, ring: 3 },
};

export const UNCOOLED_LIMIT = 1.2;
/** Below this clock (%) a device's firmware update features switch off. */
export const FEATURE_CLOCK = 90;
/** Kernel load (W) per tuned device. */
export const GOVERNOR_W = 0.4;
/** The MCP's own core is not tunable (it runs the shell you tune with). */
export const UNTUNABLE: readonly string[] = ["MCP-000"];
export const COOLED_LIMIT = 1.5;

/** A tunable's value in this save (its default when unset or unknown). */
export function tun(s: WorldState, key: string): number {
  const t = TUNABLE_BY_KEY.get(key);
  const v = s.root?.sysctl[key];
  return v === undefined ? (t?.def ?? 0) : v;
}

/** Watts the kernel draws for every tunable pushed past its default. */
export function kernelLoad(s: WorldState): number {
  let w = 0;
  for (const t of TUNABLES) {
    const v = s.root?.sysctl[t.key];
    if (v !== undefined) w += t.cost(v);
  }
  for (const id of Object.keys(s.root?.fw ?? {})) if (isTuned(s, id)) w += GOVERNOR_W;
  return Math.round(w * 10) / 10;
}

export function fwOf(s: WorldState, id: string): FwTune {
  return s.root?.fw[id] ?? RATED;
}

export function isTuned(s: WorldState, id: string): boolean {
  const f = s.root?.fw[id];
  return !!f && (f.clock !== 100 || f.volt !== 100);
}

export function drawFactor(f: FwTune): number {
  return (f.clock / 100) * (f.volt / 100) ** 2;
}

export function heatOf(f: FwTune): number {
  return (f.clock / 100) * (f.volt / 100);
}

/** Clock the voltage carries: above it the core browns out. */
export function stableClock(f: FwTune): number {
  return 100 * (f.volt / 100) ** 2;
}

export function isStable(f: FwTune): boolean {
  return f.clock <= stableClock(f) + 0.5;
}

/** Thermal limit of a device (cooled = linked to a running THM-001). */
export function thermalLimit(s: WorldState, cooled: boolean): number {
  return cooled ? COOLED_LIMIT * (fwOf(s, "THM-001").clock / 100) : UNCOOLED_LIMIT;
}

/** Why a tuned device cannot run: browned out (unstable) or too hot; null = fine. */
export function fwFault(s: WorldState, id: string, cooled: boolean): "unstable" | "hot" | null {
  const f = fwOf(s, id);
  if (f.clock === 100 && f.volt === 100) return null;
  if (!isStable(f)) return "unstable";
  if (heatOf(f) > thermalLimit(s, cooled) + 1e-9) return "hot";
  return null;
}

/** Clock factor of a machine that speeds up a cycle (only while it runs). */
export function clockFactor(s: WorldState, id: string): number {
  return fwOf(s, id).clock / 100;
}

/** Key part for the power cache: everything root changes that `power()` reads. */
export function rootPowerKey(s: WorldState): string {
  const r = s.root;
  if (!r) return "";
  return `${JSON.stringify(r.sysctl)}|${JSON.stringify(r.fw)}`;
}

// ── Operations (what root commands change) ───────────────────────

export type RootOp =
  | { op: "sysctl"; key: string; value: number }
  | { op: "sysctl-reset"; key: string }
  | { op: "fw"; id: string; clock: number; volt: number }
  | { op: "fw-reset"; id: string }
  | { op: "factory" }
  | { op: "ring"; ring: Ring }
  | { op: "cron-add"; id: number; every: number; cmd: string; ring: Ring }
  | { op: "cron-rm"; id: number }
  | { op: "profile-save"; name: string }
  | { op: "profile-load"; name: string }
  | { op: "profile-put"; name: string; profile: RootProfile }
  | { op: "profile-rm"; name: string };

function audit(r: RootState, t: number, via: string, what: string): void {
  r.audit.push({ t, via, what });
  if (r.audit.length > MAX_AUDIT) r.audit.splice(0, r.audit.length - MAX_AUDIT);
}

/**
 * Apply one operation (validated by the shell before; idempotent so a
 * replayed terminal event changes nothing twice). Returns a short
 * description for the audit trail, or null when nothing changed.
 */
export function applyRootOp(s: WorldState, op: RootOp, via: string): string | null {
  const r = s.root;
  let what: string | null = null;
  switch (op.op) {
    case "sysctl": {
      const t = TUNABLE_BY_KEY.get(op.key);
      if (!t) return null;
      if (op.value === t.def) {
        if (!(op.key in r.sysctl)) return null;
        delete r.sysctl[op.key];
      } else {
        if (r.sysctl[op.key] === op.value) return null;
        r.sysctl[op.key] = op.value;
      }
      what = `sysctl ${op.key}=${op.value}`;
      break;
    }
    case "sysctl-reset":
      if (!(op.key in r.sysctl)) return null;
      delete r.sysctl[op.key];
      what = `sysctl ${op.key} reset`;
      break;
    case "fw": {
      const cur = r.fw[op.id];
      if (op.clock === 100 && op.volt === 100) {
        if (!cur) return null;
        delete r.fw[op.id];
      } else {
        if (cur && cur.clock === op.clock && cur.volt === op.volt) return null;
        r.fw[op.id] = { clock: op.clock, volt: op.volt };
      }
      what = `fw ${op.id} clock=${op.clock} volt=${op.volt}`;
      break;
    }
    case "fw-reset":
      if (!r.fw[op.id]) return null;
      delete r.fw[op.id];
      what = `fw ${op.id} reset`;
      break;
    case "factory":
      if (!Object.keys(r.sysctl).length && !Object.keys(r.fw).length) return null;
      r.sysctl = {};
      r.fw = {};
      what = "factory reset (sysctl + fw)";
      break;
    case "ring":
      if (r.ring === op.ring) return null;
      r.ring = op.ring;
      what = `ring ${RING_NAMES[op.ring]}`;
      break;
    case "cron-add":
      if (r.cron.some((j) => j.id === op.id) || r.cron.length >= MAX_CRON) return null;
      r.cron.push({ id: op.id, every: op.every, cmd: op.cmd, ring: op.ring, last: s.playTime });
      r.nextCron = Math.max(r.nextCron, op.id + 1);
      what = `cron +${op.id} every ${op.every}s: ${op.cmd}`;
      break;
    case "cron-rm": {
      const i = r.cron.findIndex((j) => j.id === op.id);
      if (i < 0) return null;
      r.cron.splice(i, 1);
      what = `cron -${op.id}`;
      break;
    }
    case "profile-save": {
      const p: RootProfile = { sysctl: { ...r.sysctl }, fw: structuredClone(r.fw) };
      if (!r.profiles[op.name] && Object.keys(r.profiles).length >= MAX_PROFILES) return null;
      r.profiles[op.name] = p;
      what = `profile save ${op.name}`;
      break;
    }
    case "profile-put": {
      if (!r.profiles[op.name] && Object.keys(r.profiles).length >= MAX_PROFILES) return null;
      r.profiles[op.name] = {
        sysctl: { ...op.profile.sysctl },
        fw: structuredClone(op.profile.fw),
      };
      what = `profile import ${op.name}`;
      break;
    }
    case "profile-load": {
      const p = r.profiles[op.name];
      if (!p) return null;
      r.sysctl = { ...p.sysctl };
      r.fw = structuredClone(p.fw);
      what = `profile load ${op.name}`;
      break;
    }
    case "profile-rm":
      if (!r.profiles[op.name]) return null;
      delete r.profiles[op.name];
      what = `profile rm ${op.name}`;
      break;
  }
  if (what) audit(r, s.playTime, via, what);
  return what;
}

/** Cron jobs due at play time `now` (oldest first). */
export function dueJobs(s: WorldState, now: number): number[] {
  return (s.root?.cron ?? []).filter((j) => now - j.last >= j.every).map((j) => j.id);
}

export { MAX_CRON, MAX_PROFILES };

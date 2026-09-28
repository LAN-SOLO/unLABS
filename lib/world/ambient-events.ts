/**
 * Lab World — ambient environmental events.
 * =========================================
 *
 * Small things that make the lab feel alive: flickering lamps, sparks at
 * starved devices, steam bursts, drips, hum surges, PA crackle, distant
 * rumble, monitor glitches and rift shimmer. Pure and stateless: time is
 * cut into `SLOT` second slots per room, and a hash of (room, slot) decides
 * whether that slot holds an event, which kind, where and when. Because an
 * event may only fall in the first `WINDOW` seconds of its slot, two events
 * in the same room are always ≥ `SLOT - WINDOW` (= 4 s) apart.
 *
 * Rates depend on the room theme and the power state: brownouts add sparks
 * and flickers, overheating adds steam, geothermal rooms rumble and steam,
 * server rooms hum, anomalies shimmer (more with DIM-001 online), the shaft
 * (floor −4) drips and trickles. Electrical events (flicker, spark, hum,
 * glitch, PA) never happen in rooms without power.
 */
import type { SfxName } from "@/lib/world/audio/sfx";
import { DEVICES } from "@/lib/world/content/devices";
import { ROOMS } from "@/lib/world/content/map";
import { isBuilt, power, type PowerStatus } from "@/lib/world/game";
import type { FxKind } from "@/lib/world/render/fx";
import type { FloorId, RoomDef, RoomTheme, WorldState } from "@/lib/world/types";

export const AMBIENT_EVENT_KINDS = [
  "lamp_flicker",
  "spark",
  "steam_burst",
  "drip",
  "hum_surge",
  "pa_crackle",
  "distant_rumble",
  "monitor_glitch",
  "rift_shimmer",
] as const;
export type AmbientEventKind = (typeof AMBIENT_EVENT_KINDS)[number];

export interface AmbientEvent {
  kind: AmbientEventKind;
  room: string;
  /** Scheduled play-clock time (seconds). */
  at: number;
  /** World position (voxel coords on the current floor). */
  pos?: [number, number, number];
  fx?: FxKind;
  /** FxOptions.scale for `fx`. */
  fxScale?: number;
  sfx?: SfxName;
  /** Gain for `sfx` (already reduced for rooms other than the player's). */
  gain?: number;
  /** Camera shake amount (distant_rumble only). */
  shake?: number;
  /** Seconds the effect lasts (lamp_flicker: how long the lights stutter). */
  duration: number;
  /** True when the event is in the player's room. */
  near: boolean;
}

/** Slot length in seconds. */
export const SLOT = 8;
/** Events fall in the first `WINDOW` seconds of a slot → min gap SLOT − WINDOW. */
export const WINDOW = 4;
/** Probability multiplier for rooms other than the player's. */
export const FAR_FACTOR = 0.25;

const ELECTRIC: ReadonlySet<AmbientEventKind> = new Set([
  "lamp_flicker",
  "spark",
  "hum_surge",
  "monitor_glitch",
  "pa_crackle",
]);

type Weights = Partial<Record<AmbientEventKind, number>>;

/** Base kind weights per theme (before power adjustments). */
export const THEME_WEIGHTS: Record<RoomTheme, Weights> = {
  control: { monitor_glitch: 2, lamp_flicker: 1, pa_crackle: 1 },
  server: { hum_surge: 3, monitor_glitch: 2, lamp_flicker: 1 },
  office: { monitor_glitch: 1, lamp_flicker: 1, pa_crackle: 1 },
  corridor: { lamp_flicker: 2, pa_crackle: 2, drip: 1 },
  workshop: { spark: 2, lamp_flicker: 1, steam_burst: 0.5 },
  archive: { lamp_flicker: 1, monitor_glitch: 1, drip: 0.5 },
  airlock: { steam_burst: 1.5, pa_crackle: 1 },
  elevator: { distant_rumble: 1, drip: 1, pa_crackle: 1 },
  geothermal: { distant_rumble: 3, steam_burst: 3, drip: 1 },
  power: { spark: 2, hum_surge: 2 },
  cooling: { steam_burst: 2, drip: 2, hum_surge: 1 },
  factory: { spark: 2, steam_burst: 1, lamp_flicker: 1 },
  storage: { drip: 1, lamp_flicker: 1 },
  audio: { pa_crackle: 2, hum_surge: 1, monitor_glitch: 1 },
  anomaly: { rift_shimmer: 4, hum_surge: 1 },
  lab: { monitor_glitch: 2, spark: 1 },
  hangar: { distant_rumble: 1, lamp_flicker: 1, drip: 1 },
  vault: { hum_surge: 1, drip: 1 },
  botdepot: { spark: 1, monitor_glitch: 1 },
  forge: { spark: 2, steam_burst: 1, hum_surge: 1 },
  reactor: { hum_surge: 3, distant_rumble: 1, steam_burst: 1 },
  containment: { rift_shimmer: 2, hum_surge: 2 },
  portal: { rift_shimmer: 2, hum_surge: 2 },
  cryo: { steam_burst: 2, hum_surge: 1 },
  quarters: { lamp_flicker: 1, drip: 1, pa_crackle: 1 },
  greenhouse: { drip: 3 },
  observatory: { monitor_glitch: 1, lamp_flicker: 1 },
  generic: { lamp_flicker: 1 },
};

/** Chance that a slot holds an event (player's room). */
export const BASE_RATE = 0.2;
export const BROWNOUT_RATE = 0.5;

interface Presentation {
  fx?: FxKind;
  fxScale?: number;
  sfx?: SfxName;
  gain: number;
  y: number;
  duration: [number, number];
}

const PRESENT: Record<AmbientEventKind, Presentation> = {
  lamp_flicker: { sfx: "lamp_buzz", gain: 0.3, y: 7, duration: [0.3, 1.2] },
  spark: {
    fx: "sparks",
    fxScale: 0.5,
    sfx: "spark_crackle",
    gain: 0.35,
    y: 2.5,
    duration: [0.4, 0.4],
  },
  steam_burst: {
    fx: "steam",
    fxScale: 0.8,
    sfx: "steam_hiss",
    gain: 0.3,
    y: 1.5,
    duration: [1.5, 3],
  },
  drip: {
    fx: "footstep_dust",
    fxScale: 0.3,
    sfx: "drip",
    gain: 0.25,
    y: 1.05,
    duration: [0.3, 0.3],
  },
  hum_surge: {
    fx: "power_wave",
    fxScale: 0.4,
    sfx: "hum_surge",
    gain: 0.2,
    y: 1.5,
    duration: [1, 2],
  },
  pa_crackle: { sfx: "radio_tune", gain: 0.12, y: 6.5, duration: [0.6, 1.2] },
  distant_rumble: {
    fx: "dust",
    fxScale: 0.7,
    sfx: "rumble",
    gain: 0.3,
    y: 6,
    duration: [1.5, 2.5],
  },
  monitor_glitch: { sfx: "anomaly_zap", gain: 0.12, y: 2, duration: [0.2, 0.8] },
  rift_shimmer: {
    fx: "rift_pulse",
    fxScale: 0.5,
    sfx: "rift",
    gain: 0.15,
    y: 2.5,
    duration: [1.5, 3],
  },
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEVICES_BY_ROOM: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const d of DEVICES) m.set(d.room, [...(m.get(d.room) ?? []), d.id]);
  return m;
})();

/** Is the room lit (same rule as the engine's room lights)? */
export function roomPowered(p: PowerStatus, r: RoomDef): boolean {
  return p.generation >= 50 && (!r.litBy || p.online.has(r.litBy));
}

export interface RoomProfile {
  /** Chance per slot (player's room). */
  rate: number;
  weights: Weights;
}

/** Event mix for one room in the current state. */
export function roomProfile(s: WorldState, r: RoomDef, p: PowerStatus = power(s)): RoomProfile {
  const w: Weights = { ...THEME_WEIGHTS[r.theme ?? "generic"] };
  const lit = roomPowered(p, r);
  const here = DEVICES_BY_ROOM.get(r.id) ?? [];
  const starvedHere = p.starved.filter((x) => here.includes(x.id));
  const brownHere = starvedHere.some((x) => x.reason === "strom");
  const hotHere = starvedHere.some((x) => x.reason === "hitze");
  const brownAny = p.starved.some((x) => x.reason === "strom");
  let rate = BASE_RATE;

  if (r.floor === 5) {
    w.drip = (w.drip ?? 0) + 2;
    w.distant_rumble = (w.distant_rumble ?? 0) + 1.5;
  }
  if (r.theme === "anomaly" || r.theme === "portal" || r.theme === "containment") {
    if (isBuilt(s, "DIM-001") && p.online.has("DIM-001")) {
      w.rift_shimmer = (w.rift_shimmer ?? 0) * 2;
      rate += 0.1;
    }
  }
  if (brownAny && lit) w.lamp_flicker = (w.lamp_flicker ?? 0) + 2;
  if (brownHere) {
    w.spark = (w.spark ?? 0) + 3;
    w.lamp_flicker = (w.lamp_flicker ?? 0) + 2;
    rate = BROWNOUT_RATE;
  }
  if (hotHere) {
    w.steam_burst = (w.steam_burst ?? 0) + 3;
    w.spark = (w.spark ?? 0) + 1;
    rate = BROWNOUT_RATE;
  }

  if (!lit) {
    for (const k of AMBIENT_EVENT_KINDS) {
      // Sparks still fly from starved devices while any current flows.
      if (k === "spark" && brownHere && p.generation > 0) continue;
      if (ELECTRIC.has(k)) delete w[k];
    }
    // Cooling steam needs the machines; geothermal steam does not.
    if (r.theme === "cooling" && !hotHere) delete w.steam_burst;
    rate *= 0.6;
  }
  return { rate, weights: w };
}

function pickKind(weights: Weights, x: number): AmbientEventKind | null {
  let total = 0;
  for (const k of AMBIENT_EVENT_KINDS) total += weights[k] ?? 0;
  if (total <= 0) return null;
  let pick = x * total;
  for (const k of AMBIENT_EVENT_KINDS) {
    const v = weights[k] ?? 0;
    if (v <= 0) continue;
    pick -= v;
    if (pick < 0) return k;
  }
  return null;
}

/** The (at most one) event scheduled in a room's slot, or null. */
export function slotEvent(
  s: WorldState,
  r: RoomDef,
  slot: number,
  near: boolean,
  p: PowerStatus = power(s),
): AmbientEvent | null {
  const rand = rng(hash(`${r.id}|${slot}`));
  const prof = roomProfile(s, r, p);
  const chance = prof.rate * (near ? 1 : FAR_FACTOR);
  if (rand() >= chance) return null;
  const kind = pickKind(prof.weights, rand());
  if (!kind) return null;
  const at = slot * SLOT + rand() * WINDOW;
  const pr = PRESENT[kind];
  const x = r.x + 2 + rand() * Math.max(1, r.w - 4);
  const z = r.z + 2 + rand() * Math.max(1, r.d - 4);
  const [d0, d1] = pr.duration;
  const ev: AmbientEvent = {
    kind,
    room: r.id,
    at,
    pos: [x, pr.y, z],
    duration: d0 + rand() * (d1 - d0),
    near,
  };
  if (pr.fx) ev.fx = pr.fx;
  if (pr.fxScale !== undefined) ev.fxScale = pr.fxScale;
  if (pr.sfx) {
    ev.sfx = pr.sfx;
    ev.gain = pr.gain * (near ? 1 : 0.5);
  }
  if (kind === "distant_rumble") ev.shake = near ? 0.15 : 0.06;
  return ev;
}

/**
 * Events scheduled in the window (now − dt, now] on `floor`. The player's
 * room gets the full rate, other rooms on the floor `FAR_FACTOR` of it.
 * `now` is a monotonic seconds clock (the play clock); calls may use any
 * dt — consecutive windows never repeat or skip an event.
 */
export function nextEvents(
  s: WorldState,
  floor: FloorId,
  playerRoom: string | null,
  now: number,
  dt: number,
): AmbientEvent[] {
  if (dt <= 0) return [];
  const from = now - dt;
  const p = power(s);
  const out: AmbientEvent[] = [];
  const first = Math.floor(from / SLOT);
  const last = Math.floor(now / SLOT);
  for (const r of ROOMS) {
    if (r.floor !== floor) continue;
    const near = r.id === playerRoom;
    for (let slot = first; slot <= last; slot++) {
      const ev = slotEvent(s, r, slot, near, p);
      if (ev && ev.at > from && ev.at <= now) out.push(ev);
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

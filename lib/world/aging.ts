/**
 * Aging — slow, real processes of change in the lab (pure rules).
 * ================================================================
 *
 * The lab is not a museum: plants grow where there is light and water and
 * wilt where nobody waters them, dust settles in rooms nobody uses, rust and
 * moss creep over metal in damp rooms, and the crystals grow as the world
 * gets clearer. Everything runs on the play clock (`state.playTime`), so it
 * pauses with the game, and lives in counters (no save version bump):
 *
 *   counters["grow:<room>"]   seconds of good growing conditions (lit + watered)
 *   counters["water:<room>"]  play time the plants of the room were last watered
 *   counters["dust:<room>"]   seconds of dust settling (dry rooms; using the room tidies)
 *   counters["damp:<room>"]   seconds of damp (rust, moss; damp rooms only, never reset)
 *
 * `agingTick` (1 Hz, components/world/useWorld.ts) advances them; the engine
 * reads `placementLook` for every decor piece and swaps the model when its
 * quantised look changes (lib/world/models/decor-aging.ts builds the grids).
 */
import { ROOMS } from "@/lib/world/content/map";
import { power } from "@/lib/world/game";
import type { RoomDef, RoomTheme, WorldState } from "@/lib/world/types";

/** Decor that grows (and wilts). */
export const GROWING = new Set([
  "plant_ficus",
  "plant_fern",
  "plant_cactus",
  "plant_dusty",
  "planter",
  "hanging_plant",
  "coffee_shrub",
  "mycel_wall",
]);

/** Decor that grows with the world's clarity. */
export const CRYSTALS = new Set(["crystal_cluster", "crystal_small"]);

/** Rooms where metal rusts and moss grows. */
export const DAMP_THEMES: ReadonlySet<RoomTheme> = new Set([
  "greenhouse",
  "cooling",
  "storage",
  "geothermal",
  "cryo",
]);

/** Stages per process (models are cached per stage). */
export const GROW_STAGES = 5;
export const WILT_STAGES = 3;
export const WEATHER_STAGES = 4;
export const CRYSTAL_STAGES = 4;

/** Seconds of good conditions from sprout to full plant (≈ 50 min of play). */
export const GROW_SECONDS = 3000;
/** Plants start to wilt this long after the last watering, fully wilted after another span. */
export const WILT_AFTER = 1500;
export const WILT_SPAN = 1800;
/** Seconds until a dry room is fully dusty / a damp room fully rusted (≈ 2 h / 3 h of play). */
export const DUST_SECONDS = 7200;
export const DAMP_SECONDS = 10800;
/** Share of a room's dust cleared each time something in it is used. */
export const TIDY_SHARE = 0.35;

/** A placement's quantised look: what the model variant is built for. */
export interface AgeLook {
  /** 0 = seedling … GROW_STAGES − 1 = full grown (growing decor only). */
  grow: number;
  /** 0 healthy … WILT_STAGES − 1 wilted. */
  wilt: number;
  /** 0 clean … WEATHER_STAGES − 1 (dust in dry rooms, rust + moss in damp ones). */
  weather: number;
  damp: boolean;
  /** Crystal size stage (crystal decor only). */
  crystal: number;
}

export const FRESH: AgeLook = {
  grow: GROW_STAGES - 1,
  wilt: 0,
  weather: 0,
  damp: false,
  crystal: CRYSTAL_STAGES - 1,
};

const roomById = new Map<string, RoomDef>(ROOMS.map((r) => [r.id, r]));

export function isDamp(roomId: string): boolean {
  const t = roomById.get(roomId)?.theme;
  return !!t && DAMP_THEMES.has(t);
}

const c = (s: WorldState, k: string): number => s.counters[k] ?? 0;
const stage = (f: number, n: number): number => Math.max(0, Math.min(n - 1, Math.floor(f * n)));

/**
 * Advance the processes by `dt` seconds. `lit(roomId)` = the room's lamps are
 * on (growing needs light). Returns true when any look stage changed (the
 * caller then lets the engine re-check the models).
 */
export function agingTick(
  s: WorldState,
  dt: number,
  lit: (roomId: string) => boolean,
  rooms: readonly string[] = ROOMS.map((r) => r.id),
): boolean {
  let changed = false;
  for (const id of rooms) {
    const before = roomStages(s, id);
    const damp = isDamp(id);
    if (damp) s.counters[`damp:${id}`] = Math.min(DAMP_SECONDS, c(s, `damp:${id}`) + dt);
    else s.counters[`dust:${id}`] = Math.min(DUST_SECONDS, c(s, `dust:${id}`) + dt);
    const watered = s.playTime - c(s, `water:${id}`) < WILT_AFTER || c(s, `water:${id}`) === 0;
    if (lit(id) && watered)
      s.counters[`grow:${id}`] = Math.min(GROW_SECONDS, c(s, `grow:${id}`) + dt);
    const after = roomStages(s, id);
    if (after !== before) changed = true;
  }
  return changed;
}

function roomStages(s: WorldState, id: string): string {
  const l = lookFor(s, id, "plant_ficus", 0);
  return `${l.grow}|${l.wilt}|${l.weather}`;
}

/** Lamps on per room, the engine's rule (enough generation and the room's light device online). */
export function roomLitFn(s: WorldState): (roomId: string) => boolean {
  const p = power(s);
  return (id) => {
    const r = roomById.get(id);
    return !!r && p.generation >= 50 && (!r.litBy || p.online.has(r.litBy));
  };
}

/** Plants of a room were watered (the plant decor action). */
export function waterRoom(s: WorldState, roomId: string): void {
  s.counters[`water:${roomId}`] = Math.max(1, s.playTime);
}

/** Something in the room was used: Jade tidies up a little as she works. */
export function tidyRoom(s: WorldState, roomId: string): void {
  const k = `dust:${roomId}`;
  if (s.counters[k]) s.counters[k] = Math.floor(s.counters[k]! * (1 - TIDY_SHARE));
}

/**
 * The look of a decor piece in a room. `clarity` = the world's clarity
 * level 0..41 (crystals grow with it).
 */
export function lookFor(s: WorldState, roomId: string, decorId: string, clarity: number): AgeLook {
  const damp = isDamp(roomId);
  const growing = GROWING.has(decorId);
  // Plants: a fresh game starts with grown plants that only wilt if neglected;
  // plants keep growing (new fronds) from the second stage on.
  const grow = growing
    ? stage(0.4 + (0.6 * c(s, `grow:${roomId}`)) / GROW_SECONDS, GROW_STAGES)
    : GROW_STAGES - 1;
  const lastWater = c(s, `water:${roomId}`);
  const dry = lastWater === 0 ? s.playTime : s.playTime - lastWater;
  const wilt = growing ? stage(Math.max(0, dry - WILT_AFTER) / WILT_SPAN, WILT_STAGES) : 0;
  const weatherF = damp
    ? c(s, `damp:${roomId}`) / DAMP_SECONDS
    : c(s, `dust:${roomId}`) / DUST_SECONDS;
  const weather = stage(weatherF, WEATHER_STAGES);
  const crystal = CRYSTALS.has(decorId)
    ? stage(0.25 + (0.75 * Math.max(0, Math.min(41, clarity))) / 41, CRYSTAL_STAGES)
    : CRYSTAL_STAGES - 1;
  return { grow, wilt, weather, damp, crystal };
}

/** Cache / comparison key of a look (only the stages that apply to the decor matter). */
export function lookKey(decorId: string, l: AgeLook): string {
  const g = GROWING.has(decorId) ? `g${l.grow}w${l.wilt}` : "";
  const k = CRYSTALS.has(decorId) ? `k${l.crystal}` : "";
  return `${g}${k}${l.damp ? "d" : "s"}${l.weather}`;
}

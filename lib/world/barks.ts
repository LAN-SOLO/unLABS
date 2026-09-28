/**
 * Lab World — bark engine.
 * ========================
 *
 * Picks at most one ambient one-liner ("bark") for a game event, from the
 * lines in `content/barks.ts`. Pure (no DOM, no three) and deterministic:
 * the same state, event and `now` always give the same line.
 *
 * Rules
 * -----
 * - Global gap: ≥ `GLOBAL_GAP` s between two barks (`PRIORITY_GAP` for
 *   story-critical triggers such as `bot_awake` / `ending_reached` and
 *   for first visits of a floor or room).
 * - Same speaker: ≥ `SPEAKER_GAP` s.
 * - Per line: `cooldown` (default `DEFAULT_COOLDOWN`) and `once`.
 * - Conditions: `when` via `evalCond`, plus automatic speaker gating —
 *   bots need `flags.bot_<id>_awake`, Damien needs ECR-001 online,
 *   halo/_unstables need DIM-001 built.
 * - Each trigger rolls a base chance first (`TRIGGER_CHANCE`, first visits
 *   `FIRST_VISIT_CHANCE`), so frequent events (room revisits) do not bark
 *   every time.
 * - `tick` (idle, low power, ambient) is silent for the first
 *   `START_GRACE` seconds of play.
 * - Selection is weighted; more specific matches (room > theme, device >
 *   tier …) get a bonus.
 *
 * Memory
 * ------
 * All memory is written into `state.counters` (so it saves with the slot):
 *   `bark:last`            playTime of the last bark
 *   `bark:who:<speaker>`   playTime of the speaker's last bark
 *   `bark:id:<barkId>`     playTime this line was last said (also = "once" done)
 *   `bark:seen:floor:<n>`  / `bark:seen:room:<id>`  first-visit markers
 *   `bark:night`           last announced night-shift index
 *   `bark:low_power`       playTime of the last low-power check
 *   `bark:ambient`         playTime of the next ambient chatter slot
 * `now` must therefore be the play clock (`state.playTime`, fractions ok),
 * never `performance.now()`.
 */
import { tr } from "@/lib/i18n";
import type { SfxName } from "@/lib/world/audio/sfx";
import {
  BARKS,
  type BarkDef,
  type BarkMatch,
  type BarkSpeaker,
  type BarkTrigger,
} from "@/lib/world/content/barks";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ROOM_BY_ID } from "@/lib/world/content/map";
import { NPC_SPEAKERS } from "@/lib/world/content/story";
import { evalCond, isBuilt, isOnline, power } from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";

export type { BarkDef, BarkMatch, BarkSpeaker, BarkTrigger } from "@/lib/world/content/barks";

/*
 * Rates are tuned with the realistic-player simulation in
 * tests/world/pacing.test.ts: about one line every 1–2 minutes on
 * average, never a pile-up right after the intro.
 */
export const GLOBAL_GAP = 50;
export const PRIORITY_GAP = 8;
export const SPEAKER_GAP = 110;
export const DEFAULT_COOLDOWN = 300;
/** Idle barks start after this many seconds without input. */
export const IDLE_AFTER = 40;
/** A night-shift line every this many seconds of play time. */
export const NIGHT_EVERY = 1800;
export const LOW_POWER_EVERY = 240;
export const AMBIENT_MIN = 240;
export const AMBIENT_MAX = 420;
/**
 * Periodic barks (idle, low power, ambient chatter) stay quiet for this
 * many seconds of play — the intro scene and the first hints speak first.
 */
export const START_GRACE = 90;
/** Non-priority barks wait this long after a tutorial hint bubble (`tut_last`). */
export const AFTER_HINT_GAP = 6;

const PRIORITY: ReadonlySet<BarkTrigger> = new Set(["bot_awake", "ending_reached"]);

/** Chance that a first visit barks (per trigger); revisits use `TRIGGER_CHANCE`. */
export const FIRST_VISIT_CHANCE: Partial<Record<BarkTrigger, number>> = {
  enter_floor: 0.9,
  enter_room: 0.5,
};

/** Base chance that an event barks at all (first visits: see `FIRST_VISIT_CHANCE`). */
export const TRIGGER_CHANCE: Record<BarkTrigger, number> = {
  enter_floor: 0.15,
  enter_room: 0.1,
  device_built: 0.7,
  device_online: 0.45,
  device_offline: 0.3,
  brownout: 0.9,
  overheat: 0.9,
  stage_built: 0.3,
  combine_prototype: 0.5,
  combine_explosion: 0.9,
  puzzle_solved: 0.5,
  puzzle_failed: 0.4,
  pickup_rare: 0.7,
  note_read: 0.35,
  insight: 0.35,
  idle: 1,
  night: 1,
  low_power: 1,
  achievement: 0.5,
  ending_reached: 1,
  bot_awake: 1,
  return_from_terminal: 0.8,
  ambient: 1,
  bio_low: 0.8,
};

/** Default sound per speaker (a line's own `sfx` wins). */
export const SPEAKER_SFX: Partial<Record<BarkSpeaker, SfxName>> = {
  mcp: "mcp_blip",
  damien: "echo_whisper",
  halo: "rift",
  unstables: "rift",
};

/** Display names/colours for every bark speaker (NPC_SPEAKERS + the PA). */
export const BARK_SPEAKERS: Record<BarkSpeaker, { name: string; color: string }> = {
  ...(NPC_SPEAKERS as Record<Exclude<BarkSpeaker, "pa">, { name: string; color: string }>),
  pa: { name: tr("Announcement"), color: "#FFD27F" },
};

/** Event context. Room → floor/theme and device → tier are filled in automatically. */
export type BarkContext = BarkMatch;

export interface Bark {
  id: string;
  who: BarkSpeaker;
  text: string;
  /** How long to show the subtitle. */
  seconds: number;
  sfx?: SfxName;
}

export interface BarkTickContext {
  room: string | null;
  floor?: BarkMatch["floor"];
  /** Seconds since the last player input. */
  idleSeconds: number;
}

const BOT_IDS: ReadonlySet<string> = new Set([
  "x0r8t",
  "f1ndr",
  "l0g1k",
  "p1ndr0",
  "r3tr0",
  "b4c0n",
  "d3c4d3",
  "w2rek",
  "k2ldr",
  "c8br41n",
]);

/** Whether a speaker may talk at all in this state. */
export function speakerAvailable(s: WorldState, who: BarkSpeaker): boolean {
  if (BOT_IDS.has(who)) return !!s.flags[`bot_${who}_awake`];
  if (who === "damien") return isOnline(s, "ECR-001");
  if (who === "halo" || who === "unstables") return isBuilt(s, "DIM-001");
  return true;
}

/** Subtitle duration for a line. */
export function barkSeconds(text: string): number {
  return Math.min(9, Math.max(3, 1.8 + text.length / 14));
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small deterministic PRNG. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MATCH_KEYS = [
  "floor",
  "room",
  "theme",
  "device",
  "tier",
  "kind",
  "author",
  "thread",
  "bot",
  "ending",
  "first",
] as const;

function matches(on: BarkMatch | undefined, ctx: BarkContext): boolean {
  if (!on) return true;
  for (const k of MATCH_KEYS) {
    if (on[k] !== undefined && on[k] !== ctx[k]) return false;
  }
  return true;
}

function specificity(on: BarkMatch | undefined): number {
  if (!on) return 0;
  let n = 0;
  for (const k of MATCH_KEYS) if (k !== "first" && on[k] !== undefined) n++;
  return n;
}

/** Fill floor/theme from the room and tier from the device. */
export function normalizeContext(ctx: BarkContext): BarkContext {
  const out: BarkContext = { ...ctx };
  if (out.room) {
    const r = ROOM_BY_ID.get(out.room);
    if (r) {
      if (out.floor === undefined) out.floor = r.floor;
      if (out.theme === undefined && r.theme) out.theme = r.theme;
    }
  }
  if (out.device && out.tier === undefined) {
    const d = DEVICE_BY_ID.get(out.device);
    if (d) out.tier = d.tier;
  }
  return out;
}

const BY_TRIGGER: ReadonlyMap<BarkTrigger, readonly BarkDef[]> = (() => {
  const m = new Map<BarkTrigger, BarkDef[]>();
  for (const b of BARKS) {
    const list = m.get(b.trigger) ?? [];
    list.push(b);
    m.set(b.trigger, list);
  }
  return m;
})();

const K_LAST = "bark:last";
const kWho = (who: string) => `bark:who:${who}`;
const kId = (id: string) => `bark:id:${id}`;

export class BarkEngine {
  /** Idle retry time (not persisted: idle stretches do not survive reloads). */
  private idleNextTry = 0;

  constructor(private readonly barks: ReadonlyMap<BarkTrigger, readonly BarkDef[]> = BY_TRIGGER) {}

  /**
   * React to a game event. Mutates only `state.counters` (`bark:*` keys).
   * Returns the line to show, or null.
   */
  event(trigger: BarkTrigger, ctx: BarkContext, s: WorldState, now: number): Bark | null {
    const c = normalizeContext(ctx);
    // First-visit bookkeeping (always, even when nothing is said).
    if (trigger === "enter_floor" && c.floor !== undefined) {
      const key = `bark:seen:floor:${c.floor}`;
      if (c.first === undefined) c.first = s.counters[key] === undefined;
      s.counters[key] = 1;
    }
    if (trigger === "enter_room" && c.room) {
      const key = `bark:seen:room:${c.room}`;
      if (c.first === undefined) c.first = s.counters[key] === undefined;
      s.counters[key] = 1;
    }
    const seedKey = `${trigger}|${c.room ?? ""}|${c.device ?? ""}|${c.kind ?? ""}|${c.bot ?? ""}|${c.ending ?? ""}|${c.floor ?? ""}|${Math.floor(now * 10)}`;
    const r = rng(hashString(seedKey));
    const chance = c.first ? (FIRST_VISIT_CHANCE[trigger] ?? 0.9) : TRIGGER_CHANCE[trigger];
    if (r() >= chance) return null;
    const gap = PRIORITY.has(trigger) || c.first ? PRIORITY_GAP : GLOBAL_GAP;
    const last = s.counters[K_LAST];
    if (last !== undefined && now - last < gap) return null;
    const hint = s.counters.tut_last;
    if (!PRIORITY.has(trigger) && hint !== undefined && now >= hint && now - hint < AFTER_HINT_GAP)
      return null;

    const pool: { b: BarkDef; w: number }[] = [];
    for (const b of this.barks.get(trigger) ?? []) {
      if (!matches(b.on, c)) continue;
      const said = s.counters[kId(b.id)];
      if (said !== undefined) {
        if (b.once) continue;
        if (now - said < (b.cooldown ?? DEFAULT_COOLDOWN)) continue;
      }
      const whoLast = s.counters[kWho(b.who)];
      if (whoLast !== undefined && now - whoLast < SPEAKER_GAP) continue;
      if (!speakerAvailable(s, b.who)) continue;
      if (!evalCond(s, b.when)) continue;
      pool.push({ b, w: (b.weight ?? 1) * (1 + 1.5 * specificity(b.on)) });
    }
    if (pool.length === 0) return null;
    const total = pool.reduce((a, p) => a + p.w, 0);
    let pick = r() * total;
    let chosen = pool[pool.length - 1]!.b;
    for (const p of pool) {
      pick -= p.w;
      if (pick < 0) {
        chosen = p.b;
        break;
      }
    }
    s.counters[K_LAST] = now;
    s.counters[kWho(chosen.who)] = now;
    s.counters[kId(chosen.id)] = now;
    const out: Bark = {
      id: chosen.id,
      who: chosen.who,
      text: chosen.text,
      seconds: barkSeconds(chosen.text),
    };
    const sfx = chosen.sfx ?? SPEAKER_SFX[chosen.who];
    if (sfx) out.sfx = sfx;
    return out;
  }

  /**
   * Periodic checks (call ~1×/s): idle (> 40 s without input), night shift
   * (every 30 min of play time), low power and background chatter.
   */
  tick(s: WorldState, now: number, ctx: BarkTickContext): Bark | null {
    const base: BarkContext = {};
    if (ctx.room) base.room = ctx.room;
    if (ctx.floor !== undefined) base.floor = ctx.floor;
    if (now < START_GRACE) return null;

    if (ctx.idleSeconds < IDLE_AFTER) this.idleNextTry = 0;
    else if (now >= this.idleNextTry) {
      const b = this.event("idle", base, s, now);
      this.idleNextTry = now + (b ? 90 : 15);
      if (b) return b;
    }

    const night = Math.floor(s.playTime / NIGHT_EVERY);
    if (night >= 1 && night > (s.counters["bark:night"] ?? 0)) {
      const b = this.event("night", base, s, now);
      if (b) {
        s.counters["bark:night"] = night;
        return b;
      }
    }

    const lastLow = s.counters["bark:low_power"];
    if (lastLow === undefined || now - lastLow >= LOW_POWER_EVERY) {
      const p = power(s);
      const low = p.starved.some((x) => x.reason === "strom") || p.generation < 50;
      if (low) {
        s.counters["bark:low_power"] = now;
        const b = this.event("low_power", base, s, now);
        if (b) return b;
      }
    }

    const next = s.counters["bark:ambient"];
    if (next === undefined) {
      s.counters["bark:ambient"] = now + ambientDelay(now);
    } else if (now >= next) {
      const b = this.event("ambient", base, s, now);
      s.counters["bark:ambient"] = now + (b ? ambientDelay(now) : 20);
      if (b) return b;
    }
    return null;
  }
}

function ambientDelay(now: number): number {
  const r = rng(hashString(`ambient|${Math.floor(now)}`));
  return AMBIENT_MIN + r() * (AMBIENT_MAX - AMBIENT_MIN);
}

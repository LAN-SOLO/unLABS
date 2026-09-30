/**
 * Decor actions — rules (pure, no DOM, no three).
 * ================================================
 *
 * Resolves and runs the furniture interactions authored in
 * `content/decor-actions.ts`. All bookkeeping lives in the save state:
 *
 *   counters["decor:<actionId>"]       play-clock time until which the
 *                                      action's cooldown outcomes rest
 *   counters["decor_uses:<actionId>"]  successful uses (rotation + conditions)
 *   counters["decor_used"]             all successful decor uses
 *   counters["decor_found"]            distinct actions tried at least once
 *   counters["buff:<buffId>"]          play-clock time the buff ends
 *   flags["decor_once_<actionId>_<i>"] outcome i of a `once` outcome is spent
 *   flags["decor_seen_<actionId>"]     action tried at least once
 *
 * `now` is always the play clock (`state.playTime`, fractions ok) — the same
 * convention as `barks.ts`, so cooldowns and buffs pause with the game.
 * Cooldowns are per action: when an outcome with `cooldown` fires, every
 * outcome of that action that carries a cooldown rests until it expires;
 * text-only outcomes stay available.
 */
import { tr } from "@/lib/i18n";
import {
  BUFF_DEFAULT_FACTOR,
  DECOR_ACTIONS,
  PROP_VARIANT_DECOR,
  STATION_VARIANT_ACTIONS,
  type DecorActionDef,
  type DecorOutcome,
  type DecorVerb,
} from "@/lib/world/content/decor-actions";
import { addItem, bump, evalCond, grant } from "@/lib/world/game";
import { buffKey, type ActiveBuff } from "@/lib/world/buffs";
import { roomAt } from "@/lib/world/content/map";
import { DECOR_BY_ID, decorSize } from "@/lib/world/models/decor";
import { SEATS } from "@/lib/world/stand-spots";
import type { DialogueLine, PropDef, WorldState } from "@/lib/world/types";

// Buff helpers live in `buffs.ts` (so `game.ts` can use them); re-exported
// here for existing callers (engine, UI, tests).
export {
  activeBuffs,
  buffKey,
  buffMultiplier,
  pruneBuffs,
  type ActiveBuff,
} from "@/lib/world/buffs";

export interface DecorPlacementRef {
  decor: string;
  room: string;
  x: number;
  z: number;
  rot: 0 | 1 | 2 | 3;
}

export interface DecorActionView {
  action: DecorActionDef;
  label: string;
  verb: DecorVerb;
  /** False when `requires` does not hold (show `hint` instead). */
  available: boolean;
  hint?: string;
}

export interface DecorActionResult {
  ok: boolean;
  placementId: string;
  actionId: string;
  label: string;
  verb: DecorVerb;
  text: string;
  who?: DialogueLine["who"];
  items: { item: string; count: number }[];
  /** Freshly granted insights (incl. automatic follow-ups from `settle`). */
  insights: string[];
  flags: string[];
  buff?: ActiveBuff;
  /** True when nothing was eligible and the idle line was shown. */
  resting: boolean;
  /** Seconds until the action's cooldown outcomes are available again (0 = ready). */
  cooldownLeft: number;
  /** Body pose hint for the renderer (verb "sitzen" → "sit", "liegen" → "lie"). */
  pose: "sit" | "lie" | null;
}

const IDLE_FALLBACK = tr("Nothing is happening here right now. Maybe later.");

/** Pose of a decor action: sitting down, or lying down on a bed / cot. */
function poseOf(verb: DecorVerb, decorId: string): "sit" | "lie" | null {
  if (verb === "liegen") return "lie";
  if (verb !== "sitzen") return null;
  return SEATS[decorId]?.kind === "lie" ? "lie" : "sit";
}

// ── Lookup ───────────────────────────────────────────────────────

const BY_DECOR = new Map<string, DecorActionDef[]>();
for (const a of DECOR_ACTIONS) {
  const list = BY_DECOR.get(a.decor) ?? [];
  list.push(a);
  BY_DECOR.set(a.decor, list);
}

/** The action for a decor piece in a room (room-specific first), if any. */
export function decorActionFor(decor: string, room: string): DecorActionDef | undefined {
  const list = BY_DECOR.get(decor);
  if (!list) return undefined;
  return list.find((a) => a.room === room) ?? list.find((a) => a.room === undefined);
}

/** Cheap check for the engine: does this decor piece react at all? */
export function hasDecorAction(decor: string, room: string): boolean {
  return decorActionFor(decor, room) !== undefined;
}

/** Action for a placement, with availability — or null when the piece has none. */
export function decorActionAt(
  placement: Pick<DecorPlacementRef, "decor" | "room">,
  state: WorldState,
): DecorActionView | null {
  const action = decorActionFor(placement.decor, placement.room);
  if (!action) return null;
  const available = evalCond(state, action.requires);
  return {
    action,
    label: action.label,
    verb: action.verb,
    available,
    ...(available ? {} : { hint: action.requiresHint ?? tr("That does not work right now.") }),
  };
}

/**
 * Interaction point and radius of a placement (world voxels, same
 * convention as devices/props: centre at x + 0.5, z + 0.5).
 */
export function decorInteractPoint(p: DecorPlacementRef): { x: number; z: number; radius: number } {
  if (!DECOR_BY_ID.has(p.decor)) return { x: p.x, z: p.z, radius: 1 };
  const s = decorSize(p.decor);
  const odd = p.rot % 2 === 1;
  const w = odd ? s.d : s.w;
  const d = odd ? s.w : s.d;
  return { x: p.x, z: p.z, radius: Math.max(0.8, Math.max(w, d) / 2) };
}

// ── Prop variants ────────────────────────────────────────────────

/**
 * Decor action behind a map prop with a `variant` (e.g. the Kantine coffee
 * machine, a `station` prop). Null when the prop has no variant, the variant
 * has no action, or it is a station whose variant is not in
 * `STATION_VARIANT_ACTIONS`. `room` is the prop's room (room-specific
 * actions win, as for placed decor).
 */
export function propDecorAction(
  p: Pick<PropDef, "kind" | "variant" | "floor" | "x" | "z">,
): { decor: string; room: string; action: DecorActionDef } | null {
  if (!p.variant) return null;
  if (p.kind !== "decor" && !(p.kind === "station" && STATION_VARIANT_ACTIONS.has(p.variant)))
    return null;
  const decor = PROP_VARIANT_DECOR[p.variant];
  if (!decor) return null;
  const room = roomAt(p.floor, p.x, p.z)?.id ?? "";
  const action = decorActionFor(decor, room);
  return action ? { decor, room, action } : null;
}

/** Placement id used for a prop's decor action (`DecorActionResult.placementId`). */
export const propPlacementId = (propId: string): string => `prop:${propId}`;

/** Run a prop's variant decor action (mutates `state`); null when it has none. */
export function runPropDecorAction(
  state: WorldState,
  p: PropDef,
  now: number,
): DecorActionResult | null {
  const hit = propDecorAction(p);
  if (!hit) return null;
  return runDecorAction(state, propPlacementId(p.id), hit.decor, hit.room, now);
}

// ── Keys ─────────────────────────────────────────────────────────

export const cooldownKey = (actionId: string): string => `decor:${actionId}`;
export const usesKey = (actionId: string): string => `decor_uses:${actionId}`;
export const onceFlag = (actionId: string, i: number): string => `decor_once_${actionId}_${i}`;
export const seenFlag = (actionId: string): string => `decor_seen_${actionId}`;

/** Seconds left on an action's cooldown (0 = ready). */
export function cooldownLeft(state: WorldState, actionId: string, now: number): number {
  return Math.max(0, (state.counters[cooldownKey(actionId)] ?? 0) - now);
}

function eligible(
  state: WorldState,
  action: DecorActionDef,
  i: number,
  o: DecorOutcome,
  now: number,
): boolean {
  if (!evalCond(state, o.when)) return false;
  if (o.once && state.flags[onceFlag(action.id, i)]) return false;
  if (o.cooldown && cooldownLeft(state, action.id, now) > 0) return false;
  return true;
}

/**
 * Pick the outcome index (deterministic): first eligible `once` outcome,
 * else rotate the eligible repeatables by use count; -1 = nothing eligible.
 */
export function pickOutcome(state: WorldState, action: DecorActionDef, now: number): number {
  const ok = action.outcomes.map((o, i) => eligible(state, action, i, o, now));
  const first = action.outcomes.findIndex((o, i) => ok[i] && o.once);
  if (first >= 0) return first;
  const pool = action.outcomes.map((_, i) => i).filter((i) => ok[i]);
  if (!pool.length) return -1;
  const uses = state.counters[usesKey(action.id)] ?? 0;
  return pool[uses % pool.length]!;
}

// ── Run ──────────────────────────────────────────────────────────

/**
 * Run the interaction of a placement (mutates `state`; call inside
 * `world.act`). `now` = `state.playTime`.
 */
export function runDecorAction(
  state: WorldState,
  placementId: string,
  decorId: string,
  room: string,
  now: number,
): DecorActionResult {
  const action = decorActionFor(decorId, room);
  const base = {
    placementId,
    items: [] as { item: string; count: number }[],
    insights: [] as string[],
    flags: [] as string[],
  };
  if (!action) {
    return {
      ...base,
      ok: false,
      actionId: "",
      label: decorId,
      verb: "ansehen",
      text: IDLE_FALLBACK,
      resting: true,
      cooldownLeft: 0,
      pose: null,
    };
  }
  const head = {
    ...base,
    actionId: action.id,
    label: action.label,
    verb: action.verb,
    pose: poseOf(action.verb, decorId),
  };
  if (!evalCond(state, action.requires)) {
    return {
      ...head,
      ok: false,
      text: action.requiresHint ?? tr("That does not work right now."),
      resting: false,
      cooldownLeft: 0,
      pose: null,
    };
  }
  const i = pickOutcome(state, action, now);
  if (i < 0) {
    return {
      ...head,
      ok: true,
      text: action.idle ?? IDLE_FALLBACK,
      resting: true,
      cooldownLeft: cooldownLeft(state, action.id, now),
    };
  }
  const o = action.outcomes[i]!;
  const result: DecorActionResult = {
    ...head,
    ok: true,
    text: o.text,
    ...(o.who ? { who: o.who } : {}),
    resting: false,
    cooldownLeft: 0,
  };

  // Bookkeeping.
  if (o.once) state.flags[onceFlag(action.id, i)] = true;
  if (o.cooldown) {
    state.counters[cooldownKey(action.id)] = now + o.cooldown;
    result.cooldownLeft = o.cooldown;
  }
  bump(state, usesKey(action.id));
  bump(state, "decor_used");
  if (!state.flags[seenFlag(action.id)]) {
    state.flags[seenFlag(action.id)] = true;
    bump(state, "decor_found");
  }

  // Effects.
  const fx = o.effects;
  if (fx) {
    for (const f of fx.flags ?? []) {
      if (!state.flags[f]) result.flags.push(f);
      state.flags[f] = true;
    }
    for (const [k, v] of Object.entries(fx.counters ?? {})) bump(state, k, v);
    for (const it of fx.items ?? []) {
      addItem(state, it.item, it.count);
      result.items.push({ item: it.item, count: it.count });
    }
    if (fx.insights?.length) result.insights = grant(state, fx.insights);
    if (fx.buff) {
      const until = now + fx.buff.seconds;
      state.counters[buffKey(fx.buff.id)] = Math.max(
        state.counters[buffKey(fx.buff.id)] ?? 0,
        until,
      );
      result.buff = {
        id: fx.buff.id,
        label: fx.buff.label,
        kind: fx.buff.kind,
        factor: fx.buff.factor ?? BUFF_DEFAULT_FACTOR[fx.buff.kind],
        until,
        remaining: fx.buff.seconds,
      };
    }
  }
  return result;
}

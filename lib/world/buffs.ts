/**
 * Buffs — short timed multipliers granted by decor actions (pure).
 * =================================================================
 *
 * A buff lives in `counters["buff:<buffId>"]` as the play-clock time it
 * ends. Kept separate from `decor-actions.ts` so the core rules
 * (`game.ts`, `tutorial.ts`) can read multipliers without importing the
 * decor rules (which themselves import `game.ts`).
 *
 *   walk_speed     engine walk speed × factor (1.25 by default)
 *   hint_boost     tutorial hint spacing ÷ factor (hints come twice as often)
 *   respawn_boost  pickup respawn timers × factor (0.5 = regrowth twice as fast)
 */
import { BUFF_DEFAULT_FACTOR, DECOR_BUFFS, type BuffKind } from "@/lib/world/content/decor-actions";
import type { WorldState } from "@/lib/world/types";

export interface ActiveBuff {
  id: string;
  label: string;
  kind: BuffKind;
  factor: number;
  /** Play-clock end time. */
  until: number;
  /** Seconds left. */
  remaining: number;
}

export const buffKey = (buffId: string): string => `buff:${buffId}`;

/** Buffs still running at `now` (unknown ids are ignored), sorted by id. */
export function activeBuffs(state: WorldState, now: number): ActiveBuff[] {
  const out: ActiveBuff[] = [];
  for (const [key, until] of Object.entries(state.counters)) {
    if (!key.startsWith("buff:") || until <= now) continue;
    const def = DECOR_BUFFS.get(key.slice("buff:".length));
    if (!def) continue;
    out.push({
      id: def.id,
      label: def.label,
      kind: def.kind,
      factor: def.factor ?? BUFF_DEFAULT_FACTOR[def.kind],
      until,
      remaining: until - now,
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Multiplier for one buff kind (1 when none is active). Buffs of the same
 * kind do not stack: the strongest deviation from 1 wins.
 */
export function buffMultiplier(state: WorldState, now: number, kind: BuffKind): number {
  let best = 1;
  for (const b of activeBuffs(state, now)) {
    if (b.kind !== kind) continue;
    if (Math.abs(b.factor - 1) > Math.abs(best - 1)) best = b.factor;
  }
  return best;
}

/** Drop expired buff counters (optional housekeeping, e.g. before saving). */
export function pruneBuffs(state: WorldState, now: number): void {
  for (const [key, until] of Object.entries(state.counters))
    if (key.startsWith("buff:") && until <= now) delete state.counters[key];
}

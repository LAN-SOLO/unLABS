/**
 * Achievement engine — pure helpers.
 *
 * Framework-free. Takes a game snapshot + player state, returns the derived
 * status for each achievement in the catalog. The React provider layers
 * side effects (toast on unlock, claim flow) on top of this.
 */

import type {
  Achievement,
  AchievementGameState,
  AchievementPlayerState,
  AchievementStatus,
  AchievementWithStatus,
} from "./types";

/**
 * Compute the raw progress (clamped to [0, target]) for a single
 * achievement given the current game state.
 */
export function evaluateProgress(achievement: Achievement, state: AchievementGameState): number {
  const raw = achievement.evaluate(state);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(achievement.target, raw);
}

/**
 * Derive the status of an achievement given current progress + persisted
 * flags. `locked` means the availability predicate is false; `unlocked`
 * means the player can claim; `claimed` means the reserve has already
 * credited.
 */
export function deriveStatus(
  achievement: Achievement,
  progress: number,
  player: AchievementPlayerState,
  flags: Record<string, boolean>,
): AchievementStatus {
  if (player.claimed[achievement.id]) return "claimed";
  if (achievement.available && !achievement.available(flags)) return "locked";
  if (progress >= achievement.target) return "unlocked";
  return "progressing";
}

/**
 * Evaluate the entire catalog against a snapshot and return one row per
 * achievement with computed progress + status. Used by the provider to
 * diff against the previous tick's result and emit toasts on new unlocks.
 */
export function evaluateCatalog(
  catalog: Achievement[],
  gameState: AchievementGameState,
  player: AchievementPlayerState,
  flags: Record<string, boolean>,
): AchievementWithStatus[] {
  return catalog.map((a) => {
    const progress = evaluateProgress(a, gameState);
    const status = deriveStatus(a, progress, player, flags);
    return {
      ...a,
      progress,
      status,
      rewardClaimed: !!player.claimed[a.id],
    };
  });
}

/**
 * Detect newly-unlocked achievements since the previous evaluation. Used
 * by the provider to fire exactly one toast per unlock regardless of how
 * many ticks the player remains over the target.
 */
export function diffNewlyUnlocked(
  previous: Record<string, AchievementStatus>,
  current: AchievementWithStatus[],
): AchievementWithStatus[] {
  const out: AchievementWithStatus[] = [];
  for (const a of current) {
    const was = previous[a.id];
    if (a.status === "unlocked" && was !== "unlocked" && was !== "claimed") {
      out.push(a);
    }
  }
  return out;
}

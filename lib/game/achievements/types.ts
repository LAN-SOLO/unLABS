/**
 * Achievement types
 * =================
 *
 * Framework-free. Safe to import from both server actions and client
 * providers. Each Achievement exports a pure `evaluate()` that takes a
 * snapshot of game state and returns current progress — the engine then
 * decides whether to flip the unlock bit and surface a toast.
 *
 * Design notes:
 *   - Tier is 1..3 (T1 ships MVP; T2/T3 come later)
 *   - Rewards are _unSC burned from the reserve (§ workstream 3) — never
 *     minted. `rewardFlag` optionally sets a quest flag on claim so other
 *     systems can react (e.g. the tutorial hint engine or tech tree)
 *   - `condition(flags)` gates availability (e.g. can't earn Trade
 *     achievements until the marketplace is unlocked); null = always
 *     available
 */

export type AchievementBranch =
  | "resource"
  | "energy"
  | "construction"
  | "breadth"
  | "trade"
  | "exploration"
  | "anomaly"
  | "relic"
  | "cosmic"
  | "ai";

export type AchievementTier = 1 | 2 | 3;

/**
 * Snapshot passed to `evaluate()`. Declared here (not in lib/game/tickEngine)
 * so adding a new field to evaluators doesn't ripple across the codebase.
 */
export interface AchievementGameState {
  /** Current resource map. */
  resources: Record<string, { amount: number; capacity: number; ratePerSecond: number }>;
  /** Quest + mission flags. */
  flags: Record<string, boolean>;
  /** Number of production jobs the player has claimed (i.e. crafted). */
  craftedJobCount: number;
  /** Distinct recipe ids the player has crafted at least once. */
  craftedRecipeIds: Set<string>;
  /** Discovery ids from the resonance system. */
  discoveries: string[];
  /** Current user _unSC balance (for spend-style trade achievements). */
  balance: number;
  /** Total _unSC spent over lifetime (trade branch). */
  totalSpent: number;
}

export interface AchievementReward {
  /** _unSC burned from the reserve on claim. */
  unsc: number;
  /** Optional quest flag to set on claim. */
  flag?: string;
  /** Optional descriptive suffix shown on the toast (e.g. "+5% energy"). */
  description?: string;
}

export interface Achievement {
  /** Stable id, e.g. "resource.dabbler.t1". Persisted in the DB. */
  id: string;
  /** Short display name. */
  title: string;
  /** One-liner flavor text. */
  description: string;
  /** Branch the achievement belongs to. */
  branch: AchievementBranch;
  /** Tier within the branch (1..3). */
  tier: AchievementTier;
  /** Target progress value for unlock. */
  target: number;
  /** Human-readable unit of measure shown next to the progress bar. */
  unit: string;
  /** Rewards applied on claim. */
  reward: AchievementReward;
  /**
   * Optional gate: returns true when the achievement should be visible /
   * tracked. When omitted the achievement is always available.
   */
  available?: (flags: Record<string, boolean>) => boolean;
  /**
   * Pure progress evaluator. MUST return a non-negative number bounded by
   * the achievement's natural domain — the engine clamps to [0, target].
   */
  evaluate: (state: AchievementGameState) => number;
}

export type AchievementStatus = "locked" | "progressing" | "unlocked" | "claimed";

export interface AchievementWithStatus extends Achievement {
  status: AchievementStatus;
  /** Clamped progress value (0..target). */
  progress: number;
  /** True once the reward has been credited (post-claim). */
  rewardClaimed: boolean;
}

/**
 * Persisted player state — mirrors the two DB tables collapsed into one
 * in-memory structure for easier React consumption.
 */
export interface AchievementPlayerState {
  /** achievementId -> latest progress value committed server-side */
  progress: Record<string, number>;
  /** achievementId -> true when unlocked (progress reached target) */
  unlocked: Record<string, boolean>;
  /** achievementId -> true when the reserve award was credited */
  claimed: Record<string, boolean>;
}

export function createInitialAchievementState(): AchievementPlayerState {
  return { progress: {}, unlocked: {}, claimed: {} };
}

export function hydrateAchievementState(raw: unknown): AchievementPlayerState {
  if (!raw || typeof raw !== "object") return createInitialAchievementState();
  const obj = raw as Partial<AchievementPlayerState>;
  return {
    progress: obj.progress ?? {},
    unlocked: obj.unlocked ?? {},
    claimed: obj.claimed ?? {},
  };
}

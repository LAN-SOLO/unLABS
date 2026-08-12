"use server";

/**
 * Achievement server actions
 * ==========================
 *
 * Server-authoritative claim path. The client optimistically flips an
 * achievement to "unlocked" status based on its tick-local evaluation, but
 * crediting the _unSC reward goes through `claimAchievement()` which:
 *
 *   1. Re-reads the achievement_progress row (anti-cheat: client-side
 *      progress is untrusted)
 *   2. Validates `progress >= target` on DB state
 *   3. Re-derives progress from server-authoritative tables where possible
 *      (construction/breadth via production_jobs, trade via
 *      balances.total_spent) — see lib/game/achievements/verify.ts. The
 *      progress-row check alone is circular because the client writes
 *      those rows via updateAchievementProgress.
 *   4. Calls `reserve_burn_and_award` to debit the reserve + credit the
 *      player atomically (one RPC)
 *   5. Inserts/updates the achievement_unlocks row with reward_claimed=true
 *   6. Optionally flips a quest flag (for achievements that gate downstream
 *      unlocks)
 *
 * Progress *reads* hit the client-visible RLS policies; progress *writes*
 * (`updateProgress`) come from the client, so they're capped by the same
 * RLS policies (auth.uid() = user_id).
 */

import { createClient } from "@/lib/supabase/server";
import { awardFromReserve } from "@/lib/game/economy";
import { getAchievement, listAchievements } from "@/lib/game/achievements";
import { verifyBranchServerSide } from "@/lib/game/achievements/verify";
import type { QuestState } from "@/lib/game/quests/types";

export interface AchievementRow {
  achievementId: string;
  tier: number;
  progress: number;
  target: number;
  updatedAt: string;
}

export interface AchievementUnlockRow {
  achievementId: string;
  tier: number;
  unlockedAt: string;
  rewardClaimed: boolean;
  claimedAt: string | null;
}

export interface AchievementLoadResult {
  ok: boolean;
  progress: AchievementRow[];
  unlocks: AchievementUnlockRow[];
  error?: string;
}

export async function loadAchievementState(): Promise<AchievementLoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, progress: [], unlocks: [], error: "not_authenticated" };
  }

  const [progressRes, unlocksRes] = await Promise.all([
    supabase
      .from("achievement_progress")
      .select("achievement_id, tier, progress, target, updated_at")
      .eq("user_id", user.id),
    supabase
      .from("achievement_unlocks")
      .select("achievement_id, tier, unlocked_at, reward_claimed, claimed_at")
      .eq("user_id", user.id),
  ]);

  const progressRows = (progressRes.data ?? []) as Array<{
    achievement_id: string;
    tier: number;
    progress: number | string;
    target: number | string;
    updated_at: string;
  }>;
  const unlockRows = (unlocksRes.data ?? []) as Array<{
    achievement_id: string;
    tier: number;
    unlocked_at: string;
    reward_claimed: boolean;
    claimed_at: string | null;
  }>;

  return {
    ok: true,
    progress: progressRows.map((r) => ({
      achievementId: r.achievement_id,
      tier: r.tier,
      progress: Number(r.progress),
      target: Number(r.target),
      updatedAt: r.updated_at,
    })),
    unlocks: unlockRows.map((r) => ({
      achievementId: r.achievement_id,
      tier: r.tier,
      unlockedAt: r.unlocked_at,
      rewardClaimed: r.reward_claimed,
      claimedAt: r.claimed_at,
    })),
  };
}

export interface UpdateProgressResult {
  ok: boolean;
  error?: string;
}

/**
 * Commit a new progress value for an achievement. The client calls this
 * after its tick-local evaluator crosses an integer boundary (to avoid
 * spamming the DB on sub-second drift).
 *
 * Monotonic: no catalog achievement can legitimately decrease, so a new
 * value below the persisted one is treated as a no-op instead of an
 * overwrite. This blocks reset games (deliberately writing a low value,
 * e.g. to re-trigger unlock toasts or confuse downstream tooling) at the
 * cost of one extra SELECT per progress commit — acceptable because the
 * client already debounces these calls to integer-boundary crossings.
 * If you ever add a decaying achievement, carve it out of this guard.
 */
export async function updateAchievementProgress(
  achievementId: string,
  progress: number,
): Promise<UpdateProgressResult> {
  const achievement = getAchievement(achievementId);
  if (!achievement) {
    return { ok: false, error: "unknown_achievement" };
  }
  if (!Number.isFinite(progress) || progress < 0) {
    return { ok: false, error: "invalid_progress" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const clamped = Math.min(achievement.target, progress);

  // Monotonic guard (see doc comment): read the existing row first and
  // ignore regressions.
  const existingRes = await supabase
    .from("achievement_progress")
    .select("progress")
    .eq("user_id", user.id)
    .eq("achievement_id", achievement.id)
    .eq("tier", achievement.tier)
    .maybeSingle();
  const existingRow = existingRes.data as { progress: number | string } | null;
  if (existingRow && clamped < Number(existingRow.progress)) {
    return { ok: true };
  }

  // Upsert by primary key (user_id, achievement_id, tier).
  const { error } = await supabase.from("achievement_progress").upsert(
    {
      user_id: user.id,
      achievement_id: achievement.id,
      tier: achievement.tier,
      progress: clamped,
      target: achievement.target,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id,achievement_id,tier" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface ClaimAchievementResult {
  ok: boolean;
  achievementId: string;
  tier: number;
  unscAwarded: number;
  newBalance: number;
  error?:
    | "unknown_achievement"
    | "not_authenticated"
    | "progress_insufficient"
    | "already_claimed"
    | "award_failed"
    | "write_failed";
}

/**
 * Claim the reserve-burn reward for an unlocked achievement. Atomic in
 * practice: the RPC handles the reserve-debit + balance-credit in one
 * transaction, and the unlock row is only flipped after a successful
 * award. A failure between award and unlock-update leaves the user with
 * the credits but `reward_claimed=false` — preferable to losing _unSC.
 *
 * Trust surface: the achievement_progress row is client-written, so step 1
 * alone is circular. Step 1b re-derives progress from server-authoritative
 * tables for the construction / breadth / trade branches and rejects the
 * claim when the DB disagrees — regardless of what the progress row
 * asserts. The resource / energy / exploration branches evaluate tick-local
 * state (lifetime resource counters, resonance discoveries) that has no
 * server-side mirror; those claims still trust the progress row. That
 * residual surface is documented in lib/game/achievements/verify.ts and
 * must be closed (e.g. by persisting tick checkpoints) before those
 * branches can gate on-chain value.
 */
export async function claimAchievement(achievementId: string): Promise<ClaimAchievementResult> {
  const achievement = getAchievement(achievementId);
  if (!achievement) {
    return {
      ok: false,
      achievementId,
      tier: 0,
      unscAwarded: 0,
      newBalance: 0,
      error: "unknown_achievement",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      achievementId,
      tier: achievement.tier,
      unscAwarded: 0,
      newBalance: 0,
      error: "not_authenticated",
    };
  }

  // 1. Verify progress server-side.
  const progRes = await supabase
    .from("achievement_progress")
    .select("progress, target")
    .eq("user_id", user.id)
    .eq("achievement_id", achievement.id)
    .eq("tier", achievement.tier)
    .maybeSingle();
  const progRow = progRes.data as { progress: number | string; target: number | string } | null;
  if (!progRow || Number(progRow.progress) < Number(progRow.target)) {
    return {
      ok: false,
      achievementId,
      tier: achievement.tier,
      unscAwarded: 0,
      newBalance: 0,
      error: "progress_insufficient",
    };
  }

  // 1b. Server-side re-derivation (anti-cheat). Overrides the client-written
  // progress row: when the branch is verifiable and the DB says the target
  // is not met, the claim is rejected no matter what the row claims.
  const verification = await verifyBranchServerSide(supabase, user.id, achievement);
  if (verification.verifiable && !verification.satisfied) {
    return {
      ok: false,
      achievementId,
      tier: achievement.tier,
      unscAwarded: 0,
      newBalance: 0,
      error: "progress_insufficient",
    };
  }

  // 2. Verify not already claimed.
  const unlockRes = await supabase
    .from("achievement_unlocks")
    .select("reward_claimed")
    .eq("user_id", user.id)
    .eq("achievement_id", achievement.id)
    .eq("tier", achievement.tier)
    .maybeSingle();
  const unlockRow = unlockRes.data as { reward_claimed: boolean } | null;
  if (unlockRow?.reward_claimed) {
    return {
      ok: false,
      achievementId,
      tier: achievement.tier,
      unscAwarded: 0,
      newBalance: 0,
      error: "already_claimed",
    };
  }

  // 3. Award from reserve.
  const award = await awardFromReserve(supabase, {
    userId: user.id,
    amount: achievement.reward.unsc,
    source: "achievement",
    ref: achievement.id,
  });
  if (!award.ok) {
    return {
      ok: false,
      achievementId,
      tier: achievement.tier,
      unscAwarded: 0,
      newBalance: award.newUserBalance,
      error: "award_failed",
    };
  }

  // 4. Upsert the unlock row with reward_claimed=true.
  const { error: writeErr } = await supabase.from("achievement_unlocks").upsert(
    {
      user_id: user.id,
      achievement_id: achievement.id,
      tier: achievement.tier,
      unlocked_at: new Date().toISOString(),
      reward_claimed: true,
      claimed_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id,achievement_id,tier" },
  );
  if (writeErr) {
    // Money already moved; log the inconsistency but return ok=true so
    // the client doesn't double-claim. Dev tooling can reconcile.

    console.warn(
      `[ach] award succeeded but unlock write failed for ${achievement.id}: ${writeErr.message}`,
    );
  }

  // 5. Optional quest flag on claim.
  if (achievement.reward.flag) {
    const profile = await supabase
      .from("profiles")
      .select("quest_state")
      .eq("id", user.id)
      .maybeSingle();
    const row = profile.data as { quest_state: Record<string, unknown> } | null;
    const qs = (row?.quest_state ?? {}) as Partial<QuestState>;
    const flags = { ...(qs.flags ?? {}), [achievement.reward.flag]: true };
    const next: QuestState = {
      episodeId: (qs.episodeId as string) ?? "EP0",
      currentStepIndex: typeof qs.currentStepIndex === "number" ? qs.currentStepIndex : 0,
      completedStepIds: qs.completedStepIds ?? [],
      flags,
    };
    await supabase
      .from("profiles")
      .update({ quest_state: next as unknown as Record<string, unknown> } as never)
      .eq("id", user.id);
  }

  return {
    ok: true,
    achievementId,
    tier: achievement.tier,
    unscAwarded: achievement.reward.unsc,
    newBalance: award.newUserBalance,
  };
}

/**
 * Seed progress rows for every applicable achievement. Called on first
 * game load so the UI always has something to render (instead of null
 * rows that can't distinguish "never tracked" from "zero progress").
 */
export async function seedAchievementProgress(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const rows = listAchievements().map((a) => ({
    user_id: user.id,
    achievement_id: a.id,
    tier: a.tier,
    progress: 0,
    target: a.target,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("achievement_progress")
    .upsert(rows as never, { onConflict: "user_id,achievement_id,tier", ignoreDuplicates: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

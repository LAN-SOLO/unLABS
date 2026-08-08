"use server";

/**
 * Daily contract server actions
 * =============================
 *
 * Server-authoritative half of the daily comeback loop. Contracts are
 * date-seeded (lib/game/daily/engine.ts), so the server never stores
 * them — every action re-derives today's set from (userId, UTC day) and
 * validates the client's claim against it:
 *
 *   - getDailyState     — derive today's contracts, lazily persist streak
 *                         decay when a lapse is detected
 *   - rerollContract    — burn REROLL_COST _unSC (type 'fee'), record the
 *                         slot as rerolled; the replacement is derived, not
 *                         stored
 *   - claimContract     — verify completion (craft_count against claimed
 *                         production_jobs rows — server-authoritative;
 *                         command/resource_threshold trust client progress,
 *                         matching claimMissionAction's documented posture),
 *                         then award the payout from the deflationary
 *                         reserve (source 'daily') plus any streak milestone
 *   - buyStreakInsurance — burn STREAK_INSURANCE_COST _unSC for a
 *                         STREAK_INSURANCE_DAYS shield against streak loss
 *
 * State rides profiles.mission_state (tolerant hydration). Claimed and
 * rerolled contract ids embed the day key, so stale entries from previous
 * days are inert — writes prune them to keep the blob bounded.
 */

import { createClient } from "@/lib/supabase/server";
import { awardFromReserve, burnUnsc } from "@/lib/game/economy";
import {
  milestoneFor,
  REROLL_COST,
  rollStreak,
  selectDailyContracts,
  selectRerollReplacement,
  STREAK_INSURANCE_COST,
  STREAK_INSURANCE_DAYS,
  utcDayKey,
  type DailyContract,
} from "@/lib/game/daily/engine";
import { hydrateMissionState } from "@/lib/game/missions";
import type { MissionPlayerState } from "@/lib/game/missions/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Shared plumbing ───────────────────────────────────────────────────

interface ProfileState {
  user: { id: string } | null;
  supabase: SupabaseClient;
  state: MissionPlayerState | null;
}

async function loadState(): Promise<ProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, supabase, state: null };

  const res = await supabase
    .from("profiles")
    .select("mission_state")
    .eq("id", user.id)
    .maybeSingle();
  const row = res.data as { mission_state: unknown } | null;
  return { user, supabase, state: hydrateMissionState(row?.mission_state) };
}

async function persistState(
  supabase: SupabaseClient,
  userId: string,
  state: MissionPlayerState,
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ mission_state: state as unknown as Record<string, unknown> } as never)
    .eq("id", userId);
  return !error;
}

const dayPrefix = (dayKey: string) => `${dayKey}:`;

function todaysIds(ids: string[], dayKey: string): string[] {
  return ids.filter((id) => id.startsWith(dayPrefix(dayKey)));
}

/**
 * Resolve a claimable/rerollable contract id for today: either an
 * un-rerolled original, or the derived replacement of a rerolled slot.
 */
function resolveContract(
  userId: string,
  dayKey: string,
  contractId: string,
  rerolledIds: string[],
): DailyContract | null {
  const originals = selectDailyContracts(userId, dayKey);
  for (const c of originals) {
    if (c.contractId === contractId) {
      // A rerolled original is gone — only its replacement is claimable.
      return rerolledIds.includes(c.contractId) ? null : c;
    }
  }
  for (const c of originals) {
    if (!rerolledIds.includes(c.contractId)) continue;
    const replacement = selectRerollReplacement(userId, dayKey, c.slot);
    if (replacement.contractId === contractId) return replacement;
  }
  return null;
}

// ── getDailyState ─────────────────────────────────────────────────────

export interface DailyStateResult {
  ok: boolean;
  dayKey: string;
  contracts: DailyContract[];
  claimedIds: string[];
  rerolledIds: string[];
  streakCount: number;
  streakInsuredUntil: string | null;
  /** True when this load detected (and persisted) a streak lapse. */
  streakBroken: boolean;
  /** True when insurance absorbed a lapse on this load. */
  insuranceUsed: boolean;
  error?: "not_authenticated" | "profile_missing";
}

export async function getDailyState(): Promise<DailyStateResult> {
  const empty: Omit<DailyStateResult, "ok" | "error"> = {
    dayKey: "",
    contracts: [],
    claimedIds: [],
    rerolledIds: [],
    streakCount: 0,
    streakInsuredUntil: null,
    streakBroken: false,
    insuranceUsed: false,
  };

  const { user, supabase, state } = await loadState();
  if (!user) return { ok: false, ...empty, error: "not_authenticated" };
  if (!state) return { ok: false, ...empty, error: "profile_missing" };

  const now = new Date();
  const dayKey = utcDayKey(now);
  const rerolledIds = todaysIds(state.dailyRerolledIds, dayKey);

  // Today's board: un-rerolled originals plus derived replacements.
  const originals = selectDailyContracts(user.id, dayKey);
  const contracts = originals.map((c) =>
    rerolledIds.includes(c.contractId) ? selectRerollReplacement(user.id, dayKey, c.slot) : c,
  );

  // Lazily persist streak decay — only when the roll actually changed
  // something, so quiet loads stay read-only.
  const roll = rollStreak(state, now);
  if (roll.broken || roll.usedInsurance) {
    await persistState(supabase, user.id, {
      ...state,
      streakCount: roll.streakCount,
      // A used shield is consumed; an unused one stays.
      streakInsuredUntil: roll.usedInsurance ? null : state.streakInsuredUntil,
      // Anchor the decayed streak to today so repeat loads don't halve again.
      dailyResetAt: roll.broken ? dayKey : state.dailyResetAt,
    });
  }

  return {
    ok: true,
    dayKey,
    contracts,
    claimedIds: todaysIds(state.dailyClaimedIds, dayKey),
    rerolledIds,
    streakCount: roll.streakCount,
    streakInsuredUntil: roll.usedInsurance ? null : state.streakInsuredUntil,
    streakBroken: roll.broken,
    insuranceUsed: roll.usedInsurance,
  };
}

// ── rerollContract ────────────────────────────────────────────────────

export interface RerollResult {
  ok: boolean;
  /** The derived replacement contract (on success). */
  replacement: DailyContract | null;
  newBalance: number;
  error?:
    | "not_authenticated"
    | "profile_missing"
    | "unknown_contract"
    | "not_rerollable"
    | "already_claimed"
    | "already_rerolled"
    | "insufficient_unsc"
    | "write_failed";
}

export async function rerollContract(contractId: string): Promise<RerollResult> {
  const { user, supabase, state } = await loadState();
  if (!user) return { ok: false, replacement: null, newBalance: 0, error: "not_authenticated" };
  if (!state) return { ok: false, replacement: null, newBalance: 0, error: "profile_missing" };

  const dayKey = utcDayKey(new Date());
  const claimedIds = todaysIds(state.dailyClaimedIds, dayKey);
  const rerolledIds = todaysIds(state.dailyRerolledIds, dayKey);

  // Only an un-rerolled ORIGINAL can be rerolled (one reroll per slot).
  const original = selectDailyContracts(user.id, dayKey).find((c) => c.contractId === contractId);
  if (!original) {
    const rerolled = rerolledIds.includes(contractId);
    return {
      ok: false,
      replacement: null,
      newBalance: 0,
      error: rerolled ? "already_rerolled" : "unknown_contract",
    };
  }
  if (rerolledIds.includes(contractId)) {
    return { ok: false, replacement: null, newBalance: 0, error: "already_rerolled" };
  }
  if (claimedIds.includes(contractId)) {
    return { ok: false, replacement: null, newBalance: 0, error: "already_claimed" };
  }
  if (!original.rerollable) {
    return { ok: false, replacement: null, newBalance: 0, error: "not_rerollable" };
  }

  const burn = await burnUnsc(supabase, {
    userId: user.id,
    amount: REROLL_COST,
    type: "fee",
    description: `daily:reroll:${contractId}`,
    metadata: { source: "daily_reroll", contract_id: contractId },
  });
  if (!burn.ok) {
    return {
      ok: false,
      replacement: null,
      newBalance: burn.newAvailable,
      error: "insufficient_unsc",
    };
  }

  const wrote = await persistState(supabase, user.id, {
    ...state,
    dailyRerolledIds: [...rerolledIds, contractId],
  });
  if (!wrote) {
    // Burn already happened; surface the failure rather than pretending.
    return { ok: false, replacement: null, newBalance: burn.newAvailable, error: "write_failed" };
  }

  return {
    ok: true,
    replacement: selectRerollReplacement(user.id, dayKey, original.slot),
    newBalance: burn.newAvailable,
  };
}

// ── claimContract ─────────────────────────────────────────────────────

export interface ClaimContractResult {
  ok: boolean;
  contractId: string;
  unscAwarded: number;
  /** Extra _unSC from hitting a streak milestone with this claim. */
  milestoneAwarded: number;
  streakCount: number;
  newBalance: number;
  error?:
    | "not_authenticated"
    | "profile_missing"
    | "unknown_contract"
    | "already_claimed"
    | "objective_incomplete"
    | "award_failed"
    | "write_failed";
}

export async function claimContract(
  contractId: string,
  clientProgress?: Record<string, number>,
): Promise<ClaimContractResult> {
  const fail = (
    error: NonNullable<ClaimContractResult["error"]>,
    extras?: Partial<ClaimContractResult>,
  ): ClaimContractResult => ({
    ok: false,
    contractId,
    unscAwarded: 0,
    milestoneAwarded: 0,
    streakCount: 0,
    newBalance: 0,
    ...extras,
    error,
  });

  const { user, supabase, state } = await loadState();
  if (!user) return fail("not_authenticated");
  if (!state) return fail("profile_missing");

  const now = new Date();
  const dayKey = utcDayKey(now);
  const claimedIds = todaysIds(state.dailyClaimedIds, dayKey);
  const rerolledIds = todaysIds(state.dailyRerolledIds, dayKey);

  if (claimedIds.includes(contractId)) {
    return fail("already_claimed", { streakCount: state.streakCount });
  }

  const contract = resolveContract(user.id, dayKey, contractId, rerolledIds);
  if (!contract) return fail("unknown_contract");

  // ── Verify completion ────────────────────────────────────────────────
  const obj = contract.objective;
  if (obj.type === "craft_count") {
    // Server-authoritative: count claimed production jobs for the target
    // recipe since UTC midnight. The client cannot forge these rows.
    const jobsRes = await supabase
      .from("production_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("recipe_id", obj.target)
      .eq("status", "claimed")
      .gte("claimed_at", `${dayKey}T00:00:00Z`);
    if ((jobsRes.count ?? 0) < obj.targetValue) {
      return fail("objective_incomplete", { streakCount: state.streakCount });
    }
  } else {
    // command / resource_threshold: client-derived progress, same trust
    // posture as claimMissionAction. Templates keep these at the lowest
    // payout tier.
    const progress = clientProgress?.[obj.id] ?? 0;
    const satisfied =
      obj.comparison === "lte" ? progress <= obj.targetValue : progress >= obj.targetValue;
    if (!satisfied) {
      return fail("objective_incomplete", { streakCount: state.streakCount });
    }
  }

  // ── Streak roll (first claim of the day advances the streak) ─────────
  const isFirstClaimToday = state.dailyResetAt !== dayKey;
  let streakCount = state.streakCount;
  let streakInsuredUntil = state.streakInsuredUntil;
  if (isFirstClaimToday) {
    const roll = rollStreak(state, now);
    streakCount = roll.streakCount + 1;
    if (roll.usedInsurance) streakInsuredUntil = null;
  }

  // ── Award payout (reserve-funded, deflationary) ──────────────────────
  const award = await awardFromReserve(supabase, {
    userId: user.id,
    amount: contract.payout,
    source: "daily",
    ref: `daily:${contractId}`,
  });
  if (!award.ok) {
    return fail("award_failed", { streakCount: state.streakCount });
  }

  let newBalance = award.newUserBalance;
  let milestoneAwarded = 0;
  const milestone = isFirstClaimToday ? milestoneFor(streakCount) : null;
  if (milestone) {
    const bonus = await awardFromReserve(supabase, {
      userId: user.id,
      amount: milestone,
      source: "daily",
      ref: `streak:${dayKey}:${streakCount}`,
    });
    // A failed milestone bonus doesn't fail the claim — the contract
    // payout already landed.
    if (bonus.ok) {
      milestoneAwarded = milestone;
      newBalance = bonus.newUserBalance;
    }
  }

  // ── Persist (prune stale-day entries to keep the blob bounded) ───────
  const wrote = await persistState(supabase, user.id, {
    ...state,
    dailyResetAt: dayKey,
    dailyClaimedIds: [...claimedIds, contractId],
    dailyRerolledIds: rerolledIds,
    streakCount,
    streakInsuredUntil,
  });
  if (!wrote) {
    // Money already moved — report success so the client doesn't retry
    // into a double-claim; the next load re-derives a consistent board.
    console.warn(`[daily] award succeeded but state write failed for ${contractId}`);
  }

  return {
    ok: true,
    contractId,
    unscAwarded: contract.payout,
    milestoneAwarded,
    streakCount,
    newBalance,
  };
}

// ── buyStreakInsurance ────────────────────────────────────────────────

export interface BuyInsuranceResult {
  ok: boolean;
  streakInsuredUntil: string | null;
  newBalance: number;
  error?:
    | "not_authenticated"
    | "profile_missing"
    | "already_insured"
    | "insufficient_unsc"
    | "write_failed";
}

export async function buyStreakInsurance(): Promise<BuyInsuranceResult> {
  const { user, supabase, state } = await loadState();
  if (!user)
    return { ok: false, streakInsuredUntil: null, newBalance: 0, error: "not_authenticated" };
  if (!state)
    return { ok: false, streakInsuredUntil: null, newBalance: 0, error: "profile_missing" };

  const now = new Date();
  const dayKey = utcDayKey(now);
  if (state.streakInsuredUntil && state.streakInsuredUntil >= dayKey) {
    return {
      ok: false,
      streakInsuredUntil: state.streakInsuredUntil,
      newBalance: 0,
      error: "already_insured",
    };
  }

  const burn = await burnUnsc(supabase, {
    userId: user.id,
    amount: STREAK_INSURANCE_COST,
    type: "fee",
    description: `daily:insurance:${dayKey}`,
    metadata: { source: "daily_insurance" },
  });
  if (!burn.ok) {
    return {
      ok: false,
      streakInsuredUntil: state.streakInsuredUntil,
      newBalance: burn.newAvailable,
      error: "insufficient_unsc",
    };
  }

  const until = utcDayKey(new Date(now.getTime() + STREAK_INSURANCE_DAYS * 86_400_000));
  const wrote = await persistState(supabase, user.id, {
    ...state,
    streakInsuredUntil: until,
  });
  if (!wrote) {
    return {
      ok: false,
      streakInsuredUntil: state.streakInsuredUntil,
      newBalance: burn.newAvailable,
      error: "write_failed",
    };
  }

  return { ok: true, streakInsuredUntil: until, newBalance: burn.newAvailable };
}

"use server";

/**
 * Production server actions
 * =========================
 *
 * The /lab UI calls these to start, list, claim, and cancel production
 * jobs. The server:
 *   - burns _unSC (economy.ts)
 *   - trusts the client's stated in-game resource deduction (client-side
 *     resources live in player_saves.data, which is the client's blob).
 *     A later phase can move resources server-side; for Phase 4 we keep
 *     the scope tight and only guard the _unSC cost.
 *   - inserts/updates production_jobs rows under RLS
 *
 * `startJob` does NOT deduct client-side resources: the client is
 * expected to call startJob only after verifying and deducting its own
 * resource amounts. The server's job is to validate the UNSC portion of
 * the cost and to persist the job timer.
 */

import { createClient } from "@/lib/supabase/server";
import { burnUnsc } from "@/lib/game/economy";
import { getRecipe } from "@/lib/game/recipes";
import { fromRow, type ProductionJob, type ProductionJobRow } from "@/lib/game/production";
import type { QuestState, StepReward } from "@/lib/game/quests/types";

export interface StartJobResult {
  ok: boolean;
  job?: ProductionJob;
  error?: string;
}

export async function startJob(recipeId: string): Promise<StartJobResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, error: "unknown_recipe" };

  // Burn _unSC first. If this fails, the client never sees an inserted
  // job row and can show the error verbatim.
  if (recipe.unscBurn > 0) {
    const burn = await burnUnsc(supabase, {
      userId: user.id,
      amount: recipe.unscBurn,
      type: "burn",
      description: `start:${recipe.id}`,
      metadata: { recipe_id: recipe.id, phase: "start" },
    });
    if (!burn.ok) {
      return { ok: false, error: burn.error ?? "burn_failed" };
    }
  }

  const now = Date.now();
  const completesAt = new Date(now + recipe.durationSec * 1000).toISOString();

  const insertResult = await supabase
    .from("production_jobs")
    .insert({
      user_id: user.id,
      recipe_id: recipe.id,
      status: "pending",
      started_at: new Date(now).toISOString(),
      completes_at: completesAt,
      metadata: {},
    } as never)
    .select("id, user_id, recipe_id, status, started_at, completes_at, claimed_at, metadata")
    .maybeSingle();

  const row = insertResult.data as ProductionJobRow | null;
  if (insertResult.error || !row) {
    return {
      ok: false,
      error: insertResult.error?.message ?? "insert_failed",
    };
  }

  return { ok: true, job: fromRow(row) };
}

export interface ListJobsResult {
  ok: boolean;
  jobs: ProductionJob[];
  error?: string;
}

export async function listJobs(): Promise<ListJobsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, jobs: [], error: "not_authenticated" };

  const result = await supabase
    .from("production_jobs")
    .select("id, user_id, recipe_id, status, started_at, completes_at, claimed_at, metadata")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  const rows = (result.data as ProductionJobRow[] | null) ?? [];
  return { ok: true, jobs: rows.map(fromRow) };
}

export interface ClaimJobResult {
  ok: boolean;
  job?: ProductionJob;
  /** Rewards the client should apply to its tick engine on success. */
  rewards: StepReward[];
  error?: string;
}

/**
 * Mark a pending job as claimed and return its output rewards so the
 * client can apply them to the tick engine. The server re-validates that
 * the job is complete and owned by the current user.
 */
export async function claimJob(jobId: string): Promise<ClaimJobResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, rewards: [], error: "not_authenticated" };
  }

  const readResult = await supabase
    .from("production_jobs")
    .select("id, user_id, recipe_id, status, started_at, completes_at, claimed_at, metadata")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  const row = readResult.data as ProductionJobRow | null;
  if (!row) return { ok: false, rewards: [], error: "not_found" };

  const job = fromRow(row);
  if (job.status !== "pending") {
    return { ok: false, rewards: [], error: "already_closed" };
  }
  if (job.completesAt > Date.now()) {
    return { ok: false, rewards: [], error: "not_ready" };
  }

  const recipe = getRecipe(job.recipeId);
  if (!recipe) {
    return { ok: false, rewards: [], error: "unknown_recipe" };
  }

  const { error: updateError } = await supabase
    .from("production_jobs")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
    } as never)
    .eq("id", jobId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (updateError) {
    return { ok: false, rewards: [], error: updateError.message };
  }

  // Persist set_flag rewards into quest_state. This is the single
  // server-authoritative path for recipe-induced flags — without it, any
  // downstream mission/quest that gates on e.g. `smt_01_online` would
  // never fire. Non-flag rewards are still applied client-side (resources,
  // capacities) via the returned `rewards` array.
  const flagRewards = recipe.outputs.filter(
    (r): r is Extract<StepReward, { kind: "set_flag" }> => r.kind === "set_flag",
  );
  if (flagRewards.length > 0) {
    const profile = await supabase
      .from("profiles")
      .select("quest_state")
      .eq("id", user.id)
      .maybeSingle();
    const profileRow = profile.data as { quest_state: Record<string, unknown> } | null;
    const qs = (profileRow?.quest_state ?? {}) as Partial<QuestState>;
    const existingFlags = (qs.flags ?? {}) as Record<string, boolean>;
    const nextFlags = { ...existingFlags };
    for (const fr of flagRewards) nextFlags[fr.flag] = fr.value;
    const nextState: QuestState = {
      episodeId: typeof qs.episodeId === "string" ? qs.episodeId : "EP0",
      currentStepIndex: typeof qs.currentStepIndex === "number" ? qs.currentStepIndex : 0,
      completedStepIds: Array.isArray(qs.completedStepIds) ? qs.completedStepIds : [],
      flags: nextFlags,
    };
    await supabase
      .from("profiles")
      .update({ quest_state: nextState as unknown as Record<string, unknown> } as never)
      .eq("id", user.id);
  }

  return {
    ok: true,
    job: { ...job, status: "claimed", claimedAt: Date.now() },
    rewards: recipe.outputs,
  };
}

export interface RushJobResult {
  ok: boolean;
  job?: ProductionJob;
  /** _unSC burned for the rush (also present on insufficient_funds). */
  cost?: number;
  /** Available balance after the burn. */
  newBalance?: number;
  error?: string;
}

/**
 * Instantly finish a pending job for an _unSC fee. Pricing: 1 _unSC per
 * started minute remaining (minimum 1); recipes with a start burn cap the
 * fee at 2x that burn so rushing never dwarfs the recipe's own cost.
 */
export async function rushJob(jobId: string): Promise<RushJobResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const readResult = await supabase
    .from("production_jobs")
    .select("id, user_id, recipe_id, status, started_at, completes_at, claimed_at, metadata")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  const row = readResult.data as ProductionJobRow | null;
  if (!row) return { ok: false, error: "not_found" };

  const job = fromRow(row);
  if (job.status !== "pending") {
    return { ok: false, error: "already_closed" };
  }

  const now = Date.now();
  if (job.completesAt <= now) {
    return { ok: false, error: "already_complete" };
  }

  const recipe = getRecipe(job.recipeId);
  if (!recipe) return { ok: false, error: "unknown_recipe" };

  const remainingMs = job.completesAt - now;
  let cost = Math.max(1, Math.ceil(remainingMs / 60000));
  if (recipe.unscBurn > 0) {
    cost = Math.min(cost, 2 * recipe.unscBurn);
  }

  // Burn first, like startJob: if the fee fails, the job row is untouched
  // and the client can show the error verbatim.
  const burn = await burnUnsc(supabase, {
    userId: user.id,
    amount: cost,
    type: "fee",
    description: `rush:${recipe.id}`,
    metadata: { source: "rush", job_id: job.id },
  });
  if (!burn.ok) {
    return { ok: false, cost, error: burn.error ?? "burn_failed" };
  }

  const rushedAtIso = new Date(now).toISOString();
  const updateResult = await supabase
    .from("production_jobs")
    .update({
      completes_at: rushedAtIso,
      metadata: { ...job.metadata, rushedAt: rushedAtIso, rush_cost: cost },
    } as never)
    .eq("id", jobId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id, user_id, recipe_id, status, started_at, completes_at, claimed_at, metadata")
    .maybeSingle();

  const updated = updateResult.data as ProductionJobRow | null;
  if (updateResult.error || !updated) {
    return {
      ok: false,
      cost,
      newBalance: burn.newAvailable,
      error: updateResult.error?.message ?? "update_failed",
    };
  }

  return { ok: true, job: fromRow(updated), cost, newBalance: burn.newAvailable };
}

export interface CancelJobResult {
  ok: boolean;
  error?: string;
}

export async function cancelJob(jobId: string): Promise<CancelJobResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { error } = await supabase
    .from("production_jobs")
    .update({ status: "cancelled" } as never)
    .eq("id", jobId)
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

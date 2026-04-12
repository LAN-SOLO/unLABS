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
import type { StepReward } from "@/lib/game/quests/types";

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

  return {
    ok: true,
    job: { ...job, status: "claimed", claimedAt: Date.now() },
    rewards: recipe.outputs,
  };
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

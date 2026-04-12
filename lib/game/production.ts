/**
 * Production engine — pure helpers.
 *
 * Framework-free, no imports from React or Supabase. Used on both the
 * server (validation) and the client (progress computation / UI).
 *
 * Job lifecycle:
 *   pending  — inserted by startJob, waiting for completes_at
 *   claimed  — completes_at has passed and the player has claimed it;
 *              outputs have been applied
 *   cancelled — player gave up or the server killed the job
 *
 * A "claimable" job is one whose `status === 'pending'` and whose
 * `completes_at <= now`. The /lab UI surfaces claimable jobs with a glowy
 * button; everything else is either in-progress (progress bar) or
 * historical (dimmed row).
 */

import type { Recipe, RecipeCost } from "./recipes";
import type { ResourceMap } from "./tickEngine";

export type JobStatus = "pending" | "claimed" | "cancelled";

export interface ProductionJob {
  id: string;
  userId: string;
  recipeId: string;
  status: JobStatus;
  startedAt: number; // epoch ms
  completesAt: number; // epoch ms
  claimedAt: number | null;
  metadata: Record<string, unknown>;
}

/** Compute fractional progress in [0, 1]. */
export function computeJobProgress(job: ProductionJob, now: number = Date.now()): number {
  const total = job.completesAt - job.startedAt;
  if (total <= 0) return 1;
  const elapsed = now - job.startedAt;
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 1;
  return elapsed / total;
}

/** Seconds remaining, clamped at 0. */
export function remainingSeconds(job: ProductionJob, now: number = Date.now()): number {
  const remainingMs = job.completesAt - now;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

/** True when a pending job has reached its completion timestamp. */
export function isJobClaimable(job: ProductionJob, now: number = Date.now()): boolean {
  return job.status === "pending" && job.completesAt <= now;
}

export interface CostValidationResult {
  ok: boolean;
  missing: RecipeCost[];
}

/**
 * Verify the player has enough of each cost resource. Does NOT deduct —
 * callers deduct separately so they can roll back on partial failure.
 */
export function validateCost(
  recipe: Recipe,
  resources: ResourceMap,
  unscBalance: number,
): CostValidationResult {
  const missing: RecipeCost[] = [];
  for (const cost of recipe.costs) {
    const have = resources[cost.resourceId]?.amount ?? 0;
    if (have < cost.amount) {
      missing.push({ resourceId: cost.resourceId, amount: cost.amount - have });
    }
  }
  if (unscBalance < recipe.unscBurn) {
    // Model _unSC deficit as a pseudo-resource entry so the UI can report it
    // uniformly. The callers can special-case it by id if they want.
    missing.push({
      // cast is safe — the UI only renders this in "missing cost" context
      resourceId: "unsc" as unknown as RecipeCost["resourceId"],
      amount: recipe.unscBurn - unscBalance,
    });
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Serialize / deserialize helpers for talking to the database. The DB
 * stores `started_at` and `completes_at` as timestamptz ISO strings; we
 * want epoch ms on the client so arithmetic is cheap.
 */
export interface ProductionJobRow {
  id: string;
  user_id: string;
  recipe_id: string;
  status: JobStatus;
  started_at: string;
  completes_at: string;
  claimed_at: string | null;
  metadata: Record<string, unknown> | null;
}

export function fromRow(row: ProductionJobRow): ProductionJob {
  return {
    id: row.id,
    userId: row.user_id,
    recipeId: row.recipe_id,
    status: row.status,
    startedAt: new Date(row.started_at).getTime(),
    completesAt: new Date(row.completes_at).getTime(),
    claimedAt: row.claimed_at ? new Date(row.claimed_at).getTime() : null,
    metadata: row.metadata ?? {},
  };
}

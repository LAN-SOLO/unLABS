"use server";

/**
 * Research server actions
 * =======================
 *
 * Server-authoritative lifecycle for the Nexus research system:
 *
 *   - startResearch   — insert a `research_jobs` row; fails if a job is
 *                       already active, if prereqs aren't met, or if the
 *                       player hasn't built NXS-01 yet.
 *   - claimResearch   — validate completion timestamp, flip claimed_at,
 *                       push node id into profiles.tech_tree_state.unlocked,
 *                       persist any set_flag effects on quest_state, and
 *                       return non-flag rewards for the client to apply.
 *   - cancelResearch  — user-initiated cancel; no refunds (by design).
 *   - listResearch    — returns recent jobs so the UI can show history.
 *
 * The "at most one active job" rule is enforced by a composite read +
 * partial-unique-via-application-check — we don't use a DB unique
 * constraint because cancelled rows should coexist with a new active one.
 */

import { createClient } from "@/lib/supabase/server";
import { burnUnsc } from "@/lib/game/economy";
import { getTechNode } from "@/lib/game/techTree";
import { hydrateTechTreeState, nodeStatus, type TechTreeState } from "@/lib/game/techTree";
import type { QuestState, StepReward } from "@/lib/game/quests/types";

export interface ResearchJobRow {
  id: string;
  userId: string;
  nodeId: string;
  startedAt: number; // epoch ms
  completesAt: number; // epoch ms
  claimedAt: number | null;
  cancelledAt: number | null;
}

interface DbRow {
  id: string;
  user_id: string;
  node_id: string;
  started_at: string;
  completes_at: string;
  claimed_at: string | null;
  cancelled_at: string | null;
}

function fromRow(r: DbRow): ResearchJobRow {
  return {
    id: r.id,
    userId: r.user_id,
    nodeId: r.node_id,
    startedAt: Date.parse(r.started_at),
    completesAt: Date.parse(r.completes_at),
    claimedAt: r.claimed_at ? Date.parse(r.claimed_at) : null,
    cancelledAt: r.cancelled_at ? Date.parse(r.cancelled_at) : null,
  };
}

export interface ListResearchResult {
  ok: boolean;
  jobs: ResearchJobRow[];
  treeState: TechTreeState;
  /** Derived from profiles.quest_state.flags — true only when NXS-01 is built. */
  nexusAvailable: boolean;
  error?: string;
}

export async function listResearch(): Promise<ListResearchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      jobs: [],
      treeState: { unlocked: [], inProgress: null },
      nexusAvailable: false,
      error: "not_authenticated",
    };
  }

  const [jobsRes, profileRes] = await Promise.all([
    supabase
      .from("research_jobs")
      .select("id, user_id, node_id, started_at, completes_at, claimed_at, cancelled_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("tech_tree_state, quest_state")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const rows = (jobsRes.data ?? []) as DbRow[];
  const profileRow = profileRes.data as {
    tech_tree_state: unknown;
    quest_state: Record<string, unknown>;
  } | null;
  const treeState = hydrateTechTreeState(profileRow?.tech_tree_state);
  const flags = ((profileRow?.quest_state as Partial<QuestState> | undefined)?.flags ??
    {}) as Record<string, boolean>;

  return {
    ok: true,
    jobs: rows.map(fromRow),
    treeState,
    nexusAvailable: flags.nexus_built === true,
  };
}

export interface StartResearchResult {
  ok: boolean;
  job?: ResearchJobRow;
  error?:
    | "not_authenticated"
    | "nexus_not_built"
    | "unknown_node"
    | "already_unlocked"
    | "prereqs_not_met"
    | "job_already_active"
    | "insufficient_unsc"
    | "write_failed";
}

export async function startResearch(nodeId: string): Promise<StartResearchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const node = getTechNode(nodeId);
  if (!node) return { ok: false, error: "unknown_node" };

  // Read current tree state + quest flags. We need the NXS-01 gate.
  const profileRes = await supabase
    .from("profiles")
    .select("tech_tree_state, quest_state")
    .eq("id", user.id)
    .maybeSingle();
  const profileRow = profileRes.data as {
    tech_tree_state: unknown;
    quest_state: Record<string, unknown>;
  } | null;
  const treeState = hydrateTechTreeState(profileRow?.tech_tree_state);
  const flags = ((profileRow?.quest_state as Partial<QuestState> | undefined)?.flags ??
    {}) as Record<string, boolean>;

  if (flags.nexus_built !== true) return { ok: false, error: "nexus_not_built" };
  if (treeState.unlocked.includes(nodeId)) return { ok: false, error: "already_unlocked" };

  const status = nodeStatus(node, treeState);
  if (status === "locked") return { ok: false, error: "prereqs_not_met" };

  // One active job at a time.
  const activeRes = await supabase
    .from("research_jobs")
    .select("id")
    .eq("user_id", user.id)
    .is("claimed_at", null)
    .is("cancelled_at", null)
    .maybeSingle();
  if (activeRes.data) return { ok: false, error: "job_already_active" };

  // Burn _unSC (client-side in-game resources are trusted per existing
  // production flow; _unSC is the server-authoritative half of the cost).
  if (node.unscBurn > 0) {
    const burn = await burnUnsc(supabase, {
      userId: user.id,
      amount: node.unscBurn,
      type: "research",
      description: `research:${node.id}`,
      metadata: { source: "research", node_id: node.id },
    });
    if (!burn.ok) return { ok: false, error: "insufficient_unsc" };
  }

  const startedAt = new Date();
  const completesAt = new Date(startedAt.getTime() + node.durationSec * 1000);

  const insertRes = await supabase
    .from("research_jobs")
    .insert({
      user_id: user.id,
      node_id: node.id,
      started_at: startedAt.toISOString(),
      completes_at: completesAt.toISOString(),
    } as never)
    .select("id, user_id, node_id, started_at, completes_at, claimed_at, cancelled_at")
    .maybeSingle();

  const insertedRow = insertRes.data as DbRow | null;
  if (!insertedRow) return { ok: false, error: "write_failed" };

  // Mirror inProgress into profiles.tech_tree_state.
  const nextTree: TechTreeState = { ...treeState, inProgress: node.id };
  await supabase
    .from("profiles")
    .update({ tech_tree_state: nextTree as unknown as Record<string, unknown> } as never)
    .eq("id", user.id);

  return { ok: true, job: fromRow(insertedRow) };
}

export interface ClaimResearchResult {
  ok: boolean;
  /** Rewards for the client to apply to GameTickProvider. */
  rewards: StepReward[];
  /** The node id just unlocked. */
  nodeId?: string;
  error?:
    | "not_authenticated"
    | "not_found"
    | "not_ready"
    | "already_closed"
    | "unknown_node"
    | "write_failed";
}

export async function claimResearch(jobId: string): Promise<ClaimResearchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, rewards: [], error: "not_authenticated" };

  const readRes = await supabase
    .from("research_jobs")
    .select("id, user_id, node_id, started_at, completes_at, claimed_at, cancelled_at")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  const row = readRes.data as DbRow | null;
  if (!row) return { ok: false, rewards: [], error: "not_found" };

  const job = fromRow(row);
  if (job.claimedAt != null || job.cancelledAt != null) {
    return { ok: false, rewards: [], error: "already_closed" };
  }
  if (job.completesAt > Date.now()) {
    return { ok: false, rewards: [], error: "not_ready" };
  }

  const node = getTechNode(job.nodeId);
  if (!node) return { ok: false, rewards: [], error: "unknown_node" };

  // Flip claimed_at.
  const { error: updateErr } = await supabase
    .from("research_jobs")
    .update({ claimed_at: new Date().toISOString() } as never)
    .eq("id", jobId)
    .eq("user_id", user.id)
    .is("claimed_at", null)
    .is("cancelled_at", null);
  if (updateErr) return { ok: false, rewards: [], error: "write_failed" };

  // Merge effects: push to tech_tree_state, persist flags, return resource
  // rewards for the client to apply optimistically.
  const profileRes = await supabase
    .from("profiles")
    .select("tech_tree_state, quest_state")
    .eq("id", user.id)
    .maybeSingle();
  const profileRow = profileRes.data as {
    tech_tree_state: unknown;
    quest_state: Record<string, unknown>;
  } | null;
  const treeState = hydrateTechTreeState(profileRow?.tech_tree_state);
  const nextTree: TechTreeState = {
    unlocked: treeState.unlocked.includes(node.id)
      ? treeState.unlocked
      : [...treeState.unlocked, node.id],
    inProgress: treeState.inProgress === node.id ? null : treeState.inProgress,
  };

  const qs = (profileRow?.quest_state ?? {}) as Partial<QuestState>;
  const existingFlags = (qs.flags ?? {}) as Record<string, boolean>;
  const nextFlags = { ...existingFlags };
  for (const e of node.effects) {
    if (e.kind === "set_flag") nextFlags[e.flag] = e.value;
  }
  const nextQuestState: QuestState = {
    episodeId: typeof qs.episodeId === "string" ? qs.episodeId : "EP0",
    currentStepIndex: typeof qs.currentStepIndex === "number" ? qs.currentStepIndex : 0,
    completedStepIds: Array.isArray(qs.completedStepIds) ? qs.completedStepIds : [],
    flags: nextFlags,
  };

  await supabase
    .from("profiles")
    .update({
      tech_tree_state: nextTree as unknown as Record<string, unknown>,
      quest_state: nextQuestState as unknown as Record<string, unknown>,
    } as never)
    .eq("id", user.id);

  return { ok: true, rewards: node.effects, nodeId: node.id };
}

export interface CancelResearchResult {
  ok: boolean;
  error?: "not_authenticated" | "not_found" | "already_closed" | "write_failed";
}

export async function cancelResearch(jobId: string): Promise<CancelResearchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const readRes = await supabase
    .from("research_jobs")
    .select("id, node_id, claimed_at, cancelled_at")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  const row = readRes.data as {
    id: string;
    node_id: string;
    claimed_at: string | null;
    cancelled_at: string | null;
  } | null;
  if (!row) return { ok: false, error: "not_found" };
  if (row.claimed_at != null || row.cancelled_at != null) {
    return { ok: false, error: "already_closed" };
  }

  const { error } = await supabase
    .from("research_jobs")
    .update({ cancelled_at: new Date().toISOString() } as never)
    .eq("id", jobId)
    .eq("user_id", user.id)
    .is("claimed_at", null)
    .is("cancelled_at", null);
  if (error) return { ok: false, error: "write_failed" };

  // Clear inProgress if we just cancelled the active node.
  const profileRes = await supabase
    .from("profiles")
    .select("tech_tree_state")
    .eq("id", user.id)
    .maybeSingle();
  const treeState = hydrateTechTreeState(
    (profileRes.data as { tech_tree_state: unknown } | null)?.tech_tree_state,
  );
  if (treeState.inProgress === row.node_id) {
    const nextTree: TechTreeState = { ...treeState, inProgress: null };
    await supabase
      .from("profiles")
      .update({ tech_tree_state: nextTree as unknown as Record<string, unknown> } as never)
      .eq("id", user.id);
  }

  return { ok: true };
}

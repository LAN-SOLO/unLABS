/**
 * Tech-tree engine — pure helpers.
 *
 * Framework-free. Used on both the server (validation) and the client
 * (status rendering).
 */

import type {
  TechCost,
  TechNode,
  TechNodeStatus,
  TechNodeWithStatus,
  TechTreeState,
} from "./types";
import type { ResourceMap } from "@/lib/game/tickEngine";

export function nodeStatus(node: TechNode, state: TechTreeState): TechNodeStatus {
  if (state.unlocked.includes(node.id)) return "unlocked";
  if (state.inProgress === node.id) return "in_progress";
  const requirementsMet = node.requires.every((req) => state.unlocked.includes(req));
  return requirementsMet ? "available" : "locked";
}

export function nodeProgress(
  node: TechNode,
  state: TechTreeState,
  now: number,
  activeJobStartedAt: number | null,
): number {
  if (state.inProgress !== node.id || activeJobStartedAt == null) return 0;
  const elapsed = (now - activeJobStartedAt) / 1000;
  if (elapsed <= 0) return 0;
  if (elapsed >= node.durationSec) return 1;
  return elapsed / node.durationSec;
}

export interface CostCheckResult {
  ok: boolean;
  missing: TechCost[];
}

export function canAffordCosts(costs: TechCost[], resources: ResourceMap): CostCheckResult {
  const missing: TechCost[] = [];
  for (const c of costs) {
    const have = resources[c.resourceId]?.amount ?? 0;
    if (have < c.amount) {
      missing.push({ resourceId: c.resourceId, amount: c.amount - have });
    }
  }
  return { ok: missing.length === 0, missing };
}

/** Returns the node list enriched with live status + progress. */
export function evaluateTechTree(
  nodes: TechNode[],
  state: TechTreeState,
  now: number,
  activeJobStartedAt: number | null,
): TechNodeWithStatus[] {
  return nodes.map((n) => ({
    ...n,
    status: nodeStatus(n, state),
    progress: nodeProgress(n, state, now, activeJobStartedAt),
  }));
}

/**
 * Partition nodes by tree id. Used by the graph renderer to lay out
 * columns. Stable insertion order.
 */
export function groupByTree<T extends { tree: string }>(nodes: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const n of nodes) {
    const list = out.get(n.tree) ?? [];
    list.push(n);
    out.set(n.tree, list);
  }
  return out;
}

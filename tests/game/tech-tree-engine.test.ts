import { describe, it, expect } from "vitest";

import {
  canAffordCosts,
  createInitialTechTreeState,
  evaluateTechTree,
  getTechNode,
  groupByTree,
  hydrateTechTreeState,
  listTechNodes,
  nodeProgress,
  nodeStatus,
  TECH_NODES,
  TECH_TREES,
  type TechTreeState,
} from "@/lib/game/techTree";
import type { ResourceMap } from "@/lib/game/tickEngine";

describe("tech tree catalog integrity", () => {
  it("has unique node ids", () => {
    const ids = listTechNodes().map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each requires id points to a node in the catalog", () => {
    const ids = new Set(listTechNodes().map((n) => n.id));
    for (const n of listTechNodes()) {
      for (const req of n.requires) {
        expect(ids.has(req)).toBe(true);
      }
    }
  });

  it("ships the 2 MVP trees with at least 3 nodes each", () => {
    const byTree = groupByTree(listTechNodes());
    expect(byTree.get("refine")?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(byTree.get("tools")?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("TECH_TREES lists all eight gameplay trees", () => {
    expect(TECH_TREES).toHaveLength(8);
  });

  it("every node has a positive duration and a non-negative unscBurn", () => {
    for (const n of TECH_NODES) {
      expect(n.durationSec).toBeGreaterThan(0);
      expect(n.unscBurn).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("nodeStatus", () => {
  it("returns unlocked when the node id is in state.unlocked", () => {
    const s: TechTreeState = { unlocked: ["refine.alloy_efficiency.t1"], inProgress: null };
    const n = getTechNode("refine.alloy_efficiency.t1")!;
    expect(nodeStatus(n, s)).toBe("unlocked");
  });

  it("returns in_progress when state.inProgress matches", () => {
    const s: TechTreeState = { unlocked: [], inProgress: "refine.alloy_efficiency.t1" };
    const n = getTechNode("refine.alloy_efficiency.t1")!;
    expect(nodeStatus(n, s)).toBe("in_progress");
  });

  it("returns locked when prereqs aren't satisfied", () => {
    const s = createInitialTechTreeState();
    const n = getTechNode("refine.power_condense.t2")!; // needs t1
    expect(nodeStatus(n, s)).toBe("locked");
  });

  it("returns available when prereqs are satisfied", () => {
    const s: TechTreeState = { unlocked: ["refine.alloy_efficiency.t1"], inProgress: null };
    const n = getTechNode("refine.power_condense.t2")!;
    expect(nodeStatus(n, s)).toBe("available");
  });
});

describe("nodeProgress", () => {
  it("returns 0 when the node isn't in progress", () => {
    const s = createInitialTechTreeState();
    const n = getTechNode("tools.seep_tap.t1")!;
    expect(nodeProgress(n, s, Date.now(), null)).toBe(0);
  });

  it("returns fractional progress while running", () => {
    const n = getTechNode("tools.seep_tap.t1")!; // durationSec = 180
    const s: TechTreeState = { unlocked: [], inProgress: n.id };
    const startedAt = 1_000_000;
    expect(nodeProgress(n, s, startedAt + 90_000, startedAt)).toBeCloseTo(0.5);
  });

  it("clamps at 1 once the duration has elapsed", () => {
    const n = getTechNode("tools.seep_tap.t1")!;
    const s: TechTreeState = { unlocked: [], inProgress: n.id };
    const startedAt = 1_000_000;
    expect(nodeProgress(n, s, startedAt + 500_000, startedAt)).toBe(1);
  });
});

describe("canAffordCosts", () => {
  const resources: ResourceMap = {
    abstractum: { amount: 50, capacity: 100, ratePerSecond: 0 },
    energy: { amount: 200, capacity: 500, ratePerSecond: 0 },
  };

  it("returns ok=true when all costs are covered", () => {
    const r = canAffordCosts(
      [
        { resourceId: "abstractum", amount: 40 },
        { resourceId: "energy", amount: 100 },
      ],
      resources,
    );
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("lists the delta for each missing cost", () => {
    const r = canAffordCosts(
      [
        { resourceId: "abstractum", amount: 60 },
        { resourceId: "energy", amount: 300 },
      ],
      resources,
    );
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([
      { resourceId: "abstractum", amount: 10 },
      { resourceId: "energy", amount: 100 },
    ]);
  });
});

describe("evaluateTechTree", () => {
  it("returns one row per node, enriched with status + progress", () => {
    const state = createInitialTechTreeState();
    const result = evaluateTechTree(TECH_NODES, state, Date.now(), null);
    expect(result).toHaveLength(TECH_NODES.length);
    for (const r of result) {
      expect(["locked", "available", "in_progress", "unlocked"]).toContain(r.status);
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(1);
    }
  });

  it("first-tier nodes are available in a fresh state", () => {
    const state = createInitialTechTreeState();
    const result = evaluateTechTree(TECH_NODES, state, Date.now(), null);
    const tier1 = result.filter((n) => n.tier === 1);
    for (const n of tier1) {
      expect(n.status).toBe("available");
    }
  });
});

describe("hydrateTechTreeState", () => {
  it("returns a fresh state for garbage inputs", () => {
    expect(hydrateTechTreeState(null)).toEqual(createInitialTechTreeState());
    expect(hydrateTechTreeState("string")).toEqual(createInitialTechTreeState());
  });

  it("filters out non-string entries in unlocked", () => {
    const raw = { unlocked: ["a", 123, "b"], inProgress: "c" };
    expect(hydrateTechTreeState(raw)).toEqual({ unlocked: ["a", "b"], inProgress: "c" });
  });

  it("drops non-string inProgress", () => {
    const raw = { unlocked: [], inProgress: 42 };
    expect(hydrateTechTreeState(raw)).toEqual({ unlocked: [], inProgress: null });
  });
});

describe("groupByTree", () => {
  it("preserves insertion order within groups", () => {
    const grouped = groupByTree(listTechNodes());
    const refine = grouped.get("refine");
    expect(refine).toBeDefined();
    // Tier order in the catalog.
    expect(refine!.map((n) => n.tier)).toEqual([1, 2, 3]);
  });
});

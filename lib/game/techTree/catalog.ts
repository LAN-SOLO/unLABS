/**
 * Tech-tree catalog (MVP).
 *
 * Ships with two populated branches (Refine + Tools) — enough to prove the
 * gating, research timer, and claim flow end-to-end. The remaining six
 * trees exist in metadata only (see TECH_TREES) so the graph UI can render
 * placeholder columns. Content for them lands in Workstream #7.
 *
 * Layout: x is the tree column (0..7), y is the tier (1..5). The graph
 * renderer flips y visually so tier 1 sits at the bottom.
 */

import type { TechNode } from "./types";

// ── Refine tree ────────────────────────────────────────────────────────
const REFINE_T1_ALLOY_EFFICIENCY: TechNode = {
  id: "refine.alloy_efficiency.t1",
  title: "Alloy Efficiency",
  description: "Retool the Smelter feed rate. Base Alloy Ingot jobs complete 25 % faster.",
  tree: "refine",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 40 },
    { resourceId: "energy", amount: 300 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [{ kind: "set_flag", flag: "research_alloy_efficiency", value: true }],
  layout: { x: 0, y: 1 },
};

const REFINE_T2_POWER_CONDENSE: TechNode = {
  id: "refine.power_condense.t2",
  title: "Power Condense",
  description: "Condenser upgrade — energy capacity bumped to 1,500.",
  tree: "refine",
  tier: 2,
  requires: ["refine.alloy_efficiency.t1"],
  costs: [
    { resourceId: "base_alloy", amount: 5 },
    { resourceId: "energy", amount: 800 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "energy", capacity: 1500 },
    { kind: "set_flag", flag: "research_power_condense", value: true },
  ],
  layout: { x: 0, y: 2 },
};

const REFINE_T3_NANOMATERIAL_CATALYST: TechNode = {
  id: "refine.nanomaterial_catalyst.t3",
  title: "Nanomaterial Catalyst",
  description:
    "Halves the time to fabricate Nanomaterial Blocks — useful once you're crafting them at scale.",
  tree: "refine",
  tier: 3,
  requires: ["refine.power_condense.t2"],
  costs: [
    { resourceId: "advanced_alloy", amount: 3 },
    { resourceId: "energy", amount: 2000 },
  ],
  unscBurn: 80,
  durationSec: 1800, // 30 min
  effects: [{ kind: "set_flag", flag: "research_nanomaterial_catalyst", value: true }],
  layout: { x: 0, y: 3 },
};

// ── Tools tree ─────────────────────────────────────────────────────────
const TOOLS_T1_SEEP_TAP: TechNode = {
  id: "tools.seep_tap.t1",
  title: "Extended Seep Tap",
  description:
    "Widens the geothermal tap. Abstractum seep climbs from 1 + 2 = 3/min to 5/min total.",
  tree: "tools",
  tier: 1,
  requires: [],
  costs: [{ resourceId: "abstractum", amount: 20 }],
  unscBurn: 10,
  durationSec: 180, // 3 min
  effects: [
    // +2/min over the post-SMT-01 rate of 3/min → 5/min total.
    { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 5 / 60 },
    { kind: "set_flag", flag: "research_seep_tap", value: true },
  ],
  layout: { x: 1, y: 1 },
};

const TOOLS_T2_EXPLORER_DRONE: TechNode = {
  id: "tools.explorer_drone.t2",
  title: "Explorer Drone Protocol",
  description:
    "Teaches the Explorer Drone to prospect for Abstractum veins autonomously. Unlocks EXD-001 deployment missions.",
  tree: "tools",
  tier: 2,
  requires: ["tools.seep_tap.t1", "refine.alloy_efficiency.t1"],
  costs: [
    { resourceId: "base_alloy", amount: 4 },
    { resourceId: "energy", amount: 600 },
  ],
  unscBurn: 30,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 20 / 60 },
    { kind: "set_flag", flag: "research_explorer_drone", value: true },
  ],
  layout: { x: 1, y: 2 },
};

const TOOLS_T3_DRONE_SWARM: TechNode = {
  id: "tools.drone_swarm.t3",
  title: "Drone Swarm",
  description:
    "Coordinates multiple drones on overlapping Abstractum fields. Seep rate jumps to 100/min.",
  tree: "tools",
  tier: 3,
  requires: ["tools.explorer_drone.t2"],
  costs: [
    { resourceId: "advanced_alloy", amount: 2 },
    { resourceId: "energy", amount: 2500 },
  ],
  unscBurn: 100,
  durationSec: 2400, // 40 min
  effects: [
    { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 100 / 60 },
    { kind: "set_flag", flag: "research_drone_swarm", value: true },
  ],
  layout: { x: 1, y: 3 },
};

export const TECH_NODES: TechNode[] = [
  REFINE_T1_ALLOY_EFFICIENCY,
  REFINE_T2_POWER_CONDENSE,
  REFINE_T3_NANOMATERIAL_CATALYST,
  TOOLS_T1_SEEP_TAP,
  TOOLS_T2_EXPLORER_DRONE,
  TOOLS_T3_DRONE_SWARM,
];

export function getTechNode(id: string): TechNode | null {
  return TECH_NODES.find((n) => n.id === id) ?? null;
}

export function listTechNodes(): TechNode[] {
  return TECH_NODES;
}

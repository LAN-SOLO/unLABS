/**
 * Daily contract templates
 * ========================
 *
 * Static catalog of daily contract templates. Each day, 3 of these are
 * deterministically selected per user (see `lib/game/daily/engine.ts`).
 *
 * Objectives reuse the mission objective vocabulary (`TaskObjective` from
 * `lib/game/missions/types.ts`) so the whole game shares one evaluation
 * contract:
 *
 *   - `craft_count`         — target = recipe id (lib/game/recipes.ts),
 *                             server-verifiable against production_jobs
 *   - `command`             — target = terminal command name, run N times
 *   - `resource_threshold`  — target = ResourceId (lib/game/tickEngine.ts),
 *                             only allowed in the lowest payout tier (10)
 *
 * Payouts are in _unSC and must stay within [10, 20].
 * `weight` biases the deterministic selection (higher = more common).
 *
 * Pure data — no React, no IO. Safe to import from client and server.
 */

import type { TaskObjective } from "@/lib/game/missions/types";

export interface DailyContractTemplate {
  /** Stable template id (e.g. "dc_craft_alloy"). Persisted in contract ids. */
  id: string;
  /** Diegetic _unOS-flavored display title. */
  title: string;
  /** Mission-style objective evaluated by the shared objective vocabulary. */
  objective: TaskObjective;
  /** Reward in _unSC on completion. Range: 10–20. */
  payout: number;
  /** Whether the player may reroll this contract (for REROLL_COST). */
  rerollable: boolean;
  /** Selection weight. Higher = more likely to appear. */
  weight: number;
}

export const DAILY_CONTRACT_TEMPLATES: DailyContractTemplate[] = [
  // ── craft_count (server-verifiable against production_jobs) ─────────
  {
    id: "dc_craft_energy_cells",
    title: "Grid Duty: Cell Replenishment",
    objective: {
      id: "dc_craft_energy_cells.obj",
      description: "Craft 5 Energy Cells",
      type: "craft_count",
      target: "energy_cell",
      targetValue: 5,
    },
    payout: 12,
    rerollable: true,
    weight: 3,
  },
  {
    id: "dc_craft_energy_bulk",
    title: "Grid Duty: Surge Reserve",
    objective: {
      id: "dc_craft_energy_bulk.obj",
      description: "Craft 10 Energy Cells",
      type: "craft_count",
      target: "energy_cell",
      targetValue: 10,
    },
    payout: 15,
    rerollable: true,
    weight: 2,
  },
  {
    id: "dc_craft_base_alloy",
    title: "Foundry Ticket: Ingot Quota",
    objective: {
      id: "dc_craft_base_alloy.obj",
      description: "Craft 5 Base Alloy Ingots",
      type: "craft_count",
      target: "base_alloy_ingot",
      targetValue: 5,
    },
    payout: 12,
    rerollable: true,
    weight: 3,
  },
  {
    id: "dc_craft_base_alloy_bulk",
    title: "Foundry Ticket: Double Shift",
    objective: {
      id: "dc_craft_base_alloy_bulk.obj",
      description: "Craft 10 Base Alloy Ingots",
      type: "craft_count",
      target: "base_alloy_ingot",
      targetValue: 10,
    },
    payout: 16,
    rerollable: true,
    weight: 2,
  },
  {
    id: "dc_craft_advanced_alloy",
    title: "Refinement Order: Advanced Batch",
    objective: {
      id: "dc_craft_advanced_alloy.obj",
      description: "Craft 2 Advanced Alloy Ingots",
      type: "craft_count",
      target: "advanced_alloy_ingot",
      targetValue: 2,
    },
    payout: 15,
    rerollable: true,
    weight: 2,
  },
  {
    id: "dc_craft_advanced_bulk",
    title: "Refinement Order: Alloy Overdrive",
    objective: {
      id: "dc_craft_advanced_bulk.obj",
      description: "Craft 3 Advanced Alloy Ingots",
      type: "craft_count",
      target: "advanced_alloy_ingot",
      targetValue: 3,
    },
    payout: 18,
    rerollable: true,
    weight: 1,
  },
  {
    id: "dc_craft_nanomaterial",
    title: "Fabricator Log: Nano Assembly",
    objective: {
      id: "dc_craft_nanomaterial.obj",
      description: "Craft 2 Nanomaterial Blocks",
      type: "craft_count",
      target: "nanomaterial_block",
      targetValue: 2,
    },
    payout: 16,
    rerollable: true,
    weight: 2,
  },
  {
    id: "dc_craft_exotic_crystal",
    title: "Containment Request: Exotic Growth",
    objective: {
      id: "dc_craft_exotic_crystal.obj",
      description: "Craft 1 Exotic Matter Crystal",
      type: "craft_count",
      target: "exotic_matter_crystal",
      targetValue: 1,
    },
    payout: 18,
    rerollable: true,
    weight: 1,
  },
  {
    id: "dc_craft_antimatter",
    title: "Hazard Directive: Vial Synthesis",
    objective: {
      id: "dc_craft_antimatter.obj",
      description: "Craft 1 Antimatter Vial",
      type: "craft_count",
      target: "antimatter_vial",
      targetValue: 1,
    },
    payout: 20,
    rerollable: false,
    weight: 1,
  },

  // ── command (terminal command executed N times) ─────────────────────
  {
    id: "dc_cmd_status",
    title: "Sysadmin Ritual: Morning Diagnostics",
    objective: {
      id: "dc_cmd_status.obj",
      description: "Run `status` 3 times",
      type: "command",
      target: "status",
      targetValue: 3,
    },
    payout: 10,
    rerollable: true,
    weight: 3,
  },
  {
    id: "dc_cmd_scan",
    title: "Field Sweep: Anomaly Watch",
    objective: {
      id: "dc_cmd_scan.obj",
      description: "Run `scan` 2 times",
      type: "command",
      target: "scan",
      targetValue: 2,
    },
    payout: 12,
    rerollable: true,
    weight: 2,
  },
  {
    id: "dc_cmd_harmonize",
    title: "Resonance Shift: Tuning Session",
    objective: {
      id: "dc_cmd_harmonize.obj",
      description: "Run `harmonize` 3 times",
      type: "command",
      target: "harmonize",
      targetValue: 3,
    },
    payout: 14,
    rerollable: true,
    weight: 2,
  },
  {
    id: "dc_cmd_power",
    title: "Load Audit: Power Ledger",
    objective: {
      id: "dc_cmd_power.obj",
      description: "Run `power` 2 times",
      type: "command",
      target: "power",
      targetValue: 2,
    },
    payout: 10,
    rerollable: false,
    weight: 2,
  },

  // ── resource_threshold (lowest payout tier ONLY — payout 10) ────────
  {
    id: "dc_res_energy",
    title: "Reserve Mandate: Charged Buffers",
    objective: {
      id: "dc_res_energy.obj",
      description: "Hold at least 500 Energy",
      type: "resource_threshold",
      target: "energy",
      targetValue: 500,
    },
    payout: 10,
    rerollable: true,
    weight: 2,
  },
  {
    id: "dc_res_abstractum",
    title: "Reserve Mandate: Abstractum Float",
    objective: {
      id: "dc_res_abstractum.obj",
      description: "Hold at least 200 Abstractum",
      type: "resource_threshold",
      target: "abstractum",
      targetValue: 200,
    },
    payout: 10,
    rerollable: true,
    weight: 2,
  },
];

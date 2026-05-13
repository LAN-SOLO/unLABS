/**
 * Tech tree types
 * ===============
 *
 * Framework-free. Safe to import from both server actions and client
 * providers. Each TechNode has:
 *
 *   - id          stable persist key
 *   - tree        one of the 8 gameplay trees (MVP ships 2)
 *   - tier        1..5 progression gate
 *   - requires    list of node ids that must be unlocked first (DAG)
 *   - costs       resource + _unSC costs deducted at research start
 *   - durationSec wall-clock duration of the research job
 *   - effects     StepReward[] — applied on claim (flag grants, rate
 *                 changes, recipe unlocks etc. — same vocabulary as the
 *                 rest of the game)
 *
 * Layout hints (x/y) let the graph UI stay deterministic across sessions
 * and avoid a force-directed layout pass. The coordinates are logical
 * units; the renderer maps them to SVG coords.
 */

import type { StepReward } from "@/lib/game/quests/types";
import type { ResourceId } from "@/lib/game/tickEngine";

export type TechTreeId =
  | "refine"
  | "tools"
  | "optics"
  | "adapters"
  | "synthesizers"
  | "science"
  | "devices"
  | "gadgets";

export type TechTier = 1 | 2 | 3 | 4 | 5;

export interface TechCost {
  resourceId: ResourceId;
  amount: number;
}

export interface TechNode {
  id: string;
  title: string;
  description: string;
  tree: TechTreeId;
  tier: TechTier;
  /** Node ids that must already be unlocked. */
  requires: string[];
  /** Resource costs deducted when research starts. */
  costs: TechCost[];
  /** _unSC burned via awardFromReserve reverse path on start (optional). */
  unscBurn: number;
  /** Research duration in seconds. */
  durationSec: number;
  /** Effects applied on claim (same reward vocabulary as quests/missions). */
  effects: StepReward[];
  /** Logical x/y for graph layout. */
  layout: { x: number; y: number };
}

export interface TechTreeMeta {
  id: TechTreeId;
  label: string;
  /** Tailwind-safe CSS color for branch tinting on the graph. */
  color: string;
  /** One-liner shown as a legend entry. */
  tagline: string;
}

export const TECH_TREES: TechTreeMeta[] = [
  {
    id: "refine",
    label: "Refine",
    color: "text-amber-300",
    tagline: "Material synthesis chains and smelting efficiency.",
  },
  {
    id: "tools",
    label: "Tools",
    color: "text-cyan-300",
    tagline: "Resource collection automation and drones.",
  },
  {
    id: "optics",
    label: "Optics",
    color: "text-fuchsia-300",
    tagline: "Light + wavelength control (stubbed for MVP).",
  },
  {
    id: "adapters",
    label: "Adapters",
    color: "text-lime-300",
    tagline: "Blockchain oracle integration (stubbed for MVP).",
  },
  {
    id: "synthesizers",
    label: "Synthesizers",
    color: "text-pink-300",
    tagline: "Slice / crystal deterministic fabrication (stubbed).",
  },
  {
    id: "science",
    label: "Science",
    color: "text-sky-300",
    tagline: "Research speed and knowledge unlocks (stubbed).",
  },
  {
    id: "devices",
    label: "Devices",
    color: "text-green-300",
    tagline: "Physical crystal structure (stubbed).",
  },
  {
    id: "gadgets",
    label: "Gadgets",
    color: "text-orange-300",
    tagline: "Utility + cross-tree synergies (stubbed).",
  },
];

export interface TechTreeState {
  /** Node ids the player has successfully claimed. */
  unlocked: string[];
  /** Node id of the currently-running research job (at most one in MVP). */
  inProgress: string | null;
}

export function createInitialTechTreeState(): TechTreeState {
  return { unlocked: [], inProgress: null };
}

export function hydrateTechTreeState(raw: unknown): TechTreeState {
  if (!raw || typeof raw !== "object") return createInitialTechTreeState();
  const obj = raw as Partial<TechTreeState>;
  return {
    unlocked: Array.isArray(obj.unlocked)
      ? obj.unlocked.filter((v): v is string => typeof v === "string")
      : [],
    inProgress: typeof obj.inProgress === "string" ? obj.inProgress : null,
  };
}

export type TechNodeStatus =
  | "locked" // prereqs not satisfied
  | "available" // researchable now
  | "in_progress" // currently running
  | "unlocked"; // claimed

export interface TechNodeWithStatus extends TechNode {
  status: TechNodeStatus;
  /** Fractional progress in [0, 1], only meaningful when status == in_progress. */
  progress: number;
}

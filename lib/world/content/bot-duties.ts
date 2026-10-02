/**
 * Bot duties — what each lore bot does in the lab (data). docs/OPS.md.
 * ====================================================================
 *
 * Source: the design database (unlabsdatabase, 01_GAME_DESIGN/social/):
 * GD_SOCIAL_bot-catalog_v1_0.md §2 "In-Game Agents" (Specialty), §3
 * "Infrastructure Daemons", GD_SOCIAL_bot-org-structure_v1_0.md
 * "Department-to-Bot Assignment Matrix" and GD_SOCIAL_bot-network_v1_0.md
 * ("In-Game Role" per bot). The quotes below are from those files; the
 * `effect` is how the role acts on the lab's systems (lib/world/ops/bots.ts).
 *
 * Every bot also has the `service` duty: a visit to its floor's service
 * dock (`service_dock` decor next to its home, content/interior.ts) that
 * clears its wear.
 */
import { tr } from "@/lib/i18n";

export type DutyEffect =
  | "patrol"
  | "signal"
  | "verify"
  | "recover"
  | "macro"
  | "optimise"
  | "monitor"
  | "crawl"
  | "catalogue"
  | "coordinate"
  | "service";

export interface BotDuty {
  id: string;
  bot: string;
  label: string;
  /** What it does, in the game. */
  blurb: string;
  /** The design database's line this duty comes from. */
  source: string;
  effect: DutyEffect;
  /** Default repeat interval (play seconds) at upgrade level 0. */
  every: number;
  /** Wear per run (0…100). */
  wear: number;
  /** Runs on its own timetable only — the player cannot schedule it (X0-R8T). */
  ownSchedule?: boolean;
}

export const BOT_DUTIES: readonly BotDuty[] = [
  {
    id: "f1ndr_patrol",
    bot: "f1ndr",
    label: tr("Signal patrol"),
    blurb: tr(
      "Walks the rooms of its level, counts the days and sweeps the dust off what nobody uses.",
    ),
    source: "bot-org-structure: F1N-DR | EXEC | COMM | Network Elder",
    effect: "patrol",
    every: 600,
    wear: 8,
  },
  {
    id: "x0r8t_signal",
    bot: "x0r8t",
    label: tr("Void transmission"),
    blurb: tr("Listens to the void and drops what it hears — when it wants to."),
    source: "bot-org-structure: X0-R8T | — | Unassigned (ANOMALOUS, outputs on own schedule)",
    effect: "signal",
    every: 1500,
    wear: 4,
    ownSchedule: true,
  },
  {
    id: "l0g1k_verify",
    bot: "l0g1k",
    label: tr("Verify research chains"),
    blurb: tr("Checks the Nexus research chain and clears the cycle for the next run."),
    source: "bot-catalog: L0G-1K — Logic verification. Validates research chains",
    effect: "verify",
    every: 480,
    wear: 10,
  },
  {
    id: "p1ndr0_recover",
    bot: "p1ndr0",
    label: tr("Lost item recovery"),
    blurb: tr("Tracks down the missing parts of a picked-over spot so it can be searched again."),
    source:
      "bot-catalog: P1N-DR0 — Lost item recovery. Locates misplaced _unSLC slices and tracks down missing components",
    effect: "recover",
    every: 420,
    wear: 12,
  },
  {
    id: "r3tr0_macro",
    bot: "r3tr0",
    label: tr("Terminal macro"),
    blurb: tr("Runs one of Jade's routines for her, step by step, as a terminal macro."),
    source: "bot-org-structure: R3-TR0 | UNOS | Terminal customization",
    effect: "macro",
    every: 900,
    wear: 10,
  },
  {
    id: "b4c0n_optimise",
    bot: "b4c0n",
    label: tr("Optimisation review"),
    blurb: tr("Reviews every agent and plans their maintenance — all bots wear less."),
    source:
      "bot-catalog: B4C-0N — Optimization advisor; org-structure: Optimization, personnel reviews",
    effect: "optimise",
    every: 900,
    wear: 6,
  },
  {
    id: "d3c4d3_monitor",
    bot: "d3c4d3",
    label: tr("Surveillance watch"),
    blurb: tr(
      "Runs the surveillance station: sweeps every camera and reports what needs attention.",
    ),
    source: "bot-catalog: D3-C4D3 — Visual data emulator",
    effect: "monitor",
    every: 600,
    wear: 6,
  },
  {
    id: "w2rek_crawl",
    bot: "w2rek",
    label: tr("Greenhouse crawl"),
    blurb: tr(
      "Crawls the green rooms: waters the plants and harvests the algae tanks when they overflow.",
    ),
    source: "bot-network: W2-REK — crawler, narrator of the lab",
    effect: "crawl",
    every: 540,
    wear: 12,
  },
  {
    id: "k2ldr_catalogue",
    bot: "k2ldr",
    label: tr("Catalogue the archive"),
    blurb: tr("Files the day's finds and notes — Jade thinks more clearly for a while."),
    source: "bot-org-structure: K2-LDR | COMM | knowledge retrieval, archival",
    effect: "catalogue",
    every: 720,
    wear: 8,
  },
  {
    id: "c8br41n_coordinate",
    bot: "c8br41n",
    label: tr("Coordinate the agents"),
    blurb: tr("Synchronises the bot network: for a while every duty runs faster."),
    source: "bot-catalog: C8-BR41N — Improves all active agents' efficiency by 5-15%",
    effect: "coordinate",
    every: 1200,
    wear: 8,
  },
];

/** The service duty of each bot (id `<bot>_service`). */
export const SERVICE_DUTY: Omit<BotDuty, "id" | "bot"> = {
  label: tr("Service"),
  blurb: tr(
    "Goes to the service station of its level: cleaned, oiled, calibrated — wear back to zero.",
  ),
  source:
    "bot-catalog §3 Infrastructure Daemons (maintenance); bot-network: O4-KR0N maintenance assistant",
  effect: "service",
  every: 0,
  wear: 0,
};

export const DUTY_BY_ID: ReadonlyMap<string, BotDuty> = new Map([
  ...BOT_DUTIES.map((d) => [d.id, d] as const),
  ...BOT_DUTIES.map(
    (d) => [`${d.bot}_service`, { ...SERVICE_DUTY, id: `${d.bot}_service`, bot: d.bot }] as const,
  ),
]);

export function dutiesOf(bot: string): BotDuty[] {
  return [...DUTY_BY_ID.values()].filter((d) => d.bot === bot);
}

/** Materials per upgrade level (1…3). */
export const UPGRADE_COST: readonly Record<string, number>[] = [
  {},
  { servo: 1, platine: 1 },
  { steuermodul: 1, sensorkopf: 1, kabelbaum: 1 },
  { supraleiter: 1, speicherchip: 2, antenne: 1 },
];

/** Duty interval factor per level (faster), and wear factor (sturdier). */
export const LEVEL_SPEED = [1, 0.85, 0.72, 0.6];
export const LEVEL_WEAR = [1, 0.85, 0.7, 0.55];

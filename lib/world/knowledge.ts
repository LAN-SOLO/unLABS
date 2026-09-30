/**
 * Jade's knowledge — what she knows, has done and has processed (pure).
 * =====================================================================
 *
 * Everything here is derived from the save, so it can never drift:
 *
 * - **Areas** (power, building, combining, signals, anomalies, quantum,
 *   systems, people, exploration, body): each collects points from what Jade
 *   has actually learned or done in that field — insights of its threads,
 *   archive finds of its topics, its devices built and operated, recipes,
 *   puzzles, courses, visited rooms … — normalised against everything the
 *   lab offers (0–100 %) and mapped to a level.
 * - **Experience** (XP) and **rank** from her activities.
 * - **Processed information**: counts of everything she has taken in.
 *
 * UI: the knowledge panel (components/world/knowledge/*), the computer.
 */
import { tr } from "@/lib/i18n";
import { ARCHIVE } from "@/lib/world/content/archive";
import type { ArchiveTopic } from "@/lib/world/content/archive";
import { COURSES } from "@/lib/world/content/courses";
import { DEVICES, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { RECIPES } from "@/lib/world/content/items";
import { ROOMS } from "@/lib/world/content/map";
import { INSIGHTS, NPCS } from "@/lib/world/content/story";
import { features, installedVersion, isUpdated, manifestOf } from "@/lib/world/firmware";
import { isBuilt, power, stagesDone } from "@/lib/world/game";
import { HUBS, linksOf } from "@/lib/world/links";
import type { InsightDef, KnowledgeArea, WorldState } from "@/lib/world/types";

export const AREAS: readonly KnowledgeArea[] = [
  "power",
  "building",
  "combining",
  "signals",
  "anomalies",
  "quantum",
  "systems",
  "people",
  "exploration",
  "body",
];

export const AREA_LABEL: Readonly<Record<KnowledgeArea, string>> = {
  power: tr("area::Power"),
  building: tr("area::Building & fabrication"),
  combining: tr("area::Combining"),
  signals: tr("area::Signals"),
  anomalies: tr("area::Anomalies"),
  quantum: tr("area::Quantum physics"),
  systems: tr("area::Systems & networks"),
  people: tr("area::People & bots"),
  exploration: tr("area::Exploration"),
  body: tr("area::Body & rhythm"),
};

/** What raises an area (shown in the knowledge panel). */
export const AREA_HOW: Readonly<Record<KnowledgeArea, string>> = {
  power: tr(
    "Build and read out the generators, batteries and the power controller; insights on the grid; power finds in the archive; power courses.",
  ),
  building: tr(
    "Every build stage in the lab, salvaging and 3D prints; the fabrication devices; building and device finds in the archive.",
  ),
  combining: tr(
    "Recipes discovered, prototypes, named archetypes and experiments at the workbench; combining finds in the archive.",
  ),
  signals: tr(
    "Build and read out the receivers and analysers; solve their puzzles; the signal insights and puzzle finds.",
  ),
  anomalies: tr(
    "Anomaly detectors, the dimension monitor and the capsule; their puzzles; anomaly and Halo insights.",
  ),
  quantum: tr("The quantum devices and the teleporter; their puzzles; insights on the relic."),
  systems: tr(
    "The MCP, network and system devices; firmware flashed, hub links made, room terminals used; firmware and network finds.",
  ),
  people: tr(
    "Wake the bots, talk to everyone (and ask the questions), insights on Damien and the bots, lore finds.",
  ),
  exploration: tr(
    "Visit rooms, pick things up, open doors, fly the drone; basics, door and secret finds in the archive.",
  ),
  body: tr("Fitness, workouts on the ergometer, sleep and proper meals."),
};

/** Devices whose construction and operation count for an area. */
export const AREA_DEVICES: Readonly<Record<KnowledgeArea, readonly string[]>> = {
  power: ["UEC-001", "BAT-001", "PWR-001", "PWD-001", "VLT-001", "MFR-001"],
  building: ["BTK-001", "PWB-001", "P3D-001", "LCT-001", "NXS-01", "RMG-001", "ATK-001"],
  combining: ["PWB-001", "MSC-001", "ATK-001"],
  signals: ["ECR-001", "SPK-001", "HMS-001", "OSC-001", "INT-001", "CDC-001"],
  anomalies: ["AND-001", "DIM-001", "QCP-001", "MSC-001", "EXD-001"],
  quantum: ["EMC-001", "QSM-001", "QAN-001", "AIC-001", "SCA-001", "TLP-001"],
  systems: [
    "MCP-000",
    "NET-001",
    "DGN-001",
    "CPU-001",
    "MEM-001",
    "CLK-001",
    "THM-001",
    "TMP-001",
    "VNT-001",
  ],
  people: [],
  exploration: ["EXD-001", "QCP-001"],
  body: [],
};

export const AREA_THREADS: Readonly<Record<KnowledgeArea, readonly InsightDef["thread"][]>> = {
  power: ["strom"],
  building: [],
  combining: [],
  signals: ["signal"],
  anomalies: ["anomalie", "halo"],
  quantum: ["relikt"],
  systems: [],
  people: ["damien", "bots"],
  exploration: [],
  body: [],
};

export const AREA_TOPICS: Readonly<Record<KnowledgeArea, readonly ArchiveTopic[]>> = {
  power: ["power"],
  building: ["building", "devices"],
  combining: ["combine", "items"],
  signals: ["puzzles"],
  anomalies: [],
  quantum: [],
  systems: ["firmware", "network"],
  people: ["bots", "lore"],
  exploration: ["doors", "secrets", "basics"],
  body: [],
};

export interface AreaScore {
  area: KnowledgeArea;
  points: number;
  max: number;
  /** 0…100 */
  pct: number;
  level: number;
  levelLabel: string;
}

export const LEVEL_LABEL: readonly string[] = [
  tr("level::Novice"),
  tr("level::Basics"),
  tr("level::Advanced"),
  tr("level::Experienced"),
  tr("level::Expert"),
  tr("level::Master"),
];
/** Percent needed for level 1…5. */
export const LEVEL_AT = [8, 25, 45, 70, 90] as const;

function levelOf(pct: number): number {
  let l = 0;
  for (const at of LEVEL_AT) if (pct >= at) l++;
  return l;
}

const coursePoints = (s: WorldState, area: KnowledgeArea): [number, number] => {
  const list = COURSES.filter((c) => c.area === area);
  return [list.filter((c) => s.flags[`course_${c.id}`]).length * 6, list.length * 6];
};

/** Points (and the lab's maximum) of one area. */
/**
 * Build stages Jade did herself — the lab hands her some stages at the start
 * (the MCP core ships half-built), which teach her nothing.
 */
const START_STAGES: Readonly<Record<string, number>> = { "MCP-000": 1 };
function learnedStages(s: WorldState, id: string): number {
  return Math.max(0, stagesDone(s, id) - (START_STAGES[id] ?? 0));
}

export function areaScore(s: WorldState, area: KnowledgeArea): AreaScore {
  let points = 0;
  let max = 0;
  const add = (p: number, m: number) => {
    points += p;
    max += m;
  };
  // Devices: built 4, operated (readout on file) 2.
  for (const id of AREA_DEVICES[area]) {
    add(isBuilt(s, id) ? 4 : Math.min(3, learnedStages(s, id)), 4);
    add(s.readouts[id] ? 2 : 0, 2);
  }
  // Insights of the area's threads.
  const threads = AREA_THREADS[area];
  if (threads.length) {
    const ins = INSIGHTS.filter((i) => threads.includes(i.thread));
    add(ins.filter((i) => s.insights[i.id]).length * 3, ins.length * 3);
  }
  // Archive finds of the area's topics (harder finds weigh more).
  const topics = AREA_TOPICS[area];
  if (topics.length) {
    const arch = ARCHIVE.filter((e) => topics.includes(e.topic));
    add(
      arch.filter((e) => s.archive[e.id] !== undefined).reduce((n, e) => n + e.tier, 0),
      arch.reduce((n, e) => n + e.tier, 0),
    );
  }
  add(...coursePoints(s, area));
  switch (area) {
    case "combining": {
      add(Object.keys(s.recipesKnown).length * 2, RECIPES.length * 2 + 20);
      add(Math.min(20, s.counters.combo_prototype ?? 0), 20);
      add(Math.min(10, s.counters.archetypes ?? 0), 10);
      add(Math.min(15, s.experiments.length), 15);
      break;
    }
    case "building":
      add(
        DEVICES.reduce((n, d) => n + learnedStages(s, d.id), 0),
        DEVICES.reduce((n, d) => n + d.stages.length - (START_STAGES[d.id] ?? 0), 0),
      );
      add(Math.min(20, s.counters.salvaged ?? 0), 20);
      add(Math.min(10, s.counters.prints ?? 0), 10);
      break;
    case "signals":
    case "anomalies":
    case "quantum": {
      const pz = AREA_DEVICES[area].flatMap((d) => (DEVICE_PUZZLES[d] ?? []).map((x) => x.puzzle));
      add(pz.filter((id) => s.puzzles[id]).length * 4, pz.length * 4);
      break;
    }
    case "systems": {
      const fw = DEVICES.length;
      add(Object.keys(s.firmware).length * 3, Math.ceil(fw * 0.5) * 3);
      const links = Object.values(s.links).reduce((n, l) => n + l.length, 0);
      add(Math.min(20, links) * 2, 40);
      add(
        Math.min(15, Object.keys(s.flags).filter((f) => /^terminal_.+_used$/.test(f)).length) * 2,
        30,
      );
      break;
    }
    case "people": {
      const bots = NPCS.filter((n) => n.id !== "damien" && n.id !== "mcp" && n.id !== "unstables");
      add(bots.filter((b) => s.flags[`bot_${b.id}_awake`]).length * 5, bots.length * 5);
      add(Math.min(40, Object.keys(s.flags).filter((f) => f.startsWith("said_")).length), 40);
      add(Math.min(10, NPCS.filter((n) => s.flags[`met_${n.id}`]).length) * 2, 20);
      break;
    }
    case "exploration": {
      add(ROOMS.filter((r) => s.flags[`visited_${r.id}`]).length * 2, ROOMS.length * 2);
      add(Math.min(30, Object.keys(s.taken).length), 30);
      add(Object.keys(s.doorsOpen).length, 10);
      add(Math.min(10, s.counters.drone_runs ?? 0), 10);
      break;
    }
    case "body": {
      add(Math.min(100, s.counters.bio_fit ?? 0) / 5, 20);
      add(Math.min(20, s.counters.bio_trainings ?? 0), 20);
      add(Math.min(10, s.counters.bio_sleeps ?? 0), 10);
      add(Math.min(10, s.counters.bio_meals ?? 0), 10);
      break;
    }
    default:
      break;
  }
  const pct = max > 0 ? Math.min(100, Math.round((points / max) * 100)) : 0;
  const level = levelOf(pct);
  return {
    area,
    points: Math.round(points),
    max: Math.round(max),
    pct,
    level,
    levelLabel: LEVEL_LABEL[level]!,
  };
}

export function allAreas(s: WorldState): AreaScore[] {
  return AREAS.map((a) => areaScore(s, a));
}

// ── Experience & rank ────────────────────────────────────────────

/** XP per unit of each activity (the order of the experience breakdown). */
export const XP_WEIGHT = {
  stages: 20,
  devices: 50,
  recipes: 15,
  prototypes: 25,
  experiments: 3,
  puzzles: 40,
  insights: 10,
  archive: 8,
  firmware: 20,
  links: 10,
  drone: 10,
  salvaged: 3,
  workouts: 5,
  courses: 60,
  memos: 2,
  endings: 300,
} as const;

/** Activity → XP weights (counters and derived counts). */
export function experience(s: WorldState): {
  xp: number;
  parts: { label: string; n: number; xp: number }[];
} {
  const c = (k: string) => s.counters[k] ?? 0;
  const stages = DEVICES.reduce((n, d) => n + learnedStages(s, d.id), 0);
  const devices = DEVICES.filter((d) => isBuilt(s, d.id)).length;
  const parts: { label: string; n: number; w: number }[] = [
    { label: tr("xp::Build stages"), n: stages, w: XP_WEIGHT.stages },
    { label: tr("xp::Devices completed"), n: devices, w: XP_WEIGHT.devices },
    {
      label: tr("xp::Recipes discovered"),
      n: Object.keys(s.recipesKnown).length,
      w: XP_WEIGHT.recipes,
    },
    { label: tr("xp::Prototypes"), n: c("combo_prototype"), w: XP_WEIGHT.prototypes },
    { label: tr("xp::Experiments"), n: s.combos, w: XP_WEIGHT.experiments },
    { label: tr("xp::Puzzles solved"), n: Object.keys(s.puzzles).length, w: XP_WEIGHT.puzzles },
    { label: tr("xp::Insights"), n: Object.keys(s.insights).length, w: XP_WEIGHT.insights },
    { label: tr("xp::Archive finds"), n: Object.keys(s.archive).length, w: XP_WEIGHT.archive },
    { label: tr("xp::Firmware flashed"), n: c("fw_flashed"), w: XP_WEIGHT.firmware },
    { label: tr("xp::Links made"), n: c("links_made"), w: XP_WEIGHT.links },
    { label: tr("xp::Drone flights"), n: c("drone_runs"), w: XP_WEIGHT.drone },
    { label: tr("xp::Items salvaged"), n: c("salvaged"), w: XP_WEIGHT.salvaged },
    { label: tr("xp::Workouts"), n: c("bio_trainings"), w: XP_WEIGHT.workouts },
    { label: tr("xp::Courses completed"), n: c("courses_done"), w: XP_WEIGHT.courses },
    { label: tr("xp::Memos written"), n: c("memos_written"), w: XP_WEIGHT.memos },
    { label: tr("xp::Endings reached"), n: Object.keys(s.endings).length, w: XP_WEIGHT.endings },
  ];
  const out = parts.map((p) => ({ label: p.label, n: p.n, xp: p.n * p.w }));
  return { xp: out.reduce((n, p) => n + p.xp, 0), parts: out };
}

export const RANKS: readonly { xp: number; title: string }[] = [
  { xp: 0, title: tr("rank::Cold starter") },
  { xp: 300, title: tr("rank::Lab assistant") },
  { xp: 1000, title: tr("rank::Technician") },
  { xp: 2500, title: tr("rank::Engineer") },
  { xp: 5000, title: tr("rank::Researcher") },
  { xp: 9000, title: tr("rank::Senior researcher") },
  { xp: 14000, title: tr("rank::Lab director") },
  { xp: 20000, title: tr("rank::Keeper of the Halo") },
];

export function rankOf(xp: number): { index: number; title: string; next?: number } {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k]!.xp) i = k;
  const next = RANKS[i + 1]?.xp;
  return { index: i, title: RANKS[i]!.title, ...(next !== undefined ? { next } : {}) };
}

/** Rank, the next threshold and progress towards it (0…1; 1 at the top rank). */
export function rankProgress(xp: number): {
  index: number;
  title: string;
  from: number;
  next?: number;
  nextTitle?: string;
  frac: number;
} {
  const r = rankOf(xp);
  const from = RANKS[r.index]!.xp;
  if (r.next === undefined) return { index: r.index, title: r.title, from, frac: 1 };
  return {
    index: r.index,
    title: r.title,
    from,
    next: r.next,
    nextTitle: RANKS[r.index + 1]!.title,
    frac: Math.max(0, Math.min(1, (xp - from) / (r.next - from))),
  };
}

// ── System knowledge ─────────────────────────────────────────────

export interface DeviceKnowledge {
  id: string;
  name: string;
  stages: number;
  total: number;
  built: boolean;
  online: boolean;
  /** Last readout (play time) — she has operated it. */
  readoutAt?: number;
  firmware: string;
  updated: boolean;
  /** An update exists for this device. */
  hasUpdate: boolean;
  features: string[];
  /** Hubs this device hangs on. */
  hubs: string[];
  /** It is a hub: the devices linked to it. */
  hubLinks?: readonly string[];
}

/** What Jade knows about every device she has discovered (lab order). */
export function systemKnowledge(s: WorldState): DeviceKnowledge[] {
  const online = power(s).online;
  return DEVICES.filter((d) => s.discovered[d.id] || stagesDone(s, d.id) > 0).map((d) => {
    const built = isBuilt(s, d.id);
    const hub = HUBS.find((h) => h.id === d.id);
    const ro = s.readouts[d.id];
    return {
      id: d.id,
      name: d.name,
      stages: stagesDone(s, d.id),
      total: d.stages.length,
      built,
      online: online.has(d.id),
      ...(ro ? { readoutAt: ro.t } : {}),
      firmware: installedVersion(s, d.id),
      updated: isUpdated(s, d.id),
      hasUpdate: !!manifestOf(d.id)?.update,
      features: built ? features(s, d.id) : [],
      hubs: HUBS.filter((h) => linksOf(s, h.id).includes(d.id)).map((h) => h.id),
      ...(hub ? { hubLinks: linksOf(s, hub.id) } : {}),
    };
  });
}

/** Hubs Jade runs (built hubs with at least one link). */
export function hubsRun(s: WorldState): { id: string; label: string; links: readonly string[] }[] {
  return HUBS.filter((h) => isBuilt(s, h.id) && linksOf(s, h.id).length > 0).map((h) => ({
    id: h.id,
    label: h.label,
    links: linksOf(s, h.id),
  }));
}

// ── Processed information ────────────────────────────────────────

export interface ProcessedInfo {
  insights: number;
  archive: number;
  notes: number;
  mails: number;
  files: number;
  recipes: number;
  readouts: number;
  experiments: number;
  memos: number;
  courses: number;
  total: number;
}

export function processed(s: WorldState): ProcessedInfo {
  const flags = Object.keys(s.flags);
  const p = {
    insights: Object.keys(s.insights).length,
    archive: Object.keys(s.archive).length,
    notes: Object.values(s.read).filter(Boolean).length,
    mails: flags.filter((f) => f.startsWith("terminal_mail_")).length,
    files: flags.filter((f) => f.startsWith("terminal_file_")).length,
    recipes: Object.keys(s.recipesKnown).length,
    readouts: Object.keys(s.readouts).length,
    experiments: s.experiments.length,
    memos: s.memos.length,
    courses: s.counters.courses_done ?? 0,
  };
  return { ...p, total: Object.values(p).reduce((a, b) => a + b, 0) };
}

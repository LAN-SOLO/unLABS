/**
 * Lab World — contextual first-time hints.
 * ========================================
 *
 * Pure rules for the onboarding bubbles: every hint fires at most once
 * (flag `tut_<id>`), only while `settings.gameplay.hints` is on, and never
 * sooner than `hintSpacing()` seconds of play after the previous one
 * (`HINT_SPACING`, shorter while a `hint_boost` buff runs). The
 * React layer polls `nextHint` (~every 500 ms), shows the result in a
 * `HintBubble` and calls `markHintSeen` right away.
 *
 * `keys` entries are either a rebindable `ControlAction` (the bubble shows
 * the key currently bound) or a literal key label like "M" or "V".
 *
 * The first ten minutes teach, each at the moment it matters: moving
 * (right after the cold open, while still in the control room), using
 * things (first container in view), the inventory (first loot), puzzles
 * (the geothermal valve), combining at the workbench (a blueprint slot
 * that lacks a property), the power overview (first watt), the elevator
 * (with and without power), the journal, the map (first new floor) and
 * the wall cutaway. World hints stay quiet while any panel is open.
 */
import { tr } from "@/lib/i18n";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { DOORS, PICKUPS, PROPS } from "@/lib/world/content/map";
import { NPCS } from "@/lib/world/content/story";
import { checkStage, doorIsOpen, isBuilt, pickupNeedsTool, power } from "@/lib/world/game";
import { buffMultiplier } from "@/lib/world/buffs";
import { VOLATILITY_LIMIT } from "@/lib/world/combine";
import type { FloorId, WorldState } from "@/lib/world/types";

/**
 * Minimum play seconds between two hints (tuned with the realistic-player
 * run in tests/world/pacing.test.ts: at most ~6 bubbles in the first 5 min).
 */
export const HINT_SPACING = 45;
/** A hint never pops up within this many seconds after an ambient bark (`bark:last`). */
export const HINT_AFTER_BARK = 6;
/** Counter holding the play time at which the last hint was shown. */
export const HINT_LAST_COUNTER = "tut_last";

/**
 * Usage signals: world flags the UI sets the first time the player does
 * something on their own (`markUsed`). A hint that teaches an action the
 * player already found is skipped; the play-time floors stay as a
 * secondary gate so the late hints do not crowd the opening minutes.
 */
export const USED_FLAG = {
  camera: "used_camera",
  quicksave: "used_quicksave",
  codex: "used_codex",
  achievements: "used_achievements",
  move: "used_move",
  interact: "used_interact",
  panel: "used_panel",
} as const;
export type UsedAction = keyof typeof USED_FLAG;

/** Has the player already used this action? */
export function hasUsed(s: WorldState, action: UsedAction): boolean {
  return !!s.flags[USED_FLAG[action]];
}

/** Record a usage signal. Returns true if it was new (so callers can skip no-op writes). */
export function markUsed(s: WorldState, action: UsedAction): boolean {
  if (hasUsed(s, action)) return false;
  s.flags[USED_FLAG[action]] = true;
  return true;
}

/** The compact HUD's control legend fades after this much play time at the latest. */
export const LEGEND_FADE_SECONDS = 180;
/** How long the legend comes back after the help panel was opened. */
export const LEGEND_REVEAL_SECONDS = 30;

/** The player has moved, used something and opened a panel on their own. */
export function controlsLearned(s: WorldState): boolean {
  return hasUsed(s, "move") && hasUsed(s, "interact") && hasUsed(s, "panel");
}

/**
 * Is the bottom control legend visible? `full` always, `minimal` never,
 * `compact` until the controls are learned or `LEGEND_FADE_SECONDS` of play
 * passed — and again while `now < revealUntil` (help key pressed).
 */
export function showControlLegend(
  hud: "full" | "compact" | "minimal",
  s: WorldState,
  revealUntil: number | null = null,
  now: number = s.playTime,
): boolean {
  if (hud === "full") return true;
  if (hud === "minimal") return false;
  if (revealUntil !== null && now < revealUntil) return true;
  return !controlsLearned(s) && now < LEGEND_FADE_SECONDS;
}

/** Transient things the UI can report for one poll (optional — most hints read the state). */
export type TutorialEvent =
  | "door_locked"
  | "pickup_partial"
  | "prototype"
  | "explosion"
  | "brownout"
  | "floor_changed";

export interface TutorialContext {
  /** What the player currently looks at (same shape as the engine's `Target`). */
  focus?: { kind: string; id: string } | null;
  room?: string | null;
  floor: FloorId;
  /** Kind of the open overlay (`"workbench"`, `"terminal"`, …) or null. */
  overlay?: string | null;
  /** Current generation in W (`power(s).generation`). */
  powerGeneration: number;
  justHappened?: TutorialEvent | null;
  /** `settings.gameplay.hints`. */
  hintsEnabled: boolean;
  /** The player was hidden behind walls a lot recently (engine heuristic). */
  hiddenBehindWalls?: boolean;
  /** Cutscene running — never interrupt. */
  cinematic?: boolean;
}

export interface Hint {
  id: string;
  title: string;
  text: string;
  keys?: string[];
}

interface HintDef {
  id: string;
  /** Higher wins when several hints are eligible. */
  priority: number;
  title: string;
  keys?: string[];
  /** Returns the text when the hint applies right now, otherwise null. */
  when: (s: WorldState, ctx: TutorialContext) => string | null;
}

/** Overlays during which no hint appears (menus, story moments). */
const QUIET_OVERLAYS: ReadonlySet<string> = new Set([
  "pause",
  "settings",
  "intro",
  "ending",
  "dialogue",
]);

const builtCount = (s: WorldState): number =>
  Object.keys(s.built).filter((id) => isBuilt(s, id)).length;

const visitedCount = (s: WorldState): number =>
  Object.keys(s.flags).filter((f) => f.startsWith("visited_") && s.flags[f]).length;

const insightCount = (s: WorldState): number => Object.keys(s.insights).length;

const achievementsUnlocked = (s: WorldState): number =>
  Object.keys(s.flags).filter((f) => f.startsWith("ach_") && s.flags[f]).length;

const focusOf = (ctx: TutorialContext, kind: string): string | null =>
  ctx.focus && ctx.focus.kind === kind ? ctx.focus.id : null;

/** Walking around with no panel open (world hints only show then). */
const inWorld = (ctx: TutorialContext): boolean => !ctx.overlay;

const itemTotal = (s: WorldState): number =>
  Object.values(s.inventory).reduce((a, b) => a + Math.max(0, b), 0);

const isElevator = (ctx: TutorialContext): boolean =>
  ctx.overlay === "elevator" ||
  (!!focusOf(ctx, "prop") && PROPS.find((p) => p.id === ctx.focus?.id)?.kind === "elevator");

export const HINTS: readonly HintDef[] = [
  {
    id: "brownout",
    priority: 96,
    title: tr("hint::Brownout"),
    keys: ["power"],
    // Only once there is *some* power: the cold start (0 W) is not a brownout.
    when: (s, ctx) =>
      ctx.justHappened === "brownout" ||
      (power(s).generation > 0 && power(s).starved.some((x) => x.reason === "strom"))
        ? tr(
            "More demand than generation: devices further down the priority list switch off. Open the Power Panel and switch consumers off — or build new sources.",
          )
        : null,
  },
  {
    id: "overheat",
    priority: 94,
    title: tr("hint::Overheating"),
    keys: ["power"],
    when: (s) =>
      power(s).starved.some((x) => x.reason === "hitze")
        ? tr(
            "Tier-3 devices only run with active cooling. Without the Thermal Manager (THM-001) online, they stay cold.",
          )
        : null,
  },
  {
    id: "workbench",
    priority: 95,
    title: tr("hint::The Workbench"),
    keys: ["workbench"],
    when: (_s, ctx) =>
      ctx.overlay === "workbench"
        ? tr(
            "Put 2–3 parts into the slots (6 with the Portable Workbench). Known recipes give components, anything else a prototype with mixed traits. The ▲ show volatility: a total above {limit} goes bang.",
            { limit: VOLATILITY_LIMIT },
          )
        : null,
  },
  {
    id: "explosion",
    priority: 92,
    title: tr("hint::That Was Too Much"),
    when: (s, ctx) =>
      ctx.justHappened === "explosion" || s.flags.explosion_seen
        ? tr(
            "Volatility above {limit} — all that is left is slag. Mix fewer ▲ parts; Thermal ≥ 6 calms prototypes down. Slag can be recovered at the Nexus later.",
            { limit: VOLATILITY_LIMIT },
          )
        : null,
  },
  {
    id: "blueprint",
    priority: 90,
    title: tr("hint::Blueprint"),
    keys: ["interact"],
    when: (s, ctx) => {
      const id = focusOf(ctx, "device");
      if (!id || !s.discovered[id] || isBuilt(s, id) || builtCount(s) > 3) return null;
      return tr(
        "Opens the blueprint — frame → core → calibration. Slots take the named part, or any part with enough traits.",
      );
    },
  },
  {
    id: "terminal",
    priority: 88,
    title: tr("hint::Terminal"),
    when: (_s, ctx) =>
      ctx.overlay === "terminal" || ctx.overlay === "boot"
        ? tr("Type “help” for all commands. Tab completes, ↑ brings back the last command.")
        : null,
  },
  {
    id: "door_locked",
    priority: 86,
    title: tr("hint::Locked"),
    keys: ["interact"],
    when: (s, ctx) => {
      const id = focusOf(ctx, "door");
      const d = id ? DOORS.find((x) => x.id === id) : undefined;
      if (ctx.justHappened !== "door_locked" && (!d || d.keypad || doorIsOpen(s, d))) return null;
      return tr(
        "This door needs power — or a tool. Use shows what is missing; the journal remembers it.",
      );
    },
  },
  {
    id: "keypad",
    priority: 84,
    title: tr("hint::Keypad"),
    when: (s, ctx) => {
      const id = focusOf(ctx, "door");
      const d = id ? DOORS.find((x) => x.id === id) : undefined;
      if (!d || !d.keypad || doorIsOpen(s, d)) return null;
      return tr("Codes are in notes, on terminals and in conversations.");
    },
  },
  {
    id: "pickup_tool",
    priority: 85,
    title: tr("hint::Tool Missing"),
    when: (s, ctx) => {
      const id = focusOf(ctx, "pickup");
      const p = id ? PICKUPS.find((x) => x.id === id) : undefined;
      if (ctx.justHappened !== "pickup_partial" && (!p || !pickupNeedsTool(s, p))) return null;
      const tool = DEVICE_BY_ID.get(p?.tool ?? "BTK-001")?.name ?? tr("a tool");
      return tr("By hand you only get the first part. For the rest you need {tool} — online.", {
        tool,
      });
    },
  },
  {
    id: "elevator_nopower",
    priority: 84,
    title: tr("hint::Elevator Without Power"),
    when: (_s, ctx) => {
      if (!isElevator(ctx) || ctx.powerGeneration >= 50) return null;
      return tr(
        "Below 50 W the elevator does not run. You can reach Level −1 (Power & Fabrication) at any time via the Emergency Ladder.",
      );
    },
  },
  {
    id: "elevator",
    priority: 83,
    title: tr("hint::Elevator"),
    keys: ["interact"],
    when: (_s, ctx) =>
      isElevator(ctx) && ctx.powerGeneration >= 50
        ? tr(
            "The elevator runs again. Locked levels show what is missing — more watts, a code or a clearance.",
          )
        : null,
  },
  {
    id: "power_panel",
    priority: 87,
    title: tr("hint::Power"),
    keys: ["power"],
    when: (_s, ctx) =>
      inWorld(ctx) && ctx.powerGeneration > 0
        ? tr(
            "Power is flowing. The Power Panel shows generation, demand and priorities — you decide who switches off first when power runs short.",
          )
        : null,
  },
  {
    id: "combine_prompt",
    priority: 83,
    title: tr("hint::Combine"),
    keys: ["workbench"],
    when: (s, ctx) => {
      const id = focusOf(ctx, "device");
      if (!id || !s.discovered[id] || hintSeen(s, "workbench") || itemTotal(s) < 2) return null;
      const missing = (checkStage(s, id)?.itemBlockers.length ?? 0) > 0;
      return missing
        ? tr(
            "A slot is missing a trait? Combine two parts at the workbench — two Energy Cells make a stronger one.",
          )
        : null;
    },
  },
  {
    id: "puzzle",
    priority: 82,
    title: tr("hint::Puzzles"),
    when: (_s, ctx) =>
      ctx.overlay === "puzzle"
        ? tr(
            "Esc leaves the puzzle at any time. Hints are often in notes in the same room or in Damien's logs.",
          )
        : null,
  },
  {
    id: "prototype",
    priority: 80,
    title: tr("hint::First Prototype"),
    when: (s, ctx) =>
      ctx.justHappened === "prototype" || (s.counters.combo_prototype ?? 0) >= 1
        ? tr(
            "Prototypes fit any build slot whose traits they reach. If one resembles an unknown device, it gives away that device's blueprint.",
          )
        : null,
  },
  {
    id: "npc",
    priority: 76,
    title: tr("hint::Someone to Talk To"),
    keys: ["interact"],
    when: (_s, ctx) => {
      const id = focusOf(ctx, "npc");
      const n = id ? NPCS.find((x) => x.id === id) : undefined;
      if (!n) return null;
      return tr("Talk to {name}. The questions change as you progress — it is worth coming back.", {
        name: n.name,
      });
    },
  },
  {
    id: "note",
    priority: 74,
    title: tr("hint::Notes"),
    keys: ["interact", "journal"],
    when: (s, ctx) =>
      focusOf(ctx, "note") && Object.keys(s.read).length === 0
        ? tr(
            "Notes and tapes give insights — some unlock blueprints. Everything you have read is in the journal.",
          )
        : null,
  },
  {
    id: "first_pickup",
    priority: 72,
    title: tr("hint::Use"),
    keys: ["interact"],
    when: (s, ctx) =>
      focusOf(ctx, "pickup") && Object.keys(s.taken).length <= 2
        ? tr(
            "Uses whatever you are looking at: search crates, scrap and shelves, open doors, inspect devices.",
          )
        : null,
  },
  {
    id: "move",
    priority: 70,
    title: tr("hint::Moving"),
    keys: ["moveUp", "moveLeft", "moveDown", "moveRight"],
    // Right after the cold open, as long as Lawrence has not left the control room.
    when: (s, ctx) =>
      s.flags.scene_wake && inWorld(ctx) && visitedCount(s) <= 1 && ctx.floor === 0
        ? tr(
            "Walk — or click on the floor. The compass at the top points to the next objective: the Emergency Ladder at the Elevator in the east.",
          )
        : null,
  },
  {
    id: "inventory",
    priority: 66,
    title: tr("hint::Inventory"),
    keys: ["inventory"],
    when: (s, ctx) =>
      inWorld(ctx) && Object.keys(s.taken).length >= 1 && itemTotal(s) >= 2
        ? tr(
            "Everything you find goes into the inventory — with its traits. The numbers decide which build slot a part fits.",
          )
        : null,
  },
  {
    id: "unknown_socket",
    priority: 60,
    title: tr("hint::Unknown Socket"),
    when: (s, ctx) => {
      const id = focusOf(ctx, "device");
      if (!id || s.discovered[id]) return null;
      return tr(
        "The blueprint is missing here. Blueprints come from insights, notes — or from prototypes that resemble a device.",
      );
    },
  },
  {
    id: "walls",
    priority: 64,
    title: tr("hint::Hide Walls"),
    keys: ["V"],
    // The engine heuristic when wired; otherwise the first longer stay below deck.
    when: (s, ctx) =>
      ctx.hiddenBehindWalls ||
      (inWorld(ctx) && ctx.floor !== 0 && visitedCount(s) >= 3 && s.playTime >= 150)
        ? tr("Walls in the way? V switches the walls between up, half and down.")
        : null,
  },
  {
    // Biorhythm (lib/world/biorhythm.ts): once, right after it starts on Level +1.
    id: "biorhythm",
    priority: 57,
    title: tr("hint::Biorhythm"),
    when: (s, ctx) =>
      inWorld(ctx) && ctx.floor === 4 && s.counters.bio_on_at !== undefined
        ? tr(
            "Jade now gets hungry, thirsty and tired — slowly. The Food Replicator in the kitchen, the Neutro-Fridge, your bed and the ergometer keep her going. Low needs only slow you a little; nothing is ever lost. Click the bio meters in the status panel for details.",
          )
        : null,
  },
  {
    id: "journal",
    priority: 58,
    title: tr("hint::Objectives"),
    keys: ["journal"],
    when: (s, ctx) =>
      inWorld(ctx) && (insightCount(s) >= 2 || (insightCount(s) >= 1 && s.playTime >= 240))
        ? tr(
            "The journal collects insights and all open objectives. The top objective is shown as a compass at the top of the screen.",
          )
        : null,
  },
  {
    id: "camera",
    priority: 40,
    title: tr("hint::Rotate the Camera"),
    keys: ["rotateLeft", "rotateRight"],
    when: (s) =>
      !hasUsed(s, "camera") && s.playTime >= 300
        ? tr(
            "The camera rotates in 90° steps. The mouse wheel zooms. Some corners can only be seen from the other side.",
          )
        : null,
  },
  {
    id: "map",
    priority: 62,
    title: tr("hint::Map"),
    keys: ["M"],
    when: (s, ctx) => {
      if (!inWorld(ctx)) return null;
      if (ctx.floor !== 0)
        return tr(
          "New level. The map shows all of it: devices, blueprints, finds and unread notes.",
        );
      return visitedCount(s) >= 6
        ? tr("The map shows the whole level: devices, blueprints, finds and unread notes.")
        : null;
    },
  },
  {
    id: "achievements",
    priority: 30,
    title: tr("hint::Achievements"),
    keys: ["K"],
    when: (s) =>
      !hasUsed(s, "achievements") && achievementsUnlocked(s) >= 1
        ? tr("First achievement! You will find all achievements and their branches here.")
        : null,
  },
  {
    id: "quicksave",
    priority: 25,
    title: tr("hint::Quicksave"),
    keys: ["quicksave", "quickload"],
    when: (s) =>
      !hasUsed(s, "quicksave") && s.playTime >= 400
        ? tr("Saves to the active save slot instantly, or loads it again. Autosave runs as well.")
        : null,
  },
  {
    id: "codex",
    priority: 20,
    title: tr("hint::Lab Handbook"),
    keys: ["C"],
    when: (s) =>
      !hasUsed(s, "codex") && s.playTime >= 360
        ? tr(
            "The handbook explains power, building, combining and everything you have discovered so far.",
          )
        : null,
  },
];

/**
 * Seconds between two hints right now: `HINT_SPACING`, divided by an active
 * `hint_boost` buff (e.g. "Klarer Kopf" ×2 → a hint every 22.5 s).
 */
export function hintSpacing(s: WorldState, now: number = s.playTime): number {
  return HINT_SPACING / Math.max(0.1, buffMultiplier(s, now, "hint_boost"));
}

export function hintFlag(id: string): string {
  return `tut_${id}`;
}

export function hintSeen(s: WorldState, id: string): boolean {
  return !!s.flags[hintFlag(id)];
}

/**
 * The most urgent unseen hint that applies now, or null (hints off,
 * cutscene/menu open, spacing not elapsed, nothing applies).
 * `now` is play time in seconds (pass `s.playTime`).
 */
export function nextHint(s: WorldState, ctx: TutorialContext, now: number): Hint | null {
  if (!ctx.hintsEnabled || ctx.cinematic) return null;
  if (ctx.overlay && QUIET_OVERLAYS.has(ctx.overlay)) return null;
  const last = s.counters[HINT_LAST_COUNTER];
  if (last !== undefined && now - last < hintSpacing(s, now)) return null;
  const bark = s.counters["bark:last"];
  if (bark !== undefined && now >= bark && now - bark < HINT_AFTER_BARK) return null;
  let best: { def: HintDef; text: string } | null = null;
  for (const def of HINTS) {
    if (hintSeen(s, def.id)) continue;
    if (best && def.priority <= best.def.priority) continue;
    const text = def.when(s, ctx);
    if (text) best = { def, text };
  }
  if (!best) return null;
  const { def, text } = best;
  return def.keys
    ? { id: def.id, title: def.title, text, keys: [...def.keys] }
    : { id: def.id, title: def.title, text };
}

/** Mark a hint as shown (never again) and restart the spacing timer. */
export function markHintSeen(s: WorldState, id: string, now: number = s.playTime): void {
  s.flags[hintFlag(id)] = true;
  s.counters[HINT_LAST_COUNTER] = now;
}

/** Forget every tutorial flag (settings → "Hinweise zurücksetzen"). */
export function resetHints(s: WorldState): void {
  for (const f of Object.keys(s.flags)) if (f.startsWith("tut_")) delete s.flags[f];
  delete s.counters[HINT_LAST_COUNTER];
}

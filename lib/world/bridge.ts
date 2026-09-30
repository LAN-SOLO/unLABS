/**
 * Lab World ↔ Terminal bridge.
 * ============================
 *
 * The big _unOS terminal (`/terminal`) and the isometric lab world
 * (`/world`) share one browser. This module lets the terminal *read* the
 * active world save and render plain-text summaries of it (status, devices,
 * power, journal, objectives, achievements, bots, an ASCII floor map), and
 * gives it one small, safe *write* path: `labSignal(code)` — codes Jade
 * learned in the lab (the four handshake tones, the decoded whisper, the
 * relic key) can be keyed in at the main console and resolve the matching
 * puzzle in the active slot, exactly as if it had been solved in the world.
 *
 * Everything returns plain strings; the terminal command layer adds colour.
 * Lines starting with "── " are section headers. Status markers used at the
 * start of list lines: "✓" done/online, "○" off/open, "!" problem,
 * "◇" blueprint, "·" unknown.
 *
 * Pure apart from localStorage (via `lib/world/save.ts`, which never throws).
 */

import { tr } from "@/lib/i18n";
import {
  achievementCount,
  achievementsByBranch,
  evaluateAchievements,
} from "@/lib/world/achievements";
import { DEVICES, DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { SLICE_TOTAL } from "@/lib/world/content/items";
import {
  DOORS,
  FLOORS_TOP_DOWN,
  FLOOR_ACCESS,
  FLOOR_BY_ID,
  FLOOR_SIZE,
  ROOMS,
  ROOM_BY_ID,
  roomAt,
  floorGeomOf,
  roomAnchor,
} from "@/lib/world/content/map";
import { PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import {
  BOT_QUESTS,
  ENDINGS,
  INSIGHTS,
  INSIGHT_BY_ID,
  NPC_SPEAKERS,
} from "@/lib/world/content/story";
import {
  describeCond,
  doorIsOpen,
  evalCond,
  floorAccessible,
  hint,
  isBuilt,
  isOnline,
  isSwitchedOn,
  log,
  power,
  progress,
  solvePuzzle,
  stagesDone,
  toggleDevice,
} from "@/lib/world/game";
import { topObjective, objectiveSections } from "@/lib/world/quests";
import {
  SAVE_KEY,
  SLOT_NAME,
  formatPlayTime,
  getActiveSlot,
  loadSlot,
  saveToSlot,
  type SlotId,
} from "@/lib/world/save";
import type { Condition, FloorId, WorldState } from "@/lib/world/types";

/** Shown whenever the active slot holds no world save. */
export const NO_WORLD_MESSAGE = tr("No lab world found — open /world.");

// ── Loading ──────────────────────────────────────────────────────

export interface ActiveWorld {
  slot: SlotId;
  state: WorldState;
}

/** The active world slot and its state, or null if the slot is empty. */
export function readActiveWorld(): ActiveWorld | null {
  const slot = getActiveSlot();
  const state = loadSlot(slot);
  return state ? { slot, state } : null;
}

/** True if the active slot holds a world save. */
export function hasLabWorld(): boolean {
  return readActiveWorld() !== null;
}

function withWorld(render: (w: ActiveWorld) => string[]): string[] {
  const w = readActiveWorld();
  return w ? render(w) : [NO_WORLD_MESSAGE];
}

// ── Small helpers ────────────────────────────────────────────────

const floorOfRoom = (roomId: string): FloorId | undefined => ROOM_BY_ID.get(roomId)?.floor;

function deviceFloor(id: string): FloorId | undefined {
  const d = DEVICE_BY_ID.get(id);
  return d ? floorOfRoom(d.room) : undefined;
}

function currentRoomName(s: WorldState): string | undefined {
  return roomAt(s.floor, Math.floor(s.pos[0]), Math.floor(s.pos[2]))?.name;
}

function watts(n: number): string {
  return `${Math.round(n * 10) / 10} W`;
}

/**
 * Parse a floor argument in display notation: "0", "-1", "−2", "+1", "1",
 * "E-3", "e+1" … (display level → stable floor id). Null if not a floor.
 */
export function parseFloorArg(arg: string | undefined): FloorId | null {
  if (arg === undefined) return null;
  const norm = arg.trim().toLowerCase().replace(/^e/, "").replace(/−/g, "-");
  if (!/^[+-]?\d$/.test(norm)) return null;
  const level = Number(norm);
  const byLevel: Record<string, FloorId> = { "1": 4, "0": 0, "-1": 1, "-2": 2, "-3": 3, "-4": 5 };
  return byLevel[String(level)] ?? null;
}

/** Floor ids in display order that the player may inspect (reachable or visited). */
function knownFloors(s: WorldState): FloorId[] {
  return FLOORS_TOP_DOWN.map((f) => f.id).filter(
    (id) =>
      floorAccessible(s, id) || ROOMS.some((r) => r.floor === id && s.flags[`visited_${r.id}`]),
  );
}

function lockedFloorLines(floor: FloorId): string[] {
  return [
    `── ${FLOOR_BY_ID[floor].name} ──`,
    tr("! Level locked: {hint}", { hint: FLOOR_ACCESS[floor].hint }),
  ];
}

// ── Status ───────────────────────────────────────────────────────

/** One-screen overview of the active world save. */
export function labStatus(): string[] {
  return withWorld(({ slot, state: s }) => {
    const p = progress(s);
    const pw = power(s);
    const ach = achievementCount(s);
    const room = currentRoomName(s);
    const bots = BOT_QUESTS.filter((q) => s.flags[q.flag]).length;
    const top = topObjective(s);
    const place = FLOOR_BY_ID[s.floor].name;
    return [
      tr("── _unLAB · Lab World · {slot} · Play time {time} ──", {
        slot: SLOT_NAME[slot],
        time: formatPlayTime(s.playTime),
      }),
      room
        ? tr("Location      {floor} · {room}", { floor: place, room })
        : tr("Location      {floor}", { floor: place }),
      pw.starved.length
        ? tr("Power         {gen} generated · {demand} demand · {n} unsupplied", {
            gen: watts(pw.generation),
            demand: watts(pw.demand),
            n: pw.starved.length,
          })
        : tr("Power         {gen} generated · {demand} demand", {
            gen: watts(pw.generation),
            demand: watts(pw.demand),
          }),
      tr("Devices       {built}/{total} built · {online} online", {
        built: p.devices,
        total: p.totalDevices,
        online: pw.online.size,
      }),
      tr("Insights      {n}/{total}", { n: p.insights, total: p.totalInsights }),
      tr("Endings       {n}/{total}", { n: p.endings, total: ENDINGS.length }),
      tr("Achievements  {n}/{total}", { n: ach.unlocked, total: ach.total }),
      tr("Bots          {n}/{total} awake", { n: bots, total: BOT_QUESTS.length }),
      tr("Slices #0089  {n}/{total}", {
        n: Math.min(s.counters.slices ?? 0, SLICE_TOTAL),
        total: SLICE_TOTAL,
      }),
      ...(top ? [tr("Next          {text}", { text: top.text })] : []),
    ];
  });
}

/**
 * Structured one-glance summary of a world state — for terminal UI that is
 * not a `labor` command (boot banner, the "zurück ins Labor" link, the
 * `labWorldActions` data fetcher). Pure.
 */
export interface LabSummary {
  slot: SlotId;
  slotName: string;
  /** "hh:mm". */
  playTime: string;
  floor: FloorId;
  /** Short floor label, e.g. "E0" / "E−1". */
  floorShort: string;
  floorName: string;
  room?: string;
  devicesBuilt: number;
  devicesOnline: number;
  devicesTotal: number;
  generation: number;
  demand: number;
  starved: number;
  insights: number;
  insightsTotal: number;
  endings: number;
  endingsTotal: number;
  botsAwake: number;
  botsTotal: number;
  /** Main-console codes whose world puzzle is still unsolved. */
  signalsOpen: number;
  /** Top open objective, if any. */
  objective?: string;
}

export function labSummary(s: WorldState, slot: SlotId): LabSummary {
  const p = progress(s);
  const pw = power(s);
  const room = currentRoomName(s);
  const floor: FloorId = FLOOR_BY_ID[s.floor] ? s.floor : 0;
  const top = topObjective(s);
  return {
    slot,
    slotName: SLOT_NAME[slot],
    playTime: formatPlayTime(s.playTime),
    floor,
    floorShort: FLOOR_BY_ID[floor].short,
    floorName: FLOOR_BY_ID[floor].name,
    ...(room ? { room } : {}),
    devicesBuilt: p.devices,
    devicesOnline: pw.online.size,
    devicesTotal: p.totalDevices,
    generation: pw.generation,
    demand: pw.demand,
    starved: pw.starved.length,
    insights: p.insights,
    insightsTotal: p.totalInsights,
    endings: p.endings,
    endingsTotal: ENDINGS.length,
    botsAwake: BOT_QUESTS.filter((q) => s.flags[q.flag]).length,
    botsTotal: BOT_QUESTS.length,
    signalsOpen: LAB_SIGNALS.filter((x) => !s.puzzles[x.puzzle]).length,
    ...(top ? { objective: top.text } : {}),
  };
}

/** Summary of the active slot, or null if it holds no world save. */
export function readLabSummary(): LabSummary | null {
  const w = readActiveWorld();
  return w ? labSummary(w.state, w.slot) : null;
}

// ── Devices ──────────────────────────────────────────────────────

function deviceLine(s: WorldState, id: string, starved: Map<string, "strom" | "hitze">): string {
  const d = DEVICE_BY_ID.get(id)!;
  const tag = `${d.id.padEnd(8)} ${d.name.padEnd(30).slice(0, 30)}`;
  const draw = d.power < 0 ? `+${-d.power} W` : `${d.power} W`;
  if (!s.discovered[id])
    return tr("· {id} {name} unknown", { id: d.id.padEnd(8), name: "???".padEnd(30) });
  if (!isBuilt(s, id)) {
    return tr("◇ {tag} Blueprint · Stage {done}/{total}", {
      tag,
      done: stagesDone(s, id),
      total: d.stages.length,
    });
  }
  if (!isSwitchedOn(s, id)) return tr("○ {tag} switched off ({draw})", { tag, draw });
  const why = starved.get(id);
  if (why)
    return why === "hitze"
      ? tr("! {tag} overheated ({draw})", { tag, draw })
      : tr("! {tag} no power ({draw})", { tag, draw });
  return tr("✓ {tag} online ({draw})", { tag, draw });
}

/** Device roster, grouped by floor (optionally only one floor). */
export function labDevices(floor?: FloorId): string[] {
  return withWorld(({ state: s }) => {
    const pw = power(s);
    const starved = new Map(pw.starved.map((x) => [x.id, x.reason] as const));
    const floors = floor === undefined ? FLOORS_TOP_DOWN.map((f) => f.id) : [floor];
    const out: string[] = [
      tr("── Devices · {built}/{total} built ──", {
        built: progress(s).devices,
        total: DEVICES.length,
      }),
    ];
    for (const f of floors) {
      const list = DEVICES.filter((d) => deviceFloor(d.id) === f);
      if (!list.length) continue;
      const built = list.filter((d) => isBuilt(s, d.id)).length;
      out.push("", `── ${FLOOR_BY_ID[f].name} · ${built}/${list.length} ──`);
      for (const d of list) out.push(deviceLine(s, d.id, starved));
    }
    return out;
  });
}

// ── Power ────────────────────────────────────────────────────────

/** Power grid: sources, consumers, brownouts. */
export function labPower(): string[] {
  return withWorld(({ state: s }) => {
    const pw = power(s);
    const out: string[] = [
      tr("── Power grid ──"),
      tr("Generation {w}", { w: watts(pw.generation) }),
      tr("Demand     {w}", { w: watts(pw.demand) }),
      tr("Reserve    {w}", { w: watts(pw.generation - pw.demand) }),
      "",
      tr("── Sources ──"),
    ];
    if (!pw.sources.length) out.push(tr("! No generation. Residual charge 0.3 %."));
    for (const src of pw.sources) out.push(`✓ ${src.label.padEnd(34)} +${watts(src.watts)}`);
    out.push("", tr("── Consumers online ──"));
    const consumers = DEVICES.filter((d) => d.power > 0 && pw.online.has(d.id));
    if (!consumers.length) out.push(tr("○ none"));
    for (const d of consumers)
      out.push(`✓ ${d.id.padEnd(8)} ${d.name.padEnd(30).slice(0, 30)} ${d.power} W`);
    if (pw.starved.length) {
      out.push("", "── Brownout ──");
      for (const x of pw.starved) {
        const d = DEVICE_BY_ID.get(x.id);
        out.push(
          `! ${x.id.padEnd(8)} ${(d?.name ?? x.id).padEnd(30).slice(0, 30)} ${x.reason === "hitze" ? tr("too hot (THM-001 missing)") : tr("not enough power")}`,
        );
      }
    }
    return out;
  });
}

// ── Journal ──────────────────────────────────────────────────────

/** The last `n` entries of the world log (oldest first). */
export function labJournal(n = 12): string[] {
  return withWorld(({ state: s }) => {
    const count = Math.max(1, Math.min(200, Math.floor(n) || 12));
    const entries = s.log.slice(-count);
    const out = [
      tr("── Lab journal · last {n} of {total} ──", { n: entries.length, total: s.log.length }),
    ];
    if (!entries.length) out.push(tr("○ No entries yet."));
    for (const e of entries) out.push(`[${formatPlayTime(e.t)}] ${e.text}`);
    return out;
  });
}

// ── Objectives ───────────────────────────────────────────────────

/** Open objectives (»Aufträge«), grouped like the in-world journal. */
export function labObjectives(): string[] {
  return withWorld(({ state: s }) => {
    const sections = objectiveSections(s);
    const out = [tr("── Objectives ──")];
    if (!sections.length) out.push(tr("✓ Nothing open. The lab still isn't finished."));
    for (const sec of sections) {
      out.push("", `── ${sec.title} ──`);
      for (const o of sec.items) {
        out.push(`○ ${o.text}`);
        if (o.detail) out.push(`    ${o.detail}`);
      }
    }
    return out;
  });
}

// ── Achievements ─────────────────────────────────────────────────

/** Achievements per branch; secret ones stay masked until unlocked. */
export function labAchievements(): string[] {
  return withWorld(({ state: s }) => {
    const c = achievementCount(s);
    const out = [tr("── Achievements · {n}/{total} ──", { n: c.unlocked, total: c.total })];
    for (const branch of achievementsByBranch(s)) {
      if (!branch.items.length) continue;
      const done = branch.items.filter((i) => i.unlocked).length;
      out.push("", `── ${branch.label} · ${done}/${branch.items.length} ──`);
      for (const v of branch.items) {
        if (v.unlocked) {
          out.push(`✓ ${v.def.title}`);
        } else if (v.def.hidden) {
          out.push(tr("· ??? (secret)"));
        } else {
          const prog = v.progress ? ` [${v.progress.current}/${v.progress.target}]` : "";
          out.push(`○ ${v.def.title}${prog} — ${v.def.description}`);
        }
      }
    }
    return out;
  });
}

// ── Bots ─────────────────────────────────────────────────────────

/** The lore bots and their reactivation state. */
export function labBots(): string[] {
  return withWorld(({ state: s }) => {
    const awake = BOT_QUESTS.filter((q) => s.flags[q.flag]).length;
    const out = [
      tr("── Bot network · {n}/{total} awake ──", { n: awake, total: BOT_QUESTS.length }),
    ];
    for (const q of BOT_QUESTS) {
      const name = (NPC_SPEAKERS[q.npc]?.name ?? q.npc).padEnd(9);
      if (s.flags[q.flag]) out.push(tr("✓ {name} awake — {text}", { name, text: q.reward }));
      else out.push(tr("○ {name} asleep — {text}", { name, text: q.hint }));
    }
    return out;
  });
}

// ── Map ──────────────────────────────────────────────────────────

/** Voxels per terminal map column / row (the map fits 80 columns). */
const MAP_SX = FLOOR_SIZE.x / 78;
const MAP_SZ = 4;
const MAP_W = Math.ceil(FLOOR_SIZE.x / MAP_SX);
const MAP_H = Math.ceil(FLOOR_SIZE.z / MAP_SZ) + 1;

/** ASCII legend of the map markers. */
export const MAP_LEGEND: readonly string[] = [
  tr("@ Jade · ■ device online · □ built, off · ◇ blueprint"),
  tr("▒ door closed · gap = door open · A–Z rooms · ? unexplored"),
];

/**
 * ASCII floor plan: room outlines (dotted when not yet visited), open doors
 * as gaps, closed doors as ▒, devices and Jade as markers, plus a room key.
 */
export function labMap(floor?: FloorId): string[] {
  return withWorld(({ state: s }) => {
    const f = floor ?? s.floor;
    if (!floorAccessible(s, f) && !ROOMS.some((r) => r.floor === f && s.flags[`visited_${r.id}`])) {
      return lockedFloorLines(f);
    }
    const grid: string[][] = Array.from({ length: MAP_H }, () => Array<string>(MAP_W).fill(" "));
    const put = (x: number, z: number, ch: string): void => {
      const cx = Math.floor(x / MAP_SX);
      const cz = Math.floor(z / MAP_SZ);
      if (cz >= 0 && cz < MAP_H && cx >= 0 && cx < MAP_W) grid[cz]![cx] = ch;
    };
    const rooms = ROOMS.filter((r) => r.floor === f).sort((a, b) => a.z - b.z || a.x - b.x);
    // Walls of the real room shapes (floor-geom.ts), sampled per map cell.
    const g = floorGeomOf(f);
    for (let cz = 0; cz < MAP_H; cz++)
      for (let cx = 0; cx < MAP_W; cx++) {
        let wallOf = 0;
        for (let z = Math.floor(cz * MAP_SZ); z < Math.floor((cz + 1) * MAP_SZ) && !wallOf; z++)
          for (let x = Math.floor(cx * MAP_SX); x < Math.floor((cx + 1) * MAP_SX); x++) {
            if (x < 0 || z < 0 || x >= g.W || z >= g.Z) continue;
            const o = g.wallOwner[x + z * g.W]!;
            if (o) {
              wallOf = o;
              break;
            }
          }
        if (!wallOf) continue;
        const r = g.rooms[wallOf - 1]!.room;
        const visited = !!s.flags[`visited_${r.id}`];
        const cur = grid[cz]![cx];
        if (cur === " " || cur === ":") grid[cz]![cx] = visited ? "#" : ":";
      }
    const legend: string[] = [];
    let letter = 0;
    let unknown = 0;
    for (const r of rooms) {
      const visited = !!s.flags[`visited_${r.id}`];
      const a = roomAnchor(r.id);
      const lx = Math.floor((a?.x ?? r.x + r.w / 2) / MAP_SX);
      const lz = Math.floor((a?.z ?? r.z + r.d / 2) / MAP_SZ);
      if (visited) {
        const key = String.fromCharCode(65 + (letter % 26));
        letter++;
        if (grid[lz]?.[lx] !== undefined) grid[lz]![lx] = key;
        legend.push(`${key} ${r.name}`);
      } else {
        unknown++;
        if (grid[lz]?.[lx] !== undefined) grid[lz]![lx] = "?";
      }
    }
    for (const d of DOORS) {
      if (d.floor !== f) continue;
      if (d.secret && !doorIsOpen(s, d)) continue;
      const open = doorIsOpen(s, d);
      const half = Math.max(1, Math.floor(d.width / 2));
      for (let o = -half + 1; o < half; o++) {
        if (d.axis === "x") put(d.x + o, d.z, open ? " " : "▒");
        else put(d.x, d.z + o, open ? " " : "▒");
      }
    }
    const pw = power(s);
    for (const d of DEVICES) {
      if (deviceFloor(d.id) !== f || !s.discovered[d.id]) continue;
      put(d.x, d.z, pw.online.has(d.id) ? "■" : isBuilt(s, d.id) ? "□" : "◇");
    }
    if (s.floor === f) put(s.pos[0], s.pos[2], "@");

    const lines = grid.map((row) => row.join("").replace(/\s+$/, ""));
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    while (lines.length && lines[0] === "") lines.shift();
    const out = [
      tr("── Map · {floor} ──", { floor: FLOOR_BY_ID[f].name }),
      ...lines,
      "",
      ...MAP_LEGEND,
    ];
    if (legend.length) {
      out.push("");
      for (let i = 0; i < legend.length; i += 3) {
        out.push(
          legend
            .slice(i, i + 3)
            .map((l) => l.padEnd(26).slice(0, 26))
            .join("")
            .trimEnd(),
        );
      }
    }
    if (unknown) out.push(tr("? {n} room(s) still unexplored.", { n: unknown }));
    const others = knownFloors(s).filter((id) => id !== f);
    if (others.length) {
      out.push(
        tr("Other levels: {list}  (labor map <level>)", {
          list: others.map((id) => FLOOR_BY_ID[id].short).join(", "),
        }),
      );
    }
    return out;
  });
}

// ── Signals (terminal → world) ───────────────────────────────────

interface SignalDef {
  /** Normalised code (upper case, no separators). */
  code: string;
  /** Device hosting the puzzle in the world. */
  device: string;
  puzzle: string;
  /** Extra terminal-side gate (on top of the device's own puzzle gate). */
  requires?: Condition;
  requiresHint?: string;
  /** What the MCP says when the code lands. */
  accepted: string;
}

/** Codes the main console understands. Each resolves an existing world puzzle. */
export const LAB_SIGNALS: readonly SignalDef[] = [
  {
    code: "3648",
    device: "HMS-001",
    puzzle: "pz_tones",
    accepted: tr(
      "Three. Six. Four. Eight. Routed through the Main Console onto the synthesizer. Something answered. I did not authorise that.",
    ),
  },
  {
    code: "LOVW",
    device: "ECR-001",
    puzzle: "pz_morse_whisper",
    accepted: tr(
      "L-O-V-W. You typed it as if it were a password. Perhaps it is one. The whisper has gone quiet. Satisfied, I believe.",
    ),
  },
  {
    code: "HALO",
    device: "CDC-001",
    puzzle: "pz_cipher",
    requires: { insight: "halo_schluessel" },
    requiresHint: tr(
      "A key without a source is a guess, not knowledge. Jade's margin notes, Dr. Lawrence. The initial letters.",
    ),
    accepted: tr(
      "Key H-A-L-O handed to the Crystal Data Cache. The relic opens. Your handwriting, Dr. Lawrence. In the data.",
    ),
  },
];

/** localStorage key of terminal-originated events for the world UI (toasts). */
export const TERMINAL_EVENTS_KEY = `${SAVE_KEY}.terminalEvents`;

export interface TerminalEvent {
  slot: SlotId;
  /** ISO timestamp. */
  at: string;
  code: string;
  title: string;
  lines: string[];
  /** Set for a device power switch from the terminal (instead of a code). */
  power?: { device: string; on: boolean };
}

function isPowerPayload(v: unknown): v is { device: string; on: boolean } {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.device === "string" && typeof r.on === "boolean";
}

function isTerminalEvent(v: unknown): v is TerminalEvent {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.slot === "string" &&
    typeof r.at === "string" &&
    typeof r.code === "string" &&
    typeof r.title === "string" &&
    Array.isArray(r.lines) &&
    (r.power === undefined || isPowerPayload(r.power))
  );
}

function readEvents(): TerminalEvent[] {
  try {
    const raw =
      typeof localStorage === "undefined" ? null : localStorage.getItem(TERMINAL_EVENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isTerminalEvent) : [];
  } catch {
    return [];
  }
}

function writeEvents(events: TerminalEvent[]): void {
  try {
    localStorage.setItem(TERMINAL_EVENTS_KEY, JSON.stringify(events.slice(-20)));
  } catch {
    // Storage full or blocked — the event is only cosmetic.
  }
}

/**
 * For the world UI: remove and return the pending terminal events of `slot`
 * (show them as toasts on mount / on the `storage` event).
 */
export function takeTerminalEvents(slot: SlotId): TerminalEvent[] {
  const all = readEvents();
  const mine = all.filter((e) => e.slot === slot);
  if (mine.length) writeEvents(all.filter((e) => e.slot !== slot));
  return mine;
}

export type SignalStatus = "accepted" | "known" | "blocked" | "unknown" | "noworld" | "failed";

/** Label per status (terminal headline). */
export const SIGNAL_STATUS_LABEL: Record<SignalStatus, string> = {
  accepted: tr("ACCEPTED"),
  known: tr("ALREADY SOLVED"),
  blocked: tr("BLOCKED"),
  unknown: tr("NO RECEIVER"),
  noworld: tr("NO LAB WORLD"),
  failed: tr("ERROR"),
};

export interface SignalReport {
  ok: boolean;
  status: SignalStatus;
  /** MCP lines (plain). */
  lines: string[];
  /** Insight ids newly granted in the world. */
  insights: string[];
  /** Flags newly set in the world. */
  flags: string[];
}

/** Normalise a typed code: upper case, separators removed ("3-6-4-8" → "3648"). */
export function normalizeSignal(code: string): string {
  return code.toUpperCase().replace(/[\s\-–—.,·_/]+/g, "");
}

/**
 * Apply a typed code to a live world state — the one code path shared by
 * the main console (`labSignal`, via the save slot) and the room terminals
 * (`terminal-lite`, via the world's `act`). Known codes resolve their world
 * puzzle (same rewards as in the world: flags, insights, items) if the host
 * device is online and its in-world requirements hold. Mutates `s` only
 * when the code is accepted. `via` names the console in the lab log.
 */
export function applySignal(s: WorldState, code: string, via = tr("Main Console")): SignalReport {
  const report = (
    ok: boolean,
    status: SignalStatus,
    lines: string[],
    insights: string[] = [],
    flags: string[] = [],
  ): SignalReport => ({ ok, status, lines, insights, flags });

  const norm = normalizeSignal(code);
  if (!norm) return report(false, "unknown", [tr("No signal entered. Syntax: signal <code>")]);

  const sig = LAB_SIGNALS.find((x) => x.code === norm);
  if (!sig) {
    return report(false, "unknown", [
      tr("Signal “{code}” fades out in the lab network. No receiver.", { code: norm }),
      tr(
        "Not every string of characters is a code, Dr. Lawrence. Most are just strings of characters.",
      ),
    ]);
  }
  const puzzle = PUZZLE_BY_ID.get(sig.puzzle);
  const device = DEVICE_BY_ID.get(sig.device);
  if (!puzzle || !device)
    return report(false, "failed", [tr("Internal error: signal without a target.")]);

  if (s.puzzles[sig.puzzle]) {
    return report(true, "known", [
      tr("“{title}” is already solved. I dislike repeating myself. You, apparently, do not.", {
        title: puzzle.title,
      }),
    ]);
  }
  if (!isOnline(s, sig.device)) {
    return report(false, "blocked", [
      tr("Signal recognised, but {name} ({id}) is not online.", {
        name: device.name,
        id: device.id,
      }),
      tr("Without a receiver, a code is just a noise."),
    ]);
  }
  if (sig.requires && !evalCond(s, sig.requires)) {
    return report(false, "blocked", [
      sig.requiresHint ?? tr("Not yet: {cond}.", { cond: describeCond(sig.requires) }),
    ]);
  }
  const gate = DEVICE_PUZZLES[sig.device]?.find((p) => p.puzzle === sig.puzzle);
  if (gate?.requires && !evalCond(s, gate.requires)) {
    return report(false, "blocked", [
      gate.hint ?? tr("Not yet: {cond}.", { cond: describeCond(gate.requires) }),
    ]);
  }

  const flagsBefore = new Set(Object.keys(s.flags).filter((k) => s.flags[k]));
  const solved = solvePuzzle(s, sig.puzzle);
  s.flags[`terminal_${sig.puzzle}`] = true;
  s.counters.terminal_signals = (s.counters.terminal_signals ?? 0) + 1;
  log(
    s,
    tr("{via}: signal {code} sent — {title} solved.", { via, code: sig.code, title: puzzle.title }),
  );
  evaluateAchievements(s);
  const flags = Object.keys(s.flags).filter((k) => s.flags[k] && !flagsBefore.has(k));

  const lines = [sig.accepted, puzzle.mcpSolved];
  for (const id of solved.insights) {
    lines.push(tr("Insight: {title}", { title: INSIGHT_BY_ID.get(id)?.title ?? id }));
  }
  for (const item of solved.items) lines.push(tr("Received: {item}", { item }));
  for (const id of solved.discovered) {
    lines.push(tr("Blueprint discovered: {name}", { name: DEVICE_BY_ID.get(id)?.name ?? id }));
  }
  return report(true, "accepted", lines, solved.insights, flags);
}

/**
 * Key a code into the lab from the main console: `applySignal` on the
 * active slot, saved back, plus a toast event for the world UI.
 */
export function labSignal(code: string): SignalReport {
  const w = readActiveWorld();
  if (!w) {
    return { ok: false, status: "noworld", lines: [NO_WORLD_MESSAGE], insights: [], flags: [] };
  }
  const { slot, state: s } = w;
  if (!normalizeSignal(code)) {
    return {
      ok: false,
      status: "unknown",
      lines: [tr("No signal entered. Syntax: labor signal <code>")],
      insights: [],
      flags: [],
    };
  }
  const res = applySignal(s, code);
  if (res.status !== "accepted") return res;
  if (!saveToSlot(slot, s)) {
    return {
      ok: false,
      status: "failed",
      lines: [tr("Storage full or blocked. The signal is lost.")],
      insights: [],
      flags: [],
    };
  }
  const sig = LAB_SIGNALS.find((x) => x.code === normalizeSignal(code));
  const title = sig ? (PUZZLE_BY_ID.get(sig.puzzle)?.title ?? sig.code) : code;
  writeEvents([
    ...readEvents(),
    { slot, at: new Date().toISOString(), code: sig?.code ?? code, title, lines: res.lines },
  ]);
  return res;
}

/**
 * For the world UI: take the pending terminal events of `slot` and re-apply
 * their codes onto the live state `s` (idempotent — an already solved puzzle
 * reports "known" and changes nothing). This closes the lost-write race where
 * a world instance holding an older copy of the slot (a second tab, or a
 * flush that lands after the terminal's write) would otherwise save over the
 * signal: the event queue is the durable record, the slot write the fast path.
 * Call inside the world's `act` so the result is saved.
 */
export function absorbTerminalEvents(
  s: WorldState,
  slot: SlotId,
): { events: TerminalEvent[]; reapplied: string[] } {
  const events = takeTerminalEvents(slot);
  const reapplied: string[] = [];
  for (const e of events) {
    if (e.power) {
      // Idempotent: the slot write usually landed already.
      if (isBuilt(s, e.power.device) && isSwitchedOn(s, e.power.device) !== e.power.on) {
        toggleDevice(s, e.power.device);
        reapplied.push(e.code);
      }
      continue;
    }
    const r = applySignal(s, e.code);
    if (r.status === "accepted") reapplied.push(e.code);
  }
  return { events, reapplied };
}

/**
 * Notify `onEvents` whenever another tab (the terminal) queues terminal
 * events. Browser-only; returns an unsubscribe function (no-op on the server).
 */
export function subscribeTerminalEvents(onEvents: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: StorageEvent): void => {
    if (e.key === TERMINAL_EVENTS_KEY && e.newValue && e.newValue !== "[]") onEvents();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

// ── Device sync (terminal software layer ↔ lab hardware) ───────────

/**
 * Physical state of one device in the lab, as the terminal's device
 * commands see it (`lib/terminal/labSync.ts` decides what that allows):
 *  - "unknown"    no blueprint discovered yet
 *  - "blueprint"  discovered, build stages still open
 *  - "off"        built, switched off
 *  - "starved"    built + switched on, but the grid can't feed it (brownout)
 *  - "overheated" built + switched on, but needs THM-001 cooling
 *  - "online"     built, switched on, powered
 */
export type LabDevicePresence =
  | "unknown"
  | "blueprint"
  | "off"
  | "starved"
  | "overheated"
  | "online";

export interface LabDeviceInfo {
  id: string;
  name: string;
  presence: LabDevicePresence;
  stagesDone: number;
  stagesTotal: number;
  /** Room name in the lab (content language). */
  room?: string;
  /** Short floor label, e.g. "E0" / "E−1". */
  floorShort?: string;
  /** Watts drawn when online (negative = generation). */
  watts: number;
}

/** Plain, serialisable device view of a world state — the terminal's sync input. */
export interface LabDeviceSnapshot {
  slot: SlotId;
  slotName: string;
  generation: number;
  demand: number;
  devices: Record<string, LabDeviceInfo>;
}

/** Device snapshot of a world state (pure). */
export function deviceSnapshot(s: WorldState, slot: SlotId): LabDeviceSnapshot {
  const pw = power(s);
  const starved = new Map(pw.starved.map((x) => [x.id, x.reason] as const));
  const devices: Record<string, LabDeviceInfo> = {};
  for (const d of DEVICES) {
    const done = stagesDone(s, d.id);
    let presence: LabDevicePresence;
    if (!isBuilt(s, d.id)) presence = s.discovered[d.id] || done > 0 ? "blueprint" : "unknown";
    else if (!isSwitchedOn(s, d.id)) presence = "off";
    else if (pw.online.has(d.id)) presence = "online";
    else presence = starved.get(d.id) === "hitze" ? "overheated" : "starved";
    const floor = deviceFloor(d.id);
    devices[d.id] = {
      id: d.id,
      name: d.name,
      presence,
      stagesDone: done,
      stagesTotal: d.stages.length,
      ...(ROOM_BY_ID.get(d.room) ? { room: ROOM_BY_ID.get(d.room)!.name } : {}),
      ...(floor !== undefined ? { floorShort: FLOOR_BY_ID[floor].short } : {}),
      watts: d.power,
    };
  }
  return {
    slot,
    slotName: SLOT_NAME[slot],
    generation: pw.generation,
    demand: pw.demand,
    devices,
  };
}

/** Device snapshot of the active slot, or null without a world save. */
export function readLabDeviceSnapshot(): LabDeviceSnapshot | null {
  const w = readActiveWorld();
  return w ? deviceSnapshot(w.state, w.slot) : null;
}

export type DevicePowerStatus = "switched" | "unchanged" | "absent" | "noworld" | "failed";

export interface DevicePowerReport {
  status: DevicePowerStatus;
  /** Switch position in the world after the call (if the device is built). */
  on?: boolean;
}

/**
 * Flip a built device's switch in a live world state (pure apart from `s`),
 * exactly like the device panel does (`toggleDevice`) and with a lab log
 * line naming the console. Unbuilt devices are "absent" and left alone.
 */
export function applyDevicePower(
  s: WorldState,
  id: string,
  on: boolean,
  via = tr("Main Console"),
): DevicePowerReport {
  if (!DEVICE_BY_ID.has(id) || !isBuilt(s, id)) return { status: "absent" };
  if (isSwitchedOn(s, id) === on) return { status: "unchanged", on };
  toggleDevice(s, id);
  log(
    s,
    on ? tr("{via}: {id} switched on.", { via, id }) : tr("{via}: {id} switched off.", { via, id }),
  );
  evaluateAchievements(s);
  return { status: "switched", on };
}

/**
 * Terminal power switch → active world slot: saves the slot and queues a
 * terminal event (toast + lost-write protection, see `absorbTerminalEvents`).
 */
export function labSetDevicePower(id: string, on: boolean): DevicePowerReport {
  const w = readActiveWorld();
  if (!w) return { status: "noworld" };
  const { slot, state: s } = w;
  const res = applyDevicePower(s, id, on);
  if (res.status !== "switched") return res;
  if (!saveToSlot(slot, s)) return { status: "failed" };
  const name = DEVICE_BY_ID.get(id)?.name ?? id;
  writeEvents([
    ...readEvents(),
    {
      slot,
      at: new Date().toISOString(),
      code: `POWER:${id}`,
      title: on ? tr("{id} switched on", { id }) : tr("{id} switched off", { id }),
      lines: [
        on
          ? tr("{name} was switched on from the Main Console.", { name })
          : tr("{name} was switched off from the Main Console.", { name }),
      ],
      power: { device: id, on },
    },
  ]);
  return res;
}

// ── MCP ──────────────────────────────────────────────────────────

/** Ask the MCP about the lab. Answers are derived from the world state. */
export function labMcp(question: string): string[] {
  return withWorld(({ state: s }) => mcpAnswer(s, question));
}

/** The MCP's answer to a free-text question, derived from a world state (pure). */
export function mcpAnswer(s: WorldState, question: string): string[] {
  const q = question.toLowerCase();
  const has = (...words: string[]): boolean => words.some((w) => q.includes(w));
  const pw = power(s);

  if (!q.trim()) return [hint(s)];

  if (has("wer bist", "wer sind", "mcp", "wie geht", "who are", "how are")) {
    return [
      tr("MCP-000. Master Control Program. 2,561 days of autonomous operation."),
      pw.generation >= 50
        ? tr("Power is on. I am doing splendidly. That is not an emotion, it is a voltage reading.")
        : tr(
            "Residual charge 0.3 %. I am saving energy by being less sarcastic. It is exhausting.",
          ),
    ];
  }
  if (has("strom", "energie", "watt", "power", "brownout")) {
    const lines = [
      tr("Generation {gen}, demand {demand}, reserve {reserve}.", {
        gen: watts(pw.generation),
        demand: watts(pw.demand),
        reserve: watts(pw.generation - pw.demand),
      }),
    ];
    if (pw.starved.length) {
      lines.push(
        tr("{n} device(s) without supply: {ids}. Switch something off or build generation.", {
          n: pw.starved.length,
          ids: pw.starved.map((x) => x.id).join(", "),
        }),
      );
    } else if (pw.generation < 50) {
      lines.push(
        tr("Below 50 W no elevator runs. Geothermal, Level −1. Load before understanding."),
      );
    } else {
      lines.push(tr("The grid is stable. Enjoy it. It never lasts."));
    }
    return lines;
  }
  if (has("damien", "fridge")) {
    const endings = Object.keys(s.endings).length;
    if (endings > 0) {
      return [
        tr("You have taken {n} of {total} paths to Dr. Fridge.", {
          n: endings,
          total: ENDINGS.length,
        }),
        tr("My tables now list him as “present, presumably”."),
      ];
    }
    return [
      isBuilt(s, "ECR-001")
        ? tr("His echo is caught in the recorder. Speak to him at the secondary station.")
        : tr(
            "Dr. Fridge has been unreachable since 2019. The Echo Recorder in the signal lab (Level −2) hears what is left in the noise.",
          ),
    ];
  }
  if (has("halo")) {
    const known = INSIGHTS.filter((i) => i.thread === "halo" && s.insights[i.id]).length;
    const total = INSIGHTS.filter((i) => i.thread === "halo").length;
    return [
      tr("Halo insights: {n}/{total}.", { n: known, total }),
      known
        ? tr("The Halo remembers frequencies. I remember yours. That is not the same thing.")
        : tr(
            "Jade's margin notes. Four of them, spread over three levels. Read the initial letters.",
          ),
    ];
  }
  if (
    has(
      "wo bin",
      "wo ist jade", // i18n-ignore (German input keyword)
      "position",
      "standort",
      "wo stehe",
      "where am",
      "where is jade",
      "location",
    )
  ) {
    const room = currentRoomName(s);
    const floorName = FLOOR_BY_ID[s.floor].name;
    return [
      room
        ? tr("You are in the room “{room}”, {floor}.", { room, floor: floorName })
        : tr("You are on {floor}.", { floor: floorName }),
    ];
  }
  if (has("bot")) {
    const awake = BOT_QUESTS.filter((q2) => s.flags[q2.flag]).length;
    const next = BOT_QUESTS.find((q2) => !s.flags[q2.flag]);
    return [
      tr("{n} of {total} agents are awake.", { n: awake, total: BOT_QUESTS.length }),
      ...(next ? [next.hint] : [tr("All awake. It has become loud in here.")]),
    ];
  }
  if (has("kristall", "crystal", "slice", "0089")) {
    const slices = Math.min(s.counters.slices ?? 0, SLICE_TOTAL);
    return [
      tr("Crystal #0089: {n} of {total} slices.", { n: slices, total: SLICE_TOTAL }),
      slices < SLICE_TOTAL
        ? tr(
            "Dr. Lawrence scattered them, she did not hide them. K2-LDR in the Archive keeps a catalogue.",
          )
        : tr("All thirty. Place them in the Crystal Data Cache."),
    ];
  }
  const signalWords = ["code", "signal", "ton", "töne", "flüster", "tone", "whisper"]; // i18n-ignore
  if (has(...signalWords)) {
    const open = LAB_SIGNALS.filter((x) => !s.puzzles[x.puzzle]).length;
    return [
      open
        ? tr(
            "The Main Console accepts codes: labor signal <code>. {n} receiver(s) still waiting.",
            { n: open },
          )
        : tr("Every code I know has been sent. The ones I don't know worry me."),
    ];
  }
  const top = topObjective(s);
  if (
    has("was", "weiter", "hilfe", "hinweis", "tipp", "auftrag", "ziel") ||
    has("what", "next", "help", "hint", "tip", "objective", "goal")
  ) {
    return [hint(s), ...(top ? [tr("Objective: {text}", { text: top.text })] : [])];
  }
  return [tr("Question ambiguous. I will answer anyway; it is more efficient."), hint(s)];
}

/** Help text for the terminal command. */
export const LAB_HELP: readonly string[] = [
  tr("── labor · bridge to the Lab World (/world) ──"),
  tr("labor                   Status overview of the active save"),
  tr("labor devices [level]   Devices per level (level: +1, 0, -1 … -4)"),
  tr("labor power             Power grid: sources, consumers, brownout"),
  tr("labor journal [n]       The last n journal entries (default 12)"),
  tr("labor objectives        Open objectives"),
  tr("labor map [level]       ASCII map (default: Jade's level)"),
  tr("labor bots              Bot network: who is awake, who sleeps"),
  tr("labor achievements      Achievements"),
  tr("labor signal <code>     Send a code through the Main Console"),
  tr("labor mcp <question>    Ask the MCP"),
  tr("labor world             Back to the lab (/world)"),
];

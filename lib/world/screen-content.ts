/**
 * Live screen content (pure — no three, no DOM beyond a 2D context).
 * ==================================================================
 *
 * `drawScreen` paints one retro CRT frame of a `ScreenSpec` into a small
 * canvas (typically 48–160 px wide): phosphor colour on a dark tinted
 * background, a 3×5 pixel font, scanlines and a few "hot" (near-white)
 * pixels that the bloom pass picks up. Output depends only on
 * (spec, info, t) — deterministic, so it is testable with a stub context.
 *
 * `screenInfo` builds the state snapshot a screen reads (power, device
 * stage, room, log, objective, …). The expensive parts (power grid,
 * objectives) are memoised per state signature so the renderer may call it
 * for every screen redraw.
 */
import { tr } from "@/lib/i18n";
import { volatilityPercent } from "@/lib/game/volatility";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { SLICE_TOTAL } from "@/lib/world/content/items";
import { FLOORS_TOP_DOWN, FLOOR_BY_ID, ROOMS, ROOM_BY_ID, roomAt } from "@/lib/world/content/map";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { BOT_QUESTS, ENDINGS, INSIGHTS } from "@/lib/world/content/story";
import { ROOM_TERMINALS } from "@/lib/world/content/terminals";
import { hint, isBuilt, itemDef, power, stagesDone, todayKey, uecOutput } from "@/lib/world/game";
import type { ScreenContent, ScreenSpec } from "@/lib/world/models/anim";
import { topObjective } from "@/lib/world/quests";
import { unreadMail } from "@/lib/world/terminal-lite";
import { SPECTRUM_HEX } from "@/lib/world/traits";
import { BOARD_CAPACITY } from "@/lib/world/memos";
import { isDamienRevealed } from "@/lib/world/damien";
import { SPECTRUM, type FloorId, type MemoSourceKind, type WorldState } from "@/lib/world/types";

/** The subset of a 2D context the screens use (real canvases and test stubs both fit). */
export type ScreenCtx = Pick<CanvasRenderingContext2D, "fillRect" | "fillStyle" | "globalAlpha">;

export interface MapRoom {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
}

/** A device dot for the map / radar / boot screens. */
export interface ScreenDevice {
  id: string;
  x: number;
  z: number;
  known: boolean;
  built: boolean;
  online: boolean;
}

/** Device counts of one floor (bars screen). */
export interface FloorStat {
  short: string;
  total: number;
  built: number;
  online: number;
}

export interface ScreenInfo {
  deviceId?: string;
  /** Device display name ("" without a device). */
  deviceName: string;
  built: boolean;
  online: boolean;
  /** Built but not powered (brownout / overheated). */
  starved: boolean;
  stage: number;
  stages: number;
  /** Device power in W (negative = generation). */
  watts: number;
  generation: number;
  demand: number;
  /** Number of starved devices lab-wide. */
  brownout: number;
  roomId?: string;
  roomName: string;
  floor: FloorId;
  floorShort: string;
  /** Last lab log lines, oldest first. */
  log: string[];
  /** Play-time stamps (s) of `log`. */
  logT: number[];
  insights: number;
  totalInsights: number;
  /** Compass / top objective text. */
  objective: string;
  /** The MCP's current hint (first sentence). */
  mcpLine: string;
  /** Real wall-clock time "HH:MM". */
  clock: string;
  /** Lab day (2.561 days of rest + play time). */
  day: number;
  player: { floor: FloorId; x: number; z: number };
  /** Rooms of `floor` (for the map screen). */
  rooms: readonly MapRoom[];
  /** Devices of `floor`. */
  devices: readonly ScreenDevice[];
  /** Device counts per floor, top-down. */
  floors: readonly FloorStat[];
  devicesBuilt: number;
  devicesTotal: number;
  /** Ids of every online device (identity changes when the grid changes). */
  onlineIds: ReadonlySet<string>;
  /** Grid load (demand / generation) samples, oldest first. */
  loadHistory: readonly number[];
  /** Generation samples (W), oldest first. */
  genHistory: readonly number[];
  /** Today's raw UEC output (W) and the daily volatility in percent. */
  uecWatts: number;
  volatility: number;
  slices: number;
  sliceTotal: number;
  /** Inventory count per spectrum colour (SPECTRUM order). */
  spectrum: readonly number[];
  botsAwake: number;
  botsTotal: number;
  puzzlesSolved: number;
  puzzlesTotal: number;
  solved: ReadonlySet<string>;
  /** 0..1 — how much of Damien's trail is known. */
  damienSignal: number;
  /** Damien has been found (lib/world/damien.ts): his face may resolve. */
  damienRevealed: boolean;
  /** 0..1 — how much of the signal thread is known. */
  signalLevel: number;
  /** "H_L_" — Jade's margin notes found so far. */
  haloLetters: string;
  endings: number;
  /** Room terminal in this room: unread mails. */
  unreadMail: number;
  /** Live pinboards: memos pinned to the screen's decor placement, oldest first. */
  pinned?: readonly PinnedCard[];
}

/** One memo card on a live pinboard (content "notes"). */
export interface PinnedCard {
  /** One or two words of the memo title. */
  title: string;
  /** Card colour index into NOTE_CARD_COLORS. */
  tone: number;
}

// ── Info snapshot ────────────────────────────────────────────────

const ROOMS_BY_FLOOR = new Map<FloorId, MapRoom[]>();
for (const r of ROOMS) {
  const list = ROOMS_BY_FLOOR.get(r.floor) ?? [];
  list.push({ id: r.id, x: r.x, z: r.z, w: r.w, d: r.d });
  ROOMS_BY_FLOOR.set(r.floor, list);
}

const FLOOR_OF_DEVICE = new Map<string, FloorId>();
for (const d of DEVICES) {
  const r = ROOM_BY_ID.get(d.room);
  if (r) FLOOR_OF_DEVICE.set(d.id, r.floor);
}

const TERMINAL_BY_ROOM = new Map(ROOM_TERMINALS.map((t) => [t.room, t.id] as const));

const DAMIEN_THREAD = INSIGHTS.filter((i) => i.thread === "damien").map((i) => i.id);
const SIGNAL_THREAD = INSIGHTS.filter((i) => i.thread === "signal").map((i) => i.id);

interface BaseInfo {
  generation: number;
  demand: number;
  brownout: number;
  online: ReadonlySet<string>;
  starved: ReadonlySet<string>;
  log: string[];
  logT: number[];
  insights: number;
  objective: string;
  mcpLine: string;
  slices: number;
  botsAwake: number;
  devicesByFloor: Map<FloorId, ScreenDevice[]>;
  floors: FloorStat[];
  devicesBuilt: number;
  spectrum: number[];
  puzzlesSolved: number;
  solved: ReadonlySet<string>;
  damienSignal: number;
  damienRevealed: boolean;
  signalLevel: number;
  haloLetters: string;
  endings: number;
  uecWatts: number;
  volatility: number;
}

let baseCache: { state: WorldState; sig: string; base: BaseInfo } | null = null;

/** Power samples, recorded whenever the grid changes (per state object). */
const HISTORY_MAX = 32;
let history: { state: WorldState; gen: number[]; load: number[] } | null = null;

/** Forget the recorded power history (tests). */
export function resetScreenHistory(): void {
  history = null;
  baseCache = null;
}

function countTrue(r: Record<string, boolean | number>): number {
  let n = 0;
  for (const k in r) if (r[k]) n++;
  return n;
}

function inventorySig(s: WorldState): number {
  let n = 0;
  for (const k in s.inventory) n += (s.inventory[k] ?? 0) * (k.length + 1);
  return n;
}

/** Cheap change signature of everything the base info depends on. */
function signature(s: WorldState): string {
  let built = 0;
  for (const k in s.built) built += s.built[k] ?? 0;
  const last = s.log[s.log.length - 1];
  return [
    s.log.length,
    last?.t ?? -1,
    last?.text.length ?? 0,
    built,
    countTrue(s.switchedOn),
    Object.keys(s.switchedOn).length,
    countTrue(s.insights),
    countTrue(s.flags),
    countTrue(s.puzzles),
    countTrue(s.read),
    countTrue(s.discovered),
    Object.keys(s.taken).length,
    countTrue(s.endings),
    inventorySig(s),
    s.counters.slices ?? 0,
    s.floor,
    Math.floor(s.playTime / 5),
  ].join("|");
}

function fraction(s: WorldState, ids: readonly string[]): number {
  if (!ids.length) return 0;
  let n = 0;
  for (const id of ids) if (s.insights[id]) n++;
  return n / ids.length;
}

function baseInfo(s: WorldState): BaseInfo {
  const sig = signature(s);
  if (baseCache && baseCache.state === s && baseCache.sig === sig) return baseCache.base;
  const p = power(s);
  const starved = new Set(p.starved.map((x) => x.id));
  const devicesByFloor = new Map<FloorId, ScreenDevice[]>();
  let devicesBuilt = 0;
  for (const d of DEVICES) {
    const f = FLOOR_OF_DEVICE.get(d.id);
    if (f === undefined) continue;
    const built = isBuilt(s, d.id);
    if (built) devicesBuilt++;
    const list = devicesByFloor.get(f) ?? [];
    list.push({
      id: d.id,
      x: d.x,
      z: d.z,
      known: !!s.discovered[d.id] || stagesDone(s, d.id) > 0,
      built,
      online: p.online.has(d.id),
    });
    devicesByFloor.set(f, list);
  }
  const floors: FloorStat[] = FLOORS_TOP_DOWN.map((f) => {
    const list = devicesByFloor.get(f.id) ?? [];
    return {
      short: f.short,
      total: list.length,
      built: list.filter((d) => d.built).length,
      online: list.filter((d) => d.online).length,
    };
  });
  const spectrum = SPECTRUM.map(() => 0);
  for (const id in s.inventory) {
    const n = s.inventory[id] ?? 0;
    if (n <= 0) continue;
    const def = itemDef(s, id);
    const i = def ? SPECTRUM.indexOf(def.color) : -1;
    if (i >= 0) spectrum[i]! += n;
  }
  const tail = s.log.slice(-8);
  const day = todayKey();
  const firstSentence = hint(s).split(/(?<=[.!?])\s/)[0] ?? "";
  const base: BaseInfo = {
    generation: p.generation,
    demand: p.demand,
    brownout: p.starved.length,
    online: p.online,
    starved,
    log: tail.map((l) => l.text),
    logT: tail.map((l) => l.t),
    insights: countTrue(s.insights),
    objective: topObjective(s)?.text ?? tr("No open objectives."),
    mcpLine: firstSentence,
    slices: Math.min(s.counters.slices ?? 0, SLICE_TOTAL),
    botsAwake: BOT_QUESTS.filter((q) => s.flags[q.flag]).length,
    devicesByFloor,
    floors,
    devicesBuilt,
    spectrum,
    puzzlesSolved: PUZZLES.filter((z) => s.puzzles[z.id]).length,
    solved: new Set(Object.keys(s.puzzles).filter((k) => s.puzzles[k])),
    damienSignal: Math.max(fraction(s, DAMIEN_THREAD), countTrue(s.endings) > 0 ? 1 : 0),
    damienRevealed: isDamienRevealed(s),
    signalLevel: fraction(s, SIGNAL_THREAD),
    haloLetters: ["h", "a", "l", "o"]
      .map((c) => (s.insights[`halo_${c}`] ? c.toUpperCase() : "_"))
      .join(""),
    endings: ENDINGS.filter((e) => s.endings[e.id]).length,
    uecWatts: uecOutput(day),
    volatility: volatilityPercent(day),
  };
  // Power history: one sample per grid change.
  if (!history || history.state !== s) history = { state: s, gen: [], load: [] };
  const load = p.generation > 0 ? p.demand / p.generation : 0;
  const lastGen = history.gen[history.gen.length - 1];
  const lastLoad = history.load[history.load.length - 1];
  if (lastGen !== p.generation || lastLoad !== load) {
    history.gen.push(p.generation);
    history.load.push(load);
    if (history.gen.length > HISTORY_MAX) {
      history.gen.shift();
      history.load.shift();
    }
  }
  baseCache = { state: s, sig, base };
  return base;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Snapshot for one screen. The room is the device's room, else `roomId`,
 * else the room the player stands in.
 */
export function screenInfo(
  s: WorldState,
  deviceId?: string,
  roomId?: string,
  now: Date = new Date(),
  placementId?: string,
): ScreenInfo {
  const b = baseInfo(s);
  const dev = deviceId ? DEVICE_BY_ID.get(deviceId) : undefined;
  const room =
    (dev ? ROOM_BY_ID.get(dev.room) : undefined) ??
    (roomId ? ROOM_BY_ID.get(roomId) : undefined) ??
    roomAt(s.floor, s.pos[0], s.pos[2]);
  const floor = room?.floor ?? s.floor;
  const stage = deviceId ? stagesDone(s, deviceId) : 0;
  const stages = dev?.stages.length ?? 0;
  const term = room ? TERMINAL_BY_ROOM.get(room.id) : undefined;
  const info: ScreenInfo = {
    deviceName: dev?.name ?? "",
    built: !!dev && stage >= stages,
    online: !!deviceId && b.online.has(deviceId),
    starved: !!deviceId && b.starved.has(deviceId),
    stage,
    stages,
    watts: dev?.power ?? 0,
    generation: b.generation,
    demand: b.demand,
    brownout: b.brownout,
    roomName: room?.name ?? FLOOR_BY_ID[floor].name,
    floor,
    floorShort: FLOOR_BY_ID[floor].short,
    log: b.log,
    logT: b.logT,
    insights: b.insights,
    totalInsights: INSIGHTS.length,
    objective: b.objective,
    mcpLine: b.mcpLine,
    clock: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    day: 2561 + Math.floor(s.playTime / 86400),
    player: { floor: s.floor, x: s.pos[0], z: s.pos[2] },
    rooms: ROOMS_BY_FLOOR.get(floor) ?? [],
    devices: b.devicesByFloor.get(floor) ?? [],
    floors: b.floors,
    devicesBuilt: b.devicesBuilt,
    devicesTotal: DEVICES.length,
    onlineIds: b.online,
    loadHistory: history?.state === s ? [...history.load] : [],
    genHistory: history?.state === s ? [...history.gen] : [],
    uecWatts: b.uecWatts,
    volatility: b.volatility,
    slices: b.slices,
    sliceTotal: SLICE_TOTAL,
    spectrum: b.spectrum,
    botsAwake: b.botsAwake,
    botsTotal: BOT_QUESTS.length,
    puzzlesSolved: b.puzzlesSolved,
    puzzlesTotal: PUZZLES.length,
    solved: b.solved,
    damienSignal: b.damienSignal,
    damienRevealed: b.damienRevealed,
    signalLevel: b.signalLevel,
    haloLetters: b.haloLetters,
    endings: b.endings,
    unreadMail: term ? unreadMail(s, term) : 0,
  };
  if (deviceId) info.deviceId = deviceId;
  if (room) info.roomId = room.id;
  if (placementId) info.pinned = pinnedCards(s, placementId);
  return info;
}

/** Card colours of a live pinboard (paper, yellow, pink, blue, green, orange). */
export const NOTE_CARD_COLORS = [
  "rgb(236,228,206)",
  "rgb(242,221,110)",
  "rgb(240,168,190)",
  "rgb(156,200,240)",
  "rgb(168,226,160)",
  "rgb(244,178,110)",
] as const;

const NOTE_TONE: Record<MemoSourceKind, number> = {
  custom: 0,
  note: 0,
  message: 0,
  archive: 1,
  log: 1,
  insight: 3,
  course: 3,
  readout: 4,
  device: 4,
  recipe: 2,
  puzzle: 2,
  experiment: 5,
};

/** First one or two words of a memo title (the pixel font is small). */
export function shortNoteTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const two = words.slice(0, 2).join(" ");
  return two.length > 16 ? (words[0] ?? "").slice(0, 16) : two;
}

/**
 * Memos pinned to a decor placement, oldest first. Memos store the board
 * as `place` = the placement id (e.g. "decor:jadeq:a16"); the explicit
 * "decor:" + placement id form is accepted as well.
 */
export function pinnedCards(s: WorldState, placementId: string): PinnedCard[] {
  const alt = `decor:${placementId}`;
  return (s.memos ?? [])
    .filter((m) => m.place === placementId || m.place === alt)
    .sort((a, b) => a.t - b.t)
    .map((m) => ({ title: shortNoteTitle(m.title), tone: NOTE_TONE[m.source?.kind ?? "custom"] }));
}

// ── Colour helpers ───────────────────────────────────────────────

type RGB = [number, number, number];

const RGB_CACHE = new Map<string, RGB>();

function parseHex(hex: string): RGB {
  let c = RGB_CACHE.get(hex);
  if (c) return c;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.replace(/./g, (x) => x + x);
  const n = parseInt(h.slice(0, 6), 16);
  c = Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [51, 255, 51];
  RGB_CACHE.set(hex, c);
  return c;
}

function css(c: RGB): string {
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}

function scale(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}

function mix(a: RGB, b: RGB, f: number): RGB {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const WHITE: RGB = [255, 255, 255];

interface Pal {
  fg: string;
  hot: string;
  dim: string;
  faint: string;
  bg: string;
  rgb: RGB;
}

const PAL_CACHE = new Map<string, Pal>();

function palette(hex: string): Pal {
  let p = PAL_CACHE.get(hex);
  if (p) return p;
  const c = parseHex(hex);
  p = {
    fg: css(c),
    hot: css(mix(c, WHITE, 0.65)),
    dim: css(scale(c, 0.45)),
    faint: css(scale(c, 0.2)),
    bg: css(mix([4, 6, 5], c, 0.06)),
    rgb: c,
  };
  PAL_CACHE.set(hex, p);
  return p;
}

/** Default phosphor per content kind. */
export const SCREEN_COLOR: Record<ScreenContent, string> = {
  power: "#FFB800",
  wave: "#33FF33",
  scope: "#33FF33",
  status: "#33FF33",
  log: "#33FF33",
  map: "#00FFFF",
  text: "#33FF33",
  bars: "#33FF33",
  clock: "#FF3333",
  radar: "#33FF33",
  code: "#33FF33",
  face: "#00FFFF",
  spectrum: "#E8F4FF",
  qubits: "#9AD0FF",
  reactor: "#FF6B00",
  damien: "#00FFFF",
  boot: "#33FF33",
  noise: "#CFD8DC",
  notes: "#F4E9C8",
  cams: "#9FD8FF",
};

// ── Noise ────────────────────────────────────────────────────────

/** Deterministic 0..1 hash of up to three integers. */
export function hash3(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ── 3×5 pixel font ───────────────────────────────────────────────

/** Rows top→bottom, 3 bits each (4 = left, 2 = middle, 1 = right). */
const FONT: Record<string, string> = {
  "0": "75557",
  "1": "26227",
  "2": "71747",
  "3": "71317",
  "4": "55711",
  "5": "74717",
  "6": "74757",
  "7": "71222",
  "8": "75757",
  "9": "75717",
  A: "25755",
  B: "65656",
  C: "34443",
  D: "65556",
  E: "74647",
  F: "74644",
  G: "34553",
  H: "55755",
  I: "72227",
  J: "11152",
  K: "55655",
  L: "44447",
  M: "57755",
  N: "65555",
  O: "25552",
  P: "65644",
  Q: "25563",
  R: "65655",
  S: "34216",
  T: "72222",
  U: "55557",
  V: "55552",
  W: "55775",
  X: "55255",
  Y: "55222",
  Z: "71247",
  " ": "00000",
  ".": "00002",
  ",": "00024",
  ":": "02020",
  ";": "02024",
  "-": "00700",
  _: "00007",
  "/": "11244",
  "\\": "44211",
  "%": "51245",
  ">": "42124",
  "<": "12421",
  "[": "64446",
  "]": "32223",
  "(": "24442",
  ")": "42224",
  "!": "22202",
  "?": "71202",
  "|": "22222",
  "+": "02720",
  "=": "07070",
  "#": "57575",
  "*": "05250",
  "'": "22000",
  '"': "55000",
  "█": "77777",
  "▮": "77777",
  "·": "00200",
  "@": "75743",
  $: "36736",
  "&": "25257",
  "~": "00630",
  "^": "25000",
};

const FOLD: Record<string, string> = {
  Ä: "A",
  Ö: "O",
  Ü: "U",
  ẞ: "S",
  ß: "S",
  "−": "-",
  "–": "-",
  "—": "-",
  "→": ">",
  "←": "<",
  "≥": ">",
  "≤": "<",
  "„": '"', // i18n-ignore (font fold)
  "“": '"',
  "”": '"',
  "»": '"', // i18n-ignore (font fold)
  "«": '"', // i18n-ignore (font fold)
  "…": ".",
  "×": "X",
  σ: "S",
  ψ: "Y",
};

/** Runs [dx, len] per row digit. */
const RUNS: [number, number][][] = [
  [],
  [[2, 1]],
  [[1, 1]],
  [[1, 2]],
  [[0, 1]],
  [
    [0, 1],
    [2, 1],
  ],
  [[0, 2]],
  [[0, 3]],
];

export const GLYPH_W = 4;
export const GLYPH_H = 6;

function glyph(ch: string): string {
  const up = ch.toUpperCase();
  return FONT[up] ?? FONT[FOLD[up] ?? FOLD[ch] ?? ""] ?? FONT["?"]!;
}

/** Draw `str` at (x, y) with pixel size `px`; returns the x after the text. */
export function drawText(
  ctx: ScreenCtx,
  str: string,
  x: number,
  y: number,
  color: string,
  px = 1,
): number {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of str) {
    if (ch !== " ") {
      const g = glyph(ch);
      for (let row = 0; row < 5; row++) {
        const runs = RUNS[g.charCodeAt(row) - 48] ?? [];
        for (const [dx, len] of runs) ctx.fillRect(cx + dx * px, y + row * px, len * px, px);
      }
    }
    cx += GLYPH_W * px;
  }
  return cx;
}

/** Word-wrap to `cols` characters (hard-cuts long words). */
export function wrapText(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      let w = word;
      while (w.length > cols) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, cols));
        w = w.slice(cols);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= cols) line += ` ${w}`;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

function clip(s: string, cols: number): string {
  return s.length > cols ? s.slice(0, Math.max(0, cols)) : s;
}

// ── Drawing helpers ──────────────────────────────────────────────

interface Frame {
  ctx: ScreenCtx;
  w: number;
  h: number;
  t: number;
  pal: Pal;
  info: ScreenInfo;
  spec: ScreenSpec;
  cols: number;
  rows: number;
}

function rect(f: Frame, x: number, y: number, w: number, h: number, color: string): void {
  f.ctx.fillStyle = color;
  f.ctx.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(w)),
    Math.max(1, Math.round(h)),
  );
}

function px(f: Frame, x: number, y: number, color: string): void {
  f.ctx.fillStyle = color;
  f.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function circle(f: Frame, cx: number, cy: number, r: number, color: string, step = 0): void {
  const n = step || Math.max(12, Math.round(r * 6.5));
  f.ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    f.ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}

function disc(f: Frame, cx: number, cy: number, r: number, color: string): void {
  f.ctx.fillStyle = color;
  for (let y = Math.ceil(-r); y <= Math.floor(r); y++) {
    const half = Math.sqrt(Math.max(0, r * r - y * y));
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    f.ctx.fillRect(x0, Math.round(cy + y), Math.max(1, x1 - x0 + 1), 1);
  }
}

function line(f: Frame, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  f.ctx.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    f.ctx.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1);
  }
}

function text(f: Frame, s: string, col: number, row: number, color = f.pal.fg): void {
  drawText(f.ctx, clip(s, f.cols - col), 2 + col * GLYPH_W, 2 + row * GLYPH_H, color);
}

function blink(t: number, hz = 1.5, duty = 0.5): boolean {
  const u = t * hz;
  return u - Math.floor(u) < duty;
}

function watt(n: number): string {
  const r = Math.round(n);
  return `${r}W`;
}

function grid(f: Frame, cell: number): void {
  const { w, h } = f;
  f.ctx.fillStyle = f.pal.faint;
  for (let x = cell; x < w; x += cell) for (let y = 1; y < h; y += 2) f.ctx.fillRect(x, y, 1, 1);
  for (let y = cell; y < h; y += cell) for (let x = 1; x < w; x += 2) f.ctx.fillRect(x, y, 1, 1);
}

// ── Layout helpers ───────────────────────────────────────────────

const RED = "rgb(255,60,50)";
const AMBER = "rgb(255,184,0)";

/** Height of the header strip (px). */
const HEADER_H = 8;

/** True when the screen is big enough for a header strip plus content. */
function roomy(f: Frame): boolean {
  return f.h >= 24 && f.w >= 32;
}

/** Inverted header strip: `left` label, optional right-aligned `right`. Returns the content top. */
function header(f: Frame, left: string, right = "", rightColor?: string): number {
  if (!roomy(f)) return 1;
  rect(f, 0, 0, f.w, HEADER_H - 1, f.pal.faint);
  const rl = right.length;
  const cols = f.cols - (rl ? rl + 1 : 0);
  drawText(f.ctx, clip(left, cols), 2, 1, f.pal.hot);
  if (rl) drawText(f.ctx, right, f.w - 1 - rl * GLYPH_W, 1, rightColor ?? f.pal.fg);
  return HEADER_H + 1;
}

/** Text line at pixel row `y` (column `col`). */
function textAt(f: Frame, s: string, col: number, y: number, color = f.pal.fg): void {
  drawText(f.ctx, clip(s, f.cols - col), 2 + col * GLYPH_W, Math.round(y), color);
}

/** Sparkline of `values` (0..max) inside the box. */
function spark(
  f: Frame,
  values: readonly number[],
  x: number,
  y: number,
  w: number,
  h: number,
  max: number,
  color: string,
): void {
  if (values.length < 2 || w < 4 || h < 3) return;
  const n = values.length;
  let prev: [number, number] | null = null;
  for (let i = 0; i < n; i++) {
    const px2 = x + (i / (n - 1)) * (w - 1);
    const py = y + h - 1 - Math.min(1, Math.max(0, values[i]! / Math.max(1e-6, max))) * (h - 1);
    if (prev) line(f, prev[0], prev[1], px2, py, color);
    prev = [px2, py];
  }
  if (prev) px(f, prev[0], prev[1], f.pal.hot);
}

/** Horizontal meter. */
function meter(f: Frame, x: number, y: number, w: number, frac: number, color: string): void {
  rect(f, x, y, w, 3, f.pal.faint);
  const fill = Math.round(w * Math.min(1, Math.max(0, frac)));
  for (let i = 0; i < fill; i += 2) rect(f, x + i, y, 1, 3, color);
  if (fill > 0) rect(f, x + fill - 1, y, 1, 3, f.pal.hot);
}

/** Lines of the spec's caption feed (room terminals set `text`). */
function feed(f: Frame): string[] {
  return f.spec.text ? f.spec.text.split("\n").filter(Boolean) : [];
}

/** A slowly cycling caption from the feed (or null). */
function captionLine(f: Frame): string | null {
  const lines = feed(f);
  if (!lines.length) return null;
  return lines[Math.floor(f.t / 3) % lines.length]!;
}

function mmss(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  return `${pad2(Math.floor(t / 60) % 100)}:${pad2(t % 60)}`;
}

// ── Content renderers ────────────────────────────────────────────

function drawPower(f: Frame): void {
  const { info, w, h, t, pal } = f;
  const reserve = Math.round(info.generation - info.demand);
  const alarm = info.brownout > 0;
  const top = header(
    f,
    alarm && blink(t, 2) ? tr("BROWNOUT {n}", { n: info.brownout }) : tr("POWER"),
    `${reserve >= 0 ? "+" : ""}${reserve}W`,
    reserve < 0 || alarm ? RED : reserve < 10 ? AMBER : pal.fg,
  );
  const max = Math.max(50, info.generation, info.demand);
  const barW = w - 6;
  const rows: [string, number, string][] = [
    [tr("GEN"), info.generation, pal.fg],
    [tr("LOAD"), info.demand, info.demand > info.generation ? RED : pal.fg],
  ];
  let y = top;
  for (const [label, v, col] of rows) {
    if (y + 10 > h) break;
    textAt(f, `${label} ${watt(v)}`, 0, y, pal.fg);
    meter(f, 3, y + 6, barW, v / max, col);
    y += 11;
  }
  // Load history (one sample per grid change) or a live ripple.
  if (h - y > 8) {
    const hist = info.loadHistory;
    if (hist.length >= 2) {
      rect(f, 2, h - 3, w - 4, 1, pal.faint);
      spark(f, hist, 3, y + 1, w - 6, h - y - 4, Math.max(1, ...hist), pal.dim);
      spark(f, hist.slice(-2), w - 10, y + 1, 7, h - y - 4, Math.max(1, ...hist), pal.fg);
    } else {
      const mid = y + (h - y) / 2;
      const amp = (h - y) / 2 - 2;
      const ratio = info.generation > 0 ? info.demand / info.generation : 0;
      let prev = mid;
      for (let x = 2; x < w - 2; x++) {
        const v =
          ratio * 0.8 +
          0.15 * Math.sin(x * 0.35 + t * 4) +
          0.1 * (hash3(x, Math.floor(t * 6)) - 0.5);
        const yy = mid + amp - Math.min(1, Math.max(0, v)) * amp * 2;
        line(f, x - 1, prev, x, yy, pal.dim);
        prev = yy;
      }
    }
  }
  if (!roomy(f) && alarm && blink(t, 2)) rect(f, 0, 0, w, 2, RED);
}

function drawWave(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const dbm = -94 + Math.round(info.signalLevel * 40);
  const top = header(f, `${dbm}DBM`, info.signalLevel > 0.5 ? "847HZ" : tr("NOISE"));
  grid(f, 8);
  const body = h - top;
  const mid = top + body / 2;
  const level = 0.35 + 0.65 * info.signalLevel;
  const amp = (body / 2 - 2) * level * (0.8 + 0.2 * Math.sin(t * 0.7));
  const k = (Math.PI * 2 * (1.5 + info.signalLevel * 2)) / w;
  const noise = 1 - info.signalLevel;
  let prev = mid;
  for (let x = 1; x < w - 1; x++) {
    const jitter = noise * (hash3(x, Math.floor(t * 10)) - 0.5) * body * 0.35;
    const y = mid - amp * Math.sin(x * k - t * 5) + jitter;
    line(f, x - 1, prev, x, y, pal.fg);
    if (Math.abs(y - (mid - amp)) < 1.2) px(f, x, y, pal.hot);
    prev = y;
  }
  // Damien's trace: a faint second carrier, stronger the more of him is known.
  if (info.damienSignal > 0) {
    const a2 = (body / 2 - 2) * info.damienSignal * 0.6;
    for (let x = 1; x < w - 1; x += 2) {
      const y = mid - a2 * Math.sin(x * k * 1.5 + t * 3.1 + 1);
      px(f, x, y, pal.dim);
    }
  }
}

function drawScope(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const locked = info.solved.has("pz_lissajous");
  const top = header(f, info.deviceId ?? "XY", locked ? "LOCK" : blink(t, 1) ? tr("SEEK") : "");
  grid(f, 8);
  const cx = w / 2;
  const cy = top + (h - top) / 2;
  const rx = w / 2 - 4;
  const ry = (h - top) / 2 - 3;
  const n = 260;
  // Unsolved: the phase drifts and the ratio wobbles; solved: a clean, still 3:2 figure.
  const d = locked ? Math.PI / 4 : t * 0.9;
  const ratio = locked ? 2 : 2 + 0.03 * Math.sin(t * 0.4);
  f.ctx.fillStyle = pal.fg;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    f.ctx.fillRect(
      Math.round(cx + rx * Math.sin(3 * a + d)),
      Math.round(cy + ry * Math.sin(ratio * a)),
      1,
      1,
    );
  }
  const a = t * 2.1;
  px(f, cx + rx * Math.sin(3 * a + d), cy + ry * Math.sin(ratio * a), pal.hot);
}

function drawStatus(f: Frame): void {
  const { info, t, pal, w, h } = f;
  const id = info.deviceId ?? info.roomName;
  let state: string;
  let col = pal.fg;
  if (info.deviceId && !info.built) {
    state = tr("STAGE {stage}/{stages}", { stage: info.stage, stages: info.stages });
    col = AMBER;
  } else if (info.starved) {
    state = blink(t, 2) ? tr("NO POWER") : "";
    col = RED;
  } else if (info.online || !info.deviceId) {
    state = "ONLINE";
  } else {
    state = "OFFLINE";
    col = pal.dim;
  }
  if (!roomy(f)) {
    text(f, id, 0, 0, pal.hot);
    text(f, state, 0, 1, col);
    if (info.stages > 0)
      meter(f, 2, h - 4, w - 4, info.stage / info.stages, info.built ? pal.fg : AMBER);
    return;
  }
  const top = header(f, id, info.online && blink(t, 1) ? "*" : "");
  const nameLines = wrapText(info.deviceName || info.roomName, f.cols);
  textAt(f, nameLines[0] ?? "", 0, top, pal.dim);
  textAt(f, state, 0, top + 7, col);
  if (info.deviceId) {
    const wv = info.watts < 0 ? `+${watt(-info.watts)}` : `-${watt(info.watts)}`;
    if (top + 20 < h)
      textAt(f, tr("{wv} GRID {gen}", { wv, gen: watt(info.generation) }), 0, top + 14, pal.fg);
  } else if (top + 20 < h) {
    textAt(
      f,
      tr("GRID {gen}/{load}", { gen: watt(info.generation), load: watt(info.demand) }),
      0,
      top + 14,
      pal.fg,
    );
  }
  if (info.stages > 0 && h > 34) {
    const y = h - 6;
    const bw = w - 6;
    // Stage pips.
    for (let i = 0; i < info.stages; i++) {
      const x0 = 3 + Math.round((bw * i) / info.stages);
      const x1 = 3 + Math.round((bw * (i + 1)) / info.stages) - 2;
      rect(
        f,
        x0,
        y,
        Math.max(1, x1 - x0),
        3,
        i < info.stage ? (info.built ? pal.fg : AMBER) : pal.faint,
      );
    }
  }
}

function drawLog(f: Frame): void {
  const { info, t, pal } = f;
  const top = f.rows >= 4 ? header(f, "UNDMESG", `${info.log.length}`) : 1;
  const lines: string[] = [];
  info.log.forEach((l, i) => {
    const stamp = info.logT[i];
    const pre = stamp === undefined || f.cols < 16 ? ">" : `[${mmss(stamp)}]`;
    lines.push(...wrapText(`${pre} ${l}`, f.cols));
  });
  if (!lines.length) lines.push(tr("> -- EMPTY --"));
  const rows = Math.max(1, Math.floor((f.h - top - 7) / GLYPH_H) + 1);
  // Slow teleprinter scroll through the tail.
  const extra = Math.max(0, lines.length - rows);
  const span = extra + 3;
  const step = Math.floor(t / 1.6) % (span + 1);
  const start = Math.min(extra, step);
  const shown = lines.slice(start, start + rows);
  shown.forEach((s, i) =>
    textAt(f, s, 0, top + i * GLYPH_H, i === shown.length - 1 ? pal.hot : pal.fg),
  );
  if (blink(t, 1.5) && shown.length < rows)
    textAt(f, "_", 0, top + shown.length * GLYPH_H, pal.hot);
}

function drawMap(f: Frame): void {
  const { info, w, h, t, pal } = f;
  const rooms = info.rooms;
  if (!rooms.length) return drawNoise(f);
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const r of rooms) {
    x0 = Math.min(x0, r.x);
    z0 = Math.min(z0, r.z);
    x1 = Math.max(x1, r.x + r.w);
    z1 = Math.max(z1, r.z + r.d);
  }
  const top = header(
    f,
    info.floorShort,
    `${info.devices.filter((d) => d.online).length}/${info.devices.length}`,
  );
  const s = Math.min((w - 4) / (x1 - x0), (h - top - 2) / (z1 - z0));
  const ox = (w - (x1 - x0) * s) / 2;
  const oz = top + (h - top - (z1 - z0) * s) / 2;
  const mx = (x: number) => ox + (x - x0) * s;
  const mz = (z: number) => oz + (z - z0) * s;
  for (const r of rooms) {
    const here = r.id === info.roomId;
    if (here) rect(f, mx(r.x), mz(r.z), r.w * s, r.d * s, pal.faint);
    const col = here ? pal.fg : pal.dim;
    line(f, mx(r.x), mz(r.z), mx(r.x + r.w), mz(r.z), col);
    line(f, mx(r.x), mz(r.z + r.d), mx(r.x + r.w), mz(r.z + r.d), col);
    line(f, mx(r.x), mz(r.z), mx(r.x), mz(r.z + r.d), col);
    line(f, mx(r.x + r.w), mz(r.z), mx(r.x + r.w), mz(r.z + r.d), col);
  }
  for (const d of info.devices) {
    if (!d.known) continue;
    const col = d.online ? pal.hot : d.built ? pal.fg : pal.dim;
    if (d.online && !blink(t + hash3(d.x, d.z), 0.7, 0.85)) continue;
    rect(f, mx(d.x), mz(d.z), 1, 1, col);
  }
  if (info.player.floor === info.floor && blink(t, 2, 0.7)) {
    rect(f, mx(info.player.x) - 1, mz(info.player.z) - 1, 3, 3, pal.hot);
  }
}

/**
 * Surveillance station: one room camera per screen, cycling through every
 * room of the lab (each screen offset so the three show different rooms).
 * The sweep follows the pan of the camera head in the room (same curve as
 * the `security_cam` part: sway, amplitude 0.75 rad, 0.07 Hz).
 */
export function camPan(t: number): number {
  return 0.75 * Math.sin(t * 0.07 * Math.PI * 2);
}

const CAM_DWELL = 5;

function drawCams(f: Frame): void {
  const { w, h, t, pal, spec } = f;
  const rooms = ROOMS.filter((r) => !r.id.startsWith("aufzug"));
  if (!rooms.length) return drawNoise(f);
  const lane = Math.round((spec.center[0] ?? 0) * 7) % 3;
  const k = (Math.floor(t / CAM_DWELL) * 3 + lane) % rooms.length;
  const r = rooms[k]!;
  const top = header(f, `CAM ${String(k + 1).padStart(2, "0")}`, FLOOR_BY_ID[r.floor]?.short ?? "");
  // Room outline in the remaining area, the camera in the top-left corner.
  const s = Math.min((w - 4) / r.w, (h - top - 3) / r.d);
  const ox = (w - r.w * s) / 2;
  const oz = top + 1 + (h - top - 3 - r.d * s) / 2;
  rect(f, ox, oz, r.w * s, r.d * s, pal.faint);
  line(f, ox, oz, ox + r.w * s, oz, pal.dim);
  line(f, ox, oz + r.d * s, ox + r.w * s, oz + r.d * s, pal.dim);
  line(f, ox, oz, ox, oz + r.d * s, pal.dim);
  line(f, ox + r.w * s, oz, ox + r.w * s, oz + r.d * s, pal.dim);
  const cx = ox + 1;
  const cz = oz + 1;
  const yaw = Math.PI / 4 + camPan(t);
  const len = Math.hypot(r.w, r.d) * s;
  for (const a of [-0.35, 0, 0.35])
    line(
      f,
      cx,
      cz,
      cx + Math.cos(yaw + a) * len,
      cz + Math.sin(yaw + a) * len,
      a ? pal.dim : pal.fg,
    );
  // Scan noise and REC.
  for (let i = 0; i < 6; i++) {
    const n = hash3(i, Math.floor(t * 8), k);
    rect(f, ox + n * r.w * s, oz + ((n * 7.3) % 1) * r.d * s, 1, 1, pal.dim);
  }
  if (blink(t, 1, 0.6)) rect(f, w - 4, top + 1, 2, 2, "#ff3a2a");
  textAt(f, r.name.slice(0, Math.max(4, f.cols - 1)), 0, h - 2, pal.fg);
}

function drawTextContent(f: Frame): void {
  const { spec, info, t, pal } = f;
  const own = spec.text;
  const top = own
    ? f.rows >= 4 && info.unreadMail
      ? header(f, info.roomName, tr("MAIL {n}", { n: info.unreadMail }), AMBER)
      : 1
    : header(f, tr("OBJECTIVE"));
  const body = own ?? info.objective;
  const rows = Math.max(1, Math.floor((f.h - top - 5) / GLYPH_H) + 1);
  const lines = wrapText(body, f.cols).slice(0, rows);
  const total = lines.reduce((a, l) => a + l.length, 0);
  const cps = 14;
  const cycle = total / cps + 5;
  let shown = Math.floor((t % cycle) * cps);
  let row = 0;
  for (const l of lines) {
    if (shown <= 0) break;
    const part = l.slice(0, shown);
    textAt(f, part, 0, top + row * GLYPH_H, pal.fg);
    if (shown < l.length && blink(t, 3)) textAt(f, "█", part.length, top + row * GLYPH_H, pal.hot);
    shown -= l.length;
    row++;
  }
  if (shown > 0 && blink(t, 1.5) && row < rows) textAt(f, "_", 0, top + row * GLYPH_H, pal.hot);
}

function drawBars(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const top = header(f, tr("screen::DEVICES"), `${info.devicesBuilt}/${info.devicesTotal}`);
  const floors = info.floors.filter((x) => x.total > 0);
  const n = Math.max(1, floors.length);
  const labels = roomy(f) && h >= 40;
  const bottom = labels ? h - 8 : h - 2;
  const bw = Math.max(2, Math.floor((w - 4) / n));
  const max = Math.max(1, ...floors.map((x) => x.total));
  const segs = Math.max(2, Math.floor((bottom - top) / 3));
  floors.forEach((fl, i) => {
    const x = 2 + i * bw;
    const here = fl.short === info.floorShort;
    const totalSegs = Math.max(1, Math.round((fl.total / max) * segs));
    const built = Math.round((fl.built / max) * segs);
    const online = Math.round((fl.online / max) * segs);
    for (let s = 0; s < totalSegs; s++) {
      const y = bottom - 2 - s * 3;
      const col =
        s < online ? (s === online - 1 ? pal.hot : pal.fg) : s < built ? AMBER : pal.faint;
      rect(f, x, y, bw - 2, 2, col);
    }
    // Live activity pip on floors with online devices.
    if (fl.online > 0 && blink(t + i * 0.37, 2, 0.3))
      rect(f, x, bottom - online * 3 - 1, bw - 2, 1, pal.hot);
    if (labels)
      drawText(
        f.ctx,
        clip(fl.short.replace(/^[A-Z]/, ""), Math.max(1, Math.floor((bw - 1) / GLYPH_W))),
        x,
        h - 6,
        here ? pal.hot : pal.dim,
      );
  });
}

function drawClock(f: Frame): void {
  const { info, w, h, t, pal } = f;
  const phase = t % 14;
  let str = "03:41";
  if (phase > 9 && phase < 12.5) str = info.clock;
  const glitch = (phase > 8.7 && phase < 9) || (phase > 12.3 && phase < 12.6);
  if (glitch) {
    const k = Math.floor(t * 30);
    str = `${Math.floor(hash3(k, 1) * 10)}${Math.floor(hash3(k, 2) * 10)}:${Math.floor(hash3(k, 3) * 6)}${Math.floor(hash3(k, 4) * 10)}`;
  }
  if (!blink(t, 1, 0.6)) str = str.replace(":", " ");
  const footer = h >= 30 ? 8 : 0;
  const size = Math.max(
    1,
    Math.min(Math.floor((w - 4) / (5 * GLYPH_W)), Math.floor((h - 4 - footer) / 6)),
  );
  const tw = 5 * GLYPH_W * size - size;
  const x = Math.round((w - tw) / 2);
  const y = Math.round((h - footer - 5 * size) / 2);
  // Ghost segments ("88:88") like a real LED display.
  drawText(f.ctx, "88:88", x, y, pal.faint, size);
  drawText(f.ctx, str, x, y, glitch ? pal.hot : pal.fg, size);
  if (glitch) rect(f, 0, y + Math.floor(hash3(Math.floor(t * 30)) * 5 * size), w, 1, pal.hot);
  if (footer) {
    const label = phase > 9 && phase < 12.5 ? tr("DAY {day}", { day: info.day }) : tr("02/14/2019");
    const lx = Math.max(1, Math.round((w - label.length * GLYPH_W) / 2));
    drawText(f.ctx, clip(label, f.cols), lx, h - 7, pal.dim);
  }
}

function drawRadar(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const top =
    roomy(f) && h >= 40 ? header(f, info.floorShort, `${info.botsAwake}/${info.botsTotal}`) : 0;
  const cx = w / 2;
  const cy = top + (h - top) / 2;
  const r = Math.min(w, h - top) / 2 - 2;
  circle(f, cx, cy, r, pal.dim);
  circle(f, cx, cy, r * 0.5, pal.faint);
  line(f, cx - r, cy, cx + r, cy, pal.faint);
  line(f, cx, cy - r, cx, cy + r, pal.faint);
  const sweep = (t * 1.6) % (Math.PI * 2);
  for (let k = 6; k >= 0; k--) {
    const a = sweep - k * 0.07;
    line(
      f,
      cx,
      cy,
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      k === 0 ? pal.hot : k < 3 ? pal.fg : pal.dim,
    );
  }
  // Blips: the known devices of this floor at their real bearing from the screen's room.
  const room = info.rooms.find((x) => x.id === info.roomId);
  const ox = room ? room.x + room.w / 2 : 68;
  const oz = room ? room.z + room.d / 2 : 60;
  const range = 90;
  const blips = info.devices.filter((d) => d.known);
  const pts: { a: number; d: number; hot: boolean }[] = blips.map((d) => ({
    a: Math.atan2(d.z - oz, d.x - ox),
    d: Math.min(1, Math.hypot(d.x - ox, d.z - oz) / range) * r * 0.95,
    hot: d.online,
  }));
  if (info.player.floor === info.floor) {
    pts.push({
      a: Math.atan2(info.player.z - oz, info.player.x - ox),
      d: Math.min(1, Math.hypot(info.player.x - ox, info.player.z - oz) / range) * r * 0.95,
      hot: true,
    });
  }
  if (!pts.length) {
    // Nothing known yet: ghost echoes.
    for (let i = 0; i < 4; i++)
      pts.push({ a: hash3(i, 7) * Math.PI * 2, d: (0.3 + 0.6 * hash3(i, 11)) * r, hot: false });
  }
  for (const p of pts) {
    const since = (((sweep - p.a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const fade = 1 - since / (Math.PI * 2);
    if (fade < 0.35) continue;
    rect(
      f,
      cx + Math.cos(p.a) * p.d - 1,
      cy + Math.sin(p.a) * p.d - 1,
      2,
      2,
      fade > 0.9 || p.hot ? pal.hot : pal.dim,
    );
  }
}

const UNOS_LINES = [
  tr("unsystemd[1]: halo-capture.service active"),
  "mcp> sync /unvar/halo",
  tr("kernel: resonance 0.847 stable"),
  tr("bnet: agents counted"),
  "unsched: tick 0x3F41",
  "mcp> keep listening.",
];

function drawCode(f: Frame): void {
  const { t, pal, info } = f;
  const cap = feed(f);
  const top =
    f.rows >= 4 && cap.length
      ? header(f, cap[0]!, info.unreadMail ? tr("MAIL {n}", { n: info.unreadMail }) : "")
      : 1;
  const small = f.rows < 4;
  let first = 0;
  if (small && cap.length) {
    // Small terminal screens: the feed line leads, the rest scrolls below it.
    textAt(f, captionLine(f) ?? "", 0, top, pal.hot);
    first = 1;
  }
  const rows = Math.max(1, Math.floor((f.h - top - 5) / GLYPH_H) + 1);
  const base = Math.floor(t * 4);
  const hex = "0123456789ABCDEF";
  const liveShare = small ? 0.5 : 0.22;
  const live = [
    ...info.log.map((l) => `undmesg: ${l}`),
    tr("grid {gen}/{load}", { gen: watt(info.generation), load: watt(info.demand) }),
    tr("undev: {built}/{total} devices", { built: info.devicesBuilt, total: info.devicesTotal }),
    tr("bnet: {awake}/{total} awake", { awake: info.botsAwake, total: info.botsTotal }),
    ...cap.slice(1).map((c) => c.toLowerCase()),
  ];
  for (let r = first; r < rows; r++) {
    const n = base + r;
    let s: string;
    const roll = hash3(n, 3);
    if (roll < liveShare && live.length) s = live[Math.floor(hash3(n, 5) * live.length)]!;
    else if (roll < liveShare + 0.06) s = UNOS_LINES[Math.floor(hash3(n, 9) * UNOS_LINES.length)]!;
    else {
      s = (((n * 16) & 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, "0") + ":";
      for (let b = 0; b < 8; b++) {
        const v = Math.floor(hash3(n, b + 17) * 256);
        s += ` ${hex[v >> 4]}${hex[v & 15]}`;
      }
    }
    textAt(f, s, 0, top + r * GLYPH_H, r === rows - 1 ? pal.hot : r % 3 === 0 ? pal.fg : pal.dim);
  }
}

function drawFace(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const cx = w / 2;
  const cy = h / 2;
  const blinking = t % 4.3 > 4.12;
  if (info.deviceId === "MCP-000") {
    // The MCP's single eye; the pupil opens with the power it gets.
    const r = Math.min(w, h) / 2 - 3;
    const strength = Math.min(1, 0.35 + info.generation / 200);
    circle(f, cx, cy, r, pal.dim);
    circle(f, cx, cy, r - 1, pal.faint);
    if (!blinking) {
      const lx = Math.sin(t * 0.6) * r * 0.35;
      const ly = Math.sin(t * 0.43) * r * 0.2;
      disc(f, cx + lx, cy + ly, r * 0.45 * strength, pal.fg);
      disc(f, cx + lx, cy + ly, r * 0.18 * strength, pal.hot);
    } else rect(f, cx - r, cy, r * 2, 1, pal.fg);
    if (info.brownout > 0 && blink(t, 2)) circle(f, cx, cy, r, RED);
    return;
  }
  // Bots: the more of the bot net is awake, the happier the face.
  const mood = info.botsTotal ? info.botsAwake / info.botsTotal : 0;
  const ew = Math.max(3, Math.round(w * 0.14));
  const eh = Math.max(3, Math.round(h * 0.22));
  const ey = cy - eh;
  for (const sx of [-1, 1]) {
    const ex = cx + sx * w * 0.2 - ew / 2;
    if (blinking) rect(f, ex, ey + eh / 2, ew, 1, pal.fg);
    else {
      rect(f, ex, ey, ew, eh, pal.fg);
      rect(f, ex + 1, ey + 1, Math.max(1, ew / 3), Math.max(1, eh / 3), pal.hot);
    }
  }
  const my = cy + h * 0.2;
  const mw = w * 0.36;
  const curve = (mood - 0.4) * h * 0.12;
  for (let x = 0; x < mw; x++) {
    const u = (x / Math.max(1, mw - 1)) * 2 - 1;
    const talk = Math.sin(t * 9) > 0.2 ? Math.round(Math.sin(x * 0.8 + t * 12)) : 0;
    px(f, cx - mw / 2 + x, my + talk - curve * (1 - u * u), pal.fg);
  }
}

function drawSpectrum(f: Frame): void {
  const { w, h, t, info } = f;
  const top = header(
    f,
    `#0089 ${info.slices}/${info.sliceTotal}`,
    `${info.volatility >= 0 ? "+" : ""}${info.volatility}%`,
    info.volatility < 0 ? AMBER : undefined,
  );
  const n = SPECTRUM.length;
  const bw = Math.max(2, Math.floor((w - 4) / n));
  const ox = Math.floor((w - bw * n) / 2);
  const max = Math.max(1, ...info.spectrum);
  const avail = h - top - 4;
  // Volatility makes the bars shiver.
  const shiver = 0.04 + Math.abs(info.volatility) / 250;
  SPECTRUM.forEach((c, i) => {
    const p = palette(SPECTRUM_HEX[c]);
    const count = info.spectrum[i] ?? 0;
    const v = count > 0 ? 0.15 + 0.85 * (count / max) : 0.04;
    const wob =
      shiver * Math.sin(t * (1.3 + i * 0.37) + i * 1.7) +
      shiver * (hash3(i, Math.floor(t * 8)) - 0.5);
    const bh = Math.max(1, Math.min(avail, Math.round((v + wob) * avail)));
    rect(f, ox + i * bw, h - 3 - bh, bw - 1, bh, count > 0 ? p.fg : p.dim);
    rect(f, ox + i * bw, h - 3 - bh, bw - 1, 1, p.hot);
  });
  // Slice progress along the baseline.
  rect(f, 2, h - 2, w - 4, 1, f.pal.faint);
  rect(f, 2, h - 2, ((w - 4) * info.slices) / Math.max(1, info.sliceTotal), 1, f.pal.hot);
}

function drawQubits(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const cell = 7;
  const top = h >= 30 ? HEADER_H + 1 : 1;
  const cols = Math.max(1, Math.floor((w - 2) / cell));
  const rows = Math.max(1, Math.floor((h - top - 1) / cell));
  const ox = Math.floor((w - cols * cell) / 2);
  // Coherence grows with what the lab knows.
  const q = 0.25 + 0.7 * (info.insights / Math.max(1, info.totalInsights));
  let coherent = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = i + j * cols;
      const roll = hash3(k, Math.floor(t * 1.5 + hash3(k) * 3));
      const x = ox + i * cell + 1;
      const y = top + j * cell;
      if (roll > q) {
        rect(f, x, y, 5, 1, pal.dim);
        rect(f, x, y + 4, 5, 1, pal.dim);
        rect(f, x, y, 1, 5, pal.dim);
        rect(f, x + 4, y, 1, 5, pal.dim);
      } else if (roll > q * 0.4) {
        rect(f, x, y, 5, 5, pal.fg);
        coherent++;
      } else {
        const on = Math.sin(t * 13 + k * 2.1) > 0;
        rect(f, x + 1, y + 1, 3, 3, on ? pal.hot : pal.faint);
        coherent++;
      }
    }
  if (top > 1)
    header(f, `QBIT ${coherent}/${cols * rows}`, info.solved.has("pz_sigma") ? "S-17" : "");
}

function drawReactor(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const big = h > 40;
  const top = big
    ? header(
        f,
        tr("CORE"),
        info.brownout ? "SCRAM?" : watt(info.generation),
        info.brownout ? RED : undefined,
      )
    : 0;
  const cx = w / 2;
  const cy = top + (h - top - (big ? 8 : 0)) / 2;
  const r = Math.min(w, h - top - (big ? 8 : 0)) / 2 - 2;
  const load =
    info.generation > 0 ? Math.min(1, info.demand / info.generation) : 0.15 + 0.05 * Math.sin(t);
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a = -Math.PI / 2 + (i / segs) * Math.PI * 2;
    const lit = i / segs < load;
    const col = lit ? (i / segs > 0.85 ? RED : pal.fg) : pal.faint;
    line(
      f,
      cx + Math.cos(a) * (r - 3),
      cy + Math.sin(a) * (r - 3),
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      col,
    );
  }
  const pr = r - 6;
  const step = Math.floor(t * 12);
  const heat = 0.6 + 0.4 * load;
  for (let y = -pr; y <= pr; y += 2)
    for (let x = -pr; x <= pr; x += 2) {
      const d = Math.hypot(x, y) / Math.max(1, pr);
      if (d > 1) continue;
      const v = (1 - d) * heat * (0.6 + 0.4 * Math.sin(t * 5 - d * 8)) + 0.3 * hash3(x, y, step);
      if (v < 0.35) continue;
      rect(f, cx + x, cy + y, 2, 2, v > 0.85 ? pal.hot : v > 0.55 ? pal.fg : pal.dim);
    }
  if (big) {
    const pct = `${Math.round(load * 100)}%`;
    drawText(f.ctx, pct, Math.round(cx - (pct.length * GLYPH_W) / 2), h - 7, pal.hot);
  }
}

/**
 * Damien's silhouette in screen pixels: 1 head, 2 beard, 3 body, 0 outside.
 * Tall and broad, the long beard a wedge below the chin.
 */
function damienShape(x: number, y: number, cx: number, hy: number, hr: number): number {
  const dx = x - cx;
  if (Math.hypot(dx / 0.86, y - hy) < hr) return 1;
  const by0 = hy + hr * 0.35;
  const by1 = hy + hr * 2.7;
  if (y >= by0 && y <= by1 && Math.abs(dx) < hr * 0.82 * (1 - (y - by0) / (by1 - by0))) return 2;
  const sy = hy + hr * 1.2;
  if (y > sy && Math.abs(dx) < Math.min(hr * 2.3, hr * 1.5 + (y - sy) * 1.4)) return 3;
  return 0;
}

/**
 * Damien's screen (workstation, Echo Recorder). Until he has been found he
 * is only a coarse mosaic of static in his shape — the blocks settle a
 * little as more of his trail is known, but never into a face. Found, the
 * portrait resolves: slicked-back hair, the winged eyes, the long beard.
 */
function drawDamien(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const step = Math.floor(t * 12);
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      const n = hash3(x, y, step);
      if (n > 0.86) rect(f, x, y, 2, 2, n > 0.97 ? pal.dim : pal.faint);
    }
  const sig = info.damienSignal;
  const cx = w / 2 + Math.sin(t * 7) * (hash3(step, 3) > 0.8 ? 3 : 0);
  const hr = Math.min(w, h) * 0.14;
  const hy = h * 0.3;
  if (!info.damienRevealed) {
    // The veil: blocks of static in his silhouette, torn rows, dropouts.
    const c = Math.max(2, Math.round(hr / 2));
    const slow = Math.floor(t * 6);
    const dropout = Math.max(0.24, 0.46 - 0.22 * sig);
    for (let j = 0; j * c < h; j++) {
      const tear = hash3(j, slow, 9) > 0.88 ? (hash3(j, slow) > 0.5 ? c : -c) : 0;
      for (let i = 0; i * c < w; i++) {
        const x = i * c;
        const y = j * c;
        if (!damienShape(x + c / 2, y + c / 2, cx, hy, hr)) continue;
        const n = hash3(i, j, slow + 5);
        if (n < dropout) continue;
        const col = n > 0.95 ? pal.hot : n > 0.7 ? pal.fg : n > 0.45 ? pal.dim : pal.faint;
        rect(f, x + tear, y, c, c, col);
      }
    }
  } else {
    // Found: the portrait resolves (a light flicker of static stays).
    const eyeY = hy - hr * 0.1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const region = damienShape(x, y, cx, hy, hr);
        if (!region) continue;
        const n = hash3(x, y, step + 5);
        if (n < 0.06) continue;
        let col = pal.fg;
        if (region === 1) {
          const dx = Math.abs(x - cx);
          if (y < hy - hr * 0.45) col = (x + Math.floor(y / 2)) % 3 ? pal.dim : pal.faint;
          else if (Math.abs(y - eyeY) < 1 && dx > hr * 0.15 && dx < hr * 0.62) col = pal.bg;
          else if (Math.round(y) === Math.round(eyeY - 1) && dx > hr * 0.55 && dx < hr * 0.75)
            col = pal.bg; // the wing
          else if (y > hy + hr * 0.2) col = n > 0.5 ? pal.dim : pal.fg; // moustache and beard
        } else if (region === 2) col = x % 2 ? pal.dim : n > 0.7 ? pal.hot : pal.fg;
        else col = Math.abs(x - cx) < 1 ? pal.dim : n > 0.9 ? pal.faint : pal.fg;
        px(f, x, y, col);
      }
  }
  if (blink(t, 1.2, 0.7)) {
    const label = info.endings > 0 ? tr("[PRESENT]") : `[D.F. ${Math.round(sig * 100)}%]`;
    const lw = label.length * GLYPH_W;
    const x = lw <= w - 2 ? Math.round((w - lw) / 2) : 1;
    drawText(f.ctx, clip(label, Math.floor((w - 2) / GLYPH_W)), x, h - 7, pal.hot);
  }
}

/** Boot lines of a screen: POST, then the real devices of its floor. */
function bootLines(info: ScreenInfo): { text: string; tag: "ok" | "fail" | "off" | "" }[] {
  const out: { text: string; tag: "ok" | "fail" | "off" | "" }[] = [
    { text: "_UNOS V2.0 KERNEL 6.1", tag: "" },
    {
      text: tr("GRID {gen}", { gen: watt(info.generation) }),
      tag: info.generation >= 50 ? "ok" : "fail",
    },
  ];
  for (const d of info.devices) {
    if (!d.known) continue;
    out.push({ text: d.id, tag: d.online ? "ok" : d.built ? "fail" : "off" });
  }
  out.push({
    text: `BNET ${info.botsAwake}/${info.botsTotal}`,
    tag: info.botsAwake ? "ok" : "fail",
  });
  out.push({ text: "LOGIN: JADE", tag: "" });
  out.push({ text: "KEEP LISTENING.", tag: "" });
  return out;
}

const TAG_TEXT = { ok: "[ OK ]", fail: "[FAIL]", off: "[ -- ]", "": "" } as const;

function drawBoot(f: Frame): void {
  const { t, pal, info } = f;
  const all = bootLines(info);
  const cycle = all.length / 2.5 + 4;
  const shown = Math.floor((t % cycle) * 2.5);
  const lines = all.slice(0, Math.min(all.length, shown + 1));
  const rows = f.rows;
  const start = Math.max(0, lines.length - rows);
  lines.slice(start).forEach((l, i) => {
    const tag = TAG_TEXT[l.tag];
    const room = f.cols - tag.length;
    const dots = tag
      ? `${clip(l.text, room - 1)} ${".".repeat(Math.max(0, room - l.text.length - 2))}`
      : l.text;
    text(f, dots, 0, i, i === 0 && start === 0 ? pal.hot : pal.fg);
    if (tag)
      text(
        f,
        tag,
        f.cols - tag.length,
        i,
        l.tag === "ok" ? pal.hot : l.tag === "fail" ? RED : pal.dim,
      );
  });
  if (shown >= all.length && blink(t, 2))
    text(f, "_", 0, Math.min(rows - 1, lines.length), pal.hot);
}

function drawNoise(f: Frame): void {
  const { w, h, t, pal, info } = f;
  const step = Math.floor(t * 15);
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      const n = hash3(x, y, step);
      if (n < 0.45) continue;
      rect(f, x, y, 2, 2, n > 0.93 ? pal.hot : n > 0.72 ? pal.fg : pal.dim);
    }
  // Rolling bar.
  const bar = Math.floor((t * 20) % (h + 8)) - 4;
  f.ctx.globalAlpha = 0.25;
  rect(f, 0, bar, w, 3, pal.hot);
  f.ctx.globalAlpha = 1;
  // Now and then something surfaces in the static.
  const slot = Math.floor(t / 4);
  if (t % 4 < 0.9 && hash3(slot, 41) < 0.5 && f.rows >= 2) {
    const msgs = [info.haloLetters.replace(/_/g, "·"), info.damienSignal > 0.3 ? "D.F.?" : "847"];
    const msg = msgs[slot % msgs.length]!;
    const x = Math.max(1, Math.round((w - msg.length * GLYPH_W) / 2));
    rect(f, 0, Math.round(h / 2) - 4, w, 9, pal.bg);
    drawText(f.ctx, clip(msg, f.cols), x, Math.round(h / 2) - 2, pal.hot);
  }
}

/**
 * Live pinboard: cork, up to 3 × 2 (small: 2 × 1) memo cards with one or two
 * words each, a pin on every card, and the count in the corner.
 */
function drawNotes(f: Frame): void {
  const { w, h, info } = f;
  const CORK = "rgb(150,104,62)";
  const CORK_DARK = "rgb(118,80,46)";
  const INK = "rgb(44,34,26)";
  rect(f, 0, 0, w, h, CORK);
  for (let y = 0; y < h; y += 2)
    for (let x = (y >> 1) % 2; x < w; x += 3) if (hash3(x, y, 91) > 0.72) px(f, x, y, CORK_DARK);
  const cards = info.pinned ?? [];
  const head = h >= 32 ? 8 : 0;
  if (head) {
    drawText(f.ctx, clip(tr("screen::PINBOARD"), f.cols - 6), 2, 2, NOTE_CARD_COLORS[0]);
    const count = `${cards.length}/${BOARD_CAPACITY}`;
    drawText(f.ctx, count, w - 1 - count.length * GLYPH_W, 2, NOTE_CARD_COLORS[1]);
  }
  if (!cards.length) {
    const msg = tr("screen::NOTHING PINNED");
    const lines = wrapText(msg, Math.max(1, f.cols - 1));
    const y0 = Math.round(head + (h - head - lines.length * GLYPH_H) / 2);
    lines.forEach((l, i) =>
      drawText(f.ctx, l, Math.round((w - l.length * GLYPH_W) / 2), y0 + i * GLYPH_H, CORK_DARK),
    );
    rect(f, Math.round(w / 2) - 1, Math.max(head, y0 - 5), 2, 2, RED);
    return;
  }
  const cols = Math.max(1, Math.min(4, Math.floor((w - 2) / 28)));
  const rows = Math.max(1, Math.min(2, Math.floor((h - head - 2) / 20)));
  const slots = cols * rows;
  const more = cards.length > slots ? cards.length - (slots - 1) : 0;
  const shown = more ? cards.slice(0, slots - 1) : cards.slice(0, slots);
  const gap = 2;
  const cw = Math.floor((w - 2 - gap * (cols - 1)) / cols);
  const ch = Math.floor((h - head - 2 - gap * (rows - 1)) / rows);
  const lineCols = Math.max(1, Math.floor((cw - 2) / GLYPH_W));
  const lineRows = Math.max(1, Math.floor((ch - 3) / GLYPH_H));
  const at = (i: number) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // A slight hand-pinned jitter per card.
    const jx = Math.round((hash3(i, 7) - 0.5) * 2);
    const jy = Math.round((hash3(i, 11) - 0.5) * 2);
    return {
      x: Math.max(0, Math.min(w - cw, 1 + c * (cw + gap) + jx)),
      y: Math.max(head, Math.min(h - ch, head + 1 + r * (ch + gap) + jy)),
    };
  };
  shown.forEach((card, i) => {
    const { x, y } = at(i);
    const color = NOTE_CARD_COLORS[card.tone % NOTE_CARD_COLORS.length] ?? NOTE_CARD_COLORS[0];
    rect(f, x + 1, y + 1, cw, ch, CORK_DARK); // shadow
    rect(f, x, y, cw, ch, color);
    wrapText(card.title, lineCols)
      .slice(0, lineRows)
      .forEach((l, k) => drawText(f.ctx, l, x + 2, y + 3 + k * GLYPH_H, INK));
    rect(f, x + Math.floor(cw / 2) - 1, y, 2, 2, RED);
  });
  if (more) {
    const { x, y } = at(slots - 1);
    rect(f, x, y, cw, ch, CORK_DARK);
    const label = `+${more}`;
    drawText(
      f.ctx,
      label,
      x + Math.max(1, Math.round((cw - label.length * GLYPH_W) / 2)),
      y + Math.round(ch / 2) - 2,
      NOTE_CARD_COLORS[0],
    );
  }
}

const RENDERERS: Record<ScreenContent, (f: Frame) => void> = {
  power: drawPower,
  wave: drawWave,
  scope: drawScope,
  status: drawStatus,
  log: drawLog,
  map: drawMap,
  text: drawTextContent,
  bars: drawBars,
  clock: drawClock,
  radar: drawRadar,
  code: drawCode,
  face: drawFace,
  spectrum: drawSpectrum,
  qubits: drawQubits,
  reactor: drawReactor,
  damien: drawDamien,
  boot: drawBoot,
  noise: drawNoise,
  notes: drawNotes,
  cams: drawCams,
};

/** Content kinds that already show the terminal feed themselves. */
const OWN_CAPTION = new Set<ScreenContent>(["text", "code", "log", "notes"]);

/** Room-terminal caption band at the bottom (cycles the feed; long lines scroll). */
function drawCaption(f: Frame): void {
  if (OWN_CAPTION.has(f.spec.content) || f.h < 24) return;
  const cap = captionLine(f);
  if (!cap) return;
  const y = f.h - 8;
  rect(f, 0, y, f.w, 8, f.pal.bg);
  rect(f, 0, y, f.w, 1, f.pal.faint);
  if (cap.length <= f.cols) drawText(f.ctx, cap, 2, y + 2, f.pal.fg);
  else {
    // Ticker: scroll through the line once per caption slot.
    const span = cap.length * GLYPH_W + f.w;
    const off = Math.floor(((f.t % 3) / 3) * span);
    const first = Math.max(0, Math.floor((off - f.w) / GLYPH_W));
    const x = f.w - off + first * GLYPH_W;
    drawText(f.ctx, cap.slice(first, first + f.cols + 2), x, y + 2, f.pal.fg);
  }
  if (f.info.unreadMail && blink(f.t, 1.2)) rect(f, f.w - 3, y + 2, 2, 5, AMBER);
}

// ── Power-on, brownout, no signal ────────────────────────────────

/** Seconds a screen shows its boot sequence after powering on. */
export const BOOT_SECONDS = 2.4;

/** How a screen looks right now. */
export type ScreenLook = "live" | "dark" | "nosignal" | "brownout";

/**
 * `dark` — no power in the lab at all (glass only); `nosignal` — the lab has
 * power but this screen's source is off / unlit; `brownout` — its device is
 * switched on but starved while the grid runs; `live` — normal content.
 */
export function screenLook(spec: ScreenSpec, info: ScreenInfo, powered: boolean): ScreenLook {
  if (!spec.requiresPower || powered) return "live";
  if (info.starved && info.generation > 0) return "brownout";
  if (info.generation >= 50) return "nosignal";
  return "dark";
}

function drawBootSplash(f: Frame, age: number): void {
  const { w, h, pal, info } = f;
  if (age < 0.35) {
    // CRT warm-up: a bright line that opens vertically.
    const open = Math.max(1, Math.round((age / 0.35) * h * 0.5));
    rect(f, 0, 0, w, h, "rgb(2,3,3)");
    rect(f, 0, Math.round(h / 2 - open / 2), w, open, pal.dim);
    rect(f, Math.round(w * 0.1), Math.round(h / 2), Math.round(w * 0.8), 1, pal.hot);
    return;
  }
  const lines = [
    "UNOS BIOS 1997",
    info.deviceId ?? clip(info.roomName.toUpperCase(), 14),
    "POST ...",
    "RAM 847K OK",
    info.starved ? tr("VOLTAGE LOW") : tr("VOLTAGE OK"),
    "[ OK ]",
  ];
  const n = Math.min(
    lines.length,
    Math.floor(((age - 0.35) / (BOOT_SECONDS - 0.6)) * lines.length) + 1,
  );
  const rows = Math.max(1, f.rows);
  const start = Math.max(0, n - rows);
  lines.slice(start, n).forEach((l, i) => text(f, l, 0, i, l === "[ OK ]" ? pal.hot : pal.fg));
  if (blink(f.t, 4)) text(f, "_", 0, Math.min(rows - 1, n - start), pal.hot);
}

function drawNoSignal(f: Frame): void {
  const { w, h, t, pal } = f;
  // Dim standby: slow noise floor + a bouncing "NO SIGNAL" box.
  const step = Math.floor(t * 6);
  for (let y = 0; y < h; y += 3)
    for (let x = 0; x < w; x += 3) if (hash3(x, y, step) > 0.93) rect(f, x, y, 1, 1, pal.faint);
  const full = tr("NO SIGNAL");
  const label = f.cols >= Math.max(11, full.length) ? full : "NO SIG";
  const lw = label.length * GLYPH_W + 3;
  const lh = 9;
  const rx = Math.max(0, w - lw);
  const ry = Math.max(0, h - lh);
  const bx = rx ? Math.abs(((t * 6) % (2 * rx)) - rx) : 0;
  const by = ry ? Math.abs(((t * 4) % (2 * ry)) - ry) : 0;
  rect(f, bx, by, lw, 1, pal.dim);
  rect(f, bx, by + lh - 1, lw, 1, pal.dim);
  drawText(f.ctx, clip(label, f.cols), Math.round(bx + 2), Math.round(by + 2), pal.fg);
}

function drawBrownout(f: Frame): void {
  const { w, h, t, pal } = f;
  // Sagging supply: the picture collapses and flickers, with a warning.
  const sag = 0.5 + 0.5 * Math.sin(t * 2.3);
  const band = Math.max(2, Math.round(h * (0.25 + 0.5 * sag)));
  const y0 = Math.round((h - band) / 2);
  const step = Math.floor(t * 10);
  for (let y = y0; y < y0 + band; y += 2)
    for (let x = 0; x < w; x += 2) if (hash3(x, y, step) > 0.7) rect(f, x, y, 2, 1, pal.dim);
  if (blink(t, 2.5, 0.6)) {
    const full = tr("BROWNOUT");
    const label = f.cols >= Math.max(14, full.length + 1) ? full : "LOW V";
    const x = Math.max(1, Math.round((w - label.length * GLYPH_W) / 2));
    drawText(f.ctx, clip(label, f.cols), x, Math.round(h / 2) - 2, RED);
  }
  if (hash3(step, 77) > 0.8) rect(f, 0, 0, w, h, "rgb(0,0,0)");
}

/** Phosphor colour of a spec (spec.color, else the content default; the MCP face is red). */
export function screenColor(spec: ScreenSpec, deviceId?: string): string {
  if (spec.color) return spec.color;
  if (spec.content === "face" && deviceId === "MCP-000") return "#FF3333";
  return SCREEN_COLOR[spec.content];
}

/** A dark, unpowered screen with a faint glass reflection. */
export function drawDarkScreen(ctx: ScreenCtx, w: number, h: number): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgb(4,5,6)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgb(16,19,22)";
  const band = Math.max(2, Math.round(w * 0.08));
  for (let y = 0; y < h; y++) {
    const x = Math.round(w * 0.55 - y * 0.8);
    if (x + band < 0 || x > w) continue;
    ctx.fillRect(Math.max(0, x), y, band, 1);
  }
  ctx.fillStyle = "rgb(10,12,14)";
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, h - 1, w, 1);
}

/**
 * Render one frame of `spec` into a w×h context at time `t` (seconds).
 * Unpowered screens with `spec.requiresPower` show `screenLook`'s state
 * (dark glass, NO SIGNAL, brownout); `bootAge` (seconds since the screen
 * powered on) plays the boot splash for the first `BOOT_SECONDS`.
 */
export function drawScreen(
  ctx: ScreenCtx,
  w: number,
  h: number,
  spec: ScreenSpec,
  info: ScreenInfo,
  t: number,
  powered = true,
  bootAge = Number.POSITIVE_INFINITY,
): void {
  const look = screenLook(spec, info, powered);
  if (look === "dark") {
    drawDarkScreen(ctx, w, h);
    return;
  }
  const pal = palette(look === "brownout" ? "#FF5040" : screenColor(spec, info.deviceId));
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, w, h);
  const f: Frame = {
    ctx,
    w,
    h,
    t,
    pal,
    info,
    spec,
    cols: Math.max(1, Math.floor((w - 3) / GLYPH_W)),
    rows: Math.max(1, Math.floor((h - 3) / GLYPH_H)),
  };
  if (look === "nosignal") drawNoSignal(f);
  else if (look === "brownout") drawBrownout(f);
  else if (bootAge >= 0 && bootAge < BOOT_SECONDS) drawBootSplash(f, bootAge);
  else {
    RENDERERS[spec.content](f);
    drawCaption(f);
  }
  // Scanlines + a slow rolling brightness band (not on paper: live pinboards).
  if (spec.content !== "notes") {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "rgb(0,0,0)";
    for (let y = 1; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = pal.hot;
    const roll = Math.floor((t * 9) % (h + 10)) - 5;
    ctx.fillRect(0, roll, w, 4);
  }
  // Edge vignette.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, w, 1);
  ctx.fillRect(0, h - 1, w, 1);
  ctx.fillRect(0, 0, 1, h);
  ctx.fillRect(w - 1, 0, 1, h);
  ctx.globalAlpha = 1;
}

/** Canvas resolution for a screen of `worldW`×`worldH` world units (≈ 16 px per unit). */
export function screenResolution(worldW: number, worldH: number): { w: number; h: number } {
  const round8 = (v: number) => Math.max(8, Math.round(v / 8) * 8);
  const aspect = worldW / Math.max(0.01, worldH);
  let h = Math.min(96, Math.max(24, round8(worldH * 16)));
  let w = round8(h * aspect);
  if (w > 160) {
    w = 160;
    h = Math.max(16, round8(w / aspect));
  }
  if (w < 32) {
    w = 32;
    h = Math.min(120, round8(w / aspect));
  }
  return { w, h };
}

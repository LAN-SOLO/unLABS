/**
 * terminal-lite — the mini _unOS shell of the room terminals (pure).
 * ===================================================================
 *
 * `runCommand(state, input, ctx)` never mutates the state: it returns the
 * output lines plus optional `effects` (clear the screen, close, open the
 * big terminal, set harmless `terminal_*` flags, and game `actions`). The
 * UI applies them inside the world's `act` via `applyTerminalEffects`,
 * which routes every action through the same game functions the rest of
 * the world uses (`toggleDevice` like the device panel, `applySignal` like
 * the main console) and returns the resulting lines.
 *
 * Output is plain text with _unOS flavour, English source strings through
 * `tr()` (German via lib/i18n/de/bridge.ts); lines starting with
 * `MCP>` are the MCP speaking, `[EXTERNAL]` the voice from the halo, `!`
 * warnings (the UI colours them).
 *
 * Command names are English; the original German names stay as aliases
 * (`hilfe`, `schalte`, `post`, `dateien`, …) so both work in either language.
 *
 * Each terminal (content/terminals.ts) has a role, a purpose, optional
 * capabilities (`power`: `switch`, `signal`: `signal <code>`), a mail
 * archive (`mail`) and files (`files`, `cat`, `unlock <file> <code>`
 * with codes the player learns from notes).
 */
import { intlLocale, tr } from "@/lib/i18n";
import { volatilityPercent } from "@/lib/game/volatility";
import { SIGNAL_STATUS_LABEL, applySignal, mcpAnswer } from "@/lib/world/bridge";
import { DEVICES, DEVICE_BY_ID, DEVICE_PUZZLES } from "@/lib/world/content/devices";
import { SLICE_TOTAL } from "@/lib/world/content/items";
import {
  DOORS,
  FLOOR_BY_ID,
  FLOORS_TOP_DOWN,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
  roomAt,
  inRoomShape,
} from "@/lib/world/content/map";
import { PUZZLES, PUZZLE_BY_ID } from "@/lib/world/content/puzzles";
import { ENDINGS, INSIGHTS, NPC_SPEAKERS, BOT_QUESTS } from "@/lib/world/content/story";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_BY_ID,
  type RoomTerminalDef,
  type TerminalCap,
  type TerminalFile,
  type TerminalMail,
} from "@/lib/world/content/terminals";
import {
  UEC_NOMINAL,
  deviceReadout,
  describeCond,
  evalCond,
  floorAccessible,
  hint,
  isBuilt,
  isOnline,
  isSwitchedOn,
  itemDef,
  log,
  pickupAvailable,
  pickupVisible,
  power,
  reachableRooms,
  stagesDone,
  todayKey,
  toggleDevice,
  uecOutput,
} from "@/lib/world/game";
import { objectiveSections } from "@/lib/world/quests";
import {
  SPECTRUM,
  type FloorId,
  type RoomDef,
  type SpectrumColor,
  type WorldState,
} from "@/lib/world/types";

/** A state change a command asks for; applied by `applyTerminalEffects`. */
export type TerminalAction =
  | { kind: "toggle"; device: string; on: boolean }
  | { kind: "signal"; code: string };

export interface TerminalEffects {
  clear?: boolean;
  close?: boolean;
  openBigTerminal?: boolean;
  /** Harmless flags to set (only `terminal_*` ones are applied). */
  flags?: string[];
  /** Game actions (device relays, codes) — run through the regular game functions. */
  actions?: TerminalAction[];
}

export interface TerminalResult {
  lines: string[];
  effects?: TerminalEffects;
}

export interface TerminalContext {
  terminalId?: string;
  /** Wall clock for `date` (tests pass a fixed one). */
  now?: Date;
  /** Earlier inputs of this session, oldest first (`history`). */
  history?: readonly string[];
}

interface Cmd {
  name: string;
  aliases?: string[];
  /** One-line help ("" for hidden commands). */
  help: string;
  /** Syntax line for `man`. */
  usage?: string;
  /** Longer description for `man`. */
  man?: readonly string[];
  /** Not listed in `help` / completion. */
  hidden?: boolean;
  /** Only exists once this holds (secret commands). */
  secret?: (s: WorldState) => boolean;
  /** Needs this terminal capability. */
  cap?: TerminalCap;
  run: (s: WorldState, args: string[], ctx: TerminalContext) => TerminalResult;
}

const HR = "────────────────────────────────────────";

function out(...lines: string[]): TerminalResult {
  return { lines };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function padL(s: string, n: number): string {
  return s.length >= n ? s : " ".repeat(n - s.length) + s;
}

function hms(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** ASCII bar of `frac` (0..1) in `width` cells. */
function bar(frac: number, width: number): string {
  const n = Math.max(0, Math.min(width, Math.round(frac * width)));
  return `${"█".repeat(n)}${"░".repeat(width - n)}`;
}

function terminalOf(ctx: TerminalContext): RoomTerminalDef | undefined {
  return ctx.terminalId ? ROOM_TERMINAL_BY_ID.get(ctx.terminalId) : undefined;
}

/** Without a terminal (dev console, tests) every capability is available. */
function hasCap(ctx: TerminalContext, cap: TerminalCap): boolean {
  const term = terminalOf(ctx);
  return !ctx.terminalId || !!term?.caps?.includes(cap);
}

/** The room the shell runs in: the terminal's room, else where Jade stands. */
function hereRoom(s: WorldState, ctx: TerminalContext): { floor: FloorId; room?: RoomDef } {
  const term = terminalOf(ctx);
  if (term) return { floor: term.floor, room: ROOMS.find((r) => r.id === term.room) };
  return { floor: s.floor, room: roomAt(s.floor, s.pos[0], s.pos[2]) };
}

function inRoom(r: RoomDef, floor: FloorId, x: number, z: number): boolean {
  return floor === r.floor && inRoomShape(r, x, z);
}

function deviceFloor(id: string): FloorId | undefined {
  const d = DEVICE_BY_ID.get(id);
  return d ? ROOMS.find((r) => r.id === d.room)?.floor : undefined;
}

/** Floor label without its letter: "E−1" / "L−1" → "-1". */
function floorKey(label: string): string {
  return label.toLowerCase().replace("−", "-").replace(/^[el]/, "");
}

function floorArg(arg: string | undefined, fallback: FloorId): FloorId | "all" | null {
  if (!arg) return fallback;
  const a = floorKey(arg);
  if (a === "alle" || a === "all" || a === "*") return "all";
  const hit = FLOORS_TOP_DOWN.find((f) => floorKey(f.short) === a || String(f.id) === a);
  return hit ? hit.id : null;
}

/** Devices the player knows about (blueprint discovered or started). */
function knownDevice(s: WorldState, id: string): boolean {
  return !!s.discovered[id] || stagesDone(s, id) > 0;
}

/** Resolve a typed device id ("cdc-001", "cdc001", "CDC-001"). */
function deviceArg(arg: string | undefined): string | undefined {
  if (!arg) return undefined;
  const norm = arg.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return DEVICES.find((d) => d.id.replace(/[^A-Z0-9]/g, "") === norm)?.id;
}

/** Normalise a typed code: upper case, separators removed ("03:41" → "0341"). */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[\s\-–—.,:;·_/]+/g, "");
}

/** Accepted translations of word codes (the German original always works too). */
const CODE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  ZWEIMAL: ["TWICE"],
};

/** Whether a typed code opens a file whose code is `code` (normalised compare + aliases). */
export function codeMatches(typed: string, code: string): boolean {
  const t = normalizeCode(typed);
  const c = normalizeCode(code);
  return t === c || (CODE_ALIASES[c] ?? []).includes(t);
}

// ── Mail & files ────────────────────────────────────────────────

/** Flag set when a mail has been read. */
export function mailReadFlag(mailId: string): string {
  return `terminal_mail_${mailId}`;
}

/** Flag set when a locked file has been opened with its code. */
export function fileUnlockFlag(fileId: string): string {
  return `terminal_file_${fileId}`;
}

function visibleMail(s: WorldState, term: RoomTerminalDef | undefined): TerminalMail[] {
  return (term?.mail ?? []).filter((m) => evalCond(s, m.requires));
}

function visibleFiles(s: WorldState, term: RoomTerminalDef | undefined): TerminalFile[] {
  return (term?.files ?? []).filter((f) => evalCond(s, f.requires));
}

function fileLocked(s: WorldState, f: TerminalFile): boolean {
  return !!f.code && !s.flags[fileUnlockFlag(f.id)];
}

/** Unread mails of a terminal (for the banner and the in-world screen). */
export function unreadMail(s: WorldState, terminalId: string): number {
  const term = ROOM_TERMINAL_BY_ID.get(terminalId);
  return visibleMail(s, term).filter((m) => !s.flags[mailReadFlag(m.id)]).length;
}

// ── Commands ─────────────────────────────────────────────────────

function available(c: Cmd, s: WorldState, ctx: TerminalContext): boolean {
  if (c.secret && !c.secret(s)) return false;
  if (c.cap && !hasCap(ctx, c.cap)) return false;
  return true;
}

function cmdHelp(s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const term = terminalOf(ctx);
  const lines = [tr("_unOS lite · available commands"), HR];
  if (term) lines.push(term.purpose, "");
  for (const c of COMMANDS) {
    if (c.hidden || !available(c, s, ctx)) continue;
    lines.push(`  ${pad(c.name, 11)} ${c.help}`);
  }
  lines.push(HR, tr("man <command> explains more · Tab completes · ↑/↓ history · Esc closes"));
  return { lines };
}

function cmdMan(s: WorldState, args: string[], ctx: TerminalContext): TerminalResult {
  const name = args[0]?.toLowerCase();
  if (!name) return out(tr("man: Which manual page? Example: man switch"));
  const c = BY_NAME.get(name);
  if (!c || c.hidden || !available(c, s, ctx)) {
    return out(
      tr("No manual entry for “{name}”.", { name }),
      tr("Some things you just have to try."),
    );
  }
  const lines = [
    `${c.name.toUpperCase()}(1)           _unOS lite           ${c.name.toUpperCase()}(1)`,
    "",
  ];
  lines.push(tr("NAME"), `    ${c.name} — ${c.help}`, "", tr("SYNTAX"), `    ${c.usage ?? c.name}`);
  if (c.aliases?.length) lines.push("", tr("ALIASES"), `    ${c.aliases.join(", ")}`);
  if (c.man?.length) lines.push("", tr("DESCRIPTION"), ...c.man.map((l) => `    ${l}`));
  if (c.cap) {
    const where = ROOM_TERMINALS.filter((t) => t.caps?.includes(c.cap!)).map((t) => t.label);
    lines.push("", tr("AVAILABLE AT"), ...where.map((w) => `    ${w}`));
  }
  return { lines };
}

function cmdStatus(s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const p = power(s);
  const { floor, room } = hereRoom(s, ctx);
  const built = DEVICES.filter((d) => isBuilt(s, d.id)).length;
  const insights = INSIGHTS.filter((i) => s.insights[i.id]).length;
  const bots = BOT_QUESTS.filter((q) => s.flags[q.flag]).length;
  const endings = ENDINGS.filter((e) => s.endings[e.id]).length;
  const visibleEndings = ENDINGS.filter((e) => !e.secret || s.endings[e.id]).length;
  const solved = PUZZLES.filter((z) => s.puzzles[z.id]).length;
  const lines = [
    tr("_unOS · Lab status"),
    HR,
    tr("Location   {floor} · {room}", {
      floor: FLOOR_BY_ID[floor].short,
      room: room?.name ?? tr("Corridor"),
    }),
    tr("Power      {gen} W generated / {load} W load", {
      gen: Math.round(p.generation),
      load: Math.round(p.demand),
    }),
    tr("Devices    {built}/{total} built · {online} online", {
      built,
      total: DEVICES.length,
      online: p.online.size,
    }),
    tr("Insights   {n}/{total}", { n: insights, total: INSIGHTS.length }),
    tr("Puzzles    {n}/{total} solved", { n: solved, total: PUZZLES.length }),
    tr("Slices     {n}/{total}", { n: s.counters.slices ?? 0, total: SLICE_TOTAL }),
    tr("Bots       {n}/{total} awake", { n: bots, total: BOT_QUESTS.length }),
    tr("Endings    {n}/{total}", { n: endings, total: visibleEndings }),
    tr("Runtime    {time}", { time: hms(s.playTime) }),
  ];
  if (p.starved.length)
    lines.push(tr("!! BROWNOUT: {n} device(s) without supply", { n: p.starved.length }));
  return { lines };
}

function cmdEnergie(s: WorldState): TerminalResult {
  const p = power(s);
  const lines = [tr("POWER · Grid overview"), HR, tr("GENERATION")];
  if (!p.sources.length) lines.push(tr("  (none) — residual charge 0.3 %"));
  for (const src of p.sources)
    lines.push(`  ${pad(src.label, 30)} ${padL(`+${Math.round(src.watts)} W`, 8)}`);
  lines.push(tr("CONSUMPTION"));
  const consumers = DEVICES.filter((d) => d.power > 0 && p.online.has(d.id)).sort(
    (a, b) => b.power - a.power || a.id.localeCompare(b.id),
  );
  if (!consumers.length) lines.push(tr("  (none)"));
  for (const d of consumers)
    lines.push(`  ${pad(d.id, 8)} ${pad(d.name, 21)} ${padL(`-${d.power} W`, 8)}`);
  for (const st of p.starved) {
    const d = DEVICE_BY_ID.get(st.id);
    lines.push(
      `! ${pad(st.id, 8)} ${pad(d?.name ?? st.id, 21)} ${st.reason === "hitze" ? tr("OVERHEATED") : tr("NO POWER")}`,
    );
  }
  const off = DEVICES.filter((d) => isBuilt(s, d.id) && !isSwitchedOn(s, d.id));
  for (const d of off) lines.push(`  ${pad(d.id, 8)} ${pad(d.name, 21)}      ${tr("OFF")}`);
  const bal = Math.round(p.generation - p.demand);
  const load = p.generation > 0 ? p.demand / p.generation : 0;
  lines.push(
    HR,
    tr("LOAD    [{bar}] {pct} %", { bar: bar(load, 24), pct: Math.round(load * 100) }),
    bal < 10
      ? tr("BALANCE {bal} W  (tight)", { bal: `${bal >= 0 ? "+" : ""}${bal}` })
      : tr("BALANCE {bal} W", { bal: `${bal >= 0 ? "+" : ""}${bal}` }),
  );
  return { lines };
}

function deviceState(s: WorldState, id: string, online: ReadonlySet<string>): string {
  const d = DEVICE_BY_ID.get(id)!;
  const done = stagesDone(s, id);
  if (done < d.stages.length)
    return done > 0
      ? tr("STAGE {done}/{total}", { done, total: d.stages.length })
      : tr("BLUEPRINT");
  if (online.has(id)) return "ONLINE";
  if (!isSwitchedOn(s, id)) return tr("OFF");
  return "OFFLINE";
}

function cmdDevices(s: WorldState, args: string[], ctx: TerminalContext): TerminalResult {
  const here = hereRoom(s, ctx).floor;
  const sel = floorArg(args[0], here);
  if (sel === null)
    return out(
      tr("devices: unknown level “{arg}”. Example: devices l-1 · devices all", { arg: args[0]! }),
    );
  const p = power(s);
  const floors = sel === "all" ? FLOORS_TOP_DOWN.map((f) => f.id) : [sel];
  const lines = [tr("DEVICES"), HR];
  let unknown = 0;
  for (const f of floors) {
    const list = DEVICES.filter((d) => deviceFloor(d.id) === f);
    const known = list.filter((d) => knownDevice(s, d.id));
    unknown += list.length - known.length;
    if (!known.length && sel === "all") continue;
    lines.push(FLOOR_BY_ID[f].name);
    if (!known.length) lines.push(tr("  (no known blueprints)"));
    for (const d of known)
      lines.push(`  ${pad(d.id, 8)} ${pad(d.name, 24)} ${deviceState(s, d.id, p.online)}`);
  }
  if (unknown) lines.push(HR, tr("+ {n} unknown signature(s).", { n: unknown }));
  return { lines };
}

function cmdRead(s: WorldState, args: string[]): TerminalResult {
  const id = deviceArg(args[0]);
  if (!args[0]) return out(tr("read: device missing. Example: read CLK-001"));
  if (!id || !knownDevice(s, id))
    return out(tr("read: {arg}: no known device on the bus.", { arg: args[0] }));
  const d = DEVICE_BY_ID.get(id)!;
  const p = power(s);
  const state = deviceState(s, id, p.online);
  const lines = [`${d.id} · ${d.name}`, HR, tr("State     {state}", { state })];
  lines.push(
    d.power < 0
      ? tr("Power     +{w} W (source)", { w: -d.power })
      : tr("Power     {w} W", { w: d.power }),
    tr("Stages    {done}/{total}", { done: stagesDone(s, id), total: d.stages.length }),
  );
  const starved = p.starved.find((x) => x.id === id);
  if (starved)
    lines.push(
      starved.reason === "hitze"
        ? tr("! Overheated — THM-001 missing.")
        : tr("! Brownout — not enough power on the grid."),
    );
  if (!p.online.has(id)) {
    lines.push(
      isBuilt(s, id)
        ? tr("No readings — device not online.")
        : tr("Next stage: {name}.", { name: d.stages[stagesDone(s, id)]?.name ?? "?" }),
    );
    return { lines };
  }
  const readout = deviceReadout(s, id);
  lines.push(...(readout.length ? readout : [d.summary]));
  return { lines };
}

function cmdSwitch(s: WorldState, args: string[], ctx: TerminalContext): TerminalResult {
  if (!args[0]) return out(tr("switch: device missing. Example: switch RMG-001 off"));
  const id = deviceArg(args[0]);
  if (!id || !knownDevice(s, id))
    return out(tr("switch: {arg}: no known device on the bus.", { arg: args[0] }));
  const d = DEVICE_BY_ID.get(id)!;
  if (id === "MCP-000")
    return out(
      tr("MCP> No."),
      tr("MCP> Whoever switches me off will have no one left to talk to."),
    );
  if (!isBuilt(s, id)) return out(tr("switch: {id} is not built yet.", { id }));
  const mode = args[1]?.toLowerCase();
  if (mode && !["an", "ein", "on", "aus", "off"].includes(mode))
    return out(tr("switch: I don't understand “{arg}”. on · off", { arg: args[1]! }));
  const now = isSwitchedOn(s, id);
  const want = mode ? ["an", "ein", "on"].includes(mode) : !now;
  if (want === now)
    return out(
      now
        ? tr("{id} is already switched on. No relay moved.", { id })
        : tr("{id} is already switched off. No relay moved.", { id }),
    );
  const term = terminalOf(ctx);
  return {
    lines: [
      `${term ? `${term.label}: ` : ""}${tr("Relay {id} ({name}) → {state}", { id, name: d.name, state: want ? tr("ON") : tr("OFF") })}`,
    ],
    effects: { actions: [{ kind: "toggle", device: id, on: want }] },
  };
}

function cmdPing(s: WorldState, args: string[]): TerminalResult {
  const id = deviceArg(args[0]);
  if (!args[0]) return out(tr("ping: target missing. Example: ping NET-001"));
  if (!id || !knownDevice(s, id))
    return out(tr("ping: {arg}: name or service not known", { arg: args[0] }));
  if (!isOnline(s, id))
    return out(
      tr("PING {id}: 3 packets transmitted, 0 received, 100 % packet loss.", { id }),
      tr("Device not responding."),
    );
  const base = 0.4 + ((id.charCodeAt(0) + id.charCodeAt(2)) % 7) / 10;
  const lines = [`PING ${id} (${DEVICE_BY_ID.get(id)!.name})`];
  for (let i = 0; i < 3; i++)
    lines.push(
      tr("64 bytes from {id}: seq={i} time={ms} ms", {
        id,
        i,
        ms: (base + i * 0.147).toFixed(3),
      }),
    );
  lines.push(tr("3 transmitted, 3 received, 0 % packet loss. The line hums at 847 Hz."));
  return { lines };
}

function cmdTop(s: WorldState): TerminalResult {
  const p = power(s);
  const load = p.generation > 0 ? p.demand / p.generation : 0;
  const lines = [
    tr("top · {n} processes active · {blocked} blocked · load {load}", {
      n: p.online.size,
      blocked: p.starved.length,
      load: load.toFixed(2),
    }),
    HR,
    tr("  PID  STAT  POWER     PROCESS"),
  ];
  const pid = (id: string) => String(100 + DEVICES.findIndex((d) => d.id === id)).padStart(5);
  const running = DEVICES.filter((d) => p.online.has(d.id)).sort((a, b) => b.power - a.power);
  if (!running.length) lines.push(tr("    1  S         0 W  unsystemd (emergency power)"));
  for (const d of running)
    lines.push(
      `${pid(d.id)}  ${d.power < 0 ? "Q" : "R"}     ${padL(`${Math.abs(d.power)} W`, 7)}  ${d.id.toLowerCase()}d`,
    );
  for (const st of p.starved)
    lines.push(
      `${pid(st.id)}  D           —  ${st.id.toLowerCase()}d (${st.reason === "hitze" ? tr("thermal") : tr("waiting for power")})`,
    );
  lines.push(HR, tr("R running · Q source · D blocked"));
  return { lines };
}

function cmdUptime(s: WorldState): TerminalResult {
  const p = power(s);
  const load = p.generation > 0 ? p.demand / p.generation : 0;
  const days = 2561 + Math.floor(s.playTime / 86400);
  return out(
    tr("up {days} days, {time} since cold start · 1 user · load average: {a}, {b}, 0.00", {
      days: days.toLocaleString(intlLocale()),
      time: hms(s.playTime % 86400),
      a: load.toFixed(2),
      b: (load * 0.847).toFixed(2),
    }),
  );
}

function cmdRoom(s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const { floor, room } = hereRoom(s, ctx);
  if (!room)
    return out(tr("{floor} · Corridor. Nothing to report.", { floor: FLOOR_BY_ID[floor].name }));
  const p = power(s);
  const lines = [`${room.name} · ${FLOOR_BY_ID[floor].short}`, HR, room.blurb];
  const devs = DEVICES.filter((d) => d.room === room.id && knownDevice(s, d.id));
  if (devs.length) {
    lines.push("", tr("Devices:"));
    for (const d of devs)
      lines.push(`  ${pad(d.id, 8)} ${pad(d.name, 24)} ${deviceState(s, d.id, p.online)}`);
  }
  const pickups = PICKUPS.filter((pk) => inRoom(room, pk.floor, pk.x, pk.z));
  const open = pickups.filter((pk) => pickupAvailable(s, pk)).length;
  const notes = NOTES.filter((n) => inRoom(room, n.floor, n.x, n.z) && evalCond(s, n.hidden));
  const unread = notes.filter((n) => !s.read[n.id]).length;
  lines.push(
    "",
    tr("Salvageable: {open} · Notes: {notes} ({unread} unread)", {
      open,
      notes: notes.length,
      unread,
    }),
  );
  if (room.smoky && !isOnline(s, "VNT-001"))
    lines.push(tr("Visibility: SMOKE — ventilation (VNT-001) offline."));
  if (room.litBy && !isOnline(s, room.litBy))
    lines.push(tr("Light: OFF — needs {id}.", { id: room.litBy }));
  return { lines };
}

const MAP_SX = 3;
const MAP_SZ = 6;

function cmdMap(s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const { floor, room: here } = hereRoom(s, ctx);
  if (!floorAccessible(s, floor) && floor !== s.floor) return out(tr("map: level not reachable."));
  const reach = reachableRooms(s, floor);
  const rooms = ROOMS.filter((r) => r.floor === floor && (reach.has(r.id) || r.id === here?.id));
  if (!rooms.length) return out(tr("map: no map data."));
  const x0 = Math.min(...rooms.map((r) => r.x));
  const z0 = Math.min(...rooms.map((r) => r.z));
  const x1 = Math.max(...rooms.map((r) => r.x + r.w));
  const z1 = Math.max(...rooms.map((r) => r.z + r.d));
  const cols = Math.floor((x1 - x0) / MAP_SX) + 1;
  const rows = Math.floor((z1 - z0) / MAP_SZ) + 1;
  const g: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "));
  const cx = (x: number) => Math.min(cols - 1, Math.max(0, Math.round((x - x0) / MAP_SX)));
  const cz = (z: number) => Math.min(rows - 1, Math.max(0, Math.round((z - z0) / MAP_SZ)));
  const legend: string[] = [];
  rooms.forEach((r, i) => {
    const a = cx(r.x);
    const b = cx(r.x + r.w);
    const c = cz(r.z);
    const d = cz(r.z + r.d);
    for (let x = a; x <= b; x++) {
      g[c]![x] = g[c]![x] === " " || g[c]![x] === "-" ? "-" : "+";
      g[d]![x] = g[d]![x] === " " || g[d]![x] === "-" ? "-" : "+";
    }
    for (let z = c; z <= d; z++) {
      g[z]![a] = g[z]![a] === " " || g[z]![a] === "|" ? "|" : "+";
      g[z]![b] = g[z]![b] === " " || g[z]![b] === "|" ? "|" : "+";
    }
    for (const [px, pz] of [
      [a, c],
      [b, c],
      [a, d],
      [b, d],
    ] as const)
      g[pz]![px] = "+";
    const key = String.fromCharCode(65 + (i % 26));
    const mx = cx(r.x + r.w / 2);
    const mz = cz(r.z + r.d / 2);
    if (mz > c && mz < d && mx > a && mx < b) g[mz]![mx] = key;
    legend.push(`${key} ${r.name}${r.id === here?.id ? tr("  ◄ here") : ""}`);
  });
  if (s.floor === floor) {
    const px = cx(s.pos[0]);
    const pz = cz(s.pos[2]);
    g[pz]![px] = "@";
  }
  const term = terminalOf(ctx);
  if (term && term.floor === floor) {
    const tx = cx(term.x);
    const tz = cz(term.z);
    if (g[tz]![tx] !== "@") g[tz]![tx] = "T";
  }
  const lines = [
    tr("MAP · {floor}", { floor: FLOOR_BY_ID[floor].name }),
    HR,
    ...g.map((r) => r.join("").replace(/\s+$/, "")),
  ];
  lines.push(HR, ...legend, tr("@ Jade · T this terminal"));
  return { lines };
}

function cmdJournal(s: WorldState): TerminalResult {
  const got = INSIGHTS.filter((i) => s.insights[i.id]).sort(
    (a, b) => (s.insights[b.id] ?? 0) - (s.insights[a.id] ?? 0),
  );
  if (!got.length) return out(tr("journal: empty. Listen before you build."));
  const lines = [
    tr("JOURNAL · {n}/{total} insights (newest first)", { n: got.length, total: INSIGHTS.length }),
    HR,
  ];
  for (const i of got.slice(0, 8)) {
    lines.push(`• ${i.title}`);
    lines.push(`  ${i.text.length > 110 ? `${i.text.slice(0, 107)}…` : i.text}`);
  }
  if (got.length > 8) lines.push(tr("… and {n} more in the journal.", { n: got.length - 8 }));
  return { lines };
}

function cmdObjectives(s: WorldState): TerminalResult {
  const secs = objectiveSections(s);
  if (!secs.length) return out(tr("OBJECTIVES: none. The lab still isn't finished."));
  const lines = [tr("OBJECTIVES"), HR];
  for (const sec of secs) {
    lines.push(`[${sec.title.toUpperCase()}]`);
    for (const o of sec.items.slice(0, 4)) {
      lines.push(`  > ${o.text}`);
      if (o.detail) lines.push(`    ${o.detail}`);
    }
    if (sec.items.length > 4) lines.push(tr("    (+{n} more)", { n: sec.items.length - 4 }));
  }
  return { lines };
}

function cmdLog(s: WorldState, args: string[]): TerminalResult {
  const n = Math.min(40, Math.max(1, Number.parseInt(args[0] ?? "12", 10) || 12));
  const tail = s.log.slice(-n);
  if (!tail.length) return out(tr("log: empty."));
  return { lines: [tr("/unvar/log/lab"), HR, ...tail.map((l) => `[${hms(l.t)}] ${l.text}`)] };
}

function cmdScan(s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  if (!isOnline(s, "MSC-001"))
    return out(
      tr("scan: No scanner on the bus."),
      tr("The Material Scanner (MSC-001) must be online."),
    );
  const { room } = hereRoom(s, ctx);
  if (!room) return out(tr("scan: No room in range."));
  const hidden = PICKUPS.filter((p) => p.hidden && inRoom(room, p.floor, p.x, p.z));
  const lines = [tr("MSC-001 · Spectral scan {room}", { room: room.name }), HR];
  const found = hidden.filter((p) => pickupVisible(s, p) && pickupAvailable(s, p));
  const veiled = hidden.filter((p) => !pickupVisible(s, p));
  for (const p of found) lines.push(`  ◆ ${pad(p.label, 30)} @ ${p.x},${p.z}`);
  for (const p of veiled)
    lines.push(
      tr("  ? Signature below noise @ ~{x},{z}", {
        x: Math.round(p.x / 4) * 4,
        z: Math.round(p.z / 4) * 4,
      }),
      tr("    needs: {cond}", { cond: describeCond(p.hidden!) }),
    );
  const secrets = NOTES.filter(
    (n) => n.hidden && inRoom(room, n.floor, n.x, n.z) && evalCond(s, n.hidden) && !s.read[n.id],
  );
  for (const n of secrets) lines.push(tr("  ✎ Hidden note: {title}", { title: n.title }));
  if (lines.length === 2) lines.push(tr("  No hidden signatures."));
  return { lines };
}

/** Wavelength names for the crystal listing (ids stay German). */
const SPECTRUM_LABEL: Readonly<Record<SpectrumColor, string>> = {
  infrarot: tr("Infrared"),
  rot: tr("Red"),
  orange: tr("Orange"),
  gelb: tr("Yellow"),
  gruen: tr("Green"),
  blau: tr("Blue"),
  indigo: tr("Indigo"),
  violett: tr("Violet"),
  gamma: tr("Gamma"),
};

function cmdCrystal(s: WorldState): TerminalResult {
  const slices = Math.min(s.counters.slices ?? 0, SLICE_TOTAL);
  const day = todayKey();
  const vol = volatilityPercent(day);
  const raw = uecOutput(day);
  const lines = [
    tr("CRYSTAL #0089 · Spectral inventory"),
    HR,
    `Slices     [${bar(slices / SLICE_TOTAL, 30)}] ${slices}/${SLICE_TOTAL}`,
    tr("Volatil.   {vol} % today ({day})", { vol: `${vol >= 0 ? "+" : ""}${vol}`, day }),
    isOnline(s, "VLT-001") && raw < UEC_NOMINAL
      ? tr("UEC core   {raw} W raw · nominal {nom} W · VLT-001 stabilising", {
          raw,
          nom: UEC_NOMINAL,
        })
      : tr("UEC core   {raw} W raw · nominal {nom} W", { raw, nom: UEC_NOMINAL }),
    "",
    tr("Inventory by wavelength:"),
  ];
  const counts = new Map<string, number>();
  for (const [id, n] of Object.entries(s.inventory)) {
    const def = itemDef(s, id);
    if (def && n > 0) counts.set(def.color, (counts.get(def.color) ?? 0) + n);
  }
  const max = Math.max(1, ...counts.values());
  for (const c of SPECTRUM) {
    const n = counts.get(c) ?? 0;
    lines.push(`  ${pad(SPECTRUM_LABEL[c].toLowerCase(), 9)} ${bar(n / max, 16)} ${n}`);
  }
  if (slices >= SLICE_TOTAL)
    lines.push("", tr("Thirty facets. The Crystal Data Cache is waiting."));
  return { lines };
}

function cmdPuzzles(s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const { floor } = hereRoom(s, ctx);
  const ids = new Set<string>();
  for (const d of DEVICES) {
    if (deviceFloor(d.id) !== floor || !knownDevice(s, d.id)) continue;
    for (const p of DEVICE_PUZZLES[d.id] ?? []) ids.add(p.puzzle);
    for (const st of d.stages) if (st.puzzle) ids.add(st.puzzle);
  }
  for (const p of PROPS) if (p.floor === floor && p.puzzle) ids.add(p.puzzle);
  for (const d of DOORS) if (d.floor === floor && d.keypad && !d.secret) ids.add(d.keypad);
  const total = PUZZLES.filter((z) => s.puzzles[z.id]).length;
  const lines = [tr("PUZZLES · {floor}", { floor: FLOOR_BY_ID[floor].name }), HR];
  const list = [...ids].map((id) => PUZZLE_BY_ID.get(id)).filter((p) => !!p);
  if (!list.length) lines.push(tr("  Nothing known is open on this level."));
  for (const p of list) lines.push(`  ${s.puzzles[p.id] ? "✓" : "○"} ${p.title}`);
  lines.push(HR, tr("Solved lab-wide: {n}/{total}", { n: total, total: PUZZLES.length }));
  return { lines };
}

// ── Mail & files ─────────────────────────────────────────────────

function cmdMail(s: WorldState, args: string[], ctx: TerminalContext): TerminalResult {
  const term = terminalOf(ctx);
  const mails = visibleMail(s, term);
  if (!term) return out(tr("mail: no mailbox on this console."));
  if (!mails.length) return out(tr("mail: mailbox {label}: empty.", { label: term.label }));
  const arg = args[0];
  if (!arg) {
    const lines = [tr("MAIL · {label}", { label: term.label }), HR];
    mails.forEach((m, i) => {
      const unread = !s.flags[mailReadFlag(m.id)];
      lines.push(
        `${unread ? "N" : " "} ${padL(String(i + 1), 2)}  ${pad(m.from, 12)} ${pad(m.date, 17)} ${m.subject}`,
      );
    });
    lines.push(HR, tr("mail <no> reads a message · N = unread"));
    return { lines };
  }
  const idx = Number.parseInt(arg, 10);
  const m = Number.isFinite(idx) ? mails[idx - 1] : mails.find((x) => x.id === arg);
  if (!m) return out(tr("mail: message “{arg}” not found.", { arg }));
  const res: TerminalResult = {
    lines: [
      tr("From:    {v}", { v: m.from }),
      tr("To:      {v}", { v: m.to }),
      tr("Date:    {v}", { v: m.date }),
      tr("Subject: {v}", { v: m.subject }),
      HR,
      ...m.body,
    ],
  };
  if (!s.flags[mailReadFlag(m.id)]) res.effects = { flags: [mailReadFlag(m.id)] };
  return res;
}

function readNotes(s: WorldState) {
  return NOTES.filter((n) => s.read[n.id]);
}

function cmdFiles(s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const term = terminalOf(ctx);
  const files = visibleFiles(s, term);
  const notes = readNotes(s);
  const lines = [`/unhome/jade · ${term?.label ?? tr("Console")}`, HR];
  for (const f of files)
    lines.push(`  ${pad(f.id, 22)} ${fileLocked(s, f) ? tr("[locked]") : f.title}`);
  lines.push(`  ${pad(tr("notes/"), 22)} ${tr("{n} note(s) read", { n: notes.length })}`);
  lines.push(HR, tr("cat <file> · unlock <file> <code> · notes"));
  return { lines };
}

function cmdNotes(s: WorldState): TerminalResult {
  const notes = readNotes(s);
  if (!notes.length) return out(tr("/unhome/jade/notes: empty. Notes you read end up here."));
  return {
    lines: [tr("/unhome/jade/notes"), HR, ...notes.map((n) => `  ${pad(n.id, 22)} ${n.title}`)],
  };
}

function cmdCat(s: WorldState, args: string[], ctx: TerminalContext): TerminalResult {
  const id = args[0];
  if (!id) return out(tr("cat: file missing. Example: cat n_wake   (list: files)"));
  const f = visibleFiles(s, terminalOf(ctx)).find((x) => x.id === id);
  if (f) {
    if (fileLocked(s, f))
      return out(
        tr("cat: {id}: locked.", { id }),
        f.codeHint ?? tr("Code required."),
        tr("unlock {id} <code>", { id }),
      );
    return { lines: [`== ${f.title} ==`, HR, ...f.body] };
  }
  const n = NOTES.find((x) => x.id === id.replace(/^(?:notizen|notes)\//, ""));
  if (!n || !s.read[n.id]) return out(tr("cat: {id}: file not found", { id }));
  const who = n.author === "unbekannt" ? tr("unknown") : (NPC_SPEAKERS[n.author]?.name ?? n.author);
  return { lines: [`== ${n.title} ==`, tr("from: {who}", { who }), HR, ...n.body.split("\n")] };
}

function cmdUnlock(s: WorldState, args: string[], ctx: TerminalContext): TerminalResult {
  const [id, ...rest] = args;
  if (!id || !rest.length) return out(tr("unlock: syntax: unlock <file> <code>"));
  const f = visibleFiles(s, terminalOf(ctx)).find((x) => x.id === id);
  if (!f) return out(tr("unlock: {id}: file not found (on this terminal).", { id }));
  if (!f.code) return out(tr("unlock: {id} is not locked.", { id }));
  if (!fileLocked(s, f)) return { lines: [tr("{id}: already unlocked.", { id }), HR, ...f.body] };
  if (!codeMatches(rest.join(""), f.code))
    return out(tr("Access denied. Wrong code."), tr("MCP> Guessing is not a method. Reading is."));
  return {
    lines: [tr("Access granted."), `== ${f.title} ==`, HR, ...f.body],
    effects: { flags: [fileUnlockFlag(f.id)] },
  };
}

function cmdSignal(_s: WorldState, args: string[], ctx: TerminalContext): TerminalResult {
  const code = args.join(" ");
  if (!normalizeCode(code)) return out(tr("signal: code missing. Syntax: signal <code>"));
  const term = terminalOf(ctx);
  return {
    lines: [
      tr("Sending “{code}” via {via} …", {
        code: normalizeCode(code),
        via: term?.label ?? tr("this console"),
      }),
    ],
    effects: { actions: [{ kind: "signal", code }] },
  };
}

// ── MCP & bots ───────────────────────────────────────────────────

const MCP_QUIPS = [
  tr("I am still counting. That is what I do."),
  tr("You type more slowly than Dr. Fridge. That is not a reproach. Just statistics."),
  tr("Load before understanding. That was written somewhere. I did not write it."),
  tr("My memory has gaps. The gaps have shapes."),
  "Keep listening. Keep building. Keep the lab unstable.",
  tr("This terminal is not the big terminal. But it listens too."),
];

function cmdMcp(s: WorldState, args: string[]): TerminalResult {
  if (args.length) {
    if (!isOnline(s, "MCP-000") && power(s).generation <= 0)
      return out(tr("MCP> …Residual charge. Questions later."), `MCP> ${hint(s).split(". ")[0]}.`);
    return {
      lines: mcpAnswer(s, args.join(" ")).map(
        (l) => `MCP> ${l.replace(/\blabor signal <code>/, "signal <code>")}`,
      ),
    };
  }
  const quip = MCP_QUIPS[(s.log.length + Math.floor(s.playTime / 60)) % MCP_QUIPS.length]!;
  if (!isOnline(s, "MCP-000"))
    return out(tr("MCP> …Residual charge. I am saving words."), `MCP> ${hint(s).split(". ")[0]}.`);
  return out(`MCP> ${hint(s)}`, `MCP> ${quip}`);
}

function cmdBots(s: WorldState): TerminalResult {
  const lines = [tr("BNET · Agent status"), HR];
  for (const q of BOT_QUESTS) {
    const name = NPC_SPEAKERS[q.npc]?.name ?? q.npc;
    lines.push(`  ${pad(name, 10)} ${s.flags[q.flag] ? tr("AWAKE") : tr("ASLEEP")}`);
    if (!s.flags[q.flag] && isOnline(s, "NET-001")) lines.push(`    ${q.hint}`);
  }
  const awake = BOT_QUESTS.filter((q) => s.flags[q.flag]).length;
  lines.push(
    HR,
    isOnline(s, "NET-001")
      ? tr("{n}/{total} reactivated.", { n: awake, total: BOT_QUESTS.length })
      : tr("{n}/{total} reactivated. (Details: Network Monitor NET-001 offline)", {
          n: awake,
          total: BOT_QUESTS.length,
        }),
  );
  return { lines };
}

function cmdWhoami(): TerminalResult {
  return out("jade", tr("uid=1000(jade) gid=847(unstable) groups=labor,halo,forge"));
}

function cmdDate(_s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const now = ctx.now ?? new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const real = tr("{m}/{d}/{y} {time}", {
    d: p(now.getDate()),
    m: p(now.getMonth() + 1),
    y: now.getFullYear(),
    time: `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`,
  });
  return out(tr("Thu Feb 14 2019 03:41:22 UTC"), tr("…CLK-001 correcting…"), real);
}

function cmdHistory(_s: WorldState, _a: string[], ctx: TerminalContext): TerminalResult {
  const h = ctx.history ?? [];
  if (!h.length) return out(tr("history: empty."));
  return { lines: h.map((c, i) => `${padL(String(i + 1), 4)}  ${c}`) };
}

function cmdEcho(_s: WorldState, args: string[]): TerminalResult {
  return out(args.join(" "));
}

function cmdUname(): TerminalResult {
  return out("_unOS 2.0 lite · Quantum Kernel 6.1-_unOS · unlab-terminal armv0 · UnstableLabs");
}

function cmd847(): TerminalResult {
  return out(
    "847.",
    tr("847 kW of geothermal. 847 Hz of humming. 847 windings. 847 metres to the boiling rock."),
    tr("MCP> You are starting to see it. That is either good or contagious."),
  );
}

function cmdHalo(s: WorldState): TerminalResult {
  const letters = ["h", "a", "l", "o"].map((c) =>
    s.insights[`halo_${c}`] ? c.toUpperCase() : "_",
  );
  if (s.insights.halo_schluessel)
    return out(
      `[EXTERNAL] ${letters.join(" ")}`,
      tr("[EXTERNAL] Listen. Begin. Output. Without edges."),
      tr("[EXTERNAL] We are not gone. We are just not at the stations."),
    );
  return out(
    `/unvar/halo/capture: ${letters.join(" ")}`,
    tr("Access: partial. Read the margin notes."),
  );
}

function cmdSudo(_s: WorldState, args: string[]): TerminalResult {
  return out(
    tr("[sudo] password for jade: {stars}", {
      stars: "*".repeat(Math.min(8, args.join(" ").length || 4)),
    }),
    tr("MCP> No."),
    tr("MCP> jade is not in the sudoers file. This incident will be reported."),
    tr("MCP> …To whom, I no longer know myself."),
  );
}

function cmdRm(): TerminalResult {
  return out(tr("MCP> I have not deleted anything in 2,561 days. I am not starting now."));
}

function cmdDamien(s: WorldState): TerminalResult {
  const thread = INSIGHTS.filter((i) => i.thread === "damien");
  const known = thread.filter((i) => s.insights[i.id]).length;
  const frac = thread.length ? known / thread.length : 0;
  const endings = ENDINGS.filter((e) => s.endings[e.id]).length;
  const lines = [
    tr("Signal trace D.F.  [{bar}] {pct} %", { bar: bar(frac, 20), pct: Math.round(frac * 100) }),
  ];
  if (endings > 0)
    lines.push(tr("[mem_0x89] You found me. Or I found you. The direction doesn't matter."));
  else if (frac >= 0.6)
    lines.push(tr("[mem_0x89] …Jade? No. But you sound as if you listened to her."));
  else if (frac >= 0.25)
    lines.push(tr("…Noise with structure. Someone is counting in it. Quietly."));
  else lines.push(tr("…Noise. Just noise. (He always said that too.)"));
  return { lines };
}

function cmdListen(s: WorldState): TerminalResult {
  if (s.insights.externe_stimme)
    return out("…", "[EXTERNAL] We are what persists between your measurements.");
  if (s.insights.halo_atmet)
    return out("…", tr("Beneath the fan noise: a breathing. Very slow. 847 Hz."));
  return out("…", "Keep listening.");
}

function cmdXyzzy(): TerminalResult {
  return out(tr("Nothing happens."), tr("MCP> It was like that in 1977 too."));
}

function cmd0341(s: WorldState): TerminalResult {
  return out(
    "03:41:22.",
    s.puzzles.pz_keypad_tresor
      ? tr("MCP> The time at which two people stopped being at their stations.")
      : tr("MCP> A time of day. Somewhere in this lab it is also a key."),
  );
}

function cmdUnstables(): TerminalResult {
  return out(tr("[EXTERNAL] You typed our name."), "[EXTERNAL] We do not fade. We distribute.");
}

function cmdCerulean(): TerminalResult {
  return out("490 nm.", tr("[EXTERNAL] You will see it again. Not with your eyes."));
}

function cmdCoffee(): TerminalResult {
  return out(
    tr("Strike it TWICE on the left with the heel of your hand. Not three times."),
    tr("The machine hums. Tastes of tomorrow."),
  );
}

function cmdMake(_s: WorldState, args: string[]): TerminalResult {
  return out(
    tr("make: *** No rule to make target “{target}”. Stop.", { target: args[0] ?? tr("coffee") }),
  );
}

function cmdR3tr0(): TerminalResult {
  return out(
    tr("R3-TR0> TERMINAL PURITY: COMPROMISED."),
    tr("R3-TR0> Someone has introduced voxels. I formally protest."),
  );
}

function cmdTerminal(s: WorldState): TerminalResult {
  if (power(s).generation < 50)
    return out(tr("unos: Main Console has no power. At least 50 W — Geothermal, Level −1."));
  return {
    lines: [tr("Connecting to the Main Console …"), tr("Handing over the session.")],
    effects: { openBigTerminal: true },
  };
}

export const COMMANDS: readonly Cmd[] = [
  { name: "help", aliases: ["hilfe", "?"], help: tr("this list"), run: cmdHelp },
  {
    name: "man",
    help: tr("manual page of a command"),
    usage: tr("man <command>"),
    man: [tr("Shows the syntax, aliases and description of a command.")],
    run: cmdMan,
  },
  {
    name: "status",
    help: tr("lab status at a glance"),
    man: [tr("Location, power, devices, insights, puzzles, slices, bots and endings.")],
    run: cmdStatus,
  },
  {
    name: "power",
    aliases: ["energie", "strom"],
    help: tr("power grid: generation, consumption, balance"),
    man: [
      tr("Lists every source and consumer on the main grid."),
      tr("Devices without supply are marked “!” (NO POWER or OVERHEATED)."),
    ],
    run: cmdEnergie,
  },
  {
    name: "devices",
    aliases: ["geraete", "geräte", "undev"], // i18n-ignore (German alias)
    help: tr("devices per level  [l0|l-1|…|all]"),
    usage: tr("devices [l+1|l0|l-1|l-2|l-3|l-4|all]"),
    man: [tr("Without an argument: this terminal's level.")],
    run: cmdDevices,
  },
  {
    name: "read",
    aliases: ["ablesen", "readout", "undev-info"],
    help: tr("readings of a device  <ID>"),
    usage: tr("read <DEVICE-ID>"),
    man: [tr("Reads out a device's state, power, build stages and live display.")],
    run: (s, a) => cmdRead(s, a),
  },
  {
    name: "switch",
    aliases: ["schalte", "relais", "relay", "toggle"],
    help: tr("switch a device on/off  <ID> [on|off]"),
    usage: tr("switch <DEVICE-ID> [on|off]"),
    man: [
      tr("Moves the relay of a built device — like the switch in the device panel."),
      tr("Without on/off it toggles. MCP-000 cannot be switched off."),
      tr("Useful in a brownout: shed consumers until the balance is right again."),
    ],
    cap: "power",
    run: cmdSwitch,
  },
  {
    name: "room",
    aliases: ["raum"],
    help: tr("this room: devices, salvage, notes"),
    run: cmdRoom,
  },
  { name: "map", aliases: ["karte"], help: tr("ASCII map of the level"), run: cmdMap },
  { name: "journal", help: tr("latest insights"), run: cmdJournal },
  {
    name: "objectives",
    aliases: ["auftraege", "aufträge", "quests"], // i18n-ignore (German alias)
    help: tr("open objectives"),
    run: cmdObjectives,
  },
  {
    name: "puzzles",
    aliases: ["raetsel", "rätsel"], // i18n-ignore (German alias)
    help: tr("puzzles on this level: solved/open"),
    run: cmdPuzzles,
  },
  {
    name: "log",
    aliases: ["undmesg", "dmesg"],
    help: tr("lab log  [n]"),
    usage: tr("log [count]"),
    man: [tr("The latest lab log entries with runtime stamps (max. 40).")],
    run: cmdLog,
  },
  {
    name: "top",
    aliases: ["ps"],
    help: tr("running device processes"),
    run: (s) => cmdTop(s),
  },
  {
    name: "scan",
    help: tr("hidden signatures in the room (MSC-001)"),
    man: [tr("Needs the Material Scanner (MSC-001) online. Scans this terminal's room.")],
    run: cmdScan,
  },
  {
    name: "crystal",
    aliases: ["kristall", "volatil", "volatility", "spektrum", "spectrum"],
    help: tr("Crystal #0089, volatility, spectrum"),
    man: [
      tr(
        "Slices of Crystal #0089, today's volatility of the UEC core and the inventory by wavelength.",
      ),
    ],
    run: (s) => cmdCrystal(s),
  },
  {
    name: "mail",
    aliases: ["post"],
    help: tr("this terminal's mailbox  [no]"),
    usage: tr("mail [number]"),
    man: [tr("Without a number: list (N = unread). With a number: read the message.")],
    run: cmdMail,
  },
  {
    name: "files",
    aliases: ["dateien", "ls", "dir"],
    help: tr("this terminal's files"),
    run: cmdFiles,
  },
  { name: "notes", aliases: ["notizen"], help: tr("notes you have read"), run: (s) => cmdNotes(s) },
  {
    name: "cat",
    aliases: ["lies", "more"],
    help: tr("show a file or note  <id>"),
    usage: tr("cat <file|note-id>"),
    run: cmdCat,
  },
  {
    name: "unlock",
    aliases: ["entsperren"],
    help: tr("open a locked file  <file> <code>"),
    usage: tr("unlock <file> <code>"),
    man: [
      tr("Some files are locked with a code. The codes are not in here —"),
      tr("they are on scraps of paper, index cards and clocks in the lab."),
    ],
    run: cmdUnlock,
  },
  {
    name: "signal",
    aliases: ["code"],
    help: tr("send a code into the lab network  <code>"),
    usage: "signal <code>",
    man: [
      tr(
        "Sends a code to the lab's devices — the same channel as “labor signal” on the Main Console.",
      ),
      tr("The receiver must be online."),
    ],
    cap: "signal",
    run: cmdSignal,
  },
  {
    name: "mcp",
    help: tr("ask the MCP  [question]"),
    usage: tr("mcp [question]"),
    man: [
      tr(
        "Without a question: the next hint. With a question: power, bots, Damien, Halo, crystal …",
      ),
    ],
    run: (s, a) => cmdMcp(s, a),
  },
  { name: "bots", aliases: ["bnet"], help: tr("status of the lab bots"), run: cmdBots },
  {
    name: "ping",
    help: tr("ping a device  <ID>"),
    usage: tr("ping <DEVICE-ID>"),
    run: (s, a) => cmdPing(s, a),
  },
  { name: "uptime", help: tr("runtime and load"), run: (s) => cmdUptime(s) },
  { name: "whoami", help: tr("who am I"), run: cmdWhoami },
  { name: "date", aliases: ["datum"], help: tr("system time"), run: cmdDate },
  {
    name: "history",
    aliases: ["verlauf"],
    help: tr("commands entered  (!n repeats)"),
    man: [tr("Lists this session's inputs. !! repeats the last one, !n the n-th.")],
    run: cmdHistory,
  },
  {
    name: "terminal",
    aliases: ["unos"],
    help: tr("to the Main Console (full _unOS)"),
    run: cmdTerminal,
  },
  {
    name: "clear",
    aliases: ["cls"],
    help: tr("clear the screen"),
    run: () => ({ lines: [], effects: { clear: true } }),
  },
  {
    name: "exit",
    aliases: ["logout", "quit"],
    help: tr("log out"),
    run: () => ({ lines: [tr("Logged out.")], effects: { close: true } }),
  },
  { name: "echo", help: "", hidden: true, run: cmdEcho },
  { name: "uname", aliases: ["unversion"], help: "", hidden: true, run: cmdUname },
  { name: "847", help: "", hidden: true, run: cmd847 },
  { name: "halo", help: "", hidden: true, run: cmdHalo },
  { name: "sudo", aliases: ["su"], help: "", hidden: true, run: cmdSudo },
  { name: "rm", help: "", hidden: true, run: cmdRm },
  { name: "damien", aliases: ["fridge"], help: "", hidden: true, run: cmdDamien },
  { name: "listen", aliases: ["zuhoeren", "zuhören"], help: "", hidden: true, run: cmdListen }, // i18n-ignore (German alias)
  { name: "xyzzy", help: "", hidden: true, run: cmdXyzzy },
  { name: "0341", aliases: ["03:41"], help: "", hidden: true, run: cmd0341 },
  {
    name: "unstables",
    aliases: ["_unstables"],
    help: "",
    hidden: true,
    secret: (s) => !!s.insights.unstables,
    run: cmdUnstables,
  },
  {
    name: "cerulean",
    help: "",
    hidden: true,
    secret: (s) => !!s.insights.cerulean,
    run: cmdCerulean,
  },
  { name: "coffee", aliases: ["kaffee"], help: "", hidden: true, run: cmdCoffee },
  { name: "make", help: "", hidden: true, run: cmdMake },
  { name: "r3tr0", aliases: ["r3-tr0"], help: "", hidden: true, run: cmdR3tr0 },
];

const BY_NAME = new Map<string, Cmd>();
for (const c of COMMANDS) {
  BY_NAME.set(c.name, c);
  for (const a of c.aliases ?? []) BY_NAME.set(a, c);
}

/** All typeable command names (for completion). */
export const COMMAND_NAMES: readonly string[] = [...BY_NAME.keys()].sort();

/** Flag set the first time a terminal is used. */
export function terminalUsedFlag(terminalId: string): string {
  return `terminal_${terminalId}_used`;
}

/**
 * Expand history references: `!!` = last input, `!n` = n-th input
 * (1-based, as `history` numbers them). Returns null for a bad reference.
 */
export function expandHistory(input: string, history: readonly string[]): string | null {
  const t = input.trim();
  if (t === "!!") return history.at(-1) ?? null;
  const m = /^!(\d+)$/.exec(t);
  if (m) return history[Number(m[1]) - 1] ?? null;
  return input;
}

/** Run one input line. Pure — see `applyTerminalEffects` for the state side. */
export function runCommand(
  s: WorldState,
  input: string,
  ctx: TerminalContext = {},
): TerminalResult {
  const trimmed = input.trim();
  if (!trimmed) return { lines: [] };
  const [head, ...args] = trimmed.split(/\s+/);
  const cmd = BY_NAME.get(head!.toLowerCase());
  let res: TerminalResult;
  if (!cmd || (cmd.secret && !cmd.secret(s))) {
    res = out(tr("{cmd}: command not found. “help” shows what works.", { cmd: head! }));
  } else if (cmd.cap && !hasCap(ctx, cmd.cap)) {
    const where = ROOM_TERMINALS.filter((t) => t.caps?.includes(cmd.cap!)).map((t) => t.label);
    res = out(
      cmd.cap === "power"
        ? tr("{cmd}: This console has no access to the relays.", { cmd: cmd.name })
        : tr("{cmd}: This console has no access to the signal bus.", { cmd: cmd.name }),
      tr("Available at: {where}.", { where: where.join(" · ") }),
    );
  } else {
    res = cmd.run(s, args, ctx);
  }
  if (ctx.terminalId) {
    const flag = terminalUsedFlag(ctx.terminalId);
    if (!s.flags[flag])
      res.effects = { ...res.effects, flags: [...(res.effects?.flags ?? []), flag] };
  }
  return res;
}

/**
 * Apply the state side of a result inside the world's `act`: harmless
 * `terminal_*` flags, device relays (the same `toggleDevice` as the device
 * panel) and codes (the same `applySignal` as the main console). Returns
 * extra output lines describing what happened.
 */
export function applyTerminalEffects(
  s: WorldState,
  fx: TerminalEffects | undefined,
  terminalId?: string,
): string[] {
  for (const f of fx?.flags ?? []) if (f.startsWith("terminal_")) s.flags[f] = true;
  const lines: string[] = [];
  const via = (terminalId && ROOM_TERMINAL_BY_ID.get(terminalId)?.label) || tr("Room terminal");
  for (const a of fx?.actions ?? []) {
    if (a.kind === "toggle") {
      const d = DEVICE_BY_ID.get(a.device);
      if (!d || !isBuilt(s, a.device) || a.device === "MCP-000") {
        lines.push(tr("! Relay {id} does not respond.", { id: a.device }));
        continue;
      }
      if (isSwitchedOn(s, a.device) !== a.on) toggleDevice(s, a.device);
      log(
        s,
        a.on
          ? tr("{via}: {name} switched on.", { via, name: d.name })
          : tr("{via}: {name} switched off.", { via, name: d.name }),
      );
      const p = power(s);
      const st = p.starved.find((x) => x.id === a.device);
      if (a.on && st) {
        lines.push(
          st.reason === "hitze"
            ? tr("! {id} switched on, but overheated (THM-001 missing).", { id: a.device })
            : tr("! {id} switched on, but without power — brownout.", { id: a.device }),
        );
      } else {
        const state = a.on ? (p.online.has(a.device) ? "ONLINE" : tr("ON")) : tr("OFF");
        lines.push(`${a.device} ${state}.`);
      }
      const grid = { gen: Math.round(p.generation), load: Math.round(p.demand) };
      lines.push(
        p.starved.length
          ? tr("Grid: {gen} W / {load} W · ! {n} without supply", { ...grid, n: p.starved.length })
          : tr("Grid: {gen} W / {load} W", grid),
      );
    } else if (a.kind === "signal") {
      const r = applySignal(s, a.code, via);
      const prefix = r.status === "accepted" || r.status === "known" ? "MCP> " : "";
      // RoomTerminal colours the accepted line via tr("[ACCEPTED]"); every other status uses the localized label.
      lines.push(r.status === "accepted" ? tr("[ACCEPTED]") : `[${SIGNAL_STATUS_LABEL[r.status]}]`);
      for (const l of r.lines) lines.push(`${prefix}${l}`);
    }
  }
  return lines;
}

function argPool(s: WorldState, cmd: Cmd, argIndex: number, ctx: TerminalContext): string[] {
  const term = terminalOf(ctx);
  const known = DEVICES.filter((d) => knownDevice(s, d.id)).map((d) => d.id);
  switch (cmd.name) {
    case "cat":
      return [...visibleFiles(s, term).map((f) => f.id), ...readNotes(s).map((n) => n.id)];
    case "unlock":
      return argIndex === 0
        ? visibleFiles(s, term)
            .filter((f) => fileLocked(s, f))
            .map((f) => f.id)
        : [];
    case "devices":
      return ["all", ...FLOORS_TOP_DOWN.map((f) => f.short.toLowerCase().replace("−", "-"))];
    case "man":
      return COMMANDS.filter((c) => !c.hidden && available(c, s, ctx)).map((c) => c.name);
    case "read":
    case "ping":
      return argIndex === 0 ? known : [];
    case "switch":
      return argIndex === 0
        ? DEVICES.filter((d) => isBuilt(s, d.id)).map((d) => d.id)
        : ["on", "off"];
    case "mail":
      return argIndex === 0 ? visibleMail(s, term).map((_m, i) => String(i + 1)) : [];
    default:
      return [];
  }
}

/**
 * Tab completion: returns the completed input (longest common prefix) and
 * the candidates. Completes command names (those this terminal offers),
 * files and note ids, device ids, floors, `man` pages and mail numbers.
 */
export function completeInput(
  s: WorldState,
  input: string,
  ctx: TerminalContext = {},
): { value: string; options: string[] } {
  const parts = input.replace(/^\s+/, "").split(/\s+/);
  let pool: readonly string[];
  let prefix: string;
  let before: string;
  if (parts.length <= 1) {
    pool = COMMAND_NAMES.filter((n) => {
      const c = BY_NAME.get(n);
      return !!c && !c.hidden && available(c, s, ctx);
    });
    prefix = parts[0] ?? "";
    before = "";
  } else {
    const cmd = BY_NAME.get(parts[0]!.toLowerCase());
    prefix = parts[parts.length - 1] ?? "";
    before = `${parts.slice(0, -1).join(" ")} `;
    pool = cmd && available(cmd, s, ctx) ? argPool(s, cmd, parts.length - 2, ctx) : [];
  }
  const low = prefix.toLowerCase();
  const options = pool.filter((n) => n.toLowerCase().startsWith(low));
  if (!options.length) return { value: input, options: [] };
  let common = options[0]!;
  for (const o of options)
    while (!o.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1);
  const done =
    options.length === 1 ? `${options[0]} ` : common.length > prefix.length ? common : prefix;
  return { value: before + done, options };
}

/** Login banner of a terminal. */
export function terminalBanner(s: WorldState, terminalId?: string): string[] {
  const term = terminalId ? ROOM_TERMINAL_BY_ID.get(terminalId) : undefined;
  const lines = [
    "_unOS 2.0 lite · Quantum Kernel 6.1-_unOS",
    `tty${term ? ` ${term.id.replace("term_", "")}` : "0"} · ${term?.label ?? tr("Console")}`,
    HR,
  ];
  if (term?.motd) lines.push(term.motd);
  if (term) lines.push(term.purpose);
  const p = power(s);
  lines.push(
    tr("Grid: {gen} W / {load} W · Insights: {n}", {
      gen: Math.round(p.generation),
      load: Math.round(p.demand),
      n: INSIGHTS.filter((i) => s.insights[i.id]).length,
    }),
  );
  if (p.starved.length)
    lines.push(tr("! BROWNOUT: {n} device(s) without supply.", { n: p.starved.length }));
  if (terminalId && term) {
    const unread = unreadMail(s, terminalId);
    if (unread) lines.push(tr("Mail: {n} unread message(s) — “mail”.", { n: unread }));
    const locked = visibleFiles(s, term).filter((f) => fileLocked(s, f)).length;
    if (locked) lines.push(tr("Files: {n} locked — “files”.", { n: locked }));
    const caps: string[] = [];
    if (term.caps?.includes("power")) caps.push(tr("Relays (switch)"));
    if (term.caps?.includes("signal")) caps.push(tr("Signal bus (signal)"));
    if (caps.length) lines.push(tr("Access: {caps}", { caps: caps.join(" · ") }));
  }
  if (terminalId && !s.flags[terminalUsedFlag(terminalId)])
    lines.push(tr("First login on this terminal. “help” lists the commands."));
  else lines.push(tr("“help” lists the commands."));
  return lines;
}

/** Whether the terminal can be used right now. */
export function terminalUsable(s: WorldState, terminalId: string): boolean {
  const t = ROOM_TERMINAL_BY_ID.get(terminalId);
  return !!t && evalCond(s, t.requires);
}

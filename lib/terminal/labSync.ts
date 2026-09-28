/**
 * Terminal ↔ Lab World device & quest sync.
 * ==========================================
 *
 * Model: the lab world (`/world`, active save slot) is the source of truth
 * for which devices physically exist, are switched on and are powered. The
 * big terminal is the software layer on top of that hardware:
 *
 *   - Device commands (`cdc`, `uec`, … and `power on <ID>` / `device power
 *     <ID> on`) answer in-fiction when the device is missing in the lab
 *     ("DEVICE NOT DETECTED") or has no power ("OFFLINE"). Help/info always
 *     work; switched-off devices can still be switched on from here.
 *   - A successful terminal power switch is written back to the world save
 *     (the same `toggleDevice` the world's device panel uses).
 *   - World progress completes matching terminal quest steps (flag
 *     correspondences in `WORLD_QUEST_FLAGS`).
 *   - Without a world save (guests, fresh accounts) everything falls back to
 *     the terminal's own behaviour — nothing is gated, nothing soft-locks.
 *
 * The decision logic here is pure (plain snapshot in, decision out). The
 * world code (`lib/world/bridge.ts`) is only imported lazily by the facade,
 * so the terminal bundle stays lean and nothing runs on the server.
 */

import type { DevicePowerReport, LabDeviceInfo, LabDeviceSnapshot } from "@/lib/world/bridge";
import type { CommandResult } from "@/lib/terminal/types";

export type { DevicePowerReport, LabDeviceInfo, LabDeviceSnapshot };

// ── Device id mapping ────────────────────────────────────────────

/**
 * Terminal device command (canonical name, aliases resolve to it) → lab
 * device id. Ids are identical on both sides except where the terminal
 * shortens them (`ipl` → INT-001, `qua` → QAN-001).
 */
export const DEVICE_COMMAND_IDS: Readonly<Record<string, string>> = {
  aic: "AIC-001",
  and: "AND-001",
  bat: "BAT-001",
  btk: "BTK-001",
  cdc: "CDC-001",
  clk: "CLK-001",
  cpu: "CPU-001",
  dgn: "DGN-001",
  dim: "DIM-001",
  ecr: "ECR-001",
  emc: "EMC-001",
  exd: "EXD-001",
  hms: "HMS-001",
  ipl: "INT-001",
  lct: "LCT-001",
  mem: "MEM-001",
  mfr: "MFR-001",
  msc: "MSC-001",
  net: "NET-001",
  p3d: "P3D-001",
  pwb: "PWB-001",
  qcp: "QCP-001",
  qsm: "QSM-001",
  qua: "QAN-001",
  rmg: "RMG-001",
  sca: "SCA-001",
  spk: "SPK-001",
  tlp: "TLP-001",
  tmp: "TMP-001",
  uec: "UEC-001",
  vnt: "VNT-001",
};

/** Terminal spellings that differ from the lab's device ids. */
const ID_ALIASES: Readonly<Record<string, string>> = {
  "QUA-001": "QAN-001",
  "IPL-001": "INT-001",
  "NXS-001": "NXS-01",
};

/**
 * Resolve a typed device id ("bat-001", "BAT", "qua-001") against the lab's
 * device ids. Null if it names no lab device.
 */
export function resolveLabDeviceId(raw: string, knownIds: readonly string[]): string | null {
  const up = raw.trim().toUpperCase();
  if (!up) return null;
  const id = ID_ALIASES[up] ?? up;
  if (knownIds.includes(id)) return id;
  const byPrefix = knownIds.find((k) => k.startsWith(`${id}-`));
  if (byPrefix) return byPrefix;
  const aliased = Object.entries(ID_ALIASES).find(([k]) => k.startsWith(`${id}-`));
  return aliased && knownIds.includes(aliased[1]) ? aliased[1] : null;
}

// ── Intents ──────────────────────────────────────────────────────

/**
 * What a device command wants to do, physically:
 *  - help          usage / docs (always allowed)
 *  - ui            fold/unfold the panel module (always allowed if built)
 *  - power-status  read the power switch (allowed if built)
 *  - power-on/off  flip the power switch (synced into the world)
 *  - operate       everything else — needs the device online in the lab
 */
export type DeviceIntentKind =
  | "help"
  | "ui"
  | "power-status"
  | "power-on"
  | "power-off"
  | "operate";

export interface DeviceIntent {
  /** Lab device id. */
  device: string;
  kind: DeviceIntentKind;
}

const HELP_WORDS = new Set(["help", "-h", "--help", "info", "man", "docs", "doc", "usage"]);
const UI_WORDS = new Set(["fold", "unfold", "toggle"]);
const POWER_WORDS = new Set(["power", "pwr", "p"]);
const ON_WORDS = new Set(["on", "boot", "start"]);
const OFF_WORDS = new Set(["off", "shutdown", "stop", "standby"]);

function powerKind(word: string | undefined): DeviceIntentKind {
  const w = word?.toLowerCase();
  if (w && ON_WORDS.has(w)) return "power-on";
  if (w && OFF_WORDS.has(w)) return "power-off";
  return "power-status";
}

/**
 * A device intent before its target id is checked against the lab: either
 * the lab id (device commands) or the raw id the player typed.
 */
export type ParsedDeviceIntent =
  | { device: string; kind: DeviceIntentKind }
  | { raw: string; kind: DeviceIntentKind };

/**
 * Parse a command invocation without knowing the lab's devices (pure and
 * cheap — no snapshot needed). Null for commands that touch no single lab
 * device (bulk `device power all on`, `power status`, …).
 */
export function parseDeviceIntent(
  commandName: string,
  args: readonly string[],
): ParsedDeviceIntent | null {
  const name = commandName.toLowerCase();
  const device = DEVICE_COMMAND_IDS[name];
  if (device) {
    const sub = args[0]?.toLowerCase();
    if (!sub || HELP_WORDS.has(sub)) return { device, kind: "help" };
    if (UI_WORDS.has(sub)) return { device, kind: "ui" };
    if (POWER_WORDS.has(sub)) return { device, kind: powerKind(args[1]) };
    if (ON_WORDS.has(sub) || sub === "off") return { device, kind: powerKind(sub) };
    return { device, kind: "operate" };
  }
  // `power on <ID>` / `power off <ID>`
  if (name === "power") {
    const sub = args[0]?.toLowerCase();
    if ((sub === "on" || sub === "off") && args[1]) return { raw: args[1], kind: powerKind(sub) };
    return null;
  }
  // `device power <ID> <on|off>` (bulk `all` is left to the unlock gate)
  if (name === "device" && args[0]?.toLowerCase() === "power" && args[1] && args[2]) {
    const target = args[1].toUpperCase();
    if (target === "ALL" || target === "ON" || target === "OFF") return null;
    const kind = powerKind(args[2]);
    if (kind === "power-status") return null;
    return { raw: args[1], kind };
  }
  return null;
}

/** Resolve a parsed intent's typed id against the lab's device ids. */
function bindIntent(p: ParsedDeviceIntent, knownIds: readonly string[]): DeviceIntent | null {
  if ("device" in p) return { device: p.device, kind: p.kind };
  const id = resolveLabDeviceId(p.raw, knownIds);
  return id ? { device: id, kind: p.kind } : null;
}

/**
 * Does this invocation need the lab snapshot at all? False for commands
 * without a device intent and for help/info (always allowed) — the gate
 * then skips reading the world save.
 */
export function needsLabSnapshot(commandName: string, args: readonly string[]): boolean {
  const p = parseDeviceIntent(commandName, args);
  return !!p && p.kind !== "help";
}

/**
 * Map a command invocation to its device intent. `commandName` is the
 * canonical command name (aliases already resolved). Null for commands that
 * touch no single lab device (bulk `device power all on`, `power status`, …).
 */
export function resolveDeviceIntent(
  commandName: string,
  args: readonly string[],
  knownIds: readonly string[],
): DeviceIntent | null {
  const p = parseDeviceIntent(commandName, args);
  return p ? bindIntent(p, knownIds) : null;
}

// ── Guard ────────────────────────────────────────────────────────

export type GuardDecision = { allow: true } | { allow: false; lines: string[] };

const ALLOW: GuardDecision = { allow: true };

function where(info: LabDeviceInfo): string {
  if (info.room && info.floorShort) return `${info.room} (${info.floorShort})`;
  return info.room ?? info.floorShort ?? "the lab";
}

function label(info: LabDeviceInfo): string {
  return `${info.id} (${info.name})`;
}

function watts(n: number): string {
  return `${Math.round(n * 10) / 10} W`;
}

/** In-fiction lines for a device that is missing in the lab. */
export function notDetectedLines(info: LabDeviceInfo): string[] {
  const lines = [
    `[lab] DEVICE NOT DETECTED — ${label(info)}`,
    "      No hardware answers on the lab bus. This console only runs the software.",
  ];
  if (info.presence === "blueprint") {
    lines.push(
      `      Blueprint on file · build stage ${info.stagesDone}/${info.stagesTotal}. Finish it in the lab: ${where(info)}.`,
    );
  } else {
    lines.push("      No blueprint yet. Explore the lab to find it — 'labor geraete'.");
  }
  lines.push("      'labor welt' → back to the lab.");
  return lines;
}

/** In-fiction lines for a built device that is not powered. */
export function offlineLines(info: LabDeviceInfo, snap: LabDeviceSnapshot): string[] {
  if (info.presence === "off") {
    return [
      `[lab] ${info.id} OFFLINE — switched off in the lab.`,
      `      Switch it on: 'device power ${info.id} on' (or at the device: ${where(info)}).`,
    ];
  }
  if (info.presence === "overheated") {
    return [
      `[lab] ${info.id} OFFLINE — thermal lockout.`,
      "      It needs active cooling: bring THM-001 (Thermal Manager) online in the lab.",
    ];
  }
  return [
    `[lab] ${info.id} OFFLINE — no power.`,
    `      Lab grid in brownout: ${watts(snap.generation)} generated · ${watts(snap.demand)} drawn · device needs ${watts(info.watts)}.`,
    "      Build generation or switch consumers off — 'labor energie'.",
  ];
}

/**
 * May this intent run against the lab's hardware? Allows everything without
 * a world save, for commands without a device intent, and for devices the
 * lab doesn't model.
 */
export function guardDeviceIntent(
  snap: LabDeviceSnapshot | null,
  intent: DeviceIntent | null,
): GuardDecision {
  if (!snap || !intent) return ALLOW;
  const info = snap.devices[intent.device];
  if (!info || intent.kind === "help") return ALLOW;
  switch (info.presence) {
    case "unknown":
    case "blueprint":
      return { allow: false, lines: notDetectedLines(info) };
    case "online":
      return ALLOW;
    case "off":
      return intent.kind === "operate" ? { allow: false, lines: offlineLines(info, snap) } : ALLOW;
    case "starved":
    case "overheated":
      return intent.kind === "operate" || intent.kind === "power-on"
        ? { allow: false, lines: offlineLines(info, snap) }
        : ALLOW;
  }
}

/** True if a device is built in the lab (null: no world save → caller decides). */
export function isPresentInLab(snap: LabDeviceSnapshot | null, id: string): boolean | null {
  if (!snap) return null;
  const info = snap.devices[resolveLabDeviceId(id, Object.keys(snap.devices)) ?? id];
  if (!info) return null;
  return info.presence !== "unknown" && info.presence !== "blueprint";
}

// ── Quest correspondences ────────────────────────────────────────

export interface WorldQuestFlag {
  /** Terminal quest flag (must be client-settable, see actions/quest.ts). */
  flag: string;
  /** Lab devices that must all reach `state`. */
  devices: readonly string[];
  state: "built" | "online";
}

/**
 * Lab progress → terminal quest flags. Each flag is one the terminal already
 * uses as a step trigger for exactly this physical fact, so building/powering
 * the device in the lab completes the matching episode step:
 *   EP0 "Wake the basic grid", EP2 "Build NXS-01", EP5 "Build EMC-001" /
 *   "Bring QAN-001 and QSM-001 online", EP6 "Build AIC/SCA/TLP".
 */
export const WORLD_QUEST_FLAGS: readonly WorldQuestFlag[] = [
  { flag: "grid_online", devices: ["BAT-001", "NET-001", "MEM-001"], state: "online" },
  { flag: "nexus_built", devices: ["NXS-01"], state: "built" },
  { flag: "mfr_001_online", devices: ["MFR-001"], state: "online" },
  { flag: "emc_001_online", devices: ["EMC-001"], state: "online" },
  { flag: "qan_001_online", devices: ["QAN-001"], state: "online" },
  { flag: "qsm_001_online", devices: ["QSM-001"], state: "online" },
  { flag: "quantum_pair_online", devices: ["QAN-001", "QSM-001"], state: "online" },
  { flag: "aic_001_online", devices: ["AIC-001"], state: "online" },
  { flag: "sca_001_online", devices: ["SCA-001"], state: "online" },
  { flag: "tlp_001_online", devices: ["TLP-001"], state: "online" },
];

function reached(info: LabDeviceInfo | undefined, state: "built" | "online"): boolean {
  if (!info) return false;
  if (state === "online") return info.presence === "online";
  return info.presence !== "unknown" && info.presence !== "blueprint";
}

/** Terminal quest flags the lab state earns (pure). Empty without a world save. */
export function questFlagsFromWorld(snap: LabDeviceSnapshot | null): string[] {
  if (!snap) return [];
  return WORLD_QUEST_FLAGS.filter((q) =>
    q.devices.every((id) => reached(snap.devices[id], q.state)),
  ).map((q) => q.flag);
}

// ── Facade (DataFetchers.labSync) ────────────────────────────────

export interface LabSyncTerminalActions {
  /** Re-read the active world slot (lazy bridge import). */
  refresh: () => Promise<LabDeviceSnapshot | null>;
  /** Last snapshot read (sync; null without a world save or before the first refresh). */
  snapshot: () => LabDeviceSnapshot | null;
  /** Device built in the lab? Null without a world save / for unmodelled devices. */
  isPresent: (id: string) => boolean | null;
  /**
   * Run before a command: resolves the device intent first (pure), reads
   * the snapshot only for device intents other than help/info (cached for
   * `LAB_SNAPSHOT_TTL_MS`) and returns a blocking result if the lab says
   * no, else null.
   */
  gate: (commandName: string, args: readonly string[]) => Promise<CommandResult | null>;
  /** Run after a command: syncs successful power switches into the world save. */
  afterCommand: (
    commandName: string,
    args: readonly string[],
    result: CommandResult,
  ) => Promise<CommandResult>;
  /** Terminal quest flags earned in the lab (from the last snapshot). */
  questFlags: () => string[];
}

const loadBridge = () => import("@/lib/world/bridge");

/**
 * How long a snapshot read for the gate stays valid. A burst of device
 * commands (scripts, `!!`, tab-completed retries) reads the world save
 * once; writes through `afterCommand` refresh it right away, and
 * `invalidateLabSnapshot()` drops it (e.g. when the world tab changed it).
 */
export const LAB_SNAPSHOT_TTL_MS = 1500;

let cached: LabDeviceSnapshot | null = null;
/** `Date.now()` of the last read, or null when the cache is invalid. */
let cachedAt: number | null = null;

/** Drop the gate's cached snapshot (the next device command re-reads the save). */
export function invalidateLabSnapshot(): void {
  cachedAt = null;
}

/** Snapshot for the gate: the cached one while fresh, else a new read. */
async function freshSnapshot(): Promise<LabDeviceSnapshot | null> {
  if (cachedAt !== null && Date.now() - cachedAt < LAB_SNAPSHOT_TTL_MS) return cached;
  return labSyncActions.refresh();
}

/** Stable singleton — safe to put into a memoised `DataFetchers` object. */
export const labSyncActions: LabSyncTerminalActions = {
  refresh: async () => {
    try {
      cached = (await loadBridge()).readLabDeviceSnapshot();
    } catch {
      cached = null;
    }
    cachedAt = Date.now();
    return cached;
  },
  snapshot: () => cached,
  isPresent: (id) => isPresentInLab(cached, id),
  gate: async (commandName, args) => {
    // Pure first: no device intent or help/info → no need to read the save.
    const parsed = parseDeviceIntent(commandName, args);
    if (!parsed || parsed.kind === "help") return null;
    const snap = await freshSnapshot();
    if (!snap) return null;
    const decision = guardDeviceIntent(snap, bindIntent(parsed, Object.keys(snap.devices)));
    return decision.allow ? null : { success: false, output: ["", ...decision.lines, ""] };
  },
  afterCommand: async (commandName, args, result) => {
    if (!result.success || !cached) return result;
    const intent = resolveDeviceIntent(commandName, args, Object.keys(cached.devices));
    if (!intent || (intent.kind !== "power-on" && intent.kind !== "power-off")) return result;
    const info = cached.devices[intent.device];
    if (!info || info.presence === "unknown" || info.presence === "blueprint") return result;
    let report: DevicePowerReport;
    try {
      report = (await loadBridge()).labSetDevicePower(intent.device, intent.kind === "power-on");
    } catch {
      invalidateLabSnapshot();
      return result;
    }
    // The write changed the save: re-read (also restarts the TTL).
    invalidateLabSnapshot();
    await labSyncActions.refresh();
    if (report.status !== "switched") return result;
    const line = `[lab] ${intent.device} switched ${report.on ? "ON" : "OFF"} in the lab as well.`;
    const output = result.output ?? [];
    const trimmed =
      output.length && output[output.length - 1] === "" ? output.slice(0, -1) : output;
    return { ...result, output: [...trimmed, line, ""] };
  },
  questFlags: () => questFlagsFromWorld(cached),
};

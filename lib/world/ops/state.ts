/**
 * Operations state: the empty state and save sanitising (pure, no game
 * imports — game.ts and save-sanitize.ts use it without an import cycle).
 */
import type {
  BotOps,
  JadeIdle,
  OpsState,
  OpsStep,
  OpsStepKind,
  OpsTask,
  Routine,
  RoutineItem,
} from "@/lib/world/types";

/** Map prop of the surveillance station (content/map.ts, Control Room). */
export const SURVEILLANCE_PROP = "surveillance_station";

/** Actions kept in the log (habit learning looks at the recent past only). */
export const LOG_LIMIT = 120;
export const ROUTINE_LIMIT = 48;
export const TASK_LIMIT = 64;
export const MAX_LEVEL = 3;

export const STEP_KINDS: readonly OpsStepKind[] = [
  "pickup",
  "note",
  "puzzle",
  "craft",
  "build",
  "use",
  "toggle",
  "drone",
  "research",
  "link",
  "unlink",
  "decor",
];
const IDLE: readonly JadeIdle[] = ["read", "exercise", "sleep"];

export function initialOps(): OpsState {
  return {
    log: [],
    seen: {},
    routines: [],
    tasks: [],
    bots: {},
    recording: null,
    idle: null,
    next: 1,
  };
}

export function freshBot(): BotOps {
  return { level: 0, wear: 0, runs: 0, serviced: 0 };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max = 160): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function sanitizeStep(raw: unknown): OpsStep | null {
  if (!isRecord(raw) || !STEP_KINDS.includes(raw.kind as OpsStepKind) || !str(raw.id)) return null;
  const out: OpsStep = { kind: raw.kind as OpsStepKind, id: raw.id };
  if (str(raw.arg)) out.arg = raw.arg;
  if (str(raw.room)) out.room = raw.room;
  return out;
}

function sanitizeItem(raw: unknown): RoutineItem | null {
  if (isRecord(raw) && raw.kind === "routine" && str(raw.id))
    return { kind: "routine", id: raw.id };
  return sanitizeStep(raw);
}

function sanitizeRoutine(raw: unknown): Routine | null {
  if (!isRecord(raw) || !str(raw.id) || !Array.isArray(raw.items)) return null;
  const items = raw.items
    .map(sanitizeItem)
    .filter((x): x is RoutineItem => !!x)
    .slice(0, 64);
  if (!items.length) return null;
  const source = raw.source === "learned" || raw.source === "combined" ? raw.source : "recorded";
  return {
    id: raw.id,
    name: str(raw.name, 80) ? raw.name : raw.id,
    items,
    source,
    uses: finite(raw.uses) && raw.uses >= 0 ? Math.floor(raw.uses) : 0,
    auto: raw.auto === true,
    at: finite(raw.at) && raw.at >= 0 ? raw.at : 0,
  };
}

function sanitizeTask(raw: unknown): OpsTask | null {
  if (!isRecord(raw) || !str(raw.id) || !str(raw.who, 40) || !isRecord(raw.what)) return null;
  const w = raw.what;
  if ((w.kind !== "routine" && w.kind !== "duty") || !str(w.id)) return null;
  const t: OpsTask = {
    id: raw.id,
    who: raw.who,
    what: { kind: w.kind, id: w.id },
    at: finite(raw.at) && raw.at >= 0 ? raw.at : 0,
    every: finite(raw.every) ? clamp(Math.floor(raw.every), 0, 7 * 86400) : 0,
    priority: finite(raw.priority) ? clamp(Math.round(raw.priority), 0, 9) : 5,
  };
  if (raw.off === true) t.off = true;
  if (str(raw.arg)) t.arg = raw.arg;
  if (finite(raw.lastRun)) t.lastRun = raw.lastRun;
  if (str(raw.lastResult, 200)) t.lastResult = raw.lastResult;
  return t;
}

/** Rebuild the operations state from untrusted save data (never throws). */
export function sanitizeOps(raw: unknown): OpsState {
  const out = initialOps();
  if (!isRecord(raw)) return out;
  if (Array.isArray(raw.log))
    out.log = raw.log
      .map(sanitizeStep)
      .filter((x): x is OpsStep => !!x)
      .slice(-LOG_LIMIT);
  if (isRecord(raw.seen))
    for (const [k, v] of Object.entries(raw.seen))
      if (k.length <= 600 && finite(v) && v > 0) out.seen[k] = Math.floor(v);
  if (Array.isArray(raw.routines))
    out.routines = raw.routines
      .map(sanitizeRoutine)
      .filter((x): x is Routine => !!x)
      .slice(0, ROUTINE_LIMIT);
  if (Array.isArray(raw.tasks))
    out.tasks = raw.tasks
      .map(sanitizeTask)
      .filter((x): x is OpsTask => !!x)
      .slice(0, TASK_LIMIT);
  if (isRecord(raw.bots))
    for (const [id, b] of Object.entries(raw.bots)) {
      if (!isRecord(b) || id.length > 40) continue;
      out.bots[id] = {
        level: finite(b.level) ? clamp(Math.floor(b.level), 0, MAX_LEVEL) : 0,
        wear: finite(b.wear) ? clamp(b.wear, 0, 100) : 0,
        runs: finite(b.runs) && b.runs >= 0 ? Math.floor(b.runs) : 0,
        serviced: finite(b.serviced) && b.serviced >= 0 ? b.serviced : 0,
      };
    }
  if (Array.isArray(raw.recording))
    out.recording = raw.recording
      .map(sanitizeStep)
      .filter((x): x is OpsStep => !!x)
      .slice(0, 64);
  if (isRecord(raw.idle) && IDLE.includes(raw.idle.kind as JadeIdle) && finite(raw.idle.since))
    out.idle = { kind: raw.idle.kind as JadeIdle, since: raw.idle.since };
  if (finite(raw.next) && raw.next >= 1) out.next = Math.floor(raw.next);
  return out;
}

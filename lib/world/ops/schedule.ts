/**
 * The task schedule — Jade's routines and the bots' duties on the play clock
 * (pure). docs/OPS.md.
 * ======================================================================
 *
 * A task is "who does what, when, how often, how important" (`OpsTask`).
 * `opsTick` (1 Hz, components/world/useWorld.ts) runs what is due, highest
 * priority first: at most one task per agent per tick, so a bot works its
 * timetable one duty at a time. Every awake bot gets its own timetable of
 * duties automatically (`ensureBotSchedule`); a worn-out bot goes to its
 * service dock on its own. X0-R8T keeps its own schedule (it cannot be
 * re-planned). Jade's tasks run her routines.
 */
import { BOT_DUTIES, DUTY_BY_ID } from "@/lib/world/content/bot-duties";
import { TASK_LIMIT } from "@/lib/world/ops/state";
import { botAwake, botOps, dutyInterval, runDuty, WORN } from "@/lib/world/ops/bots";
import { routineById, runRoutine } from "@/lib/world/ops/routines";
import { log } from "@/lib/world/game";
import type { OpsAgent, OpsTask, WorldState } from "@/lib/world/types";

export interface OpsEvent {
  who: OpsAgent;
  ok: boolean;
  text: string;
}

export interface NewTask {
  who: OpsAgent;
  what: OpsTask["what"];
  /** Seconds from now until the first run (default: now). */
  in?: number;
  every?: number;
  priority?: number;
  arg?: string;
}

export function addTask(s: WorldState, t: NewTask): OpsTask | null {
  if (s.ops.tasks.length >= TASK_LIMIT) return null;
  if (t.what.kind === "routine" && !routineById(s, t.what.id)) return null;
  if (t.what.kind === "duty") {
    const d = DUTY_BY_ID.get(t.what.id);
    if (!d || d.bot !== t.who || d.ownSchedule) return null;
  }
  const task: OpsTask = {
    id: `t${s.ops.next++}`,
    who: t.who,
    what: { ...t.what },
    at: s.playTime + Math.max(0, t.in ?? 0),
    every: Math.max(0, Math.round(t.every ?? 0)),
    priority: Math.max(0, Math.min(9, Math.round(t.priority ?? 5))),
  };
  if (t.arg) task.arg = t.arg;
  s.ops.tasks.push(task);
  return task;
}

export function removeTask(s: WorldState, id: string): void {
  const t = s.ops.tasks.find((x) => x.id === id);
  if (!t) return;
  // X0-R8T's own timetable stays.
  if (t.what.kind === "duty" && DUTY_BY_ID.get(t.what.id)?.ownSchedule) return;
  s.ops.tasks = s.ops.tasks.filter((x) => x.id !== id);
}

export function updateTask(
  s: WorldState,
  id: string,
  patch: Partial<Pick<OpsTask, "every" | "priority" | "off" | "arg">> & { in?: number },
): void {
  const t = s.ops.tasks.find((x) => x.id === id);
  if (!t) return;
  if (patch.every !== undefined) t.every = Math.max(0, Math.round(patch.every));
  if (patch.priority !== undefined)
    t.priority = Math.max(0, Math.min(9, Math.round(patch.priority)));
  if (patch.off !== undefined) {
    if (patch.off) t.off = true;
    else delete t.off;
  }
  if (patch.arg !== undefined) t.arg = patch.arg;
  if (patch.in !== undefined) t.at = s.playTime + Math.max(0, patch.in);
}

/** Every awake bot has its duties on its timetable (created once, then the player's to tune). */
export function ensureBotSchedule(s: WorldState): void {
  for (const d of BOT_DUTIES) {
    if (!botAwake(s, d.bot)) continue;
    const key = `ops_sched_${d.id}`;
    if (s.flags[key]) continue;
    s.flags[key] = true;
    if (s.ops.tasks.length >= TASK_LIMIT) continue;
    s.ops.tasks.push({
      id: `t${s.ops.next++}`,
      who: d.bot,
      what: { kind: "duty", id: d.id },
      at: s.playTime + 30 + (s.ops.next % 7) * 20,
      every: d.every,
      priority: d.ownSchedule ? 3 : 5,
    });
  }
}

/** Due tasks in run order: priority (high first), then due time. */
export function dueTasks(s: WorldState, now = s.playTime): OpsTask[] {
  return s.ops.tasks
    .filter((t) => !t.off && t.at <= now)
    .sort((a, b) => b.priority - a.priority || a.at - b.at);
}

/** Run one task now and reschedule it (repeat) or drop it (once). */
export function runTask(s: WorldState, t: OpsTask): OpsEvent {
  let ev: OpsEvent;
  if (t.what.kind === "routine") {
    const r = routineById(s, t.what.id);
    if (!r) ev = { who: t.who, ok: false, text: t.what.id };
    else {
      const run = runRoutine(s, r.id);
      ev = { who: t.who, ok: run.done > 0, text: `${r.name}: ${run.done}/${run.total}` };
    }
  } else {
    const res = runDuty(s, t.what.id, t.arg);
    ev = { who: t.who, ok: res.ok, text: res.text };
  }
  // Every run lands in the lab log (journal), the surveillance panel reads it.
  log(s, ev.who === "jade" ? `Jade: ${ev.text}` : ev.text);
  t.lastRun = s.playTime;
  t.lastResult = ev.text.slice(0, 200);
  if (t.every > 0) {
    const d = t.what.kind === "duty" ? DUTY_BY_ID.get(t.what.id) : undefined;
    // Duties run at the bot's current speed (upgrades, coordination).
    const every = d ? dutyInterval(s, { ...d, every: t.every }) : t.every;
    t.at = s.playTime + every;
  } else s.ops.tasks = s.ops.tasks.filter((x) => x !== t);
  return ev;
}

/**
 * The scheduler's second: bot timetables, automatic service, due tasks
 * (one per agent). Returns what happened (for toasts and the log).
 */
export function opsTick(s: WorldState, now = s.playTime): OpsEvent[] {
  ensureBotSchedule(s);
  const events: OpsEvent[] = [];
  // Worn-out bots go to their dock on their own (before anything else they would do).
  for (const [bot, b] of Object.entries(s.ops.bots))
    if (b.wear >= WORN && botAwake(s, bot)) {
      const res = runDuty(s, `${bot}_service`);
      events.push({ who: bot, ok: res.ok, text: res.text });
    }
  const busy = new Set<string>();
  for (const t of dueTasks(s, now)) {
    if (busy.has(t.who)) continue;
    busy.add(t.who);
    events.push(runTask(s, t));
  }
  return events;
}

/** Jade's queued tasks in priority order (the long pause works them off first). */
export function jadeQueue(s: WorldState): OpsTask[] {
  return s.ops.tasks
    .filter((t) => t.who === "jade" && !t.off)
    .sort((a, b) => b.priority - a.priority || a.at - b.at);
}

export { botOps };

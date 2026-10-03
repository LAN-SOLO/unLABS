/**
 * Root lab cron (docs/ROOT-LAB.md § Cron): jobs the player wrote at a
 * terminal run on their own in play time — `rootTick(s)` once per second
 * from useWorld, like opsTick. A job runs with the ring it was created at
 * (never higher than Jade's current ring), checks its guard
 * (`when balance<0 …`) and runs its `;`-chained commands through the same
 * root shell; `switch <ID> on|off` toggles a relay like the device panel.
 * Every change lands in the audit trail as `cron#<id>`.
 */
import { tr } from "@/lib/i18n";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { isBuilt, isSwitchedOn, log, toggleDevice } from "@/lib/world/game";
import { applyRootOp, dueJobs } from "@/lib/world/root/model";
import { guardHolds, parseCronLine, runRootLine } from "@/lib/world/root/shell";
import { MAX_AUDIT, type Ring } from "@/lib/world/root/state";
import type { WorldState } from "@/lib/world/types";

export interface CronEvent {
  id: number;
  /** What changed (audit lines); empty = ran, nothing to do. */
  changed: string[];
  /** Why it did not run (permission, syntax). */
  error?: string;
}

function runSwitch(s: WorldState, args: string[], ring: Ring, via: string): string | null {
  if (ring < 1) return null;
  const id = args[0]?.toUpperCase() ?? "";
  const on = args[1]?.toLowerCase() === "on";
  if (!DEVICE_BY_ID.has(id) || !isBuilt(s, id) || id === "MCP-000") return null;
  if (isSwitchedOn(s, id) === on) return null;
  toggleDevice(s, id);
  const what = `switch ${id} ${on ? "on" : "off"}`;
  s.root.audit.push({ t: s.playTime, via, what });
  if (s.root.audit.length > MAX_AUDIT) s.root.audit.splice(0, s.root.audit.length - MAX_AUDIT);
  log(
    s,
    on ? tr("{via}: {id} switched on.", { via, id }) : tr("{via}: {id} switched off.", { via, id }),
  );
  return what;
}

/** Run one job now (also used by tests). */
export function runJob(s: WorldState, jobId: number): CronEvent {
  const job = s.root.cron.find((j) => j.id === jobId);
  if (!job) return { id: jobId, changed: [], error: "gone" };
  job.last = s.playTime;
  const parsed = parseCronLine(job.cmd);
  if ("error" in parsed) return { id: job.id, changed: [], error: parsed.error };
  if (!guardHolds(s, parsed.guard)) return { id: job.id, changed: [] };
  const ring = Math.min(job.ring, s.root.ring) as Ring;
  const via = `cron#${job.id}`;
  const changed: string[] = [];
  for (const cmd of parsed.cmds) {
    const [head, ...args] = cmd.split(/\s+/);
    if (head?.toLowerCase() === "switch") {
      const w = runSwitch(s, args, ring, via);
      if (w) changed.push(w);
      continue;
    }
    const res = runRootLine(s, cmd, { ring, cron: true });
    if (!res) continue;
    for (const op of res.ops) {
      const w = applyRootOp(s, op, via);
      if (w) changed.push(w);
    }
  }
  return { id: job.id, changed };
}

/** Once per second: run every due job. Returns the jobs that changed something. */
export function rootTick(s: WorldState): CronEvent[] {
  if (!s.root?.cron.length) return [];
  const out: CronEvent[] = [];
  for (const id of dueJobs(s, s.playTime)) {
    const ev = runJob(s, id);
    if (ev.changed.length) out.push(ev);
  }
  return out;
}

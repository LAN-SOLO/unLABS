/**
 * Jade's life while the game is paused (pure). docs/OPS.md.
 * ========================================================
 *
 * When the game has been paused (pause menu, console, hidden tab) for more
 * than an hour of real time, Jade first works off her scheduled tasks by
 * priority, then goes to her quarters and reads or does her exercise. After
 * five hours of real time she goes to bed. The state (`ops.idle`) tells the
 * engine where she is and what she does when the player comes back; the
 * player's first move ends it.
 */
import { sleep } from "@/lib/world/biorhythm";
import { jadeQueue, runTask, type OpsEvent } from "@/lib/world/ops/schedule";
import type { JadeIdle, WorldState } from "@/lib/world/types";

export const HOUR_MS = 3_600_000;
export const IDLE_AFTER_MS = HOUR_MS;
export const SLEEP_AFTER_MS = 5 * HOUR_MS;

/** Reading or exercise — whichever her body needs more (biorhythm), reading by default. */
export function idleChoice(s: WorldState): JadeIdle {
  const fit = s.counters.bio_fit ?? 60;
  const rest = s.counters.bio_rest ?? 60;
  return fit < 50 && rest > 40 ? "exercise" : "read";
}

/**
 * Called every second while the game is paused, with how long it has been
 * paused (ms) and the wall clock. Returns the tasks Jade worked off (if any).
 */
export function idleTick(s: WorldState, pausedForMs: number, nowMs: number): OpsEvent[] {
  const cur = s.ops.idle;
  if (pausedForMs >= SLEEP_AFTER_MS && cur?.kind !== "sleep") {
    s.ops.idle = { kind: "sleep", since: nowMs };
    sleep(s);
    return [];
  }
  if (pausedForMs >= IDLE_AFTER_MS && !cur) {
    // The planned work first, by priority — then her own time.
    const events = jadeQueue(s).map((t) => runTask(s, t));
    s.ops.idle = { kind: idleChoice(s), since: nowMs };
    return events;
  }
  return [];
}

/** The player is back and moves: Jade's idle life ends. */
export function endIdle(s: WorldState): void {
  s.ops.idle = null;
}

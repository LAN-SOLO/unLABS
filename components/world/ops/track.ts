"use client";

/**
 * Glue between the player's actions and Jade's routines (docs/OPS.md):
 * every successful action is noted (`noteAction`, inside the same `act`),
 * and what Jade learned or finished on her own is announced as a toast.
 */
import { tr } from "@/lib/i18n";
import { noteAction, type NoteResult } from "@/lib/world/ops/routines";
import type { OpsStep, WorldState } from "@/lib/world/types";

interface Api {
  act<T>(fn: (s: WorldState) => T): T;
  toast(text: string, tone?: "info" | "good" | "warn" | "insight"): void;
}

export function announceOps(api: Api, r: NoteResult): void {
  if (r.learned)
    api.toast(
      tr(
        "Jade remembers: “{name}” — she will finish it herself next time (Surveillance → Routines).",
        {
          name: r.learned.name,
        },
      ),
      "insight",
    );
  if (r.habit)
    api.toast(
      tr("Jade finishes the habit “{name}” ({done}/{total}).", {
        name: r.habit.routine.name,
        done: r.habit.run.done,
        total: r.habit.run.total,
      }),
      "info",
    );
}

/** Note a successful action now (its own `act`), with toasts. */
export function trackAction(api: Api, step: OpsStep): void {
  announceOps(
    api,
    api.act((st) => noteAction(st, step)),
  );
}

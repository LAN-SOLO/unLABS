/**
 * Terminal ↔ Lab World facade.
 * ============================
 *
 * The `labWorldActions` data fetcher: a small, typed, async view of the
 * active lab-world save (`/world`) for terminal code that is not the
 * `labor` command itself — the boot banner in `useTerminal`, `status`-style
 * commands, quest hooks. `lib/world/bridge.ts` (and with it the whole lab
 * content graph) is imported lazily, so the terminal bundle stays lean and
 * nothing here runs on the server.
 *
 * Writes go through the bridge's one safe path (`labSignal`), which saves
 * into the active slot and queues a toast event for the world.
 */

import { tr } from "@/lib/i18n";
import type { LabSummary, SignalReport } from "@/lib/world/bridge";

export type { LabSummary, SignalReport };

export interface LabWorldTerminalActions {
  /** True if the active world slot holds a save. */
  hasWorld: () => Promise<boolean>;
  /** Structured summary of the active slot (null without a world save). */
  summary: () => Promise<LabSummary | null>;
  /** One plain banner line for a summary (terminal output, player's language). */
  summaryLine: (sum: LabSummary) => string;
  /** Key a code into the lab (resolves the matching world puzzle, saves the slot). */
  signal: (code: string) => Promise<SignalReport>;
  /** Ask the MCP; answers derive from the active world state. */
  ask: (question: string) => Promise<string[]>;
}

/**
 * One plain line in the player's language:
 * "L0 · Control Room · 3/38 devices · 2 online · 2/40 insights".
 * Room/floor names come from the (translated) lab content.
 */
export function formatLabSummary(sum: LabSummary): string {
  return [
    sum.room ? `${sum.floorShort} · ${sum.room}` : sum.floorName,
    tr("{n}/{total} devices", { n: sum.devicesBuilt, total: sum.devicesTotal }),
    tr("{n} online", { n: sum.devicesOnline }),
    tr("{n}/{total} insights", { n: sum.insights, total: sum.insightsTotal }),
    ...(sum.endings
      ? [tr("{n}/{total} endings", { n: sum.endings, total: sum.endingsTotal })]
      : []),
  ].join(" · ");
}

/** @deprecated Same as `formatLabSummary` (which now follows the player's language). */
export const formatLabSummaryEn = formatLabSummary;

const loadBridge = () => import("@/lib/world/bridge");

/** Stable singleton — safe to put into a memoised `DataFetchers` object. */
export const labWorldActions: LabWorldTerminalActions = {
  hasWorld: async () => (await loadBridge()).hasLabWorld(),
  summary: async () => (await loadBridge()).readLabSummary(),
  summaryLine: (sum) => formatLabSummary(sum),
  signal: async (code) => (await loadBridge()).labSignal(code),
  ask: async (question) => (await loadBridge()).labMcp(question),
};

/**
 * Boot-banner lines for the terminal welcome (plain; the caller adds them as
 * "system" lines). Empty when there is no world save, so first-time players
 * see nothing extra.
 */
export async function labBootLines(): Promise<string[]> {
  const sum = await labWorldActions.summary();
  if (!sum) return [];
  const lines = [
    tr("> Lab World ({slot}): {summary}", {
      slot: sum.slotName,
      summary: labWorldActions.summaryLine(sum),
    }),
    ...(sum.starved ? [tr("> ! {n} lab device(s) without power.", { n: sum.starved })] : []),
    ...(sum.signalsOpen
      ? [
          tr("> Main Console: {n} code receiver(s) waiting — 'labor signal <code>'.", {
            n: sum.signalsOpen,
          }),
        ]
      : []),
    tr("> Device commands follow the lab hardware: build and power devices in /world."),
    tr("> Type 'labor' for the lab status, 'labor world' to go back."),
  ];
  return lines;
}

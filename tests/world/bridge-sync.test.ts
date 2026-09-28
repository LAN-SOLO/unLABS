import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAB_SIGNALS,
  TERMINAL_EVENTS_KEY,
  absorbTerminalEvents,
  applySignal,
  labSignal,
  labSummary,
  mcpAnswer,
  readLabSummary,
  subscribeTerminalEvents,
  takeTerminalEvents,
} from "@/lib/world/bridge";
import { DEVICES } from "@/lib/world/content/devices";
import { BOT_QUESTS, ENDINGS } from "@/lib/world/content/story";
import { initialState, log } from "@/lib/world/game";
import { loadSlot, loadWorld, saveToSlot, saveWorld } from "@/lib/world/save";
import { formatLabSummary, labBootLines, labWorldActions } from "@/lib/terminal/labWorld";
import type { WorldState } from "@/lib/world/types";

function buildAll(s: WorldState, ids: readonly string[]): void {
  for (const id of ids) {
    const d = DEVICES.find((x) => x.id === id);
    if (!d) throw new Error(`unknown device ${id}`);
    s.built[id] = d.stages.length;
    s.discovered[id] = true;
  }
}

function earlyState(): WorldState {
  const s = initialState();
  s.flags.geo_routed = true;
  buildAll(s, ["UEC-001", "BTK-001", "CLK-001"]);
  s.playTime = 3_725;
  log(s, "Eintrag aus dem Test.");
  return s;
}

function lateState(): WorldState {
  const s = earlyState();
  buildAll(
    s,
    DEVICES.map((d) => d.id),
  );
  s.insights.vier_toene = 1;
  return s;
}

beforeEach(() => {
  localStorage.clear();
});

describe("labSummary (pure)", () => {
  it("counts devices, insights, bots and open signals", () => {
    const s = earlyState();
    const sum = labSummary(s, "slot2");
    expect(sum.slot).toBe("slot2");
    expect(sum.slotName).toBe("Save slot 2");
    expect(sum.playTime).toBe("01:02");
    expect(sum.devicesTotal).toBe(DEVICES.length);
    expect(sum.devicesBuilt).toBeGreaterThanOrEqual(3);
    expect(sum.devicesOnline).toBeGreaterThan(0);
    expect(sum.devicesOnline).toBeLessThanOrEqual(sum.devicesTotal);
    expect(sum.generation).toBeGreaterThan(0);
    expect(sum.endingsTotal).toBe(ENDINGS.length);
    expect(sum.botsTotal).toBe(BOT_QUESTS.length);
    expect(sum.botsAwake).toBe(0);
    expect(sum.signalsOpen).toBe(LAB_SIGNALS.length);
    expect(sum.floor).toBe(s.floor);
  });

  it("drops solved signals from the open count", () => {
    const s = earlyState();
    s.puzzles.pz_tones = true;
    expect(labSummary(s, "slot1").signalsOpen).toBe(LAB_SIGNALS.length - 1);
  });

  it("formats a compact banner line", () => {
    const line = formatLabSummary(labSummary(earlyState(), "slot1"));
    expect(line).toMatch(new RegExp(`\\d+/${DEVICES.length} devices`));
    expect(line).toContain("insights");
    expect(line).not.toContain("endings");
  });
});

describe("readLabSummary / terminal facade", () => {
  it("is null without a world save; the boot banner stays silent", async () => {
    expect(readLabSummary()).toBeNull();
    expect(await labWorldActions.hasWorld()).toBe(false);
    expect(await labBootLines()).toEqual([]);
  });

  it("reads the active slot, not just slot 1", async () => {
    const s = earlyState();
    expect(saveToSlot("slot3", s, { activate: true })).toBe(true);
    const sum = readLabSummary();
    expect(sum?.slot).toBe("slot3");
    expect((await labWorldActions.summary())?.slot).toBe("slot3");
    const lines = await labBootLines();
    expect(lines[0]).toContain("Save slot 3");
    expect(lines.some((l) => l.includes("labor signal"))).toBe(true);
  });

  it("signal via the facade writes the active slot", async () => {
    saveToSlot("slot2", lateState(), { activate: true });
    const r = await labWorldActions.signal("3648");
    expect(r.status).toBe("accepted");
    expect(loadSlot("slot2")?.puzzles.pz_tones).toBe(true);
    expect(loadSlot("slot1")).toBeNull();
    expect(readLabSummary()?.signalsOpen).toBe(LAB_SIGNALS.length - 1);
  });
});

describe("applySignal (pure)", () => {
  it("mutates only on acceptance and names the console in the log", () => {
    const s = lateState();
    const before = JSON.stringify(s);
    expect(applySignal(s, "0000").status).toBe("unknown");
    expect(applySignal(s, "").status).toBe("unknown");
    expect(JSON.stringify(s)).toBe(before);

    const r = applySignal(s, "3 6 4 8", "Room terminal");
    expect(r.status).toBe("accepted");
    expect(s.puzzles.pz_tones).toBe(true);
    expect(s.counters.terminal_signals).toBe(1);
    expect(s.log.some((e) => e.text.startsWith("Room terminal: signal 3648"))).toBe(true);

    expect(applySignal(s, "3648").status).toBe("known");
    expect(s.counters.terminal_signals).toBe(1);
  });

  it("every signal targets a real host device and puzzle", () => {
    for (const sig of LAB_SIGNALS) {
      const r = applySignal(lateState(), sig.code);
      expect(r.status).not.toBe("failed");
      expect(r.status).not.toBe("unknown");
    }
  });
});

describe("mcpAnswer (pure)", () => {
  it("points at the console while codes are open, and says so when none are", () => {
    const s = earlyState();
    expect(mcpAnswer(s, "welcher code?").join(" ")).toContain("labor signal");
    for (const sig of LAB_SIGNALS) s.puzzles[sig.puzzle] = true;
    expect(mcpAnswer(s, "welcher code?").join(" ")).toContain("Every code I know");
  });

  it("always answers something", () => {
    expect(mcpAnswer(earlyState(), "xyzzy").length).toBeGreaterThan(0);
  });
});

describe("terminal → world round trip", () => {
  it("a stale world flush cannot lose a signal: the event queue re-applies it", () => {
    saveToSlot("slot1", lateState(), { activate: true });
    // The world holds a live (bound) copy of the slot …
    const live = loadWorld();
    // … the terminal keys a code into the same slot …
    expect(labSignal("3648").status).toBe("accepted");
    // … and the world flushes its older copy over it (second tab / late flush).
    saveWorld(live);
    expect(loadSlot("slot1")?.puzzles.pz_tones).toBeUndefined();

    // On mount / storage event the world absorbs the queued events.
    const { events, reapplied } = absorbTerminalEvents(live, "slot1");
    expect(events.map((e) => e.code)).toEqual(["3648"]);
    expect(reapplied).toEqual(["3648"]);
    expect(live.puzzles.pz_tones).toBe(true);
    saveWorld(live);
    expect(loadSlot("slot1")?.puzzles.pz_tones).toBe(true);
    expect(takeTerminalEvents("slot1")).toEqual([]);
  });

  it("absorbing is idempotent when the world already has the result", () => {
    saveToSlot("slot1", lateState(), { activate: true });
    expect(labSignal("LOVW").status).toBe("accepted");
    const fresh = loadWorld();
    const logLen = fresh.log.length;
    const { events, reapplied } = absorbTerminalEvents(fresh, "slot1");
    expect(events).toHaveLength(1);
    expect(reapplied).toEqual([]);
    expect(fresh.log.length).toBe(logLen);
  });

  it("only takes events of the given slot", () => {
    saveToSlot("slot2", lateState(), { activate: true });
    labSignal("3648");
    expect(absorbTerminalEvents(initialState(), "slot1").events).toEqual([]);
    expect(absorbTerminalEvents(lateState(), "slot2").events).toHaveLength(1);
  });
});

describe("subscribeTerminalEvents", () => {
  it("fires for queued events from another tab and unsubscribes", () => {
    const cb = vi.fn();
    const off = subscribeTerminalEvents(cb);
    window.dispatchEvent(
      new StorageEvent("storage", { key: TERMINAL_EVENTS_KEY, newValue: '[{"x":1}]' }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: TERMINAL_EVENTS_KEY, newValue: "[]" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "1" }));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    window.dispatchEvent(
      new StorageEvent("storage", { key: TERMINAL_EVENTS_KEY, newValue: '[{"x":1}]' }),
    );
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

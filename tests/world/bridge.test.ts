import { beforeEach, describe, expect, it } from "vitest";
import {
  NO_WORLD_MESSAGE,
  TERMINAL_EVENTS_KEY,
  hasLabWorld,
  labAchievements,
  labBots,
  labDevices,
  labJournal,
  labMap,
  labMcp,
  labObjectives,
  labPower,
  labSignal,
  labStatus,
  normalizeSignal,
  parseFloorArg,
  takeTerminalEvents,
} from "@/lib/world/bridge";
import { DEVICES } from "@/lib/world/content/devices";
import { BOT_QUESTS } from "@/lib/world/content/story";
import { initialState, isOnline, log } from "@/lib/world/game";
import { loadSlot, saveToSlot } from "@/lib/world/save";
import type { WorldState } from "@/lib/world/types";

function buildAll(s: WorldState, ids: readonly string[]): void {
  for (const id of ids) {
    const d = DEVICES.find((x) => x.id === id);
    if (!d) throw new Error(`unknown device ${id}`);
    s.built[id] = d.stages.length;
    s.discovered[id] = true;
  }
}

/** Early game: power online, a few devices built, Jade in the control room. */
function earlyState(): WorldState {
  const s = initialState();
  s.flags.geo_routed = true;
  buildAll(s, ["UEC-001", "BTK-001", "CLK-001"]);
  s.flags.visited_kontroll = true;
  s.playTime = 600;
  log(s, "Erster Eintrag aus dem Test.");
  log(s, "Zweiter Eintrag aus dem Test.");
  return s;
}

/** Late game: every device built, so the signal hosts are online. */
function lateState(): WorldState {
  const s = earlyState();
  buildAll(
    s,
    DEVICES.map((d) => d.id),
  );
  return s;
}

function persist(s: WorldState): void {
  expect(saveToSlot("slot1", s, { activate: true })).toBe(true);
}

beforeEach(() => {
  localStorage.clear();
});

describe("without a world save", () => {
  it("every view degrades to the no-world message", () => {
    expect(hasLabWorld()).toBe(false);
    for (const lines of [
      labStatus(),
      labDevices(),
      labPower(),
      labJournal(5),
      labObjectives(),
      labAchievements(),
      labMap(0),
      labBots(),
      labMcp("strom"),
    ]) {
      expect(lines).toEqual([NO_WORLD_MESSAGE]);
    }
    const r = labSignal("3648");
    expect(r.ok).toBe(false);
    expect(r.status).toBe("noworld");
  });
});

describe("read views", () => {
  beforeEach(() => persist(earlyState()));

  it("status summarises floor, room, power, devices, endings and achievements", () => {
    expect(hasLabWorld()).toBe(true);
    const text = labStatus().join("\n");
    expect(text).toContain("Save slot 1");
    expect(text).toContain("Control Room");
    expect(text).toMatch(/Power\s+\d+(\.\d)? W generated/);
    expect(text).toMatch(new RegExp(`Devices\\s+\\d+/${DEVICES.length} built`));
    expect(text).toMatch(/Endings\s+0\/\d+/);
    expect(text).toMatch(/Achievements\s+\d+\/\d+/);
  });

  it("devices list marks built devices and filters by floor", () => {
    const all = labDevices();
    expect(all.some((l) => l.includes("UEC-001") && /^[✓!○]/.test(l))).toBe(true);
    const e0 = labDevices(0);
    expect(e0.length).toBeLessThan(all.length);
    expect(e0.some((l) => l.includes("Level 0"))).toBe(true);
  });

  it("power lists sources", () => {
    const text = labPower().join("\n");
    expect(text).toContain("Power grid");
    expect(text).toContain("Geothermal tap");
  });

  it("journal returns the last n entries", () => {
    const lines = labJournal(2);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain("Zweiter Eintrag");
  });

  it("objectives, achievements and bots render sections", () => {
    expect(labObjectives()[0]).toContain("Objectives");
    expect(labAchievements()[0]).toContain("Achievements");
    const bots = labBots();
    expect(bots).toHaveLength(BOT_QUESTS.length + 1);
    expect(bots.slice(1).every((l) => l.startsWith("○"))).toBe(true);
  });

  it("map draws Jade, rooms and a key", () => {
    const lines = labMap();
    expect(lines[0]).toContain("Level 0");
    expect(lines.some((l) => l.includes("@"))).toBe(true);
    expect(lines.some((l) => l.includes("A Control Room"))).toBe(true);
    expect(lines.every((l) => l.length <= 80)).toBe(true);
  });

  it("map of a locked floor explains the lock", () => {
    const lines = labMap(3);
    expect(lines.join("\n")).toContain("locked");
  });

  it("MCP answers from state", () => {
    expect(labMcp("wie viel strom?").join(" ")).toContain("Generation");
    expect(labMcp("how much power?").join(" ")).toContain("Generation");
    expect(labMcp("wo bin ich").join(" ")).toContain("Control Room");
    expect(labMcp("").length).toBeGreaterThan(0);
  });
});

describe("parsing", () => {
  it("maps display levels to floor ids", () => {
    expect(parseFloorArg("0")).toBe(0);
    expect(parseFloorArg("-1")).toBe(1);
    expect(parseFloorArg("−2")).toBe(2);
    expect(parseFloorArg("E-3")).toBe(3);
    expect(parseFloorArg("+1")).toBe(4);
    expect(parseFloorArg("1")).toBe(4);
    expect(parseFloorArg("-4")).toBe(5);
    expect(parseFloorArg("-5")).toBeNull();
    expect(parseFloorArg("abc")).toBeNull();
    expect(parseFloorArg(undefined)).toBeNull();
  });

  it("normalises codes", () => {
    expect(normalizeSignal("3-6-4-8")).toBe("3648");
    expect(normalizeSignal(" l o v w ")).toBe("LOVW");
  });
});

describe("labSignal", () => {
  it("rejects unknown codes without touching the save", () => {
    persist(earlyState());
    const before = localStorage.getItem("unlabs.world.v1.slot1");
    const r = labSignal("1234");
    expect(r.status).toBe("unknown");
    expect(localStorage.getItem("unlabs.world.v1.slot1")).toBe(before);
  });

  it("blocks the handshake while HMS-001 is offline", () => {
    persist(earlyState());
    const r = labSignal("3648");
    expect(r.status).toBe("blocked");
    expect(loadSlot("slot1")?.insights.handshake).toBeUndefined();
  });

  it("the four tones resolve the handshake in the active slot", () => {
    const s = lateState();
    s.insights.vier_toene = 1;
    expect(isOnline(s, "HMS-001")).toBe(true);
    expect(isOnline(s, "SPK-001")).toBe(true);
    persist(s);

    const r = labSignal("3-6-4-8");
    expect(r.status).toBe("accepted");
    expect(r.insights).toContain("handshake");
    expect(r.flags).toContain("handshake_done");

    const saved = loadSlot("slot1")!;
    expect(saved.insights.handshake).toBeTruthy();
    expect(saved.flags.handshake_done).toBe(true);
    expect(saved.puzzles.pz_tones).toBe(true);
    expect(saved.flags.terminal_pz_tones).toBe(true);
    expect(saved.log.some((e) => e.text.includes("Main Console"))).toBe(true);

    expect(labSignal("3648").status).toBe("known");

    const events = takeTerminalEvents("slot1");
    expect(events).toHaveLength(1);
    expect(events[0]?.code).toBe("3648");
    expect(takeTerminalEvents("slot1")).toHaveLength(0);
    expect(localStorage.getItem(TERMINAL_EVENTS_KEY)).toBe("[]");
  });

  it("LOVW decodes the whisper", () => {
    const s = lateState();
    expect(isOnline(s, "ECR-001")).toBe(true);
    persist(s);
    const r = labSignal("lovw");
    expect(r.status).toBe("accepted");
    const saved = loadSlot("slot1")!;
    expect(saved.flags.whisper_decoded).toBe(true);
    expect(saved.puzzles.pz_morse_whisper).toBe(true);
  });

  it("HALO needs the key insight first", () => {
    const s = lateState();
    persist(s);
    expect(labSignal("HALO").status).toBe("blocked");
    s.insights.halo_schluessel = 1;
    persist(s);
    expect(labSignal("HALO").status).toBe("accepted");
    expect(loadSlot("slot1")?.insights.halo_zustand).toBeTruthy();
  });
});

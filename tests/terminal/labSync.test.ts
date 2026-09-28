import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TERMINAL_EVENTS_KEY,
  absorbTerminalEvents,
  applyDevicePower,
  deviceSnapshot,
  labSetDevicePower,
  type LabDeviceSnapshot,
} from "@/lib/world/bridge";
import { DEVICES } from "@/lib/world/content/devices";
import { initialState, isBuilt, isOnline, isSwitchedOn, toggleDevice } from "@/lib/world/game";
import { loadSlot, saveToSlot } from "@/lib/world/save";
import {
  DEVICE_COMMAND_IDS,
  LAB_SNAPSHOT_TTL_MS,
  WORLD_QUEST_FLAGS,
  type DeviceIntentKind,
  guardDeviceIntent,
  invalidateLabSnapshot,
  isPresentInLab,
  labSyncActions,
  notDetectedLines,
  offlineLines,
  needsLabSnapshot,
  parseDeviceIntent,
  questFlagsFromWorld,
  resolveDeviceIntent,
  resolveLabDeviceId,
} from "@/lib/terminal/labSync";
import { STARTER_DEVICES, DEVICE_UNLOCK_FLAGS } from "@/lib/game/devices/unlocks";
import type { WorldState } from "@/lib/world/types";
import { play } from "../world/simPlayer";

const WORLD_IDS = DEVICES.map((d) => d.id);
const commands = Object.entries(DEVICE_COMMAND_IDS);

function build(s: WorldState, ids: readonly string[]): void {
  for (const id of ids) {
    const d = DEVICES.find((x) => x.id === id);
    if (!d) throw new Error(`unknown device ${id}`);
    s.built[id] = d.stages.length;
    s.discovered[id] = true;
  }
}

/** Geothermal + UEC → plenty of power for a handful of consumers. */
function poweredState(ids: readonly string[] = []): WorldState {
  const s = initialState();
  s.flags.geo_routed = true;
  build(s, ["UEC-001", ...ids]);
  return s;
}

function snap(s: WorldState): LabDeviceSnapshot {
  return deviceSnapshot(s, "slot1");
}

beforeEach(() => {
  localStorage.clear();
  invalidateLabSnapshot();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("device id mapping", () => {
  it("maps every device command to a lab device that exists", () => {
    for (const [cmd, id] of Object.entries(DEVICE_COMMAND_IDS)) {
      expect(WORLD_IDS, `${cmd} → ${id}`).toContain(id);
    }
  });

  it("maps only real terminal commands (canonical names)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../lib/terminal/commands.ts"), "utf8");
    for (const cmd of Object.keys(DEVICE_COMMAND_IDS)) {
      expect(src, cmd).toContain(`name: "${cmd}",`);
    }
  });

  it("covers the terminal's device roster (all 38 ids exist in the lab)", () => {
    const terminalIds = [...STARTER_DEVICES, ...Object.keys(DEVICE_UNLOCK_FLAGS)];
    for (const id of terminalIds) expect(WORLD_IDS, id).toContain(id);
  });

  it("resolves typed ids, short forms and terminal spellings", () => {
    expect(resolveLabDeviceId("bat-001", WORLD_IDS)).toBe("BAT-001");
    expect(resolveLabDeviceId("EMC", WORLD_IDS)).toBe("EMC-001");
    expect(resolveLabDeviceId("qua-001", WORLD_IDS)).toBe("QAN-001");
    expect(resolveLabDeviceId("QUA", WORLD_IDS)).toBe("QAN-001");
    expect(resolveLabDeviceId("nxs-01", WORLD_IDS)).toBe("NXS-01");
    expect(resolveLabDeviceId("XYZ-001", WORLD_IDS)).toBeNull();
    expect(resolveLabDeviceId("", WORLD_IDS)).toBeNull();
  });
});

describe("resolveDeviceIntent", () => {
  it("classifies device subcommands", () => {
    const k = (cmd: string, ...args: string[]) =>
      resolveDeviceIntent(cmd, args, WORLD_IDS)?.kind ?? null;
    expect(k("cdc")).toBe("help");
    expect(k("cdc", "info")).toBe("help");
    expect(k("cdc", "fold")).toBe("ui");
    expect(k("cdc", "power")).toBe("power-status");
    expect(k("cdc", "power", "on")).toBe("power-on");
    expect(k("spk", "pwr", "shutdown")).toBe("power-off");
    expect(k("tlp", "on")).toBe("power-on");
    expect(k("cdc", "status")).toBe("operate");
    expect(k("qua", "scan")).toBe("operate");
    expect(resolveDeviceIntent("qua", ["scan"], WORLD_IDS)?.device).toBe("QAN-001");
    expect(resolveDeviceIntent("ipl", ["test"], WORLD_IDS)?.device).toBe("INT-001");
  });

  it("reads the target of power / device power", () => {
    expect(resolveDeviceIntent("power", ["on", "bat-001"], WORLD_IDS)).toEqual({
      device: "BAT-001",
      kind: "power-on",
    });
    expect(resolveDeviceIntent("device", ["power", "EMC", "off"], WORLD_IDS)).toEqual({
      device: "EMC-001",
      kind: "power-off",
    });
    expect(resolveDeviceIntent("power", ["status"], WORLD_IDS)).toBeNull();
    expect(resolveDeviceIntent("device", ["power", "all", "on"], WORLD_IDS)).toBeNull();
    expect(resolveDeviceIntent("device", ["power", "off", "all"], WORLD_IDS)).toBeNull();
    expect(resolveDeviceIntent("ls", [], WORLD_IDS)).toBeNull();
  });
});

describe("guardDeviceIntent", () => {
  const intent = (device: string, kind: DeviceIntentKind) => ({ device, kind });

  it("allows everything without a world save (fallback to terminal rules)", () => {
    expect(guardDeviceIntent(null, intent("CDC-001", "operate"))).toEqual({ allow: true });
  });

  it("blocks a device that is not built: DEVICE NOT DETECTED", () => {
    const s = poweredState();
    const d = guardDeviceIntent(snap(s), intent("CDC-001", "operate"));
    expect(d.allow).toBe(false);
    if (!d.allow) {
      expect(d.lines[0]).toContain("DEVICE NOT DETECTED");
      expect(d.lines.join("\n")).toContain("No blueprint yet");
    }
    expect(guardDeviceIntent(snap(s), intent("CDC-001", "power-on")).allow).toBe(false);
    expect(guardDeviceIntent(snap(s), intent("CDC-001", "help")).allow).toBe(true);
  });

  it("points to the room for a half-built blueprint", () => {
    const s = poweredState();
    s.discovered["CDC-001"] = true;
    s.built["CDC-001"] = 1;
    const d = guardDeviceIntent(snap(s), intent("CDC-001", "operate"));
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.lines.join("\n")).toMatch(/build stage 1\/\d+/);
  });

  it("switched off: blocks operation, allows switching on", () => {
    const s = poweredState(["BAT-001"]);
    s.switchedOn["BAT-001"] = false;
    const sn = snap(s);
    expect(sn.devices["BAT-001"]?.presence).toBe("off");
    const d = guardDeviceIntent(sn, intent("BAT-001", "operate"));
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.lines[0]).toContain("OFFLINE");
    expect(guardDeviceIntent(sn, intent("BAT-001", "power-on")).allow).toBe(true);
    expect(guardDeviceIntent(sn, intent("BAT-001", "ui")).allow).toBe(true);
  });

  it("brownout: blocks operation and power-on, allows power-off", () => {
    const consumer = DEVICES.find((d) => d.power > 0 && d.id !== "MCP-000");
    if (!consumer) throw new Error("no consumer device");
    const s = initialState(); // no generation at all
    build(s, [consumer.id]);
    const sn = snap(s);
    expect(["starved", "overheated"]).toContain(sn.devices[consumer.id]?.presence);
    const d = guardDeviceIntent(sn, intent(consumer.id, "operate"));
    expect(d.allow).toBe(false);
    if (!d.allow) expect(d.lines[0]).toContain("OFFLINE");
    expect(guardDeviceIntent(sn, intent(consumer.id, "power-on")).allow).toBe(false);
    expect(guardDeviceIntent(sn, intent(consumer.id, "power-off")).allow).toBe(true);
  });

  it("online: allows everything", () => {
    const s = poweredState(["BAT-001"]);
    const sn = snap(s);
    expect(sn.devices["BAT-001"]?.presence).toBe("online");
    expect(guardDeviceIntent(sn, intent("BAT-001", "operate"))).toEqual({ allow: true });
  });

  it("isPresentInLab: world decides once a save exists", () => {
    const s = poweredState(["BAT-001"]);
    expect(isPresentInLab(null, "BAT-001")).toBeNull();
    expect(isPresentInLab(snap(s), "BAT-001")).toBe(true);
    expect(isPresentInLab(snap(s), "SCA-001")).toBe(false);
    expect(isPresentInLab(snap(s), "QUA-001")).toBe(false);
  });
});

describe("quest correspondences", () => {
  it("uses only lab devices", () => {
    for (const q of WORLD_QUEST_FLAGS) {
      for (const id of q.devices) expect(WORLD_IDS, `${q.flag} → ${id}`).toContain(id);
    }
  });

  it("uses only flags the client may set (actions/quest.ts allow-list)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(game)/actions/quest.ts"), "utf8");
    for (const q of WORLD_QUEST_FLAGS) expect(src, q.flag).toContain(`"${q.flag}",`);
  });

  it("uses flags that terminal quest steps actually wait for", async () => {
    const { listRegisteredEpisodes } = await import("@/lib/game/quests");
    const triggers = new Set<string>();
    for (const ep of listRegisteredEpisodes()) {
      for (const step of ep.steps)
        if (step.trigger.kind === "flag") triggers.add(step.trigger.flag);
    }
    const used = WORLD_QUEST_FLAGS.filter((q) => triggers.has(q.flag)).map((q) => q.flag);
    expect(used).toEqual(
      expect.arrayContaining([
        "grid_online",
        "nexus_built",
        "emc_001_online",
        "quantum_pair_online",
        "aic_001_online",
        "sca_001_online",
        "tlp_001_online",
      ]),
    );
  });

  it("derives flags from the world state", () => {
    expect(questFlagsFromWorld(null)).toEqual([]);
    expect(questFlagsFromWorld(snap(poweredState()))).toEqual([]);
    const grid = snap(poweredState(["BAT-001", "NET-001", "MEM-001"]));
    expect(questFlagsFromWorld(grid)).toContain("grid_online");
    const off = poweredState(["BAT-001", "NET-001", "MEM-001"]);
    off.switchedOn["NET-001"] = false;
    expect(questFlagsFromWorld(snap(off))).not.toContain("grid_online");
    const nexus = poweredState(["NXS-01"]);
    nexus.switchedOn["NXS-01"] = false;
    expect(questFlagsFromWorld(snap(nexus))).toContain("nexus_built"); // built is enough
  });
});

describe("world power write-back", () => {
  it("applyDevicePower flips built devices only, idempotently", () => {
    const s = poweredState(["BAT-001"]);
    expect(applyDevicePower(s, "CDC-001", true).status).toBe("absent");
    expect(applyDevicePower(s, "BAT-001", true).status).toBe("unchanged");
    expect(applyDevicePower(s, "BAT-001", false)).toEqual({ status: "switched", on: false });
    expect(isSwitchedOn(s, "BAT-001")).toBe(false);
    expect(s.log.some((e) => e.text.includes("BAT-001 switched off"))).toBe(true);
  });

  it("labSetDevicePower saves the active slot and queues a re-appliable event", () => {
    saveToSlot("slot2", poweredState(["BAT-001"]), { activate: true });
    expect(labSetDevicePower("BAT-001", false).status).toBe("switched");
    expect(loadSlot("slot2")?.switchedOn["BAT-001"]).toBe(false);
    expect(localStorage.getItem(TERMINAL_EVENTS_KEY)).toContain("BAT-001");

    // A stale world copy (still "on") absorbs the event → off again.
    const stale = poweredState(["BAT-001"]);
    const { events, reapplied } = absorbTerminalEvents(stale, "slot2");
    expect(events).toHaveLength(1);
    expect(reapplied).toEqual(["POWER:BAT-001"]);
    expect(isSwitchedOn(stale, "BAT-001")).toBe(false);
  });

  it("is a no-op without a world save", () => {
    expect(labSetDevicePower("BAT-001", true).status).toBe("noworld");
  });
});

describe("labSyncActions facade", () => {
  it("never gates without a world save", async () => {
    expect(await labSyncActions.gate("cdc", ["status"])).toBeNull();
    expect(labSyncActions.isPresent("CDC-001")).toBeNull();
    expect(labSyncActions.questFlags()).toEqual([]);
  });

  it("gates device commands against the active slot", async () => {
    saveToSlot("slot1", poweredState(["BAT-001"]), { activate: true });
    const blocked = await labSyncActions.gate("cdc", ["status"]);
    expect(blocked?.success).toBe(false);
    expect(blocked?.output?.join("\n")).toContain("DEVICE NOT DETECTED");
    expect(await labSyncActions.gate("bat", ["status"])).toBeNull();
    expect(await labSyncActions.gate("ls", [])).toBeNull();
    expect(labSyncActions.isPresent("BAT-001")).toBe(true);
    expect(labSyncActions.isPresent("CDC-001")).toBe(false);
  });

  it("writes a successful terminal power switch back into the world", async () => {
    saveToSlot("slot1", poweredState(["BAT-001"]), { activate: true });
    expect(await labSyncActions.gate("bat", ["power", "off"])).toBeNull();
    const res = await labSyncActions.afterCommand("bat", ["power", "off"], {
      success: true,
      output: ["", "BAT-001 standby", ""],
    });
    expect(loadSlot("slot1")?.switchedOn["BAT-001"]).toBe(false);
    expect(res.output?.join("\n")).toContain("switched OFF in the lab");

    // Failed commands never touch the world.
    await labSyncActions.afterCommand("bat", ["power", "on"], { success: false, error: "x" });
    expect(loadSlot("slot1")?.switchedOn["BAT-001"]).toBe(false);

    // Now switched off: operation is blocked, switching on is allowed.
    expect((await labSyncActions.gate("bat", ["status"]))?.output?.join("\n")).toContain("OFFLINE");
    expect(await labSyncActions.gate("device", ["power", "BAT-001", "on"])).toBeNull();
  });
});

describe("gate: pure intent first, cached snapshot", () => {
  it("parses intents without knowing the lab's devices", () => {
    expect(parseDeviceIntent("cdc", [])).toEqual({ device: "CDC-001", kind: "help" });
    expect(parseDeviceIntent("cdc", ["status"])).toEqual({ device: "CDC-001", kind: "operate" });
    expect(parseDeviceIntent("power", ["on", "bat-001"])).toEqual({
      raw: "bat-001",
      kind: "power-on",
    });
    expect(parseDeviceIntent("device", ["power", "all", "on"])).toBeNull();
    expect(parseDeviceIntent("ls", [])).toBeNull();
  });

  it("needs the snapshot only for device intents other than help/info", () => {
    expect(needsLabSnapshot("ls", ["-la"])).toBe(false);
    expect(needsLabSnapshot("cdc", [])).toBe(false);
    expect(needsLabSnapshot("cdc", ["info"])).toBe(false);
    expect(needsLabSnapshot("power", ["status"])).toBe(false);
    expect(needsLabSnapshot("cdc", ["status"])).toBe(true);
    expect(needsLabSnapshot("bat", ["power", "on"])).toBe(true);
    expect(needsLabSnapshot("power", ["off", "BAT-001"])).toBe(true);
  });

  it("skips the save read for help and non-device commands", async () => {
    saveToSlot("slot1", poweredState(["BAT-001"]), { activate: true });
    await labSyncActions.refresh();
    const before = labSyncActions.snapshot();
    expect(before).not.toBeNull();
    // The save disappears; help/info and plain commands must not re-read it.
    localStorage.clear();
    invalidateLabSnapshot();
    expect(await labSyncActions.gate("cdc", ["help"])).toBeNull();
    expect(await labSyncActions.gate("ls", [])).toBeNull();
    expect(labSyncActions.snapshot()).toBe(before);
    // A device operation does read it (and finds no world → never gates).
    expect(await labSyncActions.gate("cdc", ["status"])).toBeNull();
    expect(labSyncActions.snapshot()).toBeNull();
  });

  it("reuses the snapshot within the TTL and re-reads after it or an invalidation", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    saveToSlot("slot1", poweredState(["BAT-001"]), { activate: true });
    expect(await labSyncActions.gate("bat", ["status"])).toBeNull();
    const first = labSyncActions.snapshot();

    // BAT-001 disappears from the save — the cached snapshot still says built.
    saveToSlot("slot1", poweredState(), { activate: true });
    now += LAB_SNAPSHOT_TTL_MS - 1;
    expect(await labSyncActions.gate("bat", ["status"])).toBeNull();
    expect(labSyncActions.snapshot()).toBe(first);

    // TTL over → re-read → blocked.
    now += 2;
    const blocked = await labSyncActions.gate("bat", ["status"]);
    expect(blocked?.output?.join("\n")).toContain("DEVICE NOT DETECTED");

    // Explicit invalidation also forces a re-read.
    saveToSlot("slot1", poweredState(["BAT-001"]), { activate: true });
    expect(await labSyncActions.gate("bat", ["status"])).not.toBeNull(); // still cached
    invalidateLabSnapshot();
    expect(await labSyncActions.gate("bat", ["status"])).toBeNull();
  });

  it("refreshes after a write so the next gate sees the new power state", async () => {
    let now = 5_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    saveToSlot("slot1", poweredState(["BAT-001"]), { activate: true });
    expect(await labSyncActions.gate("bat", ["off"])).toBeNull();
    await labSyncActions.afterCommand("bat", ["off"], { success: true, output: [] });
    now += 10; // well within the TTL
    expect((await labSyncActions.gate("bat", ["status"]))?.output?.join("\n")).toContain("OFFLINE");
  });
});

// ── Integration with real play ───────────────────────────────────
//
// The tests above use hand-built states. These drive the world with the
// greedy simulated player (real rules: discovery, build stages, power grid)
// and check that the terminal side agrees with the world at every step.

describe("terminal ↔ world along a real playthrough", () => {
  const run = play({ sampleEvery: 1 });
  const states = [initialState(), ...run.samples, run.s];

  it("the playthrough finishes (fixture sanity)", () => {
    expect(run.s.built["UEC-001"]).toBeGreaterThan(0);
    expect(states.length).toBeGreaterThan(10);
  });

  it("device commands pass exactly when the world has the device online", () => {
    const wrong: string[] = [];
    states.forEach((s, i) => {
      const sn = snap(s);
      for (const [cmd, id] of commands) {
        const d = guardDeviceIntent(sn, resolveDeviceIntent(cmd, ["status"], WORLD_IDS));
        if (d.allow !== isOnline(s, id)) wrong.push(`step ${i} ${cmd} → ${id}: allow=${d.allow}`);
        if (!isBuilt(s, id) && !d.allow && !d.lines[0]!.includes("DEVICE NOT DETECTED"))
          wrong.push(`step ${i} ${cmd}: missing device not reported as such`);
      }
    });
    expect(wrong).toEqual([]);
  });

  it("isPresentInLab follows the world's build state", () => {
    for (const s of states) {
      const sn = snap(s);
      for (const d of DEVICES) expect(isPresentInLab(sn, d.id), d.id).toBe(isBuilt(s, d.id));
    }
  });

  it("quest flags are derived from the world at every step (built flags never disappear)", () => {
    const earned = new Set<string>();
    for (const s of states) {
      const flags = questFlagsFromWorld(snap(s));
      for (const q of WORLD_QUEST_FLAGS) {
        const want = q.devices.every((id) =>
          q.state === "online" ? isOnline(s, id) : isBuilt(s, id),
        );
        expect(flags.includes(q.flag), `${q.flag}`).toBe(want);
      }
      for (const f of earned)
        if (WORLD_QUEST_FLAGS.find((q) => q.flag === f)?.state === "built")
          expect(flags, f).toContain(f);
      flags.forEach((f) => earned.add(f));
    }
    // Over the whole game every correspondence is earned at least once.
    expect([...earned].sort()).toEqual(WORLD_QUEST_FLAGS.map((q) => q.flag).sort());
  });

  it("a finished lab: gate, terminal power-off, world save and quest flags stay in sync", async () => {
    const s = structuredClone(run.s);
    saveToSlot("slot3", s, { activate: true });
    // Every online device answers; every command passes the gate.
    for (const [cmd, id] of commands) {
      const res = await labSyncActions.gate(cmd, ["status"]);
      expect(res === null, `${cmd} (${id})`).toBe(isOnline(s, id));
    }
    const grid = WORLD_QUEST_FLAGS.find((q) => q.flag === "grid_online")!;
    const before = labSyncActions.questFlags();
    expect(before.includes("grid_online")).toBe(grid.devices.every((id) => isOnline(s, id)));

    // Switch NET-001 off from the terminal → world save switched → flag gone.
    expect(isOnline(s, "NET-001")).toBe(true);
    const out = await labSyncActions.afterCommand("net", ["power", "off"], {
      success: true,
      output: ["NET-001 standby", ""],
    });
    expect(out.output?.join("\n")).toContain("switched OFF in the lab");
    const saved = loadSlot("slot3")!;
    expect(isSwitchedOn(saved, "NET-001")).toBe(false);
    expect(labSyncActions.questFlags()).not.toContain("grid_online");
    expect((await labSyncActions.gate("net", ["status"]))?.output?.join("\n")).toContain("OFFLINE");

    // … and back on: the world powers it again and the flag returns.
    await labSyncActions.afterCommand("device", ["power", "NET-001", "on"], {
      success: true,
      output: [""],
    });
    const again = loadSlot("slot3")!;
    expect(isSwitchedOn(again, "NET-001")).toBe(true);
    expect(isOnline(again, "NET-001")).toBe(true);
    expect(labSyncActions.questFlags()).toEqual(before);
    expect(await labSyncActions.gate("net", ["status"])).toBeNull();
  });

  it("the world's device panel and the terminal use the same switch", () => {
    const s = structuredClone(run.s);
    toggleDevice(s, "BAT-001"); // world panel: off
    expect(snap(s).devices["BAT-001"]?.presence).toBe("off");
    expect(applyDevicePower(s, "BAT-001", false).status).toBe("unchanged");
    expect(applyDevicePower(s, "BAT-001", true)).toEqual({ status: "switched", on: true });
    expect(snap(s).devices["BAT-001"]?.presence).toBe(
      isOnline(s, "BAT-001") ? "online" : "starved",
    );
  });
});

describe("terminal hints point at real terminal commands", () => {
  it("'labor geraete' / 'labor welt' / 'labor energie' exist in the labor command", () => {
    const src = readFileSync(path.resolve(__dirname, "../../lib/terminal/commands.ts"), "utf8");
    const at = src.indexOf('name: "labor"');
    expect(at).toBeGreaterThan(0);
    const labor = src.slice(at);
    for (const sub of ["geraete", "energie"]) expect(labor, sub).toContain(`case "${sub}":`);
    expect(labor).toContain('sub === "welt"');
    const info = snap(poweredState()).devices["CDC-001"]!;
    const hints = [...notDetectedLines(info), ...offlineLines(info, snap(poweredState()))].join(
      "\n",
    );
    for (const m of hints.matchAll(/'labor ([a-z]+)'/g))
      expect(["geraete", "welt", "energie"], m[1]).toContain(m[1]);
  });
});

describe("the sync is language-independent", () => {
  it("German and English worlds give the same gate decisions and quest flags", async () => {
    const { loadGame } = await import("../world/localeGame");
    const de = await loadGame("de");
    const en = await loadGame("en");
    try {
      const deRun = de.sim.play({ sampleEvery: 3 });
      const enRun = en.sim.play({ sampleEvery: 3 });
      expect(deRun.samples.length).toBe(enRun.samples.length);
      deRun.samples.forEach((s, i) => {
        const a = de.bridge.deviceSnapshot(s, "slot1");
        const b = en.bridge.deviceSnapshot(enRun.samples[i]!, "slot1");
        expect(de.labSync.questFlagsFromWorld(a)).toEqual(en.labSync.questFlagsFromWorld(b));
        for (const id of Object.keys(b.devices)) {
          expect(a.devices[id]?.presence, id).toBe(b.devices[id]?.presence);
          expect(a.devices[id]?.id).toBe(id);
        }
        for (const [cmd] of commands) {
          const ia = de.labSync.resolveDeviceIntent(cmd, ["status"], Object.keys(a.devices));
          const ib = en.labSync.resolveDeviceIntent(cmd, ["status"], Object.keys(b.devices));
          expect(de.labSync.guardDeviceIntent(a, ia).allow).toBe(
            en.labSync.guardDeviceIntent(b, ib).allow,
          );
        }
      });
      // A German world save is read by the (English-first) terminal unchanged.
      localStorage.clear();
      de.save.saveToSlot("slot1", deRun.s, { activate: true });
      expect(en.labSync.questFlagsFromWorld(en.bridge.readLabDeviceSnapshot())).toEqual(
        de.labSync.questFlagsFromWorld(de.bridge.deviceSnapshot(deRun.s, "slot1")),
      );
    } finally {
      de.i18n.__setLocaleForTests(null);
      en.i18n.__setLocaleForTests(null);
    }
  });
});

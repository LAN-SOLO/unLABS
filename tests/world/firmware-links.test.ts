/**
 * Firmware (FIRMWARE-SPEC update protocol in the Lab World) and device hubs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ARCHIVE } from "@/lib/world/archive";
import { MAX_INPUTS, VOLATILITY_LIMIT } from "@/lib/world/combine";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { WORLD_FIRMWARE } from "@/lib/world/content/firmware";
import { ITEM_BY_ID, RECIPES } from "@/lib/world/content/items";
import { HUBS } from "@/lib/world/content/links";
import { PICKUPS } from "@/lib/world/content/map";
import { ROOM_TERMINALS } from "@/lib/world/content/terminals";
import {
  canLink,
  flashFirmware,
  hubCapacity,
  linkDevice,
  remoteToggle,
  rollbackFirmware,
  unlinkDevice,
  updateCheck,
} from "@/lib/world/device-ops";
import {
  FIRMWARE,
  FW_TUNING,
  UPDATED_DRAW,
  compareVersion,
  hasFeature,
  installedVersion,
  isUpdated,
} from "@/lib/world/firmware";
import {
  DRONE_COOLDOWN,
  RESEARCH_COOLDOWN,
  RESEARCH_PER_CYCLE,
  addItem,
  checkStage,
  count,
  deviceReadout,
  disassemble,
  doCombine,
  droneCooldown,
  evalCond,
  fabricate,
  initialState,
  isOnline,
  isProtected,
  pickupRespawnSeconds,
  power,
  researchCooldown,
  researchPerCycle,
} from "@/lib/world/game";
import type { Condition, WorldState } from "@/lib/world/types";

/** A lab with every device fully built and plenty of power. */
function lab(): WorldState {
  const s = initialState();
  for (const d of DEVICES) s.built[d.id] = d.stages.length;
  s.flags.geo_routed = true;
  s.counters.proto_puffer = 10_000;
  return s;
}

describe("firmware manifests", () => {
  it("every device has a manifest (docs + MCP-000)", () => {
    for (const d of DEVICES) expect(FIRMWARE.has(d.id), d.id).toBe(true);
  });

  it("world updates belong to known devices and are complete", () => {
    for (const [id, w] of Object.entries(WORLD_FIRMWARE)) {
      const m = FIRMWARE.get(id);
      expect(m, id).toBeDefined();
      expect(m!.update, `${id}: needs an update image (docs or world)`).toBeDefined();
      expect(compareVersion(m!.update!.version, m!.factory.version), id).toBeGreaterThan(0);
      expect(w.unlock.tag).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(m!.factory.features, `${id}: new feature tag`).not.toContain(w.unlock.tag);
      expect(w.changelog.length, id).toBeGreaterThan(0);
    }
  });

  it("every manual image's checksum can be found in the lab", () => {
    const texts = [
      ...ARCHIVE.map((e) => e.text),
      ...ROOM_TERMINALS.flatMap((t) => [
        ...(t.files ?? []).flatMap((f) => f.body),
        ...(t.mail ?? []).flatMap((m) => m.body),
      ]),
    ].join("\n");
    for (const [id, w] of Object.entries(WORLD_FIRMWARE)) {
      if (w.source !== "manual") continue;
      expect(
        texts.includes(FIRMWARE.get(id)!.update!.checksum),
        `${id}: checksum hidden somewhere`,
      ).toBe(true);
    }
  });

  it("compares versions", () => {
    expect(compareVersion("2.10.0", "2.9.9")).toBe(1);
    expect(compareVersion("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersion("0.9.7", "1.0.0")).toBe(-1);
  });
});

describe("flashing", () => {
  it("a manual image needs the right checksum; rollback restores the factory image", () => {
    const s = lab();
    const net = FIRMWARE.get("NET-001")!;
    expect(isOnline(s, "NET-001")).toBe(true);
    expect(updateCheck(s, "NET-001").ok).toBe(true);
    expect(flashFirmware(s, "NET-001", "00000000").ok).toBe(false);
    expect(isUpdated(s, "NET-001")).toBe(false);
    expect(flashFirmware(s, "NET-001", net.update!.checksum.toLowerCase()).ok).toBe(true);
    expect(installedVersion(s, "NET-001")).toBe(net.update!.version);
    expect(hasFeature(s, "NET-001", "fw-mirror")).toBe(true);
    expect(evalCond(s, { firmware: "NET-001", min: net.update!.version })).toBe(true);
    expect(rollbackFirmware(s, "NET-001").ok).toBe(true);
    expect(installedVersion(s, "NET-001")).toBe(net.factory.version);
    expect(hasFeature(s, "NET-001", "fw-mirror")).toBe(false);
  });

  it("offline devices cannot be flashed", () => {
    const s = lab();
    s.switchedOn["NET-001"] = false;
    expect(updateCheck(s, "NET-001").ok).toBe(false);
  });

  it("net images need the mirror and a link", () => {
    const s = lab();
    const netDev = Object.entries(WORLD_FIRMWARE).find(([, w]) => w.source === "net")?.[0];
    if (!netDev) return;
    expect(updateCheck(s, netDev).ok).toBe(false);
    flashFirmware(s, "NET-001", FIRMWARE.get("NET-001")!.update!.checksum);
    linkDevice(s, "NET-001", netDev);
    expect(updateCheck(s, netDev).ok).toBe(true);
  });
});

describe("links", () => {
  it("hubs are devices with sane capacities", () => {
    for (const h of HUBS) {
      expect(
        DEVICES.some((d) => d.id === h.id),
        h.id,
      ).toBe(true);
      expect(h.capacity).toBeGreaterThan(0);
    }
  });

  it("link rules: online hub, complete device, one hub per bus, capacity", () => {
    const s = lab();
    expect(linkDevice(s, "NET-001", "CPU-001").ok).toBe(true);
    expect(canLink(s, "NET-001", "CPU-001").ok).toBe(false); // already
    expect(canLink(s, "NET-001", "NET-001").ok).toBe(false); // itself
    expect(evalCond(s, { link: "NET-001", to: "CPU-001" })).toBe(true);
    const cap = HUBS.find((h) => h.id === "PWR-001")!.capacity;
    const cands = DEVICES.map((d) => d.id).filter((id) => canLink(s, "PWR-001", id).ok);
    for (const id of cands.slice(0, cap)) expect(linkDevice(s, "PWR-001", id).ok).toBe(true);
    if (cands.length > cap) expect(canLink(s, "PWR-001", cands[cap]!).ok).toBe(false);
    expect(unlinkDevice(s, "NET-001", "CPU-001").ok).toBe(true);
    expect(s.links["NET-001"]).toBeUndefined();
    s.switchedOn["PWR-001"] = false;
    expect(canLink(s, "PWR-001", "CPU-001").ok).toBe(false);
  });

  it("remote switching from admin / power hubs", () => {
    const s = lab();
    linkDevice(s, "MCP-000", "CLK-001");
    expect(remoteToggle(s, "MCP-000", "CLK-001").ok).toBe(true);
    expect(isOnline(s, "CLK-001")).toBe(false);
    expect(remoteToggle(s, "NET-001", "CLK-001").ok).toBe(false);
  });

  it("PWR-001 priority circuits are served first in a brownout", () => {
    const s = lab();
    s.counters.proto_puffer = 0;
    const p0 = power(s);
    const starved = p0.starved.find((x) => x.reason === "strom");
    if (!starved) return; // enough power today — nothing to prioritise
    linkDevice(s, "PWR-001", starved.id);
    expect(power(s).online.has(starved.id)).toBe(true);
  });
});

// ── Feature effects ──────────────────────────────────────────────

/** Install a device's lab update directly (effects are tested, not the flashing). */
function update(s: WorldState, id: string): void {
  s.firmware[id] = FIRMWARE.get(id)!.update!.version;
}

const RULE_SOURCES = ["lib/world/game.ts", "lib/world/device-ops.ts", "lib/world/firmware.ts"]
  .map((f) => readFileSync(resolve(process.cwd(), f), "utf8"))
  .join("\n");

describe("lab updates: content", () => {
  it("20+ devices get an update, with a mix of sources", () => {
    const n = (src: string) => Object.values(WORLD_FIRMWARE).filter((w) => w.source === src).length;
    expect(Object.keys(WORLD_FIRMWARE).length).toBeGreaterThanOrEqual(20);
    expect(n("manual")).toBeGreaterThanOrEqual(4);
    expect(n("net")).toBeGreaterThanOrEqual(5);
    expect(n("mcp")).toBeGreaterThanOrEqual(5);
  });

  it("every unlock has a real rule: its tag or its draw is used by the game code", () => {
    for (const [id, w] of Object.entries(WORLD_FIRMWARE)) {
      const inRules = RULE_SOURCES.includes(`"${w.unlock.tag}"`);
      expect(inRules || UPDATED_DRAW[id] !== undefined, `${id}: ${w.unlock.tag}`).toBe(true);
    }
  });

  it("manual checksums are written as “<ID> · … · CRC <checksum>” on one line", () => {
    for (const [id, w] of Object.entries(WORLD_FIRMWARE)) {
      if (w.source !== "manual") continue;
      const sum = FIRMWARE.get(id)!.update!.checksum;
      const line = ARCHIVE.flatMap((e) => e.text.split("\n")).find(
        (l) => l.includes(id) && l.includes(`CRC ${sum}`),
      );
      expect(line, id).toBeDefined();
    }
  });

  it("mcp and net images need their hub", () => {
    const s = lab();
    flashFirmware(s, "NET-001", FIRMWARE.get("NET-001")!.update!.checksum);
    for (const [id, w] of Object.entries(WORLD_FIRMWARE)) {
      if (w.source === "manual") continue;
      const hub = w.source === "net" ? "NET-001" : "MCP-000";
      expect(updateCheck(s, id).ok, `${id} unlinked`).toBe(false);
      expect(linkDevice(s, hub, id).ok, `${id} link`).toBe(true);
      expect(updateCheck(s, id).ok, `${id} linked`).toBe(true);
      expect(flashFirmware(s, id).ok, id).toBe(true);
      unlinkDevice(s, hub, id);
    }
  });
});

describe("lab updates: effects", () => {
  it("lowered draws, fusion output and the battery buffer", () => {
    for (const [id, w] of Object.entries(UPDATED_DRAW)) {
      const a = lab();
      const b = lab();
      update(b, id);
      const d = DEVICE_BY_ID.get(id)!.power;
      expect(power(a).demand - power(b).demand, id).toBeCloseTo(d - w, 5);
    }
    const a = lab();
    const b = lab();
    update(b, "MFR-001");
    update(b, "BAT-001");
    expect(power(b).generation - power(a).generation).toBe(
      FW_TUNING.fusionOutput - 250 + FW_TUNING.batteryBuffer - 40,
    );
  });

  it("the THM-001 cooling loop lowers linked draw (more with the loop balancer)", () => {
    const s = lab();
    const base = power(s).demand;
    expect(linkDevice(s, "THM-001", "TLP-001").ok).toBe(true);
    const tlp = DEVICE_BY_ID.get("TLP-001")!.power;
    expect(base - power(s).demand).toBeCloseTo(tlp * (1 - FW_TUNING.thermalLink), 5);
    update(s, "THM-001");
    expect(base - power(s).demand).toBeCloseTo(tlp * (1 - FW_TUNING.thermalLinkBalanced), 5);
  });

  it("drone, research and refill timings", () => {
    const s = lab();
    expect(droneCooldown(s)).toBe(DRONE_COOLDOWN);
    update(s, "EXD-001");
    expect(droneCooldown(s)).toBe(FW_TUNING.droneCooldown);

    expect(researchPerCycle(s)).toBe(RESEARCH_PER_CYCLE);
    update(s, "NXS-01");
    expect(researchPerCycle(s)).toBe(RESEARCH_PER_CYCLE + FW_TUNING.researchBonus);
    linkDevice(s, "SCA-001", "AIC-001");
    linkDevice(s, "SCA-001", "QAN-001");
    expect(researchPerCycle(s)).toBe(RESEARCH_PER_CYCLE + FW_TUNING.researchBonus + 2);
    expect(researchCooldown(s)).toBe(RESEARCH_COOLDOWN);
    update(s, "AIC-001");
    expect(researchCooldown(s)).toBe(FW_TUNING.researchCooldown);

    const p = PICKUPS.find((x) => x.respawn && x.id !== "p_geo_seep")!;
    const before = pickupRespawnSeconds(s, p);
    update(s, "CLK-001");
    expect(pickupRespawnSeconds(s, p)).toBeCloseTo(before * FW_TUNING.respawnFactor, 5);
  });

  it("BTK-001 torque profiles: two-part assemblies come apart without loss", () => {
    const r = RECIPES.find(
      (x) =>
        x.count === 1 &&
        !isProtected(x.output) &&
        Object.values(x.inputs).reduce((m, n) => m + n, 0) === 2 &&
        RECIPES.filter((y) => y.output === x.output && y.count === 1)[0] === x,
    )!;
    const a = lab();
    const b = lab();
    update(b, "BTK-001");
    for (const s of [a, b]) addItem(s, r.output, 1);
    expect(disassemble(a, r.output).returned).toHaveLength(1);
    expect(disassemble(b, r.output).returned).toHaveLength(2);
  });

  it("P3D-001 purge saver: every third print is free", () => {
    const part = [...ITEM_BY_ID.values()].find((d) => d.kind === "bauteil")!;
    const s = lab();
    update(s, "P3D-001");
    s.flags[`held_${part.id}`] = true;
    addItem(s, "basislegierung", 3);
    for (let i = 0; i < 3; i++) expect(fabricate(s, part.id).ok).toBe(true);
    expect(count(s, "basislegierung")).toBe(3 - (FW_TUNING.freePrintEvery - 1));
  });

  it("EMC-001 breach guard: an explosion spares one input part", () => {
    const hot = [...ITEM_BY_ID.values()]
      .filter((d) => !isProtected(d.id) && d.kind !== "relikt" && d.kind !== "verbrauch")
      .sort((x, y) => y.volatility - x.volatility)[0]!;
    const n = Math.min(MAX_INPUTS, Math.floor(VOLATILITY_LIMIT / hot.volatility) + 1);
    const run = (withGuard: boolean) => {
      const s = lab();
      if (withGuard) update(s, "EMC-001");
      addItem(s, hot.id, n);
      const r = doCombine(s, { [hot.id]: n });
      return { kind: r.kind, left: count(s, hot.id) };
    };
    const a = run(false);
    if (a.kind !== "explosion") return; // no single-item explosion in this content
    expect(run(true).left - a.left).toBe(1);
  });

  it("readouts: MSC batch scan, CDC slice cache, MEM leak trace, DGN probes, NET remote readouts", () => {
    const s = lab();
    const msc = deviceReadout(s, "MSC-001").length;
    update(s, "MSC-001");
    expect(deviceReadout(s, "MSC-001").length).toBe(msc + 1);
    const cdc = deviceReadout(s, "CDC-001").length;
    update(s, "CDC-001");
    expect(deviceReadout(s, "CDC-001").length).toBe(cdc + 1);
    const mem = deviceReadout(s, "MEM-001").length;
    update(s, "MEM-001");
    expect(deviceReadout(s, "MEM-001").length).toBe(mem + 1);
    const dgn = deviceReadout(s, "DGN-001").length;
    linkDevice(s, "DGN-001", "TLP-001");
    expect(deviceReadout(s, "DGN-001").length).toBe(dgn + 1);
    update(s, "DGN-001");
    expect(deviceReadout(s, "DGN-001").length).toBeGreaterThan(dgn + 1);
    const net = deviceReadout(s, "NET-001").length;
    linkDevice(s, "NET-001", "UEC-001");
    expect(deviceReadout(s, "NET-001").length).toBe(net + 1);
  });

  it("PWR-001 fusion sequencer adds two priority circuits", () => {
    const s = lab();
    const cap = HUBS.find((h) => h.id === "PWR-001")!.capacity;
    expect(hubCapacity(s, "PWR-001")).toBe(cap);
    update(s, "PWR-001");
    expect(hubCapacity(s, "PWR-001")).toBe(cap + FW_TUNING.extraCircuits);
  });
});

// ── Mandatory gates ──────────────────────────────────────────────

/** Link / firmware conditions in build stages: [device, stage index, condition]. */
function gates(): [string, number, Condition][] {
  const out: [string, number, Condition][] = [];
  const walk = (id: string, i: number, c: Condition | undefined): void => {
    if (!c) return;
    if ("all" in c) c.all.forEach((x) => walk(id, i, x));
    else if ("link" in c || "firmware" in c) out.push([id, i, c]);
  };
  for (const d of DEVICES) d.stages.forEach((st, i) => walk(d.id, i, st.when));
  return out;
}

/** Devices always built before `id` (transitive `needs`). */
function before(id: string, seen = new Set<string>()): Set<string> {
  for (const n of DEVICE_BY_ID.get(id)?.needs ?? []) {
    if (seen.has(n)) continue;
    seen.add(n);
    before(n, seen);
  }
  return seen;
}

describe("mandatory gates", () => {
  it("3–4 gates on the main path, each explained in-world", () => {
    const g = gates();
    expect(g.length).toBeGreaterThanOrEqual(3);
    expect(g.length).toBeLessThanOrEqual(4);
    for (const [id, i] of g) expect(DEVICE_BY_ID.get(id)!.stages[i]!.whenHint, id).toBeTruthy();
  });

  it("everything a gate needs is built earlier in the natural build order", () => {
    for (const [id, , c] of gates()) {
      const earlier = before(id);
      if ("link" in c) {
        expect(earlier.has(c.link) || c.link === "MCP-000", `${id}: hub ${c.link}`).toBe(true);
        expect(earlier.has(c.to), `${id}: ${c.to}`).toBe(true);
      }
      if ("firmware" in c) {
        expect(earlier.has(c.firmware), `${id}: ${c.firmware}`).toBe(true);
        const w = WORLD_FIRMWARE[c.firmware]!;
        expect(w, c.firmware).toBeDefined();
        expect(
          compareVersion(FIRMWARE.get(c.firmware)!.update!.version, c.min),
        ).toBeGreaterThanOrEqual(0);
        if (w.source === "net") expect(earlier.has("NET-001"), `${id}: NET-001`).toBe(true);
      }
    }
  });

  it("a gated stage is blocked with its hint until the link / firmware is in place", () => {
    for (const [id, i, c] of gates()) {
      const s = lab();
      s.built[id] = i;
      const hint = DEVICE_BY_ID.get(id)!.stages[i]!.whenHint!;
      expect(checkStage(s, id)!.blockers, id).toContain(hint);
      if ("link" in c) expect(linkDevice(s, c.link, c.to).ok, `${id}: link`).toBe(true);
      if ("firmware" in c) update(s, c.firmware);
      expect(checkStage(s, id)!.blockers, id).not.toContain(hint);
    }
  });
});

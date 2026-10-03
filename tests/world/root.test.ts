/**
 * Root lab (docs/ROOT-LAB.md): rings, sysctl, firmware tuning, cron,
 * profiles and how the room terminals / Main Console reach them.
 */
import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { hasFeature } from "@/lib/world/firmware";
import { initialState, isOnline, power, researchPerCycle, tunedDraw } from "@/lib/world/game";
import { sanitizeSave } from "@/lib/world/save-sanitize";
import { promptFor, ringMissing } from "@/lib/world/root/access";
import { rootTick, runJob } from "@/lib/world/root/cron";
import { applyRootOp, heatOf, isStable, kernelLoad, thermalLimit } from "@/lib/world/root/model";
import {
  autotune,
  exportProfile,
  importProfile,
  parseCronLine,
  runRoot,
  runRootLine,
} from "@/lib/world/root/shell";
import { initialRoot, sanitizeRoot, type Ring } from "@/lib/world/root/state";
import { applyTerminalEffects, runCommand } from "@/lib/world/terminal-lite";
import type { WorldState } from "@/lib/world/types";

/** Every device built and switched on; geothermal routed. */
function lab(ring: Ring = 0): WorldState {
  const s = initialState();
  s.flags.geo_routed = true;
  for (const d of DEVICES) {
    s.built[d.id] = d.stages.length;
    s.discovered[d.id] = true;
  }
  s.root.ring = ring;
  return s;
}

/** Run a root line and apply its ops like a terminal would. */
function exec(s: WorldState, line: string): string[] {
  const r = runRootLine(s, line);
  if (!r) throw new Error(`not a root command: ${line}`);
  for (const op of r.ops) applyRootOp(s, op, "test");
  return r.lines;
}

describe("root lab · rings", () => {
  it("starts as operator and lists what the next ring needs", () => {
    const s = initialState();
    expect(s.root.ring).toBe(0);
    const r = runRoot(s, "su", []);
    expect(r.ops).toEqual([]);
    expect(ringMissing(s, 1).length).toBeGreaterThan(0);
  });

  it("climbs one ring at a time once the MCP is satisfied", () => {
    const s = lab();
    s.flags.terminal_term_mcp_used = true;
    s.flags.terminal_term_archiv_used = true;
    expect(isOnline(s, "DGN-001")).toBe(true);
    expect(runRoot(s, "su", ["kernel"]).ops).toEqual([]);
    exec(s, "su");
    expect(s.root.ring).toBe(1);
    exec(s, "su");
    expect(s.root.ring).toBe(2);
    exec(s, "su operator");
    expect(s.root.ring).toBe(0);
  });

  it("prompt follows the ring", () => {
    expect(promptFor(0, "lab")).toBe("jade@lab:~$");
    expect(promptFor(2, "lab")).toBe("root@lab:~#");
    expect(promptFor(3, "lab")).toBe("kernel@lab:~#");
  });
});

describe("root lab · sysctl", () => {
  it("reads at any ring, writes only from the tunable's ring", () => {
    const s = lab(0);
    expect(runRoot(s, "sysctl", ["-a"]).lines.join("\n")).toContain("research.cooldown");
    expect(runRoot(s, "sysctl", ["research.cooldown=70"]).ops).toEqual([]);
    s.root.ring = 1;
    expect(runRoot(s, "sysctl", ["research.cooldown=70"]).ops).toHaveLength(1);
    expect(runRoot(s, "sysctl", ["research.cooldown=20"]).ops).toEqual([]);
    s.root.ring = 3;
    expect(runRoot(s, "sysctl", ["research.cooldown=30"]).ops).toHaveLength(1);
  });

  it("every tweak is paid for in kernel load on the MCP-000", () => {
    const s = lab(2);
    const before = tunedDraw(s, "MCP-000");
    exec(s, "sysctl research.yield=2");
    expect(researchPerCycle(s)).toBeGreaterThanOrEqual(2);
    expect(kernelLoad(s)).toBe(12);
    expect(tunedDraw(s, "MCP-000")).toBeCloseTo(before + 12, 5);
    exec(s, "sysctl reset research.yield");
    expect(kernelLoad(s)).toBe(0);
  });
});

describe("root lab · firmware tuning", () => {
  it("an overclocked core generates more, an undervolted one browns out", () => {
    const s = lab(2);
    const base = power(s).generation;
    exec(s, "fw UEC-001 110 105");
    expect(power(s).generation).toBeGreaterThan(base);
    exec(s, "fw OSC-001 125 100");
    expect(power(s).starved.some((x) => x.id === "OSC-001")).toBe(true);
    exec(s, "rescue --yes");
    expect(s.root.fw).toEqual({});
  });

  it("dry runs change nothing; the MCP core is untouchable", () => {
    const s = lab(2);
    expect(runRoot(s, "fw", ["UEC-001", "110", "105", "--dry"]).ops).toEqual([]);
    expect(runRoot(s, "fw", ["MCP-000", "120"]).ops).toEqual([]);
    expect(runRoot(s, "fw", ["UEC-001", "150", "125"]).ops).toEqual([]); // kernel range only
  });

  it("underclocking below 90 % drops the update features", () => {
    const s = lab(2);
    s.firmware["BAT-001"] = "9.9.9";
    const had = hasFeature(s, "BAT-001", "fast-charge");
    exec(s, "fw BAT-001 profile eco");
    expect(hasFeature(s, "BAT-001", "fast-charge")).toBe(false);
    exec(s, "fw BAT-001 reset");
    expect(hasFeature(s, "BAT-001", "fast-charge")).toBe(had);
  });

  it("autotune finds a stable setting under the thermal limit", () => {
    const s = lab(3);
    for (const mode of ["perf", "eco"] as const) {
      const f = autotune(s, "AIC-001", mode, 3)!;
      expect(f).not.toBeNull();
      expect(isStable(f)).toBe(true);
      expect(heatOf(f)).toBeLessThanOrEqual(thermalLimit(s, false) + 1e-9);
    }
    expect(autotune(s, "AIC-001", "perf", 3)!.clock).toBeGreaterThan(100);
  });
});

describe("root lab · cron", () => {
  it("parses guards and refuses interactive commands", () => {
    expect(parseCronLine("when balance<0 profile load eco")).toMatchObject({
      guard: { metric: "balance", cmp: "<", value: 0 },
    });
    expect("error" in parseCronLine("su root")).toBe(true);
    expect("error" in parseCronLine("when bogus>1 fw X reset")).toBe(true);
  });

  it("runs due jobs with the creator's ring and audits them as cron#id", () => {
    const s = lab(2);
    exec(s, "cron add 30 when starved>=0 sysctl research.cooldown=70");
    expect(s.root.cron).toHaveLength(1);
    expect(rootTick(s)).toEqual([]);
    s.playTime += 30;
    const ev = rootTick(s);
    expect(ev).toHaveLength(1);
    expect(s.root.sysctl["research.cooldown"]).toBe(70);
    expect(s.root.audit.at(-1)?.via).toBe("cron#1");
    // Idempotent: the next run changes nothing.
    s.playTime += 30;
    expect(rootTick(s)).toEqual([]);
  });

  it("switches relays from wheel up, never above Jade's current ring", () => {
    const s = lab(1);
    exec(s, "cron add 10 switch OSC-001 off");
    s.playTime += 10;
    runJob(s, 1);
    expect(s.switchedOn["OSC-001"]).toBe(false);
    s.root.ring = 0;
    s.switchedOn["OSC-001"] = true;
    runJob(s, 1);
    expect(s.switchedOn["OSC-001"]).toBe(true);
  });
});

describe("root lab · profiles and saves", () => {
  it("share codes round-trip and reject tampering", () => {
    const p = { sysctl: { "research.cooldown": 70 }, fw: { "UEC-001": { clock: 110, volt: 105 } } };
    const code = exportProfile(p);
    expect(importProfile(code, 2)).toEqual(p);
    expect(importProfile(code.slice(0, -1) + "x", 2)).toBeNull();
    // Clamped to the importer's ring: wheel may not flash firmware.
    expect(importProfile(code, 1)).toEqual({ sysctl: { "research.cooldown": 70 }, fw: {} });
  });

  it("save, load and survive the sanitiser", () => {
    const s = lab(2);
    exec(s, "fw UEC-001 110 105");
    exec(s, "profile save boost");
    exec(s, "fw UEC-001 reset");
    exec(s, "profile load boost");
    expect(s.root.fw["UEC-001"]).toEqual({ clock: 110, volt: 105 });
    const back = sanitizeRoot(JSON.parse(JSON.stringify(s.root)));
    expect(back).toEqual(s.root);
    expect(sanitizeRoot("junk")).toEqual(initialRoot());
  });

  it("migrates a v9 save to v10 with an operator root", () => {
    const raw = JSON.parse(JSON.stringify(initialState())) as Record<string, unknown>;
    delete raw.root;
    raw.version = 9;
    const res = sanitizeSave(raw);
    expect(res.state?.root).toEqual(initialRoot());
  });
});

describe("root lab · terminals", () => {
  it("room terminals run the root shell and apply its ops", () => {
    const s = lab(2);
    const res = runCommand(s, "fw UEC-001 110 105", { terminalId: "term_mcp" });
    expect(res.effects?.actions?.[0]).toMatchObject({ kind: "root" });
    const extra = applyTerminalEffects(s, res.effects, "term_mcp");
    expect(s.root.fw["UEC-001"]).toEqual({ clock: 110, volt: 105 });
    expect(extra.join("\n")).toMatch(/\d+ W/);
  });

  it("sudo works once Jade is in wheel (and reaches relays from any console)", () => {
    const s = lab(0);
    expect(
      runCommand(s, "sudo switch OSC-001 off", { terminalId: "term_kantine" }).effects?.actions,
    ).toBeUndefined();
    s.root.ring = 1;
    const res = runCommand(s, "sudo switch OSC-001 off", { terminalId: "term_kantine" });
    expect(res.effects?.actions?.[0]).toMatchObject({
      kind: "toggle",
      device: "OSC-001",
      on: false,
    });
  });
});

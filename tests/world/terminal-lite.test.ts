/**
 * Room terminals — mini shell output, gating, purity and placements.
 */
import { describe, expect, it } from "vitest";
import { __setLocaleForTests } from "@/lib/i18n";
import { interiorFor, placementRect } from "@/lib/world/content/interior";
import { NOTES, roomAt } from "@/lib/world/content/map";
import {
  ROOM_TERMINALS,
  ROOM_TERMINAL_SIZE,
  roomTerminalModel,
  roomTerminalScreen,
} from "@/lib/world/content/terminals";
import { initialState, isOnline } from "@/lib/world/game";
import { ELEVATOR_AREA, buildFloor, interactableZones } from "@/lib/world/layout";
import { MODEL_SCALE } from "@/lib/world/models/core";
import { objectiveSections } from "@/lib/world/quests";
import { SCREEN_COLOR } from "@/lib/world/screen-content";
import {
  COMMANDS,
  applyTerminalEffects,
  completeInput,
  runCommand,
  terminalBanner,
  terminalUsable,
  terminalUsedFlag,
} from "@/lib/world/terminal-lite";
import type { FloorId, WorldState } from "@/lib/world/types";

function text(s: WorldState, input: string, terminalId?: string): string {
  return runCommand(s, input, terminalId ? { terminalId } : {}).lines.join("\n");
}

function powered(): WorldState {
  const s = initialState();
  s.flags.geo_routed = true;
  s.built["PWR-001"] = 99;
  return s;
}

describe("terminal-lite commands", () => {
  it("help lists every visible command", () => {
    const out = text(initialState(), "help");
    for (const c of COMMANDS.filter((x) => !x.hidden)) expect(out).toContain(c.name);
    expect(out).not.toContain("sudo");
  });

  it("status and power reflect the power grid", () => {
    const cold = initialState();
    expect(text(cold, "status")).toContain("0 W generated");
    expect(text(cold, "power")).toContain("(none)");
    const s = powered();
    const e = text(s, "power");
    expect(text(s, "energie")).toBe(e); // German alias
    expect(e).toContain("Geothermal tap");
    expect(e).toContain("+50 W");
    expect(e).toContain("PWR-001");
    expect(text(s, "status")).toMatch(/1\d\d W generated/);
  });

  it("devices lists known devices per floor and validates the floor", () => {
    const s = initialState();
    const here = text(s, "devices");
    expect(here).toContain("MCP-000");
    expect(here).toMatch(/STAGE 1\/\d/);
    expect(text(s, "devices all")).toContain("unknown signature");
    expect(text(s, "geraete alle")).toBe(text(s, "devices all")); // German alias + argument
    expect(text(s, "devices l-1")).toContain("Power");
    expect(text(s, "devices e-1")).toBe(text(s, "devices l-1"));
    expect(text(s, "devices e9")).toContain("unknown level");
  });

  it("objectives mirrors the objective tracker", () => {
    const s = initialState();
    const out = text(s, "objectives");
    for (const sec of objectiveSections(s)) expect(out).toContain(sec.title.toUpperCase());
    expect(text(s, "aufträge")).toBe(out);
  });

  it("scan needs the Material Scanner online", () => {
    const s = powered();
    s.floor = 3;
    s.pos = [100, 1, 34];
    expect(text(s, "scan")).toContain("No scanner");
    s.built["MSC-001"] = 99;
    expect(isOnline(s, "MSC-001")).toBe(true);
    const out = text(s, "scan");
    expect(out).toContain("MSC-001");
    expect(out).toContain("Cryo Sample");
  });

  it("room, map, journal, log, bots, mcp, whoami, date work in the cold start", () => {
    const s = initialState();
    expect(text(s, "room", "term_mcp")).toContain("MCP Chamber");
    const map = text(s, "map", "term_mcp");
    expect(text(s, "karte", "term_mcp")).toBe(map);
    expect(map).toContain("@");
    expect(map).toContain("T");
    expect(map).toContain("◄ here");
    expect(text(s, "journal")).toContain("empty");
    expect(text(s, "log")).toContain("Cold start");
    expect(text(s, "bots")).toContain("ASLEEP");
    expect(text(s, "mcp")).toMatch(/^MCP> /);
    expect(text(s, "whoami")).toMatch(/^jade/);
    const d = runCommand(s, "date", { now: new Date(2026, 8, 27, 9, 8, 7) }).lines;
    expect(d[0]).toContain("03:41");
    expect(d.at(-1)).toBe("09/27/2026 09:08:07");
  });

  it("cat only shows notes that were read", () => {
    const s = initialState();
    const n = NOTES[0]!;
    expect(text(s, `cat ${n.id}`)).toContain("not found");
    s.read[n.id] = true;
    expect(text(s, `cat ${n.id}`)).toContain(n.title);
    expect(text(s, "notes")).toContain(n.id);
  });

  it("has the easter eggs and refuses sudo", () => {
    const s = initialState();
    expect(text(s, "sudo rm -rf /")).toContain("MCP> No.");
    expect(text(s, "847")).toContain("847 windings");
    expect(text(s, "halo")).toContain("_ _ _ _");
    expect(text(s, "gibtsnicht")).toContain("command not found");
  });

  it("returns effects for clear, exit and the big terminal", () => {
    const cold = initialState();
    expect(runCommand(cold, "clear").effects?.clear).toBe(true);
    expect(runCommand(cold, "exit").effects?.close).toBe(true);
    expect(runCommand(cold, "unos").effects?.openBigTerminal).toBeUndefined();
    expect(runCommand(powered(), "terminal").effects?.openBigTerminal).toBe(true);
  });

  it("never mutates the state; flags go through applyTerminalEffects", () => {
    const s = powered();
    s.read[NOTES[0]!.id] = true;
    const before = JSON.stringify(s);
    for (const c of COMMANDS)
      runCommand(s, `${c.name} ${NOTES[0]!.id}`, { terminalId: "term_mcp" });
    expect(JSON.stringify(s)).toBe(before);
    const r = runCommand(s, "status", { terminalId: "term_mcp" });
    expect(r.effects?.flags).toEqual([terminalUsedFlag("term_mcp")]);
    applyTerminalEffects(s, { flags: [...(r.effects?.flags ?? []), "deep_access"] });
    expect(s.flags[terminalUsedFlag("term_mcp")]).toBe(true);
    expect(s.flags.deep_access).toBeUndefined();
    expect(runCommand(s, "status", { terminalId: "term_mcp" }).effects).toBeUndefined();
  });

  it("completes commands and arguments", () => {
    const s = initialState();
    expect(completeInput(s, "pow").value).toBe("power ");
    expect(completeInput(s, "ene").value).toBe("energie ");
    const multi = completeInput(s, "s");
    expect(multi.options).toEqual(expect.arrayContaining(["status", "scan"]));
    expect(multi.options).not.toContain("sudo");
    s.read.n_wake = true;
    expect(completeInput(s, "cat n_wa").value).toBe("cat n_wake ");
    expect(completeInput(s, "devices al").value).toBe("devices all ");
  });

  it("prints a banner and gates terminals by their condition", () => {
    const cold = initialState();
    expect(terminalBanner(cold, "term_mcp").join("\n")).toContain("help");
    expect(terminalUsable(cold, "term_mcp")).toBe(true);
    expect(terminalUsable(cold, "term_archiv")).toBe(false);
    expect(terminalUsable(powered(), "term_archiv")).toBe(true);
    expect(terminalUsable(cold, "nope")).toBe(false);
  });
});

describe("terminal-lite in German", () => {
  it("prints the German texts; English and German command names both work", () => {
    __setLocaleForTests("de");
    try {
      const s = initialState();
      expect(text(s, "help")).toContain("verfügbare Befehle");
      expect(text(s, "hilfe")).toBe(text(s, "help"));
      expect(text(s, "schalte")).toContain("Beispiel: schalte RMG-001 aus");
      expect(text(s, "gibtsnicht")).toContain("Befehl nicht gefunden");
      const d = runCommand(s, "date", { now: new Date(2026, 8, 27, 9, 8, 7) }).lines;
      expect(d.at(-1)).toBe("27.09.2026 09:08:07");
    } finally {
      __setLocaleForTests(null);
    }
  });
});

describe("room terminal placements", () => {
  type R = { x0: number; z0: number; x1: number; z1: number };
  const overlaps = (a: R, b: R, m = 0) =>
    a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;

  function rectOf(t: (typeof ROOM_TERMINALS)[number]): R {
    const odd = (t.rot ?? 0) % 2 === 1;
    const w = (odd ? ROOM_TERMINAL_SIZE.d : ROOM_TERMINAL_SIZE.w) * MODEL_SCALE;
    const d = (odd ? ROOM_TERMINAL_SIZE.w : ROOM_TERMINAL_SIZE.d) * MODEL_SCALE;
    return {
      x0: t.x + 0.5 - w / 2,
      z0: t.z + 0.5 - d / 2,
      x1: t.x + 0.5 + w / 2,
      z1: t.z + 0.5 + d / 2,
    };
  }

  it("has unique ids, known screens and a model of the declared size", () => {
    expect(new Set(ROOM_TERMINALS.map((t) => t.id)).size).toBe(ROOM_TERMINALS.length);
    expect(ROOM_TERMINALS.length).toBeGreaterThanOrEqual(10);
    const m = roomTerminalModel();
    expect([m.w, m.h, m.d]).toEqual([
      ROOM_TERMINAL_SIZE.w,
      ROOM_TERMINAL_SIZE.h,
      ROOM_TERMINAL_SIZE.d,
    ]);
    for (const t of ROOM_TERMINALS) {
      expect(SCREEN_COLOR[t.screen]).toBeDefined();
      const sp = roomTerminalScreen(t);
      expect(sp.center[2]).toBeLessThanOrEqual(ROOM_TERMINAL_SIZE.d);
    }
  });

  it.each(ROOM_TERMINALS.map((t) => [t.id, t] as const))(
    "%s stands in its room, clear of everything",
    (_id, t) => {
      const floor = t.floor as FloorId;
      expect(roomAt(floor, t.x, t.z)?.id).toBe(t.room);
      const r = rectOf(t);
      const elevator = {
        x0: ELEVATOR_AREA.x0,
        z0: ELEVATOR_AREA.z0,
        x1: ELEVATOR_AREA.x1 + 1,
        z1: ELEVATOR_AREA.z1 + 1,
      };
      expect(overlaps(r, elevator)).toBe(false);
      for (const z of interactableZones(floor)) {
        if (z.kind === "elevator" || z.id === t.id) continue;
        expect(overlaps(r, z, z.kind === "door" ? 5 : 3), `${t.id} vs ${z.id}`).toBe(false);
      }
      for (const p of interiorFor(floor))
        expect(overlaps(r, placementRect(p)), `${t.id} vs decor ${p.id}`).toBe(false);
      const world = buildFloor(floor).world;
      for (let z = Math.floor(r.z0); z < Math.ceil(r.z1); z++)
        for (let x = Math.floor(r.x0); x < Math.ceil(r.x1); x++) {
          expect(world.get(x, 0, z), `${t.id} floor ${x},${z}`).not.toBe(0);
          for (let y = 1; y < 7; y++) expect(world.get(x, y, z), `${t.id} ${x},${y},${z}`).toBe(0);
        }
    },
  );
});

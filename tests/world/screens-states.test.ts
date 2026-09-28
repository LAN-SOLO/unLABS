/**
 * Live screens across the game: every content kind for an empty, an early
 * and a late lab, every look (live / boot / no signal / brownout / dark),
 * every room terminal and device screen — and that the content really
 * follows the state.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { ITEMS } from "@/lib/world/content/items";
import { PUZZLES } from "@/lib/world/content/puzzles";
import { ENDINGS, INSIGHTS } from "@/lib/world/content/story";
import { ROOM_TERMINALS, roomTerminalScreen } from "@/lib/world/content/terminals";
import { initialState, log } from "@/lib/world/game";
import type { ScreenContent, ScreenSpec } from "@/lib/world/models/anim";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import {
  BOOT_SECONDS,
  SCREEN_COLOR,
  drawScreen,
  resetScreenHistory,
  screenInfo,
  screenLook,
  type ScreenCtx,
  type ScreenInfo,
} from "@/lib/world/screen-content";
import { mailReadFlag } from "@/lib/world/terminal-lite";
import type { WorldState } from "@/lib/world/types";

interface Rec extends ScreenCtx {
  calls: number;
  bad: number;
  trace: string[];
}

function rec(): Rec {
  const ctx: Rec = {
    calls: 0,
    bad: 0,
    trace: [],
    fillStyle: "#000",
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      ctx.calls++;
      if (![x, y, w, h].every(Number.isFinite)) ctx.bad++;
      ctx.trace.push(`${String(ctx.fillStyle)}:${x},${y},${w},${h}`);
    },
  };
  return ctx;
}

const KINDS = Object.keys(SCREEN_COLOR) as ScreenContent[];
const NOW = new Date(2026, 8, 28, 3, 41);

function spec(content: ScreenContent, extra: Partial<ScreenSpec> = {}): ScreenSpec {
  return { center: [4, 4, 2], w: 6, h: 4, normal: "+z", content, requiresPower: true, ...extra };
}

function buildAll(s: WorldState, ids: readonly string[]): void {
  for (const id of ids) {
    const d = DEVICES.find((x) => x.id === id)!;
    s.built[id] = d.stages.length;
    s.discovered[id] = true;
  }
}

function early(): WorldState {
  const s = initialState();
  s.flags.geo_routed = true;
  buildAll(s, ["MCP-000", "UEC-001", "BTK-001", "CLK-001"]);
  s.playTime = 600;
  log(s, "Geothermie verbunden.");
  return s;
}

function late(): WorldState {
  const s = early();
  buildAll(
    s,
    DEVICES.map((d) => d.id),
  );
  for (const i of INSIGHTS) s.insights[i.id] = 1;
  for (const p of PUZZLES) s.puzzles[p.id] = true;
  for (const e of ENDINGS) s.endings[e.id] = true;
  s.counters.slices = 30;
  for (const it of ITEMS.slice(0, 40)) s.inventory[it.id] = 2;
  s.playTime = 200_000;
  for (let i = 0; i < 12; i++) log(s, `Eintrag ${i} mit etwas längerem Text für den Umbruch.`);
  return s;
}

const STATES: [string, () => WorldState][] = [
  ["empty", initialState],
  ["early", early],
  ["late", late],
];

const SIZES: [number, number][] = [
  [32, 24],
  [48, 32],
  [96, 48],
  [160, 96],
];

beforeEach(() => resetScreenHistory());

describe("every screen kind in every phase", () => {
  it.each(STATES)("%s lab: all kinds, sizes, looks and boot ages draw cleanly", (_n, make) => {
    const s = make();
    const infos: ScreenInfo[] = [
      screenInfo(s, "MCP-000", undefined, NOW),
      screenInfo(s, "UEC-001", undefined, NOW),
      screenInfo(s, undefined, "signal", NOW),
      screenInfo(s, undefined, undefined, NOW),
    ];
    for (const info of infos)
      for (const content of KINDS)
        for (const [w, h] of SIZES)
          for (const [t, powered, boot] of [
            [0, true, Infinity],
            [3.3, true, 0.1],
            [7.7, true, 1.2],
            [12.4, false, Infinity],
            [45.5, true, Infinity],
          ] as const) {
            for (const text of [undefined, "ARCHIV\nEINE SEHR LANGE ZEILE DIE SCROLLT\nX"]) {
              const ctx = rec();
              drawScreen(ctx, w, h, spec(content, text ? { text } : {}), info, t, powered, boot);
              expect(ctx.bad, `${content} ${w}x${h}`).toBe(0);
              expect(ctx.calls, `${content} ${w}x${h}`).toBeGreaterThan(3);
              expect(ctx.globalAlpha).toBe(1);
            }
          }
  });

  it("room terminal screens draw in all phases", () => {
    for (const [, make] of STATES) {
      const s = make();
      for (const t of ROOM_TERMINALS) {
        const sp = roomTerminalScreen(t);
        expect(sp.text, t.id).toBeTruthy();
        const info = screenInfo(s, undefined, t.room, NOW);
        for (const time of [0, 2.9, 6.1]) {
          const ctx = rec();
          drawScreen(ctx, 32, 24, sp, info, time, true);
          expect(ctx.bad).toBe(0);
        }
      }
    }
  });

  it("device visual screens draw with their own device info", () => {
    const s = late();
    for (const id of DEVICE_VISUAL_IDS) {
      for (const sp of deviceVisual(id).screens ?? []) {
        const info = screenInfo(
          s,
          DEVICES.some((d) => d.id === id) ? id : undefined,
          undefined,
          NOW,
        );
        const ctx = rec();
        drawScreen(ctx, 64, 48, sp, info, 5, true);
        expect(ctx.bad, id).toBe(0);
      }
    }
  });
});

describe("screen looks", () => {
  it("dark without power, NO SIGNAL with power, brownout when starved", () => {
    const cold = screenInfo(initialState(), "MCP-000");
    expect(screenLook(spec("log"), cold, false)).toBe("dark");
    expect(screenLook(spec("log", { requiresPower: false }), cold, false)).toBe("live");
    const warm = screenInfo(early(), "CLK-001");
    expect(screenLook(spec("log"), warm, false)).toBe("nosignal");
    expect(screenLook(spec("log"), warm, true)).toBe("live");
    const s = initialState();
    s.flags.geo_routed = true; // 50 W
    buildAll(s, ["MCP-000", "P3D-001"]); // 5 W + 60 W → the fabricator starves
    const starved = screenInfo(s, "P3D-001");
    expect(starved.starved).toBe(true);
    expect(screenLook(spec("status"), starved, false)).toBe("brownout");
  });

  it("the boot splash differs from live content and ends after BOOT_SECONDS", () => {
    const info = screenInfo(early(), "CLK-001", undefined, NOW);
    const draw = (boot: number) => {
      const ctx = rec();
      drawScreen(ctx, 96, 48, spec("clock"), info, 4, true, boot);
      return ctx.trace.join("|");
    };
    const live = draw(Infinity);
    expect(draw(0.1)).not.toBe(live);
    expect(draw(1.5)).not.toBe(live);
    expect(draw(BOOT_SECONDS + 0.01)).toBe(live);
  });
});

describe("content follows the state", () => {
  function trace(content: ScreenContent, s: WorldState, src: [string?, string?] = []): string {
    const ctx = rec();
    drawScreen(ctx, 96, 64, spec(content), screenInfo(s, src[0], src[1], NOW), 2, true);
    return ctx.trace.join("|");
  }

  it.each([
    "bars",
    "spectrum",
    "damien",
    "qubits",
    "wave",
    "boot",
    "radar",
    "map",
    "power",
  ] as const)("%s changes between the early and the late lab", (content) => {
    const a = trace(content, early(), [undefined, "signal"]);
    resetScreenHistory();
    const b = trace(content, late(), [undefined, "signal"]);
    expect(a).not.toBe(b);
  });

  it("screenInfo collects the live readouts", () => {
    const s = late();
    const i = screenInfo(s, undefined, "archiv", NOW);
    expect(i.devicesBuilt).toBe(DEVICES.length);
    expect(i.floors.reduce((a, f) => a + f.total, 0)).toBe(DEVICES.length);
    expect(i.spectrum.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(i.damienSignal).toBe(1);
    expect(i.haloLetters).toBe("HALO");
    expect(i.puzzlesSolved).toBe(PUZZLES.length);
    expect(i.slices).toBe(30);
    expect(i.day).toBe(2563);
    expect(i.devices.some((d) => d.online)).toBe(true);
    expect(i.logT).toHaveLength(i.log.length);
    expect(i.mcpLine.length).toBeGreaterThan(0);
    expect(Number.isFinite(i.volatility)).toBe(true);
  });

  it("records a power history sample per grid change", () => {
    const s = early();
    expect(screenInfo(s).loadHistory).toHaveLength(1);
    buildAll(s, ["VNT-001"]);
    const h = screenInfo(s).loadHistory;
    expect(h).toHaveLength(2);
    s.playTime += 1; // no grid change → no new sample
    expect(screenInfo(s).loadHistory).toHaveLength(2);
  });

  it("counts unread mail of the room's terminal", () => {
    const s = early();
    const term = ROOM_TERMINALS.find((t) => t.id === "term_jadeq")!;
    const before = screenInfo(s, undefined, term.room).unreadMail;
    expect(before).toBeGreaterThan(0);
    s.flags[mailReadFlag(term.mail![0]!.id)] = true;
    expect(screenInfo(s, undefined, term.room).unreadMail).toBe(before - 1);
    expect(screenInfo(s, undefined, "werkstatt").unreadMail).toBe(0);
  });
});

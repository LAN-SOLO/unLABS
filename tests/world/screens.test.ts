/**
 * Live screens — content renderers, info snapshot and the ScreenSystem budget.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { initialState } from "@/lib/world/game";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import { DECOR } from "@/lib/world/models/decor";
import type { ScreenContent, ScreenSpec } from "@/lib/world/models/anim";
import {
  SCREEN_COLOR,
  drawScreen,
  screenInfo,
  screenResolution,
  wrapText,
  type ScreenCtx,
  type ScreenInfo,
} from "@/lib/world/screen-content";
import { ScreenSystem, screenLocalPosition, type ScreenCanvas } from "@/lib/world/render/screens";

interface StubCtx extends ScreenCtx {
  calls: number;
  bad: number;
  trace: string[];
}

function stubCtx(record = false): StubCtx {
  const ctx: StubCtx = {
    calls: 0,
    bad: 0,
    trace: [],
    fillStyle: "#000",
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      ctx.calls++;
      if (![x, y, w, h].every(Number.isFinite)) ctx.bad++;
      if (record) ctx.trace.push(`${String(ctx.fillStyle)}:${x},${y},${w},${h}`);
    },
  };
  return ctx;
}

const CONTENTS = Object.keys(SCREEN_COLOR) as ScreenContent[];

function spec(content: ScreenContent, extra: Partial<ScreenSpec> = {}): ScreenSpec {
  return { center: [4, 4, 2], w: 6, h: 4, normal: "+z", content, requiresPower: true, ...extra };
}

function info(): ScreenInfo {
  const s = initialState();
  s.flags.geo_routed = true;
  s.log.push({ t: 12, text: "Ein sehr langer Protokolleintrag, der umbrochen werden muss." });
  return screenInfo(s, "MCP-000", undefined, new Date(2026, 8, 27, 12, 5));
}

describe("screen content", () => {
  it("covers all 19 content kinds", () => {
    expect(CONTENTS).toHaveLength(19);
  });

  it.each(CONTENTS)("draws %s at several sizes and times without throwing", (content) => {
    const i = info();
    for (const [w, h] of [
      [32, 24],
      [64, 48],
      [128, 64],
      [160, 96],
    ] as const) {
      for (const t of [0, 0.37, 3.3, 9.5, 12.4, 123.456]) {
        const ctx = stubCtx();
        drawScreen(ctx, w, h, spec(content, { text: "Keep listening." }), i, t);
        expect(ctx.calls).toBeGreaterThan(3);
        expect(ctx.bad).toBe(0);
        expect(ctx.globalAlpha).toBe(1);
      }
    }
  });

  it("works with an empty info (no device, no log, no rooms)", () => {
    const i: ScreenInfo = { ...info(), log: [], rooms: [], deviceName: "", stages: 0 };
    delete i.deviceId;
    for (const c of CONTENTS) {
      const ctx = stubCtx();
      drawScreen(ctx, 64, 48, spec(c), i, 5);
      expect(ctx.bad).toBe(0);
    }
  });

  it("is deterministic in t", () => {
    const i = info();
    for (const c of CONTENTS) {
      const a = stubCtx(true);
      const b = stubCtx(true);
      drawScreen(a, 96, 48, spec(c), i, 4.2);
      drawScreen(b, 96, 48, spec(c), i, 4.2);
      expect(a.trace).toEqual(b.trace);
    }
  });

  it("paints unpowered screens dark without lab power but keeps free-running ones alive", () => {
    const cold = screenInfo(initialState(), "MCP-000", undefined, new Date(2026, 8, 27, 12, 5));
    const dark = stubCtx(true);
    drawScreen(dark, 64, 48, spec("wave"), cold, 1, false);
    expect(dark.trace.every((l) => l.startsWith("rgb(") || l.startsWith("#"))).toBe(true);
    expect(dark.calls).toBeLessThan(64);
    const live = stubCtx();
    drawScreen(live, 64, 48, spec("wave", { requiresPower: false }), cold, 1, false);
    expect(live.calls).toBeGreaterThan(dark.calls);
  });

  it("wraps text to the column width", () => {
    for (const l of wrapText("Hör zu, bevor du baust. Supercalifragilistisch lang.", 10))
      expect(l.length).toBeLessThanOrEqual(10);
  });

  it("picks bounded canvas resolutions", () => {
    for (const [w, h] of [
      [0.5, 0.5],
      [3, 1.5],
      [8, 3],
      [20, 1],
      [1, 6],
    ] as const) {
      const r = screenResolution(w, h);
      expect(r.w).toBeGreaterThanOrEqual(32);
      expect(r.w).toBeLessThanOrEqual(160);
      expect(r.h).toBeGreaterThanOrEqual(8);
      expect(r.h).toBeLessThanOrEqual(120);
      expect(r.w % 8).toBe(0);
      expect(r.h % 8).toBe(0);
    }
  });
});

describe("screenInfo", () => {
  it("reads device, room, power, log and clock from the state", () => {
    const s = initialState();
    const a = screenInfo(s, "MCP-000", undefined, new Date(2026, 0, 1, 7, 3));
    expect(a.deviceId).toBe("MCP-000");
    expect(a.roomId).toBe("mcp");
    expect(a.floor).toBe(0);
    expect(a.stage).toBe(1);
    expect(a.stages).toBeGreaterThan(1);
    expect(a.built).toBe(false);
    expect(a.generation).toBe(0);
    expect(a.clock).toBe("07:03");
    expect(a.log.at(-1)).toMatch(/Cold start/);
    expect(a.rooms.length).toBeGreaterThan(3);
    expect(a.totalInsights).toBeGreaterThan(10);
    expect(a.objective.length).toBeGreaterThan(0);

    s.flags.geo_routed = true;
    s.log.push({ t: 5, text: "Neu" });
    const b = screenInfo(s, "MCP-000");
    expect(b.generation).toBe(50);
    expect(b.online).toBe(true);
    expect(b.log.at(-1)).toBe("Neu");
  });

  it("falls back to roomId, then the player's room", () => {
    const s = initialState();
    expect(screenInfo(s, undefined, "archiv").roomName).toBe("Archive");
    const here = screenInfo(s);
    expect(here.floor).toBe(s.floor);
    expect(here.deviceId).toBeUndefined();
  });
});

describe("model screen specs (device + decor data)", () => {
  it("device visual screens sit inside their model", () => {
    for (const id of DEVICE_VISUAL_IDS) {
      const v = deviceVisual(id);
      for (const sp of v.screens ?? []) {
        const [x, y, z] = sp.center;
        const h = v.height ?? v.base.h;
        expect(x, `${id} x`).toBeGreaterThanOrEqual(-1);
        expect(x, `${id} x`).toBeLessThanOrEqual(v.base.w + 1);
        expect(y, `${id} y`).toBeGreaterThanOrEqual(-1);
        expect(y, `${id} y`).toBeLessThanOrEqual(h + 1);
        expect(z, `${id} z`).toBeGreaterThanOrEqual(-1);
        expect(z, `${id} z`).toBeLessThanOrEqual(v.base.d + 1);
        expect(sp.w * sp.h, `${id} size`).toBeGreaterThan(0);
        expect(SCREEN_COLOR[sp.content], `${id} content`).toBeDefined();
      }
    }
  });

  it("decor screens reference known content kinds", () => {
    for (const d of DECOR)
      for (const sp of d.screens ?? []) expect(SCREEN_COLOR[sp.content], d.id).toBeDefined();
  });
});

// ── ScreenSystem ─────────────────────────────────────────────────

function stubFactory(): { make: (w: number, h: number) => ScreenCanvas; made: StubCtx[] } {
  const made: StubCtx[] = [];
  return {
    made,
    make: (w, h) => {
      const ctx = stubCtx();
      made.push(ctx);
      return { width: w, height: h, getContext: () => ctx };
    },
  };
}

describe("ScreenSystem", () => {
  it("places the plane like the engine places models (bottom-centre origin)", () => {
    const p = screenLocalPosition(spec("wave", { center: [5, 6, 4] }), { w: 10, d: 4 }, 0.5, 0);
    expect(p).toEqual([0, 3, 1]);
    const q = screenLocalPosition(
      spec("wave", { center: [0, 2, 2], normal: "-x" }),
      { w: 4, d: 4 },
      0.25,
      0.1,
    );
    expect(q[0]).toBeCloseTo(-0.6);
    expect(q[1]).toBeCloseTo(0.5);
    expect(q[2]).toBeCloseTo(0);
  });

  it("redraws within the per-frame budget and the fps cap", () => {
    const f = stubFactory();
    const sys = new ScreenSystem({ createCanvas: f.make, perFrame: 3, fps: 8 });
    const g = new THREE.Group();
    for (let i = 0; i < 10; i++)
      sys.attach(g, spec("bars", { text: `t${i}` }), { w: 8, d: 4 }, 0.5, { roomId: `r${i}` });
    expect(sys.size.canvases).toBe(10);
    const i0 = info();
    let calls = 0;
    const get = () => {
      calls++;
      return i0;
    };
    sys.update(0, get);
    expect(sys.lastDraws).toBe(3);
    sys.update(0.01, get);
    sys.update(0.02, get);
    sys.update(0.03, get);
    expect(calls).toBe(10); // every canvas once, round-robin
    sys.update(0.04, get);
    expect(sys.lastDraws).toBe(0); // fps cap
    sys.update(0.2, get);
    expect(sys.lastDraws).toBe(3);
    sys.dispose();
    expect(g.children).toHaveLength(0);
  });

  it("shares canvases between identical screens and pools released ones", () => {
    const f = stubFactory();
    const sys = new ScreenSystem({ createCanvas: f.make });
    const g = new THREE.Group();
    const a = sys.attach(g, spec("radar"), { w: 8, d: 4 }, 0.5, { roomId: "x" });
    const b = sys.attach(
      g,
      spec("radar"),
      { w: 8, d: 4 },
      0.5,
      { roomId: "x" },
      {
        anchor: { x: 3, y: 1, z: 3, rotY: Math.PI / 2 },
      },
    );
    expect(sys.size).toEqual({ screens: 2, canvases: 1 });
    sys.detach(a);
    sys.detach(b);
    expect(sys.size).toEqual({ screens: 0, canvases: 0 });
    expect(g.children).toHaveLength(0);
    sys.attach(g, spec("code"), { w: 8, d: 4 }, 0.5);
    expect(f.made).toHaveLength(1); // reused from the pool
  });

  it("skips hidden floors and paints dark screens only once", () => {
    const f = stubFactory();
    const sys = new ScreenSystem({ createCanvas: f.make });
    const floor = new THREE.Group();
    const dev = new THREE.Group();
    floor.add(dev);
    const ref = sys.attach(
      dev,
      spec("scope"),
      { w: 8, d: 4 },
      0.5,
      { deviceId: "MCP-000" },
      {
        powered: false,
      },
    );
    const cold = screenInfo(initialState(), "MCP-000");
    floor.visible = false;
    sys.update(0, () => cold);
    expect(sys.lastDraws).toBe(0);
    floor.visible = true;
    sys.update(1, () => cold);
    expect(sys.lastDraws).toBe(1);
    sys.update(2.5, () => cold);
    expect(sys.lastDraws).toBe(0); // still dark: re-checked, not repainted
    sys.setPowered(ref, true);
    sys.update(3, () => cold);
    expect(sys.lastDraws).toBe(1);
    expect(sys.size.canvases).toBe(1);
  });

  it("animates NO SIGNAL screens at a reduced rate", () => {
    const f = stubFactory();
    const sys = new ScreenSystem({ createCanvas: f.make, fps: 8 });
    const g = new THREE.Group();
    sys.attach(g, spec("log"), { w: 8, d: 4 }, 0.5, { roomId: "archiv" }, { powered: false });
    const lit = info(); // 50 W in the lab → the unlit screen shows "NO SIGNAL"
    sys.update(0, () => lit);
    expect(sys.lastDraws).toBe(1);
    sys.update(0.15, () => lit);
    expect(sys.lastDraws).toBe(0);
    sys.update(0.3, () => lit);
    expect(sys.lastDraws).toBe(1);
  });

  it("boots a device screen when its device comes online", () => {
    const f = stubFactory();
    const sys = new ScreenSystem({ createCanvas: f.make });
    const g = new THREE.Group();
    sys.attach(g, spec("status"), { w: 8, d: 4 }, 0.5, { deviceId: "MCP-000" });
    const cold = screenInfo(initialState(), "MCP-000");
    sys.update(0, () => cold);
    expect(sys.bootAgeOf("MCP-000", 0)).toBe(Number.POSITIVE_INFINITY); // first set only primes
    const s = initialState();
    s.flags.geo_routed = true;
    const warm = screenInfo(s, "MCP-000");
    expect(warm.onlineIds.has("MCP-000")).toBe(true);
    sys.update(1, () => warm);
    expect(sys.bootAgeOf("MCP-000", 1.5)).toBeCloseTo(0.5);
  });

  it("boots a room screen switched on after it was seen dark, not on floor load", () => {
    const made: StubCtx[] = [];
    const make = (w: number, h: number): ScreenCanvas => {
      const ctx = stubCtx(true);
      made.push(ctx);
      return { width: w, height: h, getContext: () => ctx };
    };
    const warmUp = (c: StubCtx | undefined) =>
      !!c?.trace.some((l) => l.startsWith("rgb(2,3,3):0,0,"));
    const cold = screenInfo(initialState(), undefined, "archiv");
    const sys = new ScreenSystem({ createCanvas: make });
    const g = new THREE.Group();
    const ref = sys.attach(
      g,
      spec("code"),
      { w: 8, d: 4 },
      0.5,
      { roomId: "archiv" },
      { powered: false },
    );
    sys.update(0, () => cold);
    sys.setPowered(ref, true);
    sys.update(1, () => cold);
    expect(warmUp(made.at(-1))).toBe(true);
    // Switched on before it was ever drawn (floor build): straight to content.
    const sys2 = new ScreenSystem({ createCanvas: make });
    const r2 = sys2.attach(
      g,
      spec("code"),
      { w: 8, d: 4 },
      0.5,
      { roomId: "kontroll" },
      { powered: false },
    );
    sys2.setPowered(r2, true);
    sys2.update(0, () => cold);
    expect(sys2.lastDraws).toBe(1);
    expect(warmUp(made.at(-1))).toBe(false);
  });

  it("culls screens outside the camera frustum", () => {
    const f = stubFactory();
    const sys = new ScreenSystem({ createCanvas: f.make });
    const scene = new THREE.Scene();
    const near = new THREE.Group();
    const far = new THREE.Group();
    far.position.set(500, 0, 0);
    scene.add(near, far);
    sys.attach(near, spec("clock"), { w: 8, d: 4 }, 0.5, { roomId: "a" });
    sys.attach(far, spec("clock"), { w: 8, d: 4 }, 0.5, { roomId: "b" });
    const cam = new THREE.OrthographicCamera(-20, 20, 20, -20, -100, 100);
    cam.position.set(0, 50, 0);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    sys.update(0, () => info(), cam);
    expect(sys.lastDraws).toBe(1);
  });

  it("caps the number of screens", () => {
    const f = stubFactory();
    const sys = new ScreenSystem({ createCanvas: f.make, maxScreens: 2 });
    const g = new THREE.Group();
    expect(sys.attach(g, spec("noise"), { w: 8, d: 4 }, 0.5)).toBeGreaterThan(0);
    expect(sys.attach(g, spec("noise"), { w: 8, d: 4 }, 0.5)).toBeGreaterThan(0);
    expect(sys.attach(g, spec("noise"), { w: 8, d: 4 }, 0.5)).toBe(-1);
  });
});

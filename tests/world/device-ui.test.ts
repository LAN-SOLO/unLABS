/**
 * Every device is used through its own interface: one spec each, individual
 * (no two alike), valid widgets, live values that never throw.
 */
import { describe, expect, it } from "vitest";
import { DEVICE_UI, deviceUi, type UiCtx, type Widget } from "@/lib/world/device-ui";
import { DEVICES } from "@/lib/world/content/devices";
import { initialState, power } from "@/lib/world/game";
import type { WorldState } from "@/lib/world/types";

function flat(ws: readonly Widget[]): Widget[] {
  return ws.flatMap((w) => (w.kind === "row" ? flat(w.widgets) : [w]));
}

function ctx(s: WorldState, id: string, t: number): UiCtx {
  const p = power(s);
  return { s, id, power: p, online: true, t, get: (k, f = 0) => s.tuning[`${id}.${k}`] ?? f };
}

function evaluate(w: Widget, c: UiCtx): void {
  const v = (x: unknown) => (typeof x === "function" ? (x as (c: UiCtx) => unknown)(c) : x);
  switch (w.kind) {
    case "scope":
      for (const x of [0, 0.5, 1]) expect(Number.isFinite(w.wave(x, c))).toBe(true);
      return;
    case "matrix":
      for (let i = 0; i < w.cols * w.rows; i++) expect(Number.isFinite(w.cell(i, c))).toBe(true);
      return;
    case "readout":
    case "gauge":
    case "bar":
      expect(v(w.value)).toBeDefined();
      return;
    case "leds":
      for (const it of w.items) v(it.on);
      return;
    case "spectrum":
      v(w.bands);
      return;
    case "graph":
      v(w.series);
      return;
    case "radar":
      v(w.blips);
      return;
    case "dial":
      expect(Number.isFinite(v(w.angle) as number)).toBe(true);
      return;
    case "log":
      expect(Array.isArray(v(w.lines))).toBe(true);
      return;
    case "text":
      expect(typeof v(w.text)).toBe("string");
      return;
    default:
      return;
  }
}

const IDS = DEVICES.map((d) => d.id);

describe("device interfaces", () => {
  it("every device has its own spec", () => {
    const missing = IDS.filter((id) => !DEVICE_UI.has(id));
    expect(missing).toEqual([]);
  });

  it("specs are individual (distinct look and pages)", () => {
    const looks = new Set<string>();
    for (const id of IDS) {
      const u = deviceUi(id);
      const sig = `${u.face}|${u.font}|${u.accent}|${u.pages.map((p) => p.widgets.map((w) => w.kind).join(",")).join("/")}`;
      expect(looks.has(sig), `${id}: same interface as another device`).toBe(false);
      looks.add(sig);
    }
  });

  it("widgets are valid: unique setting keys, sane ranges, at least one live readout", () => {
    for (const id of IDS) {
      const u = deviceUi(id);
      expect(u.pages.length, id).toBeGreaterThan(0);
      const ws = u.pages.flatMap((p) => flat(p.widgets));
      const keys = ws.flatMap((w) => ("key" in w ? [w.key] : []));
      expect(new Set(keys).size, `${id}: duplicate setting keys`).toBe(keys.length);
      for (const w of ws) {
        if (w.kind === "knob" || w.kind === "slider") {
          expect(w.min < w.max && w.def >= w.min && w.def <= w.max, `${id}.${w.key}`).toBe(true);
          expect(w.key).toMatch(/^[a-z0-9_]+$/);
        }
        if (w.kind === "mode")
          expect(
            w.options.some((o) => o.value === w.def),
            `${id}.${w.key}`,
          ).toBe(true);
      }
      expect(
        ws.some((w) =>
          [
            "readout",
            "gauge",
            "bar",
            "graph",
            "scope",
            "spectrum",
            "radar",
            "dial",
            "matrix",
            "log",
          ].includes(w.kind),
        ),
        `${id}: needs a live display`,
      ).toBe(true);
    }
  });

  it("live values never throw (fresh game and finished lab, several times)", () => {
    const fresh = initialState();
    const done = initialState();
    for (const d of DEVICES) done.built[d.id] = d.stages.length;
    done.flags.geo_routed = true;
    for (const s of [fresh, done])
      for (const id of IDS)
        for (const t of [0, 1.3, 47.9])
          for (const w of deviceUi(id).pages.flatMap((p) => flat(p.widgets)))
            evaluate(w, ctx(s, id, t));
  });
});

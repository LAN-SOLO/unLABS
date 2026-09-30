import { describe, expect, it } from "vitest";
import {
  BOT_MAX_HEIGHT,
  BOT_SCALE,
  botVisual,
  jadeModel,
  mcpAvatarVisual,
} from "@/lib/world/models/characters";
import { C } from "@/lib/world/content/palette";
import { animTransform, lightIntensity, type DeviceVisual } from "@/lib/world/models/anim";

function fitsBot(v: DeviceVisual, needsPower = false): void {
  expect(v.scale).toBe(BOT_SCALE);
  expect(v.height ?? v.base.h).toBeLessThanOrEqual(BOT_MAX_HEIGHT);
  expect(Math.max(v.base.w, v.base.d) * BOT_SCALE).toBeLessThanOrEqual(3.5);
  expect(v.parts.length).toBeGreaterThanOrEqual(2);
  const names = new Set(v.parts.map((p) => p.name));
  expect(names.size).toBe(v.parts.length);
  for (const p of v.parts) {
    expect(p.requiresPower, p.name).toBe(needsPower);
    expect(p.parent, p.name).toBeUndefined();
    expect(p.model.grid.count(), p.name).toBeGreaterThan(0);
  }
}

describe("extra character visuals", () => {
  it("the MCP avatar is a projected red eye with a turning halo", () => {
    const v = mcpAvatarVisual();
    // Everything follows MCP-000's power (engine: syncAvatar sets rig.powered).
    fitsBot(v, true);
    const eye = v.parts.find((p) => p.name === "eye")!;
    const colours = new Set<number>();
    eye.model.grid.forEach((_x, _y, _z, c) => colours.add(c));
    expect(colours.has(C.mcp_red)).toBe(true);
    expect(v.parts.find((p) => p.name === "halo")?.kind).toBe("spin");
    expect(v.lights.length).toBeGreaterThan(0);
  });

  it("the MCP hologram vanishes without power while the projector stays", () => {
    const v = mcpAvatarVisual();
    const holo = ["eye", "lids", "beam", "crown"];
    for (const name of holo) {
      const p = v.parts.find((q) => q.name === name)!;
      expect(p.kind, name).toBe("blink");
      expect(animTransform(p, 1.3, false).visible, name).toBe(false);
    }
    // Powered, the eye is always there (the lids only flash over it).
    const eye = v.parts.find((p) => p.name === "eye")!;
    for (let t = 0; t < 20; t += 0.7) expect(animTransform(eye, t, true).visible).toBe(true);
    const halo = v.parts.find((p) => p.name === "halo")!;
    expect(animTransform(halo, 2, false).rot).toEqual(animTransform(halo, 0, false).rot);
    expect(animTransform(halo, 2, true).rot[1]).not.toBe(animTransform(halo, 0, true).rot[1]);
    for (const l of v.lights) expect(lightIntensity(l, 1, false)).toBe(0);
  });

  it("unknown bots still get LED eyes and an antenna", () => {
    const v = botVisual("some_future_bot");
    fitsBot(v);
    expect(v.parts.map((p) => p.name).sort()).toEqual(["antenna", "eyes"]);
  });

  it("the legacy body keeps Jade's brows", () => {
    const colours = new Set<number>();
    jadeModel().body.grid.forEach((_x, _y, _z, c) => colours.add(c));
    // Light copper brows, green eyes, the silver lids of her make-up.
    expect(colours.has(C.hair_copper)).toBe(true);
    expect(colours.has(C.eye_brown)).toBe(true);
  });
});

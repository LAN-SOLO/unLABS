/**
 * Lore bot visuals: budgets, unique silhouettes, personality details and
 * the dormant (asleep) look — see lib/world/models/characters.ts.
 */
import { describe, expect, it } from "vitest";
import { C } from "@/lib/world/content/palette";
import { NPCS } from "@/lib/world/content/story";
import { animTransform, lightIntensity, type DeviceVisual } from "@/lib/world/models/anim";
import {
  BOT_IDS,
  BOT_MAX_HEIGHT,
  BOT_MAX_WIDTH,
  BOT_PART_BUDGET,
  BOT_SCALE,
  botVisual,
} from "@/lib/world/models/characters";

const IDS = BOT_IDS.map((id) => [id] as const);

const EMISSIVE: ReadonlySet<number> = new Set([
  C.screen_green,
  C.screen_amber,
  C.screen_cyan,
  C.led_red,
  C.led_green,
  C.led_amber,
  C.neon_pink,
  C.neon_magenta,
  C.cerulean,
  C.white_gold,
  C.gamma,
  C.mcp_red,
]);

const LEDS: ReadonlySet<number> = new Set([
  C.led_red,
  C.led_green,
  C.led_amber,
  C.led_blue,
  C.led_white,
  C.screen_green,
  C.screen_amber,
  C.screen_cyan,
  C.cerulean,
]);

const WEAR: ReadonlySet<number> = new Set([
  C.concrete_light,
  C.concrete_dark,
  C.rust,
  C.iron_rust,
  C.grime,
  C.coffee,
]);

function colours(v: DeviceVisual): Set<number> {
  const out = new Set<number>();
  v.base.grid.forEach((_x, _y, _z, c) => out.add(c));
  for (const p of v.parts) p.model.grid.forEach((_x, _y, _z, c) => out.add(c));
  return out;
}

/** Occupancy-only hash of the base (colours ignored): the silhouette. */
function silhouette(v: DeviceVisual): string {
  const g = v.base.grid;
  let h = 2166136261;
  g.forEach((x, y, z) => {
    h ^= x + y * 97 + z * 9973;
    h = Math.imul(h, 16777619) >>> 0;
  });
  return `${g.sx}x${g.sy}x${g.sz}:${g.count()}:${h}`;
}

function pose(v: DeviceVisual, t: number, powered: boolean): string {
  return JSON.stringify(v.parts.map((p) => animTransform(p, t, powered)));
}

describe("lore bot designs", () => {
  it("cover every lore bot NPC", () => {
    const lore = NPCS.map((n) => n.id).filter(
      (id) => !["mcp", "jade", "damien", "halo", "unstables"].includes(id),
    );
    expect([...BOT_IDS].sort()).toEqual([...lore].sort());
  });

  it.each(IDS)("%s: fits the bot envelope, awake and asleep", (id) => {
    for (const v of [botVisual(id), botVisual(id, false)]) {
      expect(v.scale).toBe(BOT_SCALE);
      expect(v.height ?? v.base.h).toBeLessThanOrEqual(BOT_MAX_HEIGHT);
      expect(Math.max(v.base.w, v.base.d)).toBeLessThanOrEqual(BOT_MAX_WIDTH);
      expect(v.parts.length).toBeLessThanOrEqual(BOT_PART_BUDGET);
      const names = new Set(v.parts.map((p) => p.name));
      expect(names.size).toBe(v.parts.length);
      for (const p of v.parts) {
        expect(p.parent, p.name).toBeUndefined();
        expect(p.model.grid.count(), p.name).toBeGreaterThan(0);
        for (const n of [...p.offset, ...p.pivot]) expect(Number.isFinite(n)).toBe(true);
      }
    }
  });

  it.each(IDS)("%s: 4–10 animated parts that actually move", (id) => {
    const v = botVisual(id);
    expect(v.parts.length).toBeGreaterThanOrEqual(4);
    expect(v.parts.length).toBeLessThanOrEqual(BOT_PART_BUDGET);
    const moving = v.parts.filter((p) => {
      const a = JSON.stringify(animTransform(p, 0.3, true));
      for (let t = 0.7; t < 30; t += 0.37)
        if (JSON.stringify(animTransform(p, t, true)) !== a) return true;
      return false;
    });
    expect(moving.length).toBe(v.parts.length);
    // Awake bots ignore rig.powered (the engine builds them powered anyway).
    expect(v.parts.every((p) => !p.requiresPower)).toBe(true);
    expect(v.lights.every((l) => !l.requiresPower)).toBe(true);
  });

  it("every bot has its own silhouette", () => {
    const shapes = new Map<string, string>();
    for (const id of BOT_IDS) {
      const s = silhouette(botVisual(id));
      expect(shapes.get(s), `${id} looks like ${shapes.get(s)}`).toBeUndefined();
      shapes.set(s, id);
    }
    // Part sets differ too — no two bots share the same rig layout.
    const rigs = new Set(
      BOT_IDS.map((id) =>
        botVisual(id)
          .parts.map((p) => `${p.name}:${p.kind}`)
          .sort()
          .join(","),
      ),
    );
    expect(rigs.size).toBe(BOT_IDS.length);
  });

  it.each(IDS)("%s: status lights and wear", (id) => {
    const v = botVisual(id);
    const cs = colours(v);
    expect(
      [...cs].some((c) => LEDS.has(c)),
      "LED / screen colour",
    ).toBe(true);
    const wear = [...colours({ ...v, parts: [] })].filter((c) => WEAR.has(c));
    expect(wear.length, "dust / rust / grime on the base").toBeGreaterThan(0);
    expect(v.lights.length).toBeGreaterThanOrEqual(1);
    expect(v.lights.length).toBeLessThanOrEqual(2);
  });

  it("personality props match the lore", () => {
    const names = (id: string): string[] => botVisual(id).parts.map((p) => p.name);
    expect(names("x0r8t")).toEqual(expect.arrayContaining(["reel_l", "reel_r", "antenna"]));
    expect(names("f1ndr")).toContain("dish");
    expect(names("l0g1k")).toEqual(expect.arrayContaining(["lamp_true", "lamp_false"]));
    expect(names("p1ndr0")).toEqual(expect.arrayContaining(["claw_l", "claw_r"]));
    expect(names("r3tr0")).toEqual(expect.arrayContaining(["head", "floppy", "key_tap"]));
    expect(names("b4c0n")).toEqual(expect.arrayContaining(["beacon", "smile", "wave_arm"]));
    expect(botVisual("d3c4d3").screens?.[0]?.content).toBe("face");
    expect(names("w2rek").filter((n) => n.startsWith("leg_"))).toHaveLength(6);
    expect(names("k2ldr")).toEqual(expect.arrayContaining(["drawer_low", "drawer_high", "stamp"]));
    expect(names("w2rek")).toEqual(expect.arrayContaining(["mandible_l", "mandible_r"]));
    expect(names("c8br41n")).toEqual(expect.arrayContaining(["brain", "halo"]));
  });
});

describe("fine-scale authoring", () => {
  it.each(IDS)("%s: authored fine (half the old edge), same world envelope", (id) => {
    for (const v of [botVisual(id), botVisual(id, false)]) {
      expect(v.fine).toBe(true);
      expect(v.scale).toBe(0.125);
      // Same world size as the old 0.25-scale bots: ≤ 3 units tall, ≤ 3.5 across.
      expect((v.height ?? v.base.h) * v.scale!).toBeLessThanOrEqual(3);
      expect(Math.max(v.base.w, v.base.d) * v.scale!).toBeLessThanOrEqual(3.5);
      // Real detail, not an upscaled block: many colours and plenty of voxels.
      expect(colours(v).size).toBeGreaterThanOrEqual(12);
      expect(v.base.grid.count()).toBeGreaterThan(1000);
    }
  });

  it.each(IDS)("%s: stands on the floor and is centred on its footprint", (id) => {
    const v = botVisual(id);
    let minY = Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    v.base.grid.forEach((x, y) => {
      minY = Math.min(minY, y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    });
    // Feet, wheels, treads or legs (base or parts at rest) touch the floor, none sink into it.
    for (const p of v.parts) {
      let low = Infinity;
      p.model.grid.forEach((_x, y) => {
        low = Math.min(low, y);
      });
      minY = Math.min(minY, p.offset[1] + low);
    }
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(minY).toBeLessThanOrEqual(0.5);
    // Roughly symmetric in x around the base centre (the engine centres the base).
    expect(Math.abs((minX + maxX + 1) / 2 - v.base.w / 2)).toBeLessThanOrEqual(1);
  });
});

describe("dormant bots", () => {
  it.each(IDS)("%s: parts freeze and go dark when unpowered", (id) => {
    const v = botVisual(id, false);
    expect(v.parts.length).toBeGreaterThan(0);
    expect(v.parts.every((p) => p.requiresPower)).toBe(true);
    expect(pose(v, 0, false)).toBe(pose(v, 3.7, false));
    expect(pose(v, 1.1, false)).toBe(pose(v, 8.2, false));
    for (const p of v.parts) {
      const st = animTransform(p, 2, false);
      if (p.kind === "blink") expect(st.visible, p.name).toBe(false);
      expect(st.intensity, p.name).toBe(0);
    }
    for (const l of v.lights) expect(lightIntensity(l, 1.5, false)).toBe(0);
    for (const s of v.screens ?? []) expect(s.requiresPower).toBe(true);
  });

  it.each(IDS)("%s: the dormant base has no glowing voxels", (id) => {
    const awake = botVisual(id);
    const asleep = botVisual(id, false);
    expect([asleep.base.w, asleep.base.h, asleep.base.d]).toEqual([
      awake.base.w,
      awake.base.h,
      awake.base.d,
    ]);
    expect(asleep.base.grid.count()).toBe(awake.base.grid.count());
    const glowing: number[] = [];
    asleep.base.grid.forEach((_x, _y, _z, c) => {
      if (EMISSIVE.has(c)) glowing.push(c);
    });
    expect(glowing).toEqual([]);
  });

  it("most bots visibly slump while asleep", () => {
    const slumped = BOT_IDS.filter((id) => {
      const v = botVisual(id, false);
      return v.parts.some((p) => animTransform(p, 0, false).rot.some((r) => Math.abs(r) > 0.25));
    });
    expect(slumped.length).toBeGreaterThanOrEqual(8);
    // A slumped part stays down even if the engine forgets to cut the power.
    const head = botVisual("r3tr0", false).parts.find((p) => p.name === "head")!;
    expect(animTransform(head, 5, true).rot[0]).toBeCloseTo(0.4);
  });

  it("floating extras only exist while awake", () => {
    const sparks = (awake: boolean): number =>
      botVisual("c8br41n", awake).parts.filter((p) => p.name.startsWith("spark_")).length;
    expect(sparks(true)).toBe(2);
    expect(sparks(false)).toBe(0);
  });

  it("unknown ids fall back to a generic bot in both states", () => {
    expect(
      botVisual("nope")
        .parts.map((p) => p.name)
        .sort(),
    ).toEqual(["antenna", "eyes"]);
    expect(botVisual("nope", false).parts.every((p) => p.requiresPower)).toBe(true);
  });
});

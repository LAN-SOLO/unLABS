import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoxelWorld } from "@/lib/voxel/world";
import { CRYSTAL_MODES } from "@/lib/world/clarity-mode";
import {
  CRYSTAL_LEVEL,
  CRYSTAL_SLOTS,
  TERRAIN_BOX,
  crystalWanted,
  forbiddenUse,
  isCrystalManifest,
  surfaceSlots,
  terrainChunkKey,
} from "@/lib/world/crystal";
import { C } from "@/lib/world/content/palette";
import { gridHash } from "@/lib/world/models/refine";
import { VoxelGrid } from "@/lib/voxel/grid";

const ROOT = join(__dirname, "../..");
const MANIFEST = join(ROOT, "public/crystal/manifest.json");

describe("crystal age rules", () => {
  it("story crystallises only in the last era, always / off fix it", () => {
    expect(CRYSTAL_MODES).toEqual(["story", "always", "off"]);
    expect(crystalWanted(0, "story")).toBe(false);
    expect(crystalWanted(CRYSTAL_LEVEL - 0.5, "story")).toBe(false);
    expect(crystalWanted(CRYSTAL_LEVEL, "story")).toBe(true);
    expect(crystalWanted(0, "always")).toBe(true);
    expect(crystalWanted(CRYSTAL_LEVEL, "off")).toBe(false);
  });

  it("never gives Damien, his veil or Jade a crystal model", () => {
    for (const id of [
      "damien",
      "npc-damien/base",
      "damien-figure",
      "veil/0",
      "jade-idle",
      "jade/torso",
    ])
      expect(forbiddenUse(id), id).toBe(true);
    for (const id of [
      "dev-CDC-001/base",
      "bot-b4c0n",
      "decor-jade_poster",
      "terrain-f0-1.0.1-lit-up",
    ])
      expect(forbiddenUse(id), id).toBe(false);
  });
});

describe("terrain chunk keys", () => {
  const world = (): VoxelWorld => {
    const w = new VoxelWorld(96, 20, 96);
    for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) w.set(x, 0, z, C.floor_tile);
    for (let y = 1; y < 8; y++) w.set(40, y, 40, C.wall);
    return w;
  };

  it("is stable for the same voxels and namespaced apart from model keys", () => {
    const a = terrainChunkKey(world(), [32, 0, 32]);
    const b = terrainChunkKey(world(), [32, 0, 32]);
    expect(a.key).toBe(b.key);
    expect(a.key.startsWith("t:")).toBe(true);
    expect([a.box.sx, a.box.sy, a.box.sz]).toEqual([TERRAIN_BOX, TERRAIN_BOX, TERRAIN_BOX]);
  });

  it("changes when the chunk or its ring changes (lamps, cutaway, doors)", () => {
    const base = terrainChunkKey(world(), [32, 0, 32]).key;
    const inside = world();
    inside.set(40, 7, 40, 0);
    expect(terrainChunkKey(inside, [32, 0, 32]).key).not.toBe(base);
    // One voxel into the neighbour chunk = inside the ring.
    const ring = world();
    ring.set(31, 3, 40, C.wall);
    expect(terrainChunkKey(ring, [32, 0, 32]).key).not.toBe(base);
    // Far outside the ring: same key.
    const far = world();
    far.set(5, 3, 5, C.wall);
    expect(terrainChunkKey(far, [32, 0, 32]).key).toBe(base);
  });
});

describe("crystal manifest", () => {
  it("validates its shape and caps the surface slots", () => {
    expect(isCrystalManifest({ version: 1, surfaces: {}, models: {} })).toBe(true);
    expect(isCrystalManifest({ version: 2, surfaces: {}, models: {} })).toBe(false);
    expect(isCrystalManifest(null)).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`s${i}`, {}]));
    const slots = surfaceSlots({
      version: 1,
      generated: "",
      cfg: "",
      surfaces: many,
      models: {},
    });
    expect(Math.max(...slots.values())).toBe(CRYSTAL_SLOTS - 1);
  });

  it.runIf(existsSync(MANIFEST))("ships only allowed, existing, engine-keyed models", () => {
    const m: unknown = JSON.parse(readFileSync(MANIFEST, "utf8"));
    expect(isCrystalManifest(m)).toBe(true);
    if (!isCrystalManifest(m)) return;
    expect(Object.keys(m.surfaces).length).toBeLessThanOrEqual(CRYSTAL_SLOTS);
    for (const [key, model] of Object.entries(m.models)) {
      expect(key).toMatch(/^(t:)?\d+x\d+x\d+:[0-9a-z]+$/);
      for (const u of model.uses) expect(forbiddenUse(u), `${key} used by ${u}`).toBe(false);
      for (const s of model.surfaces) expect(m.surfaces[s], `${key}: surface ${s}`).toBeDefined();
      expect(existsSync(join(ROOT, "public/crystal", model.file)), model.file).toBe(true);
    }
  });

  it("keys a grid exactly like the engine (gridHash of the meshed grid)", () => {
    const g = new VoxelGrid(3, 2, 1);
    g.set(1, 1, 0, C.steel);
    expect(gridHash(g)).toMatch(/^3x2x1:[0-9a-z]+$/);
    const h = new VoxelGrid(3, 2, 1);
    h.set(1, 1, 0, C.steel);
    expect(gridHash(h)).toBe(gridHash(g));
  });
});

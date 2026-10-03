/**
 * Trailer sets: whole lab rooms as voxels for Blender (docs/TRAILERS.md).
 *
 *   pnpm trailer:export               every set in scripts/trailer/sets.ts
 *   pnpm trailer:export kontroll,mcp  only these sets
 *
 * A set is a box of one floor (one or more rooms + margin) with everything the
 * engine draws there: the terrain refined 2× (like the game's terrainTier 2),
 * doors in their resting state, devices (the detailed model the game swaps
 * in), props and decor (refined like modelMeshNow), plus the light list
 * (room lamps, decor lights, device lights). Characters come as a separate
 * library (posed Jade-free rigs: the veiled Damien, bots awake/dormant).
 *
 * Writes .voxel/trailer/ (gitignored):
 *   sets/<id>/set.json                     parts (uvox files) + lights + box
 *   sets/<id>/parts/<n>.uvox.json
 *   cast/<id>.uvox.json                    characters (feet at y 0, facing +z)
 *   cast.json
 *
 * Voxels only: every part is the game's own grid, placed exactly like the
 * engine places it (centred in x/z, bottom at y 1, rotation.y = rot·π/2).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { __setLocaleForTests } from "@/lib/i18n";
import type { UvoxModel } from "@/lib/voxel/uvox";
import { TRAILER_SETS, type TrailerSet } from "./sets";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, ".voxel/trailer");
const ONLY = process.argv
  .slice(2)
  .find((a) => !a.startsWith("--"))
  ?.split(",")
  .filter(Boolean);

type V3 = [number, number, number];

interface SetLight {
  kind: "lamp" | "decor" | "device";
  room: string;
  pos: V3;
  color: string;
  intensity: number;
  distance: number;
  /** Owner (device id / decor id) for per-object animation in Blender. */
  of?: string;
}

async function main(): Promise<void> {
  __setLocaleForTests("en");
  const { VoxelGrid } = await import("@/lib/voxel/grid");
  const { toUvox } = await import("@/lib/voxel/uvox");
  const { C, LAB_PALETTE, labMaterialOf } = await import("@/lib/world/content/palette");
  const { ROOMS, DOORS, PROPS } = await import("@/lib/world/content/map");
  const { PROP_VARIANT_DECOR } = await import("@/lib/world/content/decor-actions");
  const { DEVICES } = await import("@/lib/world/content/devices");
  const { interiorFor, decorElevation, decorLights } = await import("@/lib/world/content/interior");
  const { buildFloor, setLamps } = await import("@/lib/world/layout");
  const { floorGeomOf } = await import("@/lib/world/content/map");
  const { MODEL_SCALE } = await import("@/lib/world/models/core");
  const { deviceVisual } = await import("@/lib/world/models/devices");
  const { detailVisual } = await import("@/lib/world/models/detail");
  const { composeVisual } = await import("@/lib/world/models/compose");
  const { refineModel, refineTerrainRegion, decorFamily, familyFor } =
    await import("@/lib/world/models/refine");
  const { decorModel, decorScale, decorVisual, DECOR_BY_ID } =
    await import("@/lib/world/models/decor");
  const { propModel, propVisual } = await import("@/lib/world/models/props");
  const { DOOR_SCALE } = await import("@/lib/world/models/doors");
  const { doorAssembly } = await import("../voxel/door-parts");
  const { BOT_IDS, botVisual } = await import("@/lib/world/models/characters");
  const { damienRig, characterPose, jointMatrices, applyMat } =
    await import("@/lib/world/models/rig");
  const { veilRig } = await import("@/lib/world/models/veil");

  type Grid = InstanceType<typeof VoxelGrid>;
  const NAME = new Map<number, string>(Object.entries(C).map(([n, i]) => [i, n]));
  const PALETTE = {
    rgb: (i: number): V3 => {
      const [r, g, b] = LAB_PALETTE.get(i);
      return [r, g, b];
    },
    mat: (i: number) => labMaterialOf(i),
    name: (i: number) => NAME.get(i) ?? `c${i}`,
  };

  const writeJson = (rel: string, data: unknown): string => {
    const file = join(OUT, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data));
    return rel;
  };

  /** three.js rotation.y applied to a local offset. */
  const rotY = (v: V3, a: number): V3 => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  };

  /** A model placed like the engine: centred in x/z, bottom at `y`, refined. */
  function placed(
    id: string,
    src: Grid,
    family: Parameters<typeof refineModel>[1],
    scale: number,
    at: V3,
    rot: number,
    meta: Record<string, unknown>,
  ): UvoxModel {
    const fine = family === "hires" ? src : refineModel(src, family);
    const k = fine.sx / src.sx;
    return toUvox(id, fine, PALETTE, {
      unit: scale / k,
      origin: at,
      anchor: [fine.sx / 2, 0, fine.sz / 2],
      rotY: rot,
      meta,
    });
  }

  const inBox = (s: Box, x: number, z: number): boolean =>
    x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1;

  interface Box {
    x0: number;
    z0: number;
    x1: number;
    z1: number;
  }

  function boxOf(set: TrailerSet): Box {
    const geom = floorGeomOf(set.floor);
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const id of set.rooms) {
      const rg = geom.byId.get(id);
      const r = ROOMS.find((q) => q.id === id);
      if (!rg || !r) throw new Error(`set ${set.id}: unknown room ${id}`);
      if (r.floor !== set.floor)
        throw new Error(`set ${set.id}: ${id} is not on floor ${set.floor}`);
      for (const c of rg.cells) {
        const x = c % geom.W;
        const z = Math.floor(c / geom.W);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
      for (const w of rg.walls) {
        x0 = Math.min(x0, w.x);
        x1 = Math.max(x1, w.x);
        z0 = Math.min(z0, w.z);
        z1 = Math.max(z1, w.z);
      }
    }
    const m = set.margin ?? 1;
    return {
      x0: Math.max(0, x0 - m),
      z0: Math.max(0, z0 - m),
      x1: Math.min(geom.W - 1, x1 + m),
      z1: Math.min(geom.Z - 1, z1 + m),
    };
  }

  // ── Sets ───────────────────────────────────────────────────────
  const index: { id: string; floor: number; rooms: string[]; parts: number; lights: number }[] = [];
  for (const set of TRAILER_SETS) {
    if (ONLY && !ONLY.includes(set.id)) continue;
    const t0 = Date.now();
    const box = boxOf(set);
    const layout = buildFloor(set.floor);
    // Lamps lit in the set's rooms (the engine lights a room once powered).
    for (const r of set.rooms) setLamps(layout.world, layout.lamps, r, true);
    const parts: string[] = [];
    let n = 0;
    const add = (m: UvoxModel): void => {
      parts.push(writeJson(`sets/${set.id}/parts/${String(n++).padStart(3, "0")}.uvox.json`, m));
    };

    // Terrain: the floor box (y 0 … 9), refined 2× like the game.
    const sy = 10;
    const terrain = refineTerrainRegion(
      layout.world,
      [box.x0, 0, box.z0],
      [box.x1 - box.x0 + 1, sy, box.z1 - box.z0 + 1],
    );
    const tk = terrain.sx / (box.x1 - box.x0 + 1);
    add(
      toUvox(`${set.id}:terrain`, terrain, PALETTE, {
        unit: 1 / tk,
        origin: [box.x0, 0, box.z0],
        anchor: [0, 0, 0],
        meta: { kind: "terrain" },
      }),
    );

    // Doors (resting state).
    for (const d of DOORS) {
      if (d.floor !== set.floor || !inBox(box, d.x, d.z)) continue;
      const rootRot = d.axis === "z" ? -Math.PI / 2 : 0;
      doorAssembly(d).forEach((p, i) => {
        const off = rotY(p.at, rootRot);
        add(
          placed(
            `door:${d.id}#${i}`,
            p.grid,
            "architecture",
            DOOR_SCALE,
            [d.x + 0.5 + off[0], 1 + off[1], d.z + 0.5 + off[2]],
            rootRot + p.rotY,
            { kind: "door", id: d.id, use: p.use },
          ),
        );
      });
    }

    const lights: SetLight[] = [];
    for (const l of layout.lamps)
      if (set.rooms.includes(l.room))
        lights.push({
          kind: "lamp",
          room: l.room,
          pos: [l.x + 0.5, l.y, l.z + 0.5],
          color: "#ffd9a0",
          intensity: 1,
          distance: 12,
        });

    // Devices: the detailed model the game draws once a device is complete.
    for (const d of DEVICES) {
      const room = ROOMS.find((r) => r.id === d.room)!;
      if (room.floor !== set.floor || !inBox(box, d.x, d.z)) continue;
      if (set.skipDevices?.includes(d.id)) continue;
      const v = deviceVisual(d.id);
      const det = detailVisual(v, d.id);
      const g = composeVisual(det, 0, true);
      const rot = ((d.rot ?? 0) * Math.PI) / 2;
      const at: V3 = [d.x + 0.5, 1, d.z + 0.5];
      add(
        toUvox(`device:${d.id}`, g, PALETTE, {
          unit: det.scale!,
          origin: at,
          anchor: [g.sx / 2, 0, g.sz / 2],
          rotY: rot,
          meta: { kind: "device", id: d.id, room: d.room },
        }),
      );
      const s = v.scale ?? MODEL_SCALE;
      for (const l of v.lights) {
        const p: V3 = [(l.pos[0] - v.base.w / 2) * s, l.pos[1] * s, (l.pos[2] - v.base.d / 2) * s];
        const w = rotY(p, rot);
        lights.push({
          kind: "device",
          room: d.room,
          pos: [at[0] + w[0], at[1] + w[1], at[2] + w[2]],
          color: l.color,
          intensity: l.intensity,
          distance: l.distance,
          of: d.id,
        });
      }
    }

    // Props.
    for (const p of PROPS) {
      if (p.floor !== set.floor || !inBox(box, p.x, p.z) || p.model === "elevator") continue;
      const variantDecor = p.variant ? PROP_VARIANT_DECOR[p.variant] : undefined;
      const useDecor = variantDecor && DECOR_BY_ID.has(variantDecor);
      const vis = useDecor ? decorVisual(variantDecor!) : propVisual(p.model);
      const base = useDecor ? decorModel(variantDecor!).grid : propModel(p.model).grid;
      const g = vis ? composeVisual({ ...vis, scale: MODEL_SCALE }, 0, true, base) : base;
      add(
        placed(
          `prop:${p.id}`,
          g,
          "prop",
          MODEL_SCALE,
          [p.x + 0.5, 1, p.z + 0.5],
          ((p.rot ?? 0) * Math.PI) / 2,
          { kind: "prop", id: p.id, model: p.model },
        ),
      );
    }

    // Decor.
    for (const p of interiorFor(set.floor)) {
      if (!inBox(box, p.x, p.z)) continue;
      const def = DECOR_BY_ID.get(p.decor);
      const ds = decorScale(p.decor);
      const vis = decorVisual(p.decor);
      const base = decorModel(p.decor);
      const g = vis ? composeVisual({ ...vis, scale: ds }, 0, true, base.grid) : base.grid;
      const fam = familyFor(base, decorFamily(ds));
      add(
        placed(
          `decor:${p.id}`,
          g,
          fam,
          ds,
          [p.x + 0.5, 1 + decorElevation(p), p.z + 0.5],
          (p.rot * Math.PI) / 2,
          { kind: "decor", id: p.id, decor: p.decor, room: p.room, solid: def?.solid ?? false },
        ),
      );
    }
    for (const l of decorLights(set.floor, 999, 99))
      if (inBox(box, l.x, l.z))
        lights.push({
          kind: "decor",
          room: l.room,
          pos: [l.x, l.y, l.z],
          color: l.color,
          intensity: l.intensity,
          distance: l.distance,
          of: l.id,
        });

    const ambient = (await import("@/lib/world/content/map")).FLOOR_BY_ID[set.floor].ambient;
    writeJson(`sets/${set.id}/set.json`, {
      id: set.id,
      floor: set.floor,
      rooms: set.rooms,
      box,
      ambient,
      parts,
      lights,
    });
    index.push({
      id: set.id,
      floor: set.floor,
      rooms: set.rooms,
      parts: parts.length,
      lights: lights.length,
    });
    console.log(
      `[trailer] ${set.id.padEnd(14)} ${parts.length} parts  ${lights.length} lights  ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
  writeJson("sets.json", index);

  // ── Cast: the veiled Damien and the bots (Jade comes from the hero export) ──
  const SUB: V3[] = [];
  for (const a of [0.25, 0.75])
    for (const b of [0.25, 0.75])
      for (const c of [0.25, 0.75]) SUB.push([a - 0.5, b - 0.5, c - 0.5]);
  function posedGrid(
    def: ReturnType<typeof damienRig>,
    kind: Parameters<typeof characterPose>[0],
    t: number,
  ): Grid {
    const joints = jointMatrices(def, characterPose(kind, t, 0, { seed: 3, idleFor: 0 }));
    const cells: [number, number, number, number][] = [];
    for (const part of def.parts) {
      const j = joints.get(part.name)!;
      const [ox, oy, oz] = part.origin;
      part.model.grid.forEach((x, y, z, v) => {
        for (const s of SUB) {
          const p = applyMat(j, [x + 0.5 + s[0] - ox, y + 0.5 + s[1] - oy, z + 0.5 + s[2] - oz]);
          cells.push([Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), v]);
        }
      });
    }
    let mx = Infinity;
    let my = Infinity;
    let mz = Infinity;
    let Mx = -Infinity;
    let My = -Infinity;
    let Mz = -Infinity;
    for (const [x, y, z] of cells) {
      mx = Math.min(mx, x);
      my = Math.min(my, y);
      mz = Math.min(mz, z);
      Mx = Math.max(Mx, x);
      My = Math.max(My, y);
      Mz = Math.max(Mz, z);
    }
    const g = new VoxelGrid(Mx - mx + 1, My - my + 1, Mz - mz + 1);
    for (const [x, y, z, v] of cells) g.set(x - mx, y - my, z - mz, v);
    return g;
  }

  const cast: { id: string; file: string; kind: string }[] = [];
  const castOne = (
    id: string,
    kind: string,
    g: Grid,
    unit: number,
    meta: Record<string, unknown>,
  ) => {
    const m = toUvox(id, g, PALETTE, { unit, anchor: [g.sx / 2, 0, g.sz / 2], meta });
    cast.push({ id, kind, file: writeJson(`cast/${id}.uvox.json`, m) });
  };
  // Damien is never shown unveiled (CLAUDE.md, tests/world/damien-reveal.test.ts).
  const solid = damienRig(false);
  for (const [pose, t] of [
    ["idle", 0],
    ["think", 0.6],
    ["walk", 0.2],
    ["read", 0.4],
  ] as const)
    for (const seed of [0, 1]) {
      const def = veilRig(solid, seed);
      castOne(`damien_veil_${pose}_${seed}`, "damien_veil", posedGrid(def, pose, t), def.scale, {
        kind: "damien_veil",
        pose,
        seed,
      });
    }
  for (const id of BOT_IDS)
    for (const awake of [true, false]) {
      const v = botVisual(id, awake);
      const g = composeVisual(v, 0, awake);
      castOne(`bot_${id}_${awake ? "awake" : "dormant"}`, "bot", g, v.scale ?? 0.125, {
        kind: "bot",
        id,
        awake,
      });
    }
  writeJson("cast.json", cast);
  console.log(`[trailer] cast: ${cast.length} figures → .voxel/trailer/cast`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

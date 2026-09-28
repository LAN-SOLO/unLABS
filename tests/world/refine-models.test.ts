import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { VoxelGrid } from "@/lib/voxel/grid";
import { CHUNK } from "@/lib/voxel/world";
import { C, LAB_PALETTE, labMaterialOf, type ColorName } from "@/lib/world/content/palette";
import { PICKUPS, PROPS } from "@/lib/world/content/map";
import { buildFloor } from "@/lib/world/layout";
import { BOT_IDS, botVisual, mcpAvatarVisual } from "@/lib/world/models/characters";
import { stagedGrid } from "@/lib/world/models/core";
import { DECOR_BY_ID, decorModel, decorScale } from "@/lib/world/models/decor";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import { pickupModel, propModel } from "@/lib/world/models/props";
import { jadeRig } from "@/lib/world/models/rig";
import {
  DARK_PARTNER,
  LIGHT_PARTNER,
  PARTNERS,
  REFINE_RULES,
  clearRefineCache,
  decorFamily,
  refineModel,
  refineTerrainRegion,
  familyFor,
  refinedModelMesh,
  type RefineFamily,
} from "@/lib/world/models/refine";
import { createVoxelMaterials } from "@/lib/world/render/voxel-mesh";
import { WorldRenderer } from "@/lib/world/render/world-renderer";
import type { FloorId } from "@/lib/world/types";

/** Every model the engine meshes, with the family it is refined with. */
function allModels(): [string, VoxelGrid, RefineFamily][] {
  const out: [string, VoxelGrid, RefineFamily][] = [];
  for (const id of DEVICE_VISUAL_IDS) {
    const v = deviceVisual(id);
    out.push(
      [id, v.base.grid, "device"],
      [`${id}/off`, stagedGrid(v.base.grid, 1, false), "device"],
    );
    for (const p of v.parts) out.push([`${id}/${p.name}`, p.model.grid, "device"]);
  }
  for (const id of DECOR_BY_ID.keys())
    out.push([id, decorModel(id).grid, decorFamily(decorScale(id))]);
  for (const m of new Set(PROPS.map((p) => p.model)))
    if (m !== "elevator") out.push([`prop:${m}`, propModel(m).grid, "prop"]);
  for (const m of new Set(PICKUPS.map((p) => p.model)))
    out.push([`pickup:${m}`, pickupModel(m).grid, "pickup"]);
  // Bots, the MCP avatar and the rigs are authored fine: family "hires" (never re-split).
  for (const id of BOT_IDS) {
    const v = botVisual(id, true);
    const fam = familyFor(v, "character");
    out.push([`bot:${id}`, v.base.grid, fam]);
    for (const p of v.parts) out.push([`bot:${id}/${p.name}`, p.model.grid, fam]);
  }
  const mcp = mcpAvatarVisual();
  out.push(["mcp-avatar", mcp.base.grid, familyFor(mcp, "device")]);
  const jade = jadeRig();
  for (const p of jade.parts)
    out.push([`jade/${p.name}`, p.model.grid, familyFor(jade, "character")]);
  return out;
}

const SUBS = [0, 1, 2, 3, 4, 5, 6, 7].map((o) => [o & 1, (o >> 1) & 1, (o >> 2) & 1] as const);

describe("model refinement (every in-game model)", () => {
  const models = allModels();

  it("covers all model kinds", () => {
    expect(models.length).toBeGreaterThan(400);
  });

  it("keeps the silhouette: 2× size, ≥ 4 of 8 sub-voxels per voxel, nothing added", () => {
    const bad: string[] = [];
    for (const [name, g, fam] of models) {
      if (fam === "hires") continue;
      const f = refineModel(g, fam);
      expect([f.sx, f.sy, f.sz]).toEqual([g.sx * 2, g.sy * 2, g.sz * 2]);
      let fine = 0;
      g.forEach((x, y, z, v) => {
        let n = 0;
        for (const [ox, oy, oz] of SUBS) if (f.get(2 * x + ox, 2 * y + oy, 2 * z + oz)) n++;
        fine += n;
        if (n < 4) bad.push(`${name} @${x},${y},${z}: ${n}`);
        // Glass and emissive voxels are never cut.
        const cls = labMaterialOf(v);
        if ((cls === "glass" || cls === "emit") && n !== 8) bad.push(`${name} ${cls} cut`);
      });
      if (fine !== f.count()) bad.push(`${name}: voxels outside the source silhouette`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("never opens holes in 1-voxel-thin parts", () => {
    const bad: string[] = [];
    for (const [name, g, fam] of models) {
      if (fam === "hires") continue;
      const f = refineModel(g, fam);
      g.forEach((x, y, z) => {
        const p = [x, y, z];
        for (let a = 0; a < 3; a++) {
          const lo = [...p];
          const hi = [...p];
          lo[a]!--;
          hi[a]!++;
          if (g.get(lo[0]!, lo[1]!, lo[2]!) || g.get(hi[0]!, hi[1]!, hi[2]!)) continue;
          // Thin along a: every (u, v) sub-column through the voxel stays covered.
          for (const [ox, oy, oz] of SUBS) {
            const o = [ox, oy, oz];
            if (o[a] !== 0) continue;
            const q0 = [2 * x + ox, 2 * y + oy, 2 * z + oz];
            const q1 = [...q0];
            q1[a]!++;
            if (!f.get(q0[0]!, q0[1]!, q0[2]!) && !f.get(q1[0]!, q1[1]!, q1[2]!))
              bad.push(`${name} @${x},${y},${z} axis ${a}`);
          }
        }
      });
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("meshes in source units, cached per content and family", () => {
    clearRefineCache();
    for (const [, g, fam] of models.slice(0, 60)) {
      const m = refinedModelMesh(g, fam, { center: true });
      let maxXZ = 0;
      let maxY = -Infinity;
      let minY = Infinity;
      for (let i = 0; i < m.positions.length; i += 3) {
        maxXZ = Math.max(
          maxXZ,
          Math.abs(m.positions[i]!) - g.sx / 2,
          Math.abs(m.positions[i + 2]!) - g.sz / 2,
        );
        maxY = Math.max(maxY, m.positions[i + 1]!);
        minY = Math.min(minY, m.positions[i + 1]!);
      }
      expect(maxXZ).toBeLessThanOrEqual(0);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxY).toBeLessThanOrEqual(g.sy);
      expect(refinedModelMesh(g, fam, { center: true })).toBe(m);
    }
    const g = models[0]![1];
    expect(refinedModelMesh(g, "plain")).not.toBe(refinedModelMesh(g, "device"));
  });

  it("fine characters (bots, MCP avatar, rigs) are never refined twice", () => {
    const fine = models.filter(([, , fam]) => fam === "hires");
    // 10 bots with their parts, the MCP avatar, Jade's 15 parts.
    expect(fine.length).toBeGreaterThan(80);
    expect(fine.filter(([n]) => n.startsWith("bot:") && !n.includes("/")).length).toBe(
      BOT_IDS.length,
    );
    clearRefineCache();
    for (const [name, g] of fine) {
      expect(refineModel(g, "hires"), name).toBe(g);
      // Meshed as authored, in the model's own units (same extent as the grid).
      const m = refinedModelMesh(g, "hires", { center: true });
      let maxXZ = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < m.positions.length; i += 3) {
        maxXZ = Math.max(
          maxXZ,
          Math.abs(m.positions[i]!) - g.sx / 2,
          Math.abs(m.positions[i + 2]!) - g.sz / 2,
        );
        maxY = Math.max(maxY, m.positions[i + 1]!);
      }
      expect(maxXZ, name).toBeLessThanOrEqual(0);
      expect(maxY, name).toBeLessThanOrEqual(g.sy);
    }
    // A bot base meshes to the same quads whether asked for as "hires" or via the flag.
    const v = botVisual("f1ndr");
    expect(v.fine).toBe(true);
    expect(familyFor(v, "character")).toBe("hires");
    expect(familyFor(deviceVisual(DEVICE_VISUAL_IDS[0]!), "device")).toBe("device");
    expect(familyFor(jadeRig(), "character")).toBe("hires");
    expect(REFINE_RULES.hires).toEqual({});
  });

  it("detail decor only gets subdivision + a light bevel", () => {
    expect(REFINE_RULES.detail).toEqual({ bevel: 4 });
    expect(decorFamily(0.25)).toBe("detail");
    expect(decorFamily(0.5)).toBe("decor");
  });
});

describe("partner colours", () => {
  it("keep the material class and exist in the palette", () => {
    for (const [name, [dk, lt]] of Object.entries(PARTNERS) as [
      ColorName,
      readonly [ColorName | null, ColorName | null],
    ][]) {
      const cls = labMaterialOf(C[name]);
      for (const p of [dk, lt]) if (p) expect([name, labMaterialOf(C[p])]).toEqual([name, cls]);
      if (dk) expect(DARK_PARTNER[C[name]]).toBe(C[dk]);
      if (lt) expect(LIGHT_PARTNER[C[name]]).toBe(C[lt]);
    }
  });

  it("dark partners are darker, light partners lighter", () => {
    const lum = (i: number): number => {
      const [r, g, b] = LAB_PALETTE.get(i);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (let i = 1; i < 256; i++) {
      if (DARK_PARTNER[i]) expect(lum(DARK_PARTNER[i]!)).toBeLessThan(lum(i));
      if (LIGHT_PARTNER[i]) expect(lum(LIGHT_PARTNER[i]!)).toBeGreaterThan(lum(i));
    }
  });

  it("the palette still fits 255 entries", () => {
    expect(Object.keys(C).length).toBeLessThanOrEqual(255);
  });
});

describe("terrain refinement", () => {
  it("never opens holes in walls or floors of any floor", () => {
    const bad: string[] = [];
    for (const floor of [0, 1, 2, 3, 4, 5] as FloorId[]) {
      const w = buildFloor(floor).world;
      const f = refineTerrainRegion(w, [0, 0, 0], [w.sx, w.sy, w.sz]);
      for (let y = 0; y < w.sy; y++)
        for (let z = 0; z < w.sz; z++)
          for (let x = 0; x < w.sx; x++) {
            if (!w.get(x, y, z)) continue;
            let n = 0;
            for (const [ox, oy, oz] of SUBS) if (f.get(2 * x + ox, 2 * y + oy, 2 * z + oz)) n++;
            if (n < 4) bad.push(`floor ${floor} @${x},${y},${z}: ${n}`);
            // Walls are 1 voxel thick: the view through them must stay closed.
            for (let a = 0; a < 3; a += 2) {
              const dx = a === 0 ? 1 : 0;
              const dz = a === 2 ? 1 : 0;
              if (w.get(x - dx, y, z - dz) || w.get(x + dx, y, z + dz)) continue;
              for (const [ox, oy, oz] of SUBS) {
                if ((a === 0 ? ox : oz) !== 0) continue;
                const hit =
                  f.get(2 * x + ox, 2 * y + oy, 2 * z + oz) ||
                  f.get(2 * x + ox + dx, 2 * y + oy, 2 * z + oz + dz);
                if (!hit) bad.push(`floor ${floor} hole @${x},${y},${z}`);
              }
            }
          }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it("renders chunks seamlessly and re-refines neighbours of border edits", () => {
    const w = buildFloor(0).world;
    const materials = createVoxelMaterials();
    const r = new WorldRenderer(
      w,
      LAB_PALETTE,
      materials,
      labMaterialOf,
      undefined,
      refineTerrainRegion,
    );
    r.syncAll();
    expect(w.dirtyReach).toBeGreaterThan(0);
    const mesh = r.root.children.find((o) => o.name === "terrain") as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    // Half-size sub-voxels, but the terrain spans the same world box.
    expect(bb.min.x).toBeGreaterThanOrEqual(0);
    expect(bb.max.x).toBeLessThanOrEqual(w.sx);
    expect(bb.max.y).toBeLessThanOrEqual(w.sy);
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    let halves = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs((pos.getX(i) % 1) - 0.5) < 1e-6) halves++;
    expect(halves).toBeGreaterThan(0);
    // An edit two voxels inside a chunk dirties its neighbour across the border.
    const x = CHUNK * 2 + 2;
    const z = 40;
    w.dirty.clear();
    w.set(x, 3, z, w.get(x, 3, z) ? 0 : C.wall);
    expect(w.dirty.has(`1,0,1`)).toBe(true);
    expect(w.dirty.has(`2,0,1`)).toBe(true);
    r.syncAll();
    expect(w.dirty.size).toBe(0);
    r.dispose();
  });
});

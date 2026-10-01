/**
 * Dev / docs: dump the aging stages of a few decor pieces for a Blender
 * contact sheet (plants growing and wilting, dust, rust, crystals).
 *
 *   pnpm exec vite-node --config scripts/audio/vite.config.mjs scripts/crystal/aging-stages.ts
 *   → .crystal/aging/<piece>-<stage>.json (crystal dump format, scripts/crystal/blender/crystal/dump.py)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { FRESH, type AgeLook } from "@/lib/world/aging";
import { C, LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { agedDecorModel, agedVisual } from "@/lib/world/models/decor-aging";
import { decorVisual } from "@/lib/world/models/decor";
import { VoxelGrid } from "@/lib/voxel/grid";

const OUT = ".crystal/aging";
const NAME = new Map<number, string>(Object.entries(C).map(([n, i]) => [i, n]));

/** Base + rig parts (rest pose, at their offsets) merged into one grid, room above for foliage. */
function merged(decor: string, look: AgeLook): VoxelGrid {
  const base = agedDecorModel(decor, look).grid;
  const raw = decorVisual(decor);
  if (!raw) return base;
  const v = agedVisual(decor, raw, look);
  const g = new VoxelGrid(base.sx, base.sy + 24, base.sz);
  base.forEach((x, y, z, c) => g.set(x, y, z, c));
  for (const p of v.parts)
    p.model.grid.forEach((x, y, z, c) => {
      const X = x + p.offset[0];
      const Y = y + p.offset[1];
      const Z = z + p.offset[2];
      if (g.inBounds(X, Y, Z)) g.set(X, Y, Z, c);
    });
  return g;
}

function dump(id: string, g: VoxelGrid) {
  const local = new Map<number, number>();
  const palette: { hex: string; mat: string; name: string }[] = [];
  const runs: number[] = [];
  const idx = (v: number): number => {
    if (!v) return 0;
    let i = local.get(v);
    if (i === undefined) {
      const [r, gg, b] = LAB_PALETTE.get(v);
      palette.push({
        hex: `#${[r, gg, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`,
        mat: labMaterialOf(v),
        name: NAME.get(v) ?? `c${v}`,
      });
      i = palette.length;
      local.set(v, i);
    }
    return i;
  };
  for (let i = 0; i < g.data.length; ) {
    let j = i + 1;
    while (j < g.data.length && g.data[j] === g.data[i]) j++;
    runs.push(idx(g.data[i]!), j - i);
    i = j;
  }
  writeFileSync(
    `${OUT}/${id}.json`,
    JSON.stringify({
      id,
      name: id,
      family: "decor",
      unit: 1,
      size: [g.sx, g.sy, g.sz],
      palette,
      runs,
    }),
  );
}

mkdirSync(OUT, { recursive: true });
for (let grow = 0; grow < 5; grow++)
  dump(`fern-grow${grow}`, merged("plant_fern", { ...FRESH, grow }));
for (let wilt = 1; wilt < 3; wilt++)
  dump(`fern-wilt${wilt}`, merged("plant_fern", { ...FRESH, wilt }));
for (const w of [0, 3])
  dump(`crates-dust${w}`, agedDecorModel("crate_stack", { ...FRESH, weather: w }).grid);
dump("crates-rust3", agedDecorModel("crate_stack", { ...FRESH, weather: 3, damp: true }).grid);
for (let k = 0; k < 4; k++)
  dump(`crystal-${k}`, agedDecorModel("crystal_cluster", { ...FRESH, crystal: k }).grid);
console.log("aging stages →", OUT);

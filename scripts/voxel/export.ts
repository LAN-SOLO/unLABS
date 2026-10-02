/**
 * Voxel export: every device and every door of the game as uvox
 * (lib/voxel/uvox.ts) plus a reference picture made by the game's own iso
 * baker with the undevbook's exact rules — the ground truth Blender's clones
 * are checked against (docs/VOXEL-BLENDER.md).
 *
 *   pnpm voxel:export                  all
 *   pnpm voxel:export CDC-001,d_mcp    only ids starting with one of these
 *
 * Writes .voxel/ (gitignored):
 *   models/devices/<ID>.uvox.json         composed + refined, what the book shows
 *   models/devices/<ID>.source.uvox.json  composed, authoring resolution
 *   models/device-details/<ID>.uvox.json   the detailed device the game draws (models/detail.ts)
 *   models/doors/<id>.scene.json          the engine's assembly (refined parts, placed)
 *   models/doors/<id>.uvox.json           the assembly snapped into one grid
 *   models/doors/frame.uvox.json          the book's door frame picture
 *   models/airlocks/<id>.scene.json|uvox.json
 *   ref/<kind>/<id>.png                   iso-baker reference (book rules)
 *   inventory.json
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bakeIsoSprite } from "@/lib/voxel/iso-baker";
import { VoxelGrid } from "@/lib/voxel/grid";
import {
  combine,
  gridSha,
  mirror,
  rotateY90,
  toUvox,
  upsample,
  type PaletteSource,
  type UvoxModel,
  type UvoxScene,
} from "@/lib/voxel/uvox";
import { C, LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { DEVICES } from "@/lib/world/content/devices";
import { DOORS } from "@/lib/world/content/map";
import { AIRLOCKS } from "@/lib/world/doors/airlock";
import { composeVisual } from "@/lib/world/models/compose";
import { detailVisual } from "@/lib/world/models/detail";
import { MODEL_SCALE } from "@/lib/world/models/core";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import { DOOR_SCALE, doorFrameModel } from "@/lib/world/models/doors";
import { refineModel } from "@/lib/world/models/refine";
import { airlockAssembly, doorAssembly, type DoorPart } from "./door-parts";
import { png, scaleFor, trim } from "./png";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, ".voxel");
const BOOK = join(ROOT, "../unlabsundevbook/public/sprites");
const ONLY = process.argv
  .slice(2)
  .find((a) => !a.startsWith("--"))
  ?.split(",")
  .filter(Boolean);
const wanted = (id: string): boolean => !ONLY || ONLY.some((p) => id.startsWith(p));

const NAME = new Map<number, string>(Object.entries(C).map(([n, i]) => [i, n]));
const PALETTE: PaletteSource = {
  rgb: (i) => {
    const [r, g, b] = LAB_PALETTE.get(i);
    return [r, g, b];
  },
  mat: (i) => labMaterialOf(i),
  name: (i) => NAME.get(i) ?? `c${i}`,
};

interface Entry {
  id: string;
  kind: "device" | "device-detail" | "door" | "airlock" | "frame";
  uvox: string;
  source?: string;
  scene?: string;
  ref: string;
  /** The undevbook's picture of the same grid (absent for models the book doesn't show). */
  book?: string;
  /** Iso pixel scale (half-width of a voxel's top face). */
  scale: number;
  sha: string;
  size: [number, number, number];
  unit: number;
  voxels: number;
}
const inventory: Entry[] = [];

function writeJson(rel: string, data: unknown): string {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return rel;
}

/** The book's `write()`: baker with outline, trimmed. */
function writeRef(rel: string, g: VoxelGrid, scale: number): string {
  const sp = bakeIsoSprite(g, LAB_PALETTE, { scale, outline: true });
  const t = trim(sp.width, sp.height, sp.data);
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png(t.w, t.h, t.d));
  return rel;
}

function entry(
  id: string,
  kind: Entry["kind"],
  model: UvoxModel,
  grid: VoxelGrid,
  scale: number,
  extra: Partial<Entry> = {},
): void {
  const ref = writeRef(`ref/${kind}s/${id}.png`, grid, scale);
  inventory.push({
    id,
    kind,
    uvox: extra.uvox ?? "",
    ref,
    scale,
    sha: model.sha,
    size: model.size,
    unit: model.unit,
    voxels: grid.count(),
    ...extra,
  });
}

// ── Devices ──────────────────────────────────────────────────────
const deviceIds = [...new Set([...DEVICES.map((d) => d.id), ...DEVICE_VISUAL_IDS])];
for (const id of deviceIds) {
  if (!wanted(id)) continue;
  const v = deviceVisual(id);
  const src = composeVisual(v, 0, true);
  const full = refineModel(src, "device");
  const k = full.sx / src.sx;
  const unitSrc = v.scale ?? MODEL_SCALE;
  const unit = unitSrc / k;
  const meta = { kind: "device", family: "device", refined: k, sourceUnit: unitSrc };
  const m = toUvox(id, full, PALETTE, { unit, meta });
  const s = toUvox(`${id}.source`, src, PALETTE, { unit: unitSrc, meta });
  const uvox = writeJson(`models/devices/${id}.uvox.json`, m);
  const source = writeJson(`models/devices/${id}.source.uvox.json`, s);
  // The book shows the detailed device since 0.4.2 (see device-detail below).
  entry(id, "device", m, full, scaleFor(full, 300), { uvox, source });
}

// ── Detailed devices (what the game draws since 0.4.2, models/detail.ts) ──
for (const id of deviceIds) {
  if (!wanted(id)) continue;
  const d = detailVisual(deviceVisual(id), id);
  const g = composeVisual(d, 0, true);
  const m = toUvox(id, g, PALETTE, { unit: d.scale!, meta: { kind: "device-detail" } });
  const uvox = writeJson(`models/device-details/${id}.uvox.json`, m);
  const book = join(BOOK, `devices/${id}/rot-0.png`);
  entry(id, "device-detail", m, g, scaleFor(g, 300), {
    uvox,
    ...(existsSync(book) ? { book } : {}),
  });
}

// ── Doors ────────────────────────────────────────────────────────

/** Engine placement of a door part: refined grid, centred in x/z, scaled by DOOR_SCALE. */
function placedPart(p: DoorPart, i: number, prefix: string): UvoxModel {
  const fine = refineModel(p.grid, "architecture");
  const k = fine.sx / p.grid.sx;
  return toUvox(`${prefix}#${i}:${p.use}`, fine, PALETTE, {
    unit: DOOR_SCALE / k,
    origin: p.at,
    anchor: [fine.sx / 2, 0, fine.sz / 2],
    rotY: p.rotY,
    meta: {
      part: p.use,
      refined: k,
      // Secret leaves are drawn a hair thinner than the wall (engine: scale.z = DOOR_SCALE · 0.98).
      ...(p.use.startsWith("door-secret-") && !p.use.endsWith("/cover") ? { scaleZ: 0.98 } : {}),
    },
  });
}

/**
 * The assembly in one grid on the lattice of `unit`, like the book composes
 * rigs: every voxel centre is placed and floored onto the lattice.
 */
function snapCompose(parts: UvoxModel[], grids: VoxelGrid[], unit: number): VoxelGrid {
  const pts: [number, number, number, number][] = [];
  parts.forEach((m, i) => {
    const c = Math.cos(m.rotY);
    const s = Math.sin(m.rotY);
    grids[i]!.forEach((x, y, z, v) => {
      const lx = (x + 0.5 - m.anchor[0]) * m.unit;
      const ly = (y + 0.5 - m.anchor[1]) * m.unit;
      const lz = (z + 0.5 - m.anchor[2]) * m.unit;
      // three.js rotation.y: x' = x·cos + z·sin, z' = −x·sin + z·cos.
      const wx = m.origin[0] + lx * c + lz * s;
      const wy = m.origin[1] + ly;
      const wz = m.origin[2] - lx * s + lz * c;
      pts.push([Math.floor(wx / unit), Math.floor(wy / unit), Math.floor(wz / unit), v]);
    });
  });
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a]!, p[a]!);
      hi[a] = Math.max(hi[a]!, p[a]! + 1);
    }
  const g = new VoxelGrid(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!);
  for (const [x, y, z, v] of pts) g.set(x - lo[0]!, y - lo[1]!, z - lo[2]!, v);
  return g;
}

function exportAssembly(id: string, kind: "door" | "airlock", parts: DoorPart[]): void {
  const models = parts.map((p, i) => placedPart(p, i, id));
  const grids = parts.map((p) => refineModel(p.grid, "architecture"));
  const unit = Math.min(...models.map((m) => m.unit));
  const one = snapCompose(models, grids, unit);
  const scene: UvoxScene = {
    format: "uvox-scene",
    version: 1,
    id,
    parts: models,
    meta: { kind, frame: "door-local world units (engine door root, y from the floor)" },
  };
  const m = toUvox(id, one, PALETTE, {
    unit,
    meta: { kind, composed: "snap", parts: models.length },
  });
  const sceneRel = writeJson(`models/${kind}s/${id}.scene.json`, scene);
  const uvox = writeJson(`models/${kind}s/${id}.uvox.json`, m);
  entry(id, kind, m, one, scaleFor(one, 300), { uvox, scene: sceneRel });
}

{
  // The book's only door picture: the uniform frame (sprites.ts: scale 2).
  const g = refineModel(doorFrameModel().grid, "architecture");
  const m = toUvox("frame", g, PALETTE, { unit: DOOR_SCALE / (g.sx / doorFrameModel().grid.sx) });
  const uvox = writeJson("models/doors/frame.uvox.json", m);
  const book = join(BOOK, "doors/frame.png");
  if (wanted("frame"))
    entry("frame", "frame", m, g, 2, { uvox, ...(existsSync(book) ? { book } : {}) });
}
for (const d of [...DOORS].sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id)))
  if (wanted(d.id)) exportAssembly(d.id, "door", doorAssembly(d));
for (const a of AIRLOCKS) {
  const id = `airlock-${a.id}`;
  if (!wanted(id)) continue;
  const outer = DOORS.find((d) => d.id === a.outer)!;
  exportAssembly(id, "airlock", [...doorAssembly(outer), ...airlockAssembly(a).parts]);
}

// ── The game palette (Blender: primitives, voxelize, paint use game colours only) ──
writeJson(
  "palette.json",
  [...NAME.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, name]) => ({ index, name, rgb: PALETTE.rgb(index), mat: PALETTE.mat(index) })),
);

// ── Cross-language fixtures (scripts/voxel/blender/cli.py selftest) ──
if (!ONLY) {
  const a = composeVisual(deviceVisual("CLK-001"), 0, true);
  const b = refineModel(composeVisual(deviceVisual("CDC-001"), 0, true), "device");
  const sha = (g: VoxelGrid): string => gridSha(g);
  const fixtures = {
    a: writeJson("fixtures/a.uvox.json", toUvox("a", a, PALETTE, { unit: 0.5 })),
    b: writeJson("fixtures/b.uvox.json", toUvox("b", b, PALETTE, { unit: 0.25 })),
    expect: {
      rot1: sha(rotateY90(a, 1)),
      rot2: sha(rotateY90(a, 2)),
      rot3: sha(rotateY90(a, 3)),
      mirrorX: sha(mirror(a, "x")),
      mirrorY: sha(mirror(a, "y")),
      mirrorZ: sha(mirror(a, "z")),
      up3: sha(upsample(a, 3)),
      // Mixed sizes: a (0.5) at the origin, b (0.25) mounted at (1.75, 0.5, −0.25).
      combine: sha(
        combine([
          { grid: a, unit: 0.5, origin: [0, 0, 0] },
          { grid: b, unit: 0.25, origin: [1.75, 0.5, -0.25] },
        ]).grid,
      ),
    },
  };
  writeJson("fixtures/expect.json", fixtures);
}

writeFileSync(
  join(OUT, ONLY ? "inventory.partial.json" : "inventory.json"),
  JSON.stringify({ generated: new Date().toISOString(), models: inventory }, null, 1),
);
const by = new Map<string, number>();
for (const e of inventory) by.set(e.kind, (by.get(e.kind) ?? 0) + 1);
console.log(
  `voxel export: ${inventory.length} models (${[...by].map(([k, n]) => `${k} ${n}`).join(" · ")}), ` +
    `${inventory.reduce((s, e) => s + e.voxels, 0).toLocaleString()} voxels → ${OUT}`,
);

/**
 * Dumps the game's hi-res voxel models (lore bots awake + dormant, the MCP
 * avatar, Jade in a few poses, a few devices) as small JSON files for the
 * merch motifs — `scripts/merch/voxels/<id>.json`, drawn as isometric
 * vector art by `isoModel()` in voxel-art.ts. Needs the `@/` alias, so it runs
 * with vite-node (render.ts itself stays dependency-free):
 *
 *   pnpm exec vite-node --config scripts/audio/vite.config.mjs scripts/merch/export-voxels.ts [id,id]
 *
 * JSON format (see `VoxelDump` in voxel-art.ts): size [sx, sy, sz] (y up, the
 * model's front faces +z), a local palette (hex, material class, lab colour
 * name) and run-length encoded cells in x-fastest order
 * (index = x + sx · (y + sy · z)), `runs = [paletteIndex, count, …]`, 0 = empty.
 * The files are run through Prettier afterwards (repo format check).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { C, LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { animTransform, type AnimPart, type DeviceVisual } from "@/lib/world/models/anim";
import { BOT_IDS, botVisual, mcpAvatarVisual } from "@/lib/world/models/characters";
import { stagedGrid } from "@/lib/world/models/core";
import { deviceVisual } from "@/lib/world/models/devices";
import {
  applyMat,
  characterPose,
  handProp,
  jadeRig,
  jointMatrices,
  propForPose,
  type CharacterPose,
  type CharacterPoseKind,
} from "@/lib/world/models/rig";
import type { VoxelGrid } from "@/lib/voxel/grid";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "voxels");
const ONLY = process.argv[2]?.split(",");

type V3 = [number, number, number];

const NAME_BY_INDEX = new Map<number, string>(Object.entries(C).map(([n, i]) => [i, n]));

/** Sparse voxel set keyed "x,y,z" (coordinates may be negative until packed). */
class Cells {
  readonly map = new Map<string, number>();
  set(x: number, y: number, z: number, v: number, overwrite = true): void {
    const k = `${x},${y},${z}`;
    if (!overwrite && this.map.has(k)) return;
    this.map.set(k, v);
  }
  grid(g: VoxelGrid, o: V3 = [0, 0, 0]): void {
    g.forEach((x, y, z, v) => this.set(x + o[0], y + o[1], z + o[2], v));
  }
}

// ── Rotation (three.js Euler "XYZ": M = Rx · Ry · Rz) ────────────

function rotate(p: V3, r: V3): V3 {
  let [x, y, z] = p;
  // Rz, then Ry, then Rx (applied right to left).
  const [cx, sx] = [Math.cos(r[0]), Math.sin(r[0])];
  const [cy, sy] = [Math.cos(r[1]), Math.sin(r[1])];
  const [cz, sz] = [Math.cos(r[2]), Math.sin(r[2])];
  [x, y] = [x * cz - y * sz, x * sz + y * cz];
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  [y, z] = [y * cx - z * sx, y * sx + z * cx];
  return [x, y, z];
}

/** Sub-voxel sample offsets: rotated parts are stamped from 8 samples so they stay closed. */
const SUB: readonly V3[] = [-0.25, 0.25].flatMap((a) =>
  [-0.25, 0.25].flatMap((b) => [-0.25, 0.25].map((c): V3 => [a, b, c])),
);

function stampPart(cells: Cells, part: AnimPart, t: number, powered: boolean, dim: boolean): void {
  const st = animTransform(part, t, powered);
  // Awake: short flashes (blink duty < 0.5) are off, steady lights are on.
  const visible =
    part.kind === "blink" && (powered || !part.requiresPower)
      ? (part.amplitude ?? 0.5) >= 0.5
      : st.visible;
  if (!visible) return;
  const g = dim ? stagedGrid(part.model.grid, 1, false) : part.model.grid;
  const rotated = st.rot.some((a) => Math.abs(a) > 1e-4);
  const [px, py, pz] = part.pivot;
  const base: V3 = [
    part.offset[0] + px + st.pos[0],
    part.offset[1] + py + st.pos[1],
    part.offset[2] + pz + st.pos[2],
  ];
  g.forEach((x, y, z, v) => {
    const samples = rotated ? SUB : ([[0, 0, 0]] as const);
    for (const s of samples) {
      const local: V3 = [x + 0.5 + s[0] - px, y + 0.5 + s[1] - py, z + 0.5 + s[2] - pz];
      const w = rotated ? rotate(local, st.rot) : local;
      cells.set(
        Math.floor(base[0] + w[0]),
        Math.floor(base[1] + w[1]),
        Math.floor(base[2] + w[2]),
        v,
      );
    }
  });
}

/** Base + every part at its t = 0 pose (awake) or slumped, dark rest pose (dormant). */
function visualCells(v: DeviceVisual, powered: boolean, t = 0): Cells {
  const cells = new Cells();
  cells.grid(v.base.grid);
  for (const p of v.parts) {
    if (p.parent) continue; // bots / avatar never nest parts; devices: skip riders.
    stampPart(cells, p, t, powered, !powered && p.requiresPower);
  }
  return cells;
}

// ── Jade (jointed rig) ───────────────────────────────────────────

function jadeCells(kind: CharacterPoseKind, t: number): Cells {
  const def = jadeRig();
  const pose: Partial<CharacterPose> = characterPose(kind, t, 0, { seed: 3, idleFor: 0 });
  const joints = jointMatrices(def, pose);
  const cells = new Cells();
  for (const part of def.parts) {
    // Lids and brows only show when they move out of the skull — keep them.
    const j = joints.get(part.name)!;
    const [ox, oy, oz] = part.origin;
    part.model.grid.forEach((x, y, z, v) => {
      for (const s of SUB) {
        const p = applyMat(j, [x + 0.5 + s[0] - ox, y + 0.5 + s[1] - oy, z + 0.5 + s[2] - oz]);
        cells.set(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), v);
      }
    });
  }
  const propKind = propForPose(kind);
  if (propKind) {
    const prop = handProp(propKind);
    const j = joints.get(prop.joint);
    if (j) {
      const k = prop.scale;
      const [ax, ay, az] = prop.anchor;
      prop.model.grid.forEach((x, y, z, v) => {
        // Props are modelled at pose-unit size: fill every rig voxel they cover.
        for (let dx = 0; dx < k; dx++)
          for (let dy = 0; dy < k; dy++)
            for (let dz = 0; dz < k; dz++) {
              const p = applyMat(j, [
                x * k + dx + 0.5 + ax,
                y * k + dy + 0.5 + ay,
                z * k + dz + 0.5 + az,
              ]);
              cells.set(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), v);
            }
      });
    }
  }
  return cells;
}

// ── Packing ──────────────────────────────────────────────────────

interface Dump {
  id: string;
  name: string;
  size: V3;
  palette: { hex: string; mat: string; name: string }[];
  runs: number[];
}

function pack(id: string, name: string, cells: Cells): Dump {
  const pts = [...cells.map].map(([k, v]) => {
    const [x, y, z] = k.split(",").map(Number) as V3;
    return { x, y, z, v };
  });
  if (!pts.length) throw new Error(`${id}: no voxels`);
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    min[0] = Math.min(min[0], p.x);
    min[1] = Math.min(min[1], p.y);
    min[2] = Math.min(min[2], p.z);
    max[0] = Math.max(max[0], p.x);
    max[1] = Math.max(max[1], p.y);
    max[2] = Math.max(max[2], p.z);
  }
  const size: V3 = [max[0] - min[0] + 1, max[1] - min[1] + 1, max[2] - min[2] + 1];
  const local = new Map<number, number>();
  const palette: Dump["palette"] = [];
  const data = new Uint8Array(size[0] * size[1] * size[2]);
  for (const p of pts) {
    let li = local.get(p.v);
    if (li === undefined) {
      const [r, g, b] = LAB_PALETTE.get(p.v);
      palette.push({
        hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`,
        mat: labMaterialOf(p.v),
        name: NAME_BY_INDEX.get(p.v) ?? `c${p.v}`,
      });
      li = palette.length;
      local.set(p.v, li);
    }
    data[p.x - min[0] + size[0] * (p.y - min[1] + size[1] * (p.z - min[2]))] = li;
  }
  const runs: number[] = [];
  for (let i = 0; i < data.length; ) {
    let j = i + 1;
    while (j < data.length && data[j] === data[i]) j++;
    runs.push(data[i]!, j - i);
    i = j;
  }
  return { id, name, size, palette, runs };
}

// ── Catalogue ────────────────────────────────────────────────────

const BOT_NAMES: Record<string, string> = {
  x0r8t: "X0-R8T",
  f1ndr: "F1N-DR",
  l0g1k: "L0G-1K",
  p1ndr0: "P1N-DR0",
  r3tr0: "R3-TR0",
  b4c0n: "B4C-0N",
  d3c4d3: "D3-C4D3",
  w2rek: "W2-REK",
  k2ldr: "K2-LDR",
  c8br41n: "C8-BR41N",
};

const JOBS: { id: string; name: string; build: () => Cells }[] = [
  ...BOT_IDS.flatMap((b) => [
    { id: `bot-${b}`, name: BOT_NAMES[b] ?? b, build: () => visualCells(botVisual(b, true), true) },
    {
      id: `bot-${b}-dormant`,
      name: `${BOT_NAMES[b] ?? b} (dormant)`,
      build: () => visualCells(botVisual(b, false), false),
    },
  ]),
  { id: "mcp-avatar", name: "MCP avatar", build: () => visualCells(mcpAvatarVisual(), true) },
  { id: "jade-idle", name: "Jade (idle)", build: () => jadeCells("idle", 0) },
  { id: "jade-wave", name: "Jade (wave)", build: () => jadeCells("wave", 0.5) },
  { id: "jade-celebrate", name: "Jade (celebrate)", build: () => jadeCells("celebrate", 0.11) },
  { id: "jade-think", name: "Jade (think)", build: () => jadeCells("think", 1.2) },
  { id: "jade-drink", name: "Jade (coffee)", build: () => jadeCells("drink", 2.0) },
  { id: "jade-work", name: "Jade (wrench)", build: () => jadeCells("work", 0.4) },
  { id: "jade-startle", name: "Jade (startled)", build: () => jadeCells("startle", 0.35) },
  { id: "dev-mcp-000", name: "MCP-000", build: () => visualCells(deviceVisual("MCP-000"), true) },
  { id: "dev-cdc-001", name: "CDC-001", build: () => visualCells(deviceVisual("CDC-001"), true) },
  { id: "dev-exd-001", name: "EXD-001", build: () => visualCells(deviceVisual("EXD-001"), true) },
];

mkdirSync(OUT, { recursive: true });
for (const job of JOBS) {
  if (ONLY && !ONLY.includes(job.id)) continue;
  try {
    const dump = pack(job.id, job.name, job.build());
    const json = JSON.stringify(dump);
    writeFileSync(join(OUT, `${job.id}.json`), json + "\n");
    const n = dump.runs.reduce((s, v, i) => (i % 2 && dump.runs[i - 1] ? s + v : s), 0);
    console.log(
      `✓ ${job.id.padEnd(22)} ${dump.size.join("×").padEnd(10)} ${String(n).padStart(6)} vox  ${dump.palette.length} col  ${(json.length / 1024).toFixed(1)} KB`,
    );
  } catch (e) {
    console.error(`✗ ${job.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Keep the dumps in repo style (`pnpm format:check` covers scripts/).
execFileSync("pnpm", ["exec", "prettier", "--log-level", "warn", "--write", OUT], {
  stdio: "inherit",
});

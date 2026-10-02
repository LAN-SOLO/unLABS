/**
 * Crystal inventory: every voxel model grid the lab engine meshes, dumped
 * once per unique content (the engine's `gridHash`) for the Blender
 * pipeline — `.crystal/dumps/<key>.json` + `.crystal/inventory.json`.
 *
 *   pnpm crystal:export            (all)
 *   pnpm crystal:export dev-,bot-  (only ids starting with one of the prefixes)
 *
 * Covered: devices (complete, powered + unpowered, base + rig parts), lore
 * bots (awake + dormant + upgrade levels 1–3), the MCP avatar, props (base, rig parts, variant
 * decor), pickups, notes, all decor (+ animated decor parts), doors (frames,
 * beacons, leaves, secret covers), elevators, room terminals, hand props.
 *
 * Not covered on purpose: Jade (the hero — never voxels in the crystal age),
 * Damien and his veil (hidden until `isDamienRevealed()` — no revealed form
 * may leave this script), partial build stages (the crystal age needs every
 * device complete).
 *
 * Terrain: every allocated 32³ chunk of every floor (+ a 2-voxel ring of
 * context, cropped away in Blender), for lamps lit / dark × the three wall
 * cutaway modes — keyed like the engine keys it (`terrainChunkKey`).
 * `--no-terrain` skips it.
 *
 * Dump format: scripts/crystal/blender/crystal/dump.py.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VoxelGrid } from "@/lib/voxel/grid";
import { CHUNK, VoxelWorld } from "@/lib/voxel/world";
import { TERRAIN_RING, terrainChunkKey } from "@/lib/world/crystal";
import { DEVICES } from "@/lib/world/content/devices";
import { PROP_VARIANT_DECOR } from "@/lib/world/content/decor-actions";
import { animatedDecor, interiorFloors } from "@/lib/world/content/interior";
import {
  DOORS,
  ELEVATORS,
  FLOORS,
  FLOOR_SIZE,
  NOTES,
  PICKUPS,
  PROPS,
  ROOMS,
} from "@/lib/world/content/map";
import { buildFloor, setLamps } from "@/lib/world/layout";
import { elevatorHoleCells } from "@/lib/world/render/doors";
import { C, LAB_PALETTE, labMaterialOf } from "@/lib/world/content/palette";
import { roomTerminalModel } from "@/lib/world/content/terminals";
import { stagedBuildGrid, type DeviceVisual } from "@/lib/world/models/anim";
import { BOT_IDS, botVisual, mcpAvatarVisual } from "@/lib/world/models/characters";
import { MAX_LEVEL } from "@/lib/world/ops/state";
import { stagedGrid } from "@/lib/world/models/core";
import { DECOR as ALL_DECOR, decorModel, decorScale, decorVisual } from "@/lib/world/models/decor";
import { NOT_YET_CRYSTAL } from "@/lib/world/models/decor-ops";
import { agedVisual, allAgedVariants } from "@/lib/world/models/decor-aging";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import {
  cableModel,
  doorBeaconModel,
  doorFrameModel,
  doorLeafModel,
  elevatorPitModel,
  elevatorPlatformVisual,
  elevatorWinchVisual,
  gateBarModel,
  secretDoorModels,
  secretSkinFor,
  type DoorLight,
} from "@/lib/world/models/doors";
import { PICKUP_MODEL_KEYS, pickupModel, propModel, propVisual } from "@/lib/world/models/props";
import { decorFamily, familyFor, gridHash, type RefineFamily } from "@/lib/world/models/refine";
import { handProp, type HandPropKind } from "@/lib/world/models/rig";
import { propGrid } from "@/lib/world/occupancy";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, ".crystal");
const DUMPS = join(OUT, "dumps");
const ARGS = process.argv.slice(2);
const ONLY = ARGS.find((a) => !a.startsWith("--"))
  ?.split(",")
  .filter(Boolean);
const TERRAIN = !ARGS.includes("--no-terrain");

const NAME_BY_INDEX = new Map<number, string>(Object.entries(C).map(([n, i]) => [i, n]));

interface Use {
  id: string;
  family: RefineFamily;
  center: boolean;
}

interface Entry {
  key: string;
  grid: VoxelGrid;
  family: RefineFamily;
  center: boolean;
  uses: Use[];
  /** Terrain: cells of the box that belong to the chunk ([x0,y0,z0,x1,y1,z1]). */
  crop?: [number, number, number, number, number, number];
}

const byKey = new Map<string, Entry>();

function add(id: string, grid: VoxelGrid, family: RefineFamily, center: boolean): void {
  if (ONLY && !ONLY.some((p) => id.startsWith(p))) return;
  if (grid.count() === 0) return;
  const key = gridHash(grid);
  const e = byKey.get(key);
  if (e) {
    e.uses.push({ id, family, center });
    return;
  }
  byKey.set(key, { key, grid, family, center, uses: [{ id, family, center }] });
}

/** Base + parts of a rigged visual, the way `buildVisualRig` grids them. */
function addVisual(
  id: string,
  v: DeviceVisual,
  family: RefineFamily,
  powered: boolean,
  base = true,
): void {
  if (base) add(`${id}/base`, v.base.grid, family, true);
  for (const p of v.parts) {
    const grid = p.requiresPower ? stagedGrid(p.model.grid, 1, powered) : p.model.grid;
    add(`${id}/${p.name}`, grid, family, false);
  }
}

// ── Devices (complete; powered and dark) ─────────────────────────
const deviceIds = new Set([...DEVICES.map((d) => d.id), ...DEVICE_VISUAL_IDS]);
for (const id of deviceIds) {
  const v = deviceVisual(id);
  for (const powered of [true, false]) {
    const tag = `dev-${id}${powered ? "" : "-off"}`;
    add(`${tag}/base`, stagedBuildGrid(v.base.grid, 1, powered), "device", true);
    addVisual(tag, v, familyFor(v, "device"), powered, false);
  }
}

// ── Bots (dormant, awake, upgrade levels 1–3), MCP avatar ────────
for (const b of BOT_IDS) {
  for (const awake of [true, false]) {
    const v = botVisual(b, awake);
    addVisual(`bot-${b}${awake ? "" : "-dormant"}`, v, familyFor(v, "character"), awake);
  }
  // Upgrades (docs/OPS.md): antenna, light band, badge + sensor puck change the grids.
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const v = botVisual(b, true, level);
    addVisual(`bot-${b}-l${level}`, v, familyFor(v, "character"), true);
  }
}
{
  const v = mcpAvatarVisual();
  addVisual("mcp-avatar", v, familyFor(v, "device"), true);
}

// The operations decor stays voxel for now (decor-ops.ts NOT_YET_CRYSTAL).
const DECOR = ALL_DECOR.filter((d) => !NOT_YET_CRYSTAL.has(d.id));

// ── Props, variant decor, prop rigs ──────────────────────────────
for (const p of PROPS) {
  if (p.model === "elevator") continue;
  const variantDecor = p.variant ? PROP_VARIANT_DECOR[p.variant] : undefined;
  if (variantDecor && NOT_YET_CRYSTAL.has(variantDecor)) continue;
  const pv = variantDecor ? undefined : propVisual(p.model);
  add(`prop-${variantDecor ?? p.model}/base`, (pv?.base ?? propGrid(p)).grid, "prop", true);
  const vv = variantDecor ? decorVisual(variantDecor) : pv;
  if (vv) addVisual(`prop-${variantDecor ?? p.model}`, vv, "prop", false, false);
}
for (const m of new Set(PROPS.map((p) => p.model))) {
  if (m !== "elevator") add(`prop-${m}/model`, propModel(m).grid, "prop", true);
}

// ── Pickups, notes ───────────────────────────────────────────────
for (const k of new Set([...PICKUP_MODEL_KEYS, ...PICKUPS.map((p) => p.model)]))
  add(`pickup-${k}`, pickupModel(k).grid, "pickup", true);
for (const k of new Set(NOTES.map((n) => n.model)))
  add(`note-${k}`, pickupModel(k).grid, "pickup", true);

// ── Decor (static + animated rigs) ───────────────────────────────
for (const d of DECOR)
  add(`decor-${d.id}`, decorModel(d.id).grid, decorFamily(decorScale(d.id)), true);
for (const f of interiorFloors()) {
  for (const p of animatedDecor(f)) {
    if (NOT_YET_CRYSTAL.has(p.decor)) continue;
    const v = decorVisual(p.decor);
    if (v)
      addVisual(`decor-${p.decor}`, v, decorFamily(v.scale ?? decorScale(p.decor)), false, false);
  }
}

// ── Aging variants (lib/world/aging.ts): grown / wilted plants, dust, rust, crystals ──
for (const d of DECOR) {
  const fam = decorFamily(decorScale(d.id));
  for (const v of allAgedVariants(d.id)) add(`decor-${d.id}@${v.key}`, v.model.grid, fam, true);
}
for (const f of interiorFloors()) {
  for (const p of animatedDecor(f)) {
    if (NOT_YET_CRYSTAL.has(p.decor)) continue;
    const raw = decorVisual(p.decor);
    if (!raw) continue;
    for (const v of allAgedVariants(p.decor))
      addVisual(
        `decor-${p.decor}@${v.key}`,
        agedVisual(p.decor, raw, v.look),
        decorFamily(raw.scale ?? decorScale(p.decor)),
        false,
        false,
      );
  }
}

// ── Doors, elevators ─────────────────────────────────────────────
add("door-frame", doorFrameModel().grid, "architecture", true);
add("door-frame-secret", doorFrameModel({ secret: true }).grid, "architecture", true);
const LIGHTS: DoorLight[] = ["green", "amber", "red"];
for (const l of LIGHTS) {
  add(`door-beacon-${l}`, doorBeaconModel(l).grid, "architecture", true);
  for (const keypad of [false, true])
    for (const bolt of [false, true]) {
      add(
        `door-leaf-${l}${bolt ? "-bolt" : ""}/left`,
        doorLeafModel("left", { light: l, bolt }).grid,
        "architecture",
        true,
      );
      add(
        `door-leaf-${l}${keypad ? "-keypad" : ""}${bolt ? "-bolt" : ""}/right`,
        doorLeafModel("right", { light: l, keypad, bolt }).grid,
        "architecture",
        true,
      );
    }
}
for (const d of DOORS) {
  if (!d.secret) continue;
  const s = secretDoorModels(secretSkinFor(d));
  add(`door-secret-${d.id}/cover`, s.cover.grid, "architecture", true);
  add(`door-secret-${d.id}/left`, s.left.grid, "architecture", true);
  add(`door-secret-${d.id}/right`, s.right.grid, "architecture", true);
}
add("elevator-pit", elevatorPitModel().grid, "architecture", true);
add("elevator-platform", elevatorPlatformVisual().base.grid, "architecture", true);
add("elevator-gate", gateBarModel().grid, "architecture", true);
{
  const w = elevatorWinchVisual();
  add("elevator-winch/base", w.base.grid, "architecture", true);
  for (const p of w.parts) add(`elevator-winch/${p.name}`, p.model.grid, "architecture", true);
}
add("elevator-cable", cableModel().grid, "architecture", true);

// ── Room terminals, hand props ───────────────────────────────────
add("room-terminal", roomTerminalModel().grid, "device", true);
const HAND: HandPropKind[] = ["mug", "book", "crate", "wrench"];
for (const k of HAND) add(`hand-${k}`, handProp(k).model.grid, "detail", false);

// ── Terrain chunks ───────────────────────────────────────────────
if (TERRAIN && (!ONLY || ONLY.some((p) => "terrain-".startsWith(p) || p.startsWith("terrain-")))) {
  const CUTS = [
    { id: "up", cut: Infinity },
    { id: "half", cut: 3 },
    { id: "down", cut: 1 },
  ] as const; // engine WALL_MODES
  const R = TERRAIN_RING;
  for (const floor of FLOORS.map((f) => f.id)) {
    const layout = buildFloor(floor);
    const shaft = ELEVATORS.find((x) => x.floor === floor)!;
    for (const c of elevatorHoleCells(shaft)) layout.world.set(c.x, 0, c.z, 0);
    const w = layout.world;
    for (const lit of [true, false]) {
      for (const r of ROOMS) if (r.floor === floor) setLamps(w, layout.lamps, r.id, lit);
      for (const m of CUTS) {
        const saved: [number, number, number, number][] = [];
        if (Number.isFinite(m.cut))
          for (let y = m.cut + 1; y < FLOOR_SIZE.y; y++)
            for (let z = 0; z < FLOOR_SIZE.z; z++)
              for (let x = 0; x < FLOOR_SIZE.x; x++) {
                const v = w.get(x, y, z);
                if (!v) continue;
                saved.push([x, y, z, v]);
                w.set(x, y, z, 0);
              }
        for (const ck of w.chunkKeys()) {
          const [cx, cy, cz] = VoxelWorld.parseKey(ck);
          const min: [number, number, number] = [cx * CHUNK, cy * CHUNK, cz * CHUNK];
          const { key, box } = terrainChunkKey(w, min);
          if (box.count() === 0) continue;
          const id = `terrain-f${floor}-${cx}.${cy}.${cz}-${lit ? "lit" : "dark"}-${m.id}`;
          const e = byKey.get(key);
          if (e) e.uses.push({ id, family: "terrain", center: false });
          else
            byKey.set(key, {
              key,
              grid: box,
              family: "terrain",
              center: false,
              uses: [{ id, family: "terrain", center: false }],
              crop: [R, R, R, R + CHUNK, R + CHUNK, R + CHUNK],
            });
        }
        for (const [x, y, z, v] of saved) w.set(x, y, z, v);
      }
    }
  }
}

// ── Write ────────────────────────────────────────────────────────

function dump(e: Entry) {
  const g = e.grid;
  const local = new Map<number, number>();
  const palette: { hex: string; mat: string; name: string }[] = [];
  const runs: number[] = [];
  const data = g.data;
  const loc = (v: number): number => {
    if (v === 0) return 0;
    let li = local.get(v);
    if (li === undefined) {
      const [r, gg, b] = LAB_PALETTE.get(v);
      palette.push({
        hex: `#${[r, gg, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`,
        mat: labMaterialOf(v),
        name: NAME_BY_INDEX.get(v) ?? `c${v}`,
      });
      li = palette.length;
      local.set(v, li);
    }
    return li;
  };
  for (let i = 0; i < data.length; ) {
    let j = i + 1;
    while (j < data.length && data[j] === data[i]) j++;
    runs.push(loc(data[i]!), j - i);
    i = j;
  }
  return {
    id: e.uses[0]!.id,
    name: e.uses[0]!.id,
    key: e.key,
    family: e.family,
    unit: 1,
    center: e.center,
    size: [g.sx, g.sy, g.sz],
    palette,
    runs,
    uses: e.uses.map((u) => u.id),
    ...(e.crop ? { crop: e.crop } : {}),
  };
}

/** Filesystem-safe name of a grid key ("26x40x19:abc" → "26x40x19-abc"). */
export function keyFile(key: string): string {
  return key.replace(/[^a-zA-Z0-9x-]/g, "-");
}

mkdirSync(DUMPS, { recursive: true });
if (!ONLY) for (const f of readdirSync(DUMPS)) rmSync(join(DUMPS, f));
const inventory: {
  key: string;
  file: string;
  family: RefineFamily;
  center: boolean;
  size: [number, number, number];
  voxels: number;
  sha: string;
  uses: string[];
}[] = [];
for (const e of byKey.values()) {
  const d = dump(e);
  const json = JSON.stringify(d);
  const file = `${keyFile(e.key)}.json`;
  writeFileSync(join(DUMPS, file), json + "\n");
  inventory.push({
    key: e.key,
    file,
    family: e.family,
    center: e.center,
    size: [e.grid.sx, e.grid.sy, e.grid.sz],
    voxels: e.grid.count(),
    sha: createHash("sha256").update(json).digest("hex").slice(0, 16),
    uses: d.uses,
  });
}
inventory.sort((a, b) => a.uses[0]!.localeCompare(b.uses[0]!));
writeFileSync(
  join(OUT, ONLY ? "inventory.partial.json" : "inventory.json"),
  JSON.stringify(
    { generated: new Date().toISOString(), count: inventory.length, models: inventory },
    null,
    1,
  ) + "\n",
);
const vox = inventory.reduce((s, m) => s + m.voxels, 0);
const fams = new Map<string, number>();
for (const m of inventory) fams.set(m.family, (fams.get(m.family) ?? 0) + 1);
console.log(
  `crystal inventory: ${inventory.length} unique grids (${[...byKey.values()].reduce((s, e) => s + e.uses.length, 0)} uses), ${vox.toLocaleString()} voxels`,
);
console.log(`  families: ${[...fams].map(([f, n]) => `${f} ${n}`).join(" · ")}`);

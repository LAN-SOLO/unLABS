/**
 * The crystal age (docs/CRYSTAL.md): after the 42nd era the voxels stop
 * splitting — the lab crystallises into real surfaces. Every voxel model is
 * swapped for its Blender-built counterpart (`public/crystal/manifest.json`,
 * keyed by the model grid's content hash); a model without one stays voxels.
 *
 * Pure rules only — the renderer side lives in lib/world/render/crystal.ts.
 */
import { VoxelGrid, type Vec3 } from "@/lib/voxel/grid";
import { CHUNK, type VoxelWorld } from "@/lib/voxel/world";
import type { CrystalMode } from "@/lib/world/clarity-mode";
import { gridHash } from "@/lib/world/models/refine";

/** Clarity level (0..41) from which the story crystallises the lab: era 42, everything done. */
export const CRYSTAL_LEVEL = 41;

/** Should the lab be crystal right now? (`level` = the eased clarity level, 0..41). */
export function crystalWanted(level: number, mode: CrystalMode): boolean {
  if (mode === "off") return false;
  if (mode === "always") return true;
  return level >= CRYSTAL_LEVEL - 1e-6;
}

/** Engine material slots: the four voxel classes first, crystal surfaces after them. */
export const CRYSTAL_SLOT_BASE = 4;
/** Crystal surface slots the engine reserves (surfaces beyond this share the last one). */
export const CRYSTAL_SLOTS = 24;

/** Shape of `public/crystal/manifest.json` (written by scripts/crystal/build.ts). */
export interface CrystalSurface {
  metal?: number;
  rough?: number;
  relief?: number;
  wear?: number;
  emit?: number;
  transmission?: number;
  clearcoat?: number;
  sheen?: number;
  subsurface?: number;
  /** Tileable library maps (paths under /crystal/), filled by `pnpm crystal:library`. */
  textures?: { normal?: string; roughness?: string; albedo?: string; scale?: number };
}

export interface CrystalModel {
  file: string;
  surfaces: string[];
  tris: number;
  bytes: number;
  family: string;
  profile: string;
  uses: string[];
}

export interface CrystalManifest {
  version: 1;
  generated: string;
  cfg: string;
  surfaces: Record<string, CrystalSurface>;
  models: Record<string, CrystalModel>;
}

export function isCrystalManifest(v: unknown): v is CrystalManifest {
  if (!v || typeof v !== "object") return false;
  const m = v as Partial<CrystalManifest>;
  return (
    m.version === 1 &&
    !!m.surfaces &&
    typeof m.surfaces === "object" &&
    !!m.models &&
    typeof m.models === "object"
  );
}

/** Slot index of every surface (manifest order), capped at CRYSTAL_SLOTS. */
export function surfaceSlots(manifest: CrystalManifest): Map<string, number> {
  const out = new Map<string, number>();
  Object.keys(manifest.surfaces).forEach((sid, i) => out.set(sid, Math.min(i, CRYSTAL_SLOTS - 1)));
  return out;
}

/**
 * Grid key → model ids that must never get a crystal model: Damien stays
 * veiled until `isDamienRevealed()`, Jade is the hero (never voxels).
 * The export never writes them; the engine double-checks the uses.
 */
export function forbiddenUse(id: string): boolean {
  return /(^|[/-])(damien|veil|jade)([/-]|$)/i.test(id);
}

// ── Terrain ──────────────────────────────────────────────────────

/** Voxels of neighbour context around a terrain chunk (the crystal blur reaches into them). */
export const TERRAIN_RING = 2;
/** Edge of the box a terrain chunk's crystal model is built from. */
export const TERRAIN_BOX = CHUNK + 2 * TERRAIN_RING;

/** Min corner of the context box of the chunk at `chunkMin` (world voxels). */
export function terrainBoxMin(chunkMin: Vec3): Vec3 {
  return [chunkMin[0] - TERRAIN_RING, chunkMin[1] - TERRAIN_RING, chunkMin[2] - TERRAIN_RING];
}

/**
 * Content key of a terrain chunk: the hash of its voxels plus the ring
 * (0 outside the world). Lamps, opened doors and the wall cutaway change
 * the voxels and so the key — such a chunk shows voxels until a crystal
 * model for exactly that state exists. `t:` keeps terrain keys apart from
 * model keys.
 */
export function terrainChunkKey(
  world: Pick<VoxelWorld, "readBox">,
  chunkMin: Vec3,
): {
  key: string;
  box: VoxelGrid;
} {
  const n = TERRAIN_BOX;
  const box = new VoxelGrid(n, n, n, world.readBox(terrainBoxMin(chunkMin), [n, n, n]));
  return { key: `t:${gridHash(box)}`, box };
}

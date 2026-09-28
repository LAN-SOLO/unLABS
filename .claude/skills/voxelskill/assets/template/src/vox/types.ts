import type { Vec3 } from '@/voxel/grid';
import type { Palette } from '@/voxel/palette';

/** DICT values in .vox are always strings (e.g. _t = "10 -4 3", _r = "4"). */
export type VoxDict = Record<string, string>;

export interface VoxModel {
  /** Size in MagicaVoxel axes: x, y, z (z = up / gravity). */
  size: Vec3;
  /** Packed x, y, z, colorIndex bytes — straight from the XYZI chunk. */
  xyzi: Uint8Array;
}

export interface VoxFrame {
  /** Encoded ROTATION byte (4 = identity). */
  rotation: number;
  translation: Vec3;
  /** Keyframe index (_f), 0 when absent. */
  frame: number;
  attributes: VoxDict;
}

export type VoxNode =
  | { kind: 'transform'; id: number; attributes: VoxDict; child: number; layer: number; frames: VoxFrame[] }
  | { kind: 'group'; id: number; attributes: VoxDict; children: number[] }
  | { kind: 'shape'; id: number; attributes: VoxDict; models: { modelId: number; frame: number; attributes: VoxDict }[] };

export interface VoxLayer {
  id: number;
  name: string;
  hidden: boolean;
  attributes: VoxDict;
}

export interface VoxFile {
  version: number;
  models: VoxModel[];
  palette: Palette;
  /** MATL chunks keyed by material id (= palette index). */
  materials: Map<number, VoxDict>;
  nodes: Map<number, VoxNode>;
  layers: VoxLayer[];
  cameras: { id: number; attributes: VoxDict }[];
  renderObjects: VoxDict[];
  colorNames: string[];
  /** IMAP chunk: display order of palette indices, when present. */
  indexMap: Uint8Array | null;
  /** Chunk ids the parser skipped. */
  unknownChunks: string[];
}

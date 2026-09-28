import type { Vec3 } from '@/voxel/grid';
import { Palette } from '@/voxel/palette';
import { DEFAULT_PALETTE } from '@/vox/default-palette';
import type { VoxDict, VoxFile, VoxFrame, VoxModel, VoxNode } from '@/vox/types';

/**
 * Parses a MagicaVoxel .vox file (versions 150 and 200) including the
 * world scene graph (nTRN/nGRP/nSHP), layers, materials and palette notes.
 * Spec: https://github.com/ephtracy/voxel-model (MagicaVoxel-file-format-vox*.txt)
 */
export function parseVox(buffer: ArrayBuffer | Uint8Array): VoxFile {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const r = new Reader(bytes);
  if (r.id() !== 'VOX ') throw new Error("not a .vox file: missing 'VOX ' magic");
  const version = r.i32();

  const file: VoxFile = {
    version,
    models: [],
    palette: defaultPalette(),
    materials: new Map(),
    nodes: new Map(),
    layers: [],
    cameras: [],
    renderObjects: [],
    colorNames: [],
    indexMap: null,
    unknownChunks: [],
  };

  const mainId = r.id();
  if (mainId !== 'MAIN') throw new Error(`expected MAIN chunk, got '${mainId}'`);
  const mainContent = r.i32();
  const mainChildren = r.i32();
  r.pos += mainContent;
  const end = r.pos + mainChildren;
  if (end > bytes.length) throw new Error('truncated .vox: MAIN children exceed file size');

  let pendingSize: Vec3 | null = null;
  while (r.pos < end) {
    const id = r.id();
    const contentSize = r.i32();
    const childrenSize = r.i32();
    const next = r.pos + contentSize + childrenSize;
    switch (id) {
      case 'PACK':
        break;
      case 'SIZE':
        pendingSize = [r.i32(), r.i32(), r.i32()];
        break;
      case 'XYZI': {
        if (!pendingSize) throw new Error('XYZI chunk without preceding SIZE');
        const count = r.i32();
        const model: VoxModel = { size: pendingSize, xyzi: bytes.slice(r.pos, r.pos + count * 4) };
        file.models.push(model);
        pendingSize = null;
        break;
      }
      case 'RGBA': {
        const p = new Palette();
        // File entry i (0..254) is palette index i + 1; the 256th entry is unused.
        for (let i = 0; i < 255; i++) p.rgba.set(bytes.subarray(r.pos + i * 4, r.pos + i * 4 + 4), (i + 1) * 4);
        file.palette = p;
        break;
      }
      case 'nTRN': {
        const nodeId = r.i32();
        const attributes = r.dict();
        const child = r.i32();
        r.i32(); // reserved, -1
        const layer = r.i32();
        const frameCount = r.i32();
        const frames: VoxFrame[] = [];
        for (let f = 0; f < frameCount; f++) {
          const a = r.dict();
          frames.push({
            rotation: a._r !== undefined ? Number(a._r) : 4,
            translation: a._t !== undefined ? parseVec3(a._t) : [0, 0, 0],
            frame: a._f !== undefined ? Number(a._f) : 0,
            attributes: a,
          });
        }
        file.nodes.set(nodeId, { kind: 'transform', id: nodeId, attributes, child, layer, frames });
        break;
      }
      case 'nGRP': {
        const nodeId = r.i32();
        const attributes = r.dict();
        const count = r.i32();
        const children: number[] = [];
        for (let c = 0; c < count; c++) children.push(r.i32());
        file.nodes.set(nodeId, { kind: 'group', id: nodeId, attributes, children });
        break;
      }
      case 'nSHP': {
        const nodeId = r.i32();
        const attributes = r.dict();
        const count = r.i32();
        const models: Extract<VoxNode, { kind: 'shape' }>['models'] = [];
        for (let m = 0; m < count; m++) {
          const modelId = r.i32();
          const a = r.dict();
          models.push({ modelId, frame: a._f !== undefined ? Number(a._f) : 0, attributes: a });
        }
        file.nodes.set(nodeId, { kind: 'shape', id: nodeId, attributes, models });
        break;
      }
      case 'MATL': {
        const matId = r.i32();
        file.materials.set(matId, r.dict());
        break;
      }
      case 'LAYR': {
        const layerId = r.i32();
        const attributes = r.dict();
        file.layers.push({ id: layerId, name: attributes._name ?? '', hidden: attributes._hidden === '1', attributes });
        break;
      }
      case 'rOBJ':
        file.renderObjects.push(r.dict());
        break;
      case 'rCAM': {
        const camId = r.i32();
        file.cameras.push({ id: camId, attributes: r.dict() });
        break;
      }
      case 'NOTE': {
        const count = r.i32();
        for (let c = 0; c < count; c++) file.colorNames.push(r.str());
        break;
      }
      case 'IMAP':
        file.indexMap = bytes.slice(r.pos, r.pos + 256);
        break;
      default:
        file.unknownChunks.push(id);
    }
    r.pos = next;
  }
  return file;
}

/** Iterate voxels of a model: callback gets MagicaVoxel-space x, y, z and palette index. */
export function forEachVoxel(model: VoxModel, fn: (x: number, y: number, z: number, c: number) => void): void {
  const b = model.xyzi;
  for (let i = 0; i < b.length; i += 4) fn(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
}

function defaultPalette(): Palette {
  const p = new Palette();
  // default_palette entries are 0xAABBGGRR, index-aligned (entry 0 = empty).
  DEFAULT_PALETTE.forEach((v, i) => p.rgba.set([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255], i * 4));
  return p;
}

function parseVec3(s: string): Vec3 {
  const parts = s.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) throw new Error(`bad vec3 '${s}'`);
  return [parts[0]!, parts[1]!, parts[2]!];
}

class Reader {
  pos = 0;
  private readonly view: DataView;
  private readonly decoder = new TextDecoder();

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  i32(): number {
    if (this.pos + 4 > this.bytes.length) throw new Error(`truncated .vox at byte ${this.pos}`);
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  id(): string {
    if (this.pos + 4 > this.bytes.length) throw new Error(`truncated .vox at byte ${this.pos}`);
    const s = String.fromCharCode(...this.bytes.subarray(this.pos, this.pos + 4));
    this.pos += 4;
    return s;
  }

  str(): string {
    const n = this.i32();
    const s = this.decoder.decode(this.bytes.subarray(this.pos, this.pos + n));
    this.pos += n;
    return s;
  }

  dict(): VoxDict {
    const n = this.i32();
    const d: VoxDict = {};
    for (let i = 0; i < n; i++) {
      const k = this.str();
      d[k] = this.str();
    }
    return d;
  }
}

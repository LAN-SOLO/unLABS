/**
 * Hero mesh builder — sculpt layers → skinned mesh data (pure — no three).
 * ========================================================================
 *
 * Meshes every sculpt layer with surface nets, pulls the vertices onto the
 * surface and binds them to the hero skeleton with up to four bone weights
 * per vertex. Rigid layers (hair, hands, boots, buttons) follow one bone;
 * the head blends into the torso over the neck; clothes and limbs are
 * weighted by the distance to the bone segments (inverse fourth power, so
 * a joint bends over a short, soft zone like skin over a real elbow).
 *
 * `detail` picks the sampling: "portrait" for close-ups (the studio, cut
 * scenes), "game" (~2× coarser, a quarter of the triangles) for the lab.
 */
import { projectToSurface, surfaceNets } from "@/lib/sculpt/surface-nets";
import { segmentT, smoothstep, type Sdf } from "@/lib/sculpt/sdf";
import { jadeLayers, type HeroMaterial, type SculptLayer } from "@/lib/world/hero/jade-sculpt";
import { jadeGroom, type JadeGroom } from "@/lib/world/hero/jade-groom";
import { JADE_BODY, JADE_HERO_JOINTS, JADE_WEIGHT_SEGMENTS } from "@/lib/world/hero/skeleton";
import type { RigPartName } from "@/lib/world/models/rig";

export type HeroDetail = "portrait" | "game";

export interface HeroLayerMesh {
  id: string;
  material: HeroMaterial;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** 4 bone indices per vertex (into JADE_HERO_JOINTS). */
  skinIndex: Uint16Array;
  /** 4 weights per vertex, summing to 1. */
  skinWeight: Float32Array;
  /** Ambient occlusion per vertex (1 = open, 0 = fully occluded), from the union of all layers. */
  ao: Float32Array;
}

/** Cell multiplier per detail level. */
export const DETAIL_CELL: Readonly<Record<HeroDetail, number>> = { portrait: 1, game: 1.9 };

const BONE_INDEX = new Map<RigPartName, number>(JADE_HERO_JOINTS.map((j, i) => [j.name, i]));

function boneIndex(name: RigPartName): number {
  return BONE_INDEX.get(name) ?? 0;
}

/** How a layer binds: one bone, or weighted by the rule of `weights`. */
type Binding =
  | { rigid: RigPartName }
  | {
      weighted: true;
      head?: boolean;
      skirt?: boolean;
      sleeve?: boolean;
      /** Garment body: hips and torso only. */
      body?: boolean;
      /** Lower garment: hips, torso and legs — never the arms (the hands hang beside it). */
      legs?: boolean;
    };

function bindingFor(layer: SculptLayer): Binding {
  switch (layer.id) {
    case "hair":
      return { rigid: "head" };
    case "handR":
      return { rigid: "forearmR" };
    case "handL":
      return { rigid: "forearmL" };
    case "trim":
      return { rigid: "torso" };
    case "belt":
      return { rigid: "hips" };
    case "watch":
      return { rigid: "forearmL" };
    case "coat":
      return { weighted: true, skirt: true, body: true };
    case "shirt":
      return { weighted: true, body: true };
    case "trousers":
      return { weighted: true, legs: true };
    case "shirtSleeves":
    case "coatSleeves":
      return { weighted: true, sleeve: true };
    case "head":
      return { weighted: true, head: true };
    default:
      return { weighted: true };
  }
}

/** Distance from a point to a bone segment. */
function segDist(
  x: number,
  y: number,
  z: number,
  a: readonly number[],
  b: readonly number[],
): number {
  const t = segmentT(x, y, z, a as [number, number, number], b as [number, number, number]);
  return Math.hypot(
    x - (a[0]! + (b[0]! - a[0]!) * t),
    y - (a[1]! + (b[1]! - a[1]!) * t),
    z - (a[2]! + (b[2]! - a[2]!) * t),
  );
}

/** Arm bones (a garment body never follows them). */
const ARM_BONES: ReadonlySet<RigPartName> = new Set([
  "upperArmR",
  "forearmR",
  "upperArmL",
  "forearmL",
]);
const LEG_BONES: ReadonlySet<RigPartName> = new Set(["thighR", "shinR", "thighL", "shinL"]);

/**
 * Up to four (bone, weight) pairs for a point, weights normalised.
 * `only` restricts the bones considered (sleeves: one arm; bodies: no arms).
 */
export function skinWeights(
  x: number,
  y: number,
  z: number,
  boots = false,
  only?: (bone: RigPartName) => boolean,
): [number, number][] {
  const acc = new Map<number, number>();
  for (const s of JADE_WEIGHT_SEGMENTS) {
    if (s.bone === "head") continue;
    if (boots && s.bone !== "shinR" && s.bone !== "shinL") continue;
    if (only && !only(s.bone)) continue;
    const d = Math.max(0.15, segDist(x, y, z, s.a, s.b));
    const w = 1 / (d * d * d * d);
    const i = boneIndex(s.bone);
    acc.set(i, Math.max(acc.get(i) ?? 0, w));
  }
  const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((n, [, w]) => n + w, 0) || 1;
  return top.map(([i, w]) => [i, w / sum]);
}

function bind(layer: SculptLayer, positions: Float32Array): { idx: Uint16Array; w: Float32Array } {
  const n = positions.length / 3;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  const b = bindingFor(layer);
  const head = boneIndex("head");
  const torso = boneIndex("torso");
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3]!;
    const y = positions[v * 3 + 1]!;
    const z = positions[v * 3 + 2]!;
    if ("rigid" in b) {
      idx[v * 4] = boneIndex(b.rigid);
      w[v * 4] = 1;
      continue;
    }
    if (b.head) {
      // Face and skull follow the head; the neck hands over to the torso.
      const t = smoothstep(50.4, 52.6, y);
      idx[v * 4] = head;
      w[v * 4] = t;
      idx[v * 4 + 1] = torso;
      w[v * 4 + 1] = 1 - t;
      continue;
    }
    if (b.skirt && y < 31.5) {
      // The coat skirt hangs from the hips and sways on coatTail. It never
      // follows the legs: the front is open, the legs swing in the gap (a
      // thigh weight stretched the hem into a sheet when she walked).
      const t = smoothstep(31.5, 25.0, y);
      const set: [number, number][] = [
        [boneIndex("hips"), 1 - 0.4 * t],
        [boneIndex("coatTail"), 0.4 * t],
      ];
      set.forEach(([bi, bw], k) => {
        idx[v * 4 + k] = bi;
        w[v * 4 + k] = bw;
      });
      continue;
    }
    if (b.sleeve) {
      // One arm only; the part inside the seam blends into the torso so the
      // shoulder line stays closed when the arm lifts.
      const side = x < 0 ? "R" : "L";
      const arm = skinWeights(
        x,
        y,
        z,
        false,
        (bn) => bn === `upperArm${side}` || bn === `forearm${side}`,
      );
      const tt =
        smoothstep(JADE_BODY.shoulderX - 0.2, JADE_BODY.shoulderX - 1.4, Math.abs(x)) *
        smoothstep(JADE_BODY.shoulderY - 2.6, JADE_BODY.shoulderY - 1.2, y);
      const set: [number, number][] = arm.map(([bi, bw]) => [bi, bw * (1 - tt)]);
      if (tt > 0) set.push([torso, tt]);
      set.slice(0, 4).forEach(([bi, bw], k) => {
        idx[v * 4 + k] = bi;
        w[v * 4 + k] = bw;
      });
      continue;
    }
    const pairs = skinWeights(
      x,
      y,
      z,
      layer.id === "boots",
      b.body
        ? (bn) => !ARM_BONES.has(bn) && !LEG_BONES.has(bn)
        : b.legs
          ? (bn) => !ARM_BONES.has(bn)
          : undefined,
    );
    pairs.forEach(([bi, bw], k) => {
      idx[v * 4 + k] = bi;
      w[v * 4 + k] = bw;
    });
  }
  return { idx, w };
}

/**
 * Distance-field ambient occlusion (the classic SDF march along the
 * normal): at a few growing distances, compare how far the surface
 * *should* be with how far the union of every layer actually is. Hair
 * shades the forehead, the collar the neck, the lids the eyes.
 */
export function fieldAo(
  sdf: Sdf,
  positions: Float32Array,
  normals: Float32Array,
  reach = 1.2,
  steps = 5,
): Float32Array {
  const n = positions.length / 3;
  const ao = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const px = positions[v * 3]!;
    const py = positions[v * 3 + 1]!;
    const pz = positions[v * 3 + 2]!;
    const nx = normals[v * 3]!;
    const ny = normals[v * 3 + 1]!;
    const nz = normals[v * 3 + 2]!;
    let occ = 0;
    let wsum = 0;
    for (let i = 1; i <= steps; i++) {
      const h = (reach * i) / steps;
      const d = sdf(px + nx * h, py + ny * h, pz + nz * h);
      const w = 1 / i;
      occ += (w * Math.max(0, h - d)) / h;
      wsum += w;
    }
    ao[v] = Math.max(0, Math.min(1, 1 - (occ / wsum) * 1.6));
  }
  return ao;
}

/** Union of every layer (for occlusion between layers). */
export function unionField(layers: readonly SculptLayer[]): Sdf {
  return (x, y, z) => {
    let d = Infinity;
    for (const l of layers) {
      const v = l.sdf(x, y, z);
      if (v < d) d = v;
    }
    return d;
  };
}

/** Mesh one sculpt layer at `cellScale` × its cell (AO against `world`, default: the layer itself). */
export function meshLayer(layer: SculptLayer, cellScale = 1, world?: Sdf): HeroLayerMesh {
  const m = surfaceNets(layer.sdf, {
    min: layer.min,
    max: layer.max,
    cell: layer.cell * cellScale,
  });
  projectToSurface(layer.sdf, m);
  const { idx, w } = bind(layer, m.positions);
  return {
    id: layer.id,
    material: layer.material,
    positions: m.positions,
    normals: m.normals,
    indices: m.indices,
    skinIndex: idx,
    skinWeight: w,
    ao: fieldAo(world ?? layer.sdf, m.positions, m.normals),
  };
}

/** Mesh a layer at a detail level (the game uses each layer's own `gameCell`). */
export function meshLayerAt(layer: SculptLayer, detail: HeroDetail, world?: Sdf): HeroLayerMesh {
  const scale = detail === "game" ? layer.gameCell / layer.cell : DETAIL_CELL[detail];
  return meshLayer(layer, scale, world);
}

/** Every layer of Jade's hero mesh at a detail level. */
export function buildJadeHero(detail: HeroDetail = "game"): HeroLayerMesh[] {
  const layers = jadeLayers(detail);
  const world = unionField(layers);
  return layers.map((l) => meshLayerAt(l, detail, world));
}

/** Guide density of the hair groom per detail level (the lab needs fewer guides). */
export const GROOM_DENSITY: Readonly<Record<HeroDetail, number>> = { portrait: 1, game: 0.55 };

/** Meshes + the hair groom (strand guides for the hair engine). */
export interface HeroBundle {
  layers: HeroLayerMesh[];
  groom: JadeGroom;
}

export function buildJadeBundle(detail: HeroDetail = "game"): HeroBundle {
  return { layers: buildJadeHero(detail), groom: jadeGroom(GROOM_DENSITY[detail]) };
}

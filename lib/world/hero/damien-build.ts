/**
 * Damien's hero mesh builder (pure — no three).
 * =============================================
 *
 * Meshes the layers of damien-sculpt.ts with the same machinery as Jade's
 * (surface nets, projection onto the field, SDF ambient occlusion from the
 * union of all layers) and binds them to Damien's skeleton: head, beard
 * and hair follow the head bone (the neck blends into the torso), hands
 * their forearms, shoes their shins, clothes are weighted by distance to
 * his bone segments. Bone indices refer to DAMIEN_HERO_JOINTS.
 */
import { projectToSurface, surfaceNets } from "@/lib/sculpt/surface-nets";
import { segmentT, smoothstep } from "@/lib/sculpt/sdf";
import {
  DETAIL_CELL,
  fieldAo,
  unionField,
  type HeroDetail,
  type HeroLayerMesh,
} from "@/lib/world/hero/build";
import { damienLayers } from "@/lib/world/hero/damien-sculpt";
import { DAMIEN_HERO_JOINTS, DAMIEN_WEIGHT_SEGMENTS } from "@/lib/world/hero/damien-skeleton";
import type { SculptLayer } from "@/lib/world/hero/jade-sculpt";
import type { RigPartName } from "@/lib/world/models/rig";

const BONE = new Map<RigPartName, number>(DAMIEN_HERO_JOINTS.map((j, i) => [j.name, i]));
const bone = (n: RigPartName): number => BONE.get(n) ?? 0;

const RIGID: Readonly<Record<string, RigPartName>> = {
  handR: "forearmR",
  handL: "forearmL",
};

function weights(
  x: number,
  y: number,
  z: number,
  only?: ReadonlySet<RigPartName>,
): [number, number][] {
  const acc = new Map<number, number>();
  for (const s of DAMIEN_WEIGHT_SEGMENTS) {
    if (only && !only.has(s.bone)) continue;
    const t = segmentT(x, y, z, s.a, s.b);
    const d = Math.max(
      0.15,
      Math.hypot(
        x - (s.a[0] + (s.b[0] - s.a[0]) * t),
        y - (s.a[1] + (s.b[1] - s.a[1]) * t),
        z - (s.a[2] + (s.b[2] - s.a[2]) * t),
      ),
    );
    const w = 1 / (d * d * d * d);
    const i = bone(s.bone);
    acc.set(i, Math.max(acc.get(i) ?? 0, w));
  }
  const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((n, [, w]) => n + w, 0) || 1;
  return top.map(([i, w]) => [i, w / sum]);
}

const SHINS: ReadonlySet<RigPartName> = new Set<RigPartName>(["shinR", "shinL"]);

function bindDamien(layer: SculptLayer, p: Float32Array): { idx: Uint16Array; w: Float32Array } {
  const n = p.length / 3;
  const idx = new Uint16Array(n * 4);
  const w = new Float32Array(n * 4);
  const head = bone("head");
  const torso = bone("torso");
  const rigid = RIGID[layer.id];
  for (let v = 0; v < n; v++) {
    const x = p[v * 3]!;
    const y = p[v * 3 + 1]!;
    const z = p[v * 3 + 2]!;
    if (rigid) {
      idx[v * 4] = bone(rigid);
      w[v * 4] = 1;
      continue;
    }
    if (layer.id === "head" || layer.id === "hair" || layer.id === "beard") {
      // The head (and what grows on it) follows the head; the neck hands over to the torso.
      const t = layer.id === "head" ? smoothstep(51.6, 53.8, y) : 1;
      idx[v * 4] = head;
      w[v * 4] = t;
      idx[v * 4 + 1] = torso;
      w[v * 4 + 1] = 1 - t;
      continue;
    }
    weights(x, y, z, layer.id === "shoes" ? SHINS : undefined).forEach(([bi, bw], k) => {
      idx[v * 4 + k] = bi;
      w[v * 4 + k] = bw;
    });
  }
  return { idx, w };
}

/** Damien's hero layers at a detail level (bone indices into DAMIEN_HERO_JOINTS). */
export function buildDamienHero(detail: HeroDetail = "game"): HeroLayerMesh[] {
  const layers = damienLayers();
  const world = unionField(layers);
  return layers.map((l) => {
    const cell = detail === "game" ? l.gameCell : l.cell * DETAIL_CELL[detail];
    const m = surfaceNets(l.sdf, { min: l.min, max: l.max, cell });
    projectToSurface(l.sdf, m);
    const { idx, w } = bindDamien(l, m.positions);
    return {
      id: l.id,
      material: l.material,
      positions: m.positions,
      normals: m.normals,
      indices: m.indices,
      skinIndex: idx,
      skinWeight: w,
      ao: fieldAo(world, m.positions, m.normals),
    };
  });
}

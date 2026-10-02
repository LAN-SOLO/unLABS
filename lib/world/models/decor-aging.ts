/**
 * Decor model variants for the aging processes (lib/world/aging.ts) — pure.
 *
 * Every variant stays inside the base model's box and never adds voxels
 * outside the base shape's footprint/height, so collision, footprints and
 * walkability never change (tests/world/aging.test.ts):
 *
 *   growth  foliage appears from the stem outwards/upwards as the plant grows
 *           (young leaves light green, old ones darker)
 *   wilt    leaves yellow and brown, the outer leaves drop
 *   weather dry rooms: dust settles on up-facing surfaces; damp rooms: rust
 *           creeps over metal, moss over stone and wood near the floor
 *   crystal crystal clusters grow from their base
 *
 * Variants are cached per (decor, look key); grids are new objects, so the
 * engine's grid hash (and the crystal-age lookup) sees each stage separately.
 */
import type { AgeLook } from "@/lib/world/aging";
import {
  CRYSTALS,
  EMPTY_AT_ZERO,
  GROWING,
  GROW_STAGES,
  WILT_STAGES,
  WEATHER_STAGES,
  lookKey,
} from "@/lib/world/aging";
import { C, labMaterialOf } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import { decorModel } from "@/lib/world/models/decor";
import type { DeviceVisual } from "@/lib/world/models/anim";

const LEAVES = new Set<number>([
  C.plant_green,
  C.leaf_dark,
  C.leaf_light,
  C.leaf_yellow,
  C.flower_red,
  C.flower_yellow,
]);
/** The algae spill's "foliage": the slick and its clumps grow outwards like leaves. */
const SPILL = new Set<number>([C.liquid_green, C.leaf_dark, C.lime]);
const VINE = new Set<number>([
  C.plant_green,
  C.leaf_dark,
  C.leaf_light,
  C.leaf_yellow,
  C.wood_dark,
]);

const STONE_WOOD = new Set<number>([
  C.concrete,
  C.concrete_dark,
  C.concrete_light,
  C.rock,
  C.rock_dark,
  C.brick,
  C.wood,
  C.wood_dark,
  C.wood_light,
  C.pot,
  C.soil,
]);

function hash(x: number, y: number, z: number, salt: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647 + salt * 974634, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function copy(src: Model): Model {
  const m = new Model(src.w, src.h, src.d);
  m.grid.data.set(src.grid.data);
  return m;
}

const cache = new Map<string, Model>();

/** The decor model as it looks with `look` (the base model when nothing applies). */
export function agedDecorModel(decorId: string, look: AgeLook): Model {
  return ageModel(decorModel(decorId), `${decorId}`, decorId, look);
}

/** A decor rig with every part aged like the base (foliage in sway parts grows and wilts too). */
export function agedVisual(decorId: string, visual: DeviceVisual, look: AgeLook): DeviceVisual {
  return {
    ...visual,
    base: ageModel(visual.base, `${decorId}/base`, decorId, look),
    parts: visual.parts.map((p) => ({
      ...p,
      model: ageModel(p.model, `${decorId}/${p.name}`, decorId, look),
    })),
  };
}

/** Age one model (cached per `cacheId` + look key). */
export function ageModel(base: Model, cacheId: string, decorId: string, look: AgeLook): Model {
  const key = `${cacheId}|${lookKey(decorId, look)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const growing = GROWING.has(decorId);
  const crystal = CRYSTALS.has(decorId);
  const noop =
    (!growing || (look.grow === GROW_STAGES - 1 && look.wilt === 0)) &&
    look.weather === 0 &&
    (!crystal || look.crystal === 3);
  if (noop) {
    cache.set(key, base);
    return base;
  }
  const m = copy(base);
  const g = m.grid;
  const { w, h } = m;
  const cx = (w - 1) / 2;
  const cz = (m.d - 1) / 2;
  const salt = cacheId.length * 131 + cacheId.charCodeAt(cacheId.length - 1);

  if (EMPTY_AT_ZERO.has(decorId) && look.grow === 0) {
    g.data.fill(0);
    cache.set(key, m);
    return m;
  }
  const LEAVES_OF = decorId === "algae_spill" ? SPILL : decorId === "vine_wall" ? VINE : LEAVES;
  if (growing) {
    // Growth front: height above the lowest leaf + distance from the stem axis.
    let y0 = h;
    g.forEach((_x, y, _z, v) => {
      if (LEAVES_OF.has(v)) y0 = Math.min(y0, y);
    });
    let reach = 1;
    g.forEach((x, y, z, v) => {
      if (LEAVES_OF.has(v)) reach = Math.max(reach, y - y0 + Math.hypot(x - cx, z - cz) * 0.8);
    });
    const f = (look.grow + 1) / GROW_STAGES;
    const wf = look.wilt / Math.max(1, WILT_STAGES - 1);
    g.forEach((x, y, z, v) => {
      if (!LEAVES_OF.has(v)) return;
      const t = (y - y0 + Math.hypot(x - cx, z - cz) * 0.8) / reach;
      const r = hash(x, y, z, salt);
      if (t > f + 0.08 * (r - 0.5)) {
        g.set(x, y, z, 0);
        return;
      }
      let c = v;
      if (t > f - 0.18 && v !== C.flower_red && v !== C.flower_yellow) c = C.leaf_light;
      if (wf > 0) {
        if (t > 0.55 && r < wf * 0.45) {
          g.set(x, y, z, 0);
          return;
        }
        if (r < wf * 0.85) c = wf > 0.6 && r < wf * 0.5 ? C.soil : C.leaf_yellow;
      }
      g.set(x, y, z, c);
    });
  }

  if (crystal && look.crystal < 3) {
    // Smaller clusters: keep the lower share of the crystal, trimmed from the top.
    let top = 0;
    g.forEach((_x, y) => (top = Math.max(top, y)));
    const keep = 0.35 + 0.65 * ((look.crystal + 1) / 4);
    g.forEach((x, y, z) => {
      if (y > top * keep + hash(x, y, z, salt) * 1.2) g.set(x, y, z, 0);
    });
  }

  if (look.weather > 0) {
    const wf = look.weather / (WEATHER_STAGES - 1);
    g.forEach((x, y, z, v) => {
      const r = hash(x, y, z, salt + 7);
      const up = y + 1 >= h || g.get(x, y + 1, z) === 0;
      const metal = labMaterialOf(v) === "metal";
      if (look.damp) {
        // Rust spreads over metal (more where it is low and damp), moss over stone and wood near the floor.
        if (metal && r < wf * (0.35 + 0.4 * (1 - y / h)))
          g.set(x, y, z, r < wf * 0.15 ? C.iron_rust_dk : C.iron_rust);
        else if (STONE_WOOD.has(v) && y < h * 0.5 && r < wf * 0.3 * (1 - y / (h * 0.5)))
          g.set(x, y, z, C.leaf_dark);
      } else if (
        labMaterialOf(v) !== "emit" &&
        labMaterialOf(v) !== "glass" &&
        r < wf * (up ? 0.9 : 0.12)
      ) {
        // Dust: a grey film on up-facing surfaces, a few specks on the sides (never on lights or glass).
        g.set(x, y, z, C.dust);
      }
    });
  }

  cache.set(key, m);
  return m;
}

/** Every variant a decor piece can take (tests). */
export function allAgedVariants(decorId: string): { key: string; model: Model; look: AgeLook }[] {
  const out: { key: string; model: Model; look: AgeLook }[] = [];
  const seen = new Set<string>();
  const growing = GROWING.has(decorId);
  const crystal = CRYSTALS.has(decorId);
  for (const damp of [false, true])
    for (let weather = 0; weather < WEATHER_STAGES; weather++)
      for (let grow = growing ? 0 : GROW_STAGES - 1; grow < GROW_STAGES; grow++)
        for (let wilt = 0; wilt < (growing ? WILT_STAGES : 1); wilt++)
          for (let k = crystal ? 0 : 3; k < 4; k++) {
            const look: AgeLook = { grow, wilt, weather, damp, crystal: k };
            const key = lookKey(decorId, look);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ key, model: agedDecorModel(decorId, look), look });
          }
  return out;
}

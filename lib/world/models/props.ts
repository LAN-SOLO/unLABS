/**
 * Prop and pickup voxel models.
 * Dimensions are part of the contract (collision footprints and
 * interaction radii derive from them) — keep w×d stable when adding detail;
 * extra detail goes into height and surface (tests/world/props-hero.test.ts).
 *
 * A few hero props also carry animated parts (`propVisual`): the static
 * model returned by `propModel` has those parts stamped in at their rest
 * pose (collision, ending stills, renderers without rig support), while
 * `propVisual` returns the base *without* them plus the `AnimPart`s, in
 * the same shape as `decorVisual` / `deviceVisual`.
 */
import { C } from "@/lib/world/content/palette";
import type { AnimPart, DeviceVisual, VisualLight } from "@/lib/world/models/anim";
import { MODEL_SCALE, Model, consoleDesk, rack } from "@/lib/world/models/core";
import { weatherModel } from "@/lib/world/models/decor-weather";

const TAU = Math.PI * 2;

// ── Helpers ──────────────────────────────────────────────────────

/** Copy of `src` in a taller model (extra rows on top are empty). */
function taller(src: Model, h: number): Model {
  const m = new Model(src.w, Math.max(h, src.h), src.d);
  src.grid.forEach((x, y, z, v) => m.set(x, y, z, v));
  return m;
}

/** Part model filled by `fill`, skipping cells the base already occupies at `offset`. */
function partModel(
  base: Model,
  size: [number, number, number],
  offset: [number, number, number],
  fill: (x: number, y: number, z: number) => number,
): Model {
  const p = new Model(size[0], size[1], size[2]);
  for (let z = 0; z < size[2]; z++)
    for (let y = 0; y < size[1]; y++)
      for (let x = 0; x < size[0]; x++) {
        const c = fill(x, y, z);
        if (!c) continue;
        const bx = x + offset[0];
        const by = y + offset[1];
        const bz = z + offset[2];
        if (base.grid.inBounds(bx, by, bz) && base.grid.get(bx, by, bz)) continue;
        p.set(x, y, z, c);
      }
  return p;
}

// ── Rigged hero props ────────────────────────────────────────────

interface PropRig {
  base: Model;
  parts: AnimPart[];
  lights: VisualLight[];
}

/**
 * The Infinity-Forge Array: a standing torus gate of 16 segmented plates on
 * a stepped plinth, a glass containment column in the ring's eye holding
 * Crystal #0089, four conduit pylons, rune channels in the deck and on the
 * plates, and a halo ring that turns inside the gate while the field is up.
 * Faces +z (the two Synapsis stations stand in front of it).
 */
function forgeRig(): PropRig {
  const W = 28;
  const H = 32;
  const cx = 13.5;
  const cz = 13.5;
  /** Gate centre height (voxel-index space; continuous centre = gy + 0.5). */
  const gy = 17.5;
  const m = new Model(W, H, W);

  // Plinth: skirt, hazard-edged deck, forge floor with rune channels.
  // The inside is hollow — only the shell is ever visible.
  for (let z = 0; z < W; z++)
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dz = z - cz;
      const dist = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx) + Math.PI;
      if (dist <= 13.6 && dist > 12.4) m.set(x, 0, z, C.metal_dark);
      if (dist <= 13.6 && dist > 10.6) {
        const chevron = Math.floor((a / TAU) * 40) % 2 === 0;
        m.set(x, 1, z, dist > 12.7 ? (chevron ? C.safety_yellow : C.hazard_black) : C.metal_dark);
      }
      if (dist > 11) continue;
      let c: number = C.floor_forge;
      const s = (a / TAU) * 8;
      const off = (s - Math.floor(s) - 0.5) * (TAU / 8);
      const perp = Math.abs(Math.sin(off)) * dist;
      if (dist > 10.2) c = C.steel_dark;
      else if (Math.abs(dist - 5.6) < 0.5) c = C.cerulean;
      else if (dist > 6.4 && dist < 9.8 && perp < 0.55) c = dist > 9.3 ? C.cerulean : C.metal_dark;
      else if (Math.abs(dist - 8.2) < 0.45 && perp < 1.7) c = C.plasma_blue;
      else if (dist < 2.2) c = C.metal_dark;
      m.set(x, 2, z, c);
    }

  // Cradle feet under the gate + the #0089 socket plate in front.
  m.box(8, 3, 11, 10, 7, 16, C.metal_dark).box(17, 3, 11, 19, 7, 16, C.metal_dark);
  m.box(8, 3, 16, 10, 3, 16, C.hazard_black).box(17, 3, 16, 19, 3, 16, C.hazard_black);
  m.set(9, 5, 16, C.brass).set(18, 5, 16, C.brass).set(9, 5, 11, C.brass).set(18, 5, 11, C.brass);
  m.box(11, 3, 17, 16, 4, 17, C.metal);
  for (let x = 11; x <= 16; x++) m.set(x, 4, 17, x % 2 ? C.cerulean : C.metal_dark);
  m.set(13, 3, 18, C.gold).set(14, 3, 18, C.gold);

  // Synapsis feed lines from the two stations (Jade 0x4F, Damien 0x89).
  m.box(11, 3, 18, 11, 3, 24, C.cable_black).box(11, 2, 25, 11, 2, 26, C.cable_black);
  m.box(16, 3, 18, 16, 3, 24, C.cable_red).box(16, 2, 25, 16, 2, 26, C.cable_red);

  // Conduit pylons on the diagonals, arms reaching the gate plates.
  for (const [px, pz] of [
    [5, 5],
    [21, 5],
    [5, 21],
    [21, 21],
  ] as const) {
    m.box(px, 2, pz, px + 1, 11, pz + 1, C.metal);
    m.box(px, 5, pz, px + 1, 5, pz + 1, C.brass).box(px, 9, pz, px + 1, 9, pz + 1, C.brass);
    m.box(px, 12, pz, px + 1, 12, pz + 1, C.metal_dark);
    m.set(px, 13, pz, C.cerulean).set(px + 1, 13, pz + 1, C.cerulean);
    const [z0, z1] = pz < cz ? [pz + 2, 11] : [16, pz - 1];
    const ax = px < cx ? px + 1 : px;
    m.box(ax, 10, z0, ax, 11, z1, C.copper);
    const mid = Math.round((z0 + z1) / 2);
    m.box(ax, 10, mid, ax, 11, mid, C.metal_dark).set(ax, 12, mid, C.cerulean);
  }

  // The gate: 16 plates front and back, dark flange outside, gold lip
  // inside with halo-glow dashes, cerulean seams between the plates and
  // rune glyphs cut into every plate.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - cx;
      const dy = y - gy;
      const dist = Math.hypot(dx, dy);
      if (dist < 9.5 || dist > 12.5) continue;
      const s = ((Math.atan2(dy, dx) + Math.PI) / TAU) * 16;
      const seg = Math.floor(s);
      const f = s - seg;
      const arc = Math.min(f, 1 - f) * (TAU / 16) * dist;
      if (arc < 0.45) {
        m.set(x, y, 13, C.cerulean).set(x, y, 14, C.cerulean);
        continue;
      }
      const outer = dist > 11.7;
      const inner = dist < 10.3;
      const glyph =
        !outer && !inner && Math.abs(f - 0.5) < 0.2 && (seg * 5 + Math.round(dist * 2)) % 3 === 0;
      const plate = outer
        ? C.metal_dark
        : inner
          ? C.gold
          : glyph
            ? C.cerulean
            : seg % 2
              ? C.steel
              : C.metal_light;
      m.set(x, y, 12, plate).set(x, y, 15, plate);
      if (outer) m.set(x, y, 13, C.metal_dark).set(x, y, 14, C.metal_dark);
      else if (inner) {
        // Mostly gold; one short cerulean dash per plate keeps the rim readable
        // without the near-white bloom of a solid halo_glow band.
        const lip = Math.abs(f - 0.5) < 0.12 ? C.cerulean : C.gold;
        m.set(x, y, 13, lip).set(x, y, 14, lip);
      }
    }

  // Side clamps and the keystone at the crown.
  m.box(0, 16, 11, 1, 19, 16, C.metal_dark).box(26, 16, 11, 27, 19, 16, C.metal_dark);
  m.set(1, 17, 16, C.brass).set(1, 18, 11, C.brass).set(26, 17, 16, C.brass);
  m.set(26, 18, 11, C.brass).set(27, 18, 13, C.led_amber).set(0, 18, 14, C.led_amber);
  m.box(12, 29, 11, 15, 30, 16, C.metal_dark).box(12, 31, 12, 15, 31, 15, C.gold);
  m.set(13, 30, 16, C.cerulean).set(14, 30, 16, C.cerulean).set(13, 29, 16, C.led_amber);
  m.set(14, 29, 11, C.cerulean);

  // Containment column in the ring's eye: glass, capped, nozzles above and
  // below, held by chrome struts on the plate planes.
  m.cyl(cx, cz, 3.5, 14, 21, C.glass, true);
  m.cyl(cx, cz, 3.5, 13, 13, C.metal_dark).ring(cx, cz, 3.5, 13, C.gold);
  m.cyl(cx, cz, 3.5, 22, 22, C.metal_dark).ring(cx, cz, 3.5, 22, C.gold);
  m.cyl(cx, cz, 1.2, 12, 12, C.cerulean).cyl(cx, cz, 1.2, 23, 23, C.cerulean);
  for (const z of [12, 15]) {
    m.box(5, 17, z, 9, 18, z, C.chrome).box(18, 17, z, 22, 18, z, C.chrome);
    m.box(13, 9, z, 14, 11, z, C.chrome).box(13, 24, z, 14, 26, z, C.chrome);
  }

  // ── Animated parts ──
  // Crystal #0089: slow turn inside the glass, halo-glow core.
  const crystal = new Model(4, 8, 4);
  crystal.box(1, 0, 1, 2, 0, 2, C.crystal_violet);
  for (let y = 1; y <= 5; y++) {
    crystal.box(1, y, 0, 2, y, 3, C.crystal_cyan).box(0, y, 1, 3, y, 2, C.crystal_cyan);
    crystal.box(1, y, 1, 2, y, 2, y === 3 ? C.cerulean : C.crystal_violet);
  }
  crystal.set(0, 3, 1, C.crystal_violet).set(3, 2, 2, C.crystal_violet);
  crystal.box(1, 6, 1, 2, 6, 2, C.crystal_violet).set(1, 7, 2, C.crystal_cyan);

  // Halo ring: dashed band turning in the gate plane.
  const halo = partModel(m, [18, 18, 2], [5, 9, 13], (x, y) => {
    const dist = Math.hypot(x - 8.5, y - 8.5);
    if (dist < 7.2 || dist > 8.6) return 0;
    const k = Math.floor(((Math.atan2(y - 8.5, x - 8.5) + Math.PI) / TAU) * 24) % 3;
    const seg = Math.floor(((Math.atan2(y - 8.5, x - 8.5) + Math.PI) / TAU) * 24);
    if (k === 2) return 0;
    return seg % 6 === 0 ? C.cerulean : C.crystal_cyan;
  });

  // Halo veil: a sparse shimmer membrane between column and halo ring.
  const veil = partModel(m, [18, 18, 1], [5, 9, 13], (x, y) => {
    const dist = Math.hypot(x - 8.5, y - 8.5);
    return dist >= 4.2 && dist <= 6.6 && (x + y) % 3 === 0 ? C.holo_white : 0;
  });

  // Deck runes: twelve raised glyphs between the channel ring and the rim.
  const GLYPHS: readonly (readonly [number, number])[][] = [
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ];
  const runeCells = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + TAU / 24;
    const gx = Math.round(cx + Math.cos(a) * 8.8 - 0.5);
    const gz = Math.round(cz + Math.sin(a) * 8.8 - 0.5);
    for (const [ox, oz] of GLYPHS[i % GLYPHS.length]!)
      runeCells.set(`${gx + ox},${gz + oz}`, C.cerulean);
  }
  const runes = partModel(m, [W, 1, W], [0, 3, 0], (x, _y, z) => runeCells.get(`${x},${z}`) ?? 0);

  return {
    base: m,
    parts: [
      {
        name: "crystal_0089",
        model: crystal,
        offset: [12, 14, 12],
        pivot: [2, 4, 2],
        kind: "spin",
        axis: "y",
        speed: 0.6,
        requiresPower: true,
      },
      {
        name: "halo_ring",
        model: halo,
        offset: [5, 9, 13],
        pivot: [9, 9, 1],
        kind: "spin",
        axis: "z",
        speed: 0.45,
        requiresPower: true,
      },
      {
        name: "halo_veil",
        model: veil,
        offset: [5, 9, 13],
        pivot: [9, 9, 0.5],
        kind: "pulse",
        speed: 0.35,
        amplitude: 0.8,
        requiresPower: true,
      },
      {
        name: "deck_runes",
        model: runes,
        offset: [0, 3, 0],
        pivot: [14, 0, 14],
        kind: "pulse",
        speed: 0.5,
        amplitude: 0.7,
        phase: 1.3,
        requiresPower: true,
      },
    ],
    lights: [
      { pos: [14, 18, 14], color: "#3fa7ff", intensity: 2.2, distance: 14, requiresPower: true },
    ],
  };
}

/**
 * Abstractum seep valve: flanged copper riser out of a bolted floor plate,
 * red handwheel, pressure gauge on the +x side, a sight glass on the front
 * with the Abstractum pulsing behind it, and a violet crust where it seeps.
 */
function valveRig(): PropRig {
  const m = new Model(8, 12, 8);
  m.box(1, 0, 1, 6, 0, 6, C.concrete_dark);
  for (const [x, z] of [
    [1, 1],
    [6, 1],
    [1, 6],
    [6, 6],
  ] as const)
    m.set(x, 0, z, C.brass);
  m.box(3, 1, 3, 4, 9, 4, C.copper);
  m.box(3, 10, 1, 4, 11, 4, C.copper).box(3, 10, 0, 4, 11, 0, C.metal); // elbow into the wall
  for (const y of [2, 9]) {
    m.box(2, y, 2, 5, y, 5, C.metal);
    m.set(2, y, 2, C.brass).set(5, y, 5, C.brass).set(5, y, 2, C.brass).set(2, y, 5, C.brass);
  }
  // Handwheel with spokes and hub.
  m.ring(3.5, 3.5, 3, 7, C.red_paint);
  m.box(3, 7, 0, 4, 7, 7, C.red_paint).box(0, 7, 3, 7, 7, 4, C.red_paint);
  m.box(3, 8, 3, 4, 8, 4, C.brass);
  // Sight glass frame on the front (the glow behind it is the rig part).
  m.box(2, 3, 5, 5, 6, 5, C.metal_dark).box(3, 4, 5, 4, 5, 5, C.glass_purple);
  // Pressure gauge on the +x side, warning tag, status LED.
  m.box(5, 4, 3, 6, 5, 4, C.paint_white).set(6, 5, 4, C.black).set(5, 6, 3, C.metal_dark);
  m.set(2, 9, 4, C.paper_yellow).set(2, 8, 4, C.paper_yellow).set(4, 9, 5, C.led_amber);
  // Where it seeps: violet crust and a small pool.
  m.set(5, 1, 6, C.abstractum).set(6, 1, 5, C.abstractum).set(1, 1, 5, C.crystal_violet);
  m.set(2, 1, 6, C.crystal_violet);
  // The riser behind the sight glass is left open for the glow part.
  m.box(3, 4, 4, 4, 5, 4, 0);
  const glow = new Model(2, 2, 1).box(0, 0, 0, 1, 1, 0, C.abstractum).set(1, 1, 0, C.neon_purple);
  return {
    base: m,
    parts: [
      {
        name: "seep_glow",
        model: glow,
        offset: [3, 4, 4],
        pivot: [1, 1, 0.5],
        kind: "pulse",
        speed: 0.6,
        amplitude: 0.7,
        requiresPower: false,
      },
    ],
    lights: [],
  };
}

/**
 * Workbench (crafting station): plank top on four legs, pegboard with
 * hung tools, a vise with a clamped part, parts trays, a multimeter and an
 * articulated lamp whose bulb flickers.
 */
function benchRig(): PropRig {
  const m = new Model(14, 12, 8);
  m.box(0, 5, 0, 13, 5, 7, C.wood);
  m.box(0, 5, 7, 13, 5, 7, C.wood_dark);
  for (const [x, z] of [
    [0, 0],
    [13, 0],
    [0, 7],
    [13, 7],
  ] as const)
    m.box(x, 0, z, x, 4, z, C.wood_dark);
  m.box(1, 1, 1, 12, 1, 6, C.metal_dark); // lower shelf
  m.box(2, 2, 2, 4, 3, 5, C.cardboard).box(9, 2, 3, 11, 2, 5, C.steel);
  m.set(3, 3, 5, C.paper).set(10, 3, 4, C.copper);
  // Multimeter (back left).
  m.box(1, 6, 1, 3, 7, 3, C.metal).set(2, 7, 1, C.led_green).set(2, 7, 3, C.screen_amber);
  // Pegboard with tools.
  for (let x = 2; x <= 11; x++)
    for (let y = 6; y <= 11; y++) m.set(x, y, 0, x % 2 === 0 && y % 2 ? C.black : C.wood_dark);
  m.box(2, 11, 0, 11, 11, 0, C.wood);
  m.box(5, 7, 1, 5, 9, 1, C.wood).box(4, 10, 1, 6, 10, 1, C.steel); // hammer
  m.box(7, 7, 1, 7, 10, 1, C.chrome).set(6, 10, 1, C.chrome).set(8, 10, 1, C.chrome); // wrench
  m.set(9, 7, 1, C.red_paint).box(9, 8, 1, 9, 9, 1, C.chrome); // screwdriver
  m.box(11, 8, 1, 11, 9, 1, C.orange_paint).set(10, 10, 1, C.metal_dark); // pliers
  // Vise at the front left, a copper part clamped between the jaws.
  m.box(1, 6, 5, 3, 6, 6, C.steel_dark);
  m.box(1, 7, 6, 1, 8, 6, C.steel).box(3, 7, 6, 3, 8, 6, C.steel).set(2, 7, 6, C.copper);
  m.box(4, 7, 6, 5, 7, 6, C.chrome).box(5, 6, 7, 5, 8, 7, C.red_paint);
  // Parts trays.
  m.box(6, 6, 4, 8, 6, 6, C.metal_dark);
  m.set(6, 7, 5, C.brass)
    .set(7, 7, 6, C.copper)
    .set(8, 7, 5, C.led_red)
    .set(7, 7, 4, C.cable_yellow);
  // Blueprint and pencil.
  m.box(9, 6, 4, 12, 6, 6, C.paper).set(10, 6, 5, C.blue_paint).set(11, 6, 6, C.paper_blue);
  m.set(12, 7, 6, C.yellow_paint);
  // Articulated lamp (shade static, bulb is the rig part).
  m.box(12, 6, 1, 13, 6, 2, C.metal_dark).box(12, 7, 1, 12, 10, 1, C.metal);
  m.set(12, 11, 2, C.metal).set(11, 11, 3, C.metal).box(10, 11, 3, 11, 11, 4, C.metal_dark);
  const bulb = new Model(2, 1, 2).box(0, 0, 0, 1, 0, 1, C.lamp_warm);
  return {
    base: m,
    parts: [
      {
        name: "bench_lamp",
        model: bulb,
        offset: [10, 10, 3],
        pivot: [1, 0.5, 1],
        kind: "flicker",
        speed: 3,
        amplitude: 0.25,
        requiresPower: true,
      },
    ],
    lights: [
      { pos: [11, 9, 4], color: "#ffd9a0", intensity: 0.8, distance: 5, requiresPower: true },
    ],
  };
}

const PROP_RIGS: Record<string, () => PropRig> = {
  forge: forgeRig,
  valve: valveRig,
  bench: benchRig,
};

/** Stamp the parts (at rest pose) into a copy of `base`. */
function withParts(base: Model, parts: readonly AnimPart[]): Model {
  const m = taller(base, base.h);
  const origin = new Map<string, [number, number, number]>();
  for (const p of parts) {
    const parent = p.parent ? origin.get(p.parent) : undefined;
    const o: [number, number, number] = parent
      ? [parent[0] + p.offset[0], parent[1] + p.offset[1], parent[2] + p.offset[2]]
      : [p.offset[0], p.offset[1], p.offset[2]];
    origin.set(p.name, o);
    p.model.grid.forEach((x, y, z, v) =>
      m.set(Math.round(x + o[0]), Math.round(y + o[1]), Math.round(z + o[2]), v),
    );
  }
  return m;
}

// ── Static props ─────────────────────────────────────────────────

const PROP_MODELS: Record<string, () => Model> = {
  console: () => {
    const m = taller(consoleDesk(12, 8, C.metal, C.screen_green, 1), 13);
    // Keyboard, status strip, cable run and a warning tag.
    for (let x = 2; x < 10; x++) m.set(x, 6, 5, x % 2 ? C.paint_black : C.metal_dark);
    m.box(0, 1, 7, 11, 1, 7, C.hazard_black).set(1, 4, 7, C.led_green).set(3, 4, 7, C.led_amber);
    m.box(10, 0, 3, 11, 0, 5, C.cable_black).set(9, 3, 7, C.paper_yellow);
    // Vent slats on both flanks, a trackball, a hood with status lamp and whip antenna.
    for (const y of [1, 3])
      m.box(0, y, 3, 0, y, 6, C.metal_dark).box(11, y, 3, 11, y, 6, C.metal_dark);
    m.set(10, 7, 6, C.black).set(10, 7, 5, C.chrome).set(1, 7, 6, C.red_paint);
    m.box(1, 12, 1, 10, 12, 2, C.metal_dark).set(9, 12, 3, C.led_amber).set(2, 12, 3, C.led_green);
    m.box(0, 7, 1, 0, 11, 1, C.steel_dark).box(11, 7, 1, 11, 11, 1, C.steel_dark);
    m.set(11, 12, 1, C.metal_light);
    return m;
  },
  bigterminal: () => {
    const m = new Model(24, 18, 10);
    m.box(0, 0, 3, 23, 5, 9, C.metal_dark);
    m.box(0, 0, 9, 23, 0, 9, C.hazard_black);
    for (let x = 2; x < 22; x += 5)
      m.box(x, 1, 9, x + 2, 4, 9, C.steel_dark).set(x + 1, 3, 9, C.chrome);
    m.box(0, 6, 4, 23, 6, 9, C.metal_light);
    for (let x = 2; x < 22; x++) m.set(x, 6, 8, x % 2 ? C.black : C.metal);
    for (let x = 3; x < 21; x += 3) m.set(x, 6, 6, [C.led_green, C.led_amber, C.led_red][x % 3]!);
    m.box(1, 7, 0, 22, 15, 2, C.metal);
    m.box(1, 15, 0, 22, 15, 2, C.steel);
    m.screen(3, 8, 20, 14, 3, C.screen_green);
    m.box(0, 7, 3, 0, 12, 5, C.metal).box(23, 7, 3, 23, 12, 5, C.metal);
    m.box(0, 13, 3, 0, 13, 4, C.led_amber).box(23, 13, 3, 23, 13, 4, C.led_amber);
    m.box(21, 7, 7, 22, 8, 8, C.ceramic).set(21, 8, 7, C.coffee); // Jade's mug
    // Raised keycaps: two keyboard blocks with a fader bank between them.
    for (let x = 3; x <= 9; x++) m.set(x, 7, 7 + (x % 2), x % 3 ? C.paint_black : C.metal_dark);
    for (let x = 14; x <= 19; x++) m.set(x, 7, 7 + (x % 2), x % 3 ? C.paint_black : C.metal_dark);
    m.box(11, 7, 6, 12, 7, 6, C.metal_dark).set(11, 7, 7, C.chrome).set(12, 7, 8, C.chrome);
    // Big red commit button with a hazard collar, handset on the left flank.
    m.set(1, 7, 8, C.red_paint).set(2, 7, 8, C.hazard_black).set(1, 7, 7, C.hazard_black);
    m.box(0, 9, 6, 0, 11, 6, C.black).set(0, 10, 7, C.cable_black);
    // Side status screens facing +x.
    m.box(23, 9, 4, 23, 11, 4, C.screen_cyan).set(23, 8, 5, C.led_green);
    // Header gantry: lamp strip, red beacons and the name plate.
    m.box(1, 16, 0, 22, 16, 2, C.metal_dark);
    for (let x = 3; x <= 20; x += 3) m.set(x, 17, 1, x % 2 ? C.led_amber : C.screen_green);
    m.set(1, 17, 1, C.led_red).set(22, 17, 1, C.led_red);
    for (let x = 8; x <= 15; x++) m.set(x, 16, 3, x % 2 ? C.paint_white : C.paint_black);
    // Cable trunks down the back corners.
    m.box(0, 0, 0, 0, 6, 1, C.cable_black).box(23, 0, 0, 23, 6, 1, C.cable_yellow);
    return m;
  },
  junction: () => {
    const m = new Model(12, 14, 4);
    m.box(0, 2, 0, 11, 13, 1, C.metal);
    m.box(0, 13, 0, 11, 13, 2, C.steel);
    for (let x = 1; x < 11; x += 2)
      for (let y = 3; y < 12; y += 2) m.set(x, y, 2, (x + y) % 4 === 0 ? C.copper : C.metal_dark);
    m.box(1, 11, 2, 10, 11, 2, C.hazard_black)
      .set(3, 11, 2, C.wall_trim)
      .set(7, 11, 2, C.wall_trim);
    m.box(0, 0, 0, 11, 1, 1, C.hazard_black);
    m.box(2, 0, 2, 3, 2, 2, C.cable_red).box(8, 0, 2, 9, 2, 2, C.cable_yellow);
    m.set(5, 12, 2, C.led_amber).set(6, 12, 2, C.led_red);
    // Breaker levers (two up, one down), a gauge and a lock-out tag.
    m.box(2, 6, 3, 2, 7, 3, C.red_paint).box(5, 6, 3, 5, 7, 3, C.red_paint);
    m.box(8, 4, 3, 8, 5, 3, C.red_paint);
    m.set(2, 8, 3, C.black).set(5, 8, 3, C.black).set(8, 6, 3, C.black);
    m.box(9, 8, 3, 10, 9, 3, C.paint_white).set(10, 9, 3, C.black);
    m.set(3, 5, 3, C.paper_yellow).set(3, 4, 3, C.safety_red);
    m.box(0, 3, 2, 0, 12, 2, C.metal_dark).box(11, 3, 2, 11, 12, 2, C.metal_dark);
    return m;
  },
  elevator: () => {
    const m = new Model(12, 2, 12);
    m.box(0, 0, 0, 11, 0, 11, C.floor_grate);
    for (let x = 0; x < 12; x++) {
      m.set(x, 1, 0, x % 2 ? C.hazard_black : C.wall_trim);
      m.set(x, 1, 11, x % 2 ? C.hazard_black : C.wall_trim);
    }
    m.box(5, 1, 5, 6, 1, 6, C.led_amber);
    m.set(0, 1, 5, C.led_green).set(11, 1, 6, C.led_green);
    return m;
  },
  desk: () => {
    const m = new Model(14, 12, 8);
    m.box(0, 5, 0, 13, 5, 7, C.wood);
    m.box(0, 0, 0, 1, 4, 7, C.wood_dark).box(12, 0, 0, 13, 4, 7, C.wood_dark);
    m.box(2, 1, 0, 11, 4, 0, C.wood_dark); // modesty panel
    m.box(3, 6, 0, 10, 10, 1, C.metal).screen(4, 7, 9, 9, 2, C.screen_amber);
    m.box(6, 6, 2, 7, 6, 2, C.metal_dark);
    m.box(11, 6, 5, 12, 7, 6, C.white).set(11, 7, 5, C.coffee).set(11, 8, 5, C.wood_dark);
    m.box(2, 6, 4, 4, 6, 6, C.paper).box(3, 7, 5, 4, 7, 6, C.paper_yellow);
    m.box(5, 6, 5, 9, 6, 6, C.paint_black); // keyboard
    m.set(1, 6, 1, C.paper_pink).set(12, 6, 1, C.fabric_blue); // Synapsis headset
    return m;
  },
  board: () => {
    const m = new Model(12, 14, 2);
    m.box(0, 3, 0, 11, 13, 0, C.wood_dark);
    m.box(1, 4, 1, 10, 12, 1, C.crt_bg);
    for (let i = 0; i < 14; i++)
      m.set(1 + ((i * 5) % 10), 4 + ((i * 3) % 9), 1, i % 3 ? C.screen_amber : C.lime);
    m.box(2, 12, 1, 9, 12, 1, C.wood);
    m.box(1, 0, 0, 1, 2, 0, C.wood_dark).box(10, 0, 0, 10, 2, 0, C.wood_dark);
    m.box(1, 3, 1, 10, 3, 1, C.wood).set(4, 3, 1, C.paint_white);
    return m;
  },
  pult: () => {
    const m = consoleDesk(12, 8, C.blue_paint, C.screen_cyan, 1);
    for (let x = 1; x < 11; x += 3)
      m.box(x, 6, 5, x + 1, 6, 6, C.metal_dark).set(x, 7, 5, C.red_paint);
    m.box(0, 1, 7, 11, 1, 7, C.paint_teal).set(10, 4, 7, C.led_blue);
    // Coolant vials, fader knobs, feed pipes into the back and a flow gauge.
    m.set(11, 7, 4, C.liquid_blue).set(11, 8, 4, C.glass);
    m.set(11, 7, 6, C.liquid_green).set(11, 8, 6, C.glass);
    for (let x = 2; x < 11; x += 3) m.set(x, 7, 6, C.paint_white);
    m.box(3, 0, 1, 3, 5, 1, C.copper).box(8, 0, 1, 8, 5, 1, C.paint_teal);
    m.box(11, 2, 3, 11, 3, 4, C.paint_white).set(11, 3, 4, C.black);
    return m;
  },
  chair: () => {
    const m = new Model(6, 10, 6);
    m.box(1, 0, 2, 4, 0, 3, C.metal).box(2, 0, 1, 3, 0, 4, C.metal);
    m.set(0, 0, 2, C.rubber).set(5, 0, 3, C.rubber).set(2, 0, 0, C.rubber).set(3, 0, 5, C.rubber);
    m.box(2, 1, 2, 3, 2, 3, C.chrome);
    m.box(0, 3, 0, 5, 3, 5, C.black).box(1, 4, 1, 4, 4, 4, C.leather_black);
    m.box(0, 4, 0, 5, 9, 0, C.black).box(1, 5, 0, 4, 8, 0, C.leather_black);
    m.box(0, 5, 2, 0, 5, 4, C.metal).box(5, 5, 2, 5, 5, 4, C.metal);
    m.box(1, 4, 4, 4, 4, 4, C.leather).set(2, 6, 0, C.leather).set(3, 7, 0, C.leather); // worn
    return m;
  },
  plant: () => {
    const m = new Model(6, 12, 6);
    m.box(1, 0, 1, 4, 3, 4, C.pot);
    m.box(1, 3, 1, 4, 3, 4, C.soil).box(1, 1, 4, 4, 1, 4, C.paint_brick);
    m.box(2, 4, 2, 3, 5, 3, C.wood_dark);
    m.sphere(2.5, 7, 2.5, 2.6, C.plant_green);
    m.set(1, 8, 1, C.leaf_light).set(4, 6, 4, C.leaf_light).set(4, 8, 1, C.leaf_dark);
    m.set(2, 10, 2, C.plant_green).set(3, 11, 3, C.leaf_light);
    // Leaf variation, a yellowing leaf and a dropped one on the soil.
    m.set(0, 7, 3, C.leaf_dark).set(5, 7, 2, C.leaf_light).set(2, 9, 5, C.leaf_dark);
    m.set(3, 6, 5, C.leaf_yellow).set(4, 4, 1, C.leaf_yellow);
    return m;
  },
  pipe: () => {
    const m = new Model(4, 14, 16);
    m.box(1, 0, 0, 2, 13, 1, C.copper).box(1, 12, 0, 2, 13, 15, C.copper);
    m.box(0, 0, 0, 3, 0, 1, C.metal_dark);
    for (const z of [5, 10, 15]) m.box(0, 11, z, 3, 13, z, C.metal_dark);
    m.box(0, 11, 7, 3, 13, 8, C.metal_light).set(3, 12, 7, C.red_paint);
    m.box(0, 5, 0, 3, 5, 1, C.metal_dark);
    return m;
  },
  cable: () => new Model(2, 1, 2).box(0, 0, 0, 1, 0, 1, C.cable_black).set(1, 0, 0, C.cable_red),
  rack: () => {
    const m = rack(8, 14, 6, C.metal_dark, C.screen_green, [C.led_green, C.led_amber]);
    m.box(0, 0, 5, 7, 0, 5, C.black).box(7, 1, 5, 7, 12, 5, C.steel_dark);
    m.box(1, 0, 0, 2, 0, 0, C.cable_black);
    // Door handle, top vent slots, an asset tag.
    m.box(6, 5, 5, 6, 7, 5, C.chrome);
    for (let x = 1; x <= 6; x += 2) m.set(x, 13, 2, C.black).set(x, 13, 3, C.black);
    m.set(1, 1, 5, C.paper_yellow);
    return m;
  },
  lamp: () =>
    new Model(2, 6, 2)
      .box(0, 0, 0, 1, 0, 1, C.metal_dark)
      .box(0, 1, 0, 1, 4, 1, C.metal)
      .box(0, 5, 0, 1, 5, 1, C.white_gold),
  barrel: () =>
    new Model(6, 8, 6)
      .cyl(2.5, 2.5, 2.5, 0, 7, C.yellow_paint)
      .ring(2.5, 2.5, 2.5, 1, C.hazard_black)
      .ring(2.5, 2.5, 2.5, 4, C.hazard_black)
      .cyl(2.5, 2.5, 1.5, 7, 7, C.metal)
      .set(1, 7, 1, C.metal_dark)
      .set(3, 7, 3, C.brass) // bung
      .box(2, 2, 5, 3, 3, 5, C.paper) // label
      .set(2, 3, 5, C.hazard_black)
      .set(5, 6, 3, C.iron_rust)
      .set(5, 5, 3, C.iron_rust), // rust run
  sofa: () => {
    const m = new Model(14, 7, 7);
    m.box(0, 0, 0, 13, 1, 6, C.walnut);
    m.box(0, 2, 0, 13, 3, 6, C.olive);
    m.box(1, 3, 2, 6, 3, 6, C.fabric_green).box(7, 3, 2, 12, 3, 6, C.fabric_green);
    m.box(0, 4, 0, 13, 6, 1, C.olive);
    m.box(0, 4, 0, 1, 5, 6, C.olive).box(12, 4, 0, 13, 5, 6, C.olive);
    m.box(2, 4, 2, 3, 5, 3, C.fabric_mustard).set(9, 4, 4, C.paper);
    return m;
  },
};

/** Props that stay pristine (glowing rigs, markers, cables). */
const CLEAN_PROPS = new Set(["forge", "elevator", "cable", "lamp"]);

function finish(key: string, m: Model): Model {
  return CLEAN_PROPS.has(key) ? m : weatherModel({ id: `prop:${key}` }, m);
}

function propKey(model: string): string {
  return PROP_RIGS[model] || PROP_MODELS[model] ? model : "console";
}

/** Every prop model key (static and rigged). */
export const PROP_MODEL_KEYS: readonly string[] = [
  ...Object.keys(PROP_MODELS),
  ...Object.keys(PROP_RIGS),
];

/**
 * Prop model (fresh copy). Most props get the decor weathering pass
 * (wood grain, fabric shading, chipped paint, grime — recolour only, so
 * dimensions and footprints never change). Rigged props come with their
 * animated parts stamped in at rest pose.
 */
export function propModel(model: string): Model {
  const key = propKey(model);
  const rig = PROP_RIGS[key];
  if (rig) {
    const r = rig();
    return finish(key, withParts(r.base, r.parts));
  }
  return finish(key, PROP_MODELS[key]!());
}

/**
 * Animated visual for a rigged prop (`undefined` for static props): the
 * base without the moving parts, plus the parts and lights. Same contract
 * as `decorVisual` — the renderer meshes `base` instead of `propModel` and
 * builds the parts as a rig (see `render/engine.ts` buildVisualRig).
 */
export function propVisual(model: string): DeviceVisual | undefined {
  const rig = PROP_RIGS[model];
  if (!rig) return undefined;
  const r = rig();
  return { base: finish(model, r.base), parts: r.parts, lights: r.lights, scale: MODEL_SCALE };
}

// ── Pickups ──────────────────────────────────────────────────────

const PICKUP_MODELS: Record<string, () => Model> = {
  crate: () => {
    // Plank supply crate: steel corner posts, strapped lid, latch, stencil.
    const m = new Model(6, 5, 6);
    for (let y = 0; y <= 4; y++) m.box(0, y, 0, 5, y, 5, y % 2 ? C.wood_light : C.wood);
    m.box(0, 4, 0, 5, 4, 5, C.wood_dark).box(1, 4, 1, 4, 4, 4, C.wood);
    m.box(0, 4, 2, 5, 4, 3, C.yellow_paint);
    for (const [x, z] of [
      [0, 0],
      [5, 0],
      [0, 5],
      [5, 5],
    ] as const)
      m.box(x, 0, z, x, 4, z, C.steel_dark);
    m.box(1, 2, 5, 4, 2, 5, C.steel).box(5, 2, 1, 5, 2, 4, C.steel); // straps
    m.box(2, 3, 5, 3, 3, 5, C.safety_yellow).set(2, 1, 5, C.hazard_black).set(3, 1, 5, C.paper);
    m.set(5, 3, 2, C.hazard_black).set(5, 3, 3, C.hazard_black).set(5, 1, 3, C.paper_yellow);
    return m;
  },
  scrap: () => {
    const m = new Model(8, 4, 8);
    m.box(0, 0, 0, 7, 0, 7, C.rust);
    m.box(1, 1, 1, 4, 2, 3, C.metal)
      .box(4, 1, 4, 6, 3, 6, C.copper)
      .box(2, 1, 5, 3, 1, 6, C.metal_light)
      .set(5, 2, 2, C.cable_red)
      .set(6, 1, 1, C.cable_yellow)
      .set(1, 2, 6, C.led_red)
      .box(2, 3, 2, 3, 3, 2, C.steel_dark);
    m.set(0, 0, 7, C.iron_rust).set(7, 0, 0, C.iron_rust).set(6, 3, 5, C.brass);
    return m;
  },
  shelf: () => {
    const m = new Model(10, 12, 4);
    m.box(0, 0, 0, 0, 11, 3, C.metal).box(9, 0, 0, 9, 11, 3, C.metal);
    for (const y of [0, 4, 8, 11]) m.box(0, y, 0, 9, y, 3, C.metal_light);
    m.box(2, 1, 1, 3, 3, 2, C.blue_paint)
      .box(5, 1, 1, 7, 2, 3, C.cardboard)
      .box(5, 5, 1, 7, 6, 2, C.green_paint)
      .box(1, 5, 1, 2, 7, 2, C.paint_gray)
      .box(1, 9, 1, 3, 10, 2, C.cardboard)
      .box(6, 9, 1, 8, 9, 3, C.paper)
      .set(8, 1, 3, C.led_green);
    // Shelf labels on the front edges.
    m.set(2, 4, 3, C.paper_yellow).set(7, 4, 3, C.paper).set(4, 8, 3, C.paper_yellow);
    m.set(6, 2, 3, C.hazard_black);
    return m;
  },
  seep: () => {
    const m = new Model(8, 4, 8);
    m.cyl(3.5, 3.5, 3.5, 0, 0, C.concrete);
    m.ring(3.5, 3.5, 3.2, 0, C.concrete_dark);
    m.cyl(3.5, 3.5, 2.2, 1, 1, C.abstractum);
    m.set(3, 2, 3, C.neon_purple).set(4, 3, 4, C.abstractum).set(2, 2, 5, C.crystal_violet);
    m.set(5, 1, 1, C.crystal_violet);
    // Crystal crust on the rim and cracks running out of the pool.
    m.set(1, 1, 2, C.crystal_violet).set(6, 1, 5, C.crystal_violet).set(6, 2, 5, C.crystal_rose);
    m.set(0, 0, 3, C.black).set(7, 0, 4, C.black).set(3, 0, 7, C.black);
    return m;
  },
  locker: () => {
    // Maintenance locker / wall safe: hinged door, keypad, handle, vents.
    const m = new Model(6, 12, 5);
    m.box(0, 0, 0, 5, 11, 4, C.olive);
    m.box(1, 1, 4, 4, 10, 4, C.wall_olive);
    for (let y = 8; y < 11; y++) m.box(1, y, 4, 4, y, 4, y % 2 ? C.black : C.wall_olive);
    m.set(4, 5, 4, C.metal_light).set(4, 6, 4, C.metal_light);
    m.box(1, 3, 4, 2, 4, 4, C.paper_yellow);
    m.box(0, 11, 0, 5, 11, 4, C.steel_dark);
    // Hinges, keypad with status LED, a kick strip and side vents.
    m.set(1, 2, 4, C.metal_dark).set(1, 7, 4, C.metal_dark);
    m.box(2, 5, 4, 3, 6, 4, C.black).set(3, 6, 4, C.metal_light).set(3, 7, 4, C.led_red);
    m.box(1, 1, 4, 4, 1, 4, C.hazard_black);
    for (let y = 7; y <= 9; y++) m.set(5, y, 2, y % 2 ? C.black : C.olive);
    return m;
  },
  canister: () => {
    // Battery canister: terminals on the lid, charge meter, hazard bands.
    const m = new Model(6, 8, 6);
    m.cyl(2.5, 2.5, 2.5, 0, 6, C.blue_paint);
    m.cyl(2.5, 2.5, 1, 7, 7, C.metal);
    m.ring(2.5, 2.5, 2.5, 3, C.wall_trim);
    m.ring(2.5, 2.5, 2.5, 0, C.hazard_black).ring(2.5, 2.5, 2.5, 6, C.metal_dark);
    m.box(2, 4, 5, 3, 5, 5, C.paint_white).set(2, 5, 5, C.led_green);
    m.set(1, 7, 2, C.red_paint).set(4, 7, 3, C.paint_black);
    m.box(2, 1, 5, 2, 2, 5, C.led_green).set(3, 1, 5, C.led_green).set(3, 2, 5, C.black);
    m.set(5, 4, 2, C.paint_white).set(5, 4, 3, C.hazard_black);
    return m;
  },
  crystal: () => {
    // Crystal geode on a brass-trimmed cradle, split open to the front.
    const m = new Model(6, 8, 6);
    m.box(0, 0, 0, 5, 0, 5, C.metal_dark);
    m.box(0, 0, 5, 5, 0, 5, C.brass).box(5, 0, 0, 5, 0, 5, C.brass);
    for (let z = 0; z < 6; z++)
      for (let y = 1; y < 7; y++)
        for (let x = 0; x < 6; x++) {
          const dist = Math.hypot(x - 2.5, y - 3.5, z - 2.5);
          if (dist > 2.75) continue;
          const open = z >= 3 && y >= 3;
          if (open) {
            if (dist > 1.6) m.set(x, y, z, (x + y) % 2 ? C.crystal_violet : C.crystal_cyan);
          } else if (dist > 1.4) m.set(x, y, z, (x + y + z) % 3 ? C.rock : C.rock_dark);
        }
    m.set(2, 4, 3, C.abstractum).set(3, 4, 3, C.neon_purple).set(2, 3, 3, C.crystal_rose);
    m.box(2, 6, 2, 2, 7, 2, C.crystal_violet)
      .set(3, 7, 3, C.crystal_cyan)
      .set(1, 6, 3, C.crystal_cyan);
    return m;
  },
  paper: () =>
    new Model(3, 1, 3)
      .box(0, 0, 0, 2, 0, 2, C.paper)
      .set(1, 0, 1, C.wood_dark)
      .set(2, 0, 0, C.paper_yellow),
  tape: () =>
    new Model(4, 2, 3)
      .box(0, 0, 0, 3, 1, 2, C.black)
      .set(1, 1, 1, C.white)
      .set(2, 1, 1, C.white)
      .set(0, 1, 0, C.paper),
  screen: () =>
    new Model(4, 4, 2)
      .box(0, 0, 0, 3, 3, 1, C.metal)
      .box(1, 1, 1, 2, 2, 1, C.screen_amber)
      .set(3, 0, 1, C.led_green),
};

/** Every pickup / note model key. */
export const PICKUP_MODEL_KEYS: readonly string[] = Object.keys(PICKUP_MODELS);

export function pickupModel(model: string): Model {
  return (PICKUP_MODELS[model] ?? PICKUP_MODELS.crate!)();
}

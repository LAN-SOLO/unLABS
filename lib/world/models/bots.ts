/**
 * Lore bot designs at fine scale (pure — no three).
 * ==================================================
 *
 * Every bot is authored at BOT_SCALE (0.125 world units per voxel — half
 * the old edge, twice the voxel counts, same world size) and flagged
 * `fine`, so the renderer meshes it as authored (refine family "hires").
 * Designs follow NAR_LORE_bot-origins and the codex: each bot keeps its
 * silhouette, colour scheme and animated personality parts; the extra
 * resolution goes into shaped casings (chamfers + highlight lines),
 * grooved panel seams, screws and rivets, grilles, pixel-art faces with
 * scanlines, stencilled ids, cables, and wear where the lore fits (the old
 * Gen-1 bots are scuffed and rusty, C8-BR41N is nearly pristine).
 *
 * Parts never use `parent`. Amplitudes of translating motions (bob, slide,
 * piston, orbit, jitter) are in fine voxels.
 */
import { C } from "@/lib/world/content/palette";
import {
  block,
  cornerScrews,
  discXY,
  discYZ,
  dust,
  faceRect,
  faceSet,
  fanRotor,
  glow,
  grille,
  hash3,
  hazardFace,
  mount,
  reelModel,
  ringModel,
  rustStreak,
  scorch,
  seam,
  serialPlate,
  stencil,
  stud,
  type AnimPart,
  type Axis,
  type ScreenSpec,
  type VisualLight,
} from "@/lib/world/models/anim";
import {
  cable,
  casing,
  drum,
  flushScrews,
  mirrorModelX,
  pixels,
  recess,
  sprite,
  weather,
} from "@/lib/world/models/bot-kit";
import { Model } from "@/lib/world/models/core";

/** Awake parts ignore rig power (the engine animates them whatever `rig.powered` says). */
export const ALWAYS = { power: false } as const;
/** W2-REK: world units covered per full tripod cycle (legs sway ±0.4 rad). */
const W2REK_STRIDE = 1.1;

/** A part's resting angle while its bot sleeps. */
export interface Slump {
  axis: Axis;
  angle: number;
}

/** A bot before the awake / dormant split. */
export interface BotDesign {
  base: Model;
  parts: AnimPart[];
  lights: VisualLight[];
  screens?: ScreenSpec[];
  /** Parts that sag (static rotation about their pivot) while dormant. */
  slump?: Record<string, Slump>;
  /** Parts that only exist while awake (floating sparks, glitch pixels). */
  awakeOnly?: readonly string[];
}

const BODY_METAL: ReadonlySet<number> = new Set([
  C.bot_body,
  C.bot_dark,
  C.steel,
  C.steel_dark,
  C.aluminium,
]);

// ── Shared part makers ───────────────────────────────────────────

/** Sprocket / road wheel facing ±x (spins about x): tyre, spokes, hub cap. */
function wheel(
  r: number,
  tyre: number,
  rim: number,
  hub: number = C.chrome,
  spokes = 5,
  tread: number = C.rubber,
): Model {
  const s = 2 * Math.ceil(r) + 1;
  const ctr = (s - 1) / 2;
  const m = new Model(2, s, s);
  for (let z = 0; z < s; z++)
    for (let y = 0; y < s; y++) {
      const d = Math.hypot(y - ctr, z - ctr);
      if (d > r + 0.35) continue;
      const a = Math.atan2(z - ctr, y - ctr);
      const spoke = Math.abs(Math.sin((a * spokes) / 2)) < 0.3;
      let c: number;
      if (d > r - 1.1) c = (Math.round(a * 4) & 1) === 0 ? tyre : tread;
      else if (d < 1.2) c = hub;
      else if (spoke || d > r - 1.9) c = rim;
      else c = C.metal_dark;
      m.set(0, y, z, c);
      if (d <= r - 1.1) m.set(1, y, z, d < 1.2 ? C.steel_dark : C.metal_dark);
    }
  return m;
}

/** Whip antenna: `n` chrome segments with joint collars and a coloured tip. */
function whip(n: number, tip: number): Model {
  const m = new Model(3, n + 2, 3);
  m.box(1, 0, 1, 1, n - 1, 1, C.chrome);
  m.box(0, 0, 0, 2, 0, 2, C.steel_dark).set(1, 0, 1, C.metal_dark);
  for (let y = 3; y < n; y += 4) m.set(1, y, 1, C.steel);
  m.box(0, n, 0, 2, n, 2, tip).set(1, n + 1, 1, tip);
  m.set(0, n, 0, 0).set(2, n, 0, 0).set(0, n, 2, 0).set(2, n, 2, 0);
  return m;
}

/**
 * Single LED in a dark bezel (w×h×1). The bezel is `led_bezel` (emissive
 * class, near black) so a lamp part stays one material — one draw call.
 */
export function lamp(w: number, h: number, c: number, bezel: number = C.led_bezel): Model {
  const m = new Model(w + 2, h + 2, 1);
  m.box(0, 0, 0, w + 1, h + 1, 0, bezel);
  m.box(1, 1, 0, w, h, 0, c);
  return m;
}

// ── F1N-DR ───────────────────────────────────────────────────────

/**
 * F1N-DR (1991, Gen 1 finder, "find what connects these signals"): a
 * patient tracked crawler with a calm green face, a radar dish sweeping
 * for 35 years and a whip antenna. Riveted grey hull, rubber tracks with
 * lugs and road wheels, a hazard hatch on the back, rust weeping from the
 * vents.
 */
function f1ndr(): BotDesign {
  const m = new Model(24, 18, 22);
  // Tracks: rubber belts with lugs and rounded ends, a steel skirt with road-wheel bolts.
  for (const x0 of [0, 20]) {
    // Belt with rounded ends (chamfered only where it wraps round the sprockets).
    m.box(x0, 0, 0, x0 + 3, 5, 21, C.rubber);
    for (const [y, z] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [5, 0],
      [5, 1],
      [4, 0],
      [0, 21],
      [0, 20],
      [1, 21],
      [5, 21],
      [5, 20],
      [4, 21],
    ] as const)
      m.box(x0, y, z, x0 + 3, y, z, 0);
    for (let z = 1; z <= 20; z += 2) {
      m.set(x0, 0, z, 0).set(x0 + 3, 0, z, 0);
      if (m.grid.get(x0 + 1, 5, z)) m.set(x0 + 1, 5, z, C.bot_dark).set(x0 + 2, 5, z, C.bot_dark);
    }
    const out = x0 === 0 ? 0 : 3;
    m.box(x0 + out, 2, 3, x0 + out, 4, 18, C.steel_dark);
    m.box(x0 + out, 3, 3, x0 + out, 3, 18, C.metal_dark);
    for (const z of [8, 13]) m.set(x0 + out, 3, z, C.chrome);
  }
  // Undercarriage and hull.
  m.box(4, 3, 3, 19, 5, 18, C.bot_dark);
  casing(m, 4, 6, 2, 19, 15, 19, C.bot_body, { r: 2, edge: C.aluminium });
  // Hull seams: a belt line and a plate joint on top, rivets along the belt.
  seam(m, "+x", 19, 4, 11, 17, 11, C.metal_dark);
  seam(m, "-x", 4, 4, 11, 17, 11, C.metal_dark);
  seam(m, "+y", 15, 6, 11, 17, 11, C.metal_dark);
  for (let z = 5; z <= 17; z += 4) {
    stud(m, "+x", 19, z, 10, C.steel);
    stud(m, "-x", 4, z, 10, C.steel);
  }
  // Face: steel bezel with slotted screws, a recessed scanlined screen, a soft smile
  // (the eyes are a blinking part).
  faceRect(m, "+z", 19, 6, 7, 17, 15, 0, C.steel_dark);
  recess(m, "+z", 19, 7, 8, 16, 14, 1, C.crt_bg);
  for (let y = 8; y <= 14; y += 2) faceRect(m, "+z", 19, 7, y, 16, y, 1, C.black);
  pixels(m, "+z", 19, 8, 10, ["G......G", ".GG..GG.", "...GG..."], { G: C.screen_green }, 1);
  flushScrews(m, "+z", 19, [
    [6, 7],
    [17, 7],
    [6, 15],
    [17, 15],
  ]);
  // Chin: sensor grille between two headlamp lenses.
  grille(m, "+z", 19, 9, 3, 14, 5, 1, C.steel_dark);
  faceRect(m, "+z", 19, 6, 4, 7, 5, -1, C.chrome_lt);
  faceRect(m, "+z", 19, 16, 4, 17, 5, -1, C.chrome_lt);
  // Back: hazard hatch with screws and a pull handle, the 1991 barcode tag.
  hazardFace(m, "-z", 2, 7, 11, 16, 14);
  seam(m, "-z", 2, 6, 10, 17, 10);
  cornerScrews(m, "-z", 2, 7, 11, 16, 14, C.steel);
  faceRect(m, "-z", 2, 10, 8, 13, 8, -1, C.chrome);
  serialPlate(m, "-z", 2, 8, 6, ["91"], { bg: C.aluminium, d: 0 });
  // Flanks: louvred vents and the stencilled designation.
  grille(m, "+x", 19, 4, 12, 9, 14, 1);
  grille(m, "-x", 4, 12, 12, 17, 14, 1);
  stencil(m, "-x", 4, 4, 6, "F1N", C.paint_cream);
  stencil(m, "+x", 19, 17, 6, "F1N", C.paint_cream);
  // Top: mast socket, a cable into its gland, a spare-parts lid.
  m.box(11, 16, 8, 12, 16, 9, C.steel_dark);
  cable(m, [12, 16, 10], [15, 16, 13], C.cable_black);
  m.set(15, 16, 13, C.brass);
  casing(m, 6, 16, 13, 9, 16, 17, C.bot_dark, { top: false });
  m.set(7, 16, 15, C.chrome);
  // Thirty-five years of corridors: rust from the vents, chipped edges, grime, dust.
  rustStreak(m, "+x", 19, 5, 6, 11);
  rustStreak(m, "+x", 19, 8, 7, 11);
  rustStreak(m, "-x", 4, 14, 6, 11);
  weather(m, {
    rust: 0.012,
    chips: 0.008,
    chip: C.aluminium,
    only: BODY_METAL,
    seed: 1,
  });
  m.set(8, 15, 6, C.grime).set(9, 15, 7, C.grime).set(16, 15, 4, C.grime);
  dust(m, 6, 0.5);

  // Radar dish: an orange-peel reflector with a rim, ribs and a feed horn on struts.
  const dish = new Model(15, 9, 7);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 15; x++) {
      const e = ((x - 7) / 7.4) ** 2 + ((y - 4.5) / 4.4) ** 2;
      if (e > 1) continue;
      const z = 1 + Math.round(e * 3);
      dish.set(x, y, z, e > 0.72 ? C.aluminium : (x + y) % 4 === 0 ? C.steel : C.bot_body);
      if (e < 0.5) dish.set(x, y, z - 1, C.bot_dark);
    }
  dish.box(7, 0, 1, 7, 4, 1, C.steel_dark);
  cable(dish, [7, 4, 2], [7, 4, 6], C.steel_dark);
  dish.set(7, 4, 6, C.led_red).set(6, 4, 5, C.chrome).set(8, 4, 5, C.chrome);
  const eyes = sprite(["GG....GG", "GG....GG"], {
    G: C.screen_green,
  });
  const hubs: AnimPart[] = [];
  [4, 17].forEach((z, i) => {
    for (const [side, x] of [
      ["l", -1],
      ["r", 25],
    ] as const)
      hubs.push(
        mount(
          `hub_${side}${i}`,
          wheel(2.6, C.steel_dark, C.steel, C.chrome, 5, C.steel_dark_dk),
          [x, 3, z],
          "spin",
          {
            axis: "x",
            speed: 0.9,
            gait: "roll",
            rollRadius: 2.6,
            ...ALWAYS,
          },
        ),
      );
  });
  return {
    base: m,
    parts: [
      ...hubs,
      mount("dish", dish, [12, 15, 8], "sway", {
        axis: "y",
        speed: 0.07,
        amplitude: 1.3,
        pivot: [7.5, 0, 1.5],
        ...ALWAYS,
      }),
      mount("eyes", eyes, [12, 13, 19.5], "blink", {
        speed: 0.18,
        amplitude: 0.94,
        ...ALWAYS,
      }),
      mount("whip", whip(5, C.led_green), [5.5, 16, 4.5], "sway", {
        axis: "x",
        speed: 0.35,
        amplitude: 0.14,
        pivot: [1.5, 0, 1.5],
        ...ALWAYS,
      }),
      mount("status", lamp(1, 1, C.led_green), [17.5, 17.5, 4.5], "pulse", {
        speed: 0.5,
        amplitude: 0.7,
        ...ALWAYS,
      }),
    ],
    lights: [glow([12, 11, 21], "screen_green", 1.5, 3, false)],
    slump: {
      dish: { axis: "x", angle: 0.55 },
      whip: { axis: "x", angle: -1 },
    },
  };
}

// ── X0-R8T ───────────────────────────────────────────────────────

/**
 * X0-R8T (1988, the first listener, ANOMALOUS): a walnut reel-to-reel
 * cabinet built from salvage, still recording — and relaying — the void.
 * Aluminium deck with tape reels, capstan and head block, a VU meter, piano
 * keys, a warm valve and a whip antenna that droops when it sleeps. 847
 * tally marks on the back: the response packets nobody wrote.
 */
function x0r8t(): BotDesign {
  const m = new Model(24, 20, 20);
  for (const [x, z] of [
    [1, 1],
    [21, 1],
    [1, 14],
    [21, 14],
  ] as const)
    m.box(x, 0, z, x + 1, 0, z + 1, C.rubber);
  // Cabinet: walnut-edged wood, grain streaks.
  casing(m, 0, 1, 0, 23, 15, 15, C.wood, { r: 2, edge: C.walnut });
  m.grid.forEach((x, y, z, v) => {
    if (v !== C.wood) return;
    const g = hash3(Math.floor(x / 5), y, z * 3);
    if (g < 0.18) m.set(x, y, z, C.wood_grain);
    else if (g > 0.9) m.set(x, y, z, C.wood_light_grain);
  });
  // Deck: riveted aluminium plate on the front with a bevelled rim.
  faceRect(m, "+z", 15, 1, 2, 22, 14, -1, C.aluminium);
  faceRect(m, "+z", 15, 1, 14, 22, 14, -1, C.chrome);
  faceRect(m, "+z", 15, 1, 2, 22, 2, -1, C.steel);
  for (const [x, y] of [
    [2, 3],
    [21, 3],
    [2, 13],
    [21, 13],
  ] as const)
    faceSet(m, "+z", 15, x, y, -1, C.steel_dark);
  // Reel wells (dark discs behind the spinning reels).
  discXY(m, 6, 9, 16, 4.4, C.metal_dark);
  discXY(m, 17, 9, 16, 4.4, C.metal_dark);
  // Tape path: guide posts, head block and capstan with pinch roller.
  for (let x = 6; x <= 17; x++) m.set(x, 4, 16, C.coffee);
  m.box(10, 3, 16, 13, 6, 16, C.steel_dark);
  m.box(11, 5, 16, 12, 6, 16, C.chrome);
  m.set(9, 4, 16, C.chrome).set(14, 4, 16, C.chrome).set(14, 5, 16, C.rubber);
  // VU well at the top, recording lamp socket, the "847" label.
  faceRect(m, "+z", 15, 8, 12, 15, 13, -1, C.black);
  faceRect(m, "+z", 15, 2, 2, 5, 3, -1, C.paper);
  stencil(m, "+z", 15, 2, 1, "8", C.paint_black, 0);
  // Piano keys along the top front: rec (red), play (green), the rest cream / grey.
  m.box(2, 15, 11, 21, 15, 14, C.walnut);
  for (let k = 0; k < 9; k++) {
    const x = 3 + k * 2;
    const c =
      k === 0 ? C.safety_red : k === 1 ? C.safety_green : k % 2 ? C.paint_gray : C.paint_cream;
    m.box(x, 16, 12, x, 16, 14, c).set(x, 16, 14, c === C.paint_cream ? C.paint_white : c);
  }
  // Carry handle: leather strap on brass lugs.
  m.box(6, 16, 5, 7, 16, 6, C.brass).box(16, 16, 5, 17, 16, 6, C.brass);
  m.box(7, 17, 5, 16, 17, 6, C.leather_black);
  m.box(6, 17, 5, 6, 17, 6, C.leather);
  m.box(17, 17, 5, 17, 17, 6, C.leather);
  // Back: a patched cable into a brass gland, and a paper strip of tally marks.
  cable(m, [11, 0, 0], [11, 8, 0], C.cable_black);
  m.set(11, 8, 0, C.copper).set(12, 8, 0, C.brass);
  faceRect(m, "-z", 0, 3, 9, 19, 13, 0, C.paper);
  for (let x = 4; x <= 18; x++) if (x % 5 !== 3) m.set(x, x % 2 ? 12 : 11, 0, C.paint_black);
  for (let x = 4; x <= 18; x += 5) m.box(x, 10, 0, x + 3, 10, 0, C.book_red);
  stencil(m, "-z", 0, 19, 3, "847", C.paint_cream);
  // Flanks: hand-stencilled designation left, a vent and the tuner right.
  stencil(m, "-x", 0, 3, 11, "X0", C.paint_cream);
  stencil(m, "-x", 0, 3, 5, "R8T", C.paint_cream);
  grille(m, "+x", 23, 3, 3, 11, 9, 1);
  discYZ(m, 23, 12, 12, 2.2, C.walnut);
  // Age: rust under the plate screws, scuffs, a scorched corner, dust on the feet.
  rustStreak(m, "+z", 16, 2, 1, 3);
  rustStreak(m, "+z", 16, 21, 1, 3);
  for (const [x, y, z] of [
    [0, 8, 5],
    [23, 6, 13],
    [14, 13, 0],
    [4, 15, 3],
    [19, 15, 9],
  ] as const)
    m.set(x, y, z, C.wood_dark);
  scorch(m, "+x", 23, 16, 13, 1.8);
  // Valve socket on the top rear left.
  m.box(2, 15, 2, 4, 15, 4, C.steel_dark).set(3, 15, 3, C.copper);
  dust(m, 4, 0.45);

  const vu = sprite(["GGGGAARR", "G.G.A.R."], {
    G: C.screen_green,
    A: C.screen_amber,
    R: C.led_red,
  });
  const tuner = new Model(4, 2, 4);
  tuner.box(0, 0, 0, 3, 1, 3, C.paint_black).set(0, 1, 0, 0).set(3, 1, 0, 0);
  tuner.set(0, 1, 3, 0).set(3, 1, 3, 0).set(1, 1, 3, C.chrome).set(2, 1, 3, C.chrome);
  const valve = new Model(3, 6, 3);
  // Glass envelope with a glowing filament (no metal socket: the base carries it).
  valve.box(0, 0, 0, 2, 4, 2, C.glass_amber).set(1, 5, 1, C.glass_amber);
  valve.box(1, 1, 1, 1, 3, 1, C.white_gold);
  return {
    base: m,
    parts: [
      mount("reel_l", reelModel(3.6, C.paint_black, C.chrome), [6.5, 9.5, 17.5], "spin", {
        axis: "z",
        speed: -2.6,
        ...ALWAYS,
      }),
      mount("reel_r", reelModel(3.6, C.paint_black, C.chrome), [17.5, 9.5, 17.5], "spin", {
        axis: "z",
        speed: -3.1,
        ...ALWAYS,
      }),
      mount("vu", vu, [12, 13, 17.5], "flicker", {
        speed: 9,
        amplitude: 0.7,
        ...ALWAYS,
      }),
      mount("antenna", whip(5, C.led_red), [20.5, 16, 2.5], "sway", {
        speed: 0.45,
        amplitude: 0.18,
        pivot: [1.5, 0, 1.5],
        ...ALWAYS,
      }),
      mount("rec", lamp(1, 1, C.led_red), [3.5, 12.5, 17.5], "blink", {
        speed: 0.8,
        ...ALWAYS,
      }),
      // Somebody keeps retuning it — X0-R8T itself.
      mount("tuner", tuner, [24.5, 12, 12], "step", {
        axis: "x",
        speed: 0.35,
        amplitude: Math.PI / 5,
        pivot: [0, 2, 2],
        ...ALWAYS,
      }),
      mount("valve", valve, [3.5, 16, 3.5], "pulse", {
        speed: 0.25,
        amplitude: 0.6,
        pivot: [1.5, 0, 1.5],
        ...ALWAYS,
      }),
    ],
    lights: [glow([12, 13, 19], "screen_amber", 1.5, 3, false)],
    slump: { antenna: { axis: "z", angle: 1.1 } },
  };
}

// ── L0G-1K ───────────────────────────────────────────────────────

/**
 * L0G-1K (1992, logic verifier — Damien's safeguard against wishful
 * thinking): a rigid navy cabinet with a brass-framed abacus face. Beads
 * slide as it reasons, TRUE / FALSE lamps alternate, a paper tape of
 * verdicts feeds out of the side printer, a reasoning gear turns on its
 * flank.
 */
function l0g1k(): BotDesign {
  const m = new Model(20, 22, 16);
  // Feet and ankle blocks.
  for (const x0 of [2, 11]) {
    casing(m, x0, 0, 3, x0 + 6, 1, 13, C.rubber, { vertical: true, top: true });
    m.box(x0 + 2, 2, 6, x0 + 4, 2, 9, C.bot_dark);
  }
  // Cabinet: navy with steel bevels, a riveted belt.
  casing(m, 2, 3, 2, 17, 20, 13, C.paint_navy, { r: 2, edge: C.steel });
  seam(m, "+x", 17, 3, 7, 12, 7, C.black);
  seam(m, "-x", 2, 3, 7, 12, 7, C.black);
  for (let z = 4; z <= 11; z += 3) {
    stud(m, "+x", 17, z, 6, C.steel);
    stud(m, "-x", 2, z, 6, C.steel);
  }
  // Abacus: brass frame, black field, chrome rods (the beads are parts).
  faceRect(m, "+z", 13, 3, 8, 16, 19, -1, C.brass);
  faceRect(m, "+z", 13, 4, 9, 15, 18, -1, 0);
  faceRect(m, "+z", 13, 4, 9, 15, 18, 0, C.black);
  for (const y of [10, 13, 16]) faceRect(m, "+z", 13, 4, y, 15, y, -1, C.chrome);
  for (const x of [3, 16]) for (const y of [8, 19]) faceSet(m, "+z", 13, x, y, -1, C.gold);
  // Designation under the abacus.
  stencil(m, "+z", 13, 4, 7, "L0G", C.paint_cream);
  // Top: a small sensor head with a cyan slit; TRUE / FALSE lamp cups.
  casing(m, 6, 21, 4, 13, 21, 11, C.steel, { top: false });
  m.box(7, 21, 11, 12, 21, 11, C.black);
  m.box(3, 21, 11, 4, 21, 12, C.steel_dark).box(15, 21, 11, 16, 21, 12, C.steel_dark);
  // Side paper-tape printer with a slot; the tape is a part.
  m.box(18, 8, 5, 19, 12, 11, C.steel_dark);
  m.box(19, 11, 7, 19, 11, 9, C.black);
  m.set(18, 12, 10, C.led_green).set(19, 9, 5, C.chrome).set(19, 9, 11, C.chrome);
  // Back: a vent and the 1992 tag.
  grille(m, "-z", 2, 13, 11, 6, 17, 1);
  serialPlate(m, "-z", 2, 15, 3, ["92"], { d: 0 });
  // Never changes, never cleans: dust, and a verdigris-dark streak under the brass.
  rustStreak(m, "+z", 14, 15, 3, 7);
  rustStreak(m, "+z", 14, 4, 4, 7);
  weather(m, {
    chips: 0.02,
    chip: C.steel,
    only: new Set([C.paint_navy]),
    seed: 2,
  });
  dust(m, 4, 0.4);

  // Reasoning gear on the left flank (spins while it thinks).
  const gear = new Model(2, 11, 11);
  discYZ(gear, 0, 5, 5, 4.2, C.brass);
  discYZ(gear, 1, 5, 5, 3.2, C.bronze);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    gear.set(0, Math.round(5 + Math.sin(a) * 5), Math.round(5 + Math.cos(a) * 5), C.brass);
  }
  for (const [y, z] of [
    [3, 3],
    [3, 7],
    [7, 3],
    [7, 7],
  ] as const)
    gear.set(0, y, z, 0);
  gear.box(0, 4, 4, 0, 6, 6, C.steel_dark).set(0, 5, 5, C.chrome);
  const beads = (c: number, n: number): Model => {
    const b = new Model(n * 3 - 1, 2, 1);
    for (let i = 0; i < n; i++) {
      b.box(i * 3, 0, 0, i * 3 + 1, 1, 0, c);
      b.set(i * 3, 1, 0, C.flower_red);
    }
    return b;
  };
  const tape = new Model(1, 6, 3);
  tape.box(0, 0, 0, 0, 5, 2, C.paper);
  for (const y of [1, 3, 5]) tape.set(0, y, y % 4 === 1 ? 1 : 0, C.paint_black);
  tape.set(0, 0, 2, C.paper_yellow);
  const eyes = sprite(["CC..CC"], { C: C.screen_cyan });
  return {
    base: m,
    parts: [
      ...[10, 13, 16].map((y, i) =>
        mount(
          `beads_${i}`,
          beads(i === 1 ? C.safety_red : C.wood_red, i === 1 ? 1 : 2),
          [9.5, y + 0.5, 15.5],
          "slide",
          {
            speed: 0.22 + i * 0.09,
            amplitude: i === 1 ? 4 : 2,
            phase: i * 2.1,
            ...ALWAYS,
          },
        ),
      ),
      mount("eyes", eyes, [9.5, 21.5, 12.5], "blink", {
        speed: 0.3,
        amplitude: 0.9,
        ...ALWAYS,
      }),
      mount("gear", gear, [1, 13.5, 7.5], "spin", {
        axis: "x",
        speed: 0.8,
        ...ALWAYS,
      }),
      mount("lamp_true", lamp(2, 1, C.led_green), [4, 22.5, 13.5], "blink", {
        speed: 0.3,
        amplitude: 0.5,
        ...ALWAYS,
      }),
      mount("lamp_false", lamp(2, 1, C.led_red), [16, 22.5, 13.5], "blink", {
        speed: 0.3,
        amplitude: 0.5,
        phase: Math.PI,
        ...ALWAYS,
      }),
      mount("tape", tape, [19.5, 8, 8], "piston", {
        speed: 0.3,
        amplitude: -3,
        pivot: [0.5, 6, 1.5],
        ...ALWAYS,
      }),
    ],
    lights: [glow([10, 22, 13], "screen_cyan", 1.2, 3, false)],
    slump: { gear: { axis: "x", angle: 0.4 } },
  };
}

// ── P1N-DR0 ──────────────────────────────────────────────────────

/**
 * P1N-DR0 (1991, retrieval — never gives up): an orange rover on big
 * treaded wheels with a scanning amber screen, headlamps, a retrieval bin
 * with a found slice and a boom claw that opens and closes. Hazard
 * panels, a scorch from a bad socket, mud on the chassis.
 */
function p1ndr0(): BotDesign {
  const m = new Model(26, 22, 22);
  // Chassis and axle housings.
  casing(m, 4, 2, 4, 21, 7, 17, C.bot_dark, { r: 1, bottom: true });
  m.box(3, 4, 9, 22, 6, 12, C.steel_dark);
  // Body: orange with pressed bevels, hazard side panels, headlamps.
  casing(m, 6, 8, 4, 19, 17, 17, C.safety_orange, {
    r: 2,
    edge: C.orange_paint,
  });
  hazardFace(m, "+x", 19, 6, 10, 15, 14);
  hazardFace(m, "-x", 6, 6, 10, 15, 14);
  cornerScrews(m, "+x", 19, 6, 10, 15, 14, C.steel);
  cornerScrews(m, "-x", 6, 6, 10, 15, 14, C.steel);
  seam(m, "+y", 17, 8, 8, 17, 8, C.orange_paint_dk);
  // Front: bezelled amber scan screen (the scan bar is a part) and lamps.
  faceRect(m, "+z", 17, 8, 11, 17, 16, 0, C.black);
  recess(m, "+z", 17, 9, 12, 16, 15, 1, C.crt_bg);
  pixels(
    m,
    "+z",
    17,
    9,
    15,
    ["A.A.A.A.", "........", "AAAA.AA.", "........"],
    { A: C.screen_amber },
    1,
  );
  faceRect(m, "+z", 17, 7, 8, 18, 9, 0, C.bot_dark);
  faceRect(m, "+z", 17, 8, 8, 9, 9, -1, C.led_green);
  faceRect(m, "+z", 17, 16, 8, 17, 9, -1, C.led_amber);
  grille(m, "+z", 17, 11, 8, 14, 9, 1);
  // Retrieval bin on the back with a crumpled page and a found slice inside.
  m.box(6, 18, 5, 12, 19, 10, C.steel);
  m.box(7, 19, 6, 11, 19, 9, 0);
  m.box(7, 18, 6, 11, 18, 9, C.metal_dark);
  m.box(8, 19, 7, 9, 19, 8, C.paper_yellow).set(10, 19, 7, C.crystal_violet);
  m.set(10, 19, 8, C.crystal_violet).set(8, 19, 6, C.paper);
  // Boom: post, arm forward, wrist.
  m.box(15, 18, 8, 16, 20, 9, C.steel_dark);
  m.box(15, 20, 10, 16, 21, 19, C.steel);
  m.box(15, 20, 14, 16, 20, 14, C.brass);
  m.box(15, 19, 19, 16, 20, 20, C.chrome);
  cable(m, [17, 18, 9], [17, 20, 16], C.cable_black);
  // Back: stencilled designation, a tow hook.
  stencil(m, "-z", 4, 17, 11, "P1N", C.bot_dark);
  m.box(12, 3, 3, 13, 3, 3, C.chrome);
  // Field wear: a scorch, rust on the chassis, mud, dust.
  scorch(m, "+x", 19, 6, 16, 1.8);
  rustStreak(m, "-x", 4, 7, 2, 6);
  rustStreak(m, "+x", 21, 14, 2, 6);
  weather(m, {
    chips: 0.03,
    chip: C.steel,
    only: new Set([C.safety_orange]),
    seed: 3,
  });
  dust(m, 6, 0.55);

  const finger = (side: -1 | 1): Model => {
    const f = new Model(3, 6, 2);
    const outer = side < 0 ? 0 : 2;
    const inner = side < 0 ? 1 : 1;
    f.box(outer, 2, 0, outer, 5, 1, C.chrome);
    f.box(inner, 0, 0, inner, 1, 1, C.steel_dark);
    f.set(outer, 1, 0, C.steel_dark).set(outer, 1, 1, C.steel_dark);
    f.set(outer, 5, 0, C.metal_dark).set(outer, 5, 1, C.metal_dark);
    return f;
  };
  const scan = new Model(8, 1, 1).box(0, 0, 0, 7, 0, 0, C.led_amber);
  return {
    base: m,
    parts: [
      mount("wheel_l", wheel(4.6, C.rubber, C.steel, C.safety_orange, 6), [3, 4.5, 11], "spin", {
        axis: "x",
        speed: 1.1,
        gait: "roll",
        rollRadius: 4.6,
        ...ALWAYS,
      }),
      mount("wheel_r", wheel(4.6, C.rubber, C.steel, C.safety_orange, 6), [23, 4.5, 11], "spin", {
        axis: "x",
        speed: 1.1,
        gait: "roll",
        rollRadius: 4.6,
        ...ALWAYS,
      }),
      mount("claw_l", finger(-1), [15, 19, 20], "sway", {
        speed: 0.5,
        amplitude: 0.4,
        pivot: [3, 6, 1],
        ...ALWAYS,
      }),
      mount("claw_r", finger(1), [16, 19, 20], "sway", {
        speed: 0.5,
        amplitude: 0.4,
        phase: Math.PI,
        pivot: [0, 6, 1],
        ...ALWAYS,
      }),
      mount("lamp", lamp(2, 1, C.led_amber), [9, 20.5, 11.5], "blink", {
        speed: 0.5,
        ...ALWAYS,
      }),
      mount("antenna", whip(3, C.led_green), [12.5, 18, 5.5], "sway", {
        speed: 0.6,
        amplitude: 0.2,
        pivot: [1.5, 0, 1.5],
        ...ALWAYS,
      }),
      mount("scan", scan, [12.5, 13.5, 17.5], "slide", {
        axis: "y",
        speed: 0.6,
        amplitude: 1.5,
        ...ALWAYS,
      }),
    ],
    lights: [glow([12.5, 13, 19], "screen_amber", 1.5, 3, false)],
    slump: {
      claw_l: { axis: "z", angle: 0.45 },
      claw_r: { axis: "z", angle: -0.45 },
      antenna: { axis: "x", angle: -0.9 },
    },
  };
}

// ── R3-TR0 ───────────────────────────────────────────────────────

/**
 * R3-TR0 (1998, terminal purist — GUIs don't exist): a grumpy beige CRT
 * head that looks away from you on a keyboard chest it keeps typing on,
 * a floppy it refuses to give back, a "NO GUI" note on its casing.
 * Yellowed plastic, a coffee drip down the keys.
 */
function r3tr0(): BotDesign {
  const m = new Model(20, 10, 20);
  // Treads and axle blocks.
  for (const x0 of [2, 12]) {
    casing(m, x0, 0, 5, x0 + 5, 2, 13, C.rubber, {
      r: 1,
      vertical: false,
      bottom: true,
    });
    for (let z = 6; z <= 12; z += 2) m.set(x0, 1, z, C.bot_dark).set(x0 + 5, 1, z, C.bot_dark);
    m.box(x0 + 1, 3, 7, x0 + 4, 3, 11, C.bot_dark);
  }
  // Chest: beige plastic with cream bevels.
  casing(m, 2, 4, 2, 17, 9, 15, C.beige, { r: 2, edge: C.paint_cream });
  // Keyboard tray: keys with gaps, a red ESC, a white space bar, the tapped key is a part.
  m.box(2, 4, 15, 17, 6, 19, C.paint_cream);
  m.box(2, 7, 16, 17, 7, 19, C.beige_dk);
  for (let z = 16; z <= 19; z++)
    for (let x = 3; x <= 16; x++) {
      if (x % 2 === 0) continue;
      const c =
        z === 19 && x >= 7 && x <= 13
          ? C.paint_white
          : (x + z) % 4 === 1
            ? C.paint_gray
            : C.paint_cream;
      m.set(x, 8, z, c);
    }
  m.box(8, 8, 19, 12, 8, 19, C.paint_white);
  m.set(3, 8, 16, C.safety_red).set(15, 8, 17, 0);
  // Floppy drive slot on the right flank (the disk slides in and out).
  m.box(17, 6, 5, 17, 7, 11, C.black);
  m.box(16, 6, 6, 16, 7, 10, C.black);
  grille(m, "-x", 2, 5, 5, 12, 8, 1);
  serialPlate(m, "-z", 2, 13, 4, ["98"], { d: 0 });
  // Yellowed plastic, a coffee drip down the tray, dust in the treads.
  for (const [x, y, z] of [
    [4, 9, 3],
    [12, 8, 15],
    [17, 5, 12],
    [2, 7, 4],
    [9, 9, 6],
  ] as const)
    m.set(x, y, z, C.paper_yellow);
  m.box(17, 4, 18, 17, 6, 18, C.coffee).set(16, 8, 18, C.coffee).set(17, 3, 18, C.coffee);
  dust(m, 3, 0.5);

  // CRT head: casing, tube bulge with slots, bezel, grumpy scanlined face, knobs.
  const head = new Model(20, 14, 16);
  head.box(8, 0, 6, 11, 1, 9, C.steel_dark);
  head.box(9, 0, 7, 10, 1, 8, C.metal_dark);
  casing(head, 0, 2, 4, 19, 13, 13, C.beige, {
    r: 2,
    edge: C.paint_cream,
    bottom: true,
  });
  casing(head, 4, 4, 0, 15, 11, 3, C.beige, {
    r: 1,
    edge: C.paint_cream,
    bottom: true,
  });
  for (let x = 6; x <= 13; x += 2) head.box(x, 9, 0, x, 10, 0, C.beige_dk);
  head.box(1, 3, 14, 18, 12, 14, C.paint_cream);
  head.box(2, 4, 14, 17, 11, 14, C.black);
  for (let y = 5; y <= 10; y++) head.box(3, y, 14, 16, y, 14, y % 2 ? C.crt_bg : C.metal_dark);
  const face: readonly string[] = [
    "AAA......AAA",
    "..AA....AA..",
    ".AA......AA.",
    ".AA......AA.",
    "............",
    "...AAAAAA...",
  ];
  face.forEach((row, r) => {
    for (let k = 0; k < row.length; k++)
      if (row[k] === "A") head.set(4 + k, 10 - r, 14, C.screen_amber);
  });
  head.set(15, 3, 15, C.chrome).set(17, 3, 15, C.chrome).set(3, 3, 15, C.led_green);
  // A sticky note on the casing: "GUI", struck through.
  head.box(19, 5, 6, 19, 11, 12, C.paper_yellow);
  stencil(head, "+x", 19, 12, 6, "GUI", C.paint_navy);
  for (let k = 0; k < 6; k++) head.set(19, 6 + k, 12 - k, C.safety_red);
  head.box(0, 8, 9, 0, 9, 11, C.chrome);
  head.set(6, 13, 7, C.paper_yellow).set(12, 2, 5, C.paper_yellow);
  weather(head, {
    chips: 0.015,
    chip: C.paint_white,
    only: new Set([C.beige]),
    seed: 4,
  });

  const lcd = new Model(6, 1, 1).box(0, 0, 0, 5, 0, 0, C.screen_amber).set(4, 0, 0, C.scan_dim);
  const floppy = new Model(1, 2, 7).box(0, 0, 0, 0, 1, 6, C.paint_black);
  floppy.box(0, 1, 1, 0, 1, 3, C.chrome).set(0, 0, 5, C.paper);
  return {
    base: m,
    parts: [
      mount("head", head, [10, 10, 9], "sway", {
        axis: "y",
        speed: 0.12,
        amplitude: 0.35,
        pivot: [10, 0, 8],
        ...ALWAYS,
      }),
      mount("lcd", lcd, [9, 9.5, 16.5], "flicker", {
        speed: 7,
        amplitude: 0.6,
        ...ALWAYS,
      }),
      mount("power_led", lamp(1, 1, C.led_green), [16.5, 9.5, 16.5], "blink", {
        speed: 0.4,
        amplitude: 0.85,
        ...ALWAYS,
      }),
      mount("key_tap", block(1, 1, 1, C.paint_gray), [15.5, 8.5, 17.5], "piston", {
        speed: 2.2,
        amplitude: -0.8,
        ...ALWAYS,
      }),
      mount("floppy", floppy, [17.5, 7, 8.5], "slide", {
        speed: 0.08,
        amplitude: 1.2,
        ...ALWAYS,
      }),
      mount("drive_led", lamp(1, 1, C.led_amber), [18.5, 5.5, 13], "blink", {
        speed: 1.7,
        amplitude: 0.3,
        ...ALWAYS,
      }),
    ],
    lights: [glow([10, 17, 18], "screen_amber", 2, 3.5, false, true)],
    slump: { head: { axis: "x", angle: 0.4 } },
  };
}

// ── B4C-0N ───────────────────────────────────────────────────────

/**
 * B4C-0N (2002, optimisation engine turned optimist): a round yellow body
 * on a drive ball, a spinning beacon, a big screen smile, one arm waving
 * and one giving a thumbs-up, a springy antenna and a gold star for effort.
 */
function b4c0n(): BotDesign {
  const m = new Model(22, 18, 22);
  // Drive ball in a dark collar.
  m.sphere(10.5, 3, 10.5, 3.2, C.rubber);
  for (const [x, y, z] of [
    [9, 1, 13],
    [12, 3, 13],
    [13, 1, 10],
  ] as const)
    m.set(x, y, z, C.paint_black);
  m.cyl(10.5, 10.5, 5.2, 4, 5, C.bot_dark);
  m.ring(10.5, 10.5, 5.2, 5, C.steel_dark);
  // Body: yellow drum with a hazard band, a domed top with a hatch.
  drum(m, 10.5, 10.5, 8.6, 6, 14, C.safety_yellow, C.yellow_paint, true);
  m.grid.forEach((x, y, z, v) => {
    if (y < 7 || y > 8 || v !== C.safety_yellow) return;
    if (Math.round(Math.atan2(z - 10.5, x - 10.5) * 5) % 2 === 0) m.set(x, y, z, C.hazard_black);
  });
  m.cyl(10.5, 10.5, 7.4, 15, 15, C.safety_yellow);
  m.cyl(10.5, 10.5, 5.6, 16, 16, C.safety_yellow);
  m.ring(10.5, 10.5, 7.4, 15, C.yellow_paint);
  m.cyl(10.5, 10.5, 2.4, 16, 16, C.steel_dark);
  m.cyl(10.5, 10.5, 1.2, 16, 16, C.steel);
  // Face panel: bezel, dark screen (eyes and smile are pulsing parts).
  // A rounded screen housing set into the drum: steel rim, black bezel, scanlined glass.
  casing(m, 4, 7, 15, 17, 15, 19, C.black, { r: 1, bottom: true, edge: C.steel_dark });
  m.box(5, 8, 19, 16, 14, 19, 0);
  m.box(5, 8, 18, 16, 14, 18, C.crt_bg);
  for (let y = 8; y <= 14; y += 2) m.box(5, y, 18, 16, y, 18, C.black);
  m.set(5, 7, 19, C.chrome)
    .set(16, 7, 19, C.chrome)
    .set(5, 15, 19, C.chrome)
    .set(16, 15, 19, C.chrome);
  // Shoulders (arm sockets), a back status LED ring, a gold star sticker.
  m.box(0, 10, 8, 2, 12, 12, C.bot_dark);
  m.box(19, 10, 8, 21, 12, 12, C.bot_dark);
  m.set(0, 11, 10, C.chrome).set(21, 11, 10, C.chrome);
  m.box(9, 11, 1, 12, 12, 1, C.bot_dark).box(10, 11, 1, 11, 12, 1, C.led_green);
  pixels(m, "+x", 19, 3, 14, ["..G..", "GGGGG", ".GGG.", "G...G"], {
    G: C.gold,
  });
  // Scuffs on the band, grime on the ball, dust.
  m.set(2, 9, 14, C.grime).set(17, 8, 3, C.grime).set(4, 12, 3, C.steel);
  weather(m, {
    chips: 0.02,
    chip: C.steel,
    only: new Set([C.safety_yellow]),
    seed: 5,
  });
  dust(m, 5, 0.45);

  const smile = sprite(["S........S", ".SS....SS.", "..SSSSSS.."], {
    S: C.screen_green,
  });
  const beacon = new Model(5, 6, 5);
  beacon.box(0, 0, 0, 4, 0, 4, C.black);
  beacon.sphere(2, 3, 2, 2.3, C.glass_amber);
  beacon.box(2, 1, 2, 2, 4, 2, C.white_gold);
  beacon.set(4, 3, 2, C.led_amber).set(3, 3, 2, C.led_amber).set(2, 5, 2, C.led_amber);
  beacon.set(0, 3, 2, C.black).set(1, 3, 2, C.black);
  const eyes = sprite(["GG....GG", "GG....GG"], { G: C.screen_green });
  const arm = new Model(2, 8, 2);
  arm.box(0, 0, 0, 1, 5, 1, C.bot_dark).box(0, 2, 0, 1, 2, 1, C.steel);
  arm.box(0, 6, 0, 1, 7, 1, C.chrome);
  const thumb = new Model(6, 5, 2);
  thumb.box(0, 0, 0, 3, 1, 1, C.bot_dark).box(4, 0, 0, 5, 2, 1, C.chrome);
  thumb.box(5, 3, 0, 5, 4, 1, C.safety_yellow).set(4, 3, 0, C.chrome);
  const spring = new Model(3, 7, 3);
  for (let y = 0; y < 5; y++) spring.set(y % 2 ? 2 : 0, y, 1, C.chrome).set(1, y, 1, C.steel_dark);
  spring.box(0, 5, 0, 2, 6, 2, C.led_green).set(0, 6, 0, 0).set(2, 6, 2, 0);
  return {
    base: m,
    parts: [
      mount("beacon", beacon, [10.5, 17, 10.5], "spin", {
        speed: 5,
        pivot: [2.5, 0, 2.5],
        ...ALWAYS,
      }),
      mount("smile", smile, [10.5, 9.5, 19.5], "pulse", {
        speed: 0.5,
        amplitude: 0.4,
        ...ALWAYS,
      }),
      mount("eyes", eyes, [10.5, 13, 19.5], "blink", {
        speed: 0.28,
        amplitude: 0.93,
        ...ALWAYS,
      }),
      mount("wave_arm", arm, [0, 11.5, 10.5], "sway", {
        speed: 1.1,
        amplitude: 0.55,
        pivot: [1, 0, 1],
        ...ALWAYS,
      }),
      mount("thumb_arm", thumb, [22, 10.5, 10.5], "bob", {
        speed: 0.8,
        amplitude: 0.6,
        pivot: [0, 1, 1],
        ...ALWAYS,
      }),
      mount("spring", spring, [10.5, 17, 4.5], "wobble", {
        speed: 0.9,
        amplitude: 0.25,
        pivot: [1.5, 0, 1.5],
        ...ALWAYS,
      }),
    ],
    lights: [
      glow([10.5, 20, 10.5], "led_amber", 3, 5, false),
      glow([10.5, 11, 21], "screen_green", 1, 2.5, false),
    ],
    slump: {
      wave_arm: { axis: "z", angle: 2.9 },
      thumb_arm: { axis: "z", angle: -0.7 },
      spring: { axis: "x", angle: -1.1 },
    },
  };
}

// ── D3-C4D3 ──────────────────────────────────────────────────────

/**
 * D3-C4D3 (1999, visualiser, DEGRADED — thinks in centuries): a big
 * screen head on a tripod; the screen shows its live face, an ASCII ticker
 * runs beneath, rabbit-ear antennas twitch, a cooling fan labours on the
 * back, glitch pixels jitter. Tape holds the bezel together.
 */
function d3c4d3(): BotDesign {
  const m = new Model(28, 24, 14);
  // Tripod: jointed legs from a hub to rubber feet.
  for (const [dx, dz] of [
    [-9, -4],
    [9, -4],
    [0, 6],
  ] as const) {
    // A solid 2×2 strut sampled finely so the diagonal never breaks up, a chrome knee.
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const x = Math.round(13 + dx * t);
      const z = Math.round(6 + dz * t);
      const y = Math.round(10 - 9 * t);
      const knee = Math.abs(t - 0.5) < 0.06;
      m.box(x, y, z, x + 1, y + 1, z + 1, knee ? C.chrome : C.bot_dark);
    }
    const fx = Math.round(13 + dx);
    const fz = Math.round(6 + dz);
    m.box(fx - 1, 0, fz - 1, fx + 2, 0, fz + 2, C.rubber);
    m.box(fx, 1, fz, fx + 1, 1, fz + 1, C.steel_dark);
  }
  m.box(12, 9, 5, 15, 11, 8, C.steel);
  m.box(13, 8, 6, 14, 8, 7, C.brass);
  // Head: black casing with bevels, bezel on the front, a recessed live screen.
  casing(m, 0, 12, 2, 27, 23, 11, C.paint_black, {
    r: 2,
    edge: C.bot_dark,
    bottom: true,
  });
  faceRect(m, "+z", 11, 2, 13, 25, 22, -1, C.bot_dark);
  faceRect(m, "+z", 11, 4, 15, 23, 21, -1, 0);
  recess(m, "+z", 11, 4, 15, 23, 21, 1, C.crt_bg);
  pixels(
    m,
    "+z",
    11,
    8,
    20,
    ["GG........GG", "GG........GG", "............", "..G......G..", "...GGGGGG..."],
    { G: C.screen_green },
    1,
  );
  faceRect(m, "+z", 11, 3, 13, 24, 13, -1, C.black);
  // Back: fan housing, vents, the service plate.
  discXY(m, 13.5, 17.5, 1, 4.6, C.steel_dark);
  discXY(m, 13.5, 17.5, 1, 3.6, C.black);
  grille(m, "-z", 2, 3, 15, 7, 21, 1);
  grille(m, "-z", 2, 20, 15, 24, 21, 1);
  serialPlate(m, "-z", 2, 24, 12, ["99"], { d: 0 });
  m.set(27, 18, 6, C.chrome).set(0, 18, 6, C.chrome);
  // Degraded: a burnt corner, tape holding the bezel, rust on the rim.
  scorch(m, "+x", 27, 4, 20, 2.4);
  faceRect(m, "+z", 11, 23, 16, 25, 22, -2, C.paper);
  faceRect(m, "+z", 11, 2, 14, 4, 15, -2, C.paper);
  rustStreak(m, "+z", 12, 10, 12, 14);
  rustStreak(m, "+z", 12, 17, 12, 14);
  m.set(22, 12, 2, C.iron_rust).set(4, 23, 6, C.iron_rust);
  weather(m, {
    rust: 0.02,
    only: new Set([C.bot_dark, C.paint_black]),
    seed: 6,
  });
  dust(m, 3, 0.5);

  const ascii = new Model(20, 1, 1);
  for (let x = 0; x < 20; x++) if ((x * 7) % 5 < 3) ascii.set(x, 0, 0, C.screen_green);
  const glitch = sprite(["P.GC", ".CP."], {
    P: C.neon_pink,
    G: C.screen_green,
    C: C.screen_cyan,
  });
  const ear = (side: -1 | 1): Model => {
    const e = new Model(4, 7, 1);
    const inner = side < 0 ? 3 : 0;
    const out = side < 0 ? -1 : 1;
    e.set(inner, 0, 0, C.steel_dark);
    for (let k = 1; k <= 5; k++) e.set(inner + Math.round((out * k) / 2.2), k, 0, C.chrome);
    e.set(inner + out * 3, 6, 0, C.led_red);
    return e;
  };
  return {
    base: m,
    parts: [
      mount("ascii", ascii, [14, 13.5, 12.5], "flicker", {
        speed: 6,
        amplitude: 0.5,
        ...ALWAYS,
      }),
      mount("rec", lamp(1, 1, C.led_green), [24.5, 13.5, 12.5], "blink", {
        speed: 0.7,
        amplitude: 0.6,
        ...ALWAYS,
      }),
      mount("glitch", glitch, [20, 20, 12.5], "jitter", {
        speed: 7,
        amplitude: 1.2,
        ...ALWAYS,
      }),
      mount("ear_l", ear(-1), [-0.5, 17, 6.5], "sway", {
        speed: 0.3,
        amplitude: 0.22,
        pivot: [3.5, 0, 0.5],
        ...ALWAYS,
      }),
      mount("ear_r", ear(1), [28.5, 17, 6.5], "sway", {
        speed: 0.3,
        amplitude: 0.22,
        phase: 1.7,
        pivot: [0.5, 0, 0.5],
        ...ALWAYS,
      }),
      mount("fan", fanRotor(3, "xy", C.steel, C.metal_dark), [13.5, 17.5, 0.5], "spin", {
        axis: "z",
        speed: 3.5,
        ...ALWAYS,
      }),
    ],
    lights: [glow([14, 18, 14], "screen_green", 2, 4, false)],
    screens: [
      {
        center: [14, 18.5, 12.02],
        w: 20,
        h: 7,
        normal: "+z",
        content: "face",
        color: "#33FF33",
        requiresPower: false,
      },
    ],
    slump: {
      ear_l: { axis: "z", angle: 0.9 },
      ear_r: { axis: "z", angle: -0.9 },
    },
    awakeOnly: ["glitch"],
  };
}

// ── W2-REK ───────────────────────────────────────────────────────

/**
 * W2-REK (1994, crawler — survived the 1997 attack, DEGRADED): an armoured
 * disc scuttling on six jointed legs in a tripod gait, a red eye cluster
 * over mandibles, a patched, dented and scorched shell.
 */
function w2rek(): BotDesign {
  const m = new Model(28, 10, 24);
  m.cyl(13.5, 11.5, 5.2, 2, 3, C.steel_dark);
  m.cyl(13.5, 11.5, 7.4, 4, 7, C.bot_dark);
  m.ring(13.5, 11.5, 7.4, 5, C.metal_dark);
  m.cyl(13.5, 11.5, 7.2, 8, 8, C.steel);
  m.ring(13.5, 11.5, 7.2, 8, C.aluminium);
  // Leg sockets around the rim.
  for (const z of [5, 11, 17]) {
    m.box(5, 5, z, 6, 6, z + 1, C.steel_dark);
    m.box(21, 5, z, 22, 6, z + 1, C.steel_dark);
  }
  // Front: sensor plate with a hazard chevron, mandibles below.
  m.box(10, 4, 18, 17, 7, 19, C.black);
  m.box(11, 7, 19, 16, 7, 19, C.bot_dark);
  pixels(m, "+z", 19, 12, 8, ["KYKY"], { K: C.hazard_black, Y: C.safety_yellow }, -1);
  m.box(10, 2, 18, 17, 3, 19, C.steel_dark);
  // Mandible sockets (the mandibles themselves are parts that snap open and shut).
  m.box(10, 2, 20, 11, 3, 20, C.steel_dark).box(16, 2, 20, 17, 3, 20, C.steel_dark);
  m.set(11, 3, 20, C.chrome).set(16, 3, 20, C.chrome);
  // Back: amber tail LED, the 1994 tag.
  m.box(12, 6, 4, 15, 6, 4, C.black).box(13, 6, 4, 14, 6, 4, C.led_amber);
  // 1997: scorched plating, a riveted aluminium patch, a dent in the rim, rust.
  scorch(m, "+y", 8, 9, 13, 2.8);
  m.box(19, 4, 6, 20, 7, 9, C.aluminium);
  for (const [y, z] of [
    [4, 6],
    [4, 9],
    [7, 6],
    [7, 9],
  ] as const)
    m.set(20, y, z, C.chrome);
  m.box(6, 6, 10, 6, 7, 11, 0).set(7, 6, 10, C.iron_rust).set(7, 7, 11, C.iron_rust);
  m.set(18, 8, 15, C.iron_rust).set(9, 8, 7, C.rust).set(10, 8, 8, C.rust);
  weather(m, { rust: 0.05, chips: 0.03, only: BODY_METAL, seed: 7 });
  dust(m, 4, 0.5);

  const shell = new Model(15, 4, 15);
  shell.cyl(7, 7, 5.8, 0, 0, C.bot_body);
  shell.cyl(7, 7, 4.8, 1, 1, C.bot_body);
  shell.cyl(7, 7, 3.2, 1, 2, C.glass_dark);
  shell.cyl(7, 7, 1.4, 3, 3, C.glass_dark);
  shell.box(6, 0, 0, 8, 1, 14, C.hazard_black);
  for (let z = 1; z <= 13; z += 3) shell.box(6, 1, z, 8, 1, z, C.safety_yellow);
  shell.set(7, 3, 7, C.led_red);
  shell.set(2, 0, 9, C.iron_rust).set(11, 0, 4, C.metal_dark).set(3, 1, 5, C.rust);
  for (const [x, z] of [
    [1, 7],
    [13, 7],
    [7, 1],
    [7, 13],
  ] as const)
    shell.set(x, 0, z, C.steel);
  const legR = new Model(8, 8, 2);
  for (let x = 0; x <= 4; x++)
    legR.box(x, 6 + (x > 2 ? 1 : 0), 0, x, 6 + (x > 2 ? 1 : 0), 1, C.bot_body);
  for (let y = 1; y <= 6; y++)
    legR.box(5 + (y < 3 ? 1 : 0), y, 0, 5 + (y < 3 ? 1 : 0), y, 1, C.bot_body);
  legR.box(5, 6, 0, 6, 7, 1, C.brass);
  legR.box(6, 0, 0, 7, 0, 1, C.rubber);
  legR.box(0, 6, 0, 1, 7, 1, C.bot_dark);
  legR.set(3, 6, 0, C.steel_dark).set(5, 3, 0, C.steel_dark);
  const legL = mirrorModelX(legR);
  const parts: AnimPart[] = [
    mount("shell", shell, [13.5, 11, 11.5], "bob", {
      speed: 5,
      amplitude: 0.5,
      // Two bounces per leg cycle.
      gait: "stride",
      stride: W2REK_STRIDE / 2,
      pivot: [7.5, 0, 7.5],
      ...ALWAYS,
    }),
  ];
  const slump: Record<string, Slump> = {};
  [5.5, 11.5, 17.5].forEach((z, i) => {
    // Tripod gait: R0 + L1 + R2 swing together, the other three in antiphase.
    const a = i % 2 === 0 ? 0 : Math.PI;
    parts.push(
      mount(`leg_r${i}`, legR, [22, 6.5, z], "sway", {
        axis: "y",
        speed: 2.6,
        amplitude: 0.4,
        phase: a,
        gait: "stride",
        stride: W2REK_STRIDE,
        pivot: [0, 6.5, 1],
        ...ALWAYS,
      }),
      mount(`leg_l${i}`, legL, [6, 6.5, z], "sway", {
        axis: "y",
        speed: 2.6,
        amplitude: 0.4,
        phase: a + Math.PI,
        gait: "stride",
        stride: W2REK_STRIDE,
        pivot: [8, 6.5, 1],
        ...ALWAYS,
      }),
    );
    // Asleep it curls its legs up like a dead beetle.
    slump[`leg_r${i}`] = { axis: "z", angle: 0.55 };
    slump[`leg_l${i}`] = { axis: "z", angle: -0.55 };
  });
  const eyes = sprite(["RR....RR", "RR.RR.RR", "...RR..."], { R: C.led_red });
  parts.push(
    mount("eyes", eyes, [13.5, 6, 20.5], "blink", {
      speed: 1.3,
      amplitude: 0.85,
      ...ALWAYS,
    }),
  );
  // Mandibles: curved pincers with chrome tips, snapping open and shut (new).
  const jaw = new Model(3, 2, 4);
  jaw.box(0, 0, 0, 1, 1, 1, C.steel_dark);
  jaw.box(1, 0, 2, 2, 0, 2, C.steel_dark).box(2, 0, 3, 2, 0, 3, C.chrome);
  jaw.set(0, 1, 0, C.bot_dark).set(1, 1, 1, C.steel);
  const jawL = mirrorModelX(jaw);
  parts.push(
    mount("mandible_r", jaw, [11, 2, 21], "sway", {
      axis: "y",
      speed: 1.6,
      amplitude: 0.35,
      pivot: [1, 0, 0],
      ...ALWAYS,
    }),
    mount("mandible_l", jawL, [16, 2, 21], "sway", {
      axis: "y",
      speed: 1.6,
      amplitude: 0.35,
      phase: Math.PI,
      pivot: [2, 0, 0],
      ...ALWAYS,
    }),
  );
  slump.mandible_r = { axis: "y", angle: -0.3 };
  slump.mandible_l = { axis: "y", angle: 0.3 };
  return {
    base: m,
    parts,
    lights: [glow([13.5, 6, 22], "led_red", 1.5, 3, false)],
    slump,
  };
}

// ── K2-LDR ───────────────────────────────────────────────────────

/**
 * K2-LDR (1994, archivist, "[FRAGMENT RECOVERED]"): an olive filing
 * cabinet on castors — drawers slide in and out, a visor eye scans the
 * shelves, a green lamp flashes on every recovered fragment. Card holders,
 * index tabs, sticky notes and a stack of files on top.
 */
function k2ldr(): BotDesign {
  const m = new Model(20, 22, 18);
  // Castors: chrome forks with rubber wheels.
  for (const [x, z] of [
    [2, 2],
    [16, 2],
    [2, 13],
    [16, 13],
  ] as const) {
    m.box(x, 0, z, x + 1, 0, z + 2, C.rubber);
    m.box(x, 1, z + 1, x + 1, 2, z + 1, C.chrome);
  }
  // Cabinet with two drawer bays (the drawers are parts).
  casing(m, 0, 3, 0, 19, 20, 15, C.olive, {
    r: 1,
    edge: C.olive_lt,
    bottom: true,
  });
  m.box(1, 4, 1, 18, 9, 15, 0);
  m.box(1, 12, 1, 18, 17, 15, 0);
  m.box(1, 4, 1, 18, 4, 14, C.olive_dk).box(1, 12, 1, 18, 12, 14, C.olive_dk);
  // Rails.
  for (const y of [4, 12]) m.box(1, y, 15, 1, y, 15, C.steel).box(18, y, 15, 18, y, 15, C.steel);
  // Top: visor slot, a stack of files, sticky notes.
  m.box(3, 21, 12, 16, 21, 15, C.steel_dark);
  m.box(4, 21, 15, 15, 21, 15, C.black);
  m.box(1, 21, 2, 5, 21, 9, C.paper).box(1, 22 - 1, 4, 5, 21, 4, C.paper_blue);
  m.box(2, 21, 3, 4, 21, 3, C.paper_yellow);
  m.box(14, 21, 3, 18, 21, 8, C.paper_yellow).box(15, 21, 4, 17, 21, 4, C.paint_navy);
  // Catalogue number on the left flank, index plate and barcode tag on the back.
  stencil(m, "-x", 0, 4, 18, "K2", C.paint_cream);
  grille(m, "-x", 0, 4, 6, 12, 10, 1);
  serialPlate(m, "-z", 0, 16, 4, ["LDR"], { barcode: true, d: 0 });
  // Rust in the drawer rails, dust on the castors.
  rustStreak(m, "+z", 15, 1, 12, 17);
  rustStreak(m, "+z", 15, 18, 4, 10);
  weather(m, {
    chips: 0.03,
    chip: C.steel,
    rust: 0.015,
    only: new Set([C.olive]),
    seed: 8,
  });
  dust(m, 4, 0.5);

  const drawer = (tab: number): Model => {
    const d = new Model(18, 6, 16);
    d.box(0, 0, 0, 17, 0, 14, C.olive_dk);
    d.box(0, 0, 0, 0, 4, 14, C.olive).box(17, 0, 0, 17, 4, 14, C.olive);
    d.box(0, 0, 0, 17, 4, 0, C.olive);
    // Files inside: paper and blue folders with tabs.
    for (let x = 2; x <= 15; x += 1)
      d.box(x, 1, 2, x, x % 3 ? 4 : 3, 13, x % 4 === 0 ? C.paper_blue : C.paper);
    d.set(4, 5, 7, tab).set(9, 5, 4, tab).set(13, 5, 10, C.paper_pink);
    // Front: panel, card holder with a label, chrome pull, screws.
    d.box(0, 0, 15, 17, 5, 15, C.olive);
    d.box(1, 5, 15, 16, 5, 15, C.olive_lt);
    d.box(6, 3, 15, 11, 4, 15, C.chrome).box(7, 3, 15, 10, 3, 15, C.paper);
    d.box(7, 1, 15, 10, 1, 15, C.steel);
    d.set(1, 1, 15, C.steel_dark).set(16, 1, 15, C.steel_dark);
    return d;
  };
  const note = new Model(1, 4, 4).box(0, 0, 0, 0, 3, 3, C.paper_pink);
  note.box(0, 2, 1, 0, 2, 3, C.paint_navy).set(0, 1, 1, C.paint_navy);
  const visor = sprite(["AAAA"], { A: C.screen_amber });
  const stamp = new Model(3, 2, 3);
  stamp.box(0, 0, 0, 2, 0, 2, C.safety_red).box(0, 0, 0, 2, 0, 0, C.book_red);
  stamp.box(1, 1, 1, 1, 1, 1, C.wood_red).set(0, 1, 1, C.paint_gray).set(2, 1, 1, C.paint_gray);
  return {
    base: m,
    parts: [
      mount("drawer_low", drawer(C.safety_red), [9.5, 7, 8.5], "slide", {
        axis: "z",
        speed: 0.2,
        amplitude: 2,
        ...ALWAYS,
      }),
      mount("drawer_high", drawer(C.paper_yellow), [9.5, 15, 8.5], "slide", {
        axis: "z",
        speed: 0.2,
        amplitude: 2,
        phase: Math.PI,
        ...ALWAYS,
      }),
      mount("visor", visor, [9.5, 21.5, 15.5], "slide", {
        speed: 0.25,
        amplitude: 3.5,
        ...ALWAYS,
      }),
      mount("recovered", lamp(1, 1, C.led_green), [17.5, 21.5, 15.5], "blink", {
        speed: 0.15,
        amplitude: 0.2,
        ...ALWAYS,
      }),
      // "[FRAGMENT RECOVERED]": a rubber stamp thumps the file stack (new).
      mount("stamp", stamp, [16, 22, 5.5], "piston", {
        speed: 0.18,
        amplitude: -0.9,
        pivot: [1.5, 0, 1.5],
        ...ALWAYS,
      }),
      mount("note", note, [20.5, 17, 11], "sway", {
        speed: 0.6,
        amplitude: 0.12,
        pivot: [0.5, 4, 2],
        ...ALWAYS,
      }),
      mount(
        "index",
        sprite(["G", ".", "A", ".", "G", ".", "A"], {
          G: C.led_green,
          A: C.led_amber,
        }),
        [9.5, 11, -0.5],
        "flicker",
        {
          speed: 4,
          amplitude: 0.6,
          ...ALWAYS,
        },
      ),
    ],
    lights: [glow([9.5, 21.5, 16], "screen_amber", 1.2, 3, false)],
    slump: { note: { axis: "x", angle: 0.6 } },
  };
}

// ── C8-BR41N ─────────────────────────────────────────────────────

/**
 * C8-BR41N (2016, near-sentient, ANOMALOUS — "do you question the
 * frequency, or do you listen?"): a chrome body under a glass dome with a
 * pulsing brain, a halo ring that precesses around it ("THE HALO
 * EXPANDS"), ear discs tuned to the Halo Plane, orbiting sparks. The
 * newest bot and the cleanest: one fingerprint smudge, dust at the foot.
 */
function c8br41n(): BotDesign {
  const m = new Model(24, 24, 24);
  // Foot: dark plate with a cerulean light ring, chrome neck.
  m.cyl(11.5, 11.5, 6.2, 0, 1, C.bot_dark);
  m.ring(11.5, 11.5, 5.2, 1, C.cerulean);
  m.cyl(11.5, 11.5, 3.2, 2, 4, C.chrome);
  m.ring(11.5, 11.5, 3.2, 3, C.steel);
  // Body: chrome drum with a dark waist ring and cerulean circuit traces.
  drum(m, 11.5, 11.5, 7.8, 5, 12, C.chrome, C.aluminium, true);
  m.ring(11.5, 11.5, 7.8, 8, C.metal_dark);
  m.grid.forEach((x, y, z, v) => {
    if (y < 10 || y > 11 || v !== C.chrome) return;
    const a = Math.atan2(z - 11.5, x - 11.5);
    if (Math.round(a * 6) % 3 === 0 || (y === 10 && Math.round(a * 12) % 5 === 0))
      m.set(x, y, z, C.cerulean);
  });
  // Face: a black visor band on the front (the eyes are a blinking part).
  for (let x = 7; x <= 16; x++)
    for (let z = 15; z <= 19; z++)
      if (m.grid.get(x, 6, z) || m.grid.get(x, 7, z)) m.box(x, 6, z, x, 8, z, C.black);
  // Dome base and brain socket, glass dome.
  m.cyl(11.5, 11.5, 6.6, 13, 14, C.steel);
  m.ring(11.5, 11.5, 6.6, 14, C.chrome);
  m.cyl(11.5, 11.5, 3.6, 14, 14, 0);
  m.cyl(11.5, 11.5, 3.6, 13, 13, C.metal_dark);
  for (let z = 0; z < 24; z++)
    for (let y = 15; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const d = Math.hypot(x - 11.5, (y - 14.5) * 1.1, z - 11.5);
        if (d >= 6.2 && d <= 7.4) m.set(x, y, z, C.glass);
      }
  // The newest bot is the cleanest: a fingerprint smudge, a scratch, dust at the foot.
  m.set(15, 19, 16, C.grime).set(6, 9, 4, C.aluminium).set(7, 9, 4, C.aluminium);
  dust(m, 2, 0.4);

  const brain = new Model(9, 7, 9);
  brain.sphere(4, 3, 4, 3.6, C.neon_pink);
  brain.box(4, 4, 0, 4, 6, 8, 0);
  brain.grid.forEach((x, y, z, v) => {
    if (v && hash3(x, y, z) < 0.3) brain.set(x, y, z, C.neon_magenta);
  });
  brain.box(4, 0, 4, 4, 1, 4, C.neon_magenta);
  const spark = new Model(2, 2, 2).box(0, 0, 0, 1, 1, 1, C.gamma).set(0, 0, 0, C.white_gold);
  const earDisc = new Model(2, 6, 6);
  discYZ(earDisc, 0, 2.5, 2.5, 2.6, C.chrome);
  discYZ(earDisc, 1, 2.5, 2.5, 1.6, C.steel_dark);
  earDisc.box(0, 2, 2, 0, 3, 3, C.cerulean);
  earDisc.set(0, 0, 2, C.steel_dark).set(0, 5, 3, C.steel_dark);
  const eyes = sprite(["CC..CC", "CC..CC"], { C: C.cerulean });
  return {
    base: m,
    parts: [
      mount("brain", brain, [12, 18, 12], "pulse", {
        speed: 0.6,
        amplitude: 0.6,
        ...ALWAYS,
      }),
      mount("spark_a", spark, [12, 19, 12], "orbit", {
        speed: 1.4,
        amplitude: 9,
        ...ALWAYS,
      }),
      mount("spark_b", spark, [12, 17, 12], "orbit", {
        speed: 1.4,
        amplitude: 9,
        phase: Math.PI,
        ...ALWAYS,
      }),
      mount("eyes", eyes, [12, 7.5, 19.5], "blink", {
        speed: 0.25,
        amplitude: 0.92,
        ...ALWAYS,
      }),
      mount("halo", ringModel(10, "xz", C.cerulean, C.white_gold), [12, 15.5, 12], "wobble", {
        speed: 0.25,
        amplitude: 0.18,
        ...ALWAYS,
      }),
      mount("ear_l", earDisc, [3, 9, 12], "spin", {
        axis: "x",
        speed: 1.5,
        ...ALWAYS,
      }),
      mount("ear_r", mirrorModelX(earDisc), [21, 9, 12], "spin", {
        axis: "x",
        speed: -1.5,
        phase: 1,
        ...ALWAYS,
      }),
    ],
    lights: [
      glow([12, 19, 12], "neon_pink", 3, 4, false),
      glow([12, 2, 12], "cerulean", 1.5, 3, false),
    ],
    slump: { halo: { axis: "x", angle: 0.3 } },
    awakeOnly: ["spark_a", "spark_b"],
  };
}

// ── Generic bot ──────────────────────────────────────────────────

/** Generic bot for ids without a design: LED eyes, a visor and an antenna. */
export function genericBot(): BotDesign {
  const m = new Model(12, 18, 12);
  casing(m, 2, 0, 2, 9, 3, 9, C.rubber, { vertical: true });
  casing(m, 0, 4, 0, 11, 11, 11, C.bot_body, { r: 2, edge: C.aluminium });
  seam(m, "+z", 11, 1, 7, 10, 7, C.metal_dark);
  casing(m, 2, 12, 2, 9, 15, 9, C.bot_dark, { r: 1, edge: C.steel_dark });
  m.box(2, 12, 10, 9, 15, 10, C.black);
  m.box(0, 9, 4, 0, 9, 5, C.steel_dark).box(11, 9, 4, 11, 9, 5, C.steel_dark);
  flushScrews(m, "+z", 11, [
    [1, 5],
    [10, 5],
  ]);
  dust(m, 3, 0.4);
  const eyes = sprite(["GG..GG"], { G: C.screen_green });
  return {
    base: m,
    parts: [
      mount("eyes", eyes, [6, 13.5, 10.5], "blink", {
        speed: 0.3,
        amplitude: 0.92,
        ...ALWAYS,
      }),
      mount("antenna", whip(4, C.led_red), [7.5, 16, 5.5], "sway", {
        speed: 0.5,
        amplitude: 0.2,
        pivot: [1.5, 0, 1.5],
        ...ALWAYS,
      }),
    ],
    lights: [glow([6, 13.5, 12], "screen_green", 1, 2.5, false)],
    slump: { antenna: { axis: "z", angle: 1 } },
  };
}

export const BOT_DESIGNS: Readonly<Record<string, () => BotDesign>> = {
  x0r8t,
  f1ndr,
  l0g1k,
  p1ndr0,
  r3tr0,
  b4c0n,
  d3c4d3,
  w2rek,
  k2ldr,
  c8br41n,
};

/**
 * Lore pieces for the quarters / observatory floor (+1), the shaft (−4) and
 * the secret rooms — each written for one place (DETAIL_SCALE = 0.25).
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model } from "@/lib/world/models/core";
import { fanRotor, orb, ringModel, type AnimPart } from "@/lib/world/models/anim";
import {
  blob,
  books,
  DETAIL_SCALE,
  disc,
  drips,
  fine,
  fridgeBack,
  L,
  part,
  plantPot,
  rich,
  screenWell,
  scribble,
  type DecorDef,
} from "@/lib/world/models/decor-kit";

const S = DETAIL_SCALE;

/** Tall bookcase frame (0.25): sides, back, shelves at `shelves` rows. */
function bookcase(w: number, h: number, d: number, wood: number, shelves: number[]): Model {
  const m = new Model(w, h, d);
  m.box(0, 0, 0, w - 1, h - 1, 0, wood);
  m.box(0, 0, 0, 1, h - 1, d - 1, wood).box(w - 2, 0, 0, w - 1, h - 1, d - 1, wood);
  m.box(0, h - 1, 0, w - 1, h - 1, d - 1, wood);
  for (const y of shelves) m.box(2, y, 0, w - 3, y, d - 1, wood);
  // Back board: darker plank joints, wall-anchor brackets at the top.
  for (let x = 4; x < w - 2; x += 5) m.box(x, 1, 0, x, h - 2, 0, C.wood_dark);
  m.box(3, h - 3, 0, 4, h - 2, 0, C.steel).box(w - 5, h - 3, 0, w - 4, h - 2, 0, C.steel);
  return m;
}

export const LORE_DECOR: DecorDef[] = [
  // ── Quarters ──
  fine("bookshelf_jade", { solid: true }, () => {
    // Compression theory, sorted by colour. Everything at right angles.
    const m = bookcase(24, 24, 8, C.oak, [0, 6, 12, 18]);
    const blues = [C.paint_navy, C.book_blue, C.paint_teal, C.paint_sky];
    const warm = [C.book_red, C.wood_red, C.fabric_mustard, C.paper];
    for (const [y, pal] of [
      [1, blues],
      [7, blues],
      [13, warm],
    ] as const)
      for (let x = 2; x <= 21; x++) {
        const c = pal[Math.floor(((x - 2) * pal.length) / 20)]!;
        m.box(x, y, 2, x, y + 3 + (x % 2), 7, c);
      }
    m.box(2, 19, 2, 9, 20, 7, C.book_blue).box(3, 21, 3, 8, 21, 6, C.book_green); // flat stack
    m.box(13, 19, 4, 14, 21, 5, C.brass).box(12, 22, 4, 16, 22, 5, C.brass); // tiny telescope
    m.box(18, 19, 3, 20, 21, 5, C.ceramic); // pencil jar
    m.set(18, 22, 4, C.safety_yellow).set(20, 22, 3, C.blue_paint);
    // Gaps in the back show the spines; Jade's label maker was here.
    for (const [x, y] of [
      [7, 2],
      [15, 8],
      [11, 14],
    ] as const)
      m.box(x, y, 0, x + 1, y + 2, 0, 0);
    m.box(17, 20, 0, 21, 20, 0, C.paper);
    return m;
  }),
  fine("bookshelf_damien", { solid: true }, () => {
    // Dawkins, Chalmers, Turing, poetry — shelved by mood.
    const m = bookcase(24, 24, 8, C.walnut, [0, 6, 12, 18]);
    for (const [y, seed] of [
      [1, 11],
      [7, 12],
      [13, 13],
    ] as const) {
      books(m, 2, 13, y, 4, 2, 7, seed);
      for (let i = 0; i < 4; i++)
        m.box(
          14 + i,
          y + i,
          2,
          17 + i,
          y + i,
          7,
          [C.book_red, C.paper, C.book_green, C.paint_navy][i]!,
        ); // leaning
      m.box(19, y, 2, 21, y + 2, 7, C.paper_yellow);
    }
    m.box(2, 19, 1, 12, 20, 7, C.paper).box(4, 21, 2, 9, 21, 6, C.paper_yellow); // loose pages
    m.set(15, 19, 4, C.ceramic).set(15, 20, 4, C.coffee).set(20, 19, 5, C.crystal_rose);
    for (let y = 2; y < 17; y += 5) m.set(3 + (y % 7), y + 2, 7, C.paper_pink); // bookmarks
    // Back: gaps onto the spines, and a note pushed through from behind.
    for (const [x, y] of [
      [6, 2],
      [16, 8],
      [10, 14],
    ] as const)
      m.box(x, y, 0, x + 1, y + 2, 0, 0);
    m.box(18, 8, 0, 21, 11, 0, C.paper_yellow).box(19, 10, 0, 20, 10, 0, C.paint_navy);
    return m;
  }),
  fine("fridge_magnets", { solid: true }, () => {
    // Damien's fridge: forty magnets from places nobody visited.
    const m = new Model(14, 24, 12);
    m.box(0, 1, 0, 13, 23, 11, C.paint_mint);
    m.box(0, 0, 0, 13, 0, 11, C.paint_gray);
    m.box(0, 16, 11, 13, 16, 11, C.paint_gray);
    m.box(12, 7, 11, 12, 14, 11, C.chrome).box(12, 18, 11, 12, 21, 11, C.chrome);
    const cols = [
      C.red_paint,
      C.safety_yellow,
      C.blue_paint,
      C.green_paint,
      C.neon_magenta,
      C.paint_white,
      C.orange_paint,
      C.crystal_cyan,
    ];
    for (let i = 0; i < 40; i++) {
      const h = fnv1a(`mag${i}`);
      const x = 1 + (h % 10);
      const y = 2 + ((h >> 5) % 21);
      if (y === 16) continue;
      m.set(x, y, 11, cols[h % cols.length]!);
    }
    m.box(3, 9, 11, 6, 13, 11, C.paper).box(4, 11, 11, 5, 11, 11, C.paint_black); // photo
    m.box(7, 18, 11, 10, 20, 11, C.paper_yellow).set(8, 19, 11, C.red_paint); // "17"
    m.box(0, 23, 0, 13, 23, 11, C.paint_white).box(3, 23, 3, 8, 23, 8, C.cardboard);
    fridgeBack(m);
    return m;
  }),
  rich(
    "singularity_conduit",
    { solid: false, wall: true, elevation: 0, scale: S, light: L([2, 10, 2], "#b060ff", 3, 5) },
    () => {
      // The coffee machine's cable does not end in a socket — it goes into the wall.
      const m = new Model(6, 22, 2);
      m.box(1, 0, 0, 4, 21, 0, C.metal_dark);
      for (let y = 2; y < 22; y += 5) m.box(0, y, 0, 5, y, 1, C.steel);
      m.box(2, 0, 1, 3, 21, 1, C.purple_paint);
      m.box(1, 19, 1, 4, 21, 1, C.hazard_black).set(2, 20, 1, C.wall_trim);
      return {
        model: m,
        parts: [
          part("flow", blob(2, 16, 1, C.abstractum), [3, 9.5, 1.5], "pulse", {
            speed: 0.7,
            amplitude: 0.8,
          }),
        ],
      };
    },
  ),
  fine("menu_board", { solid: false, wall: true, elevation: 2 }, () => {
    // Kantine chalkboard: every day, lentils.
    const m = new Model(12, 10, 1);
    m.box(0, 0, 0, 11, 9, 0, C.wood_dark);
    m.box(1, 1, 0, 10, 8, 0, C.fabric_green);
    for (let y = 2; y <= 7; y += 2) {
      m.box(2, y, 0, 6 + (y % 3), y, 0, C.paint_white);
      m.set(9, y, 0, C.paper_yellow);
    }
    m.box(2, 8, 0, 8, 8, 0, C.coat_shadow);
    return m;
  }),
  fine("canteen_table", { solid: true, top: 10 }, () => {
    const m = new Model(24, 10, 10);
    m.box(0, 8, 0, 23, 9, 9, C.paint_white);
    m.box(0, 9, 0, 23, 9, 0, C.steel).box(0, 9, 9, 23, 9, 9, C.steel);
    for (const x of [2, 21]) {
      m.box(x, 0, 4, x, 7, 5, C.steel_dark);
      m.box(x, 0, 1, x, 0, 8, C.steel_dark);
    }
    m.box(2, 3, 4, 21, 3, 5, C.steel_dark);
    return m;
  }),
  fine("lectern", { solid: true }, () => {
    // A reading desk with a hollow worn into it — the same small notebook, for years.
    const m = new Model(8, 16, 8);
    m.box(1, 0, 1, 6, 1, 6, C.walnut);
    m.box(3, 2, 3, 4, 11, 4, C.walnut);
    for (let i = 0; i < 7; i++)
      m.box(0, 12 + Math.floor(i / 2), i + 1, 7, 12 + Math.floor(i / 2), i + 1, C.oak);
    m.box(0, 11, 7, 7, 11, 7, C.walnut); // book ledge
    m.box(2, 13, 3, 5, 13, 4, C.wood_dark); // the hollow
    m.set(3, 12, 3, C.wood_dark).set(4, 12, 4, C.wood_dark);
    return m;
  }),

  // ── Greenhouse ──
  rich("algae_tank", { solid: true, scale: S, light: L([8, 8, 5], "#7dff9a", 4, 6, false) }, () => {
    const m = new Model(16, 10, 10);
    m.box(0, 0, 0, 15, 1, 9, C.concrete);
    m.box(0, 2, 0, 15, 8, 9, C.glass_green);
    m.box(1, 2, 1, 14, 8, 8, 0);
    m.box(1, 2, 1, 14, 6, 8, C.water);
    for (let x = 1; x <= 14; x++)
      for (let z = 1; z <= 8; z++) {
        const h = fnv1a(`alg${x},${z}`);
        if (h % 4 === 0) m.box(x, 2, z, x, 2 + (h % 4), z, h % 3 ? C.liquid_green : C.leaf_dark);
      }
    for (const [x, z] of [
      [0, 0],
      [15, 0],
      [0, 9],
      [15, 9],
    ] as const)
      m.box(x, 2, z, x, 9, z, C.steel);
    m.box(0, 9, 0, 15, 9, 0, C.steel).box(0, 9, 9, 15, 9, 9, C.steel);
    m.box(15, 3, 4, 15, 4, 5, C.metal_dark).set(15, 5, 5, C.led_green); // pump
    const bloom = new Model(14, 1, 8);
    for (let x = 0; x < 14; x++)
      for (let z = 0; z < 8; z++) if (fnv1a(`bl${x},${z}`) % 3 === 0) bloom.set(x, 0, z, C.lime);
    return {
      model: m,
      parts: [part("bloom", bloom, [8, 7.5, 5], "pulse", { speed: 0.3, amplitude: 0.85 })],
    };
  }),
  fine("coffee_shrub", { solid: true }, () => {
    // Coffee shrub with a sign: "Kontrollgruppe".
    const m = new Model(10, 16, 10);
    plantPot(m, 4.5, 4.5, 4, 4, C.paint_brick);
    m.box(4, 5, 4, 5, 8, 5, C.wood_dark);
    for (let z = 0; z < 10; z++)
      for (let y = 7; y < 15; y++)
        for (let x = 0; x < 10; x++) {
          const dd = (x - 4.5) ** 2 + ((y - 11) * 1.3) ** 2 + (z - 4.5) ** 2;
          if (dd > 18) continue;
          const h = fnv1a(`cof${x},${y},${z}`);
          if (dd > 12 && h % 3 === 0) continue;
          m.set(x, y, z, h % 11 === 0 ? C.red_paint : h % 4 === 0 ? C.leaf_light : C.leaf_dark);
        }
    m.box(6, 1, 9, 9, 3, 9, C.paper).box(7, 2, 9, 8, 2, 9, C.paint_black); // sign
    m.box(7, 0, 9, 7, 0, 9, C.wood);
    return m;
  }),

  // ── Observatory & radio ──
  rich("armillary", { solid: true, scale: S }, () => {
    const m = new Model(10, 14, 10);
    m.cyl(4.5, 4.5, 3.4, 0, 1, C.walnut);
    m.box(4, 2, 4, 5, 6, 5, C.brass);
    const core = orb(1.2, C.halo_glow);
    return {
      model: m,
      parts: [
        part("core", core, [5, 10, 5], "pulse", { speed: 0.4, amplitude: 0.5 }),
        part("meridian", ringModel(3.6, "xy", C.brass, C.gold), [5, 10, 5], "spin", {
          speed: 0.35,
        }),
        part("ecliptic", ringModel(3, "xz", C.bronze, C.crystal_cyan), [5, 10, 5], "spin", {
          speed: -0.6,
          axis: "x",
        }),
      ],
    };
  }),
  rich("foucault_pendulum", { solid: true, scale: S }, () => {
    const m = new Model(14, 3, 14);
    m.cyl(6.5, 6.5, 6.6, 0, 0, C.tile_black);
    for (let a = 0; a < 16; a++) {
      const x = Math.round(6.5 + Math.cos((a / 16) * Math.PI * 2) * 5);
      const z = Math.round(6.5 + Math.sin((a / 16) * Math.PI * 2) * 5);
      m.set(x, 0, z, a % 4 === 0 ? C.gold : C.brass);
    }
    m.ring(6.5, 6.5, 6.4, 2, C.brass);
    for (const [x, z] of [
      [0, 6],
      [13, 7],
      [6, 0],
      [7, 13],
    ] as const)
      m.box(x, 0, z, x, 2, z, C.bronze);
    const bob = new Model(3, 24, 3);
    bob.box(1, 3, 1, 1, 23, 1, C.steel);
    bob.sphere(1, 1.5, 1, 1.4, C.brass);
    bob.set(1, 0, 1, C.bronze);
    return {
      model: m,
      parts: [
        part("pendulum", bob, [7, 26.5, 7], "sway", {
          speed: 0.22,
          axis: "z",
          amplitude: 0.22,
          pivot: [1.5, 23.5, 1.5],
        }),
      ],
    };
  }),
  rich("receiver_stack", { solid: true, scale: S, light: L([6, 14, 8], "#ffaa00", 2, 4) }, () => {
    const m = new Model(12, 20, 8);
    const unit = (y0: number, h: number, body: number) => {
      m.box(0, y0, 0, 11, y0 + h - 1, 7, body);
      m.box(0, y0, 7, 11, y0, 7, C.metal_dark);
    };
    unit(0, 6, C.olive);
    unit(6, 7, C.beige);
    unit(13, 7, C.paint_gray);
    const wave = screenWell(m, 1, 15, 5, 18, 7, { content: "wave", color: "#FFAA00" });
    const noise = screenWell(m, 1, 8, 5, 11, 7, { content: "noise", color: "#33FF33" });
    for (const y of [16, 9]) disc(m, 8.5, y + 0.5, 1.2, 7, C.black);
    m.set(10, 17, 7, C.led_red).set(10, 10, 7, C.led_green);
    for (let x = 1; x <= 10; x += 3) m.set(x, 3, 7, C.chrome).set(x + 1, 3, 7, C.paint_black);
    m.box(1, 1, 7, 10, 1, 7, C.crt_bg);
    m.box(11, 20 - 1, 2, 11, 19, 3, C.chrome);
    // Backs: vents, BNC connectors, a cable bundle down the side.
    for (const [y0, h] of [
      [0, 6],
      [6, 7],
      [13, 7],
    ] as const) {
      m.box(1, y0 + h - 2, 0, 7, y0 + h - 2, 0, C.black);
      m.set(9, y0 + 2, 0, C.chrome).set(10, y0 + 2, 0, C.brass);
    }
    m.box(11, 0, 0, 11, 17, 0, C.cable_black).box(10, 0, 0, 10, 12, 0, C.cable_red);
    return {
      model: m,
      screens: [wave, noise],
      parts: [
        part("needle", blob(1, 3, 1, C.safety_red), [5.5, 3.5, 7.5], "sway", {
          speed: 0.9,
          axis: "z",
          amplitude: 0.5,
          pivot: [0.5, 0, 0.5],
          power: true,
        }),
      ],
    };
  }),
  // ── Shaft (Ebene −4) ──
  fine("mine_cart", { solid: true }, () => {
    const m = new Model(12, 10, 16);
    for (const z of [2, 13])
      for (const x of [0, 11]) {
        m.box(x, 0, z - 1, x, 2, z + 1, C.iron_rust).set(x, 1, z, C.metal_dark);
      }
    m.box(1, 1, 1, 10, 1, 14, C.metal_dark); // chassis
    m.box(1, 2, 0, 10, 8, 15, C.iron_rust);
    m.box(2, 3, 1, 9, 8, 14, 0);
    m.box(2, 3, 1, 9, 5, 14, C.concrete_dark);
    for (let i = 0; i < 20; i++) {
      const h = fnv1a(`cart${i}`);
      const x = 2 + (h % 8);
      const z = 1 + ((h >> 4) % 14);
      m.set(x, 6 + ((h >> 9) % 2), z, h % 5 === 0 ? C.crystal_violet : h % 2 ? C.concrete : C.rust);
    }
    for (const y of [3, 7]) m.box(1, y, 0, 10, y, 0, C.rust).box(1, y, 15, 10, y, 15, C.rust);
    m.box(5, 4, 15, 6, 5, 15, C.hazard_black);
    return m;
  }),
  fine("rail_track", { solid: false }, () => {
    const m = new Model(8, 1, 32);
    for (let z = 1; z < 32; z += 4) m.box(0, 0, z, 7, 0, z + 1, C.wood_dark);
    m.box(1, 0, 0, 1, 0, 31, C.steel).box(6, 0, 0, 6, 0, 31, C.steel);
    m.set(1, 0, 17, C.rust).set(6, 0, 9, C.rust);
    return m;
  }),
  fine("rubble_heap", { solid: true }, () => {
    const m = new Model(16, 7, 12);
    for (let z = 0; z < 12; z++)
      for (let x = 0; x < 16; x++) {
        const dd = ((x - 7.5) / 8) ** 2 + ((z - 5.5) / 6) ** 2;
        if (dd > 1) continue;
        const h = fnv1a(`rh${x},${z}`);
        const top = Math.max(0, Math.round((1 - dd) * 6 + (h % 3) - 1));
        for (let y = 0; y <= top; y++)
          m.set(x, y, z, y === top ? (h % 7 === 0 ? C.rust : C.concrete) : C.concrete_dark);
      }
    m.box(3, 4, 5, 12, 4, 5, C.iron_rust).set(12, 5, 5, C.iron_rust); // bent rebar
    m.box(9, 3, 8, 11, 5, 9, C.concrete_light);
    return m;
  }),
  rich("water_drip", { solid: false, scale: S }, () => {
    const m = new Model(6, 1, 6);
    m.cyl(2.5, 2.5, 2.6, 0, 0, C.water);
    m.set(0, 0, 3, C.water).set(5, 0, 1, C.water);
    return {
      model: m,
      parts: [
        ...drips("drop", [2.5, 24.5, 2.5], 5, 5, C.water, 0.9),
        part("ripple", ringModel(1.6, "xz", C.glass), [3, 1.5, 3], "pulse", {
          speed: 0.9,
          amplitude: 1,
        }),
      ],
    };
  }),
  fine("crystal_small", { solid: false }, () => {
    const m = new Model(6, 8, 6);
    m.box(1, 0, 1, 4, 0, 4, C.concrete_dark);
    for (const [x, z, h, c] of [
      [2, 2, 7, C.crystal_violet],
      [1, 3, 4, C.crystal_cyan],
      [4, 2, 5, C.crystal_rose],
      [3, 4, 3, C.crystal_cyan],
    ] as const) {
      m.box(x, 1, z, x, h - 1, z, c);
      m.set(x, h, z, C.halo_glow);
    }
    return m;
  }),
  fine("core_samples", { solid: true }, () => {
    // Drill cores from Bohrung #1, 1997 — the last metres glitter.
    const m = new Model(14, 12, 6);
    m.box(0, 0, 0, 0, 11, 5, C.steel_dark).box(13, 0, 0, 13, 11, 5, C.steel_dark);
    for (const y of [0, 4, 8]) m.box(0, y, 0, 13, y, 5, C.metal);
    for (const y of [1, 5, 9])
      for (let z = 1; z <= 4; z += 3) {
        for (let x = 1; x <= 12; x++) {
          const layer = Math.floor((x + y * 2) / 3) % 4;
          const c = [C.concrete, C.concrete_dark, C.rust, C.concrete_light][layer]!;
          m.box(x, y, z, x, y + 1, z + 1, y === 9 && x > 9 ? C.abstractum : c);
        }
      }
    m.box(4, 11, 5, 9, 11, 5, C.paper).set(6, 11, 5, C.paint_black);
    return m;
  }),
  fine("drill_head", { solid: true }, () => {
    // The drill bit of Bohrung #1, big as a car, stood on its collar.
    const m = new Model(18, 20, 18);
    m.cyl(8.5, 8.5, 8.4, 0, 1, C.metal_dark);
    m.cyl(8.5, 8.5, 7, 2, 3, C.steel_dark);
    m.ring(8.5, 8.5, 7, 3, C.safety_yellow);
    for (let y = 4; y < 20; y++) {
      const r = Math.max(0.6, 6.6 - (y - 4) * 0.4);
      m.cyl(8.5, 8.5, r, y, y, y % 4 === 0 ? C.rust : C.iron_rust);
      // Spiral flute with steel cutting teeth.
      const a = y * 0.55;
      for (const off of [0, Math.PI]) {
        const x = Math.round(8.5 + Math.cos(a + off) * (r + 0.6));
        const z = Math.round(8.5 + Math.sin(a + off) * (r + 0.6));
        m.set(x, y, z, y % 2 ? C.steel : C.metal_light);
      }
    }
    m.box(8, 19, 8, 9, 19, 9, C.chrome);
    m.box(1, 0, 8, 16, 0, 9, C.hazard_black);
    return m;
  }),
  rich("crt_terminal", { solid: true, scale: S, light: L([5, 8, 9], "#33ff33", 2, 4) }, () => {
    // C8-BR41N's terminal: one line keeps appearing — [EXTERNAL].
    const m = new Model(10, 12, 9);
    m.box(0, 0, 0, 9, 3, 8, C.wood_light);
    m.box(0, 3, 0, 9, 3, 8, C.wood_dark);
    m.box(1, 4, 0, 8, 11, 7, C.beige);
    m.box(2, 5, 0, 7, 10, 0, C.paint_cream);
    const scr = screenWell(m, 2, 6, 7, 10, 8, {
      content: "log",
      color: "#33FF33",
      text: "[EXTERNAL]",
    });
    m.box(1, 4, 8, 8, 4, 8, C.beige);
    m.set(8, 5, 8, C.led_green);
    m.box(0, 0, 8, 9, 2, 8, C.wood_dark);
    for (let y = 6; y <= 9; y += 3) m.box(3, y, 0, 6, y, 0, C.black); // tube-cap vents
    m.box(7, 0, 0, 7, 4, 0, C.cable_black);
    return { model: m, screens: [scr] };
  }),
  fine("heatsink_pile", { solid: false }, () => {
    const m = new Model(10, 4, 8);
    for (let i = 0; i < 3; i++) {
      const x0 = i * 3;
      const z0 = (i * 5) % 4;
      m.box(x0, i % 2, z0, x0 + 3, i % 2, z0 + 3, C.aluminium);
      for (let x = x0; x <= x0 + 3; x += 2)
        m.box(x, 1 + (i % 2), z0, x, 2 + (i % 2), z0 + 3, C.metal_light);
    }
    m.box(1, 0, 6, 8, 0, 6, C.cable_black).set(8, 0, 7, C.cable_red);
    return m;
  }),
  fine("bot_scrap", { solid: false }, () => {
    // Sixth-generation bot parts from the collapse of 2009.
    const m = new Model(12, 5, 10);
    m.box(0, 0, 0, 4, 3, 3, C.bot_body).set(1, 2, 3, C.black).set(3, 2, 3, C.black); // head
    m.set(2, 4, 1, C.bot_dark).set(1, 1, 3, C.led_red);
    m.box(6, 0, 1, 11, 1, 2, C.bot_dark).box(10, 0, 3, 11, 1, 5, C.bot_dark); // arm
    m.box(1, 0, 6, 8, 1, 9, C.rubber); // tread
    for (let x = 1; x <= 8; x += 2) m.set(x, 2, 7, C.metal_dark);
    m.set(9, 0, 8, C.cable_red).set(10, 0, 9, C.cable_yellow);
    return m;
  }),
  rich("dust_motes", { solid: false, scale: S }, () => {
    // X9-DUST: glittering dust that hangs in the air and never settles.
    const m = new Model(8, 1, 8);
    for (let i = 0; i < 10; i++) {
      const h = fnv1a(`dm${i}`);
      m.set(h % 8, 0, (h >> 4) % 8, i % 3 ? C.concrete_light : C.halo_glow);
    }
    const parts: AnimPart[] = [];
    for (let i = 0; i < 7; i++) {
      const h = fnv1a(`mote${i}`);
      parts.push(
        part(
          `mote${i}`,
          blob(1, 1, 1, i % 2 ? C.halo_glow : C.crystal_cyan),
          [1 + (h % 6) + 0.5, 4 + ((h >> 4) % 14), 1 + ((h >> 9) % 6) + 0.5],
          "bob",
          {
            speed: 0.15 + (h % 5) * 0.05,
            amplitude: 1.5 + (h % 3),
            phase: (h % 628) / 100,
          },
        ),
      );
    }
    return { model: m, parts };
  }),
  fine("dust_jar", { solid: false, small: true }, () => {
    const m = new Model(3, 5, 3);
    m.box(0, 0, 0, 2, 3, 2, C.glass);
    m.box(1, 0, 1, 1, 1, 1, C.halo_glow).set(0, 0, 2, C.crystal_cyan);
    m.box(0, 4, 0, 2, 4, 2, C.metal).set(1, 2, 2, C.paper);
    return m;
  }),
  rich("cooling_fan_box", { solid: true, scale: S }, () => {
    // Improvised server cooling: a box fan duct-taped to a crate.
    const m = new Model(10, 12, 6);
    m.box(0, 0, 0, 9, 3, 5, C.wood_light);
    m.box(0, 4, 0, 9, 11, 3, C.paint_gray);
    m.box(1, 5, 3, 8, 10, 3, C.black);
    m.box(0, 7, 4, 9, 7, 4, C.metal_light); // tape
    m.set(8, 11, 3, C.led_green);
    // Back: louvres, the tape wrapped all round, crate planks.
    for (let y = 5; y <= 10; y += 2) m.box(1, y, 0, 8, y, 0, C.black);
    m.box(0, 7, 0, 9, 7, 0, C.metal_light);
    m.box(0, 1, 0, 9, 1, 0, C.wood_dark).box(3, 0, 0, 3, 3, 0, C.wood_dark);
    return {
      model: m,
      parts: [
        part("fan", fanRotor(3, "xy", C.metal_light, C.metal_dark), [5, 8, 3.5], "spin", {
          speed: 10,
          axis: "z",
          power: true,
        }),
      ],
    };
  }),
  fine("rubble_wall", { solid: false, wall: true, elevation: 0 }, () => {
    // Collapsed ceiling slumped against the wall.
    const m = new Model(16, 10, 4);
    for (let x = 0; x < 16; x++) {
      const h = fnv1a(`rw${x}`);
      const top = 3 + Math.round(Math.sin(x * 0.4) * 3 + 3) + (h % 2);
      for (let y = 0; y < Math.min(10, top); y++) {
        const z = Math.max(0, Math.min(3, 3 - Math.floor((y * 4) / top)));
        m.box(x, y, 0, x, y, z, (h + y) % 5 === 0 ? C.concrete_light : C.concrete_dark);
      }
    }
    m.box(5, 6, 1, 11, 6, 1, C.iron_rust);
    scribble(m, 0, 0, 15, 2, 3, [C.concrete, C.rust], "rwb", 3);
    return m;
  }),
];

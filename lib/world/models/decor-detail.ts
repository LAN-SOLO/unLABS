/**
 * Small-detail decor at DETAIL_SCALE (0.25): desk-top clutter (`small`,
 * placed on host surfaces by content/interior.ts), floor clutter and wall
 * details. Everything here is non-solid — clutter never blocks a path.
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model } from "@/lib/world/models/core";
import { fanRotor, ringModel } from "@/lib/world/models/anim";
import {
  BOOK_COLORS,
  blob,
  disc,
  fine,
  L,
  part,
  rich,
  scribble,
  wisp,
  DETAIL_SCALE,
  type DecorDef,
} from "@/lib/world/models/decor-kit";

const SMALL = { solid: false, small: true } as const;

function mug(m: Model, x: number, z: number, body: number, fill: number) {
  m.box(x, 0, z, x + 1, 2, z + 1, body);
  m.box(x, 2, z, x + 1, 2, z + 1, fill);
  m.box(x + 2, 1, z, x + 2, 1, z, body); // handle
}

export const DETAIL_DECOR: DecorDef[] = [
  // ── Desk-top clutter ──
  fine("keyboard", SMALL, () => {
    const m = new Model(8, 2, 3);
    m.box(0, 0, 0, 7, 0, 2, C.paint_black);
    for (let z = 0; z < 3; z++)
      for (let x = 0; x < 8; x++) if ((x + z) % 2 === 0) m.set(x, 1, z, C.metal_light);
    m.box(2, 1, 2, 5, 1, 2, C.paint_gray); // space bar
    m.set(7, 1, 0, C.led_green);
    return m;
  }),
  fine("mouse_pad", SMALL, () => {
    const m = new Model(4, 2, 4);
    m.box(0, 0, 0, 3, 0, 3, C.paint_navy);
    m.box(1, 1, 1, 2, 1, 2, C.paint_gray).set(1, 1, 1, C.metal_dark);
    m.set(2, 0, 0, C.cable_black);
    return m;
  }),
  rich("coffee_mug", { ...SMALL, scale: DETAIL_SCALE }, () => {
    const m = new Model(3, 3, 2);
    mug(m, 0, 0, C.ceramic, C.coffee);
    return {
      model: m,
      parts: [
        part("steam_a", wisp(3, C.coat_white, 1), [0.8, 4.5, 0.8], "bob", {
          speed: 0.45,
          amplitude: 0.8,
        }),
        part("steam_b", wisp(2, C.coat_white, 2), [1.4, 5, 1.2], "bob", {
          speed: 0.6,
          amplitude: 1,
          phase: 2,
        }),
      ],
    };
  }),
  fine("mug_cold", SMALL, () => {
    // Coffee from 2019, dried to a crust; a ring stain on the table.
    const m = new Model(4, 3, 3);
    m.box(0, 0, 0, 3, 0, 2, C.coffee);
    m.box(0, 0, 0, 3, 0, 2, 0).set(0, 0, 2, C.coffee).set(3, 0, 0, C.coffee);
    mug(m, 0, 0, C.paint_white, C.rust);
    m.set(0, 2, 1, C.blue_paint);
    return m;
  }),
  fine("paper_stack", SMALL, () => {
    const m = new Model(5, 3, 4);
    m.box(0, 0, 0, 3, 0, 3, C.paper).box(1, 1, 0, 4, 1, 3, C.paper_yellow);
    m.box(0, 2, 1, 3, 2, 3, C.paper).set(1, 2, 2, C.paint_black).set(2, 2, 2, C.paint_black);
    m.set(4, 2, 0, C.metal_light); // paper clip
    return m;
  }),
  fine("notebook_open", SMALL, () => {
    const m = new Model(6, 2, 4);
    m.box(0, 0, 0, 5, 0, 3, C.book_blue);
    m.box(0, 1, 0, 2, 1, 3, C.paper).box(3, 1, 0, 5, 1, 3, C.paper);
    for (const z of [0, 2]) m.set(0, 1, z, C.blue_paint).set(4, 1, z, C.blue_paint);
    m.set(1, 1, 1, C.paint_black).set(5, 1, 1, C.red_paint);
    m.box(2, 1, 3, 3, 1, 3, C.brass); // pen in the gutter
    return m;
  }),
  fine("pen_cup", SMALL, () => {
    const m = new Model(2, 4, 2);
    m.box(0, 0, 0, 1, 1, 1, C.metal_dark);
    m.set(0, 2, 0, C.blue_paint).set(0, 3, 0, C.blue_paint).set(1, 2, 1, C.red_paint);
    m.set(1, 3, 1, C.paint_black).set(1, 2, 0, C.safety_yellow);
    return m;
  }),
  fine("headphones", SMALL, () => {
    const m = new Model(5, 4, 3);
    m.box(0, 0, 0, 1, 1, 2, C.paint_black).box(3, 0, 0, 4, 1, 2, C.paint_black);
    m.box(0, 0, 1, 0, 1, 1, C.leather).box(4, 0, 1, 4, 1, 1, C.leather);
    m.box(1, 2, 1, 1, 3, 1, C.metal).box(2, 3, 1, 2, 3, 1, C.metal).box(3, 2, 1, 3, 3, 1, C.metal);
    return m;
  }),
  rich("soldering_station", { ...SMALL, scale: DETAIL_SCALE }, () => {
    const m = new Model(7, 5, 4);
    m.box(0, 0, 0, 3, 2, 3, C.safety_blue);
    m.set(1, 1, 3, C.led_red).set(2, 1, 3, C.black); // temp dial
    m.box(0, 3, 3, 1, 3, 3, C.screen_red);
    m.box(4, 0, 0, 6, 0, 3, C.metal_dark); // holder base
    m.box(5, 1, 1, 5, 3, 1, C.steel); // coil stand
    m.set(6, 4, 2, C.fire).set(5, 3, 2, C.paint_black).set(6, 2, 3, C.paint_black); // iron
    m.set(4, 1, 3, C.brass); // sponge
    m.box(3, 1, 0, 3, 1, 0, C.cable_black);
    return {
      model: m,
      parts: [
        part("smoke", wisp(5, C.coat_shadow, 4), [6.5, 7.5, 2.5], "bob", {
          speed: 0.35,
          amplitude: 1.2,
        }),
      ],
    };
  }),
  fine("multimeter", SMALL, () => {
    const m = new Model(5, 2, 4);
    m.box(0, 0, 0, 2, 0, 3, C.safety_yellow);
    m.box(0, 1, 2, 2, 1, 3, C.crt_bg).set(1, 1, 3, C.screen_green); // LCD
    m.set(1, 1, 0, C.black).set(1, 1, 1, C.paint_gray); // dial
    m.box(3, 0, 1, 4, 0, 1, C.red_paint).box(3, 0, 2, 4, 0, 2, C.paint_black); // leads
    return m;
  }),
  fine("scope_probes", SMALL, () => {
    const m = new Model(5, 2, 4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      m.set(Math.round(2 + Math.cos(a) * 2), 0, Math.round(1.5 + Math.sin(a) * 1.5), C.cable_black);
    }
    m.set(4, 1, 1, C.paint_black).set(4, 1, 2, C.chrome).set(0, 1, 2, C.cable_yellow);
    return m;
  }),
  fine("cable_spool", { solid: false }, () => {
    const m = new Model(6, 6, 4);
    for (const z of [0, 3]) disc(m, 2.5, 2.5, 2.5, z, C.wood_light);
    m.box(1, 1, 1, 4, 4, 2, C.cable_red).box(2, 2, 1, 3, 3, 2, C.cable_black);
    m.set(2, 2, 0, C.wood_dark).set(2, 2, 3, C.wood_dark);
    m.box(5, 0, 1, 5, 0, 2, C.cable_red); // loose end
    return m;
  }),
  fine("toolbox", { solid: false }, () => {
    const m = new Model(7, 5, 4);
    m.box(0, 0, 0, 6, 2, 3, C.safety_red);
    m.box(0, 2, 0, 6, 2, 3, C.red_paint);
    m.box(2, 3, 1, 4, 3, 2, C.metal_dark).set(2, 4, 1, C.metal_dark).set(4, 4, 1, C.metal_dark);
    m.box(3, 4, 1, 3, 4, 2, C.metal_dark);
    m.set(3, 1, 3, C.chrome).set(0, 3, 2, C.steel); // latch, wrench sticking out
    return m;
  }),
  fine("screwdriver_set", SMALL, () => {
    const m = new Model(6, 3, 3);
    m.box(0, 0, 0, 5, 0, 2, C.metal_dark);
    const handles = [C.safety_red, C.safety_yellow, C.blue_paint, C.safety_green, C.paint_black];
    for (let i = 0; i < 5; i++) m.box(i + 0, 1, 1, i + 0, 2, 1, handles[i]!).set(i, 1, 2, C.steel);
    return m;
  }),
  fine("beaker_rack", SMALL, () => {
    const m = new Model(8, 5, 3);
    m.box(0, 0, 0, 7, 0, 2, C.wood_light);
    m.box(0, 2, 0, 7, 2, 0, C.wood_light).box(0, 0, 0, 0, 2, 0, C.wood_light);
    m.box(7, 0, 0, 7, 2, 0, C.wood_light);
    const liq = [C.liquid_green, C.liquid_blue, C.liquid_pink, C.abstractum];
    for (let i = 0; i < 4; i++) {
      const x = 1 + i * 2;
      m.box(x, 1, 1, x, 3, 1, C.glass).box(x, 1, 1, x, 1 + (i % 3), 1, liq[i]!);
    }
    return m;
  }),
  fine("petri_dishes", SMALL, () => {
    const m = new Model(5, 2, 4);
    m.box(0, 0, 0, 2, 0, 2, C.glass).set(1, 0, 1, C.liquid_green);
    m.box(2, 0, 1, 4, 0, 3, C.glass).set(3, 0, 2, C.leaf_light).set(4, 0, 3, C.flower_yellow);
    m.box(1, 1, 1, 3, 1, 3, C.glass_green).set(2, 1, 2, C.lime);
    return m;
  }),
  fine("vinyl_crate", { solid: false }, () => {
    const m = new Model(6, 6, 6);
    m.box(0, 0, 0, 5, 3, 5, C.wood_light).box(1, 1, 1, 4, 3, 4, 0);
    const sleeves = [C.book_red, C.paint_black, C.fabric_mustard, C.paint_teal, C.paper];
    for (let z = 1; z <= 4; z++) m.box(1, 1, z, 4, 4 + (z % 2), z, sleeves[z % sleeves.length]!);
    m.box(1, 4, 4, 3, 5, 4, C.paint_black).set(2, 5, 4, C.book_red); // record peeking out
    return m;
  }),
  fine("tape_reels", SMALL, () => {
    const m = new Model(5, 3, 5);
    for (let y = 0; y < 3; y++) {
      const o = y % 2;
      m.cyl(2 + o * 0.4, 2, 2, y, y, y === 2 ? C.aluminium : C.paint_black);
      m.set(2 + o, y, 2, C.metal_light);
    }
    m.set(4, 2, 1, C.coffee).set(4, 1, 2, C.coffee); // loose tape
    return m;
  }),
  fine("photo_cottbus", SMALL, () => {
    // Jade & Damien, Cottbus 1989 — two figures under a pale sky. His half of
    // the print is bleached out (over-exposed): Damien stays unrecognisable
    // until he has been found (lib/world/damien.ts).
    const m = new Model(4, 5, 2);
    m.box(0, 0, 1, 3, 4, 1, C.brass);
    m.box(1, 1, 1, 2, 3, 1, C.paint_sky);
    m.set(1, 1, 1, C.hair_copper).set(1, 2, 1, C.skin_pale);
    m.set(2, 1, 1, C.paint_cream).set(2, 2, 1, C.paper).set(2, 3, 1, C.paint_white);
    m.box(1, 0, 0, 2, 0, 0, C.brass); // stand
    return m;
  }),
  fine("chess_board", SMALL, () => {
    const m = new Model(10, 3, 10);
    m.box(0, 0, 0, 9, 0, 9, C.walnut);
    for (let z = 1; z <= 8; z++)
      for (let x = 1; x <= 8; x++) m.set(x, 0, z, (x + z) % 2 ? C.oak : C.wood_dark);
    // Mid-game: a handful of pieces, one king cornered.
    const white: [number, number, number][] = [
      [2, 2, 1],
      [4, 3, 2],
      [5, 2, 1],
      [7, 4, 2],
      [3, 6, 1],
    ];
    const black: [number, number, number][] = [
      [6, 7, 2],
      [8, 8, 2],
      [2, 7, 1],
      [5, 6, 1],
    ];
    for (const [x, z, h] of white) m.box(x, 1, z, x, h, z, C.paint_white);
    for (const [x, z, h] of black) m.box(x, 1, z, x, h, z, C.paint_black);
    m.set(0, 1, 5, C.paint_black).set(9, 1, 3, C.paint_white); // captured pieces
    return m;
  }),
  fine("rubiks_cube", SMALL, () => {
    const m = new Model(2, 2, 2);
    const cols = [C.safety_red, C.safety_green, C.safety_blue, C.safety_yellow, C.paint_white];
    for (let i = 0; i < 8; i++) m.set(i & 1, (i >> 1) & 1, (i >> 2) & 1, cols[(i * 3) % 5]!);
    return m;
  }),
  fine("book_stack", SMALL, () => {
    const m = new Model(5, 5, 4);
    for (let y = 0; y < 5; y++) {
      const o = fnv1a(`bs${y}`) % 2;
      m.box(o, y, 0, 3 + o, y, 3 - (y % 2), BOOK_COLORS[(y * 3) % BOOK_COLORS.length]!);
      m.set(o, y, 1, C.paper);
    }
    return m;
  }),
  fine("books_compression", SMALL, () => {
    // Jade's shelf row: compression theory, sorted by colour, between bookends.
    const m = new Model(11, 5, 3);
    m.box(0, 0, 0, 0, 4, 2, C.brass).box(10, 0, 0, 10, 4, 2, C.brass);
    const cols = [C.paint_navy, C.book_blue, C.paint_teal, C.paint_sky, C.paint_mint];
    for (let x = 1; x <= 9; x++) {
      const c = cols[Math.floor(((x - 1) * cols.length) / 9)]!;
      m.box(x, 0, 0, x, 3 + (x % 2), 2, c);
      m.set(x, 2, 2, C.paper);
    }
    return m;
  }),
  fine("legal_pads", SMALL, () => {
    // Legal pads, numbered 1 to 17.
    const m = new Model(5, 3, 6);
    for (let y = 0; y < 3; y++) {
      const o = y % 2;
      m.box(o, y, o, 3 + o, y, 4 + o, C.paper_yellow);
      m.box(o, y, o, o, y, 4 + o, C.red_paint);
      m.box(o, y, o, 3 + o, y, o, C.paint_black);
    }
    m.box(2, 2, 3, 3, 2, 3, C.blue_paint);
    return m;
  }),
  rich("radio_finder", { ...SMALL, scale: DETAIL_SCALE }, () => {
    // Damien's direction finder, still tuned to a frequency nobody sends on.
    const m = new Model(6, 5, 4);
    m.box(0, 0, 0, 5, 2, 3, C.olive);
    m.box(1, 1, 3, 2, 2, 3, C.crt_bg).set(1, 2, 3, C.screen_amber);
    m.set(4, 1, 3, C.black).set(4, 2, 3, C.chrome);
    m.box(2, 3, 1, 3, 3, 2, C.metal_dark).box(2, 4, 1, 3, 4, 2, C.metal);
    return {
      model: m,
      parts: [
        part("loop", ringModel(1.6, "xy", C.brass, C.safety_red), [3, 6.6, 1.5], "sway", {
          speed: 0.08,
          axis: "y",
          amplitude: 0.9,
        }),
      ],
    };
  }),
  fine("food_tray", SMALL, () => {
    const m = new Model(7, 2, 5);
    m.box(0, 0, 0, 6, 0, 4, C.paint_gray);
    m.box(1, 1, 1, 3, 1, 3, C.paint_white).set(2, 1, 2, C.fabric_mustard); // lentils
    m.box(5, 1, 1, 5, 1, 3, C.steel); // cutlery
    m.set(4, 1, 3, C.glass);
    return m;
  }),
  rich("desk_fan", { ...SMALL, scale: DETAIL_SCALE }, () => {
    const m = new Model(7, 8, 4);
    m.box(1, 0, 0, 5, 0, 3, C.paint_cream);
    m.box(3, 1, 1, 3, 3, 1, C.paint_cream).set(4, 0, 3, C.led_green);
    for (let a = 0; a < 16; a++) {
      const x = Math.round(3 + Math.cos((a / 16) * Math.PI * 2) * 3);
      const y = Math.round(5 + Math.sin((a / 16) * Math.PI * 2) * 2.6);
      m.set(x, y, 0, C.metal_light).set(x, y, 2, C.metal_light);
    }
    m.box(3, 4, 0, 3, 5, 0, C.paint_cream);
    return {
      model: m,
      parts: [
        part("rotor", fanRotor(2, "xy", C.paint_cream, C.metal_dark), [3.5, 5.5, 1.5], "spin", {
          speed: 12,
          axis: "z",
          power: true,
        }),
      ],
    };
  }),
  fine("plant_dusty", { solid: false, small: true }, () => {
    const m = new Model(5, 8, 5);
    m.cyl(2, 2, 2, 0, 2, C.paint_brick).cyl(2, 2, 1.2, 2, 2, C.soil);
    m.box(2, 3, 2, 2, 5, 2, C.wood_dark);
    m.set(1, 5, 2, C.book_brown).set(3, 6, 2, C.leaf_dark).set(2, 7, 3, C.book_brown);
    m.set(0, 4, 1, C.fabric_mustard).set(4, 4, 3, C.book_brown).set(3, 1, 4, C.book_brown);
    m.set(1, 2, 1, C.concrete_light).set(2, 2, 3, C.concrete_light); // dust
    return m;
  }),
  fine("sofa_blanket", SMALL, () => {
    const m = new Model(10, 2, 7);
    for (let z = 0; z < 7; z++)
      for (let x = 0; x < 10; x++)
        m.set(x, 0, z, ((x >> 1) + (z >> 1)) % 2 ? C.fabric_mustard : C.fabric_red);
    m.box(0, 1, 0, 3, 1, 6, C.fabric_mustard); // folded end
    m.box(9, 0, 0, 9, 0, 6, C.paper); // fringe
    return m;
  }),
  fine("pizza_box", { solid: false, small: true }, () => {
    const m = new Model(7, 3, 7);
    m.box(0, 0, 0, 6, 1, 6, C.cardboard);
    m.box(1, 1, 1, 5, 1, 5, C.fabric_mustard).set(2, 1, 2, C.red_paint).set(4, 1, 3, C.red_paint);
    m.box(0, 2, 0, 6, 2, 3, C.cardboard).set(2, 2, 1, C.rust).set(4, 2, 2, C.wood_red); // lid, greasy
    return m;
  }),

  // ── Floor clutter ──
  fine("chair_broken", { solid: false }, () => {
    // A toppled swivel chair, one caster gone.
    const m = new Model(12, 7, 12);
    m.box(1, 0, 3, 10, 2, 9, C.fabric_blue); // seat on its side
    m.box(1, 3, 3, 10, 6, 4, C.fabric_blue); // backrest
    m.box(10, 1, 5, 11, 2, 7, C.chrome);
    m.box(8, 0, 0, 8, 0, 3, C.metal_dark).box(9, 0, 9, 11, 0, 11, C.metal_dark);
    m.set(8, 0, 0, C.rubber).set(11, 0, 11, C.rubber).set(3, 0, 11, C.rubber);
    m.set(5, 3, 7, C.fabric_gray).set(6, 3, 8, C.paint_white); // torn foam
    return m;
  }),
  fine("books_scattered", { solid: false }, () => {
    // Philosophy paperbacks, open where they fell.
    const m = new Model(10, 2, 8);
    m.box(0, 0, 0, 3, 0, 2, C.book_red).box(1, 1, 0, 3, 1, 2, C.paper);
    m.box(5, 0, 1, 8, 0, 4, C.book_green).box(5, 1, 1, 6, 1, 4, C.paper);
    m.box(2, 0, 5, 5, 0, 7, C.paint_navy).box(7, 0, 6, 9, 0, 7, C.book_brown);
    m.set(8, 1, 6, C.paper_yellow);
    return m;
  }),
  fine("rubble_small", { solid: false }, () => {
    const m = new Model(8, 3, 7);
    for (let i = 0; i < 16; i++) {
      const h = fnv1a(`rs${i}`);
      const x = h % 8;
      const z = (h >> 4) % 7;
      const y = (h >> 8) % 3 === 0 && x > 1 && x < 6 ? 1 : 0;
      m.set(x, y, z, h % 3 ? C.concrete : C.concrete_dark);
      if (y) m.set(x, 0, z, C.concrete_dark);
    }
    m.box(3, 0, 3, 4, 1, 4, C.concrete_light).set(3, 2, 3, C.rust);
    return m;
  }),

  // ── Wall details ──
  fine("sticky_wall", { solid: false, wall: true, elevation: 1.5 }, () => {
    const m = new Model(12, 10, 1);
    const cols = [C.paper_yellow, C.paper_pink, C.paper_blue, C.paper_yellow, C.lime];
    for (let y = 0; y < 10; y += 2)
      for (let x = 0; x < 12; x += 2) {
        const h = fnv1a(`sn${x},${y}`);
        if (h % 5 === 0) continue;
        const c = cols[h % cols.length]!;
        m.box(x, y, 0, x + 1, y + 1, 0, c);
        if (h % 3 === 0) m.set(x, y + 1, 0, C.paint_black);
      }
    m.box(4, 4, 0, 7, 5, 0, C.red_paint); // "?!"
    return m;
  }),
  fine("trophy_shelf", { solid: false, wall: true, elevation: 3 }, () => {
    const m = new Model(14, 8, 4);
    m.box(0, 0, 0, 13, 0, 3, C.walnut);
    m.box(1, 0, 0, 1, 0, 0, C.brass).box(12, 0, 0, 12, 0, 0, C.brass);
    m.box(1, 1, 1, 2, 1, 2, C.walnut).box(1, 2, 1, 2, 5, 2, C.gold).set(0, 4, 1, C.gold);
    m.set(3, 4, 1, C.gold).box(1, 6, 1, 2, 6, 2, C.gold); // cup with handles
    m.box(5, 1, 1, 6, 3, 2, C.bronze).set(5, 4, 2, C.bronze);
    m.box(8, 1, 1, 9, 1, 2, C.walnut).box(8, 2, 1, 9, 3, 2, C.crystal_violet);
    m.set(8, 4, 1, C.crystal_cyan);
    m.box(11, 1, 0, 12, 4, 0, C.paper).box(11, 5, 0, 12, 5, 0, C.scarf_red); // certificate
    return m;
  }),
  fine("lab_coat_hook", { solid: false, wall: true, elevation: 1 }, () => {
    const m = new Model(8, 16, 3);
    m.box(0, 15, 0, 7, 15, 0, C.wood_dark);
    m.box(3, 14, 0, 4, 14, 1, C.brass);
    m.box(1, 2, 1, 6, 13, 2, C.coat_white);
    m.box(1, 2, 2, 1, 13, 2, C.coat_shadow).box(6, 2, 2, 6, 13, 2, C.coat_shadow);
    m.box(3, 8, 2, 4, 13, 2, C.coat_shadow); // lapels
    m.box(0, 5, 1, 0, 12, 1, C.coat_white).box(7, 5, 1, 7, 12, 1, C.coat_white);
    m.set(5, 9, 2, C.blue_paint).set(5, 10, 2, C.badge_blue); // pen + badge
    return m;
  }),
  fine("goggles_hook", { solid: false, wall: true, elevation: 3 }, () => {
    const m = new Model(6, 6, 2);
    m.box(2, 5, 0, 3, 5, 1, C.brass);
    m.box(0, 1, 1, 5, 4, 1, C.paint_black);
    m.box(1, 1, 1, 2, 2, 1, C.goggles).box(3, 1, 1, 4, 2, 1, C.goggles);
    m.box(0, 3, 1, 5, 3, 1, C.leather);
    return m;
  }),
  fine("calendar_2019", { solid: false, wall: true, elevation: 2.5 }, () => {
    // Februar 2019 — nobody turned the page.
    const m = new Model(8, 10, 1);
    m.box(0, 0, 0, 7, 9, 0, C.paper);
    m.box(0, 7, 0, 7, 9, 0, C.red_paint);
    for (let x = 1; x < 7; x += 2) m.set(x, 8, 0, C.paper);
    for (let y = 1; y <= 5; y++)
      for (let x = 0; x < 7; x++) if ((x + y) % 2 === 0) m.set(x, y, 0, C.paint_gray);
    m.set(4, 3, 0, C.safety_red).set(5, 3, 0, C.safety_red); // circled day
    m.set(3, 9, 0, C.metal).set(4, 9, 0, C.metal); // hanger
    return m;
  }),
  fine("poster_telescope", { solid: false, wall: true, elevation: 2 }, () => {
    const m = new Model(8, 11, 1);
    m.box(0, 0, 0, 7, 10, 0, C.paint_navy);
    for (let i = 0; i < 9; i++) {
      const h = fnv1a(`st${i}`);
      m.set(h % 8, 4 + ((h >> 4) % 7), 0, i % 3 ? C.led_white : C.halo_glow);
    }
    for (let i = 0; i < 5; i++) m.set(2 + i, 3 + i, 0, C.paint_white); // tube
    m.set(1, 2, 0, C.paint_white)
      .box(3, 0, 0, 3, 3, 0, C.metal_light)
      .box(5, 0, 0, 5, 3, 0, C.metal_light);
    m.box(0, 0, 0, 7, 0, 0, C.wall_trim);
    return m;
  }),
  fine("star_chart", { solid: false, wall: true, elevation: 1.5 }, () => {
    const m = new Model(14, 10, 1);
    m.box(0, 0, 0, 13, 9, 0, C.paint_navy);
    m.box(0, 0, 0, 13, 0, 0, C.brass).box(0, 9, 0, 13, 9, 0, C.brass);
    const stars: [number, number][] = [
      [2, 6],
      [4, 7],
      [6, 5],
      [8, 7],
      [10, 4],
      [11, 7],
      [3, 3],
      [7, 2],
      [12, 2],
    ];
    for (let i = 1; i < 5; i++) {
      const [ax, ay] = stars[i - 1]!;
      const [bx, by] = stars[i]!;
      for (let t = 1; t < 4; t++)
        m.set(
          Math.round(ax + ((bx - ax) * t) / 4),
          Math.round(ay + ((by - ay) * t) / 4),
          0,
          C.paint_sky,
        );
    }
    for (const [x, y] of stars) m.set(x, y, 0, C.led_white);
    m.set(10, 4, 0, C.halo_glow); // the one that should not be there
    return m;
  }),
  rich("vent_fan", { solid: false, wall: true, elevation: 1, scale: DETAIL_SCALE }, () => {
    const m = new Model(8, 8, 2);
    m.box(0, 0, 0, 7, 7, 0, C.steel_dark);
    m.box(1, 1, 0, 6, 6, 0, C.black);
    for (const [x, y] of [
      [0, 0],
      [7, 0],
      [0, 7],
      [7, 7],
    ] as const)
      m.set(x, y, 1, C.chrome);
    for (let i = 1; i < 7; i += 2) m.box(1, i, 1, 6, i, 1, C.metal); // guard
    return {
      model: m,
      parts: [
        part("fan", fanRotor(2, "xy", C.metal_light, C.metal_dark), [4, 4, 0.5], "spin", {
          speed: 9,
          axis: "z",
          power: true,
        }),
      ],
    };
  }),
  fine("chalk_tally", { solid: false, wall: true, elevation: 1.5 }, () => {
    // Tally marks — somebody counted days down here.
    const m = new Model(12, 6, 1);
    for (let g = 0; g < 3; g++) {
      const x0 = g * 4;
      for (let i = 0; i < 4; i++) m.box(x0 + (i % 4), 1, 0, x0 + (i % 4), 4, 0, C.paint_white);
      for (let i = 0; i < 4; i++) m.set(x0 + i, 1 + i, 0, C.coat_shadow);
    }
    m.box(0, 0, 0, 11, 0, 0, C.coat_shadow);
    return m;
  }),
  fine("morse_chalk", { solid: false, wall: true, elevation: 3 }, () => {
    // ". _ . . _ _ _ . . . _ . _ _" in chalk.
    const m = new Model(20, 2, 1);
    const code = "._.._ __...._.__";
    let x = 0;
    for (const ch of code) {
      if (ch === ".") {
        m.set(x, 0, 0, C.paint_white);
        x += 2;
      } else if (ch === "_") {
        m.box(x, 0, 0, x + 1, 0, 0, C.paint_white);
        x += 3;
      } else x += 2;
      if (x >= 20) break;
    }
    m.set(0, 1, 0, C.coat_shadow);
    return m;
  }),
  fine("mycel_wall", { solid: false, wall: true, elevation: 0.5 }, () => {
    const m = new Model(12, 12, 2);
    scribble(m, 0, 0, 11, 11, 0, [C.paint_cream, C.coat_white, C.concrete_light], "myc", 2);
    scribble(m, 2, 1, 9, 10, 1, [C.paint_cream, C.lime, C.coat_white], "myc2", 5);
    m.box(5, 0, 1, 6, 11, 1, C.paint_cream); // cord along the cable trace
    m.set(3, 8, 1, C.lime).set(8, 4, 1, C.lime);
    return m;
  }),
  rich(
    "mine_lamp",
    {
      solid: false,
      wall: true,
      elevation: 4,
      scale: DETAIL_SCALE,
      light: L([2, 2, 2], "#ffc070", 3, 6, false),
    },
    () => {
      const m = new Model(4, 6, 3);
      m.box(1, 5, 0, 2, 5, 2, C.metal_dark);
      m.box(0, 0, 1, 3, 4, 2, C.iron_rust);
      m.box(1, 1, 1, 2, 3, 2, 0);
      m.box(0, 2, 2, 3, 2, 2, C.iron_rust); // cage bar
      return {
        model: m,
        parts: [
          part("bulb", blob(2, 3, 1, C.lamp_warm), [2, 2.5, 1.5], "flicker", {
            speed: 7,
            amplitude: 0.5,
          }),
        ],
      };
    },
  ),
  fine("support_beam", { solid: false, wall: true, elevation: 0 }, () => {
    // Timber mine support: post, cap and knee brace against the wall.
    const m = new Model(10, 24, 4);
    m.box(4, 0, 0, 6, 22, 3, C.wood_dark);
    m.box(0, 21, 0, 9, 23, 3, C.wood);
    for (let i = 0; i < 4; i++) m.set(3 - i, 20 - i, 1, C.wood).set(7 + i, 20 - i, 1, C.wood);
    m.box(4, 8, 3, 6, 8, 3, C.iron_rust).box(4, 16, 3, 6, 16, 3, C.iron_rust);
    m.set(5, 0, 3, C.concrete_dark).set(5, 12, 3, C.wood);
    return m;
  }),
  fine("library_ladder", { solid: false, wall: true, elevation: 0 }, () => {
    const m = new Model(6, 24, 4);
    for (let y = 0; y < 24; y++) {
      const z = Math.min(3, Math.floor((23 - y) / 6));
      m.set(0, y, z, C.walnut).set(5, y, z, C.walnut);
      if (y % 4 === 2) m.box(1, y, z, 4, y, z, C.oak);
    }
    m.box(0, 23, 0, 5, 23, 0, C.brass); // rail hook
    m.set(0, 0, 3, C.brass).set(5, 0, 3, C.brass); // wheels
    return m;
  }),
];

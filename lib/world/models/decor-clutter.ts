/**
 * Lived-in clutter at DETAIL_SCALE (0.25): wall lights, shelves, fuse
 * boxes, radiators, floor clutter (boxes, bags, laundry, a mop bucket),
 * a vending machine, a space heater, a coat rack and more desk-top
 * trinkets. Placed by the theme kits / host clutter in content/interior.ts.
 * Animated bits (flicker, sway, drips, blinking LEDs, pulsing coils) use
 * the decor part conventions of `decor-kit.ts`.
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model } from "@/lib/world/models/core";
import {
  blob,
  books,
  disc,
  drips,
  fine,
  L,
  part,
  rich,
  DETAIL_SCALE as S,
  type DecorDef,
} from "@/lib/world/models/decor-kit";

const SMALL = { solid: false, small: true } as const;

/** Trailing vine: voxels hanging down from (x, y, z), wandering in x. */
function vine(m: Model, x: number, y: number, z: number, len: number, seed: string): void {
  let cx = x;
  for (let i = 0; i < len; i++) {
    const k = fnv1a(`${seed}:${i}`);
    if (i > 0 && k % 5 === 0) cx += k % 2 ? 1 : -1;
    cx = Math.max(0, Math.min(m.w - 1, cx));
    m.set(cx, y - i, z, i % 3 === 0 ? C.leaf_light : k % 4 === 0 ? C.leaf_yellow : C.plant_green);
    if (i % 3 === 1) m.set(Math.min(m.w - 1, cx + 1), y - i, z, C.leaf_dark);
  }
}

/** Upright can / bottle rows behind glass (vending machine). */
const CANS = [C.safety_red, C.safety_blue, C.safety_green, C.safety_orange, C.paint_white];

export const CLUTTER_DECOR: DecorDef[] = [
  // ── Wall-mounted ──
  rich(
    "wall_sconce",
    {
      solid: false,
      wall: true,
      elevation: 3,
      scale: S,
      light: L([3, 3, 3], "#ffd9a0", 3, 5),
    },
    () => {
      const m = new Model(6, 8, 4);
      m.box(2, 0, 0, 3, 3, 0, C.brass); // back plate
      m.set(2, 1, 0, C.bronze).set(3, 2, 0, C.bronze);
      m.box(2, 2, 1, 3, 2, 2, C.brass); // arm
      // Pleated fabric shade (open top and bottom), bulb inside.
      for (let y = 3; y <= 6; y++)
        for (let x = 0; x <= 5; x++)
          for (let z = 1; z <= 3; z++) {
            const rim = x === 0 || x === 5 || z === 1 || z === 3;
            if (!rim) continue;
            if (y === 6 && (x === 0 || x === 5)) continue; // tapered top
            m.set(x, y, z, (x + y) % 2 ? C.lampshade : C.paint_cream);
          }
      m.box(1, 3, 1, 4, 3, 3, C.fabric_mustard); // trim band
      m.box(1, 3, 2, 4, 3, 2, 0);
      return {
        model: m,
        parts: [
          part("bulb", blob(2, 2, 1, C.lamp_warm), [3, 4.5, 2.5], "flicker", {
            speed: 3,
            amplitude: 0.08,
            power: true,
          }),
        ],
      };
    },
  ),
  rich("hanging_plant", { solid: false, wall: true, elevation: 3.5, scale: S }, () => {
    const m = new Model(8, 12, 4);
    m.box(3, 10, 0, 4, 11, 0, C.metal_dark); // bracket
    m.box(3, 11, 1, 4, 11, 2, C.metal_dark);
    m.set(3, 10, 2, C.steel).set(3, 9, 2, C.steel); // chain
    m.cyl(3.5, 2, 2.2, 6, 8, C.pot).cyl(3.5, 2, 1.4, 8, 8, C.soil);
    m.ring(3.5, 2, 2.2, 8, C.paint_brick);
    vine(m, 1, 7, 3, 7, "hp1");
    vine(m, 6, 7, 3, 5, "hp2");
    m.set(2, 9, 2, C.leaf_light).set(5, 9, 1, C.plant_green).set(4, 9, 3, C.leaf_dark);
    const tendril = new Model(3, 6, 1);
    vine(tendril, 1, 5, 0, 6, "hp3");
    return {
      model: m,
      parts: [
        part("tendril", tendril, [4, 6, 3.5], "sway", {
          speed: 0.25,
          amplitude: 0.12,
          pivot: [1.5, 6, 0.5],
        }),
      ],
    };
  }),
  fine("wall_shelf", { solid: false, wall: true, elevation: 2.5 }, () => {
    const m = new Model(16, 9, 4);
    m.box(0, 1, 0, 15, 1, 3, C.oak); // plank
    for (const x of [2, 13]) m.box(x, 0, 0, x, 0, 1, C.metal_dark); // brackets
    books(m, 1, 5, 2, 5, 1, 3, 71);
    m.box(7, 2, 1, 8, 4, 2, C.glass_amber).box(7, 5, 1, 8, 5, 2, C.cardboard); // jar
    m.box(10, 2, 2, 10, 3, 2, C.glass_green).set(10, 4, 2, C.wood); // corked bottle
    m.cyl(13, 2, 1.2, 2, 3, C.pot).set(13, 4, 2, C.leaf_light).set(12, 5, 2, C.plant_green);
    m.set(14, 4, 1, C.leaf_dark).set(13, 5, 1, C.leaf_light).set(14, 5, 3, C.leaf_yellow);
    m.set(4, 1, 3, C.paper).set(4, 0, 3, C.paper); // dangling bookmark
    return m;
  }),
  rich("fuse_box", { solid: false, wall: true, elevation: 1.5, scale: S }, () => {
    const m = new Model(8, 12, 3);
    m.box(0, 0, 0, 7, 9, 1, C.paint_gray);
    m.box(0, 9, 0, 7, 9, 1, C.steel_dark);
    m.box(3, 10, 0, 4, 11, 0, C.metal_dark); // conduit up
    m.box(1, 1, 2, 6, 8, 2, C.steel); // door
    for (let y = 2; y <= 6; y += 2)
      for (let x = 2; x <= 5; x++) m.set(x, y, 2, (x + y) % 3 ? C.paint_black : C.paint_white);
    m.box(1, 7, 2, 3, 8, 2, C.safety_yellow).set(2, 7, 2, C.hazard_black); // high-voltage tag
    m.set(6, 4, 2, C.chrome); // latch
    m.set(5, 8, 2, C.paper);
    return {
      model: m,
      parts: [
        part("led", blob(1, 1, 1, C.led_green), [5.5, 7.5, 2.5], "blink", {
          speed: 0.7,
          amplitude: 0.6,
          power: true,
        }),
      ],
    };
  }),
  fine("radiator", { solid: false, wall: true, elevation: 0.25 }, () => {
    const m = new Model(18, 10, 4);
    for (let x = 1; x <= 16; x++) {
      const fin = x % 2 === 1;
      m.box(x, 1, 1, x, 8, fin ? 3 : 2, fin ? C.paint_white : C.paint_cream);
    }
    m.box(0, 1, 1, 17, 1, 2, C.paint_white).box(0, 8, 1, 17, 8, 2, C.paint_white);
    m.box(0, 0, 1, 0, 1, 1, C.copper).box(17, 0, 1, 17, 1, 1, C.copper); // feed pipes
    m.box(16, 8, 3, 17, 9, 3, C.chrome).set(17, 9, 2, C.red_paint); // valve
    for (let x = 2; x <= 15; x += 5) m.set(x, 4, 3, C.iron_rust); // rust drips
    m.set(9, 1, 3, C.dust).set(4, 8, 3, C.dust);
    m.box(6, 9, 1, 9, 9, 3, C.fabric_gray); // sock drying on top
    return m;
  }),
  fine("wall_phone", { solid: false, wall: true, elevation: 2 }, () => {
    const m = new Model(6, 10, 4);
    m.box(0, 2, 0, 5, 9, 1, C.paint_cream);
    m.box(1, 3, 2, 4, 5, 2, C.paint_gray);
    for (let y = 3; y <= 5; y++) for (let x = 1; x <= 4; x += 3) m.set(x, y, 2, C.paint_black);
    m.box(0, 6, 2, 1, 9, 3, C.paint_cream).box(0, 7, 3, 0, 8, 3, C.paint_black); // handset
    for (let y = 0; y <= 5; y++) m.set(y % 2 ? 1 : 0, y, 2, C.cable_black); // coiled cord
    m.box(3, 7, 2, 5, 8, 2, C.paper_yellow).set(4, 8, 2, C.paint_black); // extension list
    return m;
  }),

  // ── Floor clutter (non-solid) ──
  fine("cardboard_boxes", { solid: false }, () => {
    const m = new Model(10, 8, 8);
    m.box(0, 0, 0, 5, 4, 5, C.cardboard);
    m.box(1, 4, 1, 4, 4, 4, 0).box(1, 3, 1, 4, 3, 4, C.paper); // open, full of paper
    m.box(0, 5, 0, 0, 6, 5, C.cardboard); // flap
    m.box(0, 2, 5, 5, 2, 5, C.cable_yellow); // tape
    m.box(5, 0, 3, 9, 3, 7, C.book_brown);
    m.box(5, 3, 3, 9, 3, 7, C.cardboard).box(7, 3, 3, 7, 3, 7, C.cable_yellow);
    m.box(6, 1, 7, 8, 2, 7, C.paper).set(7, 1, 7, C.paint_black); // label
    m.set(3, 5, 3, C.paper).set(2, 5, 2, C.paper_yellow).set(9, 0, 0, C.paper);
    return m;
  }),
  rich("mop_bucket", { solid: false, scale: S }, () => {
    const m = new Model(8, 18, 6);
    m.cyl(3, 3, 2.6, 0, 4, C.safety_yellow, true);
    m.cyl(3, 3, 1.8, 3, 3, C.water);
    m.box(0, 5, 3, 6, 5, 3, C.metal_dark); // handle
    m.box(4, 3, 1, 4, 17, 1, C.wood_light); // mop stick leaning
    m.box(3, 2, 0, 5, 3, 2, C.coat_shadow); // mop head in the water
    for (let x = 0; x < 8; x++) if (x % 3) m.set(x, 0, 5, C.water); // splash
    m.set(7, 0, 4, C.water);
    return {
      model: m,
      parts: drips("drip", [5.5, 2.5, 2.5], 2, 1, C.water, 0.7),
    };
  }),
  fine("wet_floor_sign", { solid: false }, () => {
    const m = new Model(6, 12, 5);
    for (let y = 0; y < 12; y++) {
      const o = Math.floor((11 - y) / 5);
      m.box(0, y, o, 5, y, o, C.safety_yellow);
      m.box(0, y, 4 - o, 5, y, 4 - o, C.safety_yellow);
    }
    m.box(1, 11, 2, 4, 11, 2, C.safety_yellow);
    m.box(2, 5, 4, 3, 8, 4, C.hazard_black).set(3, 5, 4, C.safety_yellow); // stick figure
    m.box(1, 2, 4, 4, 2, 4, C.hazard_black);
    return m;
  }),
  fine("boots_pair", { solid: false }, () => {
    const m = new Model(7, 5, 6);
    for (const x of [0, 4]) {
      m.box(x, 0, 0, x + 2, 0, 5, C.rubber);
      m.box(x, 1, 0, x + 2, 4, 2, C.leather);
      m.box(x, 1, 3, x + 2, 2, 5, C.leather);
      m.box(x, 4, 0, x + 2, 4, 2, C.leather_black);
      m.set(x + 1, 3, 3, C.cable_black); // laces
    }
    m.set(3, 0, 2, C.soil).set(1, 0, 5, C.soil);
    return m;
  }),
  fine("laundry_pile", { solid: false }, () => {
    const m = new Model(10, 4, 8);
    const cols = [C.fabric_blue, C.fabric_gray, C.coat_white, C.fabric_red, C.jeans];
    for (let z = 0; z < 8; z++)
      for (let x = 0; x < 10; x++) {
        const d = Math.hypot((x - 4.5) / 5, (z - 3.5) / 4);
        if (d > 1) continue;
        const h = Math.round((1 - d) * 3.4);
        const k = fnv1a(`laundry${x},${z}`);
        for (let y = 0; y <= h; y++) m.set(x, y, z, cols[(k + y) % cols.length]!);
      }
    m.box(7, 0, 6, 9, 0, 7, C.fabric_gray).set(0, 0, 3, C.paint_white); // sock, stray shirt
    return m;
  }),
  fine("bin_bags", { solid: false }, () => {
    const m = new Model(10, 7, 7);
    m.sphere(3, 2.5, 3.5, 3, C.paint_black).sphere(7, 2, 3, 2.4, C.leather_black);
    m.box(0, 0, 0, 9, 0, 6, 0).box(0, 0, 1, 9, 0, 5, C.paint_black); // flat bottoms
    m.set(3, 6, 3, C.cable_yellow).set(7, 5, 3, C.cable_red); // ties
    m.set(5, 1, 6, C.paper).set(9, 0, 6, C.cardboard); // spilled
    return m;
  }),
  rich("extension_cord", { solid: false, scale: S }, () => {
    const m = new Model(12, 2, 6);
    m.box(2, 0, 2, 9, 0, 3, C.paint_white);
    for (let x = 3; x <= 8; x += 2) m.set(x, 1, 2, C.paint_black);
    m.box(3, 1, 3, 4, 1, 3, C.paint_black).box(7, 1, 3, 8, 1, 3, C.cable_black); // plugs
    for (let x = 0; x < 12; x++) {
      const z = x < 2 ? 1 : 5 - (x % 2);
      if (x < 2 || x > 9) m.set(x, 0, z, C.cable_black);
    }
    m.box(4, 0, 4, 4, 0, 5, C.cable_black).box(8, 0, 4, 11, 0, 4, C.cable_black);
    return {
      model: m,
      parts: [
        part("switch", blob(1, 1, 1, C.led_red), [9.5, 1.5, 2.5], "blink", {
          speed: 0.3,
          amplitude: 0.85,
          power: true,
        }),
      ],
    };
  }),

  // ── Floor furniture (solid) ──
  rich("vending_machine", { solid: true, scale: S, light: L([6, 16, 10], "#cfe8ff", 3, 5) }, () => {
    const W = 12;
    const H = 28;
    const D = 10;
    const m = new Model(W, H, D);
    // Shell only (the inside is never seen).
    m.box(0, 0, 0, W - 1, H - 1, 0, C.safety_red);
    m.box(0, 0, 0, 0, H - 1, D - 1, C.safety_red).box(
      W - 1,
      0,
      0,
      W - 1,
      H - 1,
      D - 1,
      C.safety_red,
    );
    m.box(0, H - 1, 0, W - 1, H - 1, D - 1, C.paint_black);
    m.box(0, 0, 0, W - 1, 0, D - 1, C.paint_black);
    m.box(1, 1, D - 1, W - 2, H - 2, D - 1, C.paint_black);
    // Glass front with product rows.
    for (let row = 0; row < 5; row++) {
      const y = 10 + row * 3;
      m.box(1, y - 1, D - 2, 7, y - 1, D - 2, C.steel_dark); // shelf
      for (let x = 1; x <= 7; x++) {
        const c = CANS[(x + row * 2) % CANS.length]!;
        m.box(x, y, D - 2, x, y + 1, D - 2, (x + row) % 5 === 0 ? C.metal_dark : c);
      }
    }
    m.box(1, 9, D - 1, 7, 25, D - 1, 0);
    m.box(1, 9, D - 1, 7, 9, D - 1, C.glass);
    m.box(1, 25, D - 1, 7, 25, D - 1, C.glass);
    // Side panel: keypad, coin slot, display, card reader.
    m.box(8, 10, D - 1, 10, 25, D - 1, C.paint_gray);
    m.box(8, 22, D - 1, 10, 23, D - 1, C.screen_green);
    for (let y = 15; y <= 20; y += 2) for (let x = 8; x <= 10; x += 2) m.set(x, y, D - 1, C.steel);
    m.set(9, 13, D - 1, C.black).set(9, 11, D - 1, C.chrome);
    // Delivery flap, kick plate, a sticker, the brand header.
    m.box(1, 3, D - 1, 7, 6, D - 1, C.metal_dark).box(2, 5, D - 1, 6, 5, D - 1, C.black);
    m.box(1, 1, D - 1, W - 2, 1, D - 1, C.hazard_black);
    m.box(1, 26, D - 1, W - 2, 26, D - 1, C.paint_white);
    m.set(10, 3, D - 1, C.paper_pink);
    // Back: ventilation grille and the mains cord.
    for (let y = 3; y < 24; y += 2) m.box(2, y, 0, 9, y, 0, C.metal_dark);
    m.box(10, 0, 0, 10, 4, 0, C.cable_black);
    return {
      model: m,
      parts: [
        part("tube", blob(7, 1, 1, C.lamp_cold), [4.5, 26.5, D - 0.5], "flicker", {
          speed: 5,
          amplitude: 0.35,
          power: true,
        }),
        part("coin_led", blob(1, 1, 1, C.led_amber), [9.5, 12.5, D - 0.5], "blink", {
          speed: 0.8,
          amplitude: 0.5,
          power: true,
        }),
      ],
    };
  }),
  rich("space_heater", { solid: true, scale: S, light: L([4, 6, 5], "#ff7a1a", 2, 3) }, () => {
    const m = new Model(8, 12, 5);
    m.box(0, 1, 0, 7, 10, 4, C.paint_cream);
    m.box(1, 0, 1, 1, 0, 3, C.metal_dark).box(6, 0, 1, 6, 0, 3, C.metal_dark); // feet
    m.box(1, 3, 4, 6, 8, 4, 0).box(1, 3, 3, 6, 8, 3, C.metal_dark); // grille well
    for (let x = 1; x <= 6; x += 2) m.box(x, 3, 4, x, 8, 4, C.chrome);
    m.box(2, 11, 1, 5, 11, 3, C.metal_dark); // handle
    m.set(6, 9, 4, C.paint_black).set(1, 9, 4, C.led_amber);
    m.box(7, 1, 0, 7, 3, 0, C.cable_black);
    const coil = new Model(6, 6, 1);
    for (let y = 0; y < 6; y += 2) coil.box(0, y, 0, 5, y, 0, C.plasma);
    return {
      model: m,
      parts: [
        part("coil", coil, [4, 6, 3.5], "pulse", { speed: 0.4, amplitude: 0.45, power: true }),
      ],
    };
  }),
  rich("coat_rack", { solid: true, scale: S }, () => {
    const m = new Model(8, 26, 8);
    m.box(3, 0, 3, 4, 25, 4, C.walnut);
    for (const [x, z] of [
      [0, 3],
      [7, 4],
      [3, 0],
      [4, 7],
    ] as const)
      m.box(Math.min(x, 3), 0, Math.min(z, 3), Math.max(x, 4), 0, Math.max(z, 4), C.walnut);
    for (const [x, z] of [
      [1, 3],
      [6, 4],
      [3, 1],
      [4, 6],
    ] as const)
      m.set(x, 24, z, C.brass);
    // Lab coat hanging from one hook, a hat on top.
    m.box(1, 12, 5, 6, 22, 6, C.coat_white).box(2, 12, 7, 5, 21, 7, C.coat_shadow);
    m.set(3, 20, 7, C.badge_blue).set(2, 16, 7, C.paint_black);
    m.cyl(3.5, 3.5, 2.2, 25, 25, C.fabric_gray);
    const scarf = new Model(2, 9, 1).box(0, 0, 0, 1, 8, 0, C.scarf_red);
    scarf.set(0, 0, 0, C.fabric_mustard).set(1, 0, 0, C.fabric_mustard);
    return {
      model: m,
      parts: [
        part("scarf", scarf, [0.5, 19, 3.5], "sway", {
          speed: 0.2,
          amplitude: 0.06,
          axis: "x",
          pivot: [1, 9, 0.5],
        }),
      ],
    };
  }),

  // ── Desk-top trinkets ──
  fine("desk_succulent", SMALL, () => {
    const m = new Model(4, 5, 4);
    m.cyl(1.5, 1.5, 1.6, 0, 1, C.paint_teal).cyl(1.5, 1.5, 0.9, 1, 1, C.soil);
    m.set(1, 2, 1, C.leaf_light).set(2, 2, 2, C.leaf_light).set(1, 2, 2, C.plant_green);
    m.set(2, 2, 1, C.plant_green).set(0, 2, 1, C.leaf_dark).set(3, 2, 2, C.leaf_dark);
    m.set(1, 3, 1, C.leaf_light).set(2, 3, 2, C.plant_green).set(1, 4, 2, C.flower_red);
    return m;
  }),
  fine("stapler", SMALL, () => {
    const m = new Model(4, 2, 2);
    m.box(0, 0, 0, 3, 0, 1, C.paint_black);
    m.box(0, 1, 0, 3, 1, 1, C.safety_red).set(3, 1, 1, C.chrome);
    return m;
  }),
  fine("sticky_notes", SMALL, () => {
    const m = new Model(5, 2, 4);
    m.box(0, 0, 0, 2, 1, 2, C.paper_yellow).set(1, 1, 1, C.blue_paint);
    m.box(3, 0, 1, 4, 0, 3, C.paper_pink).set(3, 0, 3, C.paper_blue);
    m.box(0, 0, 3, 3, 0, 3, C.brass); // pencil
    return m;
  }),
  fine("thermos", SMALL, () => {
    const m = new Model(3, 6, 3);
    m.cyl(1, 1, 1.2, 0, 4, C.green_paint).ring(1, 1, 1.2, 2, C.steel);
    m.cyl(1, 1, 1, 5, 5, C.steel).set(1, 5, 1, C.paint_black);
    m.set(2, 3, 1, C.paper); // label
    return m;
  }),
  fine("desk_clock", SMALL, () => {
    const m = new Model(4, 4, 2);
    m.box(0, 0, 0, 3, 3, 1, C.wood_dark);
    disc(m, 1.5, 1.8, 1.2, 1, C.paper);
    m.set(1, 2, 1, C.black).set(2, 1, 1, C.black).set(1, 1, 1, C.black);
    return m;
  }),
];

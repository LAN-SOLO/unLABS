/**
 * Biorhythm stations — voxel models (pure, no three).
 * ====================================================
 *
 * Food Replicator and Neutro-Fridge (Kitchen & Canteen), Jade's bed and the
 * ergometer (Jade's Quarters). They are placed as map props with a
 * `variant` (see `PROP_VARIANT_DECOR`), which the engine meshes at
 * MODEL_SCALE (0.5), so these are classic half-scale models whose
 * footprints stay inside the fallback prop model used by the walkability
 * test (replicator ≤ console 12×8, fridge ≤ rack 8×6, ergometer ≤ bench
 * 14×8, bed = sofa 14×7). Front = +z, bottom-centre = placement point.
 * Moving bits (print beam, cooling pulse, flywheel, crank) are anim parts;
 * no lights of their own (prop variants never add lamps — the room's
 * pooled VirtualLights do the work).
 */
import { tr } from "@/lib/i18n";
import { C } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import { blob, disc, part, rich, screenWell, type DecorDef } from "@/lib/world/models/decor-kit";
import type { AnimPart } from "@/lib/world/models/anim";

export const BIO_DECOR: DecorDef[] = [
  rich("food_replicator", { solid: true }, () => {
    const m = new Model(10, 13, 6);
    // Cabinet: brushed steel, dark plinth, rounded top cap.
    m.box(0, 0, 0, 9, 12, 5, C.steel);
    m.box(0, 0, 0, 9, 0, 5, C.black);
    m.box(0, 12, 0, 9, 12, 5, C.steel_dark);
    m.box(1, 12, 1, 8, 12, 4, C.aluminium);
    // Side trims in kitchen green, a vent grille on the right side.
    m.box(0, 1, 5, 0, 11, 5, C.paint_mint).box(9, 1, 5, 9, 11, 5, C.paint_mint);
    for (let y = 3; y <= 9; y += 2) m.box(9, y, 1, 9, y, 3, C.black);
    // Screen with the menu.
    const screen = screenWell(m, 2, 8, 7, 10, 5, {
      content: "text",
      text: tr("screen::FOOD"),
      color: "#7CFFB2",
    });
    // Dispense niche: dark hollow with a glowing print plate.
    m.box(2, 2, 5, 7, 6, 5, C.metal_dark);
    m.box(3, 3, 3, 6, 5, 5, 0);
    m.box(3, 2, 3, 6, 2, 5, C.glass_green);
    // Three recipe buttons (bar, water, shake) and a drip tray.
    m.set(2, 7, 5, C.safety_orange).set(4, 7, 5, C.safety_blue).set(6, 7, 5, C.safety_yellow);
    m.set(8, 7, 5, C.led_green);
    m.box(2, 1, 5, 7, 1, 5, C.chrome);
    // Back: service hatch, water line, a warning label.
    m.box(2, 3, 0, 7, 9, 0, C.steel_dark).set(4, 6, 0, C.chrome);
    m.box(8, 0, 0, 8, 10, 0, C.water);
    m.box(1, 10, 0, 3, 11, 0, C.paper_yellow);
    const parts: AnimPart[] = [
      // Print beam: a thin green line pulsing over the plate.
      part("beam", blob(4, 1, 1, C.screen_green), [5, 4.5, 4], "pulse", {
        speed: 0.9,
        amplitude: 0.8,
        power: true,
      }),
      part("ready", blob(1, 1, 1, C.led_green), [8.5, 7.5, 5.5], "blink", {
        speed: 1.2,
        amplitude: 0.5,
        power: true,
      }),
    ];
    return { model: m, screens: [screen], parts };
  }),

  rich("neutro_fridge", { solid: true }, () => {
    const m = new Model(8, 14, 6);
    // Tall white body with a cyan cooling seam, split freezer door.
    m.box(0, 1, 0, 7, 13, 5, C.paint_white);
    m.box(0, 0, 0, 7, 0, 5, C.steel_dark);
    m.box(0, 13, 0, 7, 13, 5, C.aluminium);
    m.box(0, 9, 5, 7, 9, 5, C.paint_gray); // freezer split
    m.box(6, 2, 5, 6, 7, 5, C.chrome).box(6, 10, 5, 6, 12, 5, C.chrome); // handles
    // Window: two bottles and a bar on the shelf.
    m.box(1, 3, 5, 4, 7, 5, C.glass_dark);
    m.set(1, 4, 5, C.water).set(1, 5, 5, C.water).set(2, 4, 5, C.liquid_blue);
    m.set(3, 4, 5, C.safety_orange).set(4, 6, 5, C.paper);
    m.box(1, 5, 5, 4, 5, 5, C.glass).set(2, 6, 5, C.liquid_pink);
    // "N" logo in cyan on the freezer door.
    m.box(1, 10, 5, 1, 12, 5, C.crystal_cyan).box(3, 10, 5, 3, 12, 5, C.crystal_cyan);
    m.set(2, 11, 5, C.crystal_cyan);
    // Back: condenser grid, cord.
    for (let y = 2; y <= 12; y += 2) m.box(1, y, 0, 6, y, 0, C.black);
    m.box(7, 0, 0, 7, 3, 0, C.cable_black);
    const screen = screenWell(m, 5, 11, 5, 11, 5, { content: "bars", color: "#7FD4FF" });
    const parts: AnimPart[] = [
      // Neutrino cooling: the side seam glows in slow breaths.
      part("seam", blob(1, 11, 1, C.holo_cyan), [0.5, 7, 5.5], "pulse", {
        speed: 0.25,
        amplitude: 0.6,
        power: true,
      }),
      part("led", blob(1, 1, 1, C.led_blue), [7.5, 13.5, 3], "blink", {
        speed: 0.5,
        amplitude: 0.3,
        power: true,
      }),
    ];
    return { model: m, screens: [screen], parts };
  }),

  rich("ergometer", { solid: true }, () => {
    const m = new Model(12, 10, 6);
    // Floor rails and feet.
    m.box(1, 0, 1, 10, 0, 1, C.steel_dark).box(1, 0, 4, 10, 0, 4, C.steel_dark);
    m.box(1, 0, 1, 1, 0, 4, C.rubber).box(10, 0, 1, 10, 0, 4, C.rubber);
    // Main frame: flywheel housing at the front (x 1..5), seat post at the back.
    m.box(2, 1, 2, 5, 2, 3, C.safety_red);
    m.box(5, 1, 2, 8, 1, 3, C.safety_red);
    m.box(8, 1, 2, 9, 6, 3, C.safety_red); // seat post
    m.box(7, 7, 1, 10, 7, 4, C.leather_black); // saddle
    m.box(8, 7, 2, 9, 7, 3, C.leather);
    // Handlebar column with the display.
    m.box(2, 3, 2, 3, 8, 3, C.safety_red);
    m.box(1, 9, 0, 4, 9, 5, C.chrome);
    m.set(1, 9, 0, C.rubber).set(1, 9, 5, C.rubber);
    m.box(2, 8, 4, 3, 8, 5, C.black).set(2, 8, 5, C.screen_green); // mini display
    // Water bottle in its cage.
    m.box(6, 3, 4, 6, 5, 4, C.water).set(6, 6, 4, C.paint_white);
    // Flywheel (upright, spins around z) and the pedal crank.
    const wheel = new Model(5, 5, 1);
    disc(wheel, 2, 2, 2.2, 0, C.chrome);
    wheel.set(2, 2, 0, C.black).set(0, 2, 0, C.safety_red).set(4, 2, 0, C.safety_red);
    const crank = new Model(1, 5, 1);
    crank.box(0, 0, 0, 0, 4, 0, C.metal_dark);
    crank.set(0, 0, 0, C.black).set(0, 4, 0, C.black);
    const parts: AnimPart[] = [
      part("flywheel", wheel, [3.5, 3.5, 4.5], "spin", { speed: 1.2, axis: "z" }),
      part("crank", crank, [6.5, 3.5, 4.6], "spin", { speed: 0.6, axis: "z", phase: 1 }),
      part("display", blob(1, 1, 1, C.led_green), [3.5, 8.5, 5.5], "blink", {
        speed: 0.8,
        amplitude: 0.6,
        power: true,
      }),
    ];
    return { model: m, parts };
  }),

  rich("jade_bed", { solid: true }, () => {
    // A proper single bed: oak frame, headboard, a made duvet (blue, her
    // colour), pillow — and one notebook on the blanket.
    const m = new Model(14, 6, 7);
    for (const [x, z] of [
      [0, 0],
      [13, 0],
      [0, 6],
      [13, 6],
    ] as const)
      m.set(x, 0, z, C.walnut);
    m.box(0, 1, 0, 13, 1, 6, C.oak);
    m.box(0, 1, 0, 0, 5, 6, C.oak); // headboard
    m.box(0, 5, 1, 0, 5, 5, C.walnut);
    m.box(13, 1, 0, 13, 3, 6, C.oak); // footboard
    m.box(1, 2, 0, 12, 2, 6, C.paint_white); // mattress
    m.box(1, 3, 1, 3, 3, 5, C.paint_white); // pillow
    m.box(2, 3, 2, 2, 3, 4, C.coat_shadow);
    m.box(4, 3, 0, 12, 3, 6, C.fabric_blue); // duvet
    m.box(4, 3, 0, 4, 3, 6, C.carpet_blue); // folded edge
    for (let x = 6; x <= 12; x += 3) m.box(x, 3, 0, x, 3, 6, C.fabric_blue_shade);
    m.box(8, 4, 2, 9, 4, 3, C.book_blue).set(9, 4, 3, C.paper); // notebook
    return { model: m };
  }),
];

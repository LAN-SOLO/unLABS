/**
 * Damien's Sound Studio — furniture (pure, no three).
 * ===================================================
 *
 * - `mixing_console` — the studio's heart: a long desk with fader rows,
 *   knobs, a meter bridge whose screen shows a live spectrum and two blinking
 *   VU LEDs. Placed as the map prop `studio_console` (variant of the same
 *   name, see `PROP_VARIANT_DECOR`), so it stays a classic half-scale model
 *   whose footprint fits the fallback `desk` prop model (14 × 8).
 *
 * The rest of the room reuses the audio decor (speaker walls, tape
 * machines, synth, acoustic panels, vinyl crates — content/interior.ts).
 */
import { C } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import { blob, part, rich, screenWell, type DecorDef } from "@/lib/world/models/decor-kit";

export const STUDIO_DECOR: DecorDef[] = [
  rich("mixing_console", { solid: true }, () => {
    const m = new Model(14, 10, 8);
    // Body: dark steel desk on a walnut plinth.
    m.box(0, 0, 0, 13, 0, 7, C.walnut);
    m.box(0, 1, 0, 13, 4, 7, C.steel_dark);
    // Work surface (front half) with channel strips: faders, knobs, mute LEDs.
    m.box(0, 5, 3, 13, 5, 7, C.paint_black);
    for (let x = 1; x <= 12; x++) {
      const cap = x % 4 === 0 ? C.red_paint : x % 3 === 0 ? C.safety_yellow : C.paint_white;
      m.set(x, 6, 4 + (x % 3), cap); // fader caps at different heights (positions)
      m.set(x, 5, 3, x % 2 ? C.led_green : C.led_amber);
    }
    m.box(0, 5, 7, 13, 5, 7, C.walnut); // arm rest
    // Meter bridge (back half), rising to a screen facing the engineer (+z).
    m.box(0, 5, 0, 13, 8, 2, C.steel_dark);
    const meters = screenWell(m, 2, 6, 11, 8, 3, {
      content: "spectrum",
      color: "#9CFFB0",
      bezel: C.paint_black,
    });
    // Near-field monitors on the bridge ends.
    m.box(0, 9, 0, 1, 9, 1, C.paint_black).box(12, 9, 0, 13, 9, 1, C.paint_black);
    m.set(0, 9, 1, C.metal_light).set(13, 9, 1, C.metal_light);
    // Tape of track names along the bridge, a coffee ring, headphones hanging on the side.
    m.box(2, 5, 2, 11, 5, 2, C.paper);
    m.set(13, 3, 7, C.cable_black).set(13, 2, 7, C.paint_black);
    const parts = [
      part("vu_l", blob(1, 1, 1, C.led_green), [1.5, 7.5, 2.8], "blink", {
        speed: 5.3,
        amplitude: 0.6,
        power: true,
      }),
      part("vu_r", blob(1, 1, 1, C.led_amber), [12.5, 7.5, 2.8], "blink", {
        speed: 4.1,
        amplitude: 0.6,
        power: true,
      }),
    ];
    return { model: m, screens: [meters], parts };
  }),
];

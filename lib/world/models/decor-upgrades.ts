/**
 * Double-detail replacements for classic half-scale decor (pure).
 * ================================================================
 *
 * These pieces used to be half-scale models in `decor.ts`. World size,
 * wall mounting, elevation and solidity are unchanged — every dimension
 * is simply doubled at DETAIL_SCALE — so placements, footprints and
 * walkability do not move; only the fidelity goes up (and a few pieces
 * gain animated parts).
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model } from "@/lib/world/models/core";
import {
  blob,
  disc,
  fine,
  part,
  rich,
  DETAIL_SCALE as S,
  type DecorDef,
} from "@/lib/world/models/decor-kit";

export const DECOR_UPGRADES: DecorDef[] = [
  fine("fire_extinguisher", { solid: false, wall: true, elevation: 1 }, () => {
    const m = new Model(6, 14, 4);
    // Wall bracket and the red cylinder with a rounded shoulder.
    m.box(1, 0, 0, 4, 13, 0, C.paint_white);
    m.box(1, 3, 1, 4, 3, 1, C.metal_dark).box(1, 8, 1, 4, 8, 1, C.metal_dark); // straps
    m.box(1, 0, 1, 4, 9, 3, C.safety_red);
    m.box(2, 10, 1, 3, 10, 3, C.safety_red).box(1, 10, 2, 4, 10, 2, C.safety_red);
    m.box(1, 0, 1, 4, 0, 3, C.red_paint); // foot ring
    m.box(2, 4, 3, 3, 6, 3, C.paper).set(2, 5, 3, C.hazard_black).set(3, 6, 3, C.safety_green);
    // Valve head: chrome handle, gauge, yellow safety pin with its tag.
    m.box(2, 11, 2, 3, 11, 2, C.metal_dark);
    m.box(1, 12, 2, 4, 12, 2, C.chrome).set(4, 13, 2, C.chrome);
    m.set(2, 11, 3, C.paint_white).set(3, 11, 3, C.led_green); // gauge
    m.set(1, 11, 3, C.safety_yellow).set(0, 10, 3, C.safety_yellow);
    // Black hose looping down the side into a nozzle clip.
    m.box(0, 11, 2, 0, 12, 2, C.rubber).box(0, 3, 2, 0, 10, 2, C.rubber);
    m.box(5, 2, 2, 5, 4, 2, C.rubber).box(5, 1, 1, 5, 2, 1, C.metal_dark);
    m.set(0, 2, 2, C.rubber).set(1, 1, 3, C.rubber);
    return m;
  }),
  fine("rug", { solid: false }, () => {
    // Worn kilim: border, stepped diamonds, fringe tassels on the short ends.
    const m = new Model(28, 1, 20);
    for (let z = 0; z < 20; z++)
      for (let x = 0; x < 28; x++) {
        const bx = Math.min(x, 27 - x);
        const bz = Math.min(z, 19 - z);
        const b = Math.min(bx, bz);
        let c: number = C.fabric_red;
        if (x === 0 || x === 27) c = (z & 1) === 0 ? C.paper : 0;
        else if (b <= 1) c = C.carpet_red;
        else if (b === 2) c = (x + z) % 4 < 2 ? C.fabric_mustard : C.carpet_red;
        else if (b === 3) c = C.carpet_red;
        else {
          const dx = Math.abs(x - 13.5);
          const dz = Math.abs(z - 9.5);
          const d = Math.round(dx * 0.7 + dz);
          if (d % 5 === 0) c = C.fabric_mustard;
          else if (d % 5 === 2) c = C.paint_navy;
          else if (d < 2) c = C.paper;
        }
        if (!c) continue;
        // Wear: the centre is thin, a coffee stain in one corner.
        const h = fnv1a(`rug${x},${z}`);
        if (b > 3 && Math.abs(x - 14) < 6 && Math.abs(z - 10) < 4 && h % 5 === 0)
          c = C.fabric_red_shade;
        m.set(x, 0, z, c);
      }
    m.box(21, 0, 4, 22, 0, 5, C.coffee).set(23, 0, 5, C.coffee);
    return m;
  }),
  fine("floor_cables", { solid: false }, () => {
    // A flat bundle of cables snaking across the floor (stays a 1-voxel
    // decal): cable ties, a coupler with a status LED, gaffer tape.
    const m = new Model(24, 1, 8);
    const run = (phase: number, amp: number, c: number) => {
      for (let x = 0; x < 24; x++) {
        const z = Math.round(3.5 + Math.sin(x * 0.35 + phase) * amp);
        m.set(x, 0, Math.max(0, Math.min(7, z)), c);
      }
    };
    run(0, 2.4, C.cable_black);
    run(1.2, 2, C.cable_red);
    run(2.1, 2.8, C.cable_yellow);
    run(3.3, 1.6, C.cable_black);
    for (const x of [5, 17]) m.box(x, 0, 2, x, 0, 5, C.paint_black); // cable ties
    m.box(10, 0, 2, 13, 0, 5, C.metal_dark).box(11, 0, 3, 12, 0, 4, C.steel); // coupler
    m.set(12, 0, 3, C.led_green);
    m.box(20, 0, 0, 22, 0, 7, C.fabric_gray); // gaffer tape
    return m;
  }),
  fine("paper_pile", { solid: false }, () => {
    const m = new Model(12, 3, 10);
    const sheet = (x0: number, z0: number, y: number, c: number, lines: boolean) => {
      m.box(x0, y, z0, x0 + 4, y, z0 + 5, c);
      if (lines)
        for (let z = z0 + 1; z <= z0 + 4; z += 2) m.box(x0 + 1, y, z, x0 + 3, y, z, C.paint_gray);
    };
    sheet(0, 0, 0, C.paper, true);
    sheet(5, 2, 0, C.paper_yellow, false);
    sheet(2, 4, 0, C.paper, true);
    sheet(1, 1, 1, C.paper, true);
    sheet(6, 4, 1, C.paper_blue, false);
    m.box(3, 2, 2, 5, 2, 3, C.paper).set(4, 2, 3, C.red_paint); // crumpled note
    m.box(9, 0, 8, 11, 0, 9, C.paper).set(10, 0, 9, C.coffee); // stray page with a ring
    m.box(7, 2, 5, 9, 2, 5, C.brass); // pencil
    return m;
  }),
  rich("gauge_cluster", { solid: false, wall: true, elevation: 3, scale: S }, () => {
    const m = new Model(16, 12, 4);
    m.box(0, 0, 0, 15, 11, 0, C.metal);
    m.box(0, 11, 0, 15, 11, 1, C.steel_dark);
    for (const [x, y] of [
      [1, 11],
      [14, 11],
      [1, 0],
      [14, 0],
    ] as const)
      m.set(x, Math.min(y, 10), 1, C.chrome); // bolts
    // Three dials: chrome rim, white face, red zone, a needle part each.
    const dials = [
      [4, 7.5, 2.6],
      [11.5, 7.5, 2.6],
      [7.5, 2.8, 2],
    ] as const;
    const parts = dials.map(([cx, cy, r], i) => {
      disc(m, cx, cy, r + 0.8, 1, C.chrome);
      disc(m, cx, cy, r, 2, C.paint_white);
      m.set(Math.round(cx + r * 0.7), Math.round(cy + r * 0.5), 2, C.safety_red);
      m.set(Math.round(cx), Math.round(cy), 2, C.black);
      const needle = blob(1, Math.max(2, Math.round(r)), 1, C.black);
      return part(`needle${i}`, needle, [cx, cy, 3.5], "sway", {
        speed: 0.15 + i * 0.07,
        amplitude: 0.35,
        axis: "z",
        phase: i * 2.1,
        pivot: [0.5, 0, 0.5],
      });
    });
    // Capillary pipes down to the wall, an LED and a calibration tag.
    for (const x of [4, 11]) m.box(x, 0, 1, x, 4, 1, C.copper);
    m.set(15, 1, 1, C.led_amber);
    m.box(12, 2, 1, 14, 3, 1, C.paper_yellow);
    return { model: m, parts };
  }),
  rich("radiation_sign", { solid: false, wall: true, elevation: 3, scale: S }, () => {
    const m = new Model(10, 10, 2);
    m.box(0, 0, 0, 9, 9, 0, C.safety_yellow);
    m.box(0, 0, 0, 9, 0, 0, C.hazard_black).box(0, 9, 0, 9, 9, 0, C.hazard_black);
    m.box(0, 0, 0, 0, 9, 0, C.hazard_black).box(9, 0, 0, 9, 9, 0, C.hazard_black);
    // Trefoil: three blades around a hub.
    for (let y = 1; y < 9; y++)
      for (let x = 1; x < 9; x++) {
        const dx = x - 4.5;
        const dy = y - 5;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx) + Math.PI / 2;
        if (d < 1.1 || (d > 1.7 && d < 3.6 && Math.cos(a * 3) > 0.35))
          m.set(x, y, 1, C.hazard_black);
      }
    m.set(1, 1, 1, C.steel).set(8, 8, 1, C.steel).set(8, 1, 1, C.iron_rust); // screws
    return {
      model: m,
      parts: [
        part("warn", blob(2, 1, 1, C.led_red), [4.5, 9.5, 1.5], "blink", {
          speed: 0.5,
          amplitude: 0.5,
          power: true,
        }),
      ],
    };
  }),
];

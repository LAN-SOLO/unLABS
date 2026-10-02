/**
 * Operations decor (docs/OPS.md): the surveillance station, the moving room
 * cameras, the bot docks (service / maintenance stations), climbing vines
 * and the algae that overflow the greenhouse tanks. Voxel models only (no
 * crystal render yet — the crystal age keeps them as voxels until built).
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model } from "@/lib/world/models/core";
import type { ScreenSpec } from "@/lib/world/models/anim";
import { DETAIL_SCALE, L, part, rich, type DecorDef } from "@/lib/world/models/decor-kit";

const S = DETAIL_SCALE;

/** Pan-tilt camera head: housing, lens, red tally LED. Pivot at its mount. */
function camHead(): Model {
  const m = new Model(4, 3, 6);
  m.box(0, 0, 0, 3, 2, 5, C.paint_gray);
  m.box(0, 2, 0, 3, 2, 5, C.paint_gray_lt); // sun hood
  m.box(1, 0, 5, 2, 1, 5, C.black); // lens
  m.set(1, 1, 5, C.glass_dark).set(2, 0, 5, C.glass_dark);
  m.set(3, 2, 4, C.led_red); // tally light
  m.box(0, 0, 0, 3, 0, 0, C.metal_dark); // back plate seam
  return m;
}

/** Thin climbing vine on a wall panel (w × h), leaves on a stem path. */
function vinePanel(w: number, h: number, seed: string): Model {
  const m = new Model(w, h, 2);
  let x = Math.floor(w / 2);
  for (let y = 0; y < h; y++) {
    const k = fnv1a(`${seed}:${y}`);
    if (k % 3 === 0) x = Math.max(1, Math.min(w - 2, x + ((k >> 3) % 3) - 1));
    m.set(x, y, 0, C.wood_dark);
    // Leaves left and right of the stem, one voxel off the wall.
    if (k % 2 === 0) m.set(x - 1, y, 1, (k >> 5) % 3 ? C.plant_green : C.leaf_dark);
    if (k % 5 < 2) m.set(x + 1, y, 1, (k >> 7) % 4 ? C.leaf_light : C.plant_green);
    if (k % 7 === 0 && x + 2 < w) m.set(x + 2, y, 1, C.leaf_dark);
    // Side runners: the vine reaches sideways along the wall.
    if (k % 11 === 0)
      for (let d = 1; d < 5 && x + d < w; d++) {
        m.set(x + d, y, 0, C.wood_dark);
        if (d % 2) m.set(x + d, y + (y + 1 < h ? 1 : 0), 1, C.plant_green);
      }
  }
  return m;
}

const CAM_SCREENS = (w: number): ScreenSpec[] =>
  [0, 1, 2].map((i) => ({
    center: [Math.round(4 + i * ((w - 8) / 2)), 15, 3] as [number, number, number],
    w: 9,
    h: 6,
    normal: "+z" as const,
    content: "cams" as const,
    color: i === 1 ? "#33ff66" : "#9fd8ff",
    requiresPower: true,
  }));

/**
 * Not part of the crystal age yet (user call 2026-10-01: integrate and
 * document, no Blender render): scripts/crystal/export.ts skips these, so
 * they stay voxels after era 42. The service docks are rendered (user call
 * 2026-10-01, together with the bot upgrades).
 */
export const NOT_YET_CRYSTAL: ReadonlySet<string> = new Set([
  "security_cam",
  "surveillance_station",
  "vine_wall",
  "algae_spill",
]);

export const OPS_DECOR: DecorDef[] = [
  // ── Surveillance ──
  rich(
    "security_cam",
    { solid: false, wall: true, elevation: 6.4, scale: S, light: L([2, 1, 4], "#ff3a2a", 0.4, 2) },
    () => {
      const m = new Model(4, 4, 4);
      m.box(1, 2, 0, 2, 3, 0, C.metal_dark); // wall plate
      m.box(1, 3, 1, 2, 3, 2, C.steel); // arm
      m.box(1, 2, 2, 2, 2, 2, C.steel); // yoke
      return {
        model: m,
        parts: [
          // Slow pan across the room (yaw), the same curve the station's feed follows.
          part("head", camHead(), [2, 1.5, 3], "sway", {
            axis: "y",
            speed: 0.07,
            amplitude: 0.75,
            pivot: [2, 1.5, 1],
          }),
        ],
      };
    },
  ),
  rich(
    "surveillance_station",
    { solid: true, scale: S, light: L([14, 16, 3], "#7fd8ff", 3, 6) },
    () => {
      const w = 28;
      const m = new Model(w, 22, 10);
      // Desk with keyboard and joystick, a monitor wall above.
      m.box(0, 0, 3, w - 1, 6, 9, C.metal_dark);
      m.box(0, 7, 3, w - 1, 7, 9, C.paint_gray);
      m.box(9, 8, 6, 18, 8, 8, C.black).box(10, 8, 6, 17, 8, 7, C.paint_black_lt); // keyboard
      m.box(21, 8, 7, 21, 10, 7, C.metal_dark).set(21, 11, 7, C.led_red); // joystick
      m.box(4, 8, 7, 6, 8, 8, C.paint_black).set(5, 9, 7, C.led_green); // intercom
      m.box(0, 9, 0, w - 1, 21, 2, C.metal_dark); // monitor wall
      for (let i = 0; i < 3; i++) {
        const cx = Math.round(4 + i * ((w - 8) / 2));
        m.box(cx - 5, 11, 2, cx + 5, 19, 2, C.black); // bezels (screens sit on them)
      }
      m.box(0, 20, 2, w - 1, 21, 2, C.steel);
      for (let x = 2; x < w - 2; x += 4) m.set(x, 10, 2, (x / 4) % 2 ? C.led_green : C.led_amber);
      return { model: m, screens: CAM_SCREENS(w) };
    },
  ),

  // ── Bot service ──
  rich("service_dock", { solid: false, scale: S, light: L([6, 2, 6], "#33ff99", 1.2, 3) }, () => {
    // Floor pad with charge rails, a service arm and a status lamp.
    const m = new Model(12, 10, 12);
    m.box(0, 0, 0, 11, 0, 11, C.hazard_black);
    for (let i = 0; i < 12; i += 2) {
      m.set(i, 0, 0, C.safety_yellow).set(i, 0, 11, C.safety_yellow);
      m.set(0, 0, i, C.safety_yellow).set(11, 0, i, C.safety_yellow);
    }
    m.box(2, 1, 2, 9, 1, 9, C.steel_dark); // pad
    m.box(3, 1, 5, 8, 1, 6, C.copper); // charge rails
    m.box(10, 1, 10, 11, 9, 11, C.metal_dark); // mast
    m.box(6, 9, 10, 11, 9, 11, C.steel); // service arm
    m.box(6, 7, 10, 6, 8, 10, C.chrome); // tool head
    m.set(11, 8, 11, C.led_green); // status
    return { model: m };
  }),

  // ── Living lab ──
  rich("vine_wall", { solid: false, wall: true, elevation: 0.2, scale: S }, () => ({
    model: vinePanel(14, 30, "vine"),
  })),
  rich("algae_spill", { solid: false, scale: S }, () => {
    // Algae that overflowed a tank: a slick on the floor, clumps, a trickle.
    const m = new Model(12, 2, 10);
    for (let x = 0; x < 12; x++)
      for (let z = 0; z < 10; z++) {
        const d = Math.hypot((x - 2) * 0.8, z - 5);
        const k = fnv1a(`sp${x},${z}`);
        if (d < 4 + (k % 4)) m.set(x, 0, z, k % 3 ? C.liquid_green : C.leaf_dark);
        if (d < 3 && k % 5 === 0) m.set(x, 1, z, C.lime);
      }
    return { model: m };
  }),
];

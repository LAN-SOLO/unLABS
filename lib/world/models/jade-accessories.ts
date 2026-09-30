/**
 * Jade's wardrobe — accessories: back, neck, belt, wrist, shoulder buddy (pure).
 * ==============================================================================
 *
 * Back pieces, neck pieces and shoulder buddies are painted on the torso
 * canvas (16×16×12: back z 0, front z 9, lapels z 10, shoulders row 15, the
 * left arm hangs at x 16..21), growing it behind (-z), above (row 16+) and
 * to her left (+x). Belts go on the hips (16×6×10, front z 9, belt rows
 * 2..3), wrist pieces on the LEFT forearm (drawn in the right-arm frame,
 * x 1..4 / z 1..4 is the wrist at rows 4..5, x = 0..1 the outer side, then
 * mirrored). Glowing bits use emissive palette colours.
 */
import { C, labMaterialOf } from "@/lib/world/content/palette";
import {
  Canvas,
  hash01,
  roundEdges,
  tint,
  type LookCtx,
  type Tone,
  type Worn,
} from "@/lib/world/models/jade-kit";

// ── Back ────────────────────────────────────────────────────────

/** Straps over both shoulders and down the chest (stop above the badge). */
function shoulderStraps(k: Canvas, c: number, buckle: number): void {
  k.free(() => {
    for (const x of [3, 4, 11, 12]) {
      for (let z = -1; z <= 9; z++) k.set(x, 16, z, c);
      for (let y = 10; y <= 15; y++) k.set(x, y, 10, c);
    }
    k.box(3, 11, 11, 4, 11, 11, buckle).box(11, 11, 11, 12, 11, 11, buckle);
  });
}

export function backGear(k: Canvas, w: Worn | null): void {
  if (!w) return;
  const { main, shade, accent } = w.t;
  switch (w.id) {
    case "backpack": {
      k.free(() => {
        k.box(3, 1, -4, 12, 13, -1, main);
        roundEdges(k, 3, 12, -4, -1, 1, 13);
        // Top flap with two leather straps and buckles.
        k.box(3, 11, -5, 12, 14, -1, shade);
        roundEdges(k, 3, 12, -5, -1, 11, 14);
        for (const x of [5, 10]) {
          k.box(x, 7, -5, x, 14, -5, accent);
          k.set(x, 7, -6, C.steel);
        }
        // Front pocket with a zip, a thermos in the side pocket, a grab handle.
        k.box(5, 2, -5, 10, 6, -5, main).box(5, 6, -5, 10, 6, -5, shade);
        k.set(9, 6, -6, C.steel);
        k.cyl(1.5, -2.5, 1.2, 3, 9, C.steel).cyl(1.5, -2.5, 1.2, 10, 10, C.paint_black);
        k.box(2, 3, -4, 2, 6, -1, shade);
        k.box(6, 15, -3, 9, 15, -3, shade);
        k.set(6, 14, -3, shade).set(9, 14, -3, shade);
        for (let x = 4; x <= 11; x += 3) k.set(x, 1, -4, shade);
      });
      shoulderStraps(k, accent, C.steel);
      return;
    }
    case "oxygen_tank": {
      k.free(() => {
        k.cyl(7.5, -4.5, 2.8, 1, 13, main);
        k.cyl(7.5, -4.5, 2.1, 14, 14, main).cyl(7.5, -4.5, 1.2, 15, 15, main);
        // Label band, harness bands, the valve with a gauge and handwheel.
        k.forEach((x, y, z, v) => {
          if (v !== main || z > -2) return;
          if (y === 7 || y === 8) k.set(x, y, z, (x + y) % 3 ? C.paint_white : C.paint_black);
        });
        for (const y of [3, 11])
          for (let x = 4; x <= 11; x++)
            for (let z = -8; z <= -1; z++) {
              const d = Math.hypot(x - 7.5, z + 4.5);
              if (d > 2.6 && d <= 3.4) k.set(x, y, z, shade);
            }
        k.box(7, 16, -5, 8, 17, -4, accent);
        k.box(6, 18, -5, 9, 18, -4, C.safety_red);
        k.set(9, 16, -3, C.paint_white).set(9, 17, -3, accent);
      });
      shoulderStraps(k, shade, accent);
      return;
    }
    case "jetpack": {
      k.free(() => {
        for (const cx of [3.5, 11.5]) {
          k.cyl(cx, -4, 2.2, 2, 13, main);
          k.cyl(cx, -4, 1.5, 14, 14, main).cyl(cx, -4, 0.8, 15, 15, shade);
          for (const y of [4, 11])
            k.forEach((x, yy, z, v) => {
              if (yy === y && v === main && Math.hypot(x - cx, z + 4) > 1.6) k.set(x, yy, z, shade);
            });
          // Nozzle cones and a lovely pilot flame.
          k.cyl(cx, -4, 1.6, 1, 1, shade).cyl(cx, -4, 2.0, 0, 0, shade);
          k.cyl(cx, -4, 2.3, -1, -1, shade).cyl(cx, -4, 1.2, -1, -1, C.metal_dark);
          k.cyl(cx, -4, 1.0, -2, -2, accent);
          k.set(Math.floor(cx), -3, -4, C.lamp_warm).set(Math.floor(cx), -2, -4, C.lamp_warm);
        }
        k.box(6, 3, -4, 9, 12, -1, shade);
        k.box(7, 5, -5, 8, 10, -5, C.metal_dark);
        for (let y = 5; y <= 10; y += 2) k.set(7, y, -5, shade).set(8, y, -5, shade);
        k.set(7, 11, -5, accent).set(8, 11, -5, C.led_amber);
      });
      shoulderStraps(k, C.leather_black, C.steel);
      return;
    }
    case "bot_carrier": {
      k.free(() => {
        // Frame: rails, cross bars, a seat.
        for (const x of [3, 12]) k.box(x, 0, -2, x, 15, -2, main);
        k.box(3, 1, -2, 12, 1, -2, main).box(3, 15, -2, 12, 15, -2, main);
        k.box(3, 2, -7, 12, 3, -2, shade);
        // The sleeping mini bot: body, head with closed eyes, antenna with a dim amber tip.
        k.box(5, 4, -7, 10, 9, -3, C.bot_body);
        roundEdges(k, 5, 10, -7, -3, 4, 9);
        k.box(5, 6, -7, 10, 6, -7, C.bot_dark);
        k.box(6, 10, -6, 9, 13, -3, C.bot_body);
        roundEdges(k, 6, 9, -6, -3, 10, 13);
        k.box(6, 11, -7, 9, 12, -7, C.bot_dark);
        k.set(6, 11, -7, C.bot_dark).set(7, 12, -7, C.steel).set(8, 12, -7, C.steel);
        k.box(8, 14, -5, 8, 15, -5, C.steel).set(8, 16, -5, accent);
        k.box(4, 7, -8, 11, 7, -8, C.leather_black);
        k.set(4, 5, -5, C.bot_dark).set(11, 5, -5, C.bot_dark);
      });
      shoulderStraps(k, C.leather_black, main);
      return;
    }
    case "cape": {
      k.free(() => {
        for (let y = -8; y <= 15; y++) {
          const [x0, x1] = y >= 12 ? [1, 14] : y >= 2 ? [0, 15] : y >= -4 ? [-1, 16] : [-2, 17];
          const z = y >= 4 ? -1 : y >= -4 ? -2 : -3;
          for (let x = x0; x <= x1; x++) {
            const fold = y < 10 && (x - x0) % 3 === 1;
            k.set(x, y, z, y === -8 ? accent : fold ? shade : main);
          }
        }
        // Standing collar behind the neck, cords to a clasp at the throat.
        for (let x = 3; x <= 12; x++)
          for (let z = -1; z <= 2; z++) k.set(x, 16, z, x >= 5 && x <= 10 && z >= 0 ? shade : main);
        k.box(3, 17, -1, 12, 17, -1, main);
        for (const [x, y] of [
          [4, 15],
          [5, 15],
          [6, 14],
          [11, 15],
          [10, 15],
          [9, 14],
        ] as const)
          k.set(x, y, 10, shade);
        k.box(7, 13, 11, 8, 14, 11, accent);
      });
      return;
    }
  }
}

// ── Neck ────────────────────────────────────────────────────────

function cordV(k: Canvas, c: number, bottom: number): void {
  for (let y = 15; y >= bottom; y--) {
    const o = Math.round((15 - y) * 0.3);
    k.set(5 + o, y, 10, c).set(10 - o, y, 10, c);
  }
  k.free(() => {
    for (let z = 2; z <= 9; z++) k.set(5, 16, z, c).set(10, 16, z, c);
    k.box(5, 16, 2, 10, 16, 2, c);
  });
}

export function neckGear(k: Canvas, w: Worn | null): void {
  if (!w) return;
  const { main, shade, accent } = w.t;
  switch (w.id) {
    case "scarf": {
      k.free(() => {
        // Wrapped twice round the neck …
        for (let y = 15; y <= 17; y++)
          for (let x = 2; x <= 13; x++)
            for (let z = 0; z <= 11; z++) {
              const d = ((x - 7.5) / 5) ** 2 + ((z - 5.5) / 5) ** 2;
              const hole = ((x - 7.5) / 2.7) ** 2 + ((z - 5.2) / 2.7) ** 2 <= 1;
              if (d <= 1 && !hole) k.set(x, y, z, (x + y + z) % 3 === 0 ? shade : main);
            }
        // … and far too long: two ends hanging down the front, striped, fringed.
        for (let y = 2; y <= 14; y++) {
          for (let x = 9; x <= 11; x++)
            k.set(x, y, 11, y === 5 || y === 7 ? accent : (x + y) % 4 ? main : shade);
        }
        for (let y = 6; y <= 14; y++)
          for (let x = 10; x <= 12; x++)
            k.set(x, y, 12, y === 9 || y === 11 ? accent : (x + y) % 3 ? main : shade);
        for (const x of [9, 11]) k.set(x, 1, 11, accent);
        k.set(10, 1, 11, shade).set(10, 5, 12, accent).set(12, 5, 12, accent);
      });
      return;
    }
    case "lanyard_keys": {
      cordV(k, main, 7);
      k.free(() => {
        k.box(7, 6, 10, 8, 6, 10, shade).set(7, 6, 11, shade);
        // Seventeen keys, roughly.
        k.box(7, 3, 11, 7, 5, 11, accent).set(6, 3, 11, accent);
        k.box(8, 2, 11, 8, 5, 11, shade).set(9, 2, 11, shade);
        k.box(6, 4, 12, 6, 5, 12, accent).set(9, 4, 12, C.safety_blue).set(9, 5, 12, accent);
        k.set(8, 3, 12, C.safety_green);
      });
      return;
    }
    case "crystal_pendant": {
      cordV(k, shade, 9);
      k.free(() => {
        k.box(7, 6, 11, 8, 8, 11, main).set(7, 5, 11, main).set(8, 9, 11, shade);
        k.box(7, 6, 12, 8, 7, 12, main).set(7, 7, 12, accent);
        // A glowing core (the colourway's accent where it glows, else Halo light).
        k.set(8, 6, 11, labMaterialOf(accent) === "emit" ? accent : C.halo_glow).set(
          7,
          4,
          11,
          main,
        );
      });
      return;
    }
    case "bow_tie": {
      k.free(() => {
        for (const [x, y0, y1] of [
          [4, 12, 15],
          [5, 12, 15],
          [6, 13, 14],
          [9, 13, 14],
          [10, 12, 15],
          [11, 12, 15],
        ] as const)
          for (let y = y0; y <= y1; y++) {
            const dot = (x + y) % 3 === 0 && accent !== main;
            k.set(x, y, 11, dot ? accent : main);
          }
        k.box(7, 13, 12, 8, 14, 12, shade);
        k.box(7, 13, 11, 8, 14, 11, shade);
        k.set(4, 12, 11, shade).set(11, 15, 11, shade);
      });
      return;
    }
  }
}

// ── Shoulder buddy ──────────────────────────────────────────────

export function buddyGear(k: Canvas, w: Worn | null): void {
  if (!w) return;
  const { main, shade, accent } = w.t;
  k.free(() => {
    switch (w.id) {
      case "buddy_f1ndr": {
        // Tracks, a squat body, a head with a calm screen face and an antenna.
        for (const x of [14, 19])
          for (let z = 2; z <= 7; z++)
            for (let y = 16; y <= 17; y++) k.set(x, y, z, (z + y) % 2 ? shade : C.rubber);
        k.box(15, 16, 3, 18, 18, 6, main);
        k.box(15, 19, 2, 18, 22, 7, main);
        roundEdges(k, 15, 18, 2, 7, 22, 22);
        k.box(15, 20, 8, 18, 22, 8, C.bot_dark);
        k.box(16, 20, 8, 17, 21, 8, accent);
        k.set(16, 21, 9, C.scan_dim).set(17, 21, 9, C.scan_dim).set(16, 20, 9, accent);
        k.box(17, 23, 4, 17, 24, 4, C.steel).set(17, 25, 4, C.led_green);
        k.set(15, 17, 7, shade).set(18, 17, 7, shade);
        return;
      }
      case "buddy_drone": {
        // Hovering above the shoulder: body, four arms, rotor rings, a blue eye.
        k.box(16, 23, 3, 19, 24, 6, main);
        roundEdges(k, 16, 19, 3, 6, 23, 24);
        k.box(17, 25, 4, 18, 25, 5, main);
        for (const [x, z] of [
          [15, 2],
          [20, 2],
          [15, 7],
          [20, 7],
        ] as const) {
          k.set(x, 24, z, shade);
          const rx = x < 17 ? x - 1 : x + 1;
          const rz = z < 4 ? z - 1 : z + 1;
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
              if (dx || dz) k.set(rx + dx, 25, rz + dz, (dx + dz) % 2 ? shade : C.steel_dark);
          k.set(rx, 25, rz, C.paint_black);
        }
        k.set(17, 23, 7, accent).set(18, 23, 7, accent).set(17, 22, 5, C.paint_black);
        return;
      }
      case "buddy_plush": {
        // Felt ball with a big eye and a red button pupil.
        k.sphere(17.5, 19.5, 5, 3, main);
        k.forEach((x, y, z, v) => {
          if (v !== main) return;
          if (Math.hypot(x - 17.5, y - 19.5) <= 2.3 && z >= 6) k.set(x, y, z, accent);
          else if (Math.abs(y - 19.5) < 0.6 && z <= 3) k.set(x, y, z, C.paint_black_lt);
        });
        k.box(17, 19, 8, 18, 20, 8, shade).set(17, 20, 8, C.led_white);
        k.set(15, 16, 5, main).set(20, 16, 5, main);
        return;
      }
    }
  });
}

// ── Belt ────────────────────────────────────────────────────────

/** Recolour the waist's surface ring at `rows` (a belt round whatever is worn). */
function waistRing(k: Canvas, rows: number[], c: (x: number, z: number) => number): void {
  k.forEach((x, y, z) => {
    if (!rows.includes(y)) return;
    const surf =
      !k.get(x + 1, y, z) || !k.get(x - 1, y, z) || !k.get(x, y, z + 1) || !k.get(x, y, z - 1);
    if (surf) k.set(x, y, z, c(x, z));
  });
}

export function beltGear(k: Canvas, ctx: LookCtx): void {
  const w = ctx.belt;
  if (!w) return;
  const { main, shade, accent } = w.t;
  const loops = ctx.legs?.t.main ?? main;
  switch (w.id) {
    case "toolbelt": {
      // Belt, buckle, belt loops; a tape measure and a key carabiner.
      k.box(4, 2, 9, 11, 3, 9, main);
      k.box(7, 2, 9, 8, 3, 9, shade).set(7, 3, 9, C.gold);
      k.set(5, 3, 9, loops).set(10, 3, 9, loops);
      k.box(10, 0, 9, 11, 1, 9, accent).set(11, 1, 9, C.paint_black);
      k.box(4, 0, 9, 4, 1, 9, C.steel).set(5, 0, 9, C.chrome);
      return;
    }
    case "utility_belt": {
      waistRing(k, [2, 3], (x, z) => ((x + z) % 5 === 0 ? shade : main));
      k.box(7, 2, 9, 8, 3, 9, accent).set(7, 3, 9, C.chrome);
      k.free(() => {
        // Right: pliers pouch. Left: hammer loop. Back: screwdrivers. Front: multimeter.
        k.box(-2, 0, 3, -1, 3, 7, main).box(-2, 3, 3, -2, 3, 7, shade);
        k.box(-2, 4, 4, -2, 5, 4, C.safety_red).box(-1, 4, 6, -1, 5, 6, C.safety_red);
        k.set(-2, 6, 5, accent);
        k.box(16, 2, 4, 16, 3, 6, accent).box(16, 2, 5, 17, 2, 5, 0);
        k.box(17, -3, 5, 17, 1, 5, C.wood).box(16, 2, 4, 18, 2, 4, 0);
        k.box(16, -3, 4, 18, -3, 6, C.steel_dark).set(18, -2, 5, C.steel_dark);
        for (const [x, c] of [
          [11, C.safety_yellow],
          [12, C.safety_blue],
          [13, C.safety_red],
        ] as const) {
          k.box(x, 0, -1, x, 3, -1, C.leather_worn).box(x, 4, -1, x, 5, -1, c);
        }
        k.box(1, 0, 10, 3, 3, 10, C.safety_yellow).box(2, 2, 11, 3, 3, 11, C.crt_bg);
        k.set(2, 1, 11, C.paint_black).set(3, 3, 11, C.paper);
      });
      return;
    }
    case "fanny_pack": {
      waistRing(k, [2], () => shade);
      k.free(() => {
        k.box(4, 0, 10, 11, 3, 11, main);
        roundEdges(k, 4, 11, 10, 11, 0, 3);
        k.box(4, 3, 11, 11, 3, 11, accent);
        k.set(10, 3, 12, C.steel).set(10, 2, 12, C.steel);
        k.box(6, 1, 12, 8, 1, 12, shade);
        k.box(3, 2, 10, 3, 2, 10, shade).box(12, 2, 10, 12, 2, 10, shade);
      });
      return;
    }
  }
}

// ── Wrist (left forearm, right-arm frame, mirrored afterwards) ──

export function wristGear(k: Canvas, w: Worn | null, underGlove: boolean): void {
  if (!w) return;
  const { main, shade, accent } = w.t;
  if (underGlove && w.id !== "wrist_computer") return;
  switch (w.id) {
    case "watch": {
      // Strap with a face on the back of the wrist (check-watch fidget).
      k.box(1, 4, 1, 4, 4, 4, main);
      k.box(1, 4, 2, 1, 4, 3, accent).set(1, 5, 2, shade).set(1, 5, 3, shade);
      return;
    }
    case "smartband": {
      k.box(1, 4, 1, 4, 4, 4, main);
      k.box(0, 4, 2, 0, 4, 3, accent).set(0, 5, 2, shade);
      k.set(4, 4, 2, shade).set(4, 4, 3, shade);
      return;
    }
    case "wrist_computer": {
      k.free(() => {
        k.box(-2, 4, 1, -1, 8, 4, main);
        k.box(1, 4, 1, 4, 4, 4, shade);
        for (let y = 5; y <= 7; y++)
          for (let z = 2; z <= 3; z++) k.set(-3, y, z, y === 6 && z === 3 ? C.scan_dim : accent);
        k.box(-3, 4, 1, -3, 4, 4, shade).set(-3, 8, 1, shade).set(-3, 8, 4, C.led_red);
        k.set(-3, 5, 1, shade).set(-3, 7, 4, shade).set(-2, 9, 1, C.steel);
      });
      return;
    }
    case "friendship_band": {
      const cols = [
        main,
        shade,
        accent,
        C.safety_green,
        C.paint_pink,
        C.safety_orange,
        C.paint_lilac,
        C.paint_white,
        C.paint_mint,
        C.cable_black,
      ];
      let i = 0;
      for (let x = 1; x <= 4; x++)
        for (let z = 1; z <= 4; z++)
          if (x === 1 || x === 4 || z === 1 || z === 4) k.set(x, 4, z, cols[i++ % cols.length]!);
      k.free(() => k.set(0, 3, 2, accent).set(0, 2, 2, main).set(0, 3, 3, C.safety_green));
      return;
    }
  }
}

/** Shoulder-buddy anchors for the engine's animated extras (torso canvas coordinates). */
export const BUDDY_DRONE_CENTRE = [17.5, 24, 4.5] as const;

export { hash01, tint, type Tone };

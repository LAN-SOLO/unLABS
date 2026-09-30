/**
 * Jade's wardrobe — gadgets: headgear, face pieces, gloves (pure — no three).
 * ==========================================================================
 *
 * Headgear and face pieces are painted onto the head canvas (see
 * jade-hair.ts for the head frame: face plane z 12..13, eyes rows 8..9,
 * nose tip z 14, hair surface ≈ the capHead ellipsoid, crown row 17);
 * anything that grows past the 14×18×16 head is drawn with `free`.
 * Gloves replace the hand on the forearm canvas (hand rows 0..3, wrist
 * 4..5, sleeve 6..9; x = 0..1 is the back of the hand, the thumb at +x).
 * Glowing parts use emissive palette colours (headlamp lens, circlet, LED
 * balls, HUD strip, servo LEDs), so the existing materials make them glow.
 */
import { C } from "@/lib/world/content/palette";
import {
  Canvas,
  SKIN,
  SKIN_LIGHT,
  SKIN_SHADE,
  hash01,
  roundEdges,
  tint,
  wrapRow,
  type LookCtx,
  type Tone,
  type Worn,
} from "@/lib/world/models/jade-kit";

// ── Shapes on the head ──────────────────────────────────────────

/** Normalised ellipsoid distance around the head centre used by capHead. */
function ell(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  cy = 8.5,
  cz = 7.5,
): number {
  return ((x + 0.5 - 7) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
}

/**
 * A shell between two ellipsoids around the head (radii grow by `t` from
 * the inner to the outer), rows ≥ y0, where `keep` holds. Painted by `c`.
 */
function helmet(
  k: Canvas,
  r: [number, number, number],
  t: number,
  y0: number,
  c: (x: number, y: number, z: number) => number,
  keep: (x: number, y: number, z: number) => boolean = () => true,
  cy = 8.5,
  cz = 7.5,
): void {
  const [rx, ry, rz] = r;
  k.free(() => {
    for (let y = y0; y <= Math.ceil(cy + ry + t); y++)
      for (let z = Math.floor(cz - rz - t - 1); z <= Math.ceil(cz + rz + t); z++)
        for (let x = Math.floor(7 - rx - t - 1); x <= Math.ceil(7 + rx + t); x++) {
          const outer = ell(x, y, z, rx + t, ry + t, rz + t, cy, cz);
          const inner = ell(x, y, z, rx, ry, rz, cy, cz);
          if (outer <= 1 && inner > 1 && keep(x, y, z)) k.set(x, y, z, c(x, y, z));
        }
  });
}

/** Highest solid row at (x, z), or -1. */
function topAt(k: Canvas, x: number, z: number): number {
  for (let y = 26; y >= 0; y--) if (k.get(x, y, z)) return y;
  return -1;
}

/**
 * A band in the plane z = zp over the head (headphone / antenna bands):
 * every empty cell above row `yMin` that touches the silhouette in x or y.
 */
function bandOverHead(k: Canvas, zp: number, yMin: number, c: number): void {
  const add: [number, number][] = [];
  k.forEach((x, y, z) => {
    if (z !== zp || y < yMin) return;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
    ] as const)
      if (!k.get(x + dx, y + dy, zp)) add.push([x + dx, y + dy]);
  });
  k.free(() => {
    for (const [x, y] of add) k.set(x, y, zp, c);
  });
}

// ── Headgear ────────────────────────────────────────────────────

/** Paint the headgear on the head canvas (after hair and face pieces). */
export function headGear(k: Canvas, w: Worn | null): void {
  if (!w) return;
  const { main, shade, accent } = w.t;
  switch (w.id) {
    case "goggles_amber": {
      // Amber goggles pushed up on the forehead: frames, lenses (solid, non-glowing), bridge, strap.
      for (const x0 of [2, 8]) {
        k.box(x0, 14, 14, x0 + 3, 16, 14, main);
        k.box(x0 + 1, 14, 15, x0 + 2, 16, 15, accent);
        k.set(x0 + 1, 16, 15, C.paper_yellow);
        k.box(x0, 15, 15, x0, 15, 15, main).box(x0 + 3, 15, 15, x0 + 3, 15, 15, main);
      }
      k.box(6, 15, 14, 7, 15, 14, C.door_frame_dk);
      // Strap round the head, just under the crown.
      for (let z = 1; z <= 13; z++) {
        tint(k, 1, 15, z, shade);
        tint(k, 12, 15, z, shade);
      }
      for (let x = 2; x <= 11; x++) tint(k, x, 15, 1, shade);
      return;
    }
    case "hardhat": {
      // Shell with a centre ridge, a brim with a front peak, a sticker and a crack.
      helmet(k, [7.2, 9.7, 8.4], 1.3, 14, (x, y) =>
        Math.abs(x + 0.5 - 7) < 1 && y >= 16 ? shade : main,
      );
      k.free(() => {
        for (let z = -2; z <= 18; z++)
          for (let x = -2; x <= 15; x++) {
            const e = ((x + 0.5 - 7) / 8.6) ** 2 + ((z + 0.5 - 7.9) / (z > 8 ? 10.2 : 9.3)) ** 2;
            if (e <= 1 && ((x + 0.5 - 7) / 7) ** 2 + ((z + 0.5 - 7.5) / 8) ** 2 > 0.8)
              k.set(x, 13, z, e > 0.8 ? shade : main);
          }
        // Sticker on her left side: a black crystal on the accent square.
        k.box(15, 15, 6, 15, 17, 8, accent).set(15, 16, 7, C.paint_black);
        // The crack from the day the crane moved on its own.
        for (const [x, y, z] of [
          [9, 18, 15],
          [10, 17, 15],
          [10, 16, 16],
          [11, 15, 16],
        ] as const)
          tint(k, x, y, z, C.grime);
      });
      return;
    }
    case "welding_helmet": {
      // Hood-like shell open at the face, the visor flipped up over the brow.
      helmet(
        k,
        [7.4, 9.8, 8.6],
        1.2,
        6,
        (x, y) => (y === 6 ? shade : main),
        (x, y, z) => z < 11 || y >= 16,
        8.8,
        7.4,
      );
      k.free(() => {
        // Visor flipped up: a tilted plate standing over the brow, a steel-rimmed dark window.
        for (let i = 0; i <= 6; i++) {
          const y = 14 + i;
          const z = 16 - Math.round(i * 0.8);
          for (let x = 0; x <= 13; x++) {
            const side = x === 0 || x === 13;
            k.set(x, y, z - 1, shade);
            const win = x >= 3 && x <= 10 && i >= 2 && i <= 5;
            const rim = x >= 2 && x <= 11 && i >= 1 && i <= 6 && !win;
            k.set(x, y, z, side ? shade : win ? accent : rim ? C.steel : main);
          }
        }
        for (let y = 12; y <= 14; y++) k.set(-1, y, 13, shade).set(14, y, 13, shade);
        // Hinge knobs, three forge stickers, the ratchet band at the brow.
        k.box(-2, 12, 7, -2, 13, 8, C.steel).box(15, 12, 7, 15, 13, 8, C.steel);
        k.set(-2, 13, 7, C.chrome).set(15, 13, 7, C.chrome);
        tint(k, -1, 10, 4, C.safety_orange);
        tint(k, -1, 11, 4, C.safety_orange);
        tint(k, 14, 9, 5, C.safety_blue);
        tint(k, 14, 10, 5, C.paint_white);
        for (let x = 2; x <= 11; x++) k.set(x, 14, 13, x % 3 ? shade : C.steel);
      });
      return;
    }
    case "headphones": {
      bandOverHead(k, 6, 11, main);
      bandOverHead(k, 7, 11, main);
      k.free(() => {
        for (let x = 3; x <= 10; x++) {
          const y = topAt(k, x, 7);
          if (y > 0) k.set(x, y, 8, shade);
        }
        for (const side of [-1, 1]) {
          const xo = side < 0 ? -2 : 13;
          const xi = side < 0 ? 0 : 13;
          k.box(xo, 5, 5, xo + 2, 11, 10, main);
          roundEdges(k, xo, xo + 2, 5, 10, 5, 5);
          roundEdges(k, xo, xo + 2, 5, 10, 11, 11);
          k.box(xi, 6, 6, xi, 10, 9, C.leather_black);
          const xs = side < 0 ? -2 : 15;
          for (let y = 6; y <= 10; y++)
            for (let z = 6; z <= 9; z++) {
              const ring = y === 6 || y === 10 || z === 6 || z === 9;
              if (ring) k.set(xs, y, z, shade);
            }
          k.set(xs, 9, 8, accent);
        }
        // Coiled cable from the left cup to the shoulder.
        for (let y = 4; y >= -3; y--) k.set(y % 2 ? 14 : 15, y, 7, y % 2 ? main : shade);
      });
      return;
    }
    case "beanie": {
      // Rib-knit body, a turned-up cuff, a fluffy pompom.
      helmet(k, [7.2, 9.7, 8.4], 1.2, 12, (x, y, z) => {
        const a = Math.floor((Math.atan2(z + 0.5 - 7.5, x + 0.5 - 7) + Math.PI) * (14 / Math.PI));
        return a % 2 ? main : shade;
      });
      helmet(
        k,
        [8.2, 10.6, 9.4],
        1,
        12,
        (x, y, z) => ((x + z) % 2 ? shade : main),
        (x, y) => y <= 14,
      );
      k.free(() => {
        const cy = topAt(k, 7, 8) + 1.6;
        k.sphere(7, cy, 8, 2, accent);
        k.forEach((x, y, z) => {
          if (
            y >= cy - 2.2 &&
            Math.hypot(x - 7, y - cy, z - 8) <= 2.3 &&
            hash01(x * 7 + z, y) < 0.25
          )
            k.set(x, y, z, x % 2 ? main : C.paint_white === accent ? C.paint_cream : accent);
        });
      });
      return;
    }
    case "cap": {
      // Six-panel crown with seams and a button, embroidered crystal, curved peak.
      helmet(k, [7.2, 9.7, 8.4], 1.1, 13, (x, y, z) => {
        const seam = Math.abs(x + 0.5 - 7) < 0.6 || Math.abs(z + 0.5 - 7.5) < 0.6;
        return seam && y >= 15 ? shade : main;
      });
      k.free(() => {
        const top = topAt(k, 7, 7);
        k.set(6, top + 1, 7, shade).set(7, top + 1, 7, shade);
        for (const [x, y] of [
          [6, 17],
          [5, 16],
          [7, 16],
          [6, 15],
          [4, 15],
          [8, 15],
        ] as const) {
          for (let z = 18; z >= 12; z--)
            if (k.get(x, y, z)) {
              k.set(x, y, z, accent);
              break;
            }
        }
        // Peak.
        for (let x = 1; x <= 12; x++) {
          const reach = 18 - Math.round(((x + 0.5 - 7) / 6) ** 2 * 3);
          for (let z = 13; z <= reach; z++)
            k.set(x, 13, z, z === reach || x === 1 || x === 12 ? shade : main);
        }
        // Opening at the back for the ponytail, with the strap adjuster.
        k.forEach((x, y, z) => {
          if (x >= 5 && x <= 9 && y >= 13 && y <= 14 && z <= 2) k.set(x, y, z, 0);
        });
        k.box(5, 15, -1, 9, 15, 0, shade).set(7, 15, -1, C.steel);
      });
      return;
    }
    case "headlamp": {
      // Elastic band, a strap over the crown, the lamp with a glowing lens.
      const band = (x: number, z: number) => (hash01(x, z) < 0.3 ? shade : main);
      k.free(() => {
        wrapRow(k, 14, band, (x, z) => z < 13 || x < 2 || x > 11);
        wrapRow(k, 15, band, (x, z) => z < 13 || x < 2 || x > 11);
        for (let z = 2; z <= 12; z++) {
          const y = Math.max(topAt(k, 6, z), topAt(k, 7, z));
          if (y > 12) k.set(6, y + 1, z, main).set(7, y + 1, z, main);
        }
        k.box(5, 13, 14, 8, 16, 15, shade);
        k.box(4, 14, 14, 9, 15, 14, main);
        k.box(5, 14, 16, 8, 15, 16, main).box(6, 13, 16, 7, 16, 16, main);
        k.box(6, 14, 16, 7, 15, 16, accent);
        k.set(8, 16, 16, C.led_red);
      });
      return;
    }
    case "antenna_band": {
      bandOverHead(k, 8, 12, main);
      k.free(() => {
        for (const x of [3, 10]) {
          const y0 = topAt(k, x, 8) + 1;
          for (let i = 0; i < 6; i++) k.set(x + (i % 2), y0 + i, 8, i % 2 ? shade : main);
          k.sphere(x + 0.5, y0 + 7, 8, 1.3, accent);
          k.set(x, y0 + 8, 8, C.led_white);
        }
      });
      return;
    }
    case "propeller_cap": {
      // Four coloured segments, a little peak, a stem with a two-blade propeller.
      const seg = [main, accent, shade, C.safety_green];
      helmet(k, [7.2, 9.7, 8.4], 1.1, 13, (x, y, z) => {
        const a =
          Math.floor((Math.atan2(z + 0.5 - 7.5, x + 0.5 - 7) + Math.PI) / (Math.PI / 2)) % 4;
        return seg[a]!;
      });
      k.free(() => {
        for (let x = 3; x <= 10; x++) for (let z = 14; z <= 16; z++) k.set(x, 13, z, accent);
        propeller(k, w.t, topAt(k, 7, 7) + 1);
      });
      return;
    }
    case "sou_wester": {
      // Oilskin crown with stitched rings, a wide brim that runs longer down the back.
      helmet(k, [7.2, 9.7, 8.4], 1.2, 13, (x, y) => (y === 15 || y === 17 ? shade : main));
      k.free(() => {
        for (let z = -4; z <= 18; z++)
          for (let x = -2; x <= 15; x++) {
            const back = z < 4;
            const e = ((x + 0.5 - 7) / 8.6) ** 2 + ((z + 0.5 - 7.3) / (back ? 11 : 9.6)) ** 2;
            const hole = ((x + 0.5 - 7) / 7) ** 2 + ((z + 0.5 - 7.5) / 8) ** 2 <= 0.8;
            if (e > 1 || hole) continue;
            const y = z < 0 ? 11 : z < 2 ? 12 : 13;
            k.set(x, y, z, e > 0.82 ? shade : main);
          }
        // Chin cord tucked up at the sides.
        k.set(1, 12, 11, accent).set(12, 12, 11, accent);
      });
      return;
    }
    case "flower_crown": {
      // A ring of glowing blossoms round the crown, leaves between them.
      k.free(() => {
        wrapRow(k, 15, (x, z) =>
          (x * 3 + z) % 5 === 0 ? shade : (x + z) % 3 === 0 ? accent : main,
        );
        for (const [x, z] of [
          [2, 12],
          [7, 14],
          [11, 12],
          [1, 6],
          [12, 6],
        ] as const) {
          const y = topAt(k, x, z) >= 15 ? 16 : 15;
          k.set(x, y, z, accent).set(x + (x < 7 ? -1 : 1), y, z, main);
        }
      });
      return;
    }
    case "sweatband": {
      // Terry band round the forehead with a stripe and a stitched crystal.
      k.free(() => {
        wrapRow(k, 13, accent, (x, z) => z < 14 || (x >= 2 && x <= 11));
        wrapRow(k, 14, (x, z) => (hash01(x, z) < 0.25 ? shade : main));
        for (let z = 12; z <= 16; z++)
          if (k.get(7, 14, z) === main || k.get(7, 14, z) === shade) {
            k.set(7, 14, z, C.crystal_cyan).set(6, 14, z, shade);
            break;
          }
      });
      return;
    }
    case "crystal_tiara": {
      // A thin glowing band with a Halo crystal at the brow and two side stones.
      k.free(() => {
        wrapRow(k, 14, accent, (x, z) => z < 14);
        k.box(6, 14, 15, 7, 16, 15, main).set(6, 17, 15, main).set(7, 17, 15, main);
        k.box(5, 15, 15, 8, 15, 15, main);
        k.set(6, 15, 16, shade).set(7, 15, 16, shade).set(6, 16, 16, shade);
        k.set(6, 13, 15, accent).set(7, 13, 15, accent);
        for (const x of [1, 12]) {
          for (let z = 9; z <= 13; z++)
            if (k.get(x, 14, z) === accent) {
              k.set(x + (x < 7 ? -1 : 1), 14, z, main);
              break;
            }
        }
      });
      return;
    }
  }
}

/** Propeller on a stem at row y (head coordinates, centred on x 7, z 7..8). */
export function propeller(k: Canvas, t: Tone, y: number): void {
  k.box(7, y, 7, 7, y + 1, 7, C.steel);
  k.set(7, y + 2, 7, t.accent);
  for (let i = 1; i <= 6; i++) {
    k.set(7 - i, y + 2, 7, t.main).set(7 + i, y + 2, 7, t.shade);
    if (i >= 3) k.set(7 - i, y + 2, 8, t.main).set(7 + i, y + 2, 6, t.shade);
  }
}

// ── Face pieces ─────────────────────────────────────────────────

/** Paint a face piece on the head canvas (after the hair, before headgear). */
export function faceGear(k: Canvas, w: Worn | null): void {
  if (!w) return;
  const { main, shade, accent } = w.t;
  k.free(() => {
    switch (w.id) {
      case "safety_glasses": {
        // Wrap-around lens, a top rim, side shields and temple arms.
        for (let x = 1; x <= 12; x++) {
          const z = x <= 1 || x >= 12 ? 13 : 14;
          for (let y = 7; y <= 9; y++) k.set(x, y, z, main);
          k.set(x, 10, z, shade);
        }
        k.set(6, 7, 14, shade).set(7, 7, 14, shade).set(6, 8, 15, shade).set(7, 8, 15, shade);
        for (const x of [0, 13]) {
          for (let z = 6; z <= 12; z++) k.set(x, 9, z, shade);
          k.box(x, 7, 11, x, 8, 12, accent);
        }
        k.set(3, 9, 15, C.paint_white).set(9, 9, 15, C.paint_white);
        return;
      }
      case "face_shield": {
        // Headband, a brow brim, the clear visor down to the chin.
        wrapRow(k, 15, shade, (x, z) => z < 14);
        for (let x = 0; x <= 13; x++) {
          const z = x <= 0 || x >= 13 ? 15 : 16;
          for (let y = 1; y <= 15; y++) k.set(x, y, z, y === 1 ? accent : y >= 14 ? shade : main);
          k.set(x, 16, 15, shade);
        }
        for (let y = 2; y <= 13; y++) k.set(0, y, 14, main).set(13, y, 14, main);
        k.set(3, 11, 17, C.white).set(4, 10, 17, C.white).set(10, 5, 17, C.white);
        k.box(-1, 14, 11, -1, 15, 13, shade).box(14, 14, 11, 14, 15, 13, shade);
        return;
      }
      case "respirator": {
        // Rubber mask over nose and mouth, twin filter cartridges, exhale valve, straps.
        for (let y = 2; y <= 7; y++)
          for (let x = 3; x <= 10; x++) {
            if (y === 7 && (x < 5 || x > 8)) continue;
            if (y === 2 && (x < 4 || x > 9)) continue;
            k.set(x, y, 14, main);
            if (y <= 5 && x >= 4 && x <= 9) k.set(x, y, 15, main);
          }
        k.box(6, 2, 16, 7, 3, 16, shade).set(6, 3, 16, C.paint_black);
        for (const x0 of [1, 10]) {
          k.box(x0, 2, 14, x0 + 2, 5, 16, shade);
          k.box(x0, 3, 17, x0 + 2, 4, 17, accent);
          k.set(x0 + 1, 3, 17, C.paint_black).set(x0 + 1, 5, 17, shade);
        }
        for (const y of [5, 9]) wrapRow(k, y, main, (x, z) => z <= 12 && z >= 2);
        return;
      }
      case "round_glasses": {
        // Two wire rings, clear lenses, a bridge and temples.
        for (const cx of [3.5, 9.5]) {
          for (let y = 6; y <= 11; y++)
            for (let x = Math.floor(cx) - 2; x <= Math.ceil(cx) + 2; x++) {
              const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - 9);
              if (Math.abs(d - 2.3) <= 0.55) k.set(x, y, 14, main);
              else if (d < 2.3) k.set(x, y, 15, accent);
            }
        }
        k.set(6, 9, 14, shade).set(7, 9, 14, shade);
        for (const x of [0, 13]) for (let z = 6; z <= 12; z++) k.set(x, 9, z, shade);
        k.set(2, 10, 15, C.paint_white).set(8, 10, 15, C.paint_white);
        return;
      }
      case "hud_visor": {
        // Dark frame, a glowing strip with readouts, side pods.
        for (let x = 0; x <= 13; x++) {
          const z = x <= 1 || x >= 12 ? 13 : 14;
          k.set(x, 7, z, shade).set(x, 10, z, shade);
          k.set(x, 8, z, main).set(x, 9, z, main);
        }
        for (const [x, y] of [
          [3, 9],
          [4, 9],
          [5, 8],
          [9, 9],
          [10, 8],
          [8, 8],
        ] as const)
          k.set(x, y, 15, accent);
        for (const x of [-1, 14]) {
          k.box(x, 7, 9, x, 10, 12, shade);
          k.set(x, 9, 12, accent);
        }
        return;
      }
      case "band_aid": {
        for (let x = 4; x <= 9; x++) k.set(x, 6, 15, main).set(x, 7, 15, main);
        k.box(6, 6, 16, 7, 7, 16, accent);
        k.set(4, 7, 15, shade).set(9, 6, 15, shade).set(5, 6, 15, shade);
        return;
      }
      case "sunglasses": {
        // Square frames, dark lenses, a bridge and temples; one glint.
        for (let x = 1; x <= 12; x++) {
          const z = x <= 1 || x >= 12 ? 13 : 14;
          k.set(x, 10, z, main);
        }
        for (const x0 of [2, 8]) {
          k.box(x0, 7, 14, x0 + 3, 9, 14, accent);
          k.set(x0, 7, 14, main).set(x0 + 3, 7, 14, main);
          k.box(x0, 6, 14, x0 + 3, 6, 14, shade);
        }
        k.set(6, 9, 14, main).set(7, 9, 14, main);
        for (const x of [0, 13]) for (let z = 6; z <= 12; z++) k.set(x, 10, z, main);
        k.set(3, 9, 15, C.chrome_lt);
        return;
      }
      case "fake_mustache": {
        k.box(3, 4, 15, 10, 4, 15, main)
          .box(4, 5, 15, 5, 5, 15, main)
          .box(8, 5, 15, 9, 5, 15, main);
        k.set(2, 5, 14, shade).set(11, 5, 14, shade).set(2, 4, 14, main).set(11, 4, 14, main);
        k.set(6, 4, 15, shade).set(7, 4, 15, shade);
        return;
      }
    }
  });
}

// ── Hands and gloves ────────────────────────────────────────────

/**
 * Right hand (mirrored for the left) at rows 0..3: palm plane YZ at x 2..3,
 * four fingers along z with shaded gaps and knuckles, the thumb on the
 * inner (+x) side at the front.
 */
function hand(k: Canvas, skin: number, shade: number, nail: number = SKIN_LIGHT): void {
  k.box(1, 1, 1, 3, 3, 4, skin);
  for (let z = 1; z <= 4; z++) {
    k.set(2, 0, z, z === 1 ? shade : skin).set(1, 0, z, 0);
    k.set(1, 1, z, z % 2 ? shade : skin);
  }
  // Knuckles and finger gaps on the back of the hand (outer side, x = 1).
  for (const z of [1, 2, 3, 4]) k.set(1, 2, z, z % 2 ? skin : shade);
  k.set(2, 0, 4, nail).set(2, 0, 2, nail);
  // Thumb: from the palm's front edge, pointing down and in.
  k.box(4, 2, 4, 4, 3, 5, skin).set(4, 1, 5, shade).set(3, 3, 5, skin);
}

/** Does the glove cover the wrist (wrist accessories hide under it)? */
export function glovesCoverWrist(ctx: LookCtx): boolean {
  const id = ctx.hands?.id;
  return id === "welding_gloves" || id === "insulated_gloves";
}

/** Hand (bare or gloved) on the forearm canvas. */
export function handWithGloves(k: Canvas, ctx: LookCtx): void {
  const g = ctx.hands;
  if (!g) {
    hand(k, SKIN, SKIN_SHADE);
    return;
  }
  const { main, shade, accent } = g.t;
  switch (g.id) {
    case "nitrile": {
      hand(k, main, shade, main);
      k.box(1, 4, 1, 4, 4, 4, main).set(1, 4, 1, shade).set(4, 4, 4, shade);
      k.free(() => k.box(0, 4, 2, 0, 4, 3, main));
      return;
    }
    case "welding_gloves": {
      hand(k, main, shade, shade);
      k.box(0, 1, 1, 0, 3, 4, main).set(0, 2, 2, shade).set(0, 2, 4, shade);
      k.box(1, 0, 1, 1, 0, 4, shade);
      k.box(0, 4, 0, 5, 5, 5, main);
      roundEdges(k, 0, 5, 0, 5, 4, 5);
      k.free(() => {
        k.box(-1, 6, -1, 6, 9, 6, main);
        roundEdges(k, -1, 6, -1, 6, 6, 9);
        k.forEach((x, y, z) => {
          const edge = x === -1 || x === 6 || z === -1 || z === 6;
          if (y === 9 && edge) k.set(x, y, z, accent);
          else if (edge && y === 7 && (x + z) % 2) k.set(x, y, z, shade);
        });
        k.set(-1, 7, 2, C.grime).set(6, 8, 3, shade);
      });
      return;
    }
    case "fingerless": {
      hand(k, main, shade, SKIN);
      for (let z = 1; z <= 4; z++) k.set(2, 0, z, z === 1 ? SKIN_SHADE : SKIN);
      k.set(4, 1, 5, SKIN_SHADE);
      k.box(1, 4, 1, 4, 4, 4, main);
      k.forEach((x, y, z, v) => {
        if (y >= 1 && y <= 4 && v === main && y % 2 === 0) k.set(x, y, z, shade);
      });
      return;
    }
    case "insulated_gloves": {
      hand(k, main, shade, main);
      k.box(0, 4, 0, 5, 7, 5, accent);
      roundEdges(k, 0, 5, 0, 5, 4, 7);
      k.free(() => {
        for (let x = -1; x <= 6; x++)
          for (let z = -1; z <= 6; z++) {
            const edge = x === -1 || x === 6 || z === -1 || z === 6;
            const corner = (x === -1 || x === 6) && (z === -1 || z === 6);
            if (edge && !corner) k.set(x, 7, z, accent);
          }
      });
      k.set(0, 5, 2, C.paint_white).set(0, 5, 3, C.paint_black);
      return;
    }
    case "servo_gloves": {
      hand(k, main, shade, main);
      k.free(() => {
        for (const z of [1, 2, 3, 4]) k.set(0, 2, z, shade);
        k.set(0, 3, 1, accent).set(0, 3, 4, accent);
        k.set(0, 1, 2, C.steel_dark).set(0, 1, 3, C.steel_dark);
        k.set(5, 3, 5, shade);
        k.box(1, 4, 1, 4, 4, 4, shade);
        for (let y = 5; y <= 7; y++) k.set(0, y, 3, C.cable_black);
        k.set(0, 4, 3, accent);
      });
      return;
    }
    default:
      hand(k, SKIN, SKIN_SHADE);
  }
}

export { SKIN, tint };

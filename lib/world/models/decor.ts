/**
 * Decor library — set dressing for the lab rooms (pure, no three).
 * =================================================================
 *
 * Every piece is a procedural voxel model, front = +z, bottom-centre =
 * placement point — exactly like props. `DecorDef.scale` is the world size
 * of one model voxel: MODEL_SCALE (0.5) for the classic pieces, DETAIL_SCALE
 * (0.25) for the detailed furniture / clutter / lore sets in
 * `decor-furniture.ts`, `decor-detail.ts` and `decor-lore.ts`. Wall-mounted
 * pieces (`wall: true`) have their back at model z = 0 and are at most one
 * world voxel deep; `elevation` lifts them (world voxels) above the floor
 * when a placement gives no `y`.
 *
 * Hosts (`top`) carry desk-top clutter (`small`), placed by the interior
 * generator. `parts` (fans, reels, hands, drips, steam…) and `screens` use
 * the device-visual conventions of `anim.ts`, in this model's voxel frame;
 * `decorVisual(id)` packages them for the engine's rig builder.
 *
 * Light positions are in model voxels of the unrotated model (see
 * `decorLights` in content/interior.ts for the world transform).
 */
import { C } from "@/lib/world/content/palette";
import { fnv1a } from "@/lib/world/traits";
import { Model, MODEL_SCALE } from "@/lib/world/models/core";
import {
  ringModel,
  type AnimPart,
  type DeviceVisual,
  type ScreenContent,
  type ScreenSpec,
} from "@/lib/world/models/anim";
import {
  blob,
  books,
  disc,
  drips,
  part,
  rich,
  screenWell,
  wisp,
  type DecorLight,
  flask,
  L,
  legs,
  scribble,
  sign,
  table,
  type DecorDef,
} from "@/lib/world/models/decor-kit";
import { FURNITURE } from "@/lib/world/models/decor-furniture";
import { DETAIL_DECOR } from "@/lib/world/models/decor-detail";
import { LORE_DECOR } from "@/lib/world/models/decor-lore";
import { weatherModel } from "@/lib/world/models/decor-weather";
import { CLUTTER_DECOR } from "@/lib/world/models/decor-clutter";
import { DECOR_UPGRADES } from "@/lib/world/models/decor-upgrades";
import { BIO_DECOR } from "@/lib/world/models/decor-bio";
import { QUARTERS_DECOR } from "@/lib/world/models/decor-quarters";
import { STUDIO_DECOR } from "@/lib/world/models/decor-studio";

export type { DecorDef, DecorLight } from "@/lib/world/models/decor-kit";

function barrelModel(body: number, band: number, lid: number, mark?: number): Model {
  const m = new Model(6, 8, 6);
  m.cyl(2.5, 2.5, 2.5, 0, 7, body);
  m.ring(2.5, 2.5, 2.5, 1, band).ring(2.5, 2.5, 2.5, 6, band);
  m.cyl(2.5, 2.5, 1.6, 7, 7, lid);
  m.set(1, 7, 1, C.metal_dark);
  if (mark) m.box(2, 3, 5, 3, 4, 5, mark);
  return m;
}

function serverRack(variant: "a" | "b" | "c" | "dark"): Model {
  const tall = variant !== "c";
  const h = tall ? 16 : 10;
  const m = new Model(8, h, 6);
  m.box(0, 0, 0, 7, h - 1, 5, variant === "dark" ? C.paint_black : C.metal_dark);
  m.box(0, h - 1, 0, 7, h - 1, 5, C.steel_dark);
  m.box(0, 0, 0, 7, 0, 5, C.black);
  for (let y = 1; y < h - 1; y++) {
    const unit = y % 3;
    if (unit === 0) m.box(1, y, 5, 6, y, 5, C.metal);
    else
      for (let x = 1; x <= 6; x++) {
        const k = fnv1a(`${variant}${x}${y}`);
        const led =
          variant === "dark"
            ? k % 9 === 0
              ? C.led_red
              : C.black
            : k % 5 === 0
              ? C.led_green
              : k % 7 === 0
                ? C.led_amber
                : k % 13 === 0
                  ? C.led_blue
                  : C.metal_dark;
        m.set(x, y, 5, led);
      }
  }
  if (variant === "b") {
    // Door open: cable spaghetti hanging out the front.
    m.box(7, 1, 5, 7, h - 2, 5, C.glass_dark);
    for (let y = 2; y < h - 3; y += 2)
      m.set(2 + (y % 4), y, 5, y % 4 ? C.cable_red : C.cable_yellow);
    m.box(3, 0, 5, 4, 0, 5, C.cable_black);
  }
  if (variant === "c") {
    // Tape drives.
    m.box(1, 4, 5, 6, 7, 5, C.black);
    disc(m, 2, 6, 1, 5, C.white);
    disc(m, 5, 6, 1, 5, C.white);
    m.set(2, 6, 5, C.black).set(5, 6, 5, C.black);
  }
  // Rear: louvred door, cable bundle, PSUs with status LEDs, an asset tag.
  for (let y = 3; y < h - 2; y += 2) m.box(1, y, 0, 4, y, 0, C.black);
  m.box(5, 1, 0, 5, h - 2, 0, C.cable_black);
  m.box(6, 1, 0, 6, h - 2, 0, variant === "dark" ? C.cable_red : C.cable_yellow);
  m.box(1, 1, 0, 3, 1, 0, C.steel_dark).set(4, 1, 0, variant === "dark" ? C.led_red : C.led_green);
  m.set(2, h - 2, 0, C.paper);
  return m;
}

/** Server rack with a few status LEDs that blink as separate parts. */
function serverRackDef(
  id: string,
  variant: "a" | "b" | "c" | "dark",
  light?: DecorLight,
): DecorDef {
  return rich(id, light ? { solid: true, light } : { solid: true }, () => {
    const m = serverRack(variant);
    const parts: AnimPart[] = [];
    const rows = variant === "c" ? [2, 8] : [2, 5, 11, 14];
    rows.forEach((y, i) => {
      const x = 1 + ((i * 3 + 5) % 6);
      m.set(x, y, 5, 0);
      const c = variant === "dark" ? C.led_red : i % 2 ? C.led_amber : C.led_green;
      parts.push(
        part(`led${i}`, blob(1, 1, 1, c), [x + 0.5, y + 0.5, 5.5], "blink", {
          speed: variant === "dark" ? 0.3 : 1.3 + i * 0.7,
          amplitude: variant === "dark" ? 0.15 : 0.5,
          phase: i * 1.7,
          power: variant !== "dark",
        }),
      );
    });
    return { model: m, parts };
  });
}

// ── Library ──────────────────────────────────────────────────────

const LIST: DecorDef[] = [
  // ── Office & quarters ──
  {
    id: "whiteboard",
    solid: false,
    wall: true,
    elevation: 1,
    model: () => {
      const m = new Model(14, 10, 2);
      m.box(0, 0, 0, 13, 9, 0, C.aluminium);
      m.box(1, 1, 1, 12, 8, 1, C.paint_white);
      scribble(m, 2, 3, 11, 8, 1, [C.blue_paint, C.book_red, C.black, C.green_paint], "wb", 4);
      m.box(2, 6, 1, 7, 6, 1, C.blue_paint).set(8, 6, 1, C.black); // E = mc²-ish line
      m.box(0, 0, 1, 13, 0, 1, C.metal).set(4, 0, 1, C.book_red).set(6, 0, 1, C.blue_paint);
      return m;
    },
  },
  {
    id: "cork_board",
    solid: false,
    wall: true,
    elevation: 1.5,
    model: () => {
      const m = new Model(12, 9, 2);
      m.box(0, 0, 0, 11, 8, 0, C.wood_dark);
      m.box(1, 1, 0, 10, 7, 0, C.cardboard);
      const notes = [
        [2, 5, C.paper],
        [6, 6, C.paper_yellow],
        [9, 4, C.paper_pink],
        [3, 2, C.paper_blue],
        [7, 2, C.paper],
      ] as const;
      for (const [x, y, c] of notes) m.box(x - 1, y - 1, 1, x, y, 1, c).set(x, y, 1, C.red_paint);
      // Red strings between the pins.
      m.box(3, 5, 1, 5, 5, 1, C.fabric_red).box(6, 3, 1, 6, 5, 1, C.fabric_red);
      m.box(4, 3, 1, 5, 3, 1, C.fabric_red).box(7, 4, 1, 8, 4, 1, C.fabric_red);
      return m;
    },
  },
  {
    id: "poster_halo",
    solid: false,
    wall: true,
    elevation: 2,
    model: () =>
      sign(6, 8, C.paint_navy, (m) => {
        for (let a = 0; a < 16; a++) {
          const x = Math.round(2.5 + Math.cos((a / 16) * Math.PI * 2) * 2);
          const y = Math.round(5 + Math.sin((a / 16) * Math.PI * 2) * 1.4);
          m.set(x, y, 0, C.halo_glow);
        }
        m.box(2, 1, 0, 3, 3, 0, C.paper).box(1, 0, 0, 4, 0, 0, C.wall_trim);
      }),
    light: L([2.5, 5, 1], "#fff4c8", 1.5, 3, false),
  },
  {
    id: "poster_unstable",
    solid: false,
    wall: true,
    elevation: 2,
    model: () =>
      sign(6, 8, C.black, (m) => {
        // "KEEP THE LAB UNSTABLE" — amber header, glitchy crystal, text lines.
        m.box(0, 7, 0, 5, 7, 0, C.wall_trim);
        m.box(2, 3, 0, 3, 5, 0, C.crystal_violet)
          .set(1, 4, 0, C.neon_magenta)
          .set(4, 5, 0, C.cerulean);
        for (let x = 0; x < 6; x++) m.set(x, 1, 0, x % 2 ? C.wall_trim : C.paper);
        m.box(1, 6, 0, 4, 6, 0, C.paper);
      }),
  },
  {
    id: "poster_safety",
    solid: false,
    wall: true,
    elevation: 2,
    model: () =>
      sign(6, 8, C.paint_white, (m) => {
        m.box(0, 7, 0, 5, 7, 0, C.safety_green);
        m.box(2, 3, 0, 3, 6, 0, C.safety_green).box(1, 4, 0, 4, 5, 0, C.safety_green);
        for (let y = 0; y < 2; y++) m.box(1, y, 0, 4, y, 0, C.paint_gray);
      }),
  },
  {
    id: "bookshelf",
    solid: true,
    model: () => {
      const m = new Model(12, 14, 4);
      m.box(0, 0, 0, 11, 13, 3, C.walnut);
      m.box(1, 1, 1, 10, 12, 3, 0);
      for (const y of [0, 4, 8, 13]) m.box(0, y, 0, 11, y, 3, C.wood);
      books(m, 1, 10, 1, 3, 1, 3, 1);
      books(m, 1, 10, 5, 3, 1, 3, 2);
      books(m, 1, 7, 9, 3, 1, 3, 3);
      m.box(8, 9, 2, 10, 9, 3, C.paper).set(9, 10, 2, C.crystal_rose);
      // Back board: planks, gaps that show the spines, an inventory tag.
      for (let x = 1; x <= 10; x += 3) m.box(x, 1, 0, x, 12, 0, C.wood_dark);
      for (const [x, y] of [
        [5, 1],
        [8, 5],
        [2, 9],
        [6, 9],
      ] as const)
        m.box(x, y, 0, x, y + 1, 0, 0);
      m.set(9, 11, 0, C.paper);
      return m;
    },
  },
  rich("crt_stack", { solid: true, light: L([5, 8, 6], "#66ffcc", 4, 6) }, () => {
    const m = new Model(10, 11, 6);
    m.box(0, 0, 0, 9, 2, 5, C.metal_dark);
    const screens: ScreenSpec[] = [];
    const crt = (x0: number, y0: number, w: number, content: ScreenContent, color: string) => {
      m.box(x0, y0, 0, x0 + w - 1, y0 + 3, 5, C.beige);
      m.box(x0 + 1, y0 + 1, 0, x0 + w - 2, y0 + 3, 1, C.concrete_light);
      screens.push(screenWell(m, x0 + 1, y0 + 1, x0 + w - 2, y0 + 2, 5, { content, color }));
    };
    crt(0, 3, 5, "log", "#33FF33");
    crt(5, 3, 5, "bars", "#FFAA00");
    crt(2, 7, 6, "status", "#00FFFF");
    m.set(8, 1, 5, C.led_green).set(1, 1, 5, C.cable_black);
    // Backs: vent slots on the tube caps, cords down to a strip on the base.
    for (const [x0, y0, w] of [
      [0, 3, 5],
      [5, 3, 5],
      [2, 7, 6],
    ] as const) {
      m.box(x0 + 1, y0 + 2, 0, x0 + w - 2, y0 + 2, 0, C.black);
      m.box(x0 + w - 2, 1, 0, x0 + w - 2, y0, 0, C.cable_black);
    }
    m.box(1, 1, 0, 8, 1, 0, C.paint_white).set(2, 1, 0, C.led_red);
    return { model: m, screens };
  }),
  serverRackDef("server_rack_a", "a", L([4, 8, 6], "#33ff88", 2.5, 5)),
  serverRackDef("server_rack_b", "b"),
  serverRackDef("server_rack_c", "c"),
  serverRackDef("server_rack_dark", "dark"),
  {
    id: "cable_tray",
    solid: false,
    wall: true,
    elevation: 4.5,
    model: () => {
      const m = new Model(16, 2, 2);
      m.box(0, 0, 0, 15, 0, 1, C.steel_dark);
      m.box(0, 1, 1, 15, 1, 1, C.metal);
      for (let x = 0; x < 16; x++)
        m.set(x, 1, 0, x % 5 === 0 ? C.cable_red : x % 3 ? C.cable_black : C.cable_yellow);
      return m;
    },
  },
  {
    id: "pipe_straight",
    solid: false,
    wall: true,
    elevation: 3,
    model: () => {
      const m = new Model(16, 4, 2);
      m.box(0, 0, 0, 15, 1, 1, C.copper).box(0, 2, 0, 15, 3, 1, C.steel);
      for (const x of [2, 13]) m.box(x, 0, 0, x, 3, 1, C.metal_dark);
      m.box(7, 0, 1, 8, 1, 1, C.brass);
      return m;
    },
  },
  {
    id: "pipe_elbow",
    solid: false,
    wall: true,
    elevation: 0,
    model: () => {
      const m = new Model(8, 12, 2);
      m.box(0, 0, 0, 1, 9, 1, C.steel).box(0, 8, 0, 7, 9, 1, C.steel);
      m.box(0, 7, 0, 2, 10, 1, C.metal_dark).box(0, 0, 0, 2, 0, 1, C.metal_dark);
      m.set(5, 10, 1, C.led_amber);
      return m;
    },
  },
  {
    id: "pipe_valve",
    solid: false,
    wall: true,
    elevation: 2,
    model: () => {
      const m = new Model(10, 7, 2);
      m.box(0, 2, 0, 9, 3, 0, C.copper);
      m.box(4, 1, 0, 5, 4, 1, C.brass);
      for (let a = 0; a < 12; a++) {
        const x = Math.round(4.5 + Math.cos((a / 12) * Math.PI * 2) * 2.5);
        const y = Math.round(2.5 + Math.sin((a / 12) * Math.PI * 2) * 2.5);
        m.set(x, y, 1, C.red_paint);
      }
      m.set(8, 5, 0, C.white).set(8, 6, 0, C.black); // gauge
      return m;
    },
  },
  {
    id: "pipe_riser",
    solid: false,
    wall: true,
    elevation: 0,
    model: () => {
      const m = new Model(4, 12, 2);
      m.box(0, 0, 0, 1, 11, 1, C.steel).box(2, 0, 0, 3, 11, 1, C.copper);
      for (const y of [3, 7, 11]) m.box(0, y, 0, 3, y, 1, C.metal_dark);
      return m;
    },
  },
  {
    id: "wall_vent",
    solid: false,
    wall: true,
    elevation: 1,
    model: () => {
      const m = new Model(6, 4, 1);
      m.box(0, 0, 0, 5, 3, 0, C.steel_dark);
      for (let y = 1; y <= 2; y++) m.box(1, y, 0, 4, y, 0, y % 2 ? C.black : C.metal);
      return m;
    },
  },
  { id: "barrel", solid: true, model: () => barrelModel(C.safety_blue, C.metal_dark, C.steel) },
  {
    id: "barrel_rust",
    solid: true,
    model: () => barrelModel(C.iron_rust, C.rust, C.rust, C.hazard_black),
  },
  {
    id: "barrel_toxic",
    solid: true,
    model: () => {
      const m = barrelModel(C.safety_yellow, C.hazard_black, C.metal, C.hazard_black);
      m.set(2, 7, 2, C.liquid_green).set(3, 7, 3, C.liquid_green);
      return m;
    },
    light: L([2.5, 8, 2.5], "#39ff88", 2, 4, false),
  },
  {
    id: "crate_stack",
    solid: true,
    model: () => {
      const m = new Model(10, 10, 8);
      const crate = (x0: number, y0: number, z0: number, s: number, c: number) => {
        m.box(x0, y0, z0, x0 + s - 1, y0 + s - 1, z0 + s - 1, c);
        m.box(x0, y0, z0 + s - 1, x0 + s - 1, y0, z0 + s - 1, C.wood_dark);
        m.box(x0, y0 + s - 1, z0 + s - 1, x0 + s - 1, y0 + s - 1, z0 + s - 1, C.wood_dark);
        m.box(x0, y0, z0 + s - 1, x0, y0 + s - 1, z0 + s - 1, C.wood_dark);
        m.box(x0 + s - 1, y0, z0 + s - 1, x0 + s - 1, y0 + s - 1, z0 + s - 1, C.wood_dark);
      };
      crate(0, 0, 0, 5, C.wood_light);
      crate(5, 0, 1, 5, C.cardboard);
      crate(2, 5, 1, 5, C.wood_light);
      m.box(6, 2, 7, 8, 3, 7, C.hazard_black).set(7, 3, 7, C.wall_trim);
      return m;
    },
  },
  {
    id: "pallet",
    solid: true,
    model: () => {
      const m = new Model(10, 7, 8);
      for (const z of [0, 3, 7]) m.box(0, 0, z, 9, 0, z, C.wood);
      for (let x = 0; x < 10; x += 2) m.box(x, 1, 0, x, 1, 7, C.wood_light);
      m.box(1, 2, 1, 8, 5, 6, C.cardboard);
      m.box(1, 6, 1, 8, 6, 6, C.glass); // shrink wrap
      m.box(4, 2, 6, 5, 5, 6, C.paper).box(1, 3, 1, 8, 3, 6, C.cardboard);
      return m;
    },
  },
  {
    id: "pallet_empty",
    solid: false,
    model: () => {
      const m = new Model(10, 1, 8);
      for (const z of [0, 1, 3, 4, 6, 7])
        m.box(0, 0, z, 9, 0, z, z % 3 === 0 ? C.wood : C.wood_light);
      return m;
    },
  },
  {
    id: "tool_cart",
    solid: true,
    top: 8,
    model: () => {
      const m = new Model(8, 8, 5);
      m.box(0, 1, 0, 7, 6, 4, C.safety_red);
      for (const y of [2, 4, 6])
        m.box(0, y, 4, 7, y, 4, C.red_paint).set(3, y, 4, C.chrome).set(4, y, 4, C.chrome);
      m.box(0, 7, 0, 7, 7, 4, C.metal_dark);
      m.set(1, 7, 1, C.steel).box(3, 7, 2, 6, 7, 2, C.steel).set(5, 7, 3, C.safety_yellow);
      m.box(2, 3, 0, 4, 5, 0, C.paper).set(3, 6, 0, C.metal_dark); // clipboard on the back
      for (const [x, z] of [
        [0, 0],
        [7, 0],
        [0, 4],
        [7, 4],
      ] as const)
        m.set(x, 0, z, C.rubber);
      return m;
    },
  },
  {
    id: "vice_bench",
    solid: true,
    top: 6,
    model: () => {
      const m = table(12, 9, 6, 5, C.wood, C.steel_dark);
      m.box(1, 1, 1, 10, 1, 4, C.metal_dark); // lower shelf
      m.box(2, 2, 2, 4, 3, 3, C.cardboard);
      m.box(9, 6, 2, 10, 7, 4, C.blue_paint).box(9, 8, 1, 10, 8, 5, C.steel); // vice
      m.box(3, 6, 2, 6, 6, 2, C.steel).set(4, 6, 4, C.red_paint).set(7, 6, 3, C.copper);
      m.box(3, 0, 0, 6, 0, 0, C.paint_white).set(4, 0, 0, C.led_red); // power strip behind
      m.box(7, 0, 0, 10, 0, 0, C.cable_black);
      return m;
    },
  },
  {
    id: "locker_row",
    solid: true,
    model: () => {
      const m = new Model(15, 12, 5);
      for (let i = 0; i < 3; i++) {
        const x0 = i * 5;
        const body = [C.olive, C.paint_teal, C.olive][i]!;
        m.box(x0, 0, 0, x0 + 4, 11, 4, body);
        m.box(x0 + 1, 1, 4, x0 + 3, 10, 4, C.wall_olive);
        for (let y = 8; y <= 10; y++)
          m.box(x0 + 1, y, 4, x0 + 3, y, 4, y % 2 ? C.black : C.wall_olive);
        m.set(x0 + 3, 5, 4, C.metal_light);
        m.box(x0 + 4, 0, 4, x0 + 4, 11, 4, C.metal_dark);
      }
      m.box(6, 10, 4, 8, 10, 4, C.paper_yellow); // name tag
      // Backs: panel joints, rivets, an inspection sticker.
      for (let i = 0; i < 3; i++) {
        m.box(i * 5 + 4, 0, 0, i * 5 + 4, 11, 0, C.metal_dark);
        m.set(i * 5 + 1, 10, 0, C.steel).set(i * 5 + 3, 1, 0, C.steel);
      }
      m.set(7, 6, 0, C.paper_blue).set(12, 3, 0, C.rust);
      return m;
    },
  },
  {
    id: "lab_table",
    solid: true,
    top: 6,
    model: () => {
      const m = new Model(14, 10, 7);
      m.box(0, 0, 0, 13, 4, 6, C.paint_white);
      m.box(0, 5, 0, 13, 5, 6, C.tile_black);
      for (let x = 1; x < 13; x += 4)
        m.box(x, 1, 6, x + 2, 3, 6, C.steel).set(x + 1, 3, 6, C.chrome);
      flask(m, 2, 3, 6, C.liquid_green, 2);
      flask(m, 4, 2, 6, C.liquid_blue, 3);
      flask(m, 6, 4, 6, C.liquid_pink, 1);
      m.box(8, 6, 1, 12, 6, 1, C.steel).box(9, 7, 1, 9, 9, 1, C.steel); // rack
      flask(m, 10, 1, 7, C.liquid_green, 1);
      flask(m, 12, 1, 7, C.liquid_blue, 1);
      m.box(9, 6, 4, 11, 6, 5, C.paper).set(12, 6, 5, C.glass);
      // Services on the back: gas line with a tap, drain pipe.
      m.box(1, 2, 0, 12, 2, 0, C.copper).set(3, 2, 0, C.safety_red);
      m.box(11, 0, 0, 11, 4, 0, C.steel);
      return m;
    },
    light: L([4, 8, 3], "#3fd0ff", 3, 5, false),
  },
  {
    id: "fume_hood",
    solid: true,
    model: () => {
      const m = new Model(12, 16, 7);
      m.box(0, 0, 0, 11, 5, 6, C.paint_white);
      m.box(0, 6, 0, 11, 6, 6, C.tile_black);
      m.box(0, 7, 0, 0, 13, 6, C.paint_white).box(11, 7, 0, 11, 13, 6, C.paint_white);
      m.box(0, 7, 0, 11, 13, 0, C.paint_white);
      m.box(0, 13, 0, 11, 15, 6, C.paint_white);
      m.box(1, 10, 6, 10, 12, 6, C.glass);
      m.box(1, 14, 6, 10, 14, 6, C.safety_yellow).set(9, 14, 6, C.led_green);
      m.box(5, 15, 1, 6, 15, 3, C.steel);
      flask(m, 3, 3, 7, C.liquid_pink, 2);
      flask(m, 7, 2, 7, C.liquid_green, 3);
      for (let x = 1; x < 11; x += 5)
        m.box(x, 1, 6, x + 3, 4, 6, C.steel).set(x + 2, 3, 6, C.chrome);
      m.box(1, 12, 1, 10, 12, 1, C.lamp_cold);
      m.box(5, 7, 0, 6, 15, 0, C.steel); // exhaust duct down the back
      m.box(1, 2, 0, 3, 3, 0, C.paper).set(9, 2, 0, C.black);
      return m;
    },
    light: L([6, 12, 3], "#cfe8ff", 4, 6),
  },
  rich("coffee_machine", { solid: true, light: L([4, 9, 5], "#b060ff", 5, 5) }, () => {
    // Jade's coffee maker, still plugged into the singularity bus.
    const m = new Model(8, 11, 5);
    m.box(0, 0, 0, 7, 4, 4, C.wood_dark); // cabinet
    m.box(0, 4, 0, 7, 4, 4, C.tile_black);
    m.box(1, 5, 0, 6, 10, 3, C.chrome);
    m.box(2, 6, 3, 5, 7, 4, C.black);
    m.box(3, 5, 3, 4, 5, 4, C.ceramic).set(3, 6, 4, C.coffee);
    m.box(2, 9, 4, 5, 9, 4, C.abstractum); // singularity-bus coupling glow
    m.set(6, 8, 4, C.led_green).set(6, 9, 4, C.led_red);
    m.box(1, 10, 1, 6, 10, 2, C.glass_amber);
    m.box(7, 0, 1, 7, 4, 1, C.cable_black).box(7, 0, 1, 7, 0, 4, C.neon_purple);
    m.box(2, 6, 0, 5, 9, 0, C.glass).box(2, 6, 0, 5, 6, 0, C.water); // rear water tank
    for (let x = 1; x <= 6; x += 2) m.set(x, 2, 0, C.black);
    return {
      model: m,
      parts: [
        part("steam", wisp(4, C.coat_white, 7), [3.5, 13, 1.5], "bob", {
          speed: 0.4,
          amplitude: 0.8,
        }),
        part("steam2", wisp(3, C.glass, 8), [5, 12.5, 2], "bob", {
          speed: 0.55,
          amplitude: 0.7,
          phase: 2.1,
        }),
      ],
    };
  }),
  {
    id: "bunk_bed",
    solid: true,
    model: () => {
      const m = new Model(12, 13, 6);
      for (const [x, z] of [
        [0, 0],
        [11, 0],
        [0, 5],
        [11, 5],
      ] as const)
        m.box(x, 0, z, x, 12, z, C.steel_dark);
      for (const y of [2, 8]) {
        m.box(0, y, 0, 11, y, 5, C.metal);
        m.box(1, y + 1, 0, 10, y + 1, 5, y === 2 ? C.fabric_blue : C.fabric_green);
        m.box(1, y + 2, 1, 3, y + 2, 4, C.paint_white);
      }
      for (let y = 3; y <= 8; y += 2) m.box(11, y, 5, 11, y, 5, C.steel);
      m.box(11, 10, 0, 11, 12, 5, C.steel_dark);
      return m;
    },
  },
  {
    id: "rug_round",
    solid: false,
    model: () => {
      const m = new Model(12, 1, 12);
      m.cyl(5.5, 5.5, 5.5, 0, 0, C.carpet_blue);
      m.ring(5.5, 5.5, 3.5, 0, C.fabric_mustard);
      m.cyl(5.5, 5.5, 1.5, 0, 0, C.fabric_blue);
      return m;
    },
  },
  {
    id: "first_aid",
    solid: false,
    wall: true,
    elevation: 3,
    model: () =>
      sign(5, 4, C.paint_white, (m) => {
        m.box(2, 0, 0, 2, 3, 0, C.safety_green).box(1, 1, 0, 3, 2, 0, C.safety_green);
        m.box(0, 0, 0, 4, 0, 0, C.safety_green);
      }),
  },
  {
    id: "exit_sign",
    solid: false,
    wall: true,
    elevation: 4.5,
    model: () => {
      const m = new Model(6, 3, 1);
      m.box(0, 0, 0, 5, 2, 0, C.safety_green);
      m.box(1, 1, 0, 3, 1, 0, C.screen_white).set(4, 1, 0, C.led_green);
      m.set(1, 0, 0, C.led_green).set(3, 2, 0, C.led_green);
      return m;
    },
    light: L([3, 1, 1], "#00ff66", 2.5, 4),
  },
  {
    id: "warning_cones",
    solid: false,
    model: () => {
      const m = new Model(7, 4, 5);
      for (const [cx, cz] of [
        [1.5, 1.5],
        [5, 3],
      ] as const) {
        m.box(
          Math.floor(cx) - 1,
          0,
          Math.floor(cz) - 1,
          Math.floor(cx) + 1,
          0,
          Math.floor(cz) + 1,
          C.safety_orange,
        );
        m.box(
          Math.floor(cx),
          1,
          Math.floor(cz),
          Math.floor(cx),
          3,
          Math.floor(cz),
          C.safety_orange,
        );
        m.set(Math.floor(cx), 2, Math.floor(cz), C.paint_white);
      }
      return m;
    },
  },
  {
    id: "broken_glass",
    solid: false,
    model: () => {
      const m = new Model(6, 1, 6);
      for (let i = 0; i < 12; i++)
        m.set((i * 5) % 6, 0, (i * 7) % 6, i % 3 ? C.glass : C.glass_dark);
      return m;
    },
  },
  {
    id: "gas_cylinders",
    solid: true,
    model: () => {
      const m = new Model(9, 13, 4);
      const tint = [C.safety_green, C.paint_gray, C.safety_blue] as const;
      for (let i = 0; i < 3; i++) {
        const cx = 1 + i * 3;
        m.cyl(cx, 1.5, 1.2, 0, 10, tint[i]!);
        m.box(cx, 11, 1, cx, 12, 2, C.brass);
      }
      m.box(0, 6, 3, 8, 6, 3, C.metal_dark).box(0, 6, 0, 8, 6, 0, C.metal_dark);
      return m;
    },
  },
  {
    id: "generator",
    solid: true,
    model: () => {
      const m = new Model(14, 9, 8);
      m.box(0, 0, 0, 13, 0, 7, C.metal_dark);
      m.box(1, 1, 1, 10, 6, 6, C.safety_yellow);
      m.box(1, 7, 2, 10, 7, 5, C.hazard_black);
      for (let y = 2; y <= 5; y++) m.box(2, y, 7, 9, y, 7, y % 2 ? C.black : C.metal);
      m.cyl(12, 3.5, 1.5, 1, 7, C.metal);
      m.box(12, 8, 3, 12, 8, 4, C.rust);
      m.set(3, 6, 7, C.led_amber).set(5, 6, 7, C.led_green);
      // Rear: exhaust stack, louvres, fuel cap.
      m.box(2, 1, 0, 3, 8, 0, C.metal).set(2, 8, 0, C.rust).set(3, 8, 0, C.black);
      for (let y = 2; y <= 5; y += 2) m.box(5, y, 1, 9, y, 1, C.black);
      m.set(8, 7, 1, C.safety_red);
      return m;
    },
    light: L([4, 6, 8], "#ffb800", 2, 4),
  },
  rich("transformer", { solid: true }, () => {
    const m = new Model(10, 13, 8);
    m.box(0, 0, 0, 9, 9, 7, C.paint_gray);
    for (let x = 0; x < 10; x += 2) m.box(x, 1, 7, x, 8, 7, C.metal_dark);
    for (const x of [2, 5, 8]) {
      m.box(x, 10, 3, x, 11, 4, C.ceramic).set(x, 12, 3, C.copper);
    }
    m.box(3, 5, 7, 6, 7, 7, C.safety_yellow).set(4, 6, 7, C.black).set(5, 6, 7, C.black);
    m.set(1, 9, 7, 0); // socket for the blinking fault LED
    for (let x = 0; x < 10; x += 2) m.box(x, 1, 0, x, 8, 0, C.metal_dark); // rear fins
    m.box(3, 5, 0, 6, 7, 0, C.safety_yellow).set(4, 6, 0, C.black).set(5, 6, 0, C.black);
    m.box(9, 0, 3, 9, 9, 3, C.cable_black);
    m.box(1, 2, 7, 2, 3, 7, C.paper).set(8, 0, 7, C.iron_rust); // rating plate, rust foot
    return {
      model: m,
      parts: [
        part("fault", blob(1, 1, 1, C.led_red), [1.5, 9.5, 7.5], "blink", {
          speed: 0.9,
          amplitude: 0.3,
          power: true,
        }),
      ],
    };
  }),
  {
    id: "lever_panel",
    solid: false,
    wall: true,
    elevation: 1,
    model: () => {
      const m = new Model(8, 10, 2);
      m.box(0, 0, 0, 7, 9, 0, C.steel_dark);
      for (let i = 0; i < 3; i++) {
        const x = 1 + i * 3;
        m.box(x, 2, 1, x, 6, 1, C.metal_dark);
        m.set(x, i === 1 ? 3 : 6, 1, C.red_paint);
      }
      m.box(1, 8, 1, 6, 8, 1, C.hazard_black).set(2, 8, 1, C.wall_trim).set(5, 8, 1, C.wall_trim);
      m.set(6, 0, 1, C.led_green);
      return m;
    },
  },
  {
    id: "drone_pad",
    solid: false,
    model: () => {
      const m = new Model(12, 1, 12);
      m.box(0, 0, 0, 11, 0, 11, C.asphalt);
      m.ring(5.5, 5.5, 5, 0, C.safety_yellow);
      m.box(3, 0, 5, 8, 0, 6, C.paint_white)
        .box(3, 0, 3, 3, 0, 8, C.paint_white)
        .box(8, 0, 3, 8, 0, 8, C.paint_white);
      for (const [x, z] of [
        [0, 0],
        [11, 0],
        [0, 11],
        [11, 11],
      ] as const)
        m.set(x, 0, z, C.led_green);
      return m;
    },
    light: L([6, 1, 6], "#00ff66", 3, 6),
  },
  {
    id: "drone_parked",
    solid: true,
    model: () => {
      const m = new Model(9, 4, 9);
      m.box(3, 0, 3, 5, 2, 5, C.bot_body).set(4, 1, 5, C.led_red);
      for (const [x, z] of [
        [1, 1],
        [7, 1],
        [1, 7],
        [7, 7],
      ] as const) {
        m.box(Math.min(x, 4), 2, Math.min(z, 4), Math.max(x, 4), 2, Math.max(z, 4), C.bot_dark);
        m.box(x - 1, 3, z, x + 1, 3, z, C.black).box(x, 3, z - 1, x, 3, z + 1, C.black);
      }
      m.box(3, 0, 2, 3, 0, 6, C.steel_dark).box(5, 0, 2, 5, 0, 6, C.steel_dark);
      return m;
    },
  },
  {
    id: "rotor_pile",
    solid: false,
    model: () => {
      const m = new Model(8, 2, 6);
      m.box(0, 0, 1, 7, 0, 1, C.bot_dark)
        .box(1, 1, 3, 6, 1, 3, C.black)
        .box(2, 0, 4, 2, 0, 5, C.bot_body);
      m.box(4, 0, 0, 7, 0, 0, C.safety_orange).set(5, 0, 5, C.cable_red);
      return m;
    },
  },
  {
    id: "bot_dock",
    solid: true,
    model: () => {
      const m = new Model(8, 13, 6);
      m.box(0, 0, 0, 7, 1, 5, C.metal_dark);
      m.box(0, 2, 0, 7, 12, 1, C.bot_dark);
      m.box(1, 3, 2, 1, 10, 2, C.steel).box(6, 3, 2, 6, 10, 2, C.steel);
      m.box(3, 9, 2, 4, 10, 3, C.chrome).set(3, 11, 1, C.led_green).set(4, 11, 1, C.led_green);
      m.box(2, 1, 2, 5, 1, 5, C.liquid_blue);
      m.box(1, 12, 0, 6, 12, 1, C.safety_yellow);
      for (let y = 4; y <= 8; y += 2) m.box(2, y, 0, 5, y, 0, C.black); // rear vents
      m.box(6, 0, 0, 6, 3, 0, C.cable_black).set(1, 10, 0, C.paper);
      return m;
    },
    light: L([4, 2, 4], "#3fd0ff", 3, 5),
  },
  {
    id: "battery_rack",
    solid: true,
    model: () => {
      const m = new Model(12, 12, 5);
      m.box(0, 0, 0, 0, 11, 4, C.steel_dark).box(11, 0, 0, 11, 11, 4, C.steel_dark);
      for (const y of [0, 4, 8, 11]) m.box(0, y, 0, 11, y, 4, C.metal);
      for (const y of [1, 5, 9])
        for (let x = 1; x <= 9; x += 2) {
          const h = fnv1a(`bat${x}${y}`);
          m.box(x, y, 1, x + 1, y + 2, 3, C.paint_black);
          m.set(x, y + 2, 4, h % 4 === 0 ? C.led_red : h % 3 === 0 ? C.led_amber : C.led_green);
        }
      // Rear: a copper bus bar per shelf with the cell leads.
      for (const y of [1, 5, 9]) {
        m.box(1, y + 2, 0, 10, y + 2, 0, C.copper);
        for (let x = 1; x <= 9; x += 2)
          m.set(x, y + 1, 0, C.cable_red).set(x + 1, y + 1, 0, C.cable_black);
      }
      return m;
    },
  },
  {
    id: "specimen_jars",
    solid: true,
    model: () => {
      const m = new Model(10, 10, 4);
      m.box(0, 0, 0, 9, 0, 3, C.walnut).box(0, 5, 0, 9, 5, 3, C.walnut);
      m.box(0, 0, 0, 0, 9, 0, C.walnut)
        .box(9, 0, 0, 9, 9, 0, C.walnut)
        .box(0, 9, 0, 9, 9, 3, C.walnut);
      const liquids = [C.liquid_green, C.liquid_pink, C.liquid_blue, C.abstractum];
      for (const y of [1, 6])
        for (let i = 0; i < 3; i++) {
          const x = 1 + i * 3;
          m.box(x, y, 1, x + 1, y + 2, 2, C.glass);
          m.set(x, y, 1, liquids[(i + y) % 4]!).set(x + 1, y + 1, 2, liquids[(i + y + 1) % 4]!);
          m.box(x, y + 3, 1, x + 1, y + 3, 2, C.metal);
        }
      return m;
    },
    light: L([5, 4, 4], "#39ff88", 3, 5, false),
  },
  rich("holo_table", { solid: true, light: L([6, 7, 6], "#00ffff", 7, 8) }, () => {
    const m = new Model(12, 10, 12);
    m.cyl(5.5, 5.5, 5.5, 0, 3, C.metal_dark);
    m.cyl(5.5, 5.5, 5.5, 4, 4, C.steel);
    m.ring(5.5, 5.5, 4.5, 4, C.cerulean);
    m.cyl(5.5, 5.5, 2, 5, 5, C.holo_cyan);
    m.sphere(5.5, 7.5, 5.5, 2, C.holo_white);
    return {
      model: m,
      parts: [
        part("orbit_ring", ringModel(3, "xz", C.holo_cyan, C.holo_white), [6, 7.5, 6], "spin", {
          speed: 0.8,
          power: true,
        }),
        part("meridian", ringModel(2.6, "xy", C.holo_cyan), [6, 8, 6], "spin", {
          speed: -0.5,
          power: true,
        }),
        part("blip", blob(1, 1, 1, C.led_amber), [6, 8.5, 6], "orbit", {
          speed: 1.4,
          amplitude: 2.4,
          power: true,
        }),
      ],
    };
  }),
  {
    id: "telescope",
    solid: true,
    model: () => {
      const m = new Model(8, 16, 8);
      m.box(1, 0, 1, 1, 6, 1, C.wood_dark)
        .box(6, 0, 1, 6, 6, 1, C.wood_dark)
        .box(3, 0, 6, 4, 6, 6, C.wood_dark);
      m.box(3, 7, 3, 4, 7, 4, C.brass);
      // Tube tilted up towards +z (the sky).
      for (let i = 0; i < 6; i++)
        m.box(3, 8 + i, 1 + i, 4, 9 + i, 2 + i, i === 5 ? C.glass : C.brass);
      m.box(3, 7, 0, 4, 8, 0, C.black);
      return m;
    },
  },
  rich("antenna_mast", { solid: true, light: L([2.5, 23, 2.5], "#ff3333", 3, 6) }, () => {
    const m = new Model(6, 24, 6);
    m.box(0, 0, 0, 5, 1, 5, C.concrete);
    m.box(2, 2, 2, 3, 22, 3, C.steel);
    for (let y = 4; y < 18; y += 3) m.box(1, y, 1, 4, y, 4, C.metal_dark);
    m.box(0, 16, 2, 5, 16, 3, C.steel);
    m.box(1, 21, 1, 4, 21, 4, C.metal_dark);
    m.set(2, 23, 2, C.led_red).set(3, 23, 3, C.led_red);
    const dish = new Model(7, 5, 4);
    dish.box(3, 2, 0, 3, 2, 1, C.chrome);
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 7; x++) {
        const dd = (x - 3) ** 2 + ((y - 2) * 1.4) ** 2;
        if (dd <= 10) dish.set(x, y, 2, dd > 6 ? C.metal_light : C.steel);
      }
    dish.box(3, 2, 3, 3, 2, 3, C.led_red);
    return {
      model: m,
      parts: [
        part("radar", dish, [3, 19, 3], "spin", {
          speed: 0.6,
          power: true,
          pivot: [3.5, 2.5, -0.5],
        }),
      ],
    };
  }),
  {
    id: "crystal_cluster",
    solid: true,
    model: () => {
      const m = new Model(8, 11, 8);
      m.cyl(3.5, 3.5, 3.5, 0, 0, C.concrete_dark);
      const shards = [
        [3, 3, 9, C.crystal_violet],
        [1, 2, 5, C.crystal_cyan],
        [5, 5, 6, C.crystal_rose],
        [5, 1, 4, C.crystal_violet],
        [2, 6, 3, C.crystal_cyan],
      ] as const;
      for (const [x, z, h, c] of shards) {
        m.box(x, 1, z, x + 1, h, z + 1, c);
        m.set(x, h + 1, z, c);
      }
      m.box(3, 1, 3, 4, 4, 4, C.abstractum);
      return m;
    },
    light: L([3.5, 5, 3.5], "#b060ff", 6, 7, false),
  },
  {
    id: "cryo_tank",
    solid: true,
    model: () => {
      const m = new Model(8, 16, 8);
      m.cyl(3.5, 3.5, 3.5, 0, 1, C.steel_dark);
      m.cyl(3.5, 3.5, 3.5, 2, 12, C.ice, true);
      m.cyl(3.5, 3.5, 2.2, 2, 11, C.liquid_blue);
      m.cyl(3.5, 3.5, 3.5, 13, 15, C.steel);
      m.box(3, 14, 7, 4, 14, 7, C.led_blue).set(1, 1, 7, C.led_green);
      m.box(0, 5, 3, 0, 9, 4, C.coat_shadow);
      return m;
    },
    light: L([3.5, 8, 3.5], "#3fd0ff", 6, 7),
  },
  {
    id: "coolant_tank",
    solid: true,
    model: () => {
      const m = new Model(8, 14, 8);
      m.cyl(3.5, 3.5, 3.5, 0, 12, C.paint_teal);
      m.ring(3.5, 3.5, 3.5, 3, C.metal).ring(3.5, 3.5, 3.5, 9, C.metal);
      m.cyl(3.5, 3.5, 2, 13, 13, C.steel);
      // Frost crust.
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 8; x++)
          if (fnv1a(`frost${x}${y}`) % 3 === 0) m.set(x, y, 7, C.coat_white);
      m.box(3, 5, 7, 4, 6, 7, C.paint_white).set(3, 6, 7, C.black);
      return m;
    },
  },
  rich("frost_pipes", { solid: false, wall: true, elevation: 1.5 }, () => {
    const m = new Model(16, 5, 2);
    m.box(0, 0, 0, 15, 1, 1, C.paint_teal).box(0, 3, 0, 15, 4, 1, C.steel);
    for (let x = 0; x < 16; x++) {
      const h = fnv1a(`fp${x}`);
      if (h % 2 === 0) m.set(x, 1, 1, C.coat_white);
      if (h % 3 === 0) m.set(x, 4, 1, C.ice);
    }
    m.box(7, 0, 0, 8, 4, 1, C.metal_dark);
    m.set(4, 0, 1, C.ice).set(12, 0, 1, C.ice); // icicles
    return {
      model: m,
      parts: [
        ...drips("drip_a", [4.5, -0.5, 1.5], 3, 1, C.water, 0.7),
        ...drips("drip_b", [12.5, -0.5, 1.5], 3, 1, C.water, 0.55),
      ],
    };
  }),
  {
    id: "plasma_conduit",
    solid: false,
    wall: true,
    elevation: 0,
    model: () => {
      const m = new Model(4, 12, 2);
      m.box(0, 0, 0, 3, 11, 0, C.metal_dark);
      m.box(1, 0, 1, 2, 11, 1, C.plasma_blue);
      for (let y = 1; y < 12; y += 4) m.box(0, y, 1, 3, y, 1, C.steel);
      return m;
    },
    light: L([2, 6, 2], "#6ad4ff", 4, 6),
  },
  rich("tape_machine", { solid: true }, () => {
    const m = new Model(8, 13, 5);
    m.box(0, 0, 0, 7, 12, 4, C.steel_dark);
    m.box(0, 12, 0, 7, 12, 4, C.aluminium);
    m.box(1, 7, 4, 6, 7, 4, C.coffee); // tape path
    m.set(3, 8, 4, C.chrome).set(4, 8, 4, C.chrome); // heads
    m.leds(1, 6, 5, 4, [C.led_amber, C.black, C.led_green]);
    m.box(1, 1, 4, 6, 3, 4, C.metal).set(3, 2, 4, C.paint_white).set(4, 2, 4, C.paint_white);
    m.box(1, 8, 4, 6, 10, 4, 0).box(1, 8, 3, 6, 10, 3, C.black); // reel wells
    // Rear: vents, a connector strip, the mains cord.
    for (let y = 8; y <= 10; y += 2) m.box(1, y, 0, 6, y, 0, C.black);
    m.box(1, 3, 0, 6, 3, 0, C.metal_dark).set(2, 3, 0, C.brass).set(4, 3, 0, C.brass);
    m.box(6, 0, 0, 6, 2, 0, C.cable_black);
    const reel = (): Model => {
      const r = new Model(3, 3, 1).box(0, 0, 0, 2, 2, 0, C.paint_black);
      r.set(1, 1, 0, C.metal).set(1, 2, 0, C.aluminium).set(0, 0, 0, 0).set(2, 0, 0, 0);
      return r;
    };
    return {
      model: m,
      parts: [
        part("reel_l", reel(), [2.5, 9.5, 4.5], "spin", { speed: 2.2, axis: "z", power: true }),
        part("reel_r", reel(), [5.5, 9.5, 4.5], "spin", { speed: 1.6, axis: "z", power: true }),
      ],
    };
  }),
  {
    id: "speaker_stack",
    solid: true,
    model: () => {
      const m = new Model(8, 14, 6);
      for (const y0 of [0, 7]) {
        m.box(0, y0, 0, 7, y0 + 6, 5, C.paint_black);
        disc(m, 3.5, y0 + 3, 2.2, 5, C.metal_dark);
        m.box(3, y0 + 2, 5, 4, y0 + 4, 5, C.rubber);
        m.set(1, y0 + 5, 5, C.metal_light).set(6, y0 + 5, 5, C.metal_light);
      }
      for (const y0 of [0, 7]) {
        m.box(2, y0 + 3, 0, 5, y0 + 5, 0, C.metal_dark).box(3, y0 + 4, 0, 4, y0 + 4, 0, C.black); // port
        m.box(5, y0 + 1, 0, 6, y0 + 1, 0, C.metal_light).set(5, y0 + 2, 0, C.safety_red);
      }
      m.box(6, 2, 0, 6, 8, 0, C.cable_red);
      return m;
    },
  },
  {
    id: "synth",
    solid: true,
    model: () => {
      const m = new Model(12, 8, 6);
      m.box(0, 0, 1, 0, 4, 1, C.steel_dark).box(11, 0, 1, 11, 4, 1, C.steel_dark);
      m.box(0, 0, 4, 0, 4, 4, C.steel_dark).box(11, 0, 4, 11, 4, 4, C.steel_dark);
      m.box(0, 5, 0, 11, 5, 5, C.wood);
      for (let x = 1; x < 11; x++) m.set(x, 6, 5, x % 3 === 2 ? C.black : C.paint_white);
      m.box(1, 6, 0, 10, 7, 3, C.paint_black);
      for (let x = 1; x < 11; x += 2)
        m.set(x, 7, 2, fnv1a(`syn${x}`) % 2 ? C.led_amber : C.screen_cyan);
      m.box(2, 6, 1, 9, 6, 1, C.cable_red);
      for (const x of [2, 4, 6]) m.set(x, 7, 0, C.brass); // rear jacks
      m.box(9, 0, 0, 9, 6, 0, C.cable_black);
      return m;
    },
    light: L([6, 8, 3], "#ffaa00", 2, 4),
  },
  {
    id: "radio",
    solid: true,
    model: () => {
      const m = table(6, 11, 5, 3, C.wood, C.wood_dark);
      m.box(0, 4, 1, 5, 7, 4, C.wood_red);
      m.box(1, 5, 4, 3, 6, 4, C.fabric_mustard).set(4, 6, 4, C.screen_amber).set(4, 5, 4, C.brass);
      m.box(5, 8, 2, 5, 10, 2, C.chrome);
      m.box(1, 5, 1, 4, 5, 1, C.black).box(1, 7, 1, 4, 7, 1, C.black); // back vents
      m.box(3, 0, 0, 3, 4, 0, C.cable_black);
      return m;
    },
    light: L([4, 6, 5], "#ffaa00", 1.5, 3),
  },
  {
    id: "chalkboard",
    solid: false,
    wall: true,
    elevation: 1,
    model: () => {
      const m = new Model(14, 10, 2);
      m.box(0, 0, 0, 13, 9, 0, C.wood);
      m.box(1, 1, 1, 12, 8, 1, C.fabric_green);
      scribble(m, 2, 2, 11, 7, 1, [C.paint_white, C.coat_shadow, C.paper_yellow], "chalk", 4);
      m.box(1, 0, 1, 12, 0, 1, C.wood_dark).set(3, 0, 1, C.paint_white);
      return m;
    },
  },
  rich("wall_clock", { solid: false, wall: true, elevation: 3.5 }, () => {
    const g = new Model(5, 5, 2);
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) {
        const dd = (x - 2) ** 2 + (y - 2) ** 2;
        if (dd <= 5.3) g.set(x, y, 0, dd >= 3.5 ? C.black : C.paint_white);
        if (dd <= 5.3 && dd >= 3.5) g.set(x, y, 1, C.black);
      }
    const hand = (len: number, c: number): Model =>
      new Model(1, len, 1).box(0, 0, 0, 0, len - 1, 0, c);
    const at: [number, number, number] = [2.5, 2.5, 1.5];
    return {
      model: g,
      parts: [
        part("hour", hand(1, C.black), at, "spin", {
          speed: -0.000145,
          axis: "z",
          pivot: [0.5, 0, 0.5],
          phase: 2.2,
        }),
        part("minute", hand(2, C.black), at, "spin", {
          speed: -0.00175,
          axis: "z",
          pivot: [0.5, 0, 0.5],
          phase: -0.9,
        }),
        part("second", hand(2, C.safety_red), at, "spin", {
          speed: -Math.PI / 30,
          axis: "z",
          pivot: [0.5, 0, 0.5],
        }),
      ],
    };
  }),
  rich(
    "beacon",
    { solid: false, wall: true, elevation: 4.5, light: L([1.5, 2, 1.5], "#ff3333", 3, 5) },
    () => {
      const m = new Model(3, 3, 2);
      m.box(0, 0, 0, 2, 0, 1, C.metal_dark);
      m.box(0, 1, 0, 2, 2, 1, C.glass_red).set(1, 1, 1, C.led_red);
      m.set(1, 2, 0, C.metal_dark); // cap screw
      return {
        model: m,
        parts: [
          // Rotating reflector behind the red dome.
          part("reflector", blob(1, 1, 1, C.led_red), [1.5, 2.5, 1.5], "orbit", {
            speed: 4,
            amplitude: 0.6,
            power: true,
          }),
        ],
      };
    },
  ),
  {
    id: "planter",
    solid: true,
    model: () => {
      const m = new Model(14, 9, 6);
      m.box(0, 0, 0, 13, 3, 5, C.wood);
      m.box(1, 3, 1, 12, 3, 4, C.soil);
      for (let x = 1; x < 13; x += 2) {
        const h = 2 + (fnv1a(`pl${x}`) % 3);
        m.box(x, 4, 2, x, 3 + h, 3, x % 4 === 1 ? C.leaf_light : C.plant_green);
        if (x % 6 === 1) m.set(x, 4 + h, 2, C.flower_yellow);
        if (x % 6 === 3) m.set(x, 4 + h, 3, C.flower_red);
      }
      m.box(0, 8, 2, 13, 8, 3, C.screen_purple); // grow light bar
      m.box(0, 4, 2, 0, 7, 3, C.steel).box(13, 4, 2, 13, 7, 3, C.steel);
      return m;
    },
    light: L([7, 8, 3], "#b070ff", 4, 5),
  },
  {
    id: "hazard_decal",
    solid: false,
    model: () => {
      const m = new Model(12, 1, 12);
      for (let z = 0; z < 12; z++)
        for (let x = 0; x < 12; x++) {
          const edge = x < 1 || z < 1 || x > 10 || z > 10;
          if (edge) m.set(x, 0, z, ((x + z) >> 1) % 2 ? C.safety_yellow : C.hazard_black);
        }
      return m;
    },
  },
  {
    id: "puddle",
    solid: false,
    model: () => {
      const m = new Model(8, 1, 6);
      m.cyl(3.5, 2.5, 2.8, 0, 0, C.water);
      m.set(0, 0, 2, C.water).set(7, 0, 3, C.water);
      return m;
    },
  },
  {
    id: "oil_stain",
    solid: false,
    model: () => {
      const m = new Model(8, 1, 8);
      m.cyl(3.5, 3.5, 3, 0, 0, C.asphalt);
      m.cyl(4.5, 3, 1.3, 0, 0, C.black);
      return m;
    },
  },
  rich("steam_vent", { solid: false, light: L([3, 1, 3], "#ff7a1a", 3, 4, false) }, () => {
    const m = new Model(6, 1, 6);
    m.box(0, 0, 0, 5, 0, 5, C.steel_dark);
    for (let x = 1; x <= 4; x++) m.box(x, 0, 1, x, 0, 4, x % 2 ? C.black : C.plasma);
    m.set(0, 0, 0, C.chrome).set(5, 0, 5, C.chrome).set(5, 0, 0, C.iron_rust); // bolts
    return {
      model: m,
      parts: [
        part("steam_a", wisp(4, C.coat_shadow, 11), [2, 3, 2.5], "bob", {
          speed: 0.5,
          amplitude: 1,
        }),
        part("steam_b", wisp(3, C.coat_white, 12), [4, 3, 3.5], "bob", {
          speed: 0.7,
          amplitude: 0.8,
          phase: 1.8,
        }),
      ],
    };
  }),
  {
    id: "cable_loops",
    solid: false,
    wall: true,
    elevation: 3.5,
    model: () => {
      // Cables slung from the wall top, sagging in loops.
      const m = new Model(12, 5, 2);
      m.box(0, 4, 0, 11, 4, 0, C.metal_dark);
      for (let x = 0; x < 12; x++) {
        const sag = Math.round(Math.abs(Math.sin((x / 12) * Math.PI * 2)) * 3);
        m.set(x, 4 - sag, 1, C.cable_black);
        const sag2 = Math.round(Math.abs(Math.sin(((x + 3) / 12) * Math.PI * 2)) * 2);
        m.set(x, 4 - sag2, 1, x % 2 ? C.cable_red : C.cable_yellow);
      }
      return m;
    },
  },
  {
    id: "crane_rail",
    solid: false,
    wall: true,
    elevation: 4.5,
    model: () => {
      const m = new Model(24, 3, 2);
      m.box(0, 1, 0, 23, 2, 1, C.safety_yellow);
      for (let x = 0; x < 24; x += 3) m.set(x, 1, 1, C.hazard_black);
      for (const x of [0, 12, 23]) m.box(x, 0, 0, x, 2, 0, C.metal_dark);
      m.box(10, 0, 1, 13, 0, 1, C.metal_dark); // trolley
      return m;
    },
  },
  {
    id: "tool_wall",
    solid: false,
    wall: true,
    elevation: 2,
    model: () => {
      const m = new Model(14, 8, 2);
      m.box(0, 0, 0, 13, 7, 0, C.cardboard);
      for (let y = 1; y < 8; y += 2) for (let x = 1; x < 14; x += 2) m.set(x, y, 0, C.wood_dark);
      m.box(1, 2, 1, 1, 6, 1, C.steel).box(3, 3, 1, 3, 6, 1, C.red_paint).set(3, 6, 1, C.steel);
      m.box(5, 4, 1, 7, 4, 1, C.blue_paint).set(6, 5, 1, C.steel);
      m.box(9, 2, 1, 9, 6, 1, C.safety_yellow).box(11, 5, 1, 12, 6, 1, C.steel);
      return m;
    },
  },
  {
    id: "archive_shelf",
    solid: true,
    model: () => {
      const m = new Model(14, 16, 5);
      m.box(0, 0, 0, 0, 15, 4, C.steel_dark).box(13, 0, 0, 13, 15, 4, C.steel_dark);
      for (const y of [0, 4, 8, 12, 15]) m.box(0, y, 0, 13, y, 4, C.metal);
      for (const y of [1, 5, 9, 13]) {
        for (let x = 1; x < 13; x++) {
          const h = fnv1a(`ar${x}${y}`);
          if (h % 7 === 0) continue;
          const c = h % 3 === 0 ? C.black : h % 3 === 1 ? C.paint_navy : C.cardboard;
          m.box(x, y, 1, x, y + 1 + (h % 2), 3, c);
          if (h % 5 === 0) m.set(x, y + 1, 4, C.paper);
        }
      }
      // Cross brace on the open back.
      for (let i = 0; i <= 12; i++) {
        const y = 1 + Math.round((i * 13) / 12);
        for (const x of [i + 1, 12 - i])
          if (x >= 1 && x <= 12 && !m.grid.get(x, y, 0)) m.set(x, y, 0, C.steel_dark);
      }
      return m;
    },
  },
  {
    id: "card_catalog",
    solid: true,
    top: 8,
    model: () => {
      const m = new Model(8, 8, 5);
      m.box(0, 0, 0, 7, 7, 4, C.oak);
      for (let y = 1; y < 7; y += 2)
        for (let x = 1; x < 7; x += 2) m.set(x, y, 4, C.brass).set(x + 1, y, 4, C.wood_light);
      m.box(0, 7, 0, 7, 7, 4, C.walnut);
      m.box(0, 3, 0, 7, 3, 0, C.wood_dark).set(2, 5, 0, C.paper); // back batten, tag
      return m;
    },
  },
  {
    id: "display_case",
    solid: true,
    model: () => {
      const m = new Model(10, 12, 6);
      m.box(0, 0, 0, 9, 4, 5, C.walnut);
      m.box(0, 5, 0, 9, 10, 5, C.glass);
      m.box(1, 5, 1, 8, 10, 4, 0);
      m.box(0, 11, 0, 9, 11, 5, C.walnut);
      m.box(2, 5, 2, 3, 7, 3, C.crystal_violet).box(6, 5, 2, 7, 6, 3, C.gold);
      m.set(5, 5, 3, C.halo_glow).box(1, 10, 1, 8, 10, 1, C.lamp_warm);
      m.box(1, 1, 0, 8, 3, 0, C.wood).set(4, 2, 0, C.brass); // rear service door
      return m;
    },
    light: L([5, 9, 3], "#ffe9a8", 4, 5),
  },
  {
    id: "vault_safe",
    solid: true,
    model: () => {
      const m = new Model(8, 10, 6);
      m.box(0, 0, 0, 7, 9, 5, C.steel_dark);
      m.box(1, 1, 5, 6, 8, 5, C.steel);
      disc(m, 3.5, 5, 1.6, 5, C.chrome);
      m.set(3, 5, 5, C.black).set(4, 5, 5, C.black);
      for (let y = 3; y <= 6; y++) m.set(3 + (y % 2), y, 5, C.chrome);
      m.set(5, 7, 5, C.led_red).box(6, 3, 5, 6, 6, 5, C.metal_dark);
      for (const [x, y] of [
        [1, 1],
        [6, 1],
        [1, 8],
        [6, 8],
      ] as const)
        m.set(x, y, 0, C.steel);
      m.box(2, 7, 0, 5, 7, 0, C.brass); // maker's plate
      return m;
    },
  },
  {
    id: "reactor_coil",
    solid: true,
    model: () => {
      const m = new Model(8, 12, 8);
      m.cyl(3.5, 3.5, 3.5, 0, 1, C.metal_dark);
      m.cyl(3.5, 3.5, 1.5, 2, 9, C.steel);
      for (let y = 2; y <= 9; y += 2) m.ring(3.5, 3.5, 2.6, y, C.copper);
      m.sphere(3.5, 10, 3.5, 1.3, C.plasma_blue);
      return m;
    },
    light: L([3.5, 10, 3.5], "#6ad4ff", 5, 6),
  },
  {
    id: "containment_pod",
    solid: true,
    model: () => {
      const m = new Model(8, 15, 8);
      m.cyl(3.5, 3.5, 3.5, 0, 1, C.metal_dark).cyl(3.5, 3.5, 3.5, 13, 14, C.metal_dark);
      m.cyl(3.5, 3.5, 3.5, 2, 12, C.glass_purple, true);
      m.sphere(3.5, 7, 3.5, 1.4, C.abstractum);
      m.ring(3.5, 3.5, 3.5, 2, C.neon_purple).ring(3.5, 3.5, 3.5, 12, C.neon_purple);
      m.box(0, 14, 3, 7, 14, 4, C.hazard_black);
      return m;
    },
    light: L([3.5, 7, 3.5], "#b060ff", 5, 6),
  },
  {
    id: "field_emitter",
    solid: true,
    model: () => {
      const m = new Model(4, 9, 4);
      m.box(0, 0, 0, 3, 1, 3, C.steel_dark);
      m.box(1, 2, 1, 2, 7, 2, C.metal);
      m.box(0, 8, 0, 3, 8, 3, C.abstractum);
      m.set(1, 4, 3, C.led_green);
      return m;
    },
    light: L([2, 8, 2], "#b060ff", 3, 5),
  },
  {
    id: "portal_pylon",
    solid: true,
    model: () => {
      const m = new Model(5, 17, 5);
      m.box(0, 0, 0, 4, 1, 4, C.metal_dark);
      m.box(1, 2, 1, 3, 13, 3, C.steel);
      for (let y = 3; y < 13; y += 3) m.box(1, y, 1, 3, y, 3, C.cerulean);
      m.sphere(2, 14.5, 2, 1.5, C.exotic);
      return m;
    },
    light: L([2, 14, 2], "#4B3BFF", 5, 7),
  },
  {
    id: "glow_seam",
    solid: false,
    model: () => {
      const m = new Model(16, 1, 2);
      for (let x = 0; x < 16; x++)
        m.set(x, 0, 0, x % 4 === 3 ? C.metal_dark : C.cerulean).set(x, 0, 1, C.metal_dark);
      return m;
    },
  },
  {
    id: "heat_exchanger",
    solid: true,
    model: () => {
      const m = new Model(10, 12, 8);
      m.box(0, 0, 0, 9, 1, 7, C.concrete);
      m.cyl(4.5, 3.5, 3.5, 2, 10, C.iron_rust);
      for (let y = 3; y <= 9; y += 2) m.ring(4.5, 3.5, 3.5, y, C.copper);
      m.box(4, 11, 3, 5, 11, 4, C.steel).set(4, 6, 7, C.plasma).set(5, 6, 7, C.plasma);
      m.box(9, 4, 3, 9, 5, 4, C.steel);
      m.box(4, 2, 0, 5, 7, 0, C.steel).set(3, 8, 1, C.paper); // return line, gauge
      return m;
    },
    light: L([4.5, 6, 8], "#ff7a1a", 3, 5, false),
  },
  {
    id: "floor_pipes",
    solid: true,
    model: () => {
      const m = new Model(16, 5, 6);
      for (const x of [1, 8, 14]) m.box(x, 0, 0, x, 3, 5, C.concrete);
      m.box(0, 2, 1, 15, 3, 2, C.iron_rust).box(0, 2, 4, 15, 3, 5, C.copper);
      m.box(6, 1, 0, 7, 4, 6 - 1, C.steel);
      m.set(7, 4, 3, C.plasma);
      return m;
    },
  },
  {
    id: "specimen_crate",
    solid: true,
    model: () => {
      const m = new Model(6, 6, 6);
      m.box(0, 0, 0, 5, 5, 5, C.steel);
      m.box(1, 1, 5, 4, 4, 5, C.glass_green);
      m.box(2, 2, 5, 3, 3, 5, C.liquid_green);
      m.box(0, 5, 0, 5, 5, 5, C.hazard_black).set(2, 5, 2, C.wall_trim);
      return m;
    },
    light: L([3, 3, 6], "#39ff88", 2, 3, false),
  },
  rich("diagnostic_rack", { solid: true, light: L([4, 9, 5], "#ff4040", 2, 4) }, () => {
    const m = new Model(8, 12, 5);
    m.box(0, 0, 0, 7, 11, 4, C.paint_gray);
    const scr = screenWell(m, 1, 8, 6, 10, 4, { content: "status", color: "#FF4040" });
    for (let y = 1; y < 7; y += 2) m.leds(1, 6, y, 4, [C.led_green, C.led_amber, C.metal_dark]);
    for (let y = 2; y <= 9; y += 2) m.box(1, y, 0, 5, y, 0, C.black); // rear vents
    m.box(6, 1, 0, 6, 10, 0, C.cable_yellow);
    return { model: m, screens: [scr] };
  }),
  {
    id: "speaker_wall",
    solid: false,
    wall: true,
    elevation: 3,
    model: () => {
      const m = new Model(5, 6, 2);
      m.box(0, 0, 0, 4, 5, 1, C.paint_black);
      disc(m, 2, 2.5, 1.6, 1, C.metal_dark);
      for (let y = 1; y <= 4; y++) m.set(2, y, 1, y % 2 ? C.rubber : C.metal_dark);
      return m;
    },
  },
  {
    id: "acoustic_panel",
    solid: false,
    wall: true,
    elevation: 2,
    model: () => {
      const m = new Model(8, 8, 1);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          m.set(x, y, 0, ((x >> 1) + (y >> 1)) % 2 ? C.paint_black : C.floor_purple);
      return m;
    },
  },
  rich(
    "map_screen",
    { solid: false, wall: true, elevation: 2, light: L([6, 4, 2], "#00ffff", 3, 5) },
    () => {
      const m = new Model(12, 8, 2);
      m.box(0, 0, 0, 11, 7, 0, C.metal_dark);
      const scr = screenWell(m, 1, 1, 10, 6, 1, { content: "map", color: "#00FFFF" });
      m.set(11, 0, 1, C.led_amber);
      return { model: m, screens: [scr] };
    },
  ),
  {
    id: "bench_long",
    solid: true,
    model: () => {
      // Plank at knee height (2 × 0.5 = 1.0).
      const m = new Model(14, 2, 4);
      legs(m, 0, 0, 13, 3, 0, C.steel_dark);
      m.box(0, 1, 0, 13, 1, 3, C.wood_light);
      return m;
    },
  },
  {
    id: "blast_door_marker",
    solid: false,
    model: () => {
      const m = new Model(12, 1, 4);
      for (let x = 0; x < 12; x++)
        m.box(x, 0, 0, x, 0, 3, ((x + 1) >> 1) % 2 ? C.safety_yellow : C.hazard_black);
      return m;
    },
  },
];

const ALL: DecorDef[] = [
  ...LIST,
  ...DECOR_UPGRADES,
  ...FURNITURE,
  ...DETAIL_DECOR,
  ...LORE_DECOR,
  ...CLUTTER_DECOR,
  ...BIO_DECOR,
  ...QUARTERS_DECOR,
  ...STUDIO_DECOR,
];

export const DECOR: readonly DecorDef[] = ALL;

export const DECOR_BY_ID: ReadonlyMap<string, DecorDef> = new Map(ALL.map((d) => [d.id, d]));

const MODEL_CACHE = new Map<string, Model>();

/**
 * Model of a decor piece (cached — treat as read-only; the renderer only
 * meshes it), with the weathering pass of `decor-weather.ts` applied
 * (grain, fabric shading, chipped paint, grime — recolour only). Unknown
 * ids fall back to a crate stack.
 */
export function decorModel(id: string): Model {
  let m = MODEL_CACHE.get(id);
  if (!m) {
    const def = DECOR_BY_ID.get(id) ?? DECOR_BY_ID.get("crate_stack")!;
    m = weatherModel(def, def.model());
    MODEL_CACHE.set(id, m);
  }
  return m;
}

/** World units per model voxel of a decor piece (`DecorDef.scale`, default MODEL_SCALE). */
export function decorScale(id: string): number {
  return DECOR_BY_ID.get(id)?.scale ?? MODEL_SCALE;
}

/** World-unit size of a decor model (unrotated): width (x), height, depth (z). */
export function decorSize(id: string): { w: number; h: number; d: number } {
  const m = decorModel(id);
  const s = decorScale(id);
  return { w: m.w * s, h: m.h * s, d: m.d * s };
}

const HEIGHT_CACHE = new Map<string, Int16Array>();

/** Per-column top height (model voxels, 0 = empty) of a decor model, indexed x + z · w. */
export function decorHeightmap(id: string): Int16Array {
  let hm = HEIGHT_CACHE.get(id);
  if (!hm) {
    const m = decorModel(id);
    const out = new Int16Array(m.w * m.d);
    m.grid.forEach((x, y, z) => {
      const i = x + z * m.w;
      if (y + 1 > out[i]!) out[i] = y + 1;
    });
    hm = out;
    HEIGHT_CACHE.set(id, hm);
  }
  return hm;
}

/**
 * Animated rig of a decor piece in the device-visual format (base = the
 * static decor model, parts, no lights — decor lights go through
 * `decorLights`), or undefined when the piece has neither parts nor screens.
 * Feed it to the same rig builder as devices, with `scale` = the decor scale.
 */
export function decorVisual(id: string): DeviceVisual | undefined {
  const def = DECOR_BY_ID.get(id);
  if (!def || (!def.parts?.length && !def.screens?.length)) return undefined;
  const v: DeviceVisual = {
    base: decorModel(id),
    parts: def.parts ?? [],
    lights: [],
    scale: decorScale(id),
  };
  if (def.screens?.length) v.screens = def.screens;
  return v;
}

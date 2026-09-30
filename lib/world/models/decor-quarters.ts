/**
 * Jade's Quarters — furniture of her refurnished room (pure, no three).
 * =====================================================================
 *
 * - `jade_workstation` — her personal computer (desk, two monitors, tower,
 *   the chair pushed in). Placed as the map prop `jade_pc` with the variant
 *   of the same name (see `PROP_VARIANT_DECOR`), so it is a classic
 *   half-scale model whose footprint stays inside the fallback `desk` prop
 *   model (14 × 8) the walkability test uses.
 * - `cork_board_live` — the big pinboard: a cork well that is a live screen
 *   (content "notes", no power needed) showing the memos pinned to that
 *   very placement (`ScreenInfo.pinned`, lib/world/screen-content.ts).
 * - `wardrobe`, `study_desk`, `photo_wall` — the lived-in rest.
 *
 * Kept deliberately light (half-scale boxes, sparse wall pieces): placed
 * decor voxels have a lab-wide budget (tests/world/models-decor-detail).
 */
import { tr } from "@/lib/i18n";
import { C } from "@/lib/world/content/palette";
import { Model } from "@/lib/world/models/core";
import {
  blob,
  fine,
  legs,
  part,
  rich,
  screenWell,
  type DecorDef,
} from "@/lib/world/models/decor-kit";

export const QUARTERS_DECOR: DecorDef[] = [
  rich("jade_workstation", { solid: true }, () => {
    const m = new Model(14, 13, 8);
    // Desk: oak top over a drawer pedestal (left) and a side panel (right).
    m.box(0, 5, 0, 13, 5, 5, C.oak);
    m.box(0, 0, 0, 3, 4, 5, C.wood_dark);
    m.box(1, 1, 5, 2, 2, 5, C.wood).box(1, 3, 5, 2, 4, 5, C.wood);
    m.set(2, 2, 5, C.brass).set(2, 4, 5, C.brass);
    m.box(13, 0, 0, 13, 4, 5, C.wood_dark);
    // Tower under the desk: beige, a drive slot and a power LED.
    m.box(9, 0, 1, 11, 4, 4, C.beige);
    m.box(9, 3, 4, 11, 3, 4, C.black).set(9, 1, 4, C.led_green);
    // Two monitors on short stands, recessed glass.
    m.box(3, 6, 1, 3, 6, 1, C.metal).box(10, 6, 1, 10, 6, 1, C.metal);
    m.box(0, 7, 0, 6, 12, 1, C.metal_dark).box(7, 7, 0, 13, 12, 1, C.metal_dark);
    const left = screenWell(m, 1, 8, 5, 11, 2, {
      content: "text",
      text: tr("screen::INBOX. NOTES. STUDY PLAN. COFFEE: PENDING."),
      color: "#9CFFB0",
      bezel: C.metal_dark,
    });
    const right = screenWell(m, 8, 8, 12, 11, 2, {
      content: "log",
      color: "#33FF33",
      bezel: C.metal_dark,
    });
    // Sticky notes on the bezels (her own reminders), a photo taped on.
    m.set(0, 12, 2, C.paper_yellow).set(6, 7, 2, C.paper_pink).set(13, 12, 2, C.paper_blue);
    m.set(7, 7, 2, C.paper);
    // Keyboard, mouse, a cold mug, a notebook.
    m.box(4, 6, 3, 9, 6, 4, C.paint_black);
    m.set(11, 6, 4, C.paint_gray);
    m.set(1, 6, 4, C.ceramic).set(1, 7, 4, C.ceramic).set(1, 7, 3, C.coffee);
    m.box(12, 6, 3, 13, 6, 5, C.book_blue);
    // Her chair, pushed in: seat, post, backrest facing the desk.
    m.box(5, 0, 7, 8, 0, 7, C.metal_dark);
    m.box(6, 1, 6, 7, 2, 6, C.metal_dark);
    m.box(5, 3, 6, 8, 3, 7, C.fabric_blue);
    m.box(5, 4, 7, 8, 7, 7, C.fabric_blue).box(6, 7, 7, 7, 7, 7, C.paint_navy);
    // Back: cable bundle down to the floor, a service tag.
    m.box(8, 0, 0, 8, 4, 0, C.cable_black).set(7, 2, 0, C.cable_red);
    m.set(11, 9, 0, C.paper);
    const parts = [
      part("hdd", blob(1, 1, 1, C.led_amber), [10.5, 2.5, 5.5], "blink", {
        speed: 3.1,
        amplitude: 0.5,
        power: true,
      }),
    ];
    return { model: m, screens: [left, right], parts };
  }),

  rich("cork_board_live", { solid: false, wall: true, elevation: 1 }, () => {
    // 6 × 5 world units: a wooden frame around a cork well that is the live screen.
    const m = new Model(12, 10, 2);
    m.box(0, 0, 0, 11, 9, 0, C.wood_dark);
    const well = screenWell(m, 1, 1, 10, 8, 1, {
      content: "notes",
      power: false,
      bezel: C.wood,
    });
    // Pins parked on the frame, a pencil on the ledge, a brass name plate.
    m.set(0, 9, 1, C.red_paint).set(11, 9, 1, C.blue_paint).set(11, 0, 1, C.yellow_paint);
    m.box(2, 0, 1, 5, 0, 1, C.safety_yellow);
    m.box(8, 0, 1, 9, 0, 1, C.brass);
    return { model: m, screens: [well] };
  }),

  rich("wardrobe_replicator", { solid: true }, () => {
    // Jade's wardrobe replicator “Needle's Eye” (NDL-0), map prop with the
    // variant of the same name. Half-scale, inside the fallback `console`
    // prop footprint (12 × 8): a cast-iron industrial sewing head riding
    // on the spare gantry of the first 3D fabricator, a spool rack on top,
    // a pattern-disk slot, a dye carousel, a mirror on the right upright
    // and the recycling maw on the left. Front = +z.
    const m = new Model(12, 16, 8);
    // Cabinet: teal enamel with brass trim, dark plinth, oak work top.
    m.box(1, 0, 1, 10, 5, 7, C.paint_teal);
    m.box(1, 0, 1, 10, 0, 7, C.black);
    m.box(1, 5, 7, 10, 5, 7, C.brass);
    m.box(0, 6, 0, 11, 6, 7, C.oak);
    m.box(0, 6, 7, 11, 6, 7, C.wood_dark);
    // Status screen and a hand-lettered brass plate “NDL-0”.
    const screen = screenWell(m, 4, 2, 7, 3, 7, {
      content: "text",
      text: tr("screen::NDL-0 · NEEDLE'S EYE · READY"),
      color: "#FFC857",
    });
    m.box(4, 4, 7, 7, 4, 7, C.brass).set(5, 4, 7, C.black).set(6, 4, 7, C.black);
    // Pattern-disk slot (right): a blue floppy half inserted, a drive LED.
    m.box(8, 3, 7, 9, 3, 7, C.black).set(8, 4, 7, C.safety_blue).set(9, 4, 7, C.paper);
    m.set(9, 2, 7, C.led_green);
    // Recycling maw (left side): a dark hopper with a steel lip, scraps inside.
    m.box(0, 3, 2, 0, 5, 5, C.steel_dark).box(0, 4, 3, 0, 5, 4, 0);
    m.set(1, 4, 3, C.fabric_red).set(1, 4, 4, C.fabric_blue);
    // Gantry: two steel uprights and a crossbar with a toothed belt.
    m.box(0, 7, 1, 0, 13, 2, C.steel).box(11, 7, 1, 11, 13, 2, C.steel);
    m.box(0, 13, 1, 11, 13, 2, C.steel_dark);
    for (let x = 1; x <= 10; x += 2) m.set(x, 13, 3, C.rubber);
    // Sewing head: black cast iron with gold decals, hand wheel on the right.
    m.box(3, 10, 2, 8, 12, 4, C.paint_black);
    m.box(3, 8, 3, 4, 9, 4, C.paint_black);
    m.set(5, 11, 4, C.gold).set(6, 11, 4, C.gold).set(7, 12, 4, C.gold);
    m.box(9, 10, 3, 9, 12, 3, C.chrome);
    // Presser foot and needle plate on the work top, a length of cloth running out.
    m.box(3, 7, 4, 5, 7, 6, C.chrome);
    m.box(2, 7, 5, 9, 7, 7, C.fabric_red).box(9, 5, 7, 10, 6, 7, C.fabric_red_shade);
    // Mirror (right upright): brass frame, glass, facing the room.
    m.box(11, 7, 3, 11, 12, 6, C.brass).box(11, 8, 4, 11, 11, 5, C.glass);
    // Spool rack on top: six thread cones on pins, the colours of her wardrobe.
    m.box(1, 14, 2, 10, 14, 2, C.wood_dark);
    const cones = [
      C.sweater_teal,
      C.scarf_red,
      C.fabric_mustard,
      C.paint_white,
      C.fabric_green,
      C.neon_pink,
    ];
    cones.forEach((c, i) => {
      const x = 1 + i * 2 - (i > 2 ? 1 : 0);
      m.box(x, 15, 2, x, 15, 2, c);
      m.set(x, 14, 3, c);
    });
    // Thread from a cone down to the head.
    m.box(6, 12, 5, 6, 13, 5, C.paint_white);
    // Back: fan grille, a power cord, a service sticker in Jade's handwriting.
    for (let y = 1; y <= 4; y += 1) m.box(3, y, 1, 8, y, 1, y % 2 ? C.black : C.steel_dark);
    m.box(10, 0, 1, 10, 3, 1, C.cable_black);
    m.set(2, 4, 1, C.paper_yellow);
    const parts = [
      // Needle: a quick stitch stroke while the replicator is powered.
      part("needle", blob(1, 2, 1, C.chrome), [4, 7.5, 4.5], "piston", {
        speed: 3.2,
        amplitude: 0.8,
        axis: "y",
        power: true,
      }),
      // Dye carousel (left front): six ampoules turning on the work top.
      part(
        "carousel",
        new Model(3, 2, 3)
          .box(0, 0, 0, 2, 0, 2, C.steel_dark)
          .set(0, 1, 0, C.liquid_pink)
          .set(2, 1, 0, C.liquid_blue)
          .set(0, 1, 2, C.safety_yellow)
          .set(2, 1, 2, C.liquid_green)
          .set(1, 1, 1, C.glass),
        [1.5, 8, 6],
        "spin",
        { speed: 0.35, axis: "y", power: true },
      ),
      part("ready", blob(1, 1, 1, C.led_amber), [10.5, 5.5, 7.5], "blink", {
        speed: 0.8,
        amplitude: 0.5,
        power: true,
      }),
    ];
    return { model: m, screens: [screen], parts };
  }),

  {
    id: "wardrobe",
    solid: true,
    model: () => {
      // Half-scale: 4 × 6.5 × 2.5 world units.
      const m = new Model(8, 13, 5);
      m.box(0, 0, 0, 7, 12, 4, C.walnut);
      m.box(0, 0, 0, 7, 0, 4, C.wood_dark);
      m.box(0, 12, 0, 7, 12, 4, C.wood_dark);
      // Two doors with a seam, brass knobs, a mirror strip on the right door.
      m.box(1, 1, 4, 3, 11, 4, C.wood).box(4, 1, 4, 6, 11, 4, C.wood);
      m.set(3, 6, 4, C.brass).set(4, 6, 4, C.brass);
      m.box(5, 4, 4, 5, 10, 4, C.glass);
      // A lab-coat sleeve caught in the door, a pair of boots, a hatbox on top.
      m.box(3, 3, 4, 3, 5, 4, C.coat_white).set(3, 2, 4, C.coat_shadow);
      m.set(1, 0, 4, C.shoes).set(2, 0, 4, C.shoes);
      m.box(1, 12, 1, 4, 12, 3, C.cardboard).set(2, 12, 2, C.fabric_red);
      // Back: plain panel with a slip of paper (“Winter: Box 3”).
      m.set(2, 8, 0, C.paper);
      return m;
    },
  },

  {
    id: "study_desk",
    solid: true,
    top: 6,
    model: () => {
      // Half-scale writing desk, 5 × 3 × 2.5 world units; the lamp stands on it.
      const m = new Model(10, 6, 5);
      m.box(0, 5, 0, 9, 5, 4, C.oak);
      legs(m, 0, 0, 9, 4, 4, C.wood_dark);
      m.box(6, 3, 0, 9, 4, 4, C.wood_dark);
      m.box(7, 3, 4, 8, 4, 4, C.wood).set(8, 4, 4, C.brass);
      m.box(1, 1, 0, 8, 1, 0, C.wood_dark); // back rail
      return m;
    },
  },

  fine("photo_wall", { solid: false, wall: true, elevation: 3 }, () => {
    // Four framed photos and a string of fairy lights — 4.5 × 2.25 world units.
    const m = new Model(18, 9, 1);
    const frames = [
      [0, 1, 4, 5, C.paint_sky],
      [6, 3, 10, 7, C.paint_lime],
      [12, 0, 17, 5, C.paint_lilac],
      [7, 0, 10, 1, C.paper],
    ] as const;
    for (const [x0, y0, x1, y1, c] of frames) {
      m.box(x0, y0, 0, x1, y1, 0, C.wood_dark);
      if (x1 - x0 > 1 && y1 - y0 > 1) m.box(x0 + 1, y0 + 1, 0, x1 - 1, y1 - 1, 0, c);
    }
    for (let x = 0; x < 18; x += 3) m.set(x, 8, 0, x % 2 ? C.lamp_warm : C.led_amber);
    for (let x = 1; x < 18; x += 3) m.set(x, 8, 0, C.cable_black);
    return m;
  }),
];

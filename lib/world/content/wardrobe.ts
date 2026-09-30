/**
 * Jade's wardrobe — everything she can wear (pure data).
 * ======================================================
 *
 * Thirteen slots in three groups. Clothes and hair are changed at the
 * wardrobe in her quarters (decor `wardrobe`, the mirror is on its door);
 * gear and accessories can be swapped anywhere from the character menu.
 *
 * Where a piece comes from (`source`):
 * - `start`  — in the wardrobe from the first minute,
 * - `find`   — hidden somewhere in the lab (a map pickup whose item id is
 *              `wear:<id>`, see `WEAR_ITEM_PREFIX`; placed in content/map.ts),
 * - `craft`  — made at the wardrobe replicator in Jade's quarters from
 *              collected resources (`recipe`), sometimes only after an
 *              `unlock` condition holds (a device built, a pattern found …),
 * - `reward` — handed over automatically once `when` holds.
 *
 * Colourways: the first one is how the piece comes; the others are free
 * once the piece is owned, unless they carry a `dye` cost (paid once at the
 * replicator). `tones` are palette colour names the voxel models paint with
 * (models/jade-*.ts) — main fabric, its shade, and an accent (trim, print,
 * lens, stitching). Rules: lib/world/wardrobe.ts. German: lib/i18n/de/wardrobe.ts.
 */
import { tr } from "@/lib/i18n";
import type { ColorName } from "@/lib/world/content/palette";
import type { Condition } from "@/lib/world/types";

export const WEAR_SLOTS = [
  "top",
  "outer",
  "legs",
  "feet",
  "hair",
  "head",
  "face",
  "hands",
  "back",
  "neck",
  "belt",
  "wrist",
  "buddy",
] as const;
export type WearSlot = (typeof WEAR_SLOTS)[number];

export type WearGroup = "clothes" | "gear" | "accessories";

export interface WearSlotDef {
  id: WearSlot;
  label: string;
  group: WearGroup;
  /** May be left empty (`null` in the look). */
  optional: boolean;
  /** Only changeable standing at the wardrobe (clothes, shoes, hair). */
  wardrobeOnly: boolean;
}

export const WEAR_SLOT_DEFS: readonly WearSlotDef[] = [
  { id: "top", label: tr("Top"), group: "clothes", optional: false, wardrobeOnly: true },
  { id: "outer", label: tr("Jacket"), group: "clothes", optional: true, wardrobeOnly: true },
  { id: "legs", label: tr("Trousers"), group: "clothes", optional: false, wardrobeOnly: true },
  { id: "feet", label: tr("Shoes"), group: "clothes", optional: false, wardrobeOnly: true },
  { id: "hair", label: tr("Hairstyle"), group: "clothes", optional: false, wardrobeOnly: true },
  { id: "head", label: tr("Headgear"), group: "gear", optional: true, wardrobeOnly: false },
  { id: "face", label: tr("Face"), group: "gear", optional: true, wardrobeOnly: false },
  { id: "hands", label: tr("Gloves"), group: "gear", optional: true, wardrobeOnly: false },
  {
    id: "back",
    label: tr("slot::Back"),
    group: "accessories",
    optional: true,
    wardrobeOnly: false,
  },
  { id: "neck", label: tr("Neck"), group: "accessories", optional: true, wardrobeOnly: false },
  { id: "belt", label: tr("Belt"), group: "accessories", optional: true, wardrobeOnly: false },
  { id: "wrist", label: tr("Wrist"), group: "accessories", optional: true, wardrobeOnly: false },
  {
    id: "buddy",
    label: tr("Shoulder buddy"),
    group: "accessories",
    optional: true,
    wardrobeOnly: false,
  },
];

export const WEAR_SLOT_BY_ID: ReadonlyMap<WearSlot, WearSlotDef> = new Map(
  WEAR_SLOT_DEFS.map((d) => [d.id, d]),
);

export const WEAR_GROUPS: readonly { id: WearGroup; label: string }[] = [
  { id: "clothes", label: tr("Clothes") },
  { id: "gear", label: tr("Gadgets") },
  { id: "accessories", label: tr("Accessories") },
];

/** Sole of a shoe — picks the footstep sound set (audio/footsteps). */
export const FOOTWEAR_SOUNDS = [
  "boot",
  "sneaker",
  "rubber",
  "magnetic",
  "slipper",
  "clog",
  "skate",
] as const;
export type FootwearSound = (typeof FOOTWEAR_SOUNDS)[number];

/** Extra layer that sounds with the steps (keys jingling, tools rattling …). */
export const MOTION_LAYERS = [
  "keys",
  "tools",
  "chime",
  "rustle",
  "clank",
  "squeak",
  "hum",
] as const;
export type MotionLayer = (typeof MOTION_LAYERS)[number];

export interface WearTones {
  main: ColorName;
  shade?: ColorName;
  accent?: ColorName;
}

export interface Colorway {
  id: string;
  label: string;
  tones: WearTones;
  /** One-time dye cost at the replicator (item id → count). Absent = free. */
  dye?: Readonly<Record<string, number>>;
}

export type WearSource =
  | { kind: "start" }
  | { kind: "find"; hint: string }
  | {
      kind: "craft";
      /** Resources used up at the replicator (item id → count). */
      recipe: Readonly<Record<string, number>>;
      /** Seconds the replicator works on it (flavour + pacing). */
      seconds: number;
      /** The pattern is only on the replicator once this holds. */
      unlock?: Condition;
      /** Shown while locked. */
      unlockHint?: string;
    }
  | { kind: "reward"; when: Condition; hint: string };

export interface WearItem {
  id: string;
  slot: WearSlot;
  name: string;
  /** One or two lines in Jade's / the lab's voice. */
  blurb: string;
  source: WearSource;
  colorways: readonly Colorway[];
  /** Footwear only: sole sound. */
  step?: FootwearSound;
  /** Adds a motion sound layer to every step. */
  layer?: MotionLayer;
  /** Has a glowing part (emissive voxels: lamp, visor, crystal). */
  glows?: boolean;
  /** T-shirts / hoodies: merch motif shown as a pixel print (lib/world/merch.ts design id). */
  print?: string;
  /** Covers the hair (hard hat, welding helmet, hood up): the hair model hides under it. */
  coversHair?: boolean;
  /** Full-face piece: hides `face` slot items. */
  coversFace?: boolean;
}

/** Map pickups with an item id `wear:<id>` hand over a wardrobe piece. */
export const WEAR_ITEM_PREFIX = "wear:";

// ── Colourway shorthands ────────────────────────────────────────

const cw = (id: string, label: string, main: ColorName, shade?: ColorName, accent?: ColorName) =>
  ({
    id,
    label,
    tones: { main, ...(shade ? { shade } : {}), ...(accent ? { accent } : {}) },
  }) satisfies Colorway;

const dyed = (
  id: string,
  label: string,
  main: ColorName,
  shade: ColorName | undefined,
  accent: ColorName | undefined,
  dye: Record<string, number>,
): Colorway => ({ ...cw(id, label, main, shade, accent), dye });

const START = { kind: "start" } as const;
const find = (hint: string): WearSource => ({ kind: "find", hint });
const craft = (
  recipe: Record<string, number>,
  seconds: number,
  unlock?: Condition,
  unlockHint?: string,
): WearSource => ({
  kind: "craft",
  recipe,
  seconds,
  ...(unlock ? { unlock } : {}),
  ...(unlockHint ? { unlockHint } : {}),
});

// ── The catalogue ───────────────────────────────────────────────

export const WEAR_ITEMS: readonly WearItem[] = [
  // ── Tops ──
  {
    id: "shirt_collar_geo",
    slot: "top",
    name: tr("Stand-collar shirt"),
    blurb: tr(
      "Crisp white, a stand-up collar lined with a grey-black shard pattern. Her first-day shirt, and most days after.",
    ),
    source: START,
    colorways: [
      cw("white", tr("colour::White"), "white", "paint_white_dk", "paint_black"),
      cw("black", tr("colour::Black"), "paint_black", "black", "paint_gray_lt"),
      cw("sky", tr("colour::Sky"), "paint_sky", "safety_blue", "paint_black"),
    ],
  },
  {
    id: "sweater_teal",
    slot: "top",
    name: tr("Cable-knit sweater"),
    blurb: tr("Teal, two cables, one darned elbow. Knitted by her mother, worn by the lab."),
    source: START,
    colorways: [
      cw("teal", tr("colour::Teal"), "sweater_teal", "paint_teal", "paint_teal_dk"),
      cw("mustard", tr("colour::Mustard"), "fabric_mustard", "fabric_mustard_shade", "brass_dk"),
      cw("oxblood", tr("colour::Oxblood"), "fabric_red", "fabric_red_shade", "wood_red"),
      cw("oat", tr("colour::Oatmeal"), "beige", "beige_dk", "paint_cream"),
    ],
  },
  {
    id: "turtleneck",
    slot: "top",
    name: tr("Turtleneck"),
    blurb: tr(
      "Black, high collar, zero pockets. For the days she wants to look like she has a plan.",
    ),
    source: START,
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "paint_black_lt"),
      cw("navy", tr("colour::Navy"), "paint_navy", "black", "fabric_blue"),
      cw("cream", tr("colour::Cream"), "paint_cream", "beige", "beige_dk"),
    ],
  },
  {
    id: "tee_unlab",
    slot: "top",
    name: tr("_unLAB Classic tee"),
    blurb: tr(
      "The wireframe crystal on the chest. Also sold in the real world, which confuses the MCP.",
    ),
    source: START,
    print: "logo-classic",
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "screen_green"),
      cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "paint_black"),
      cw("heather", tr("colour::Heather grey"), "fabric_gray", "fabric_gray_shade", "paint_black"),
    ],
  },
  {
    id: "tee_do_not_lick",
    slot: "top",
    name: tr("“Do not lick the crystal” tee"),
    blurb: tr(
      "Hazard sign on the front. Found in a staff locker, still folded. Somebody needed the reminder.",
    ),
    source: find(tr("A staff locker on the control floor still holds a folded shirt.")),
    print: "do-not-lick",
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_yellow"),
      cw("orange", tr("colour::Safety orange"), "safety_orange", "orange_paint_dk", "paint_black"),
    ],
  },
  {
    id: "tee_418",
    slot: "top",
    name: tr("“418 I'm a teapot” tee"),
    blurb: tr("Printed by the replicator on its first try. The replicator thinks it is hilarious."),
    source: craft({ stoffreste: 2, farbpigment: 1 }, 20),
    print: "status-418",
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "led_amber"),
      cw("sky", tr("colour::Sky"), "paint_sky", "safety_blue", "paint_black"),
    ],
  },
  {
    id: "tee_bot_lineup",
    slot: "top",
    name: tr("Bot line-up tee"),
    blurb: tr("All ten lore bots, shoulder to shoulder. D3C4D3 insisted on being in the middle."),
    source: craft(
      { stoffreste: 2, farbpigment: 2 },
      30,
      { counter: "bots_awake", min: 3 },
      tr("Wake three lore bots — they want to be on it."),
    ),
    print: "bot-lineup",
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "screen_cyan"),
      cw("navy", tr("colour::Navy"), "paint_navy", "black", "screen_green"),
    ],
  },
  {
    id: "tee_residual",
    slot: "top",
    name: tr("“Residual charge 0.3 %” tee"),
    blurb: tr("A nearly empty battery. The most honest thing anyone in this lab has ever worn."),
    source: find(tr("The battery room keeps a spare shirt behind the last rack.")),
    print: "residual-charge",
    colorways: [
      cw("anthracite", tr("colour::Anthracite"), "fabric_gray", "fabric_gray_shade", "led_red"),
    ],
  },
  {
    id: "hoodie",
    slot: "top",
    name: tr("_unLAB hoodie"),
    blurb: tr("Heavy, brushed inside, double hood. Level −4 gets cold, and so does Jade."),
    source: craft({ stoffreste: 4, polymerfaser: 1 }, 40),
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_orange"),
      cw("grey", tr("colour::Heather grey"), "fabric_gray", "fabric_gray_shade", "paint_black"),
      cw("forest", tr("colour::Forest"), "fabric_green", "fabric_green_shade", "paint_cream"),
      dyed("lilac", tr("colour::Lilac"), "paint_lilac", "purple_paint", "paint_white", {
        farbpigment: 2,
      }),
    ],
  },
  {
    id: "hoodie_night_shift",
    slot: "top",
    name: tr("Night-shift hoodie"),
    blurb: tr(
      "“If you think at night, think quietly.” House rule no. 1, printed across the chest.",
    ),
    source: find(
      tr("Somewhere people slept between shifts — far below the lab — a hoodie was never claimed."),
    ),
    print: "night-shift",
    colorways: [cw("navy", tr("colour::Navy"), "paint_navy", "black", "lamp_warm")],
  },
  {
    id: "flannel",
    slot: "top",
    name: tr("Flannel shirt"),
    blurb: tr(
      "Red check, sleeves rolled. Damien's, strictly speaking. He will not miss it. He might.",
    ),
    source: find(tr("Damien kept more than notes in his quarters.")),
    colorways: [
      cw("red", tr("colour::Red check"), "fabric_red", "fabric_red_shade", "paint_black"),
      cw("green", tr("colour::Green check"), "fabric_green", "fabric_green_shade", "paint_black"),
    ],
  },
  {
    id: "overall_top",
    slot: "top",
    name: tr("Workshop tank top"),
    blurb: tr(
      "Grey rib, a grease print the shape of a thumb. For the forge, where sleeves are a liability.",
    ),
    source: craft({ stoffreste: 1 }, 12),
    colorways: [
      cw("grey", tr("colour::Grey"), "fabric_gray", "fabric_gray_shade", "grime"),
      cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "grime"),
    ],
  },
  {
    id: "shirt_damien",
    slot: "top",
    name: tr("Damien's white shirt"),
    blurb: tr(
      "Two sizes too big, sleeves rolled, a pencil in the pocket and a coffee ring nobody could wash out. It still smells of solder.",
    ),
    source: {
      kind: "reward",
      when: { insight: "damien_echo" },
      hint: tr("Hear Damien's echo."),
    },
    colorways: [cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "beige_dk")],
  },
  {
    id: "sweater_nordic",
    slot: "top",
    name: tr("Nordic sweater"),
    blurb: tr(
      "Star yoke, rib cuffs, wool that argues back. For the surface, and for the cold archive.",
    ),
    source: craft({ stoffreste: 3, farbpigment: 2 }, 45),
    colorways: [
      cw("red", tr("colour::Red"), "fabric_red", "fabric_red_shade", "paint_white"),
      cw("navy", tr("colour::Navy"), "paint_navy", "black", "paint_white"),
      cw("cream", tr("colour::Cream"), "paint_cream", "beige", "fabric_red"),
    ],
  },
  {
    id: "top_neon",
    slot: "top",
    name: tr("Neon mesh top"),
    blurb: tr(
      "Black mesh with glowing seams. The bots insisted there be a party. There was a party.",
    ),
    source: {
      kind: "reward",
      when: { counter: "bots_awake", min: 10 },
      hint: tr("Wake all ten lore bots."),
    },
    glows: true,
    colorways: [
      cw("pink", tr("colour::Neon pink"), "paint_black", "black", "neon_pink"),
      cw("cyan", tr("colour::Neon cyan"), "paint_black", "black", "screen_cyan"),
    ],
  },

  // ── Jackets ──
  {
    id: "labcoat",
    slot: "outer",
    name: tr("Lab coat"),
    blurb: tr("One of four identical coats. Badge, pens, dosimeter, a screwdriver in the pocket."),
    source: START,
    colorways: [
      cw("white", tr("colour::White"), "coat_white", "coat_shadow", "badge_blue"),
      dyed(
        "black",
        tr("colour::Night shift black"),
        "paint_black_lt",
        "paint_black",
        "screen_cyan",
        {
          farbpigment: 3,
        },
      ),
    ],
  },
  {
    id: "labcoat_patched",
    slot: "outer",
    name: tr("Patched lab coat"),
    blurb: tr(
      "Burn holes darned with copper thread, a patch for every experiment that answered back.",
    ),
    source: craft(
      { stoffreste: 3, kupferspule: 1 },
      45,
      { counter: "explosions", min: 1 },
      tr("Survive one explosion at the workbench first. You will know when."),
    ),
    colorways: [cw("white", tr("colour::White"), "coat_white", "coat_shadow", "copper")],
  },
  {
    id: "bomber",
    slot: "outer",
    name: tr("Bomber jacket"),
    blurb: tr("Olive, orange lining, a _unLAB patch on the sleeve. Warm enough for the surface."),
    source: craft({ stoffreste: 4, polymerfaser: 2 }, 60),
    colorways: [
      cw("olive", tr("colour::Olive"), "olive", "olive_dk", "safety_orange"),
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_orange"),
      dyed("cerulean", tr("colour::Cerulean"), "blue_paint", "blue_paint_dk", "paint_white", {
        farbpigment: 3,
      }),
    ],
  },
  {
    id: "raincoat",
    slot: "outer",
    name: tr("Rain slicker"),
    blurb: tr("Yellow, loud, crackles when she walks. The cooling floors drip. A lot."),
    source: find(tr("By the leaking pipes of the cooling level hangs a coat nobody took.")),
    layer: "rustle",
    colorways: [
      cw("yellow", tr("colour::Yellow"), "safety_yellow", "fabric_mustard", "paint_black"),
      cw("red", tr("colour::Red"), "safety_red", "fabric_red_shade", "paint_white"),
    ],
  },
  {
    id: "cardigan",
    slot: "outer",
    name: tr("Long cardigan"),
    blurb: tr("Knee-length, bottomless pockets. The observatory is draughty after midnight."),
    source: craft({ stoffreste: 3, farbpigment: 1 }, 35),
    colorways: [
      cw("oat", tr("colour::Oatmeal"), "beige", "beige_dk", "wood"),
      cw("grey", tr("colour::Grey"), "fabric_gray", "fabric_gray_shade", "paint_black"),
      cw("rose", tr("colour::Rose"), "paint_pink", "fabric_red_shade", "paint_cream"),
    ],
  },
  {
    id: "welding_apron",
    slot: "outer",
    name: tr("Welding apron"),
    blurb: tr("Split leather, scorch marks, a pocket for the striker. The forge approves."),
    source: craft(
      { stoffreste: 2, polymerfaser: 1, basislegierung: 1 },
      50,
      { device: "P3D-001", state: "built" },
      tr("Build the 3D Fabricator first — it prints the rivets."),
    ),
    colorways: [cw("leather", tr("colour::Leather"), "leather", "leather_worn", "steel")],
  },

  // ── Trousers ──
  {
    id: "parka",
    slot: "outer",
    name: tr("Expedition parka"),
    blurb: tr(
      "Quilted to the knees, a fur-rimmed hood, eleven pockets. Rated for the surface in January, or the cryo bay in any month.",
    ),
    source: craft({ stoffreste: 4, polymerfaser: 3 }, 70),
    layer: "rustle",
    colorways: [
      cw("olive", tr("colour::Olive"), "olive", "olive_dk", "paint_cream"),
      cw("navy", tr("colour::Navy"), "paint_navy", "black", "paint_cream"),
      cw("red", tr("colour::Red"), "fabric_red", "fabric_red_shade", "paint_cream"),
    ],
  },
  {
    id: "track_jacket",
    slot: "outer",
    name: tr("Track jacket 1989"),
    blurb: tr(
      "Shell suit, Cottbus, 1989: turquoise and violet, a zip that sings. Somebody kept it for thirty-seven years.",
    ),
    source: find(
      tr(
        "The first shaft crew left a sports bag in the rubble tunnel. It has waited there since 1989.",
      ),
    ),
    layer: "rustle",
    colorways: [
      cw(
        "turquoise",
        tr("colour::Turquoise & violet"),
        "paint_teal",
        "purple_paint",
        "paint_white",
      ),
      cw("red", tr("colour::Red & white"), "safety_red", "fabric_red_shade", "paint_white"),
    ],
  },
  {
    id: "hazmat_suit",
    slot: "outer",
    name: tr("Hazmat suit"),
    blurb: tr(
      "Taped seams, a window for the badge, a hood that is never up when it should be. Drill procedure: walk, do not run.",
    ),
    source: craft(
      { polymerfaser: 4, membran: 1 },
      80,
      { device: "EMC-001", state: "built" },
      tr("Build the Exotic Matter Containment first — the suit copies its seal rating."),
    ),
    layer: "rustle",
    colorways: [
      cw("yellow", tr("colour::Yellow"), "safety_yellow", "fabric_mustard", "paint_black"),
      cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "safety_orange"),
    ],
  },
  {
    id: "forge_mantle",
    slot: "outer",
    name: tr("Forge mantle"),
    blurb: tr(
      "Charcoal wool to the shins, gold at every edge, a Halo shard at the throat. Made for one night at the Infinity Forge.",
    ),
    source: {
      kind: "reward",
      when: { flag: "ending_halo" },
      hint: tr("Something will happen at the Infinity Forge."),
    },
    glows: true,
    colorways: [cw("forge", tr("colour::Forge charcoal"), "paint_black_lt", "paint_black", "gold")],
  },

  // ── Trousers ──
  {
    id: "cargo_dark",
    slot: "legs",
    name: tr("Work trousers"),
    blurb: tr("Dark, creased, a tape measure on the belt loop. The uniform nobody ordered."),
    source: START,
    colorways: [
      cw("dark", tr("colour::Charcoal"), "pants_dark", "carpet_blue", "hair_black"),
      cw("khaki", tr("colour::Khaki"), "olive_lt", "olive", "olive_dk"),
    ],
  },
  {
    id: "jeans",
    slot: "legs",
    name: tr("Jeans"),
    blurb: tr("Faded at the knees from kneeling in front of machines that would not start."),
    source: START,
    colorways: [
      cw("blue", tr("colour::Denim"), "jeans", "fabric_blue_shade", "brass"),
      cw("black", tr("colour::Black denim"), "paint_black_lt", "paint_black", "steel"),
    ],
  },
  {
    id: "workpants_hivis",
    slot: "legs",
    name: tr("Hi-vis work trousers"),
    blurb: tr("Safety orange, reflective bands. You will be seen. Mostly by bots."),
    source: craft({ stoffreste: 3, polymerfaser: 1 }, 40),
    colorways: [
      cw("orange", tr("colour::Safety orange"), "safety_orange", "orange_paint_dk", "chrome_lt"),
    ],
  },
  {
    id: "shorts_tights",
    slot: "legs",
    name: tr("Shorts & tights"),
    blurb: tr("Corduroy shorts over thick tights. The greenhouse is warm; the elevator is not."),
    source: craft({ stoffreste: 2, farbpigment: 1 }, 30),
    colorways: [
      cw("brown", tr("colour::Brown"), "leather", "leather_worn", "paint_black"),
      cw("green", tr("colour::Green"), "fabric_green", "fabric_green_shade", "paint_black"),
    ],
  },
  {
    id: "skirt_plaid",
    slot: "legs",
    name: tr("Plaid skirt"),
    blurb: tr(
      "Pleats, a safety pin, black tights. The one piece in the wardrobe that is not practical.",
    ),
    source: find(tr("A suitcase in the archive was never unpacked.")),
    colorways: [
      cw("red", tr("colour::Tartan red"), "fabric_red", "paint_black", "safety_yellow"),
      cw("green", tr("colour::Tartan green"), "fabric_green", "paint_navy", "paint_white"),
    ],
  },
  {
    id: "joggers",
    slot: "legs",
    name: tr("Joggers"),
    blurb: tr(
      "Grey, soft, disgraceful. For the ergometer and for Sundays that do not exist down here.",
    ),
    source: craft({ stoffreste: 2 }, 20),
    colorways: [
      cw("grey", tr("colour::Heather grey"), "fabric_gray", "fabric_gray_shade", "paint_white"),
      cw("black", tr("colour::Black"), "paint_black", "black", "paint_white"),
    ],
  },

  // ── Shoes ──
  {
    id: "skirt_gown",
    slot: "legs",
    name: tr("Evening skirt"),
    blurb: tr(
      "Satin to mid-calf, a sash, a swish on every stair. Packed for a gala the lab never had.",
    ),
    source: find(
      tr("A garment bag hangs in the room where the lab's radio once talked to the world."),
    ),
    colorways: [
      cw("midnight", tr("colour::Midnight"), "paint_navy", "black", "gold"),
      cw("emerald", tr("colour::Emerald"), "fabric_green", "fabric_green_shade", "gold"),
      cw("wine", tr("colour::Wine"), "fabric_red", "fabric_red_shade", "paint_cream"),
    ],
  },
  {
    id: "track_pants",
    slot: "legs",
    name: tr("Track pants 1989"),
    blurb: tr("Three stripes, a crackle on every step, cuffs that hold the ankle like a promise."),
    source: find(
      tr(
        "The track suit came in two parts. The trousers ended up in the drone hangar, folded into a tarp.",
      ),
    ),
    colorways: [
      cw("violet", tr("colour::Violet"), "purple_paint", "purple_paint_dk", "paint_white"),
      cw("navy", tr("colour::Navy"), "paint_navy", "black", "paint_white"),
    ],
  },
  {
    id: "leggings_sport",
    slot: "legs",
    name: tr("Running leggings"),
    blurb: tr(
      "A reflective stripe, a key pocket, zero drag. The long corridor on Level 0 is exactly 140 m.",
    ),
    source: craft({ polymerfaser: 2, stoffreste: 1 }, 25),
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_orange"),
      cw("teal", tr("colour::Teal"), "paint_teal", "paint_teal_dk", "paint_white"),
    ],
  },

  // ── Shoes ──
  {
    id: "boots_leather",
    slot: "feet",
    name: tr("Work boots"),
    blurb: tr("Laced, welted, steel toe. Heavy on grating, honest on concrete."),
    source: START,
    step: "boot",
    colorways: [
      cw("brown", tr("colour::Brown"), "leather", "walnut", "leather_worn"),
      cw("black", tr("colour::Black"), "leather_black", "black", "steel"),
    ],
  },
  {
    id: "sneakers",
    slot: "feet",
    name: tr("Sneakers"),
    blurb: tr("White canvas, rubber toe caps. They squeak on tile, which the tile deserves."),
    source: START,
    step: "sneaker",
    colorways: [
      cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "rubber"),
      cw("red", tr("colour::Red"), "safety_red", "fabric_red_shade", "paint_white"),
      dyed("neon", tr("colour::Neon"), "paint_lime", "green_paint_dk", "paint_pink", {
        farbpigment: 2,
      }),
    ],
  },
  {
    id: "rubber_boots",
    slot: "feet",
    name: tr("Rubber boots"),
    blurb: tr("Yellow wellies. Puddles are no longer a question of if."),
    source: craft({ polymerfaser: 2, stoffreste: 1 }, 30),
    step: "rubber",
    colorways: [
      cw("yellow", tr("colour::Yellow"), "safety_yellow", "fabric_mustard", "paint_black"),
      cw("green", tr("colour::Green"), "fabric_green", "fabric_green_shade", "paint_black"),
    ],
  },
  {
    id: "mag_boots",
    slot: "feet",
    name: tr("Magnetic boots"),
    blurb: tr(
      "Prototype. Coils in the soles, a hum in the ankles. They clamp to grating like a promise.",
    ),
    source: craft(
      { magnet: 2, kupferspule: 2, energiezelle: 1, polymerfaser: 1 },
      90,
      { device: "EMC-001", state: "built" },
      tr("Build the Exotic Matter Containment first — its field coils are the pattern."),
    ),
    step: "magnetic",
    layer: "hum",
    glows: true,
    colorways: [cw("steel", tr("colour::Steel"), "steel", "steel_dark", "led_blue")],
  },
  {
    id: "slippers",
    slot: "feet",
    name: tr("Bunny slippers"),
    blurb: tr("Grey plush, one ear chewed. Not lab-safe. Absolutely non-negotiable."),
    source: find(
      tr(
        "Not under Jade's bed. Somebody borrowed them — somebody with a room nobody was supposed to know about.",
      ),
    ),
    step: "slipper",
    colorways: [
      cw("grey", tr("colour::Grey"), "fabric_gray", "fabric_gray_shade", "paint_pink"),
      cw("pink", tr("colour::Pink"), "paint_pink", "fabric_red_shade", "paint_white"),
    ],
  },
  {
    id: "clogs",
    slot: "feet",
    name: tr("Lab clogs"),
    blurb: tr("Wooden soles, autoclavable uppers. Every step a small announcement."),
    source: craft({ stoffreste: 1, polymerfaser: 1 }, 25),
    step: "clog",
    colorways: [
      cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "wood"),
      cw("teal", tr("colour::Teal"), "paint_teal", "paint_teal_dk", "wood"),
    ],
  },
  {
    id: "roller_boots",
    slot: "feet",
    name: tr("Roller boots"),
    blurb: tr(
      "Four wheels, a toe stop, bearings that sing on the long corridors. Found, not approved.",
    ),
    source: find(
      tr(
        "A long corridor on the upper deck. Its cupboard shares a lock with the ventilation hatch. Something with wheels wants out.",
      ),
    ),
    step: "skate",
    colorways: [cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "paint_pink")],
  },
  {
    id: "court_shoes",
    slot: "feet",
    name: tr("Court shoes"),
    blurb: tr("A low heel, a pointed toe, a click the MCP can hear three rooms away."),
    source: craft({ stoffreste: 1, polymerfaser: 1, farbpigment: 1 }, 30),
    step: "clog",
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "chrome_lt"),
      cw("red", tr("colour::Red"), "safety_red", "fabric_red_shade", "chrome_lt"),
      cw("gold", tr("colour::Gold"), "gold", "brass_dk", "paint_black"),
    ],
  },
  {
    id: "winter_boots",
    slot: "feet",
    name: tr("Snow boots"),
    blurb: tr(
      "Padded to the calf, a fur cuff, a sole like a tractor tyre. The cryo bay has met its match.",
    ),
    source: craft({ stoffreste: 2, polymerfaser: 2 }, 40),
    step: "boot",
    colorways: [
      cw("brown", tr("colour::Brown"), "leather", "walnut", "paint_cream"),
      cw("grey", tr("colour::Grey"), "fabric_gray", "fabric_gray_shade", "paint_white"),
    ],
  },

  // ── Hairstyles (tones = hair colour; dyes cost pigment) ──
  ...(
    [
      [
        "updo",
        tr("High updo"),
        tr(
          "Sides pulled up, a pompadour rolled high into a bun, a few waves that never stay put. Twenty pins, one minute, no mirror.",
        ),
        START,
      ],
      [
        "ponytail",
        tr("Low ponytail"),
        tr("Tied with the teal band. Practical, and it swings when she runs."),
        START,
      ],
      ["bun", tr("Messy bun"), tr("A pencil holds it together. Two pencils on bad days."), START],
      ["loose", tr("Loose"), tr("Down to the shoulders. Only when nothing is on fire."), START],
      ["bob", tr("Bob"), tr("Chin length, a cut she did herself with the good scissors."), START],
      [
        "braids",
        tr("Braids"),
        tr("Two tight braids — they stay out of machines."),
        find(
          tr(
            "Where the presses stamp on the power level, a hair tie waits with a note: “For when the machines get close.”",
          ),
        ),
      ],
      [
        "space_buns",
        tr("Space buns"),
        tr("Two buns like antennae. B4C0N keeps asking which frequency."),
        find(tr("The observatory has seen stranger things than two hair ties.")),
      ],
      [
        "pixie",
        tr("Pixie cut"),
        tr("Short, no fuss. The hairdryer in the quarters died in 2019."),
        find(
          tr(
            "Scissors and a mirror shard in the cabinet where the deep-lab crew washed up before going down.",
          ),
        ),
      ],
      [
        "undercut",
        tr("Undercut"),
        tr("Shaved sides, a long top. Nobody is here to have an opinion."),
        {
          kind: "reward",
          when: { counter: "slices", min: 10 },
          hint: tr("Find ten slices of Crystal #0089."),
        },
      ],
    ] as const
  ).map(
    ([id, name, blurb, source]): WearItem => ({
      id: `hair_${id}`,
      slot: "hair",
      name,
      blurb,
      source,
      colorways: [
        cw(
          "copper",
          tr("colour::Copper orange"),
          "hair_copper",
          "hair_copper_dk",
          "hair_copper_lt",
        ),
        cw("auburn", tr("colour::Auburn"), "hair_auburn", "wood_red", "rust"),
        cw("brown", tr("colour::Brown"), "hair_brown", "walnut", "wood"),
        cw("black", tr("colour::Black"), "hair_black", "paint_black", "paint_black_lt"),
        cw("blond", tr("colour::Blond"), "hair_blond", "fabric_mustard", "paper_yellow"),
        dyed("silver", tr("colour::Silver"), "hair_gray", "steel", "paint_white", {
          farbpigment: 2,
        }),
        dyed("teal", tr("colour::Teal dye"), "paint_teal", "paint_teal_dk", "sweater_teal", {
          farbpigment: 2,
        }),
        dyed("magenta", tr("colour::Magenta dye"), "paint_pink", "purple_paint", "paint_lilac", {
          farbpigment: 3,
        }),
        dyed("cerulean", tr("colour::Cerulean 490"), "blue_paint", "blue_paint_dk", "paint_sky", {
          farbpigment: 2,
          halo_staub: 1,
        }),
      ],
    }),
  ),

  // ── Headgear ──
  {
    id: "goggles_amber",
    slot: "head",
    name: tr("Amber goggles"),
    blurb: tr("Pushed up on the forehead, where they have been since 2016."),
    source: START,
    colorways: [cw("amber", tr("colour::Amber"), "goggles", "leather_black", "fabric_mustard")],
  },
  {
    id: "hardhat",
    slot: "head",
    name: tr("Hard hat"),
    blurb: tr(
      "White shell, a _unLAB sticker, a crack from the day the hangar crane moved on its own.",
    ),
    source: find(tr("The hangar keeps its safety gear where the crane cannot reach.")),
    coversHair: true,
    colorways: [
      cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "safety_orange"),
      cw("yellow", tr("colour::Yellow"), "safety_yellow", "fabric_mustard", "paint_black"),
    ],
  },
  {
    id: "welding_helmet",
    slot: "head",
    name: tr("Welding helmet"),
    blurb: tr(
      "Flipped up, dark glass, stickers from three different forges. Jade only knows one of them.",
    ),
    source: craft(
      { gehaeuseplatte: 2, linse: 1, polymerfaser: 1 },
      60,
      { device: "P3D-001", state: "built" },
      tr("Build the 3D Fabricator first — it prints the hinge."),
    ),
    coversHair: true,
    coversFace: true,
    colorways: [cw("black", tr("colour::Black"), "paint_black", "black", "glass_dark")],
  },
  {
    id: "headphones",
    slot: "head",
    name: tr("Studio headphones"),
    blurb: tr(
      "Closed-back, coiled cable, Damien's initials under the band. They still smell of the studio.",
    ),
    source: { kind: "reward", when: { flag: "studio_open" }, hint: tr("Find Damien's studio.") },
    colorways: [cw("black", tr("colour::Black"), "paint_black", "steel", "led_red")],
  },
  {
    id: "beanie",
    slot: "head",
    name: tr("Beanie"),
    blurb: tr("Rib knit, a pompom that has seen things. The deep floors are cold."),
    source: craft({ stoffreste: 2 }, 15),
    coversHair: true,
    colorways: [
      cw("orange", tr("colour::Orange"), "safety_orange", "orange_paint_dk", "paint_white"),
      cw("teal", tr("colour::Teal"), "sweater_teal", "paint_teal", "paint_white"),
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_red"),
    ],
  },
  {
    id: "cap",
    slot: "head",
    name: tr("_unLAB cap"),
    blurb: tr("Curved peak, the crystal embroidered in green. Worn backwards on debugging days."),
    source: craft({ stoffreste: 1, farbpigment: 1 }, 15),
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "screen_green"),
      cw("red", tr("colour::Red"), "safety_red", "fabric_red_shade", "paint_white"),
    ],
  },
  {
    id: "headlamp",
    slot: "head",
    name: tr("Headlamp"),
    blurb: tr("An elastic band, a lamp, three brightness settings, all of them “too bright”."),
    source: craft({ linse: 1, batteriezelle: 1, polymerfaser: 1 }, 40),
    glows: true,
    colorways: [cw("black", tr("colour::Black"), "paint_black", "steel", "lamp_cold")],
  },
  {
    id: "antenna_band",
    slot: "head",
    name: tr("Antenna headband"),
    blurb: tr("Two springs, two LEDs, zero function. B4C0N thinks she finally joined the family."),
    source: craft(
      { antenne: 2, kondensator: 1 },
      45,
      { counter: "bots_awake", min: 1 },
      tr("Wake a bot first — it has opinions about antennae."),
    ),
    glows: true,
    colorways: [cw("silver", tr("colour::Silver"), "steel", "steel_dark", "led_green")],
  },
  {
    id: "propeller_cap",
    slot: "head",
    name: tr("Propeller cap"),
    blurb: tr(
      "Nobody ordered this. The propeller turns when she runs. Nobody asked for that either.",
    ),
    source: find(
      tr(
        "Something with a propeller once flew into the hangar's ventilation. It only comes down after the drone's first flight.",
      ),
    ),
    colorways: [cw("rainbow", tr("colour::Rainbow"), "safety_red", "safety_blue", "safety_yellow")],
  },
  {
    id: "crystal_tiara",
    slot: "head",
    name: tr("Crystal circlet"),
    blurb: tr("A thin band of Halo glass that hums at 847 Hz. It fits as if it had been waiting."),
    source: {
      kind: "reward",
      when: { counter: "slices", min: 30 },
      hint: tr("Collect all 30 slices of Crystal #0089."),
    },
    glows: true,
    colorways: [cw("halo", tr("colour::Halo"), "crystal_cyan", "halo_glow", "gold_lt")],
  },
  {
    id: "sou_wester",
    slot: "head",
    name: tr("Sou'wester"),
    blurb: tr(
      "Yellow oilskin, a brim that is longer at the back. The cooling floors drip down the neck otherwise.",
    ),
    source: find(tr("A rain hat waits on a hook by the pumps of the cooling level.")),
    coversHair: true,
    colorways: [
      cw("yellow", tr("colour::Yellow"), "safety_yellow", "fabric_mustard", "paint_black"),
      cw("navy", tr("colour::Navy"), "paint_navy", "black", "paint_white"),
    ],
  },
  {
    id: "flower_crown",
    slot: "head",
    name: tr("Neon flower crown"),
    blurb: tr("Glow-thread petals round the updo. K2-LDR wove it, then denied everything."),
    source: {
      kind: "reward",
      when: { counter: "bots_awake", min: 10 },
      hint: tr("Wake all ten lore bots."),
    },
    glows: true,
    colorways: [cw("neon", tr("colour::Neon"), "neon_pink", "led_green", "screen_cyan")],
  },
  {
    id: "sweatband",
    slot: "head",
    name: tr("Sweatband"),
    blurb: tr("Terry towelling, a stripe, a small crystal stitched on. It has seen every lap."),
    source: craft({ stoffreste: 1 }, 10),
    colorways: [
      cw("white", tr("colour::White"), "paint_white", "paint_white_dk", "safety_red"),
      cw("teal", tr("colour::Teal"), "sweater_teal", "paint_teal", "paint_white"),
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_orange"),
    ],
  },

  // ── Face ──
  {
    id: "safety_glasses",
    slot: "face",
    name: tr("Safety glasses"),
    blurb: tr("Clear wrap-around polycarbonate. Rule no. 7, and for once she follows it."),
    source: START,
    colorways: [cw("clear", tr("colour::Clear"), "glass", "paint_black", "safety_yellow")],
  },
  {
    id: "face_shield",
    slot: "face",
    name: tr("Splash shield"),
    blurb: tr(
      "A full visor on a headband. For the workbench, where things splash, spark and occasionally scream.",
    ),
    source: craft({ polymerfaser: 2, linse: 1 }, 35),
    colorways: [cw("clear", tr("colour::Clear"), "glass", "safety_blue", "paint_black")],
  },
  {
    id: "respirator",
    slot: "face",
    name: tr("Respirator"),
    blurb: tr("Twin filters, a rubber seal, a voice like a very polite robot."),
    source: craft({ polymerfaser: 2, membran: 1 }, 45),
    colorways: [
      cw("grey", tr("colour::Grey"), "rubber", "paint_gray_dk", "safety_orange"),
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_red"),
    ],
  },
  {
    id: "round_glasses",
    slot: "face",
    name: tr("Round glasses"),
    blurb: tr("Brass wire frames. She does not need them. She reads better with them anyway."),
    source: find(tr("Old reading glasses lie in the room with the most books.")),
    colorways: [cw("brass", tr("colour::Brass"), "brass", "brass_dk", "glass")],
  },
  {
    id: "hud_visor",
    slot: "face",
    name: tr("HUD visor"),
    blurb: tr(
      "A cyan strip across the eyes that shows the room's power draw. Mostly it shows a clock.",
    ),
    source: craft(
      { display: 1, glasfaser: 1, leuchtfaden: 1, energiezelle: 1 },
      75,
      { device: "NET-001", state: "online" },
      tr("The visor needs the lab network online to have anything to show."),
    ),
    glows: true,
    colorways: [
      cw("cyan", tr("colour::Cyan"), "holo_cyan", "paint_black", "screen_cyan"),
      cw("amber", tr("colour::Amber"), "screen_amber", "paint_black", "led_amber"),
    ],
  },
  {
    id: "band_aid",
    slot: "face",
    name: tr("Plaster"),
    blurb: tr("Across the nose. A souvenir of the combination that should not have worked."),
    source: {
      kind: "reward",
      when: { counter: "explosions", min: 3 },
      hint: tr("Three explosions at the workbench. It happens."),
    },
    colorways: [cw("skin", tr("colour::Plaster"), "paper_pink", "skin_shadow", "paint_white")],
  },
  {
    id: "fake_mustache",
    slot: "face",
    name: tr("Fake moustache"),
    blurb: tr("For the camera in the airlock. The MCP has not recognised her since. Allegedly."),
    source: find(
      tr("The costume box of the 2018 Christmas party was archived. Deep, cold and off the plans."),
    ),
    colorways: [cw("brown", tr("colour::Brown"), "hair_brown", "walnut", "walnut")],
  },
  {
    id: "sunglasses",
    slot: "face",
    name: tr("Sunglasses"),
    blurb: tr("Square frames, dark lenses, 1989. Pointless underground. Worn anyway."),
    source: find(tr("A pair of sunglasses lies on the observatory console, pointing at the sky.")),
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "glass_dark"),
      cw("neon", tr("colour::Neon"), "paint_pink", "purple_paint", "glass_dark"),
    ],
  },

  // ── Gloves ──
  {
    id: "nitrile",
    slot: "hands",
    name: tr("Nitrile gloves"),
    blurb: tr("Blue, powder-free, one size too big. A spare pair lives in every coat pocket."),
    source: START,
    colorways: [
      cw("blue", tr("colour::Blue"), "paint_sky", "safety_blue", "paint_sky"),
      cw("black", tr("colour::Black"), "paint_black", "black", "paint_black_lt"),
    ],
  },
  {
    id: "welding_gloves",
    slot: "hands",
    name: tr("Welding gauntlets"),
    blurb: tr("Split leather to the elbow. The forge's handshake is hot."),
    source: craft(
      { stoffreste: 2, polymerfaser: 1 },
      30,
      { device: "P3D-001", state: "built" },
      tr("Build the 3D Fabricator first — it prints the cuffs."),
    ),
    colorways: [cw("leather", tr("colour::Leather"), "leather", "leather_worn", "fabric_red")],
  },
  {
    id: "fingerless",
    slot: "hands",
    name: tr("Fingerless gloves"),
    blurb: tr("Knitted, for typing in the cold. The server room feels like winter."),
    source: craft({ stoffreste: 1 }, 10),
    colorways: [
      cw("grey", tr("colour::Grey"), "fabric_gray", "fabric_gray_shade", "fabric_gray"),
      cw("striped", tr("colour::Striped"), "fabric_red", "paint_white", "paint_white"),
    ],
  },
  {
    id: "insulated_gloves",
    slot: "hands",
    name: tr("Insulating gloves"),
    blurb: tr("Class 0, rated to 1000 V, orange cuffs. The switchgear says hello."),
    source: find(tr("The reactor's switchgear keeps its gloves in a cabinet by the busbars.")),
    colorways: [
      cw("yellow", tr("colour::Yellow"), "safety_yellow", "fabric_mustard", "safety_orange"),
    ],
  },
  {
    id: "servo_gloves",
    slot: "hands",
    name: tr("Servo gloves"),
    blurb: tr(
      "Prototype. Tiny servos on every knuckle, a grip like a vice, a whine like a mosquito.",
    ),
    source: craft(
      { servo: 2, platine: 1, energiezelle: 1, polymerfaser: 1 },
      90,
      { counter: "bots_awake", min: 5 },
      tr("Five awake bots would have the spare servos."),
    ),
    glows: true,
    colorways: [cw("carbon", tr("colour::Carbon"), "paint_black", "steel", "led_green")],
  },

  // ── Back ──
  {
    id: "backpack",
    slot: "back",
    name: tr("Field backpack"),
    blurb: tr(
      "Canvas, leather straps, a thermos pocket. Everything she carries somehow fits in it.",
    ),
    source: craft({ stoffreste: 3, polymerfaser: 1 }, 40),
    colorways: [
      cw("olive", tr("colour::Olive"), "olive", "olive_dk", "leather"),
      cw("orange", tr("colour::Orange"), "safety_orange", "orange_paint_dk", "paint_black"),
    ],
  },
  {
    id: "oxygen_tank",
    slot: "back",
    name: tr("Oxygen cylinder"),
    blurb: tr(
      "A small green bottle on a harness. For the sealed rooms, and for dramatic entrances.",
    ),
    source: find(tr("The airlock has a second emergency locker. Nobody ever emptied it.")),
    layer: "clank",
    colorways: [cw("green", tr("colour::Green"), "safety_green", "green_paint_dk", "chrome")],
  },
  {
    id: "jetpack",
    slot: "back",
    name: tr("Jetpack prototype"),
    blurb: tr(
      "Two nozzles, one tank, no permit. It does not fly. The pilot light is lovely, though.",
    ),
    source: craft(
      { duese: 2, plasmaring: 1, basislegierung: 2, energiezelle: 2 },
      120,
      { device: "MFR-001", state: "built" },
      tr("A running reactor first. Nobody straps a nozzle to their back without one."),
    ),
    layer: "clank",
    glows: true,
    colorways: [cw("chrome", tr("colour::Chrome"), "chrome", "steel_dark", "fire")],
  },
  {
    id: "bot_carrier",
    slot: "back",
    name: tr("Bot carrier"),
    blurb: tr("A frame with a sleeping mini-bot strapped in. It wakes up when she climbs stairs."),
    source: {
      kind: "reward",
      when: { counter: "bots_awake", min: 10 },
      hint: tr("Wake all ten lore bots."),
    },
    colorways: [cw("steel", tr("colour::Steel"), "steel", "bot_dark", "led_amber")],
  },
  {
    id: "cape",
    slot: "back",
    name: tr("Lab cape"),
    blurb: tr(
      "A lab coat with the sleeves cut off, worn the wrong way round. Science needs a hero.",
    ),
    source: craft(
      { stoffreste: 3, farbpigment: 2 },
      40,
      { counter: "endings", min: 1 },
      tr("Reach any ending. Heroes get capes afterwards."),
    ),
    colorways: [
      cw("red", tr("colour::Red"), "fabric_red", "fabric_red_shade", "gold"),
      cw("white", tr("colour::White"), "coat_white", "coat_shadow", "badge_blue"),
    ],
  },

  // ── Neck ──
  {
    id: "gig_bag",
    slot: "back",
    name: tr("Gig bag"),
    blurb: tr(
      "A padded guitar bag, Damien's studio sticker on the pocket. The guitar is still inside, out of tune.",
    ),
    source: { kind: "reward", when: { flag: "studio_open" }, hint: tr("Find Damien's studio.") },
    layer: "rustle",
    colorways: [cw("black", tr("colour::Black"), "paint_black", "black", "steel")],
  },

  // ── Neck ──
  {
    id: "scarf",
    slot: "neck",
    name: tr("Wool scarf"),
    blurb: tr("Red, far too long, wrapped twice. The ends swing when she runs."),
    source: craft({ stoffreste: 2 }, 20),
    colorways: [
      cw("red", tr("colour::Red"), "scarf_red", "fabric_red_shade", "paint_white"),
      cw("teal", tr("colour::Teal"), "sweater_teal", "paint_teal", "paint_white"),
      cw("mustard", tr("colour::Mustard"), "fabric_mustard", "fabric_mustard_shade", "paint_white"),
    ],
  },
  {
    id: "lanyard_keys",
    slot: "neck",
    name: tr("Key lanyard"),
    blurb: tr("Seventeen keys, three of which open something. They jingle with every step."),
    source: find(tr("The janitor's hook in the materials store still holds a bunch of keys.")),
    layer: "keys",
    colorways: [cw("red", tr("colour::Red"), "safety_red", "brass", "steel")],
  },
  {
    id: "crystal_pendant",
    slot: "neck",
    name: tr("Crystal pendant"),
    blurb: tr("A splinter of unETH on a copper wire. It chimes very softly when she moves."),
    source: craft(
      { quarzkristall: 1, kupferspule: 1, leuchtfaden: 1 },
      50,
      { counter: "slices", min: 3 },
      tr("Find three slices of the crystal first — the pendant copies their hum."),
    ),
    layer: "chime",
    glows: true,
    colorways: [
      cw("violet", tr("colour::Violet"), "crystal_violet", "copper", "neon_purple"),
      cw("cyan", tr("colour::Cyan"), "crystal_cyan", "copper", "holo_cyan"),
      cw("rose", tr("colour::Rose"), "crystal_rose", "copper", "neon_pink"),
    ],
  },
  {
    id: "bow_tie",
    slot: "neck",
    name: tr("Bow tie"),
    blurb: tr("For the endings. Every ending deserves a bow tie."),
    source: craft({ stoffreste: 1, farbpigment: 1 }, 15),
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "paint_black"),
      cw("red", tr("colour::Red"), "safety_red", "fabric_red_shade", "fabric_red_shade"),
      cw("dots", tr("colour::Polka dots"), "paint_navy", "paint_white", "paint_white"),
    ],
  },
  {
    id: "pearl_necklace",
    slot: "neck",
    name: tr("Pearl necklace"),
    blurb: tr(
      "One strand, one knot between each pearl. It belonged to somebody who dressed up for experiments.",
    ),
    source: find(
      tr("A jewellery box waits between the library shelves — a present nobody ever unwrapped."),
    ),
    colorways: [cw("pearl", tr("colour::Pearl"), "paint_white", "paint_cream", "white")],
  },
  {
    id: "tie_loose",
    slot: "neck",
    name: tr("Loosened tie"),
    blurb: tr(
      "Skinny, black, knot pulled down two fingers. Damien wore it to every meeting and to none of the photos.",
    ),
    source: {
      kind: "reward",
      when: { insight: "damien_echo" },
      hint: tr("Hear Damien's echo."),
    },
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "paint_black_lt"),
      cw("wine", tr("colour::Wine"), "fabric_red_shade", "wood_red", "fabric_red"),
    ],
  },

  // ── Belt ──
  {
    id: "toolbelt",
    slot: "belt",
    name: tr("Belt with tape measure"),
    blurb: tr("Brass buckle, a tape measure, a carabiner with the wrong keys on it."),
    source: START,
    colorways: [cw("leather", tr("colour::Leather"), "leather_black", "brass", "safety_yellow")],
  },
  {
    id: "utility_belt",
    slot: "belt",
    name: tr("Full tool belt"),
    blurb: tr(
      "Hammer loop, pliers, three screwdrivers, a multimeter. Rattles like a toolbox with legs.",
    ),
    source: craft({ stoffreste: 1, schraubensatz: 2, zahnrad: 1 }, 35),
    layer: "tools",
    colorways: [cw("brown", tr("colour::Brown"), "leather", "leather_worn", "steel")],
  },
  {
    id: "fanny_pack",
    slot: "belt",
    name: tr("Bum bag"),
    blurb: tr("Neon, 1990s, zipped. Contents: gum, a fuse, the good pen."),
    source: find(
      tr("The shaft crew's lost-and-found box at the bottom of the pit is older than the lab."),
    ),
    colorways: [
      cw("neon", tr("colour::Neon"), "paint_pink", "purple_paint", "paint_lime"),
      cw("black", tr("colour::Black"), "paint_black", "black", "safety_yellow"),
    ],
  },

  // ── Wrist ──
  {
    id: "watch",
    slot: "wrist",
    name: tr("Wrist watch"),
    blurb: tr("Leather strap, a cyan face. It has shown 03:27 more often than is healthy."),
    source: START,
    glows: true,
    colorways: [cw("cyan", tr("colour::Cyan"), "leather_black", "chrome", "screen_cyan")],
  },
  {
    id: "smartband",
    slot: "wrist",
    name: tr("Biorhythm band"),
    blurb: tr("Counts steps, coffee and sighs. Syncs with nothing, beeps anyway."),
    source: craft({ display: 1, batteriezelle: 1 }, 40),
    glows: true,
    colorways: [
      cw("black", tr("colour::Black"), "paint_black", "black", "led_green"),
      cw("mint", tr("colour::Mint"), "paint_mint", "paint_mint_dk", "led_white"),
    ],
  },
  {
    id: "wrist_computer",
    slot: "wrist",
    name: tr("Wrist terminal"),
    blurb: tr("A chunky green terminal strapped to the forearm. It runs one command: `status`."),
    source: craft(
      { display: 1, platine: 1, speicherchip: 1, energiezelle: 1 },
      80,
      { device: "MEM-001", state: "built" },
      tr("It needs a memory core to boot from."),
    ),
    glows: true,
    colorways: [cw("olive", tr("colour::Olive"), "olive", "olive_dk", "screen_green")],
  },
  {
    id: "friendship_band",
    slot: "wrist",
    name: tr("Friendship bracelet"),
    blurb: tr(
      "Woven from ten colours of cable sleeve — one per bot. Somebody made it while she was not looking.",
    ),
    source: find(
      tr(
        "The bot depot. Once its residents are awake, something small turns up where they charge.",
      ),
    ),
    colorways: [cw("rainbow", tr("colour::Rainbow"), "cable_red", "cable_yellow", "safety_blue")],
  },
  {
    id: "glow_bands",
    slot: "wrist",
    name: tr("Glow bangles"),
    blurb: tr(
      "Five bangles of spun glow thread. They charge in the lamp light and fade by morning.",
    ),
    source: craft({ leuchtfaden: 1, polymerfaser: 1, farbpigment: 1 }, 20),
    glows: true,
    colorways: [cw("neon", tr("colour::Neon"), "neon_pink", "screen_cyan", "led_green")],
  },

  // ── Shoulder buddies ──
  {
    id: "buddy_f1ndr",
    slot: "buddy",
    name: tr("Mini F1N-DR"),
    blurb: tr("A palm-sized finder on her shoulder. Its face stays calm, its tracks keep turning."),
    source: craft(
      { servo: 1, sensorkopf: 1, gehaeuseplatte: 1, energiezelle: 1 },
      100,
      { counter: "bots_awake", min: 2 },
      tr("Wake two bots — one of them will offer a blueprint."),
    ),
    layer: "squeak",
    glows: true,
    colorways: [cw("grey", tr("colour::Grey"), "bot_body", "bot_dark", "screen_green")],
  },
  {
    id: "buddy_drone",
    slot: "buddy",
    name: tr("Pocket drone"),
    blurb: tr("Hovers over her shoulder, lights the floor, bumps into doors. Loyal to a fault."),
    source: craft(
      { rotor: 2, sensorkopf: 1, batteriezelle: 1, leuchtfaden: 1 },
      110,
      { device: "EXD-001", state: "built" },
      tr("Build the Explorer Drone first — the pocket version copies its firmware."),
    ),
    layer: "hum",
    glows: true,
    colorways: [cw("white", tr("colour::White"), "paint_white", "steel", "led_blue")],
  },
  {
    id: "buddy_plush",
    slot: "buddy",
    name: tr("Plush MCP"),
    blurb: tr("A felt eye with a red button pupil. The real MCP calls it “unauthorised likeness”."),
    source: find(
      tr("A plush toy in the kids' corner of the canteen? There is no kids' corner. Look anyway."),
    ),
    colorways: [cw("red", tr("colour::Red"), "paint_black", "mcp_red", "paint_white")],
  },
];

export const WEAR_BY_ID: ReadonlyMap<string, WearItem> = new Map(WEAR_ITEMS.map((w) => [w.id, w]));

/** Everything Jade wears: one item id (and colourway id) per slot, `null` = nothing. */
export type JadeLook = Record<WearSlot, { item: string; colorway: string } | null>;

/**
 * Jade's first-day look (title screen, new games): the stand-collar shirt
 * under the lab coat — the collar shows over the lapels — her copper updo,
 * no goggles or glasses (they are accessories now). Pinned by
 * tests/world/jade-look.test.ts.
 */
export const DEFAULT_LOOK: JadeLook = {
  top: { item: "shirt_collar_geo", colorway: "white" },
  outer: { item: "labcoat", colorway: "white" },
  legs: { item: "cargo_dark", colorway: "dark" },
  feet: { item: "boots_leather", colorway: "brown" },
  hair: { item: "hair_updo", colorway: "copper" },
  head: null,
  face: null,
  hands: null,
  back: null,
  neck: null,
  belt: { item: "toolbelt", colorway: "leather" },
  wrist: { item: "watch", colorway: "cyan" },
  buddy: null,
};

/**
 * The first-day look of saves before the 2026 rework (SAVE_VERSION 6):
 * teal sweater, ponytail, amber goggles. The v6 → v7 migration moves a
 * save still wearing exactly this to `DEFAULT_LOOK`.
 */
export const LEGACY_DEFAULT_LOOK: JadeLook = {
  top: { item: "sweater_teal", colorway: "teal" },
  outer: { item: "labcoat", colorway: "white" },
  legs: { item: "cargo_dark", colorway: "dark" },
  feet: { item: "boots_leather", colorway: "brown" },
  hair: { item: "hair_ponytail", colorway: "auburn" },
  head: { item: "goggles_amber", colorway: "amber" },
  face: null,
  hands: null,
  back: null,
  neck: null,
  belt: { item: "toolbelt", colorway: "leather" },
  wrist: { item: "watch", colorway: "cyan" },
  buddy: null,
};

/** Named outfit slots in the character menu. */
export const OUTFIT_PRESETS = 4;

// ── Replicator: textile resources and refining ──────────────────

/** New resource items for clothes (defined in content/items.ts). */
export const TEXTILE_ITEMS = ["stoffreste", "polymerfaser", "farbpigment", "leuchtfaden"] as const;

export interface RefineRecipe {
  id: string;
  label: string;
  inputs: Readonly<Record<string, number>>;
  output: string;
  count: number;
  seconds: number;
}

/** What the replicator's “Refine” tab turns salvage into. */
export const REFINE_RECIPES: readonly RefineRecipe[] = [
  {
    id: "fibre_harness",
    label: tr("Strip a cable harness into polymer fibre"),
    inputs: { kabelbaum: 1 },
    output: "polymerfaser",
    count: 2,
    seconds: 8,
  },
  {
    id: "fibre_filter",
    label: tr("Card a filter cartridge into polymer fibre"),
    inputs: { filterpatrone: 1 },
    output: "polymerfaser",
    count: 1,
    seconds: 6,
  },
  {
    id: "pigment_algae",
    label: tr("Press glow algae into pigment"),
    inputs: { leuchtalgen: 1 },
    output: "farbpigment",
    count: 2,
    seconds: 6,
  },
  {
    id: "pigment_mycel",
    label: tr("Dry mycelium into pigment"),
    inputs: { myzel: 1 },
    output: "farbpigment",
    count: 1,
    seconds: 5,
  },
  {
    id: "pigment_coffee",
    label: tr("Boil coffee beans into brown pigment"),
    inputs: { kaffeebohnen: 2 },
    output: "farbpigment",
    count: 1,
    seconds: 5,
  },
  {
    id: "pigment_rust",
    label: tr("Grind slag into rust pigment"),
    inputs: { schlacke: 1 },
    output: "farbpigment",
    count: 1,
    seconds: 5,
  },
  {
    id: "glow_thread",
    label: tr("Spin glow thread from fibre optics and pigment"),
    inputs: { glasfaser: 1, farbpigment: 1 },
    output: "leuchtfaden",
    count: 2,
    seconds: 10,
  },
];

/** Recycling a crafted piece returns this share of its fabric resources (rounded down, min. 1 scrap). */
export const RECYCLE_SHARE = 0.5;

// ── The replicator in Jade's quarters ───────────────────────────

/**
 * Map prop of Jade's wardrobe replicator “Needle's Eye” (NDL-0) in her
 * quarters, next to the wardrobe (content/map.ts, model: decor
 * `wardrobe_replicator` via the prop variant of the same name).
 */
export const REPLICATOR_PROP = "wardrobe_replicator";

/** Grid output the replicator needs to start a job (same as the Food Replicator). */
export const REPLICATOR_POWER = 50;

/** Seconds a dye job takes. */
export const DYE_SECONDS = 12;

/** Flag set the first time Jade opens the replicator (her intro log). */
export const REPLICATOR_INTRO_FLAG = "ndl_intro_seen";

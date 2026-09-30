/**
 * Jade's signature looks — complete outfits (pure data).
 * ======================================================
 *
 * Eighteen curated looks, each a full `JadeLook` (every slot set or
 * explicitly empty). A look is *unlocked* when:
 *
 * - `start`  — from the first minute (only starter pieces),
 * - `craft`  — Jade owns every piece (the replicator makes them),
 * - `find`   — Jade owns every piece (at least one is hidden in the lab),
 * - `event`  — `when` holds (a story event); unlocking hands over every
 *              missing piece and every dyed colour the look needs.
 *
 * Unlocked looks are listed in the character menu ("Looks" tab) and put on
 * with one click (clothes, shoes and hair only at the wardrobe). Rules:
 * lib/world/looks.ts. German: lib/i18n/de/wardrobe.ts.
 */
import { tr } from "@/lib/i18n";
import type { JadeLook } from "@/lib/world/content/wardrobe";
import type { Condition } from "@/lib/world/types";

export type LookUnlock =
  | { kind: "start" }
  | { kind: "craft" }
  | { kind: "find" }
  | {
      kind: "event";
      when: Condition;
      /** Shown while locked (spoiler-safe). */
      hint: string;
      /** Secret: the menu shows only "???" and the hint until unlocked. */
      secret?: boolean;
    };

export interface SignatureLook {
  id: string;
  name: string;
  /** One line in the lab's voice. */
  description: string;
  look: JadeLook;
  unlock: LookUnlock;
}

type Piece = { item: string; colorway: string } | null;
const p = (item: string, colorway: string): Piece => ({ item, colorway });

/** Every slot spelled out, so a look never inherits anything by accident. */
function look(l: JadeLook): JadeLook {
  return l;
}

const START = { kind: "start" } as const;
const CRAFT = { kind: "craft" } as const;
const FIND = { kind: "find" } as const;

export const SIGNATURE_LOOKS: readonly SignatureLook[] = [
  // ── From the start ──
  {
    id: "lab_lead",
    name: tr("Lead Researcher"),
    description: tr(
      "Shirt, coat, gloves, goggles pushed up. The version of Jade the grant committee met.",
    ),
    unlock: START,
    look: look({
      top: p("shirt_collar_geo", "white"),
      outer: p("labcoat", "white"),
      legs: p("cargo_dark", "dark"),
      feet: p("boots_leather", "brown"),
      hair: p("hair_updo", "copper"),
      head: p("goggles_amber", "amber"),
      face: null,
      hands: p("nitrile", "blue"),
      back: null,
      neck: null,
      belt: p("toolbelt", "leather"),
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
  {
    id: "weekend",
    name: tr("Weekend"),
    description: tr("Tee, jeans, hair down. Down here a weekend is a state of mind."),
    unlock: START,
    look: look({
      top: p("tee_unlab", "white"),
      outer: null,
      legs: p("jeans", "blue"),
      feet: p("sneakers", "white"),
      hair: p("hair_loose", "copper"),
      head: null,
      face: null,
      hands: null,
      back: null,
      neck: null,
      belt: null,
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
  // ── Replicated piece by piece ──
  {
    id: "night_shift",
    name: tr("Night Shift"),
    description: tr("Soft layers, a headlamp, fingerless gloves for the keyboard at 03:27."),
    unlock: CRAFT,
    look: look({
      top: p("turtleneck", "black"),
      outer: p("cardigan", "grey"),
      legs: p("joggers", "black"),
      feet: p("clogs", "teal"),
      hair: p("hair_bun", "copper"),
      head: p("headlamp", "black"),
      face: null,
      hands: p("fingerless", "grey"),
      back: null,
      neck: null,
      belt: null,
      wrist: p("smartband", "black"),
      buddy: null,
    }),
  },
  {
    id: "morning_laps",
    name: tr("Morning Laps"),
    description: tr(
      "Leggings, a sweatband, a ponytail that keeps time. Level 0 has the longest corridor.",
    ),
    unlock: CRAFT,
    look: look({
      top: p("overall_top", "white"),
      outer: null,
      legs: p("leggings_sport", "black"),
      feet: p("sneakers", "red"),
      hair: p("hair_ponytail", "copper"),
      head: p("sweatband", "white"),
      face: null,
      hands: null,
      back: null,
      neck: null,
      belt: null,
      wrist: p("smartband", "mint"),
      buddy: null,
    }),
  },
  {
    id: "surface_winter",
    name: tr("Surface Winter"),
    description: tr(
      "Parka, star sweater, snow boots, a scarf far too long. For the day she goes up.",
    ),
    unlock: CRAFT,
    look: look({
      top: p("sweater_nordic", "red"),
      outer: p("parka", "olive"),
      legs: p("cargo_dark", "khaki"),
      feet: p("winter_boots", "brown"),
      hair: p("hair_loose", "copper"),
      head: p("beanie", "teal"),
      face: null,
      hands: p("fingerless", "striped"),
      back: null,
      neck: p("scarf", "red"),
      belt: null,
      wrist: null,
      buddy: null,
    }),
  },
  {
    id: "containment_drill",
    name: tr("Containment Drill"),
    description: tr("Hazmat suit, respirator, hi-vis. Walk, do not run. The MCP times it anyway."),
    unlock: CRAFT,
    look: look({
      top: p("overall_top", "grey"),
      outer: p("hazmat_suit", "yellow"),
      legs: p("workpants_hivis", "orange"),
      feet: p("rubber_boots", "yellow"),
      hair: p("hair_bun", "copper"),
      head: null,
      face: p("respirator", "grey"),
      hands: p("nitrile", "black"),
      back: null,
      neck: null,
      belt: null,
      wrist: null,
      buddy: null,
    }),
  },
  // ── Found in the lab ──
  {
    id: "cottbus_1989",
    name: tr("Cottbus 1989"),
    description: tr(
      "Shell suit, sunglasses, bum bag. The year the lab's first crystal was a rumour.",
    ),
    unlock: FIND,
    look: look({
      top: p("turtleneck", "cream"),
      outer: p("track_jacket", "turquoise"),
      legs: p("track_pants", "violet"),
      feet: p("sneakers", "white"),
      hair: p("hair_bob", "copper"),
      head: null,
      face: p("sunglasses", "black"),
      hands: null,
      back: null,
      neck: null,
      belt: p("fanny_pack", "neon"),
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
  {
    id: "drizzle",
    name: tr("Cooling Floor Drizzle"),
    description: tr("Slicker, sou'wester, wellies, braids. Level −1 drips; Jade is ready."),
    unlock: FIND,
    look: look({
      top: p("hoodie", "grey"),
      outer: p("raincoat", "yellow"),
      legs: p("jeans", "blue"),
      feet: p("rubber_boots", "yellow"),
      hair: p("hair_braids", "copper"),
      head: p("sou_wester", "yellow"),
      face: null,
      hands: null,
      back: p("backpack", "olive"),
      neck: null,
      belt: null,
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
  {
    id: "gala_night",
    name: tr("Gala Night"),
    description: tr(
      "Black turtleneck, satin skirt, pearls, the updo at its highest. Nobody sent invitations.",
    ),
    unlock: FIND,
    look: look({
      top: p("turtleneck", "black"),
      outer: null,
      legs: p("skirt_gown", "midnight"),
      feet: p("court_shoes", "black"),
      hair: p("hair_updo", "copper"),
      head: null,
      face: null,
      hands: null,
      back: null,
      neck: p("pearl_necklace", "pearl"),
      belt: null,
      wrist: null,
      buddy: null,
    }),
  },
  {
    id: "field_expedition",
    name: tr("Field Expedition"),
    description: tr(
      "Flannel, bomber, headlamp, a pack for three days. The deep floors are a continent.",
    ),
    unlock: FIND,
    look: look({
      top: p("flannel", "red"),
      outer: p("bomber", "olive"),
      legs: p("cargo_dark", "khaki"),
      feet: p("boots_leather", "black"),
      hair: p("hair_braids", "copper"),
      head: p("headlamp", "black"),
      face: null,
      hands: null,
      back: p("backpack", "olive"),
      neck: null,
      belt: p("utility_belt", "brown"),
      wrist: p("wrist_computer", "olive"),
      buddy: null,
    }),
  },
  {
    id: "archivist",
    name: tr("The Archivist"),
    description: tr(
      "Cardigan, plaid, reading glasses, a bun with a pencil. Files first, questions later.",
    ),
    unlock: FIND,
    look: look({
      top: p("sweater_teal", "oat"),
      outer: p("cardigan", "oat"),
      legs: p("skirt_plaid", "green"),
      feet: p("clogs", "white"),
      hair: p("hair_bun", "copper"),
      head: null,
      face: p("round_glasses", "brass"),
      hands: null,
      back: null,
      neck: null,
      belt: null,
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
  // ── Earned by what happens in the lab ──
  {
    id: "studio_session",
    name: tr("Studio Session"),
    description: tr("Headphones, the gig bag, all black. Damien's studio remembers how to sound."),
    unlock: {
      kind: "event",
      when: { flag: "studio_open" },
      hint: tr("Somewhere in the lab a room is waiting for a tune."),
    },
    look: look({
      top: p("turtleneck", "black"),
      outer: null,
      legs: p("jeans", "black"),
      feet: p("sneakers", "white"),
      hair: p("hair_loose", "copper"),
      head: p("headphones", "black"),
      face: null,
      hands: null,
      back: p("gig_bag", "black"),
      neck: null,
      belt: null,
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
  {
    id: "neon_festival",
    name: tr("Neon Festival"),
    description: tr(
      "Glowing mesh, a flower crown, neon everything. Ten bots, one party, zero permits.",
    ),
    unlock: {
      kind: "event",
      when: { counter: "bots_awake", min: 10 },
      hint: tr("Wake every lore bot in the lab — they have plans."),
    },
    look: look({
      top: p("top_neon", "pink"),
      outer: null,
      legs: p("shorts_tights", "green"),
      feet: p("sneakers", "neon"),
      hair: p("hair_ponytail", "magenta"),
      head: p("flower_crown", "neon"),
      face: null,
      hands: null,
      back: null,
      neck: null,
      belt: null,
      wrist: p("glow_bands", "neon"),
      buddy: null,
    }),
  },
  {
    id: "forge_ceremony",
    name: tr("Infinity Forge Ceremony"),
    description: tr(
      "The forge mantle over the black shirt, a crystal at the throat. For the night the Halo answered.",
    ),
    unlock: {
      kind: "event",
      when: { flag: "ending_halo" },
      hint: tr("Something will happen at the Infinity Forge."),
    },
    look: look({
      top: p("shirt_collar_geo", "black"),
      outer: p("forge_mantle", "forge"),
      legs: p("cargo_dark", "dark"),
      feet: p("boots_leather", "black"),
      hair: p("hair_updo", "copper"),
      head: null,
      face: null,
      hands: null,
      back: null,
      neck: p("crystal_pendant", "cyan"),
      belt: null,
      wrist: null,
      buddy: null,
    }),
  },
  {
    id: "hero_of_the_halo",
    name: tr("Hero of the Halo"),
    description: tr("Cape, visor, servo gloves, cerulean hair. Every ending, one outfit."),
    unlock: {
      kind: "event",
      when: {
        all: [
          { flag: "ending_frequenz" },
          { flag: "ending_substrat" },
          { flag: "ending_rueckkehr" },
          { flag: "ending_halo" },
        ],
      },
      hint: tr("See every ending the lab has on record."),
    },
    look: look({
      top: p("turtleneck", "black"),
      outer: null,
      legs: p("shorts_tights", "green"),
      feet: p("mag_boots", "steel"),
      hair: p("hair_updo", "cerulean"),
      head: null,
      face: p("hud_visor", "cyan"),
      hands: p("servo_gloves", "carbon"),
      back: p("cape", "red"),
      neck: null,
      belt: null,
      wrist: null,
      buddy: p("buddy_f1ndr", "grey"),
    }),
  },
  {
    id: "keeper_0089",
    name: tr("Keeper of #0089"),
    description: tr("The circlet, a white cape, silver hair. All thirty slices, home again."),
    unlock: {
      kind: "event",
      when: { counter: "slices", min: 30 },
      hint: tr("Bring every slice of Crystal #0089 home."),
    },
    look: look({
      top: p("turtleneck", "cream"),
      outer: null,
      legs: p("jeans", "black"),
      feet: p("court_shoes", "black"),
      hair: p("hair_updo", "silver"),
      head: p("crystal_tiara", "halo"),
      face: null,
      hands: null,
      back: p("cape", "white"),
      neck: p("crystal_pendant", "violet"),
      belt: null,
      wrist: null,
      buddy: null,
    }),
  },
  {
    id: "crystal_0089",
    name: tr("Crystal #0089"),
    description: tr(
      "Night-black coat, amber visor, cerulean updo. What Jade wore when the crystal spoke.",
    ),
    unlock: {
      kind: "event",
      when: { flag: "ending_kristall" },
      hint: tr("Not every ending is on the record."),
      secret: true,
    },
    look: look({
      top: p("shirt_collar_geo", "black"),
      outer: p("labcoat", "black"),
      legs: p("jeans", "black"),
      feet: p("boots_leather", "black"),
      hair: p("hair_updo", "cerulean"),
      head: null,
      face: p("hud_visor", "amber"),
      hands: null,
      back: null,
      neck: p("crystal_pendant", "rose"),
      belt: null,
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
  {
    id: "for_damien",
    name: tr("For Damien"),
    description: tr(
      "His old white shirt, his tie, her boots. She rolls the sleeves the way he did.",
    ),
    unlock: {
      kind: "event",
      when: { insight: "damien_echo" },
      hint: tr("Listen for an echo in the lab."),
    },
    look: look({
      top: p("shirt_damien", "white"),
      outer: null,
      legs: p("cargo_dark", "dark"),
      feet: p("boots_leather", "brown"),
      hair: p("hair_updo", "copper"),
      head: null,
      face: null,
      hands: null,
      back: null,
      neck: p("tie_loose", "black"),
      belt: p("toolbelt", "leather"),
      wrist: p("watch", "cyan"),
      buddy: null,
    }),
  },
];

export const LOOK_BY_ID: ReadonlyMap<string, SignatureLook> = new Map(
  SIGNATURE_LOOKS.map((l) => [l.id, l]),
);

/** Flag set while Jade wears exactly this look (barks, dialogue). */
export const LOOK_ON_FLAG_PREFIX = "look_on_";

/** Wear this many different looks for the "Signature Collection" achievement. */
export const LOOKS_WORN_GOAL = 10;

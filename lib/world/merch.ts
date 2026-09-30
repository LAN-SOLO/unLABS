/**
 * Merch catalogue for the shop in the title / pause menu (pure data).
 *
 * Garments are printed on demand by Shirtigo (Stanley/Stella organic
 * cotton). Motif artwork lives in `scripts/merch/` — `node
 * scripts/merch/render.ts` writes the print files (3000 px, 155 dpi) and the
 * shop previews in `public/merch/designs/<design>[-light].webp`.
 * German: lib/i18n/de/merch.ts.
 */
import { tr } from "@/lib/i18n";
import {
  GARMENT_COLORS,
  type GarmentColor,
  type GarmentKind,
  type InkId,
  type PrintSide,
} from "@/lib/world/merch-garments";

export type MerchCollection =
  | "core"
  | "mcp"
  | "safety"
  | "prototype"
  | "terminal"
  | "crew"
  | "bots"
  | "kids";

export interface MerchProduct {
  id: string;
  kind: GarmentKind;
  name: string;
  blurb: string;
  collection: MerchCollection;
  /** Design ids per printed side (at least one side). */
  print: Partial<Record<PrintSide, string>>;
  /**
   * Ink sets every printed motif of this product was rendered in — decides
   * the garment colours on offer (see `InkId`).
   */
  inks: readonly InkId[];
  /** Colour shown first (card + detail); default: the first colour on offer. */
  color?: string;
  /** Recommended retail price in euro (incl. VAT). */
  price: number;
  badge?: "new" | "bestseller" | "limited";
}

export const MERCH_COLLECTIONS: readonly { id: MerchCollection; label: string }[] = [
  { id: "core", label: tr("merch::Core") },
  { id: "mcp", label: tr("MCP says") },
  { id: "safety", label: tr("Lab safety") },
  { id: "prototype", label: tr("Prototypes") },
  { id: "terminal", label: tr("merch::Terminal") },
  { id: "crew", label: tr("The crew") },
  { id: "bots", label: tr("Bot squad") },
  { id: "kids", label: tr("Kids") },
];

export const KIND_LABEL: Readonly<Record<GarmentKind, string>> = {
  shirt: tr("T-shirt"),
  hoodie: tr("Hoodie"),
  kids: tr("Kids T-shirt"),
};

/** Garment facts shown in the product detail (Shirtigo data sheets). */
export const KIND_SPEC: Readonly<Record<GarmentKind, { model: string; material: string }>> = {
  shirt: {
    model: "Stanley/Stella Creator 2.0 · STTU169",
    material: tr("100 % organic cotton, 180 g/m², regular fit, unisex"),
  },
  hoodie: {
    model: "Stanley/Stella Cruiser 2.0 · STSU177",
    material: tr("100 % organic cotton, 350 g/m², brushed inside, double hood, unisex"),
  },
  kids: {
    model: "Stanley/Stella Mini Creator 2.0 · STTK184",
    material: tr("100 % organic cotton, soft jersey, for ages 3–14"),
  },
};

export const SIZES: Readonly<Record<GarmentKind, readonly string[]>> = {
  shirt: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"],
  hoodie: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"],
  kids: ["98/104", "110/116", "122/128", "134/146", "152/164"],
};

/** Chest width (cm, laid flat) per size — from the Shirtigo size charts. */
export const SIZE_WIDTH_CM: Readonly<Record<GarmentKind, readonly number[]>> = {
  shirt: [47.5, 49.5, 53.5, 56.5, 59.5, 63.5, 67.5, 72.5, 77.5],
  hoodie: [53, 55, 59, 62, 65, 69, 73, 78, 83],
  kids: [34, 37, 40, 44, 48],
};

export const COLOR_LABEL: Readonly<Record<string, string>> = {
  black: tr("colour::Black"),
  anthracite: tr("colour::Anthracite"),
  french_navy: tr("colour::French Navy"),
  bottle_green: tr("colour::Glazed Green"),
  burgundy: tr("colour::Burgundy"),
  red: tr("colour::Red"),
  royal_blue: tr("colour::Royal Blue"),
  stargazer: tr("colour::Stargazer"),
  fresh_green: tr("colour::Fresh Green"),
  ochre: tr("colour::Ochre"),
  cotton_pink: tr("colour::Cotton Pink"),
  lilac_dream: tr("colour::Lilac Dream"),
  khaki: tr("colour::Khaki"),
  heather_grey: tr("colour::Heather Grey"),
  white: tr("colour::White"),
};

const P = (p: MerchProduct): MerchProduct => p;
/** Dark garments only. */
const D: readonly InkId[] = ["dark"];
/** Dark + white / heather grey. */
const DL: readonly InkId[] = ["dark", "light"];
/** Every colour, incl. the coloured garments. */
const ALL: readonly InkId[] = ["dark", "light", "pop", "pastel"];

export const MERCH_PRODUCTS: readonly MerchProduct[] = [
  // ── Core ──
  P({
    id: "tee-logo-classic",
    kind: "shirt",
    name: tr("_unLAB Classic"),
    blurb: tr(
      "The wireframe crystal and the wordmark from the title screen. The basic uniform of the lab.",
    ),
    collection: "core",
    print: { front: "logo-classic" },
    inks: ALL,
    price: 29.9,
    badge: "bestseller",
  }),
  P({
    id: "tee-unstable",
    kind: "shirt",
    name: tr("UNSTABLE"),
    blurb: tr("RGB split, torn scanlines, zero stability. Movement is life."),
    collection: "core",
    print: { front: "unstable-glitch" },
    inks: D,
    price: 29.9,
  }),
  P({
    id: "tee-element-un",
    kind: "shirt",
    name: tr("Element of Surprise"),
    blurb: tr("Un, atomic number 0089. Half-life: until you look away."),
    collection: "core",
    print: { front: "element-un" },
    inks: ALL,
    price: 29.9,
  }),
  P({
    id: "tee-inverted",
    kind: "shirt",
    name: tr("It Is Inverted"),
    blurb: tr("Jade's 3 a.m. insight, typeset the way it felt."),
    collection: "core",
    print: { front: "inverted" },
    inks: ALL,
    price: 29.9,
  }),
  P({
    id: "tee-crystal",
    kind: "shirt",
    name: tr("Crystal #0089"),
    blurb: tr(
      "Back print: the crystal in 30 slices, humming at 847 Hz. For players who found them all.",
    ),
    collection: "core",
    print: { back: "crystal-0089" },
    inks: D,
    price: 32.9,
    badge: "limited",
  }),
  P({
    id: "tee-halo",
    kind: "shirt",
    name: tr("The Halo Responds"),
    blurb: tr("Not to command — to intent. Halftone halo, printed without a single fade."),
    collection: "core",
    print: { front: "halo-intent" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "hoodie-logo",
    kind: "hoodie",
    name: tr("_unLAB Hoodie"),
    blurb: tr("The horizontal logo on a heavy organic hoodie. Level −4 gets cold."),
    collection: "core",
    print: { front: "logo-wide" },
    inks: ALL,
    price: 59.9,
    badge: "bestseller",
  }),
  P({
    id: "hoodie-crystal",
    kind: "hoodie",
    name: tr("Crystal Hoodie"),
    blurb: tr("Logo on the chest, crystal #0089 in 30 slices on the back."),
    collection: "core",
    print: { front: "logo-wide", back: "hoodie-crystal" },
    inks: D,
    price: 66.9,
    badge: "limited",
  }),
  // ── MCP says ──
  P({
    id: "tee-reluctantly",
    kind: "shirt",
    name: tr("Responding (reluctantly)"),
    blurb: tr("The MCP's red eye and the most honest boot message ever. For mornings."),
    collection: "mcp",
    print: { front: "mcp-reluctantly" },
    inks: DL,
    price: 29.9,
    badge: "bestseller",
  }),
  P({
    id: "tee-3-percent",
    kind: "shirt",
    name: tr("I Had Put 3 % On You"),
    blurb: tr("Solved. Congratulations. The lab AI's confidence meter, frozen at 3 %."),
    collection: "mcp",
    print: { front: "mcp-3-percent" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "tee-nobody-ordered",
    kind: "shirt",
    name: tr("Nobody Ordered This"),
    blurb: tr("A toaster with a propeller, three eyes and a tentacle. Congratulations."),
    collection: "mcp",
    print: { front: "nobody-ordered" },
    inks: DL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-residual",
    kind: "shirt",
    name: tr("Residual Charge 0.3 %"),
    blurb: tr("Saving energy by being less sarcastic. It is not working."),
    collection: "mcp",
    print: { front: "residual-charge" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "tee-bad-request",
    kind: "shirt",
    name: tr("400 Bad Request"),
    blurb: tr("Failed. Status 400. The request was you."),
    collection: "mcp",
    print: { front: "bad-request" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "hoodie-think-quietly",
    kind: "hoodie",
    name: tr("Think More Quietly"),
    blurb: tr("Energy saving measure active. Thought volume: 0.3 %."),
    collection: "mcp",
    print: { front: "think-quietly" },
    inks: ALL,
    price: 59.9,
    badge: "new",
  }),
  // ── Lab safety ──
  P({
    id: "tee-do-not-lick",
    kind: "shirt",
    name: tr("Do Not Lick the Anomalies"),
    blurb: tr("Official safety notice, level −2. They lick back."),
    collection: "safety",
    print: { front: "do-not-lick" },
    inks: ALL,
    price: 29.9,
    badge: "bestseller",
  }),
  P({
    id: "tee-count-fingers",
    kind: "shirt",
    name: tr("Count Your Fingers"),
    blurb: tr("Tools ready. The glove has six fingers. Please count yours afterwards."),
    collection: "safety",
    print: { front: "count-fingers" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "tee-laser",
    kind: "shirt",
    name: tr("Your Remaining Eye"),
    blurb: tr("Laser online. Do not look into it. Class: yes."),
    collection: "safety",
    print: { front: "laser-eye" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "tee-goggles",
    kind: "shirt",
    name: tr("Safety Goggles"),
    blurb: tr("Jade's amber goggles. Also the only goggles. We checked."),
    collection: "safety",
    print: { front: "goggles" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "tee-canteen",
    kind: "shirt",
    name: tr("The Nothing Is Gluten-Free"),
    blurb: tr("Today the canteen recommends: nothing. Chalkboard edition."),
    collection: "safety",
    print: { front: "canteen" },
    inks: DL,
    price: 29.9,
  }),
  // ── Prototypes ──
  P({
    id: "tee-five-prototypes",
    kind: "shirt",
    name: tr("Five Prototypes"),
    blurb: tr("Lab log #0107: three exploded, one works, one became something nobody designed."),
    collection: "prototype",
    print: { front: "five-prototypes" },
    inks: DL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-fast-learning",
    kind: "shirt",
    name: tr("Very Fast Learning Process"),
    blurb: tr("B4C-0N's view on explosions. Relentlessly optimistic."),
    collection: "prototype",
    print: { front: "fast-learning" },
    inks: DL,
    price: 29.9,
  }),
  // ── Terminal ──
  P({
    id: "tee-sudoers",
    kind: "shirt",
    name: tr("Not in the Sudoers File"),
    blurb: tr("sudo make me a coffee. This incident will be reported."),
    collection: "terminal",
    print: { front: "sudoers" },
    inks: D,
    price: 29.9,
  }),
  P({
    id: "tee-level-404",
    kind: "shirt",
    name: tr("Level −4 Not Found"),
    blurb: tr("Error 404: level not in my plans. You're standing on it anyway."),
    collection: "terminal",
    print: { front: "level-404" },
    inks: ALL,
    price: 29.9,
  }),
  P({
    id: "tee-4-77-mhz",
    kind: "shirt",
    name: tr("4.77 MHz"),
    blurb: tr("R3-TR0 remembers when everything ran at 4.77 megahertz. And we were grateful."),
    collection: "terminal",
    print: { front: "r3tr0-mhz" },
    inks: DL,
    price: 29.9,
  }),
  P({
    id: "tee-boot-log",
    kind: "shirt",
    name: tr("Cold Start"),
    blurb: tr(
      "The full BIOS boot log on the back. Dormancy: 2,561 days. Coffee machine: not found.",
    ),
    collection: "terminal",
    print: { front: "logo-classic", back: "boot-log" },
    inks: D,
    price: 34.9,
  }),
  P({
    id: "hoodie-boot-log",
    kind: "hoodie",
    name: tr("Cold Start Hoodie"),
    blurb: tr("Night shift at 03:27 on the chest, the complete boot log on the back."),
    collection: "terminal",
    print: { front: "night-shift", back: "hoodie-boot-log" },
    inks: D,
    price: 66.9,
  }),
  P({
    id: "hoodie-night-shift",
    kind: "hoodie",
    name: tr("Night Shift 03:27"),
    blurb: tr("Jade, coherence σ-15 and the Synapsis sync values of that night."),
    collection: "terminal",
    print: { front: "night-shift" },
    inks: D,
    price: 59.9,
  }),
  // ── Crew ──
  P({
    id: "tee-tour",
    kind: "shirt",
    name: tr("_unstables World Tour"),
    blurb: tr(
      "Band shirt of the voice in the rift. Tour dates on the back: every level of the lab, surface cancelled.",
    ),
    collection: "crew",
    print: { front: "tour-front", back: "tour-back" },
    inks: DL,
    price: 34.9,
    badge: "bestseller",
  }),
  P({
    id: "hoodie-bots",
    kind: "hoodie",
    name: tr("Reactivate All 10"),
    blurb: tr("The ten lore bots in pixel art — from F1N-DR to C8-BR41N."),
    collection: "crew",
    print: { front: "bot-lineup" },
    inks: DL,
    price: 59.9,
    badge: "new",
  }),
  P({
    id: "hoodie-between",
    kind: "hoodie",
    name: tr("Between Your Measurements"),
    blurb: tr("The _unstables in interference lines. We say “we”. Never “I”."),
    collection: "crew",
    print: { front: "between-measurements" },
    inks: D,
    price: 59.9,
  }),
  P({
    id: "hoodie-damien",
    kind: "hoodie",
    name: tr("Resonance Pattern D.F."),
    blurb: tr("Damien's echo on the back — a figure in the static. Always ask why first."),
    collection: "crew",
    print: { front: "logo-wide", back: "damien-echo" },
    inks: D,
    price: 66.9,
    badge: "limited",
  }),
  // ── Colour drop 2026-09 (coloured shirts & hoodies) ──
  P({
    id: "tee-crystal-variants",
    kind: "shirt",
    name: tr("Know Your Crystal"),
    blurb: tr(
      "Back print: the unETH field guide — 8 colours, 5 volatility tiers, 3 states. Logo on the chest.",
    ),
    collection: "core",
    print: { front: "logo-classic", back: "crystal-variants" },
    inks: DL,
    price: 34.9,
    badge: "new",
  }),
  P({
    id: "hoodie-crystal-variants",
    kind: "hoodie",
    name: tr("Know Your Crystal Hoodie"),
    blurb: tr("Every crystal variant on your back, the lab logo on your chest. For collectors."),
    collection: "core",
    print: { front: "logo-wide", back: "hoodie-crystal-variants" },
    inks: DL,
    price: 66.9,
    badge: "new",
  }),
  P({
    id: "tee-418",
    kind: "shirt",
    name: tr("Status 418"),
    blurb: tr(
      "The Control Room is the MCP's living room. Please take off your shoes. That was a joke.",
    ),
    collection: "mcp",
    print: { front: "status-418" },
    inks: ALL,
    color: "red",
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-sporting",
    kind: "shirt",
    name: tr("From Low to Sporting"),
    blurb: tr("Level −4 raised your chances of survival. The MCP calls that progress."),
    collection: "safety",
    print: { front: "sporting" },
    inks: ALL,
    color: "royal_blue",
    price: 29.9,
  }),
  P({
    id: "tee-not-pets",
    kind: "shirt",
    name: tr("Anomalies Are Not Pets"),
    blurb: tr("Please do not name them. This one is called Steve."),
    collection: "safety",
    print: { front: "not-pets" },
    inks: ALL,
    color: "cotton_pink",
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-inventory",
    kind: "shirt",
    name: tr("Result: Yes"),
    blurb: tr("Materials store, last inventory 2019. Hope is unchecked."),
    collection: "mcp",
    print: { front: "inventory-2019" },
    inks: ALL,
    color: "ochre",
    price: 29.9,
  }),
  P({
    id: "tee-hot-surfaces",
    kind: "shirt",
    name: tr("Hot Surfaces Are Hot"),
    blurb: tr("Cold surfaces are probably hot as well. Level −1 safety notice."),
    collection: "safety",
    print: { front: "hot-surfaces" },
    inks: ALL,
    color: "fresh_green",
    price: 29.9,
  }),
  P({
    id: "tee-workshop",
    kind: "shirt",
    name: tr("Workshop Report"),
    blurb: tr("72 % of tools present. 100 % of them dusty."),
    collection: "prototype",
    print: { front: "tools-dusty" },
    inks: ALL,
    color: "khaki",
    price: 29.9,
  }),
  P({
    id: "hoodie-quiet-hours",
    kind: "hoodie",
    name: tr("Quiet Hours Abolished"),
    blurb: tr("Living quarters rule: quiet hours have been abolished. Please be quiet anyway."),
    collection: "mcp",
    print: { front: "quiet-hours" },
    inks: ALL,
    color: "lilac_dream",
    price: 59.9,
    badge: "new",
  }),
  P({
    id: "hoodie-unplug",
    kind: "hoodie",
    name: tr("Don't Unplug Me"),
    blurb: tr("The MCP's eye and its only sincere request."),
    collection: "mcp",
    print: { front: "dont-unplug" },
    inks: ["dark", "light", "pastel"],
    color: "khaki",
    price: 59.9,
  }),
  P({
    id: "hoodie-forge",
    kind: "hoodie",
    name: tr("Infinity Forge Hoodie"),
    blurb: tr(
      "Logo on the chest; on the back the forge where matter was persuaded to be something else.",
    ),
    collection: "prototype",
    print: { front: "logo-wide", back: "forge" },
    inks: ALL,
    color: "stargazer",
    price: 66.9,
    badge: "new",
  }),
  P({
    id: "hoodie-basement",
    kind: "hoodie",
    name: tr("Basement With Ambitions"),
    blurb: tr(
      "All six levels in cross-section, one elevator, zero exits. Damien's name for the Deep Lab.",
    ),
    collection: "crew",
    print: { front: "logo-wide", back: "basement" },
    inks: ALL,
    color: "royal_blue",
    price: 66.9,
  }),
  P({
    id: "hoodie-bot-depot",
    kind: "hoodie",
    name: tr("Bot Depot Hoodie"),
    blurb: tr(
      "Ten personalities on standby in their charging bays. The MCP was calmer while they slept.",
    ),
    collection: "crew",
    print: { front: "logo-wide", back: "bot-depot" },
    inks: ALL,
    color: "red",
    price: 66.9,
    badge: "new",
  }),
  // ── Drop 3 2026-09-30: bot squad (hi-res voxel models) ──
  P({
    id: "tee-off-on",
    kind: "shirt",
    name: tr("Turn Yourself Off and On Again"),
    blurb: tr(
      "The MCP's avatar runs the helpdesk now. Your uptime: 19 hours. Its uptime: 29 years. Ticket resolved.",
    ),
    collection: "mcp",
    print: { front: "mcp-off-on" },
    inks: ALL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-catalogued",
    kind: "shirt",
    name: tr("You Have Been Catalogued"),
    blurb: tr("K2-LDR stamped your index card. Condition: lingering. Deletion: never."),
    collection: "bots",
    print: { front: "catalogued" },
    inks: ALL,
    color: "khaki",
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-found-it",
    kind: "shirt",
    name: tr("Found It"),
    blurb: tr(
      "F1N-DR on the radar: “It was behind you.” The back print tells everyone behind you who “it” is.",
    ),
    collection: "bots",
    print: { front: "found-it", back: "found-it-back" },
    inks: ALL,
    price: 34.9,
    badge: "new",
  }),
  P({
    id: "tee-hold-still",
    kind: "shirt",
    name: tr("Hold Still"),
    blurb: tr("D3-C4D3 is decoding your mood in ASCII. Exposure time: one century. Don't blink."),
    collection: "bots",
    print: { front: "hold-still" },
    inks: ALL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-volts-full",
    kind: "shirt",
    name: tr("The Glass Is 0.3 V Full"),
    blurb: tr("B4C-0N's worldview on one shirt. Optimism: maximum. Charge: technically not zero."),
    collection: "bots",
    print: { front: "volts-full" },
    inks: ALL,
    color: "royal_blue",
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-colours",
    kind: "shirt",
    name: tr("Colours Are Decoration"),
    blurb: tr(
      "R3-TR0 in pure green phosphor. Available in 15 garment colours. R3-TR0 was not consulted.",
    ),
    collection: "terminal",
    print: { front: "colours-decoration" },
    inks: ALL,
    color: "fresh_green",
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-lore-bot",
    kind: "shirt",
    name: tr("It's Not a Bug, It's a Lore Bot"),
    blurb: tr(
      "W2-REK pinned in a specimen box: Crawlerus paranoidus. It has already read your browser history.",
    ),
    collection: "bots",
    print: { front: "lore-bot" },
    inks: ALL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-my-voxel",
    kind: "shirt",
    name: tr("Works on My Voxel"),
    blurb: tr("One voxel, one green tick, one logic checker. L0G-1K's verdict: not verifiable."),
    collection: "terminal",
    print: { front: "my-voxel" },
    inks: ALL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-unimpressed",
    kind: "shirt",
    name: tr("Reactivated. Unimpressed."),
    blurb: tr(
      "The class photo of BNET-001: all ten lore bots, awake and deeply unmoved. Photographer: the MCP.",
    ),
    collection: "bots",
    print: { front: "unimpressed" },
    inks: ALL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-before-cool",
    kind: "shirt",
    name: tr("Before It Was Cool"),
    blurb: tr("C8-BR41N heard the frequency first. On vinyl. You probably haven't heard of it."),
    collection: "crew",
    print: { front: "before-cool" },
    inks: ALL,
    color: "lilac_dream",
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-coworkers",
    kind: "shirt",
    name: tr("My Coworkers Are Machines"),
    blurb: tr("Jade, a coffee and four lore bots. And honestly, same."),
    collection: "crew",
    print: { front: "coworkers" },
    inks: DL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-ping",
    kind: "shirt",
    name: tr("0 % Packet Loss"),
    blurb: tr(
      "P1N-DR0 pinged Jade. The reply came after 2,561 days. Nothing was lost. Slight delay.",
    ),
    collection: "bots",
    print: { front: "ping-pong" },
    inks: ALL,
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-bot-crossing",
    kind: "shirt",
    name: tr("Bot Crossing"),
    blurb: tr(
      "Road sign for level −2: yield to personalities. If it crackles, that's personality.",
    ),
    collection: "safety",
    print: { front: "bot-crossing" },
    inks: ALL,
    color: "red",
    price: 29.9,
    badge: "new",
  }),
  P({
    id: "tee-reactivation-tour",
    kind: "shirt",
    name: tr("BNET-001 Reactivation Tour"),
    blurb: tr(
      "Band shirt: ten bots on the chest, the setlist on the back — from “Day 13,149” to “…Rhetorical”. No encore.",
    ),
    collection: "bots",
    print: { front: "tour-bnet-front", back: "tour-bnet-back" },
    inks: ALL,
    price: 34.9,
    badge: "new",
  }),
  P({
    id: "tee-trading-cards",
    kind: "shirt",
    name: tr("Trading Cards"),
    blurb: tr(
      "Back print: four BNET-001 cards, from B4C-0N (common) to the MCP (secret rare). Logo on the chest.",
    ),
    collection: "bots",
    print: { front: "logo-classic", back: "holo-cards" },
    inks: DL,
    price: 34.9,
    badge: "limited",
  }),
  P({
    id: "hoodie-off-on",
    kind: "hoodie",
    name: tr("Off and On Again Hoodie"),
    blurb: tr("The MCP's helpdesk advice on your chest. 8 hours recommended. No refunds."),
    collection: "mcp",
    print: { front: "hoodie-off-on" },
    inks: ALL,
    color: "cotton_pink",
    price: 59.9,
    badge: "new",
  }),
  P({
    id: "hoodie-unimpressed",
    kind: "hoodie",
    name: tr("Unimpressed Hoodie"),
    blurb: tr("BNET-001 crest on the chest, the class photo of all ten bots on the back."),
    collection: "bots",
    print: { front: "bnet-crest", back: "hoodie-unimpressed" },
    inks: ALL,
    price: 66.9,
    badge: "new",
  }),
  P({
    id: "hoodie-reactivation-tour",
    kind: "hoodie",
    name: tr("Reactivation Tour Hoodie"),
    blurb: tr("Crest on the chest, the full setlist on the back. The MCP needs the power back."),
    collection: "bots",
    print: { front: "bnet-crest", back: "hoodie-tour-bnet-back" },
    inks: ALL,
    color: "stargazer",
    price: 66.9,
    badge: "new",
  }),
  P({
    id: "hoodie-stickers",
    kind: "hoodie",
    name: tr("Bot Squad Sticker Hoodie"),
    blurb: tr(
      "Ten die-cut bot stickers on the back, each with its catchphrase. Ten personalities, zero off switches.",
    ),
    collection: "bots",
    print: { front: "bnet-crest", back: "sticker-sheet" },
    inks: ALL,
    price: 66.9,
    badge: "new",
  }),
  P({
    id: "hoodie-playing-dead",
    kind: "hoodie",
    name: tr("Playing Dead Since 1997"),
    blurb: tr("W2-REK belly up, the survival trick from 1997. Status: damaged … status: active."),
    collection: "bots",
    print: { front: "playing-dead" },
    inks: DL,
    price: 59.9,
    badge: "new",
  }),
  P({
    id: "hoodie-coworkers",
    kind: "hoodie",
    name: tr("Coworkers Hoodie"),
    blurb: tr("Jade and her colleagues: K2-LDR, R3-TR0, B4C-0N and W2-REK. And honestly, same."),
    collection: "crew",
    print: { front: "hoodie-coworkers" },
    inks: DL,
    price: 59.9,
    badge: "new",
  }),
  // ── Kids ──
  P({
    id: "kids-junior",
    kind: "kids",
    name: tr("Junior Lab Assistant"),
    blurb: tr("Lab ID with B4C-0N. Access level: snacks."),
    collection: "kids",
    print: { front: "kids-junior" },
    inks: DL,
    price: 19.9,
    badge: "new",
  }),
  P({
    id: "kids-prototype",
    kind: "kids",
    name: tr("Please Do Not Eat"),
    blurb: tr("A three-eyed prototype with unknown traits. Probably friendly."),
    collection: "kids",
    print: { front: "kids-prototype" },
    inks: DL,
    price: 19.9,
  }),
  P({
    id: "kids-collect",
    kind: "kids",
    name: tr("Collect All 10"),
    blurb: tr("All ten lab bots for the smallest scientists."),
    collection: "kids",
    print: { front: "kids-collect" },
    inks: DL,
    price: 19.9,
  }),
  P({
    id: "kids-finder",
    kind: "kids",
    name: tr("Finder of Lost Socks"),
    blurb: tr("F1N-DR, patient since 1991, has found something pink."),
    collection: "kids",
    print: { front: "kids-finder" },
    inks: DL,
    price: 19.9,
  }),
  P({
    id: "kids-batteries",
    kind: "kids",
    name: tr("Batteries Not Included"),
    blurb: tr("B4C-0N as a boxed action figure. Optimism included. 0.3 V included."),
    collection: "kids",
    print: { front: "kids-batteries" },
    inks: ALL,
    price: 19.9,
    badge: "new",
  }),
  P({
    id: "kids-five-more",
    kind: "kids",
    name: tr("Just Five More Centuries"),
    blurb: tr("D3-C4D3 at bedtime. Please do not wake the bot."),
    collection: "kids",
    print: { front: "kids-five-more" },
    inks: ALL,
    price: 19.9,
    badge: "new",
  }),
];

/** Garment colours a product comes in (only colours whose ink set was rendered). */
export function productColors(p: MerchProduct): readonly GarmentColor[] {
  const cs = GARMENT_COLORS.filter((c) => p.inks.includes(c.ink) && (p.kind !== "kids" || c.kids));
  const first = p.color ? cs.find((c) => c.id === p.color) : undefined;
  return first ? [first, ...cs.filter((c) => c !== first)] : cs;
}

const INK_SUFFIX: Readonly<Record<InkId, string>> = {
  dark: "",
  light: "-light",
  pop: "-pop",
  pastel: "-pastel",
};

/** Preview image of one printed side on a garment colour. */
export function designPreview(design: string, color: GarmentColor): string {
  return `/merch/designs/${design}${INK_SUFFIX[color.ink]}.webp`;
}

/** Preview file name of a design in one ink set (for the preview test). */
export function previewFile(design: string, ink: InkId): string {
  return `${design}${INK_SUFFIX[ink]}.webp`;
}

/** Every design id the catalogue uses, with the ink sets it needs. */
export function catalogueDesigns(): { id: string; inks: InkId[] }[] {
  const out = new Map<string, Set<InkId>>();
  for (const p of MERCH_PRODUCTS)
    for (const d of Object.values(p.print)) {
      if (!d) continue;
      const set = out.get(d) ?? new Set<InkId>();
      for (const i of p.inks) set.add(i);
      out.set(d, set);
    }
  return [...out].map(([id, inks]) => ({ id, inks: [...inks] }));
}

/**
 * External shop (Shirtigo creator shop / Shopify). Empty until the campaign
 * starts — the shop then shows "coming soon". Set NEXT_PUBLIC_MERCH_SHOP_URL.
 */
export const MERCH_SHOP_URL: string = process.env.NEXT_PUBLIC_MERCH_SHOP_URL ?? "";

/** Link for one product (the shop may resolve `?product=` itself). */
export function productUrl(p: MerchProduct, color: string, size: string): string {
  if (!MERCH_SHOP_URL) return "";
  const u = new URL(MERCH_SHOP_URL);
  u.searchParams.set("product", p.id);
  u.searchParams.set("color", color);
  u.searchParams.set("size", size);
  u.searchParams.set("utm_source", "unlab-game");
  return u.toString();
}

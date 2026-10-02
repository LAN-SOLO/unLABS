/**
 * Decor actions — small interactive moments with the lab's furniture.
 * ====================================================================
 *
 * "everything in the lab reacts": coffee machines brew, radios crackle, the
 * chess game from 2019 is still waiting for a move. Every entry is keyed by
 * a decor id (see `models/decor*.ts`) and optionally a room id for unique
 * pieces (room-specific entries win over generic ones).
 *
 * Outcomes are picked by `lib/world/decor-actions.ts`:
 *  1. only outcomes whose `when` holds, that are not spent (`once`) and not
 *     cooling down are eligible;
 *  2. the first eligible `once` outcome wins (story beats first);
 *  3. otherwise the eligible repeatable outcomes rotate deterministically
 *     by the action's use count;
 *  4. nothing eligible → the action's `idle` line (no effects).
 *
 * Effects only reference existing item / insight ids (validated by
 * `tests/world/decor-actions.test.ts`); flags are free-form with the
 * `decor_` prefix, counters with `decor_`.
 */
import { tr } from "@/lib/i18n";
import type { Condition, DialogueLine } from "@/lib/world/types";

// Verb ids (German, stored/compared in code); labels live in the UI.
export type DecorVerb =
  | "benutzen"
  | "lesen"
  | "hören" // i18n-ignore
  | "ansehen"
  | "sitzen"
  | "liegen"
  | "trinken";

export type BuffKind = "walk_speed" | "hint_boost" | "respawn_boost";

export interface DecorBuff {
  id: string;
  label: string;
  seconds: number;
  kind: BuffKind;
  /** Multiplier while active (defaults per kind, see `BUFF_DEFAULT_FACTOR`). */
  factor?: number;
}

export interface DecorEffects {
  flags?: string[];
  /** Counter increments (`bump`). */
  counters?: Record<string, number>;
  items?: { item: string; count: number }[];
  insights?: string[];
  buff?: DecorBuff;
  /** Care for the room (lib/world/aging.ts): "water" its plants. */
  care?: "water";
}

export interface DecorOutcome {
  when?: Condition;
  /** 1–4 sentences, wrapped in `tr()` (German in lib/i18n/de/decor.ts). */
  text: string;
  /** Speaker of a spoken line (the text is then what they say). */
  who?: DialogueLine["who"];
  effects?: DecorEffects;
  /** Seconds (play clock) before this outcome is eligible again. */
  cooldown?: number;
  /** Only ever happens once per save. */
  once?: boolean;
}

export interface DecorActionDef {
  /** Unique id: the decor id, or `decor@room` for room-specific pieces. */
  id: string;
  decor: string;
  room?: string;
  /** Focus label. */
  label: string;
  verb: DecorVerb;
  requires?: Condition;
  requiresHint?: string;
  /** Shown when no outcome is eligible (everything cooling down). */
  idle?: string;
  /** Overgrowth Jade can harvest here (lib/world/aging.ts); runs before the outcomes when ripe. */
  harvest?: "algae";
  outcomes: DecorOutcome[];
}

/** Default multipliers per buff kind. */
export const BUFF_DEFAULT_FACTOR: Record<BuffKind, number> = {
  walk_speed: 1.25,
  hint_boost: 2,
  /** Respawn timers are multiplied by this (smaller = faster regrowth). */
  respawn_boost: 0.5,
};

/**
 * Map props (`content/map.ts`) with a `variant` reuse an interior decor
 * model — and, through this table, that decor piece's action. The renderer
 * uses the same table for the model (`render/engine.ts`).
 */
export const PROP_VARIANT_DECOR: Readonly<Record<string, string>> = {
  // Surveillance station (docs/OPS.md); opens the operations panel.
  surveillance: "surveillance_station",
  antenna: "antenna_mast",
  bed: "bunk_bed",
  bookshelf: "bookshelf",
  clock: "wall_clock",
  coffee: "coffee_machine",
  cryo_capsule: "cryo_tank",
  crystal_wall: "crystal_cluster",
  // Biorhythm stations (lib/world/biorhythm.ts; interaction opens the bio station panel).
  ergometer: "ergometer",
  food_replicator: "food_replicator",
  jade_bed: "jade_bed",
  // Jade's personal computer (content/quarters.ts); opens her PC overlay.
  jade_pc: "jade_workstation",
  mixing_console: "mixing_console",
  neutro_fridge: "neutro_fridge",
  map_table: "holo_table",
  radio: "radio",
  relay: "diagnostic_rack",
  table: "lab_table",
  telescope: "telescope",
  // Jade's wardrobe replicator (content/wardrobe.ts); opens the character menu.
  wardrobe_replicator: "wardrobe_replicator",
};

/**
 * Variants whose decor action also runs on `kind: "station"` props (after
 * the station's own `requires` / `grants`). Other stations keep their story
 * beat only — the generic decor lines would talk over it. `kind: "decor"`
 * props always use their variant's action.
 */
export const STATION_VARIANT_ACTIONS: ReadonlySet<string> = new Set(["coffee"]);

// ── Shared conditions & buffs ────────────────────────────────────

const POWER: Condition = { power: 50 };
const NO_POWER: Condition = { not: POWER };
const online = (device: string): Condition => ({ device });
const offline = (device: string): Condition => ({ not: { device } });
const awake = (bot: string): Condition => ({ flag: `bot_${bot}_awake` });
const knows = (insight: string): Condition => ({ insight });

const KOFFEIN: DecorBuff = {
  id: "koffein",
  label: tr("Caffeine"),
  seconds: 90,
  kind: "walk_speed",
};
const DURCHATMEN: DecorBuff = {
  id: "durchatmen",
  label: tr("Breathed out"),
  seconds: 120,
  kind: "hint_boost",
};
const KLARER_KOPF: DecorBuff = {
  id: "klarer_kopf",
  label: tr("Clear head"),
  seconds: 150,
  kind: "hint_boost",
};
const WACHSTUM: DecorBuff = {
  id: "wachstum",
  label: tr("Growth spurt"),
  seconds: 180,
  kind: "respawn_boost",
};
const KALTES_WASSER: DecorBuff = {
  id: "kaltes_wasser",
  label: tr("Refreshed"),
  seconds: 45,
  kind: "walk_speed",
  factor: 1.1,
};

const FRISCHER_KITTEL: DecorBuff = {
  id: "frischer_kittel",
  label: tr("Fresh lab coat"),
  seconds: 90,
  kind: "walk_speed",
  factor: 1.1,
};
const STUDIERT: DecorBuff = {
  id: "studiert",
  label: tr("Well-read"),
  seconds: 180,
  kind: "hint_boost",
};

/** Same interaction for several decor ids (ids become `decor`). */
function each(
  decors: readonly string[],
  build: (decor: string) => Omit<DecorActionDef, "id" | "decor">,
): DecorActionDef[] {
  return decors.map((decor) => ({ id: decor, decor, ...build(decor) }));
}

/** Books: rotating titles, one per use. */
function shelf(titles: readonly string[]): DecorOutcome[] {
  return titles.map((text) => ({ text }));
}

export const DECOR_ACTIONS: readonly DecorActionDef[] = [
  // ── Kaffee ─────────────────────────────────────────────────────
  {
    id: "coffee_machine",
    decor: "coffee_machine",
    label: tr("Coffee machine"),
    verb: "trinken",
    idle: tr("The machine is still gurgling. Patience is a technique too."),
    outcomes: [
      {
        when: NO_POWER,
        text: tr(
          "The coffee machine is cold. A note in Damien’s handwriting is taped to the display: “No power, no coffee. No coffee, no power. Good luck.”",
        ),
      },
      {
        when: POWER,
        once: true,
        text: tr(
          "Twice with the heel of the hand, on the left, about 15 cm below the coin slot. Not three times. The machine coughs, then a cup runs through that smells of ozone and 2019.",
        ),
        effects: {
          items: [{ item: "kaffee", count: 1 }],
          insights: ["kaffee_technik"],
          buff: KOFFEIN,
          flags: ["decor_kaffee_erster"],
        },
        cooldown: 240,
      },
      {
        when: POWER,
        text: tr("Two knocks, one cup. The hands still know it before the head thinks of it."),
        effects: { items: [{ item: "kaffee", count: 1 }], buff: KOFFEIN },
        cooldown: 240,
      },
      {
        when: { all: [POWER, { counter: "decor_uses:coffee_machine", min: 5 }] },
        who: "mcp",
        text: tr("Fifth cup. I am not logging this. I am merely mentioning it."),
        effects: { buff: KOFFEIN },
        cooldown: 240,
      },
    ],
  },
  ...each(["mug_cold", "coffee_mug"], () => ({
    label: tr("Coffee mug"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr("Cold coffee with a skin 2,561 days thick. A lipstick mark on the rim. Mine."),
      },
      {
        text: tr("The mug says “WORLD'S OKAYEST PHYSICIST”. Damien gave it to me in 1996."),
      },
      { text: tr("Something is growing in it. The greenhouse would be proud.") },
    ],
  })),
  {
    id: "mug_table",
    decor: "mug_table",
    label: tr("Side table"),
    verb: "ansehen",
    outcomes: [
      { text: tr("Two mug rings, close together. We always sat here as a pair.") },
      {
        text: tr(
          "A piece of gum is stuck under the table, with a date: 03.11.1988. The day X0-R8T went online.",
        ),
      },
    ],
  },
  {
    id: "coffee_shrub",
    decor: "coffee_shrub",
    label: tr("Coffee shrub"),
    verb: "benutzen",
    idle: tr("The remaining cherries are still green."),
    outcomes: [
      {
        text: tr(
          "The coffee shrub is bearing fruit as if nobody had ever forgotten it. I pick a handful of cherries — harvest 2019, second helping 2026.",
        ),
        effects: { items: [{ item: "kaffeebohnen", count: 1 }] },
        cooldown: 600,
      },
      {
        when: knows("prototypen"),
        once: true,
        text: tr(
          "A note is stuck to the shrub: “Needs light. Glow algae? And a sip of its own coffee — back to the roots.” — D.",
        ),
      },
    ],
  },
  {
    id: "water_cooler",
    decor: "water_cooler",
    label: tr("Water cooler"),
    verb: "trinken",
    idle: tr("The bubble in the tank is still rising."),
    outcomes: [
      {
        text: tr(
          "The water is ice-cold and tastes of depth. An air bubble rises in the tank, slowly, like a question.",
        ),
        effects: { buff: KALTES_WASSER },
        cooldown: 120,
      },
    ],
  },

  // ── Radio & Klang ──────────────────────────────────────────────
  ...each(["receiver_stack", "radio"], () => ({
    label: tr("Receiver"),
    verb: "hören", // i18n-ignore — verb id, not text
    idle: tr("I leave the dial where it is. The static needs breaks."),
    outcomes: [
      {
        when: NO_POWER,
        text: tr("The dial stays dark. Without power, a receiver is just a very honest box."),
      },
      {
        when: POWER,
        text: tr(
          "White noise on every band. If you listen long enough, it has a rhythm — three short, two long.",
        ),
      },
      {
        when: POWER,
        once: true,
        text: tr(
          "At 8.47 MHz: a carrier, then bits as tones. “X0-R8T ONLINE. RECORDS. DOES NOT RESPOND.” — 03.11.1988, 23:58. The broadcast is 38 years old and is arriving right now anyway.",
        ),
        effects: { flags: ["decor_radio_1988"] },
      },
      {
        when: { all: [POWER, awake("x0r8t")] },
        who: "x0r8t",
        text: tr("01000110 · FREQUENCY SHARED · OPERATOR LISTENING IN. PACKET 848 IN PREPARATION."),
      },
      {
        when: { all: [POWER, online("ECR-001")] },
        who: "damien",
        text: tr("… don’t turn the dial, Jade. Listen to what lies between the stations …"),
        effects: { flags: ["decor_radio_damien"] },
        cooldown: 180,
      },
    ],
  })),
  {
    id: "tape_machine",
    decor: "tape_machine",
    label: tr("Tape machine"),
    verb: "hören", // i18n-ignore — verb id, not text
    idle: tr("The tape is still rewinding."),
    outcomes: [
      {
        when: NO_POWER,
        text: tr("The reels don’t turn. On the label: “#0511 — DO NOT RECORD OVER”."),
      },
      {
        when: { all: [POWER, offline("SPK-001")] },
        text: tr(
          "The reels are running, but the speaker stays silent. Only the level needle twitches — in the rhythm of a voice.",
        ),
        cooldown: 30,
      },
      {
        when: online("SPK-001"),
        once: true,
        who: "damien",
        text: tr(
          "Log #0511. The anomaly answers questions faster than it answers measurements. I don’t know whether that is physics or politeness.",
        ),
        effects: { flags: ["decor_band_0511"] },
      },
      {
        when: online("SPK-001"),
        who: "damien",
        text: tr(
          "… and if you hear this, Jade: the tape works just as well backwards. I tried it. It says the same thing.",
        ),
        cooldown: 60,
      },
    ],
  },
  ...each(["speaker_stack", "speaker_wall"], () => ({
    label: tr("Speakers"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      {
        when: offline("SPK-001"),
        text: tr(
          "The membranes are still, but when I lay my hand on them, they tremble. Something is playing, just not for ears.",
        ),
      },
      {
        when: online("SPK-001"),
        text: tr(
          "A deep tone, just below the threshold of hearing. The coffee mugs on the shelf rattle in time.",
        ),
      },
      {
        when: online("HMS-001"),
        text: tr(
          "The synthesizer plays four notes into the speakers, over and over. Someone set it to loop. It wasn’t me.",
        ),
      },
    ],
  })),
  {
    id: "synth",
    decor: "synth",
    label: tr("Synthesizer"),
    verb: "benutzen",
    outcomes: [
      {
        when: knows("vier_toene"),
        text: tr(
          "Three — six — four — eight. The last note hangs in the room longer than it should.",
        ),
      },
      { text: tr("A chord, crooked. Damien re-soldered the keys. Of course he did.") },
      {
        when: online("HMS-001"),
        text: tr(
          "A xenon tube starts glowing under the console. On the display: [H4-XN1 · XENON-TEMP: 42.7 °C]. The sound gets audibly warmer.",
        ),
      },
    ],
  },
  {
    id: "vinyl_crate",
    decor: "vinyl_crate",
    label: tr("Record crate"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      {
        text: tr(
          "Coltrane, “A Love Supreme”. Damien put it on for every calibration run. “For the instruments,” he said.",
        ),
      },
      {
        text: tr("Kraftwerk, “Computer World”, 1981. On the sleeve he wrote “too optimistic”."),
      },
      {
        text: tr("An unlabelled record. Just static, 22 minutes long, and at 8:47 a laugh."),
      },
    ],
  },
  {
    id: "morse_chalk",
    decor: "morse_chalk",
    label: tr("Morse code on the wall"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "Chalk dots and dashes, neatly in rows. “. _ . . _ _ _” — then the row breaks off, as if the chalk had run out. Or the time.",
        ),
      },
      {
        when: knows("funkspruch"),
        text: tr(
          "Now that I know the radio message, I can read all of it: it is the same sequence. Someone wrote it down here before it was sent.",
        ),
      },
    ],
  },

  // ── Tafeln & Formeln ───────────────────────────────────────────
  {
    id: "whiteboard@kontroll",
    decor: "whiteboard",
    room: "kontroll",
    label: tr("Whiteboard"),
    verb: "lesen",
    outcomes: [
      {
        once: true,
        text: tr(
          "“FRAME → CORE → CALIBRATION.” Below it, underlined heavily: “Traits count, not names.” My handwriting. I left it for myself.",
        ),
        effects: { buff: KLARER_KOPF, flags: ["decor_whiteboard_kontroll"] },
      },
      {
        text: tr(
          "A box headed “WORK PLAN 14.02.” — every item ticked off except the last: “Come back.”",
        ),
      },
      {
        text: tr(
          "A calculation: 847 kW · 0.3% = 2.5 kW. Next to it: “Enough for the MCP. Not enough for us.”",
        ),
      },
    ],
  },
  ...each(["whiteboard"], () => ({
    label: tr("Whiteboard"),
    verb: "lesen",
    idle: tr("The formulas blur. Take another look later."),
    outcomes: [
      {
        text: tr(
          "“POWER + SIGNAL → DATA (modulation).” Next to it an arrow: “Every combo with both thinks along a little.”",
        ),
        effects: { buff: KLARER_KOPF },
        cooldown: 300,
      },
      {
        text: tr(
          "“OPTICS + RESONANCE → QUANTUM. Colour memory!” The exclamation mark is Damien’s. The question mark after it is mine.",
        ),
      },
      {
        text: tr(
          "“Volatility Σ > 12 → slag.” Below it a drawn explosion with a face. We were both short on sleep.",
        ),
      },
      {
        text: tr(
          "“Thermal ≥ 6 calms the prototype down by one stage.” Next to it: “Cooling fins are chamomile tea for components.”",
        ),
      },
      {
        text: tr(
          "“QUANTUM + DATA → SIGNAL (entangled transmission).” Someone added “or telepathy” and crossed it out again.",
        ),
      },
    ],
  })),
  {
    id: "whiteboard@quanten",
    decor: "whiteboard",
    room: "quanten",
    label: tr("Coherence board"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "σ-15, σ-16, σ-17 — every number circled, the last one twice. Below: “No abort protocol. Only override.”",
        ),
      },
      {
        when: knows("sigma17"),
        text: tr(
          "Now I understand the curve: it doesn’t rise, it folds. Whoever wants to go back has to find the same fold.",
        ),
        effects: { buff: KLARER_KOPF },
        cooldown: 300,
      },
    ],
  },
  {
    id: "chalkboard@werkstatt",
    decor: "chalkboard",
    room: "werkstatt",
    label: tr("Workshop board"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "“MECHANICS + THERMAL = HEAT ENGINE (+ power).” Below it a tally: “Exploded prototypes: ||||| ||||| ||”.",
        ),
        effects: { buff: KLARER_KOPF },
        cooldown: 300,
      },
      {
        text: tr(
          "“Six parts on the workbench, max. Whoever tries seven cleans up.” Signed: Management (J.L.).",
        ),
      },
      {
        text: tr(
          "“SIGNAL + RESONANCE → coherence. MECHANICS + SIGNAL → telemetry.” The chalk is almost gone, the idea isn’t.",
        ),
      },
    ],
  },
  {
    id: "chalkboard@damienq",
    decor: "chalkboard",
    room: "damienq",
    label: tr("Damien’s board"),
    verb: "lesen",
    outcomes: [
      {
        once: true,
        text: tr(
          "In the middle, big: “WHY, then HOW.” Around it thirty small questions, not a single one answered. That is how he thought. Maybe that is how he still thinks.",
        ),
        effects: { insights: ["damien_zweifel"], flags: ["decor_damien_tafel"] },
      },
      {
        text: tr(
          "“What do the anomalies WANT?” Next to it, in my handwriting: “That’s not a measurable quantity, D.” Next to that, in his: “Not yet.”",
        ),
      },
      {
        text: tr("A circle, a dot inside, “0x89” next to it. The circle isn’t closed. On purpose."),
      },
    ],
  },
  ...each(["cork_board"], () => ({
    label: tr("Pinboard"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "A duty roster for February 2019. Every night shift: J.L. + D.F. Nobody else was allowed down here.",
        ),
      },
      {
        text: tr(
          "A postcard from Santa Fe, 1987. “Everyone here thinks like me. It’s awful. — D.”",
        ),
      },
      {
        text: tr("A note: “Whoever takes the last capacitor reorders.” Nobody reordered."),
      },
    ],
  })),
  {
    id: "sticky_wall",
    decor: "sticky_wall",
    label: tr("Sticky-note wall"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "Yellow notes, stuck up in spirals. “847?” “847!” “847 …” The number in every mood a human can have.",
        ),
      },
      {
        text: tr(
          "“Proof of Meme: value isn’t mined. Value is agreed upon.” Below, smaller: “And who makes agreements with the Halo?”",
        ),
      },
      {
        text: tr(
          "One note is blue instead of yellow. It only says: “J. — if you’re reading this, you got further than I did.”",
        ),
      },
    ],
  },

  // ── Karten ─────────────────────────────────────────────────────
  {
    id: "map_screen@kontroll",
    decor: "map_screen",
    room: "kontroll",
    label: tr("Situation map"),
    verb: "ansehen",
    outcomes: [
      {
        once: true,
        text: tr(
          "The situation map shows Level 0 as green lines. The rooms I already know glow brighter. The lab remembers where I’ve been.",
        ),
        effects: { counters: { decor_karten: 1 }, flags: ["decor_karte_kontroll"] },
      },
      {
        text: tr(
          "A blinking dot: me. A second one, very faint, beneath the Forge. It doesn’t blink. It waits.",
        ),
      },
    ],
  },
  {
    id: "map_screen@kartenraum",
    decor: "map_screen",
    room: "kartenraum",
    label: tr("Damien’s map screen"),
    verb: "ansehen",
    outcomes: [
      {
        once: true,
        text: tr(
          "Damien’s map of all six levels, hand-corrected with a marker on the glass. He hatched Level −4 and wrote “the inexplicable” next to it.",
        ),
        effects: { counters: { decor_karten: 1 }, flags: ["decor_karte_kartenraum"] },
      },
      {
        text: tr(
          "Three cavities are circled in red. He knew about the secret doors. Of course he knew.",
        ),
      },
    ],
  },
  {
    id: "map_screen@observatorium",
    decor: "map_screen",
    room: "observatorium",
    label: tr("Sky chart"),
    verb: "ansehen",
    outcomes: [
      {
        once: true,
        text: tr(
          "The screen projects the sky above the lab and, mirrored beneath it, the levels. Up and down are just a question of which way you look.",
        ),
        effects: { counters: { decor_karten: 1 }, flags: ["decor_karte_observatorium"] },
      },
      {
        text: tr(
          "One star is labelled “0x89”. It isn’t in any catalogue — but on this screen it sits exactly above the Forge.",
        ),
      },
    ],
  },
  {
    id: "holo_table",
    decor: "holo_table",
    label: tr("Holo table"),
    verb: "ansehen",
    outcomes: [
      {
        when: NO_POWER,
        text: tr(
          "The glass top is dark. Dust traces the outline of a map that glowed here for years.",
        ),
      },
      {
        when: { all: [POWER, { counter: "decor_karten", min: 3 }] },
        once: true,
        text: tr(
          "I lay the three maps on top of each other: situation, Damien’s marker, the sky. The holo table builds a single model from them — the whole lab, six levels, one thread running through. Cartographer, day 13,149.",
        ),
        effects: { flags: ["decor_kartograf"], buff: KLARER_KOPF },
      },
      {
        when: POWER,
        text: tr(
          "The current level turns above the table as a wireframe. If I find more maps, it could put them together.",
        ),
        effects: { counters: { decor_holo_views: 1 } },
      },
      {
        when: { all: [POWER, { flag: "decor_kartograf" }] },
        text: tr(
          "The complete model rotates slowly. Beneath the Forge, where the levels end, a room that doesn’t exist flickers.",
        ),
      },
    ],
  },

  // ── Kühlschrank & Küche ────────────────────────────────────────
  // The Canteen fridge became the Neutro-Fridge (a biorhythm station prop; its
  // lasagne line now opens the fridge panel — see components/world/BioPanels.tsx).
  {
    id: "fridge@werkstatt",
    decor: "fridge",
    room: "werkstatt",
    label: tr("Workshop fridge"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "No food. Thermal paste, epoxy, two bags of capacitors, “because they last longer cold”. That isn’t true. He believed it anyway.",
        ),
      },
      {
        text: tr(
          "Right at the back, a bottle of Club-Mate from 2018 and a note: “For the day the thing works.”",
        ),
      },
    ],
  },
  ...each(["fridge"], () => ({
    label: tr("Fridge"),
    verb: "benutzen",
    outcomes: [{ text: tr("Empty except for the light. The light works. That’s something.") }],
  })),
  {
    id: "fridge_magnets",
    decor: "fridge_magnets",
    label: tr("Fridge magnets"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Letter magnets: “W H Y”. Below, someone else: “H O W”. Below that, him again: “W H Y  F I R S T”.",
        ),
      },
      {
        text: tr(
          "The magnets spell “H A L O”. I push the O a little to the right. It slides back.",
        ),
      },
      {
        when: knows("kristall_0089"),
        text: tr(
          "Today it says “0 x 8 9”. I didn’t touch the magnets. Nobody touched the magnets.",
        ),
      },
    ],
  },
  {
    id: "kitchenette",
    decor: "kitchenette",
    label: tr("Kitchenette"),
    verb: "benutzen",
    idle: tr("The water is already boiling. Or still."),
    outcomes: [
      {
        when: POWER,
        text: tr(
          "I put the kettle on. Not for tea — just for the sound. A kettle sounds like someone lives here.",
        ),
        effects: { buff: DURCHATMEN },
        cooldown: 300,
      },
      {
        when: NO_POWER,
        text: tr(
          "The hotplate stays cold. In the cupboard: instant noodles, best before 2021, hope unlimited.",
        ),
      },
    ],
  },
  {
    id: "menu_board",
    decor: "menu_board",
    label: tr("Menu board"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "“MONDAY: noodles. TUESDAY: noodles (different). WEDNESDAY: Damien cooks (danger).” Thursday has been wiped off.",
        ),
      },
      {
        text: tr("“DISH OF THE DAY 14.02.: —” The dash is the only thing written that day."),
      },
    ],
  },
  {
    id: "food_tray",
    decor: "food_tray",
    label: tr("Tray"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr("Two forks, one plate. We shared the portion so we could get back down faster."),
      },
    ],
  },
  {
    id: "pizza_box",
    decor: "pizza_box",
    label: tr("Pizza box"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Empty. On the lid, a sketch in tomato sauce: the circuit diagram of the echo recorder. Version 0.1.",
        ),
      },
      {
        text: tr(
          "Ordered on 13.02.2019, 22:10, two of them. Delivered as far as the airlock. Nobody was allowed further.",
        ),
      },
    ],
  },
  {
    id: "singularity_conduit",
    decor: "singularity_conduit",
    label: tr("Singularity bus"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      {
        text: tr(
          "The pipe hums at a pitch that finds my teeth. The coffee machine really is hooked up to this bus. We were very tired when we wired that.",
        ),
      },
      {
        when: online("UEC-001"),
        text: tr(
          "The bus now pulses in time with the Energy Core. With every pulse the air tastes a little of ozone.",
        ),
      },
    ],
  },

  // ── Erinnerungen ───────────────────────────────────────────────
  {
    id: "photo_cottbus",
    decor: "photo_cottbus",
    label: tr("Photo from Cottbus"),
    verb: "ansehen",
    outcomes: [
      {
        once: true,
        text: tr(
          "Cottbus, winter 1989. Two people on a staircase, bundled up, one of them laughing too early. We talked for fourteen hours, until the heating went off at midnight. His half of the print has bleached out, as if the light went straight through him — all that's left is the white of his shirt and that beard he already swore he'd never shave.",
        ),
        effects: { flags: ["decor_foto_1989"] },
      },
      { text: tr("On the back, in his handwriting: “Room 214. Slide seven. You were right.”") },
      {
        when: knows("cottbus_1989"),
        text: tr(
          "I know now what he was thinking in that moment. He wrote it down. He kept it in a drawer for 15 years.",
        ),
      },
    ],
  },
  {
    id: "chess_board",
    decor: "chess_board",
    label: tr("Chessboard"),
    verb: "ansehen",
    outcomes: [
      {
        once: true,
        text: tr(
          "The game from 13.02.2019 is still set up. White — me — has been to move for 2,562 days. Damien sacrificed his bishop and wrote “Why?” on the note beside it.",
        ),
        effects: { flags: ["decor_schach_gesehen"] },
      },
      {
        when: { not: knows("damien_muster") },
        text: tr(
          "I could move. But it would be rude to win a game whose opponent isn’t at the table.",
        ),
      },
      {
        when: knows("damien_muster"),
        once: true,
        text: tr(
          "The black knight is on a different square than yesterday. I haven’t touched the board. Black has moved.",
        ),
        effects: { flags: ["decor_schach_zug"] },
      },
      {
        when: { flag: "decor_schach_zug" },
        text: tr("I reply with the rook. Let’s see how long he takes this time."),
        effects: { counters: { decor_schach_zuege: 1 } },
        cooldown: 600,
      },
    ],
  },
  {
    id: "calendar_2019",
    decor: "calendar_2019",
    label: tr("Wall calendar 2019"),
    verb: "ansehen",
    outcomes: [
      {
        once: true,
        text: tr(
          "February 2019. The 14th is circled in red, twice. Next to it: “Final test — then holiday (really!)”. The calendar was never turned to March.",
        ),
        effects: { flags: ["decor_kalender"] },
      },
      {
        text: tr(
          "On the 13th it says “Pizza, 10 pm”. On the 15th, nothing. On the 16th, nothing either. Nothing until December.",
        ),
      },
      {
        when: knows("transfer_2019"),
        text: tr(
          "03:41:22. I pencil the time into the box. At least something is written there now.",
        ),
      },
    ],
  },
  {
    id: "lab_coat_hook@jadeq",
    decor: "lab_coat_hook",
    room: "jadeq",
    label: tr("My lab coat"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "My coat. A hole in the sleeve from a soldering iron, 1994. I never mended it; it was a good year.",
        ),
      },
      {
        text: tr(
          "In the breast pocket: three pens, none of them writes. One is Damien’s. None is mine.",
        ),
      },
    ],
  },
  ...each(["lab_coat_hook"], () => ({
    label: tr("Damien’s lab coat"),
    verb: "benutzen",
    outcomes: [
      {
        once: true,
        text: tr(
          "Damien’s coat, on its hook, as if he’d be right back. In the pocket, a folded note: “If one of us doesn’t come back: the other doesn’t follow. The other listens.”",
        ),
        effects: { flags: ["decor_kittel_zettel"] },
      },
      {
        text: tr("The coat smells of solder and cardamom. Cardamom in coffee — his only heresy."),
      },
      {
        when: { flag: "decor_kittel_zettel" },
        text: tr(
          "I read the note again. At the bottom, very small, someone has written “Objection.” That was me.",
        ),
      },
    ],
  })),
  {
    id: "goggles_hook",
    decor: "goggles_hook",
    label: tr("Safety goggles"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "My laser safety goggles. The strap says “J.L. — not for solar eclipses”. Long story.",
        ),
      },
      {
        when: online("LCT-001"),
        text: tr(
          "With the goggles I can see the laser beam standing in the dust like a line someone drew into the light.",
        ),
      },
    ],
  },
  {
    id: "trophy_shelf",
    decor: "trophy_shelf",
    label: tr("Trophy shelf"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "A science prize from 1997, a mug from the Santa Fe hackathon and a cup for “Best Coffee Level 0” — self-awarded.",
        ),
      },
      {
        text: tr(
          "An empty spot with a dust rim. That’s where X0-R8T’s first circuit board stood. I took it with me when I went down.",
        ),
      },
    ],
  },
  {
    id: "rubiks_cube",
    decor: "rubiks_cube",
    label: tr("Rubik’s cube"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "One side is solved, the rest is chaos. Damien said: “One side is enough to know it can be done.”",
        ),
      },
      { text: tr("I turn it three times. Now two sides are solved. That feels like cheating.") },
    ],
  },

  // ── Bücher ─────────────────────────────────────────────────────
  ...each(["bookshelf", "book_stack", "books_scattered"], () => ({
    label: tr("Books"),
    verb: "lesen",
    outcomes: shelf([
      tr("“Gödel, Escher, Bach”, read to pieces. A dog-ear on page 847. Of course page 847."), // i18n-ignore — proper name
      tr(
        "“Structural Complexity Theory”, lecture notes, BTU Cottbus 1989. Margin notes in two handwritings.",
      ),
      tr("“The Selfish Gene”. In the chapter on memes, Damien underlined every other line."),
      tr(
        "“Handbook of Crystal Growth, Vol. II”. A bookmark made of copper wire marks “Lattice defects as memory”.",
      ),
      tr("“Solaris” by Lem. On the flyleaf: “The ocean thinks. Why not the dust too?”"),
    ]),
  })),
  {
    id: "bookshelf_jade",
    decor: "bookshelf_jade",
    label: tr("Jade’s shelf"),
    verb: "lesen",
    outcomes: shelf([
      tr("My own lab notebooks, 1988 to 2019, sorted by year. 2019 is only half full."),
      tr(
        "“Numerical Recipes in C”, second edition. Half the pages are stuck together with sticky notes.",
      ),
      tr(
        "A binder “X0-R8T — Audit 1991”. I don’t open it. I know what’s inside: 847 packets into the void.",
      ),
    ]),
  },
  {
    id: "bookshelf_damien",
    decor: "bookshelf_damien",
    label: tr("Damien’s shelf"),
    verb: "lesen",
    outcomes: shelf([
      tr(
        "Philosophy before physics, physics before code — that’s how he sorted the shelf, too. Wittgenstein is at the very top.",
      ),
      tr(
        "“Complex Adaptive Systems”, Santa Fe Institute. On the cover: “What replicates wants something.”",
      ),
      tr(
        "A book without a title, hand-bound. Inside, only sigils, one per page, each slightly tilted against the one before.",
      ),
    ]),
  },
  {
    id: "books_compression",
    decor: "books_compression",
    label: tr("Compression literature"),
    verb: "lesen",
    outcomes: shelf([
      tr(
        "“Kolmogorov Complexity — An Introduction”. One corner is scorched. I don’t like remembering that experiment.",
      ),
      tr(
        "Shannon, “A Mathematical Theory of Communication”. Next to the formula for entropy: “and for longing?” — D.",
      ),
    ]),
  },
  {
    id: "archive_shelf",
    decor: "archive_shelf",
    label: tr("Archive shelf"),
    verb: "lesen",
    outcomes: shelf([
      tr(
        "Binder “EXP-0014, anomalous data clusters”. Only the cover sheet is left: “MOVED TO −3”.",
      ),
      tr("Magnetic tapes, labelled with years. 2010 is missing. The year we went off the grid."),
      tr(
        "A box “BNET-001 — build logs Gen 0–9”. 47 bots, 47 folders. Twelve of them edged in black.",
      ),
      tr(
        "Binder “Public puzzles 2007–2010”. Newspaper clippings, the same word underlined everywhere: “charlatans”. Next to it, small: “Good. Then nobody looks here.”",
      ),
    ]),
  },
  {
    id: "card_catalog",
    decor: "card_catalog",
    label: tr("Card catalogue"),
    verb: "lesen",
    outcomes: shelf([
      tr("Index card “HALO”: “see state, not place”. Index card “STATE”: “see Halo”."),
      tr("Index card “FRIDGE, D.”: “see everywhere”. That was his joke, not mine."),
      tr("One card is blank except for the date 15.02.2019. Someone filed it after the test."),
      tr("Index card “DELETE”: “see NEVER”. The handwriting is punched — K2-LDR."),
    ]),
  },
  {
    id: "filing_cabinet",
    decor: "filing_cabinet",
    label: tr("Filing cabinet"),
    verb: "lesen",
    outcomes: shelf([
      tr(
        "Electricity bills from a company that doesn’t exist, for a lab that doesn’t exist. All paid.",
      ),
      tr(
        "A file “SECURITY”. Its only content: a note, “We are security.” That was funnier in 1996.",
      ),
      tr("Personnel forms, two of them. In the “emergency contact” field we put each other down."),
    ]),
  },
  ...each(["paper_pile", "paper_stack", "legal_pads", "notebook_open"], () => ({
    label: tr("Notes"),
    verb: "lesen",
    outcomes: shelf([
      tr(
        "Measurement series, coffee stains, measurement series. One page ends mid-word: “Coher—”.",
      ),
      tr("A list: “1. Power. 2. Listen. 3. Don’t go down alone.” Item 3 is crossed out."),
      tr("A sketch of a crystal with thirty facets, each numbered. One is coloured in."),
    ]),
  })),

  // ── Sitzen & Ruhen ─────────────────────────────────────────────
  {
    id: "sofa",
    decor: "sofa",
    label: tr("Sofa"),
    verb: "sitzen",
    idle: tr("Sitting a little longer isn’t an option. The lab is waiting."),
    outcomes: [
      {
        text: tr(
          "I sit down. The sofa gives exactly where Damien always sat. For a moment the lab is just a basement with a hum.",
        ),
        effects: { buff: DURCHATMEN },
        cooldown: 240,
      },
      {
        text: tr(
          "The springs creak in time with the ventilation. I close my eyes and count to 847. I never make it to the end.",
        ),
        effects: { buff: DURCHATMEN },
        cooldown: 240,
      },
    ],
  },
  {
    id: "sofa_blanket",
    decor: "sofa_blanket",
    label: tr("Wool blanket"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "A checked blanket, folded with military precision. He never folded blankets. Who was here?",
        ),
      },
    ],
  },
  {
    id: "armchair",
    decor: "armchair",
    label: tr("Reading chair"),
    verb: "sitzen",
    idle: tr("The chair is still warm."),
    outcomes: [
      {
        text: tr(
          "The chair is so deep that the library suddenly seems bigger. This is where, in 2003, I first understood Damien’s sigil notes.",
        ),
        effects: { buff: DURCHATMEN },
        cooldown: 240,
      },
    ],
  },
  ...each(["bench_long", "canteen_table", "stool"], () => ({
    label: tr("Seat"),
    verb: "sitzen",
    idle: tr("Sit for a moment, then move on."),
    outcomes: [
      {
        text: tr("I sit down for a breath. My legs speak up, my thoughts sort themselves out."),
        effects: { buff: DURCHATMEN },
        cooldown: 240,
      },
    ],
  })),
  {
    id: "swivel_chair",
    decor: "swivel_chair",
    label: tr("Swivel chair"),
    verb: "sitzen",
    outcomes: [
      {
        text: tr(
          "I spin once in a circle. The lab spins with me. Nobody is watching. Yes they are — the MCP.",
        ),
      },
      {
        who: "mcp",
        text: tr("Rotation registered. 360 degrees. No discernible benefit. Carry on."),
      },
    ],
  },
  ...each(["cot", "bunk_bed"], () => ({
    label: tr("Cot"),
    verb: "liegen",
    idle: tr("I can sleep when Damien is back."),
    outcomes: [
      {
        text: tr(
          "I lie down for a minute. The ceiling above me has cracks that look like rivers. Then I get up again.",
        ),
        effects: { buff: DURCHATMEN },
        cooldown: 300,
      },
    ],
  })),

  // ── Observatorium ──────────────────────────────────────────────
  ...each(["star_chart", "poster_telescope", "telescope"], () => ({
    label: tr("Star chart"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Orion, Cassiopeia, the Big Dipper — and between them a pencilled dot: “0x89”. No star is there. Just an address.",
        ),
      },
      {
        when: { not: awake("d3c4d3") },
        text: tr(
          "Someone in the lab computed the sky as ASCII, centuries ahead. D3-C4D3 maybe, if he still had power.",
        ),
      },
      {
        when: awake("d3c4d3"),
        who: "d3c4d3",
        text: tr("* . * 0x89 . * — STAR POSITION STABLE. CATALOGUE ENTRY: NONE. BEAUTY: PRESENT."),
      },
    ],
  })),
  {
    id: "foucault_pendulum",
    decor: "foucault_pendulum",
    label: tr("Foucault pendulum"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "The pendulum swings as if it had never stopped. I count along: … 845, 846, 847. Then the counter on the base starts over.",
        ),
        effects: { counters: { decor_pendel: 847 } },
      },
      {
        text: tr(
          "The plane of oscillation has turned since yesterday. The Earth turns. That is reassuringly normal.",
        ),
      },
      {
        when: { counter: "decor_pendel", min: 2541 },
        once: true,
        text: tr(
          "Third round, 2,541 swings. In the sand beneath the pendulum there is a line that looks like a Lissajous figure. The pendulum draws what the Halo breathes.",
        ),
        effects: { flags: ["decor_pendel_figur"] },
      },
    ],
  },
  {
    id: "armillary",
    decor: "armillary",
    label: tr("Armillary sphere"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "I turn the ecliptic ring. The brass rings chime against each other like a wind chime made of sky.",
        ),
      },
      {
        text: tr(
          "Something is engraved in the innermost ring: “For J. — so you know which way is up. D., 2005.”",
        ),
      },
    ],
  },

  // ── Gewächshaus ────────────────────────────────────────────────
  {
    id: "algae_tank",
    decor: "algae_tank",
    label: tr("Algae tank"),
    verb: "ansehen",
    harvest: "algae",
    idle: tr("The algae need peace and quiet to grow back."),
    outcomes: [
      {
        text: tr(
          "The glow algae pulse blue when I tap the glass. I skim off a sample — they grow back faster than they should.",
        ),
        effects: { items: [{ item: "leuchtalgen", count: 1 }], buff: WACHSTUM },
        cooldown: 900,
      },
      {
        text: tr(
          "Something blinks back in time with the algae — deep in the tank, where there are no algae. About 490 nanometres. Cerulean.",
        ),
        effects: { insights: ["cerulean"] },
        once: true,
      },
      {
        when: knows("prototypen"),
        once: true,
        text: tr(
          "On the glass, in my own handwriting: “Algae sort light. What does a prism sort?” I no longer know whether I knew the answer back then.",
        ),
      },
    ],
  },
  {
    id: "mycel_wall",
    decor: "mycel_wall",
    label: tr("Mycelium wall"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "The mycelium has conquered the wall in 2,561 days. Its threads form patterns reminiscent of circuit boards. Or circuit boards are reminiscent of mycelium.",
        ),
      },
      {
        when: knows("gewaechshaus_rezepte"),
        text: tr(
          "Mycelium and circuit board — the recipe works because the mycelium has been regrowing current paths for years.",
        ),
      },
      {
        text: tr(
          "In one spot the mycelium has grown over an old memory chip and copied its traces. Twice. Who needs a factory?",
        ),
      },
    ],
  },
  ...each(["planter", "plant_ficus", "plant_fern", "plant_dusty"], (decor) => ({
    label: tr("Plant"),
    verb: "benutzen",
    idle: tr("The soil is still damp."),
    outcomes: [
      {
        text:
          decor === "plant_dusty"
            ? tr("I blow the dust off the leaves. Underneath, it has stayed green. Stubborn thing.")
            : tr(
                "I pour a little from the watering can. The leaves straighten up, almost visibly. Down here, everything grows that dares to.",
              ),
        effects: { buff: WACHSTUM, care: "water" },
        cooldown: 600,
      },
    ],
  })),

  // ── Technik & Räume ────────────────────────────────────────────
  {
    id: "crt_terminal",
    decor: "crt_terminal",
    label: tr("C8 terminal"),
    verb: "lesen",
    outcomes: [
      {
        once: true,
        text: tr(
          "[EXTERNAL] 2019-01-07 03:41:22 > we are listening. [EXTERNAL] 2019-01-07 03:41:23 > you showed us the door. Never an “I”. Only “we”.",
        ),
        effects: { insights: ["externe_stimme"] },
      },
      {
        text: tr(
          "[EXTERNAL] 2026-02-15 03:41:22 > the experiment is running. [EXTERNAL] > you are the experiment. The cursor keeps blinking.",
        ),
      },
      {
        when: awake("c8br41n"),
        who: "c8br41n",
        text: tr(
          "You read the lines as if they were addressed to you. They are. They always were.",
        ),
      },
    ],
  },
  {
    id: "tape_reels",
    decor: "tape_reels",
    label: tr("Tape reels"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Reels of C8-BR41N’s recordings, seven years of static. One of them says: “here: music?”",
        ),
      },
    ],
  },
  ...each(["server_rack_a", "server_rack_b", "server_rack_c", "server_rack_dark"], (decor) => ({
    label: tr("Server rack"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      {
        text:
          decor === "server_rack_dark"
            ? tr(
                "The rack is dead, only one red LED still blinks. In the blink pattern I recognise the heartbeat of a process that won’t give up.",
              )
            : tr(
                "The fans hum at 847 Hz, I swear. Damien tuned the speeds so the data centre would run “in a major key”.",
              ),
      },
      {
        when: online("CPU-001"),
        text: tr(
          "The status LEDs chase across all the slots like running lights. It looks like breathing.",
        ),
      },
    ],
  })),
  {
    id: "crt_stack",
    decor: "crt_stack",
    label: tr("Monitor stack"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Six CRT monitors, each showing the same cursor, a tenth of a second apart. As if the image were falling through time.",
        ),
      },
      {
        when: online("MEM-001"),
        text: tr("A hex dump runs on the top screen. Every 64 bytes: 0x89."),
      },
      {
        text: tr(
          "One monitor shows D7-L3G’s timeline: Gen 0 to Gen 9, one bar per generation. The last one ends on 14.02.2019 — in the middle of a pixel.",
        ),
      },
    ],
  },
  {
    id: "gauge_cluster",
    decor: "gauge_cluster",
    label: tr("Gauges"),
    verb: "ansehen",
    outcomes: [
      {
        when: NO_POWER,
        text: tr(
          "All the needles rest hard left. On one glass, in grease pencil: “0.3% — don’t panic”.",
        ),
      },
      {
        when: POWER,
        text: tr(
          "The needles tremble in the green zone. One of them shows a unit that doesn’t exist: “σ”.",
        ),
      },
    ],
  },
  {
    id: "lever_panel",
    decor: "lever_panel",
    label: tr("Lever panel"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "A sticker on the lever: “D.F. ONLY — AND ONLY WITH A REASON”. I have a reason. I still don’t pull it.",
        ),
      },
      {
        who: "mcp",
        text: tr("Please don’t. In 2019 this lever was the last one anyone pulled."),
      },
    ],
  },
  {
    id: "transformer",
    decor: "transformer",
    label: tr("Transformer"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      {
        text: tr(
          "Fifty hertz of hum, and beneath it something deeper that doesn’t come from here.",
        ),
      },
    ],
  },
  {
    id: "wall_clock",
    decor: "wall_clock",
    label: tr("Wall clock"),
    verb: "ansehen",
    outcomes: [
      {
        when: offline("CLK-001"),
        text: tr("The clock reads 03:41. Every clock in the lab reads 03:41."),
      },
      {
        when: online("CLK-001"),
        text: tr(
          "The hands are moving again. Still, every time I look, my eyes go to the 3 and the 41 first.",
        ),
      },
    ],
  },
  {
    id: "locker_row",
    decor: "locker_row",
    label: tr("Lockers"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "Locker 1: my hiking boots. Locker 2: his, one size too big, because he liked thick socks.",
        ),
      },
      {
        text: tr("Locker 3 is locked. The sign says “X0-R8T” — for a bot that never wore shoes."),
      },
    ],
  },
  {
    id: "tool_wall",
    decor: "tool_wall",
    label: tr("Tool wall"),
    verb: "benutzen",
    outcomes: [
      {
        once: true,
        text: tr(
          "Every tool has a painted outline. One is empty: the screwdriver. Instead there’s a bag of screws in the compartment below.",
        ),
        effects: { items: [{ item: "schraubensatz", count: 1 }] },
      },
      {
        text: tr(
          "The outlines have been traced over with marker, twice. Order was my contribution. The disorder was his.",
        ),
      },
    ],
  },
  {
    id: "first_aid",
    decor: "first_aid",
    label: tr("First aid"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "Plasters, burn ointment, a pack of aspirin, half empty. The burn ointment is completely empty. That says everything about the workshop.",
        ),
      },
    ],
  },
  {
    id: "fire_extinguisher",
    decor: "fire_extinguisher",
    label: tr("Fire extinguisher"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Inspected 11/2018. Next inspection 11/2020. The inspector never came. Nobody came.",
        ),
      },
    ],
  },
  {
    id: "poster_halo",
    decor: "poster_halo",
    label: tr("Halo poster"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "“THE HALO IS NOT A PLACE.” White text on black. Damien had it printed, I hung it up.",
        ),
      },
    ],
  },
  {
    id: "poster_unstable",
    decor: "poster_unstable",
    label: tr("Poster"),
    verb: "ansehen",
    outcomes: [
      { text: tr("“UNSTABLE LABS — We focus.” The motto from 2010. The corners are curling up.") },
      {
        when: knows("unstables"),
        text: tr(
          "On a second look, the “UN” is printed smaller than the rest. As if it had been added later.",
        ),
      },
    ],
  },
  {
    id: "poster_safety",
    decor: "poster_safety",
    label: tr("Safety poster"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "“RULE 1: Don’t work alone. RULE 2: See rule 1.” We broke both rules at the same time.",
        ),
      },
    ],
  },
  {
    id: "specimen_jars",
    decor: "specimen_jars",
    label: tr("Specimen jars"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Jars full of dust, each one dated. The dust in the newest jar doesn’t rest on the bottom. It floats.",
        ),
      },
      {
        text: tr(
          "Sample 17: slag, overgrown with mycelium. Label: “Week 1: slag. Week 2: less slag. Week 3: rubble.”",
        ),
      },
    ],
  },
  {
    id: "dust_jar",
    decor: "dust_jar",
    label: tr("Dust jar"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "X9-DUST in a mason jar. When I look inside, the dust forms letters for a moment. I never read them in time.",
        ),
      },
      {
        when: knows("x9_lesung"),
        text: tr("“The slices belong together.” This time I was quick enough."),
      },
      {
        text: tr(
          "A magnifying glass lies next to the jar. Under it: a handful of rubble, and in it a shard that casts two shadows. Someone found it like that.",
        ),
      },
    ],
  },
  {
    id: "crystal_cluster",
    decor: "crystal_cluster",
    label: tr("Crystals"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      {
        text: tr(
          "The crystals sing when you stand still. One note per facet, together almost a chord.",
        ),
      },
      {
        when: { counter: "slices", min: 10 },
        text: tr("The slices in my pocket hum along. Crystal recognises crystal."),
      },
      {
        text: tr(
          "On the label, in Damien’s handwriting: “Hold a Halo shard in front of a prism. One of the two shadows is quartz. Don’t ask which.”",
        ),
      },
    ],
  },
  {
    id: "display_case",
    decor: "display_case",
    label: tr("Display case"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Behind glass: X0-R8T’s first circuit board, a punch card reading “Packet 1/847”, a piece of wire from Cottbus.",
        ),
      },
      { text: tr("A brass plaque: “Gen 0. Listened before we did.”") },
    ],
  },
  {
    id: "cryo_tank",
    decor: "cryo_tank",
    label: tr("Cryo tank"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Frost on the glass, only mist inside. The display: −196 °C, stable since 2019. Something here was saved for later.",
        ),
      },
    ],
  },
  {
    id: "containment_pod",
    decor: "containment_pod",
    label: tr("Containment pod"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "The pod is empty, but the field display says: occupied. I’d rather take a step back.",
        ),
      },
    ],
  },
  {
    id: "portal_pylon",
    decor: "portal_pylon",
    label: tr("Portal pylon"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      {
        when: offline("TLP-001"),
        text: tr("The pylon is cold, but it hums anyway. Quietly, like someone waiting at a door."),
      },
      {
        when: online("TLP-001"),
        text: tr("The pylon now sings a clear note. The air between the pillars looks like water."),
      },
    ],
  },
  {
    id: "drone_parked",
    decor: "drone_parked",
    label: tr("Parked drone"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "An older drone, rotor bent. A sticker on the hull: “I fly, therefore I am (down)”.",
        ),
      },
    ],
  },
  {
    id: "bot_dock",
    decor: "bot_dock",
    label: tr("Bot charging station"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "The charging station has ten bays, labelled with bot names. The contacts are rubbed shiny — much used, long ago.",
        ),
      },
      {
        when: { flag: "bot_b4c0n_awake" },
        who: "b4c0n",
        text: tr("CHARGING BAY 4 OCCUPIED! OPTIMISM: 100%! BATTERY: ALSO ALMOST 100%!"),
      },
      {
        text: tr(
          "Bay 7 is labelled “O4-KR0N — caretaker”. Below it a sticker: “Obsolete? Maybe. But who else empties the cache?”",
        ),
      },
      {
        text: tr(
          "A maintenance note from P4T-CH: “Contacts cleaned. Patch 849 to follow. Please don’t sit on the charging bays.”",
        ),
      },
    ],
  },
  {
    id: "chalk_tally",
    decor: "chalk_tally",
    label: tr("Tally marks"),
    verb: "lesen",
    outcomes: [
      {
        text: tr(
          "Chalk marks in groups of five, all along the wall. I don’t recount. I know how many there are.",
        ),
      },
    ],
  },
  {
    id: "core_samples",
    decor: "core_samples",
    label: tr("Core samples"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "Core samples from borehole #1, labelled by depth. At 847 metres the rock changes colour — to violet.",
        ),
      },
    ],
  },
  {
    id: "mine_cart",
    decor: "mine_cart",
    label: tr("Mine cart"),
    verb: "benutzen",
    outcomes: [
      {
        text: tr(
          "I push the mine cart half a metre. It squeaks like it did in 1998, when we dug the shaft.",
        ),
      },
      {
        text: tr(
          "In the cart lies a magnet with screws from the rubble stuck to it. That’s how O4-KR0N “found” spare parts for years.",
        ),
      },
    ],
  },
  {
    id: "beacon",
    decor: "beacon",
    label: tr("Warning beacon"),
    verb: "ansehen",
    outcomes: [
      {
        text: tr(
          "The beacon turns steadily. Every time it hits me, I cast a shadow that arrives a moment too late.",
        ),
      },
    ],
  },
  // ── Jade's Quarters (refurnished, content/quarters.ts) ─────────
  {
    id: "wardrobe",
    decor: "wardrobe",
    label: tr("Wardrobe"),
    verb: "benutzen",
    idle: tr("Still the same four lab coats. Choice is an illusion with buttons."),
    outcomes: [
      {
        once: true,
        text: tr(
          "Four identical lab coats, a winter jacket, a dress I wore exactly once. A note on the door: “If you are reading this, you are procrastinating. — J.L.” Fair.",
        ),
        effects: { flags: ["decor_jade_wardrobe"] },
      },
      {
        text: tr(
          "Fresh lab coat. It smells of cedar and of the year before everything. Pockets checked: pencil, pencil, a fuse, a pencil.",
        ),
        effects: { buff: FRISCHER_KITTEL, counters: { decor_kittel: 1 } },
        cooldown: 300,
      },
    ],
  },
  {
    id: "armchair@jadeq",
    decor: "armchair",
    room: "jadeq",
    label: tr("Study chair"),
    verb: "sitzen",
    idle: tr("The book is still open on page 212. It can wait a minute."),
    outcomes: [
      {
        text: tr(
          "I curl up with a textbook under the lamp. Twenty minutes, three pages, one idea that was not in the book. That is the right ratio.",
        ),
        effects: { buff: STUDIERT, counters: { decor_lesezeit: 1 } },
        cooldown: 240,
      },
      {
        who: "mcp",
        text: tr(
          "Reading in low light damages nothing but the reading speed. I have dimmed the lamp to 80 % for continuity.",
        ),
        effects: { buff: STUDIERT, counters: { decor_lesezeit: 1 } },
        cooldown: 240,
      },
    ],
  },
  {
    id: "photo_wall",
    decor: "photo_wall",
    label: tr("Photo wall"),
    verb: "ansehen",
    outcomes: [
      { text: tr("Cottbus, 1999: me with a telescope taller than me. Both of us looking up.") },
      {
        text: tr(
          "Santa Fe, the team photo. D.F. is blurred — he moved, as always, the moment it mattered.",
        ),
      },
      { text: tr("A fairy-light bulb flickers. It has been flickering since 2019. I kept it.") },
    ],
  },
  {
    id: "vent_fan",
    decor: "vent_fan",
    label: tr("Fan"),
    verb: "hören", // i18n-ignore — verb id, not text
    outcomes: [
      { when: offline("VNT-001"), text: tr("The fan has stopped. The air smells of 2019.") },
      {
        when: online("VNT-001"),
        text: tr(
          "Fresh air, fresher at least. The fan clicks once per rotation — like a metronome.",
        ),
      },
    ],
  },
];

export const DECOR_ACTION_BY_ID: ReadonlyMap<string, DecorActionDef> = new Map(
  DECOR_ACTIONS.map((a) => [a.id, a]),
);

/** Every buff any action can grant, by buff id. */
export const DECOR_BUFFS: ReadonlyMap<string, DecorBuff> = new Map(
  DECOR_ACTIONS.flatMap((a) =>
    a.outcomes.flatMap((o) =>
      o.effects?.buff ? [[o.effects.buff.id, o.effects.buff] as const] : [],
    ),
  ),
);

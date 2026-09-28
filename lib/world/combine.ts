/**
 * Combination engine — deterministic and open-ended.
 * ==================================================
 *
 * Any multiset of 2+ items combines into something:
 *  1. an explicit recipe (resources, standard sub-assemblies), or
 *  2. a generated prototype whose traits are derived from its inputs —
 *     summed with loss, plus axis synergies, plus one hash-seeded
 *     "emergent" property. Prototypes combine again, so the space of
 *     results is unbounded, yet the same inputs always yield the same
 *     output ("Every phenomenon is a stochastic process that can be
 *     quantified, recorded, and tokenized.").
 *
 * Too much volatility in one combination explodes into slag — and, on
 * the first time a particular mix blows up, sometimes into a small,
 * deterministic side product or event (see `EXPLOSION_EVENTS`).
 *
 * Prototypes whose trait profile hits a named archetype (`ARCHETYPES`) get
 * a special name, colour and property. What a prototype can *do* when used
 * on a device, prop, door, bot or another prototype is described by
 * `PROTO_EFFECTS`; the stateful rules live in `usePrototype` (game.ts).
 */
import { tr } from "@/lib/i18n";
import { ITEM_BY_ID, RECIPE_BY_KEY, comboKey, type Recipe } from "@/lib/world/content/items";
import {
  AXIS_LABEL,
  addTraits,
  blendColors,
  dominantAxes,
  emptyTraits,
  fnv1a,
  roundTraits,
  traitTotal,
} from "@/lib/world/traits";
import {
  TRAIT_AXES,
  type ItemDef,
  type SpectrumColor,
  type TraitAxis,
  type Traits,
} from "@/lib/world/types";

/** Resolve an item id against authored items and generated prototypes. */
export function lookupItem(id: string, generated: Record<string, ItemDef>): ItemDef | undefined {
  return ITEM_BY_ID.get(id) ?? generated[id];
}

export interface CombineResult {
  kind: "recipe" | "prototype" | "explosion" | "missing-station" | "invalid";
  output?: ItemDef;
  count: number;
  recipe?: Recipe;
  /** Human-readable explanation of what happened. */
  message: string;
  /** Synergies that fired, for the UI. */
  synergies: string[];
  key: string;
  /** Prototype only: the named archetype it hit. */
  archetype?: ArchetypeDef;
  /** Explosion only: the summed volatility that blew up. */
  volatility?: number;
  /** Explosion only: the side event (always alongside the slag). */
  event?: ExplosionEventDef;
  /** Explosion only: side products besides the slag (granted on a first-time mix). */
  extras?: { item: string; count: number }[];
}

/** Pairs of axes that, when both present, give rise to a third. */
export const SYNERGIES: readonly {
  a: TraitAxis;
  b: TraitAxis;
  gives: TraitAxis;
  amount: number;
  label: string;
}[] = [
  { a: "energie", b: "signal", gives: "daten", amount: 2, label: tr("synergy::Modulation") },
  { a: "optik", b: "resonanz", gives: "quantum", amount: 2, label: tr("synergy::Colour Memory") },
  { a: "thermik", b: "mechanik", gives: "energie", amount: 1, label: tr("synergy::Thermal Power") },
  { a: "signal", b: "resonanz", gives: "quantum", amount: 1, label: tr("synergy::Coherence") },
  {
    a: "quantum",
    b: "daten",
    gives: "signal",
    amount: 2,
    label: tr("synergy::Entangled Transmission"),
  },
  { a: "energie", b: "quantum", gives: "thermik", amount: 2, label: tr("synergy::Field Heating") },
  { a: "optik", b: "daten", gives: "signal", amount: 1, label: tr("synergy::Light Bus") },
  { a: "mechanik", b: "signal", gives: "daten", amount: 1, label: tr("synergy::Telemetry") },
  { a: "energie", b: "optik", gives: "thermik", amount: 1, label: tr("synergy::Radiant Heat") },
  { a: "resonanz", b: "daten", gives: "signal", amount: 1, label: tr("synergy::Pattern") },
];

const ADJECTIVE: Record<TraitAxis, string> = {
  energie: tr("proto-adj::Charged"),
  signal: tr("proto-adj::Transmitting"),
  optik: tr("proto-adj::Refracting"),
  thermik: tr("proto-adj::Glowing"),
  mechanik: tr("proto-adj::Armoured"),
  quantum: tr("proto-adj::Entangled"),
  resonanz: tr("proto-adj::Oscillating"),
  daten: tr("proto-adj::Computing"),
};

const NOUN: Record<TraitAxis, string> = {
  energie: tr("proto-noun::Accumulator"),
  signal: tr("proto-noun::Transceiver"),
  optik: tr("proto-noun::Collimator"),
  thermik: tr("proto-noun::Heat Exchanger"),
  mechanik: tr("proto-noun::Actuator"),
  quantum: tr("proto-noun::Qubit Node"),
  resonanz: tr("proto-noun::Resonator"),
  daten: tr("proto-noun::Logic Core"),
};

/** Sum of volatility above which a combination explodes. */
export const VOLATILITY_LIMIT = 12;
export const MAX_INPUTS = 6;

export function combine(
  inputs: Record<string, number>,
  generated: Record<string, ItemDef>,
  stationOnline: (deviceId: string) => boolean = () => true,
): CombineResult {
  const key = comboKey(inputs);
  const ids = Object.keys(inputs)
    .filter((k) => (inputs[k] ?? 0) > 0)
    .sort();
  const total = ids.reduce((s, k) => s + (inputs[k] ?? 0), 0);
  if (total < 2)
    return { kind: "invalid", count: 0, message: tr("At least two parts."), synergies: [], key };

  const recipe = RECIPE_BY_KEY.get(key);
  if (recipe) {
    if (recipe.station && !stationOnline(recipe.station)) {
      return {
        kind: "missing-station",
        count: 0,
        recipe,
        message: tr("The recipe “{recipe}” needs {station} running.", {
          recipe: recipe.note,
          station: recipe.station,
        }),
        synergies: [],
        key,
      };
    }
    const output = ITEM_BY_ID.get(recipe.output);
    return {
      kind: "recipe",
      output,
      count: recipe.count,
      recipe,
      message: recipe.note,
      synergies: [],
      key,
    };
  }

  const defs: { def: ItemDef; n: number }[] = [];
  for (const id of ids) {
    const def = lookupItem(id, generated);
    if (!def)
      return {
        kind: "invalid",
        count: 0,
        message: tr("Unknown part: {id}", { id }),
        synergies: [],
        key,
      };
    defs.push({ def, n: inputs[id] ?? 0 });
  }

  let volSum = 0;
  for (const { def, n } of defs) volSum += def.volatility * n;
  if (volSum > VOLATILITY_LIMIT) {
    const { event, extras } = explosionEvent(key, defs);
    return {
      kind: "explosion",
      output: ITEM_BY_ID.get("schlacke"),
      count: 1,
      message:
        event.id === "verpufft"
          ? tr("Volatility {vol} > {limit}. It goes bang. Slag is all that is left.", {
              vol: volSum,
              limit: VOLATILITY_LIMIT,
            })
          : tr("Volatility {vol} > {limit}. It goes bang. Slag is all that is left. {event}", {
              vol: volSum,
              limit: VOLATILITY_LIMIT,
              event: event.text,
            }),
      synergies: [],
      key,
      volatility: volSum,
      event,
      extras,
    };
  }

  // 1) Sum with 20 % loss.
  let t: Traits = emptyTraits();
  for (const { def, n } of defs) t = addTraits(t, def.traits, 0.8 * n);

  // 2) Synergies.
  const synergies: string[] = [];
  for (const s of SYNERGIES) {
    if (t[s.a] >= 2 && t[s.b] >= 2) {
      t[s.gives] += s.amount;
      synergies.push(
        `${s.label}: ${AXIS_LABEL[s.a]} + ${AXIS_LABEL[s.b]} → +${s.amount} ${AXIS_LABEL[s.gives]}`,
      );
    }
  }

  // 3) Emergent property, seeded by the canonical key.
  const h = fnv1a(`unlabs:combine:${key}`);
  const emergent = TRAIT_AXES[h % TRAIT_AXES.length]!;
  const bonus = 1 + ((h >>> 3) % 3);
  t[emergent] += bonus;
  synergies.push(tr("Emergence: +{n} {axis}", { n: bonus, axis: AXIS_LABEL[emergent] }));

  t = roundTraits(t);

  // Volatility: the wildest input dominates; heat sinks calm it down.
  const maxVol = Math.max(...defs.map((d) => d.def.volatility));
  const hotInputs = defs.filter((d) => d.def.volatility >= 3).reduce((s, d) => s + d.n, 0);
  let volatility = maxVol + (hotInputs >= 2 ? 1 : 0);
  if (t.thermik >= 6) volatility -= 1;
  volatility = Math.max(1, Math.min(5, volatility));

  const depth = Math.max(...defs.map((d) => d.def.depth)) + 1;
  let color = blendColors(
    defs.map((d) => ({ color: d.def.color, weight: traitTotal(d.def.traits) * d.n })),
  );
  const tag = (h >>> 8).toString(16).slice(0, 3).toUpperCase().padStart(3, "0");
  const id = `p_${h.toString(16).padStart(8, "0")}`;

  // 4) Named archetype: detected on the finished profile, then applied.
  const archetype = detectArchetype(t, depth, volatility);
  // Archetypes never change traits (build slots stay predictable), only
  // volatility, colour, name and what the prototype can do when used.
  if (archetype) {
    if (archetype.fixedVolatility !== undefined) volatility = archetype.fixedVolatility;
    else if (archetype.volatilityDelta)
      volatility = Math.max(1, Math.min(5, volatility + archetype.volatilityDelta));
    color = archetype.color;
    synergies.push(
      tr("Archetype “{name}”: {property}", { name: archetype.name, property: archetype.property }),
    );
  }

  const [first, second] = dominantAxes(t);
  const name = archetype
    ? `${archetype.name} Mk.${depth}`
    : tr("{adjective} {noun} Mk.{depth}", {
        adjective: ADJECTIVE[first!],
        noun: NOUN[second!],
        depth,
      });
  const from = defs.map((d) => `${d.n}× ${d.def.name}`).join(", ");

  const output: ItemDef = {
    id,
    name,
    kind: "prototyp",
    traits: t,
    color,
    volatility,
    depth,
    parents: ids.flatMap((i) => Array<string>(inputs[i] ?? 0).fill(i)),
    description: archetype
      ? tr("Prototype {tag} · Archetype “{name}”: {property} From {from}.", {
          tag,
          name: archetype.name,
          property: archetype.property,
          from,
        })
      : tr("Prototype {tag}. From {from}.", { tag, from }),
  };
  if (archetype) output.archetype = archetype.id;
  return { kind: "prototype", output, count: 1, message: name, synergies, key, archetype };
}

// ── Archetypes ───────────────────────────────────────────────────

/**
 * A named emergent prototype. When a freshly generated prototype's trait
 * profile meets `need` (and `test`, if any), it is renamed, recoloured and
 * gains the archetype's property. First creation sets the flag
 * `arch_<id>` (see `archetypeFlag`), which the codex lists.
 */
export interface ArchetypeDef {
  id: string;
  name: string;
  /** Spectrum colour of the prototype (drives the procedural icon). */
  color: SpectrumColor;
  /** Accent colour for UI chips / codex rows. */
  hex: string;
  /** Minimum traits (after synergies and emergence). */
  need: Partial<Traits>;
  /** Extra shape test on the traits, generation depth and volatility. */
  test?: (t: Traits, depth: number, volatility: number) => boolean;
  /** Human-readable recognition rule (codex). */
  rule: string;
  /** The unique property, one sentence (tooltip / codex). */
  property: string;
  /** Flavour line for the codex. */
  lore: string;
  fixedVolatility?: number;
  volatilityDelta?: number;
  /** Effect families that do not consume the prototype. */
  reusable?: ProtoEffectId[];
  /** Effect magnitude multiplier (Ladung, Kühlung, Lichtbild radius, Peilung count). */
  strength?: number;
  /** Lowers every effect threshold by this many points. */
  ease?: number;
  /** Wakes any sleeping bot that takes a material fix, regardless of its profile. */
  wildcard?: boolean;
}

export function archetypeFlag(id: string): string {
  return `arch_${id}`;
}

const axesAtLeast = (t: Traits, min: number): number =>
  TRAIT_AXES.filter((k) => t[k] >= min).length;

/** Ordered: the first matching archetype wins (most specific first). */
export const ARCHETYPES: readonly ArchetypeDef[] = [
  {
    id: "singularitaet",
    name: tr("Pocket Singularity"),
    color: "violett",
    hex: "#8B00FF",
    need: { quantum: 10, energie: 6 },
    rule: tr("Quantum ≥ 10 and Energy ≥ 6"),
    property: tr("Twice as strong, and maximally unstable while it is at it (volatility 5)."),
    lore: tr("A hole in your pocket that looks back. Jade: “Don't drop it. Don't look at it.”"),
    fixedVolatility: 5,
    strength: 2,
  },
  {
    id: "halo_stimmgabel",
    name: tr("Halo Tuning Fork"),
    color: "violett",
    hex: "#E91E8C",
    need: { quantum: 6, resonanz: 6 },
    rule: tr("Quantum ≥ 6 and Resonance ≥ 6"),
    property: tr("Is not used up when tuning puzzles or opening hidden doors."),
    lore: tr("Strike it and something behind the wall answers. 847 Hz, to the decimal place."),
    reusable: ["stimmung", "resonanzschluessel"],
  },
  {
    id: "kohaerenz_anker",
    name: tr("Coherence Anchor"),
    color: "indigo",
    hex: "#4B3BFF",
    need: { quantum: 7, signal: 5 },
    rule: tr("Quantum ≥ 7 and Signal ≥ 5"),
    property: tr(
      "Holds coherence without decaying — not used up at the portal, the rift or the Forge.",
    ),
    lore: tr("σ-17 in one hand. The MCP calls it “irregularly reassuring”."),
    volatilityDelta: -1,
    reusable: ["kohaerenz"],
  },
  {
    id: "orakel_kern",
    name: tr("Oracle Core"),
    color: "blau",
    hex: "#0066FF",
    need: { daten: 8, quantum: 4 },
    rule: tr("Data ≥ 8 and Quantum ≥ 4"),
    property: tr("Decodes ciphers, checksums and radio messages without being used up."),
    lore: tr(
      "It computes the answer before the question is finished. Sometimes the wrong question, too.",
    ),
    reusable: ["dekodierung"],
  },
  {
    id: "sturmzelle",
    name: tr("Storm Cell"),
    color: "gelb",
    hex: "#FFB800",
    need: { energie: 9, thermik: 3 },
    rule: tr("Energy ≥ 9 and Thermal ≥ 3"),
    property: tr("Charges buffers twice as much."),
    lore: tr("Crackles in the inventory. Jade's hair stands on end, and she likes it."),
    strength: 2,
  },
  {
    id: "kuehlherz",
    name: tr("Cold Heart"),
    color: "blau",
    hex: "#66CCFF",
    need: { thermik: 8, mechanik: 2 },
    rule: tr("Thermal ≥ 8 and Mechanics ≥ 2"),
    property: tr("Always volatility 1; lowers other prototypes' volatility by 2 instead of 1."),
    lore: tr("A heat exchanger that has learned to keep the heat nobody else wants."),
    fixedVolatility: 1,
    strength: 2,
  },
  {
    id: "uhrwerk",
    name: tr("Clockwork Automaton"),
    color: "orange",
    hex: "#C4B9A0",
    need: { mechanik: 8, daten: 3 },
    rule: tr("Mechanics ≥ 8 and Data ≥ 3"),
    property: tr("Pries scrap open without a tool and never wears out doing it."),
    lore: tr("Ticks even when nobody is listening. F1N-DR would trust it."),
    reusable: ["hebel"],
  },
  {
    id: "leuchtfeuer",
    name: tr("Beacon"),
    color: "gruen",
    hex: "#00FFFF",
    need: { signal: 8, energie: 3 },
    rule: tr("Signal ≥ 8 and Energy ≥ 3"),
    property: tr("One bearing finds three slice signatures instead of one."),
    lore: tr("Transmits in every direction at once. Somewhere, a slice always answers."),
    strength: 3,
  },
  {
    id: "prismenauge",
    name: tr("Prism Eye"),
    color: "gruen",
    hex: "#AAFF00",
    need: { optik: 8, daten: 2 },
    rule: tr("Optics ≥ 8 and Data ≥ 2"),
    property: tr("Illumination covers the whole level instead of one room, and it is not used up."),
    lore: tr("It sees in colours the lab has not named yet. “Colour is memory.” — J.L."),
    strength: 2,
    reusable: ["lichtbild"],
  },
  {
    id: "resonanzgolem",
    name: tr("Resonance Golem"),
    color: "rot",
    hex: "#FF3333",
    need: { mechanik: 6, resonanz: 5 },
    rule: tr("Mechanics ≥ 6 and Resonance ≥ 5"),
    property: tr("Wakes any sleeping bot that is missing a part — no matter which."),
    lore: tr("A body made of vibration. The bots recognise one of their own in it."),
    wildcard: true,
  },
  {
    id: "glutlinse",
    name: tr("Ember Lens"),
    color: "orange",
    hex: "#FF6B00",
    need: { optik: 6, thermik: 5 },
    rule: tr("Optics ≥ 6 and Thermal ≥ 5"),
    property: tr("Every effect threshold is two points lower for it."),
    lore: tr("Focuses light until it warms, and warmth until it glows."),
    ease: 2,
  },
  {
    id: "chimaere",
    name: tr("Chimera"),
    color: "gamma",
    hex: "#E8F4FF",
    need: {},
    test: (t) => axesAtLeast(t, 4) >= 5,
    rule: tr("At least five axes ≥ 4"),
    property: tr(
      "All-purpose part: every effect threshold one point lower, every effect twice as strong.",
    ),
    lore: tr(
      "Built from too many things to be any one of them. The workbench hesitated for a moment.",
    ),
    ease: 1,
    strength: 2,
  },
  {
    id: "ruhepol",
    name: tr("Still Point"),
    color: "gruen",
    hex: "#00FF66",
    need: {},
    test: (t, _d, v) =>
      v <= 1 && traitTotal(t) >= 18 && Math.max(...TRAIT_AXES.map((k) => t[k])) <= 5,
    rule: tr("Volatility 1, total ≥ 18, no axis above 5"),
    property: tr("Cools other prototypes even without Thermal, and is not used up doing it."),
    lore: tr("A part in no hurry. Next to it, other prototypes stop trembling."),
    reusable: ["kuehlung"],
  },
  {
    id: "rekursionsknoten",
    name: tr("Recursion Node"),
    color: "infrarot",
    hex: "#7a1020",
    need: {},
    test: (_t, depth) => depth >= 4,
    rule: tr("Generation depth ≥ 4 (prototype from prototype from prototype …)"),
    property: tr("Volatility −1 and every effect threshold one point lower."),
    lore: tr("“It is never finished. That is the point.” — margin note, handwriting unclear."),
    volatilityDelta: -1,
    ease: 1,
  },
];

export const ARCHETYPE_BY_ID: ReadonlyMap<string, ArchetypeDef> = new Map(
  ARCHETYPES.map((a) => [a.id, a]),
);

/** The first archetype whose recognition rule holds for this profile. */
export function detectArchetype(
  t: Traits,
  depth: number,
  volatility: number,
): ArchetypeDef | undefined {
  return ARCHETYPES.find((a) => {
    for (const k of TRAIT_AXES) {
      const n = a.need[k];
      if (n !== undefined && t[k] < n) return false;
    }
    return !a.test || a.test(t, depth, volatility);
  });
}

/** Archetype of an item (generated prototypes only). */
export function archetypeOf(def: ItemDef | undefined): ArchetypeDef | undefined {
  return def?.archetype ? ARCHETYPE_BY_ID.get(def.archetype) : undefined;
}

// ── Explosions ───────────────────────────────────────────────────

export interface ExplosionEventDef {
  id: "verpufft" | "druckwelle" | "rueckstoss" | "blitzschmelze" | "funkenregen" | "halo_echo";
  name: string;
  text: string;
}

/**
 * What else can happen when a mix explodes. Always alongside the slag, so
 * `VOLATILITY_LIMIT` keeps its meaning; side products are only handed out
 * the first time a particular mix blows up (no farming).
 */
export const EXPLOSION_EVENTS: readonly ExplosionEventDef[] = [
  { id: "verpufft", name: tr("Fizzle"), text: tr("Just slag and the smell of ozone.") },
  {
    id: "druckwelle",
    name: tr("Shockwave"),
    text: tr("The shockwave blasts rock out of the wall: 1× Rubble."),
  },
  {
    id: "rueckstoss",
    name: tr("Recoil"),
    text: tr("A part flies out of the vessel intact and lands at your feet."),
  },
  {
    id: "blitzschmelze",
    name: tr("Flash Melt"),
    text: tr("At the core, sand has melted into glass — a fulgurite: 1× Quartz Crystal."),
  },
  {
    id: "funkenregen",
    name: tr("Shower of Sparks"),
    text: tr("Violet sparks condense on the hood: 1× Abstractum."),
  },
  {
    id: "halo_echo",
    name: tr("Halo Echo"),
    text: tr(
      "For a moment the smoke casts two shadows. A shard is left behind: 1× Halo Crystal Shard.",
    ),
  },
];

const EVENT_BY_ID = new Map(EXPLOSION_EVENTS.map((e) => [e.id, e]));

/** Deterministic side event of an explosion, keyed by the mix. */
export function explosionEvent(
  key: string,
  defs: readonly { def: ItemDef; n: number }[],
): { event: ExplosionEventDef; extras: { item: string; count: number }[] } {
  const roll = (fnv1a(`unlabs:explode:${key}`) >>> 5) % 20;
  const pick = (id: ExplosionEventDef["id"]): ExplosionEventDef => EVENT_BY_ID.get(id)!;
  if (roll <= 10) return { event: pick("verpufft"), extras: [] };
  if (roll <= 13) return { event: pick("druckwelle"), extras: [{ item: "geroell", count: 1 }] };
  if (roll <= 15) {
    const survivor = [...defs]
      .filter((d) => d.def.kind !== "relikt" && d.def.kind !== "werkzeug")
      .sort((a, b) => a.def.volatility - b.def.volatility || a.def.id.localeCompare(b.def.id))[0];
    if (survivor) {
      const e = pick("rueckstoss");
      return {
        event: {
          ...e,
          text: tr("A part flies out of the vessel intact: 1× {name}.", {
            name: survivor.def.name,
          }),
        },
        extras: [{ item: survivor.def.id, count: 1 }],
      };
    }
    return { event: pick("druckwelle"), extras: [{ item: "geroell", count: 1 }] };
  }
  if (roll <= 17)
    return { event: pick("blitzschmelze"), extras: [{ item: "quarzkristall", count: 1 }] };
  if (roll === 18)
    return { event: pick("funkenregen"), extras: [{ item: "abstractum", count: 1 }] };
  const quantum = defs.reduce((a, d) => a + d.def.traits.quantum * d.n, 0);
  return quantum >= 6
    ? { event: pick("halo_echo"), extras: [{ item: "halo_kristall", count: 1 }] }
    : { event: pick("druckwelle"), extras: [{ item: "geroell", count: 1 }] };
}

// ── Prototype effects ("Benutzen mit Prototyp …") ────────────────

export type ProtoEffectId =
  | "ladung"
  | "kuehlung"
  | "lichtbild"
  | "dekodierung"
  | "stimmung"
  | "kalibrierung"
  | "hebel"
  | "peilung"
  | "resonanzschluessel"
  | "reanimation"
  | "kohaerenz";

export interface ProtoEffectDef {
  id: ProtoEffectId;
  name: string;
  /** Minimum traits of the prototype (before archetype `ease`). Empty = see `rule`. */
  need: Partial<Traits>;
  /** Readable threshold (codex). */
  rule: string;
  /** What it can be used on. */
  targets: string;
  /** What happens. */
  effect: string;
  /** In-world hint (MCP line / codex teaser). */
  hint: string;
}

/**
 * The effect families. None is ever required for an ending — they are
 * shortcuts and side doors: an alternative way into a bot quest, a secret
 * room, a puzzle reward or an ending's missing insight.
 */
export const PROTO_EFFECTS: readonly ProtoEffectDef[] = [
  {
    id: "ladung",
    name: tr("effect::Charge"),
    need: { energie: 6 },
    rule: tr("Energy ≥ 6"),
    targets: tr("built devices"),
    effect: tr(
      "Charges a device's buffer (+10–15 W on the grid, up to 45 W). At the Nexus: an instant research cycle. At the drone: battery full.",
    ),
    hint: tr(
      "A prototype with a lot of Energy is a battery that does not know where to go. Hold it against a device.",
    ),
  },
  {
    id: "kuehlung",
    name: tr("effect::Cooling"),
    need: { thermik: 6 },
    rule: tr("Thermal ≥ 6"),
    targets: tr("other prototypes in the inventory"),
    effect: tr("Lowers another prototype's volatility by 1 (min. 1) — so it fits sensitive slots."),
    hint: tr(
      "Too restless for the blueprint? A heat-exchanger prototype takes the heat out of another one.",
    ),
  },
  {
    id: "lichtbild",
    name: tr("effect::Illumination"),
    need: { optik: 6 },
    rule: tr("Optics ≥ 6"),
    targets: tr("devices and stations in a room"),
    effect: tr(
      "Lights up the room: notes and finds that would otherwise only show up with the ventilation, a scanner or the anomaly detector become visible.",
    ),
    hint: tr(
      "Smoke, dust, anomalies — light with enough Optics sees through everything. Light up a room.",
    ),
  },
  {
    id: "dekodierung",
    name: tr("effect::Decoding"),
    need: { daten: 8 },
    rule: tr("Data ≥ 8"),
    targets: tr("ciphers, checksums, Morse, radio, keypads"),
    effect: tr("Works out a code puzzle — with the full reward."),
    hint: tr(
      "A logic core with eight points of Data cracks what you would rather not crack yourself.",
    ),
  },
  {
    id: "stimmung",
    name: tr("effect::Tuning"),
    need: { resonanz: 8 },
    rule: tr("Resonance ≥ 8"),
    targets: tr("tone, Lissajous, sigil, time and era puzzles"),
    effect: tr("Vibrates a resonance puzzle into its solution."),
    hint: tr("Some locks are tuning forks. A resonator with eight points strikes the right note."),
  },
  {
    id: "kalibrierung",
    name: tr("effect::Calibration"),
    need: {},
    rule: tr(
      "matching axis ≥ 8 (Optics: laser/colour/stencil/layers · Thermal: heat/coolant · Mechanics: pipes/clamp/soldering/wiring)",
    ),
    targets: tr("physical puzzles"),
    effect: tr("Adjusts a physical puzzle automatically."),
    hint: tr(
      "A prototype with eight points on the right axis calibrates lasers, heat and mechanics by itself.",
    ),
  },
  {
    id: "hebel",
    name: tr("effect::Leverage"),
    need: { mechanik: 6 },
    rule: tr("Mechanics ≥ 6"),
    targets: tr("half-salvaged scrap piles"),
    effect: tr("Gets the rest out of a pile you would otherwise need a tool for."),
    hint: tr("No tool? An actuator with Mechanics ≥ 6 is also a crowbar."),
  },
  {
    id: "peilung",
    name: tr("effect::Bearing"),
    need: { signal: 6 },
    rule: tr("Signal ≥ 6"),
    targets: tr("devices and stations"),
    effect: tr("Takes a bearing on the nearest slice signature not yet found (room and level)."),
    hint: tr("The slices hum at 847 Hz. A transceiver with Signal ≥ 6 hears them through walls."),
  },
  {
    id: "resonanzschluessel",
    name: tr("effect::Resonance Key"),
    need: { resonanz: 5, quantum: 5 },
    rule: tr("Resonance ≥ 5 and Quantum ≥ 5"),
    targets: tr("hidden doors, the crystal curtain"),
    effect: tr("Opens a secret door without a scanner or laser."),
    hint: tr("The hollow walls resonate. Resonance and Quantum together find the seam."),
  },
  {
    id: "reanimation",
    name: tr("effect::Reanimation"),
    need: {},
    rule: tr("the profile of the missing part (e.g. Signal ≥ 6 instead of an antenna)"),
    targets: tr("sleeping bots that are missing a part"),
    effect: tr(
      "Wakes the bot with a prototype instead of the expected part — the reward stays the same.",
    ),
    hint: tr("Bots are not picky. A prototype that feels like the missing part will do."),
  },
  {
    id: "kohaerenz",
    name: tr("effect::Coherence"),
    need: { quantum: 8, resonanz: 3 },
    rule: tr("Quantum ≥ 8 and Resonance ≥ 3"),
    targets: tr("teleport portal, dimensional rift, Infinity Forge"),
    effect: tr(
      "Portal: hold σ-17. Rift: measure the membrane. Forge: read the Halo state — each an insight that otherwise needs other paths.",
    ),
    hint: tr(
      "A qubit node with Quantum ≥ 8 holds coherence. Portal, rift and Forge respond to it.",
    ),
  },
];

export const PROTO_EFFECT_BY_ID: ReadonlyMap<ProtoEffectId, ProtoEffectDef> = new Map(
  PROTO_EFFECTS.map((e) => [e.id, e]),
);

/** Does a prototype reach these thresholds, after its archetype's `ease`? */
export function reaches(def: ItemDef, need: Partial<Traits>): boolean {
  const ease = archetypeOf(def)?.ease ?? 0;
  for (const k of TRAIT_AXES) {
    const n = need[k];
    if (n !== undefined && def.traits[k] < n - ease) return false;
  }
  return true;
}

/**
 * Effect families a prototype qualifies for by traits alone (targets aside)
 * — for the "Taugt für: …" line after a combination and the inventory.
 */
export function prototypeAffordances(def: ItemDef): ProtoEffectId[] {
  if (def.kind !== "prototyp") return [];
  const arch = archetypeOf(def);
  const out: ProtoEffectId[] = [];
  for (const e of PROTO_EFFECTS) {
    if (e.id === "kalibrierung") {
      if (["optik", "thermik", "mechanik"].some((k) => reaches(def, { [k]: 8 }))) out.push(e.id);
    } else if (e.id === "reanimation") {
      if (arch?.wildcard || BOT_PROFILES.some((b) => reaches(def, b.need))) out.push(e.id);
    } else if (e.id === "kuehlung") {
      if (reaches(def, e.need) || arch?.id === "ruhepol") out.push(e.id);
    } else if (reaches(def, e.need)) out.push(e.id);
  }
  return out;
}

/** Puzzle kind → the axis a prototype calibrates it with (and its family). */
export const PUZZLE_AXIS: Readonly<
  Partial<Record<string, { axis: TraitAxis; family: ProtoEffectId }>>
> = {
  cipher: { axis: "daten", family: "dekodierung" },
  crc: { axis: "daten", family: "dekodierung" },
  morse: { axis: "daten", family: "dekodierung" },
  radio: { axis: "daten", family: "dekodierung" },
  keypad: { axis: "daten", family: "dekodierung" },
  tones: { axis: "resonanz", family: "stimmung" },
  lissajous: { axis: "resonanz", family: "stimmung" },
  sigils: { axis: "resonanz", family: "stimmung" },
  temporal: { axis: "resonanz", family: "stimmung" },
  era: { axis: "resonanz", family: "stimmung" },
  laser: { axis: "optik", family: "kalibrierung" },
  hue: { axis: "optik", family: "kalibrierung" },
  palette: { axis: "optik", family: "kalibrierung" },
  stencil: { axis: "optik", family: "kalibrierung" },
  layers: { axis: "optik", family: "kalibrierung" },
  heat: { axis: "thermik", family: "kalibrierung" },
  coolant: { axis: "thermik", family: "kalibrierung" },
  pipes: { axis: "mechanik", family: "kalibrierung" },
  valve: { axis: "mechanik", family: "kalibrierung" },
  clamp: { axis: "mechanik", family: "kalibrierung" },
  solder: { axis: "mechanik", family: "kalibrierung" },
  wiring: { axis: "mechanik", family: "kalibrierung" },
  // arbitrage, ethics, memetic, trend: questions no prototype answers.
};

/** Threshold on the puzzle's axis. */
export const PUZZLE_BYPASS_MIN = 8;

/**
 * Sleeping bots whose quest is a missing part — and the trait profile a
 * prototype needs to stand in for that part. (F1N-DR, W2-REK and C8-BR41N
 * need a device or the handshake, not a part.)
 */
const partName = (item: string, n = 1): string => {
  const name = ITEM_BY_ID.get(item)?.name ?? item;
  return n > 1 ? `${n}× ${name}` : name;
};

export const BOT_PROFILES: readonly { npc: string; need: Partial<Traits>; part: string }[] = [
  { npc: "x0r8t", need: { signal: 6 }, part: partName("antenne") },
  { npc: "l0g1k", need: { daten: 7, signal: 2 }, part: partName("steuermodul") },
  { npc: "p1ndr0", need: { optik: 4, signal: 4 }, part: partName("glasfaser") },
  { npc: "r3tr0", need: { optik: 4, daten: 4 }, part: partName("display") },
  { npc: "b4c0n", need: { energie: 7 }, part: partName("batteriezelle") },
  { npc: "d3c4d3", need: { optik: 6 }, part: partName("linse") },
  { npc: "k2ldr", need: { daten: 9 }, part: partName("speicherchip", 2) },
];

// ── Codex exports ────────────────────────────────────────────────

export interface ArchetypeCodexEntry {
  id: string;
  name: string;
  hex: string;
  color: SpectrumColor;
  discovered: boolean;
  /** Shown only once discovered; "???" before. */
  rule: string;
  property: string;
  lore: string;
}

/**
 * Codex list of named archetypes. Undiscovered entries keep their slot but
 * hide name details, so the list teases how many are left.
 */
export function archetypeCodex(flags: Readonly<Record<string, boolean>>): ArchetypeCodexEntry[] {
  return ARCHETYPES.map((a) => {
    const discovered = !!flags[archetypeFlag(a.id)];
    return {
      id: a.id,
      name: discovered ? a.name : tr("Unknown archetype"),
      hex: a.hex,
      color: a.color,
      discovered,
      rule: discovered ? a.rule : "???",
      property: discovered ? a.property : "???",
      lore: discovered ? a.lore : "",
    };
  });
}

export interface ProtoEffectCodexEntry extends ProtoEffectDef {
  /** Used at least once (flag `proto_effect_<id>`). */
  used: boolean;
}

/** Codex list of prototype effect families (all visible — they are the hints). */
export function protoEffectCodex(
  flags: Readonly<Record<string, boolean>>,
): ProtoEffectCodexEntry[] {
  return PROTO_EFFECTS.map((e) => ({ ...e, used: !!flags[`proto_effect_${e.id}`] }));
}

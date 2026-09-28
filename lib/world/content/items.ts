import { traits } from "@/lib/world/traits";
import { tr } from "@/lib/i18n";
import type { ItemDef, ItemKind, SpectrumColor, Traits } from "@/lib/world/types";

function item(
  id: string,
  name: string,
  kind: ItemKind,
  t: Partial<Traits>,
  color: SpectrumColor,
  volatility: number,
  description: string,
): ItemDef {
  return { id, name, kind, traits: traits(t), color, volatility, depth: 0, description };
}

/**
 * Authored items. Resources follow the eight-resource model of the
 * economy docs (Abstractum → alloys → nanomaterial → exotic matter →
 * antimatter); components are salvage from a lab dormant for 2,561 days.
 */
export const ITEMS: readonly ItemDef[] = [
  // ── Rohstoffe ────────────────────────────────────────────────
  item(
    "abstractum",
    "Abstractum",
    "rohstoff",
    { energie: 2, quantum: 1, resonanz: 1 },
    "violett",
    2,
    tr("Raw exotic from the geothermal seep valve. Hums when you hold it."),
  ),
  item(
    "energiezelle",
    tr("Energy Cell"),
    "rohstoff",
    { energie: 5 },
    "gelb",
    1,
    tr("Three units of Abstractum pressed into a cell. 100 E of charge."),
  ),
  item(
    "basislegierung",
    tr("Base Alloy"),
    "rohstoff",
    { mechanik: 5, thermik: 2 },
    "orange",
    1,
    tr("The first refined material. Heavy, honest, boring."),
  ),
  item(
    "hochlegierung",
    tr("High Alloy"),
    "rohstoff",
    { mechanik: 7, thermik: 3, energie: 1 },
    "rot",
    1,
    tr("Two ingots of Base Alloy, compacted under current."),
  ),
  item(
    "nanomaterial",
    "Nanomaterial",
    "rohstoff",
    { optik: 4, mechanik: 4, daten: 2, quantum: 2 },
    "gruen",
    2,
    tr("A lithographically grown lattice. Under the microscope it looks like writing."),
  ),
  item(
    "exotische_materie",
    tr("Exotic Matter"),
    "rohstoff",
    { quantum: 7, energie: 4 },
    "indigo",
    4,
    tr("Mass that cannot decide whether it is there."),
  ),
  item(
    "antimaterie",
    tr("Antimatter"),
    "rohstoff",
    { energie: 10, quantum: 8 },
    "gamma",
    5,
    tr("A vial of nothing that weighs a great deal. Do not shake."),
  ),

  // ── Bauteile (Bergungsgut) ───────────────────────────────────
  item(
    "schraubensatz",
    tr("Screw Set"),
    "bauteil",
    { mechanik: 2 },
    "orange",
    1,
    tr("Phillips, Torx, one mysterious triangle-head screw."),
  ),
  item(
    "gehaeuseplatte",
    tr("Housing Plate"),
    "bauteil",
    { mechanik: 3, thermik: 1 },
    "orange",
    1,
    tr("Brushed sheet metal with rivet holes."),
  ),
  item(
    "kupferspule",
    tr("Copper Coil"),
    "bauteil",
    { energie: 3, signal: 1, resonanz: 1 },
    "orange",
    1,
    tr("Hand-wound. Somebody kept count: 847 turns."),
  ),
  item(
    "kondensator",
    tr("Capacitor"),
    "bauteil",
    { energie: 4 },
    "gelb",
    2,
    tr("Electrolytic, slightly bulging. Holds anyway."),
  ),
  item(
    "platine",
    tr("Circuit Board"),
    "bauteil",
    { daten: 3, signal: 1 },
    "gruen",
    1,
    tr("Hand-soldered. On the edge: “J.L. '03”."),
  ),
  item(
    "speicherchip",
    tr("Memory Chip"),
    "bauteil",
    { daten: 4 },
    "blau",
    1,
    tr("SPD stamp: 2019-02-13."),
  ),
  item(
    "kabelbaum",
    tr("Wiring Harness"),
    "bauteil",
    { energie: 1, signal: 2 },
    "rot",
    1,
    tr("Color-coded by a system only Damien understood."),
  ),
  item(
    "luefter",
    tr("Fan"),
    "bauteil",
    { thermik: 3, mechanik: 1 },
    "blau",
    1,
    tr("One blade missing. Spins anyway."),
  ),
  item(
    "kuehlrippe",
    tr("Heat Sink"),
    "bauteil",
    { thermik: 4 },
    "blau",
    1,
    tr("Aluminum comb, still with thermal paste on it."),
  ),
  item(
    "linse",
    tr("Lens"),
    "bauteil",
    { optik: 3 },
    "gamma",
    1,
    tr("Plano-convex, with a scratch right at the focal point."),
  ),
  item(
    "prisma",
    tr("Prism"),
    "bauteil",
    { optik: 3, resonanz: 1 },
    "gamma",
    1,
    tr("“Color is memory.” — written in pencil on the case."),
  ),
  item(
    "quarzkristall",
    tr("Quartz Crystal"),
    "bauteil",
    { resonanz: 3, signal: 1 },
    "violett",
    1,
    tr("Oscillates at 32.768 kHz. And sometimes at other frequencies."),
  ),
  item(
    "magnet",
    tr("Neodymium Magnet"),
    "bauteil",
    { mechanik: 1, energie: 1, quantum: 1 },
    "rot",
    1,
    tr("Sticks to everything. Even to things that are not magnetic."),
  ),
  item(
    "sensorkopf",
    tr("Sensor Head"),
    "bauteil",
    { signal: 3, daten: 1 },
    "gruen",
    1,
    tr("Quad probe, calibration date expired."),
  ),
  item(
    "antenne",
    tr("Antenna"),
    "bauteil",
    { signal: 4 },
    "gruen",
    1,
    tr("Telescopic antenna from an old world-band receiver."),
  ),
  item(
    "membran",
    tr("Speaker Diaphragm"),
    "bauteil",
    { resonanz: 3, mechanik: 1 },
    "rot",
    1,
    tr("Waxed paper. Smells of 1988."),
  ),
  item(
    "oszillator",
    tr("Oscillator"),
    "bauteil",
    { signal: 2, resonanz: 3 },
    "violett",
    1,
    tr("Quartz-stabilized, frequency corrected by hand."),
  ),
  item(
    "laserdiode",
    tr("Laser Diode"),
    "bauteil",
    { optik: 4, energie: 2 },
    "rot",
    2,
    tr("Class 3B. The warning label has been crossed out."),
  ),
  item(
    "servo",
    tr("Servo Motor"),
    "bauteil",
    { mechanik: 4, energie: 1 },
    "orange",
    1,
    tr("Brass gears."),
  ),
  item(
    "display",
    "Display",
    "bauteil",
    { daten: 2, optik: 2 },
    "gruen",
    1,
    tr("Green phosphor. One pixel is permanently burned in."),
  ),
  item(
    "batteriezelle",
    tr("Battery Cell"),
    "bauteil",
    { energie: 5 },
    "gelb",
    2,
    tr("18650, remaining charge unknown."),
  ),
  item(
    "supraleiter",
    tr("Superconductor Tape"),
    "bauteil",
    { energie: 3, quantum: 3 },
    "blau",
    3,
    tr("Must stay cold. Very cold."),
  ),
  item(
    "qubit_chip",
    tr("Qubit Chip"),
    "bauteil",
    { quantum: 5, daten: 2 },
    "indigo",
    3,
    tr("Labeled “σ-12”. Crossed out. “σ-17”."),
  ),
  item(
    "filterpatrone",
    tr("HEPA Filter Cartridge"),
    "bauteil",
    { thermik: 1, mechanik: 2 },
    "gamma",
    1,
    tr("Gray with dust. The dust glitters."),
  ),
  item(
    "duese",
    tr("Print Nozzle"),
    "bauteil",
    { mechanik: 2, thermik: 2 },
    "orange",
    1,
    tr("0.4 mm, hardened steel."),
  ),
  item(
    "thermoelement",
    tr("Thermocouple"),
    "bauteil",
    { thermik: 3, signal: 1 },
    "rot",
    1,
    tr("Type K. Measures up to 1,260 °C."),
  ),
  item(
    "plasmaring",
    tr("Plasma Ring"),
    "bauteil",
    { energie: 5, thermik: 4, quantum: 1 },
    "gelb",
    3,
    tr("Toroidal magnet coil from the reactor store."),
  ),
  item(
    "rotor",
    tr("Rotor Blade Set"),
    "bauteil",
    { mechanik: 3, energie: 1 },
    "gruen",
    1,
    tr("Four carbon blades for a drone."),
  ),
  item(
    "glasfaser",
    tr("Fiber Bundle"),
    "bauteil",
    { optik: 2, signal: 2, daten: 1 },
    "blau",
    1,
    tr("Glows at the ends even though nothing is connected."),
  ),
  item(
    "zahnrad",
    tr("Brass Gear"),
    "bauteil",
    { mechanik: 3 },
    "gelb",
    1,
    tr("From an old grandfather clock. 60 teeth."),
  ),

  // ── Werkzeug ─────────────────────────────────────────────────
  item(
    "schraubendreher",
    tr("Screwdriver"),
    "werkzeug",
    { mechanik: 2 },
    "rot",
    1,
    tr("Jade's favorite tool. Worn grip."),
  ),
  item(
    "rahmen",
    tr("Chassis Frame"),
    "bauteil",
    { mechanik: 8, thermik: 1 },
    "orange",
    1,
    tr("Bolted base frame for any device."),
  ),
  item(
    "induktor",
    tr("Inductor"),
    "bauteil",
    { energie: 5, quantum: 1, resonanz: 1 },
    "rot",
    1,
    tr("Coil around a magnetic core. Hums at 50 Hz."),
  ),
  item(
    "steuermodul",
    tr("Control Module"),
    "bauteil",
    { daten: 6, signal: 2 },
    "blau",
    1,
    tr("Circuit board + memory. Boots in 0.3 seconds."),
  ),
  item(
    "kuehlblock",
    tr("Cooling Block"),
    "bauteil",
    { thermik: 8, mechanik: 1 },
    "blau",
    1,
    tr("Fan on a heat sink. A classic."),
  ),
  item(
    "optikbank",
    tr("Optical Bench"),
    "bauteil",
    { optik: 7, resonanz: 1, mechanik: 1 },
    "gamma",
    1,
    tr("Lens and prism aligned on a rail."),
  ),
  item(
    "resonanzkammer",
    tr("Resonance Chamber"),
    "bauteil",
    { resonanz: 7, signal: 3 },
    "violett",
    1,
    tr("Quartz, oscillator, diaphragm — it sings softly."),
  ),
  item(
    "sendeempfaenger",
    tr("Transceiver"),
    "bauteil",
    { signal: 8, daten: 1 },
    "gruen",
    1,
    tr("Antenna plus sensor head. Hears more than is being sent."),
  ),

  // ── Relikte ──────────────────────────────────────────────────
  item(
    "synapsis_splitter",
    tr("Synapsis Shard"),
    "relikt",
    { resonanz: 4, quantum: 3, daten: 3 },
    "indigo",
    3,
    tr("Fragment of a Synapsis headset. Inside: “D.F. 94.8 %”."),
  ),
  item(
    "halo_staub",
    tr("Halo Dust (X9-DUST)"),
    "relikt",
    { quantum: 4, resonanz: 4 },
    "gamma",
    5,
    tr("Non-terrestrial dust. Under the microscope: THE HALO EXPANDS."),
  ),
  item(
    "kristall_0089",
    tr("Crystal #0089"),
    "relikt",
    { quantum: 5, daten: 5, resonanz: 3 },
    "blau",
    3,
    tr("30 slices, one of them warm. Jade's consciousness interface."),
  ),
  item(
    "anomaler_kern",
    tr("Anomalous Core"),
    "relikt",
    { quantum: 6, energie: 4, resonanz: 2 },
    "violett",
    4,
    tr("A tamed anomaly. It listens now."),
  ),
  item(
    "damien_band",
    tr("Damien's Tape #0512"),
    "relikt",
    { resonanz: 3, daten: 4, signal: 2 },
    "orange",
    1,
    tr("Labeled: “Four tones. Four coordinates.”"),
  ),
  item(
    "x0r8t_paket",
    tr("X0-R8T Packet 847"),
    "relikt",
    { signal: 5, daten: 3, resonanz: 2 },
    "gruen",
    2,
    tr("The last of the 847 reply packets. Addressed to: no one."),
  ),

  item(
    "slice_0089",
    tr("Slice of Crystal #0089"),
    "relikt",
    { quantum: 2, daten: 2, resonanz: 2 },
    "blau",
    2,
    tr(
      "An _unSLC — one of thirty slices. Wafer-thin, lukewarm, humming at 847 Hz. Thirty facets of a single moment.",
    ),
  ),
  item(
    "sternkarte",
    tr("Star Chart (ASCII)"),
    "relikt",
    { optik: 3, daten: 3, signal: 2 },
    "violett",
    1,
    tr(
      "D3-C4D3 set the sky above the lab in characters. One star is marked “0x89”. It is not in any catalog.",
    ),
  ),
  item(
    "tonband_frequenz",
    tr("Tape “Frequency”"),
    "relikt",
    { daten: 3, signal: 3, resonanz: 2 },
    "orange",
    1,
    tr(
      "Hand-labeled: “F1N-DR RELAY · Day 13,149”. Recorded long after the lab had been abandoned.",
    ),
  ),
  item(
    "notizbuch_blau",
    tr("Notebook with a Blue Cover"),
    "relikt",
    { daten: 3, resonanz: 3 },
    "blau",
    1,
    tr(
      "Cottbus, winter 1989. Two handwritings take turns. Last page: “Consciousness is not what you remember. It is the fact that you are remembering.”",
    ),
  ),
  item(
    "x9_speicherkern",
    tr("X9-DUST Memory Core"),
    "relikt",
    { daten: 6, quantum: 3, resonanz: 2 },
    "gamma",
    3,
    tr(
      "Xenomorphic encoding: it shows every reader different data. To the naked eye, only a timestamp — 03:41:22. What it really shows, only an analyzer can read.",
    ),
  ),
  item(
    "leuchtalgen",
    tr("Glow Algae Culture"),
    "rohstoff",
    { energie: 2, optik: 2, resonanz: 1 },
    "gruen",
    1,
    tr("From the greenhouse. Seven years without care, and they glow brighter than before."),
  ),
  item(
    "myzel",
    tr("Mycelium Mesh"),
    "rohstoff",
    { signal: 2, daten: 2, mechanik: 1 },
    "gelb",
    1,
    tr("Fungal threads that grew along the cable trays. They conduct. They conduct very well."),
  ),
  item(
    "kaffeebohnen",
    tr("Coffee Beans (2019 Harvest)"),
    "rohstoff",
    { energie: 1, thermik: 2 },
    "orange",
    1,
    tr("From Damien's shrub in the greenhouse. He called it “control group”."),
  ),
  item(
    "kaffee",
    tr("Coffee from the Singularity Bus"),
    "rohstoff",
    { energie: 4, thermik: 3, quantum: 1 },
    "orange",
    2,
    tr("Tastes of ozone and 2019. The machine is still hooked up to the Singularity Bus."),
  ),
  item(
    "lichtleiter",
    tr("Bio Light Guide"),
    "bauteil",
    { optik: 5, signal: 2, energie: 1 },
    "gruen",
    1,
    tr("Glow algae in optical fiber. Glows without power, flickers near anomalies."),
  ),
  item(
    "myzelplatine",
    tr("Mycelium Circuit Board"),
    "bauteil",
    { daten: 5, signal: 3, resonanz: 1 },
    "gelb",
    1,
    tr("A circuit board overgrown with mycelium. Computes more slowly, but with opinions."),
  ),
  item(
    "halo_kristall",
    tr("Halo Crystal Shard"),
    "rohstoff",
    { quantum: 5, resonanz: 4, optik: 2 },
    "indigo",
    4,
    tr("From the cave beneath the Shaft, where the membrane is thin. It casts two shadows."),
  ),
  item(
    "geroell",
    tr("Rubble"),
    "rohstoff",
    { mechanik: 3, thermik: 1 },
    "infrarot",
    1,
    tr("Broken rock from the collapsed Shaft. Contains ore — and chalk marks."),
  ),

  // ── Schlacke ─────────────────────────────────────────────────
  item(
    "schlacke",
    tr("Slag"),
    "schlacke",
    { mechanik: 1, thermik: 1 },
    "infrarot",
    1,
    tr("The result of a combination that fought back. Smells of ozone."),
  ),
];

export const ITEM_BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((i) => [i.id, i]));

/**
 * Explicit recipes. Inputs are a multiset; order does not matter. Anything
 * that is not a recipe still combines — into a generated prototype.
 */
export interface Recipe {
  inputs: Record<string, number>;
  output: string;
  count: number;
  /** Device that must be online for the recipe to work. */
  station?: string;
  /** Research topic (NXS-01) that must be completed before the recipe works. */
  research?: string;
  /**
   * Hidden recipe: not listed anywhere until the player stumbles on it at
   * the workbench (the handbook shows it once it is in `recipesKnown`).
   */
  secret?: boolean;
  note: string;
}

export const RECIPES: readonly Recipe[] = [
  {
    inputs: { abstractum: 3 },
    output: "energiezelle",
    count: 1,
    note: tr("Energy Cell: 3 Abstractum → 100 E"),
  },
  {
    inputs: { abstractum: 3, energiezelle: 1 },
    output: "basislegierung",
    count: 1,
    note: tr("Base Alloy"),
  },
  {
    inputs: { basislegierung: 2, energiezelle: 1 },
    output: "hochlegierung",
    count: 1,
    note: tr("High Alloy"),
  },
  {
    inputs: { hochlegierung: 2, energiezelle: 2, linse: 1 },
    output: "nanomaterial",
    count: 1,
    station: "LCT-001",
    note: tr("Interference lithography"),
  },
  {
    inputs: { nanomaterial: 1, hochlegierung: 2, energiezelle: 2 },
    output: "exotische_materie",
    count: 2,
    station: "EMC-001",
    note: tr("Exotic Matter"),
  },
  {
    inputs: { exotische_materie: 4, nanomaterial: 2 },
    output: "antimaterie",
    count: 1,
    station: "QSM-001",
    note: tr("Antimatter vial"),
  },
  {
    inputs: { schraubensatz: 2, gehaeuseplatte: 1 },
    output: "rahmen",
    count: 1,
    note: tr("Chassis Frame"),
  },
  { inputs: { kupferspule: 1, magnet: 1 }, output: "induktor", count: 1, note: tr("Inductor") },
  {
    inputs: { platine: 1, speicherchip: 1 },
    output: "steuermodul",
    count: 1,
    note: tr("Control Module"),
  },
  {
    inputs: { luefter: 1, kuehlrippe: 1 },
    output: "kuehlblock",
    count: 1,
    note: tr("Cooling Block"),
  },
  { inputs: { linse: 1, prisma: 1 }, output: "optikbank", count: 1, note: tr("Optical Bench") },
  {
    inputs: { quarzkristall: 1, oszillator: 1, membran: 1 },
    output: "resonanzkammer",
    count: 1,
    note: tr("Resonance Chamber"),
  },
  {
    inputs: { antenne: 1, sensorkopf: 1 },
    output: "sendeempfaenger",
    count: 1,
    note: tr("Transceiver"),
  },
  { inputs: { batteriezelle: 2 }, output: "energiezelle", count: 2, note: tr("Repack cells") },
  {
    inputs: { leuchtalgen: 1, glasfaser: 1 },
    output: "lichtleiter",
    count: 1,
    note: tr("Bio Light Guide (greenhouse note)"),
  },
  {
    inputs: { myzel: 1, platine: 1 },
    output: "myzelplatine",
    count: 1,
    note: tr("Mycelium Circuit Board (L0G-1K: “Proof delivered.”)"),
  },
  {
    inputs: { kaffeebohnen: 2, thermoelement: 1 },
    output: "kaffee",
    count: 2,
    note: tr("Coffee, Singularity Bus roast"),
  },
  { inputs: { geroell: 3 }, output: "basislegierung", count: 1, note: tr("Ore from the Shaft") },
  {
    inputs: { halo_kristall: 2, supraleiter: 1 },
    output: "exotische_materie",
    count: 1,
    station: "AND-001",
    note: tr("Compress Halo crystal (C8-BR41N)"),
  },
  // ── Nexus-Forschung (NXS-01) ─────────────────────────────────
  {
    inputs: { schlacke: 3 },
    output: "basislegierung",
    count: 1,
    research: "rueckgewinnung",
    note: tr("Slag recovery (Nexus research)"),
  },
  {
    inputs: { halo_kristall: 1, steuermodul: 1, quarzkristall: 1 },
    output: "synapsis_splitter",
    count: 1,
    station: "NXS-01",
    research: "synapsis",
    note: tr("Synapsis reconstruction (Nexus research)"),
  },
  {
    inputs: { halo_kristall: 2, energiezelle: 2 },
    output: "anomaler_kern",
    count: 1,
    station: "AND-001",
    research: "anomalie",
    note: tr("Anomaly synthesis (Nexus research)"),
  },
  // ── Geheime Rezepte (nur durch Ausprobieren) ─────────────────
  {
    inputs: { leuchtalgen: 1, prisma: 1 },
    output: "lichtleiter",
    count: 2,
    secret: true,
    note: tr("Algae prism: the light sorts itself (“Color is memory.” — J.L.)"),
  },
  {
    inputs: { myzel: 2, speicherchip: 1 },
    output: "myzelplatine",
    count: 2,
    secret: true,
    note: tr("Mycelium net: the mesh copies the chip's traces — twice"),
  },
  {
    inputs: { halo_kristall: 1, prisma: 1 },
    output: "quarzkristall",
    count: 2,
    secret: true,
    note: tr("Two shadows: the Halo shard refracts into quartz in the prism"),
  },
  {
    inputs: { geroell: 2, magnet: 1 },
    output: "schraubensatz",
    count: 2,
    secret: true,
    note: tr("Magnetic separator: screws from the Shaft rubble (O4-KR0N method)"),
  },
  {
    inputs: { kaffee: 1, leuchtalgen: 1 },
    output: "kaffeebohnen",
    count: 3,
    secret: true,
    note: tr("Algae fertilizer: the coffee shrub bears fruit again (greenhouse secret)"),
  },
  {
    inputs: { myzel: 1, schlacke: 1 },
    output: "geroell",
    count: 2,
    secret: true,
    note: tr("Mycelium eats slag: what exploded turns back into rock"),
  },
  {
    inputs: { geroell: 2, linse: 1 },
    output: "halo_kristall",
    count: 1,
    secret: true,
    note: tr("Dust sample: under the lens, the rubble reveals a shard that casts two shadows"),
  },
];

/** Hidden recipes (see `Recipe.secret`). */
export const SECRET_RECIPES: readonly Recipe[] = RECIPES.filter((r) => r.secret);

/**
 * Unique pieces the player must never lose to an experiment: tools and
 * one-of-a-kind relics. They never fill a slot by traits alone and never go
 * onto the workbench — only a slot that names them explicitly takes them.
 */
export const PROTECTED_ITEMS: ReadonlySet<string> = new Set([
  "schraubendreher",
  "kristall_0089",
  "anomaler_kern",
  "damien_band",
  "x0r8t_paket",
  "sternkarte",
  "tonband_frequenz",
  "notizbuch_blau",
  "x9_speicherkern",
  // Slices of Crystal #0089 are collected and traded, never used up: no build
  // slot, no workbench, no disassembly (merging/splitting is the terminal's job).
  "slice_0089",
]);

/** The collectible: 30 slices of Crystal #0089 (`_unSLC`). */
export const SLICE_ITEM = "slice_0089";
export const SLICE_TOTAL = 30;

/** Canonical multiset key: "a×2+b×1" sorted by id. */
export function comboKey(inputs: Record<string, number>): string {
  return Object.keys(inputs)
    .filter((k) => (inputs[k] ?? 0) > 0)
    .sort()
    .map((k) => `${k}×${inputs[k]}`)
    .join("+");
}

export const RECIPE_BY_KEY: ReadonlyMap<string, Recipe> = new Map(
  RECIPES.map((r) => [comboKey(r.inputs), r]),
);

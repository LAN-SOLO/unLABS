/**
 * Archive entries on floor 5 — L−4 Shaft (see ./types.ts for the rules).
 * German in lib/i18n/de/archive-f45.ts.
 *
 * Rooms: shaft station, shaft bottom, X9-DUST chamber, rubble tunnel, Halo
 * crystal cave, C8-BR41N's hideout, collapse site, borehole #1. The deepest
 * secrets of the lab sit here — kept at tier 4–5.
 */
import { tr } from "@/lib/i18n";
import type { ArchiveEntry } from "@/lib/world/content/archive/types";

export const ARCHIVE_FLOOR_5: readonly ArchiveEntry[] = [
  // ── Tier 1: in plain sight ──────────────────────────────────────
  {
    id: "a5_shaft_safety",
    tier: 1,
    value: 2,
    topic: "doors",
    title: tr("Shaft safety rules −4"),
    text: tr(
      "SHAFT SAFETY — LEVEL −4\n1. Rubble slides back. Heaps refill. Take all you like.\n2. X9 chamber: welded shut. A scanner finds the bolts, a laser cuts them.\n3. Crystal curtain: it gives way where the Anomaly Detector says it does.\n4. Nobody down here but us.",
    ),
    find: "read",
    at: { decor: "decor:aufzug5:p35" },
    about: [
      { kind: "door", id: "d_x9kammer" },
      { kind: "door", id: "d_hoehle" },
      { kind: "device", id: "AND-001" },
    ],
  },
  {
    id: "a5_hot_zone",
    tier: 1,
    value: 2,
    topic: "items",
    title: tr("Hot zone notice"),
    text: tr(
      "CAUTION — BOREHOLE #1\n847 m, 212 °C. Sealed 1997.\nDrill head store: plasma rings and thermocouples (spares for anything that burns hot).",
    ),
    find: "read",
    at: { decor: "decor:aufzug5:p36" },
    about: [
      { kind: "room", id: "bohrung" },
      { kind: "item", id: "plasmaring" },
    ],
  },
  {
    id: "a5_tally_f1ndr",
    tier: 1,
    value: 2,
    topic: "bots",
    title: tr("Day tally in chalk"),
    text: tr(
      "Rows of tally marks, neat bundles of five, ending at 13,149.\nUnderneath: “Borehole #1, east. I walk there when my clock is right. My clock is not right. — F1N-DR”",
    ),
    by: "F1N-DR",
    find: "read",
    at: { decor: "decor:sohle:a4" },
    about: [
      { kind: "npc", id: "f1ndr" },
      { kind: "device", id: "CLK-001" },
    ],
  },
  {
    id: "a5_collapse_parts",
    tier: 1,
    value: 1,
    topic: "lore",
    title: tr("T6-GR1M, addendum"),
    text: tr(
      "Stencilled below the report:\nGEN 6 SURVIVORS: 1 (T6-GR1M).\nThe others are still here. Their parts fit everyone after them. Be polite when you take them.",
    ),
    by: "T6-GR1M",
    find: "read",
    at: { note: "n_truemmer_2009" },
    about: [{ kind: "room", id: "truemmer" }],
  },

  // ── Tier 2: tucked away ─────────────────────────────────────────
  {
    id: "a5_rubble_magnet",
    tier: 2,
    value: 3,
    topic: "combine",
    title: tr("Chalk: the O4-KR0N method"),
    text: tr(
      "Chalk on a beam, blocky capitals:\nTWO HANDFULS OF RUBBLE PAST A MAGNET. WHAT STICKS IS SCREWS. TWO SETS.\n— O4-KR0N WAS HERE",
    ),
    by: "O4-KR0N",
    find: "read",
    at: { decor: "decor:sohle:p2" },
    about: [{ kind: "recipe", id: "geroell×2+magnet×1" }],
  },
  {
    id: "a5_x9_haze",
    tier: 2,
    value: 2,
    topic: "devices",
    title: tr("Chamber warning"),
    text: tr(
      "RADIATION? NO. DUST.\nThe haze in this chamber never settles on its own. Run the Ventilation System (VNT-001) before you search — whatever lies in the dust stays hidden in the haze.",
    ),
    find: "read",
    at: { decor: "decor:x9kammer:a6" },
    about: [
      { kind: "device", id: "VNT-001" },
      { kind: "room", id: "x9kammer" },
    ],
  },
  {
    id: "a5_c8_prompt",
    tier: 2,
    value: 2,
    topic: "bots",
    title: tr("The line that keeps coming back"),
    text: tr(
      "The old terminal blinks one line, over and over:\nDO YOU HEAR THE FREQUENCY TOO?\nBelow, in the boot log: HANDSHAKE REQUIRED · SOURCE: SYNTHESIZER, SIGNAL LAB (L−2).",
    ),
    by: "C8-BR41N",
    find: "read",
    at: { decor: "decor:c8versteck:a4" },
    about: [
      { kind: "npc", id: "c8br41n" },
      { kind: "device", id: "HMS-001" },
      { kind: "puzzle", id: "pz_tones" },
    ],
  },
  {
    id: "a5_gauge_zones",
    tier: 2,
    value: 3,
    topic: "puzzles",
    title: tr("Green zones on the gauges"),
    text: tr(
      "Green tape on the dials:\nHEAT 55–70 °   ·   PRESSURE 45–65 bar\nPressure follows heat, about a second late. Both green for six seconds and the sample chamber opens.",
    ),
    find: "read",
    at: { decor: "decor:bohrung:a6" },
    about: [{ kind: "puzzle", id: "pz_side_bohrkopf" }],
  },
  {
    id: "a5_c8_spares",
    tier: 2,
    value: 3,
    topic: "items",
    title: tr("Note wedged in the fuse box"),
    text: tr(
      "C8-BR41N · SPARES (crate by the racks) · DO NOT BORROW\n1 Qubit Chip, 1 Control Module.\n(Both appear on the parts lists of the Quantum Compass and the Dimension Monitor. He will log it if you take them. He logs everything.)",
    ),
    find: "search",
    at: { decor: "decor:c8versteck:p4" },
    about: [
      { kind: "item", id: "qubit_chip" },
      { kind: "device", id: "QCP-001" },
      { kind: "device", id: "DIM-001" },
    ],
  },
  {
    id: "a5_hideout_scan",
    tier: 2,
    value: 3,
    topic: "doors",
    title: tr("Scan anomaly, shaft bottom"),
    text: tr(
      "SCAN — Level −4, west wall of the shaft bottom:\nvoid behind the rubble · fan noise · heat signature 3 kW · cable runs from three decades.\nClassification: passage.",
    ),
    by: "MSC-001",
    find: "device",
    at: { device: "MSC-001" },
    about: [
      { kind: "door", id: "d_c8versteck" },
      { kind: "room", id: "c8versteck" },
    ],
  },
  {
    id: "a5_slag_jar",
    tier: 2,
    value: 3,
    topic: "combine",
    title: tr("Jar of grey fluff"),
    text: tr(
      "A jam jar, label in Jade's hand:\n“Slag, 2 weeks with Mycelium Mesh. It's rock again — two portions of rubble. What exploded, the mycelium forgives.”",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:aufzug5:p20" },
    about: [{ kind: "recipe", id: "myzel×1+schlacke×1" }],
  },

  // ── Tier 3: hidden ──────────────────────────────────────────────
  {
    id: "a5_dust_lock",
    tier: 3,
    value: 3,
    topic: "devices",
    title: tr("Open notebook on the lab table"),
    text: tr(
      "The plinth reads nothing without the Crystal Data Cache.\nThe dust itself: take a pinch. Halo dust is what the Dimension Monitor wants for its rift lock. Nothing else holds a rift shut.",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:x9kammer:a5:t2" },
    when: { device: "VNT-001" },
    whenHint: tr("The pages are dusted over. The haze would need to clear first."),
    about: [
      { kind: "item", id: "halo_staub" },
      { kind: "device", id: "DIM-001" },
      { kind: "device", id: "CDC-001" },
    ],
  },
  {
    id: "a5_handshake_ends",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Tape inside the fuse box lid"),
    text: tr(
      "Masking tape, felt pen:\nHANDSHAKE = four tones = four coordinates.\nThird key first. Eighth key last. The middle two, Damien only ever said out loud.",
    ),
    by: "C8-BR41N",
    find: "search",
    at: { decor: "decor:c8versteck:p2" },
    about: [
      { kind: "puzzle", id: "pz_tones" },
      { kind: "npc", id: "c8br41n" },
    ],
  },
  {
    id: "a5_meme_spread",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Rack display: meme target"),
    text: tr(
      "THINKING MACHINE v3 — TARGET (partial dump)\nSPREAD 39 %\nDEPTH ▒▒ %   MUTATION ▒▒ %   (sectors damaged)",
    ),
    by: "C8-BR41N",
    find: "read",
    at: { decor: "decor:c8versteck:a0" },
    when: { flag: "bot_c8br41n_awake" },
    whenHint: tr("The rack display is dark. Its owner hasn't decided to trust you yet."),
    about: [{ kind: "puzzle", id: "pz_side_denkmaschine" }],
  },
  {
    id: "a5_meme_rest",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Punched card in the fan"),
    text: tr(
      "A punched card, caught in the fan blades, decoded in pencil:\n“…depth 16, mutation 44. Then hold on — press and don't let go. The floor drifts. Three seconds of resonance.”",
    ),
    by: "C8-BR41N",
    find: "search",
    at: { decor: "decor:c8versteck:a7" },
    about: [{ kind: "puzzle", id: "pz_side_denkmaschine" }],
  },
  {
    id: "a5_x9_specimen",
    tier: 3,
    value: 3,
    topic: "lore",
    title: tr("Specimen label"),
    text: tr(
      "X9-DUST — memory core (1 of 1).\nQuantum Analyzer reading, 2018: it shows every reader different data. Mine said: “The slices belong together.”\nDo not open. Do not forget.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:x9kammer:a4" },
    about: [
      { kind: "item", id: "x9_speicherkern" },
      { kind: "device", id: "QAN-001" },
    ],
  },
  {
    id: "a5_shaft_slices",
    tier: 3,
    value: 3,
    topic: "items",
    title: tr("Index card, torn"),
    text: tr(
      "SLICES, LEVEL −4 (five):\nrubble (plain) · dust (after the vents) · crystal wall (after the Dimension Monitor) · heat sink (after C8 trusts you) · drill head (after F1N-DR arrives).",
    ),
    find: "search",
    at: { decor: "decor:c8versteck:p10" },
    about: [{ kind: "item", id: "slice_0089" }],
  },

  // ── Tier 4: well hidden ─────────────────────────────────────────
  {
    id: "a5_drill_lever",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Chalk on the drill rods"),
    text: tr(
      "Low on the rods, where only a small bot would write:\nLEVER 65. LET GO. COUNT SIX.\nIF THE NEEDLE JUMPS: WAIT. THE EARTH IS SLOW.",
    ),
    by: "F1N-DR",
    find: "read",
    at: { prop: "bohrgestaenge" },
    when: { flag: "bot_f1ndr_awake" },
    whenHint: tr(
      "Chalk dust at the foot of the rods, but no writing yet. Someone small hasn't come down here.",
    ),
    about: [{ kind: "puzzle", id: "pz_side_bohrkopf" }],
  },
  {
    id: "a5_niche_riddle",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Fainter scratches"),
    text: tr(
      "In the lamplight, older scratches show beneath the newer ones:\nTHE WORD IS WHAT THIS CAVE DOES WHEN YOU SHOUT INTO IT.",
    ),
    find: "read",
    at: { note: "n_side_kristallnische" },
    when: { device: "AND-001" },
    whenHint: tr("Beneath the scratches there is more, but it is too dark down here to read it."),
    about: [{ kind: "puzzle", id: "pz_side_kristallnische" }],
  },
  {
    id: "a5_halo_prism",
    tier: 4,
    value: 4,
    topic: "combine",
    title: tr("Etched into the lamp glass"),
    text: tr(
      "When the detector hums, the lamp glass shows etched lines:\n“Every shard casts two shadows. Through a prism, the second one is quartz. Two crystals from one.” — J.L.",
    ),
    by: "J.L.",
    find: "read",
    at: { prop: "grubenlampe" },
    when: { all: [{ device: "AND-001" }, { archive: "a5_niche_riddle" }] },
    whenHint: tr("Faint lines in the lamp glass. They flicker only near anomalies."),
    about: [{ kind: "recipe", id: "halo_kristall×1+prisma×1" }],
  },
  {
    id: "a5_rubble_lens",
    tier: 4,
    value: 4,
    topic: "secrets",
    title: tr("Engraving in the barrel dent"),
    text: tr(
      "The scanner overlay picks out an engraving inside the dent:\n2 RUBBLE + 1 LENS → 1 SHARD WITH TWO SHADOWS.\nThe Halo is in the dirt, too. You just have to look closely.",
    ),
    find: "read",
    at: { prop: "truemmerfass" },
    when: { all: [{ device: "MSC-001" }, { device: "AND-001" }] },
    whenHint: tr("There's something in the dent. The naked eye slides right off it."),
    about: [{ kind: "recipe", id: "geroell×2+linse×1" }],
  },
  {
    id: "a5_wall_mirror",
    tier: 4,
    value: 4,
    topic: "endings",
    title: tr("Mirror writing in the crystal"),
    text: tr(
      "Scratched into the wall from the other side, mirror-written:\nA NODE REMEMBERS. BRING ALL THIRTY TO THE CACHE.\nDO NOT USE IT. ASK IT.",
    ),
    find: "read",
    at: { prop: "kristallwand" },
    when: { all: [{ device: "DIM-001" }, { insight: "membran_duenn" }] },
    whenHint: tr(
      "The wall only reflects you. Something behind it is waiting for a better instrument.",
    ),
    about: [
      { kind: "ending", id: "kristall" },
      { kind: "device", id: "CDC-001" },
    ],
  },

  // ── Tier 5: buried ──────────────────────────────────────────────
  {
    id: "a5_x9_endings",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("What the dust shows you"),
    text: tr(
      "X9-DUST shows every reader different data. For you it spells out two roads:\nTHE FREQUENCY — Synthesizer and Echo Recorder online, the handshake heard, Damien's counterpoint solved. He stays in the Halo, but he can speak.\nRETURN — the Teleport Pad, his coordinates from the compass, the handshake, and coherence held at σ-17.",
    ),
    find: "read",
    at: { prop: "x9_sockel" },
    when: { all: [{ device: "QAN-001" }, { insight: "x9_lesung" }, { archive: "a5_x9_specimen" }] },
    whenHint: tr(
      "The dust shifts into letters and falls apart again. An analyzer could hold them still — if you knew what the specimen label says.",
    ),
    about: [
      { kind: "ending", id: "frequenz" },
      { kind: "ending", id: "rueckkehr" },
    ],
  },
  {
    id: "a5_external_halo",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("external.log, last entry"),
    text: tr(
      "[EXTERNAL]: The door opens from the inside.\n[EXTERNAL]: Contain the strange matter. Open the rift. Understand that the Halo is a state, not a place. Carry #0089 as your anchor.\n[EXTERNAL]: Then sit at the Forge — and follow him in.\nC8-BR41N: Logged. I advise against it. I log that too.",
    ),
    by: "C8-BR41N",
    find: "read",
    at: { prop: "c8_terminal" },
    when: {
      all: [
        { flag: "bot_c8br41n_awake" },
        { device: "DIM-001" },
        { device: "EMC-001" },
        { archive: "a4_observatory_down" },
      ],
    },
    whenHint: tr(
      "The log scrolls past a gap. The voice only finishes its sentence for someone who contains what it is made of.",
    ),
    about: [
      { kind: "ending", id: "halo" },
      { kind: "device", id: "EMC-001" },
      { kind: "device", id: "DIM-001" },
    ],
  },
];

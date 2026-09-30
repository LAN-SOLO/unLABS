/**
 * Archive entries on floor 3 — L−3 Deep Lab (see ./types.ts for the rules).
 * German in lib/i18n/de/archive-f23.ts.
 */
import { tr } from "@/lib/i18n";
import type { ArchiveEntry } from "@/lib/world/content/archive/types";

export const ARCHIVE_FLOOR_3: readonly ArchiveEntry[] = [
  // ── tier 1 · in plain sight ─────────────────────────────────────────────
  {
    id: "a3_deep_doors",
    tier: 1,
    value: 2,
    topic: "doors",
    title: tr("Frosted door chart"),
    text: tr(
      "Under the ice on the warning sign:\nCONTAINMENT — reactor power (MFR-001), or a precision laser (LCT-001) through the bolts.\nTELEPORT — network door: NET-001 online, or the same laser.\nThe laser opens most things down here. It also opens people. Mind the beam.",
    ),
    find: "read",
    at: { decor: "decor:vorraum:a0" },
    about: [
      { kind: "door", id: "d_containment" },
      { kind: "door", id: "d_teleport" },
      { kind: "device", id: "LCT-001" },
    ],
  },
  {
    id: "a3_reactor_panel",
    tier: 1,
    value: 2,
    topic: "power",
    title: tr("MFR-001 lever panel legend"),
    text: tr(
      "Engraved above the levers:\nMFR-001 MICROFUSION · +250 W · needs AND-001 and NXS-01.\n1 Pressure vessel: high alloy + chassis frame.\n2 Plasma: 2 plasma rings + superconductor tape.\n3 Ignition: 8 Abstractum + 1 anomalous core.",
    ),
    find: "read",
    at: { decor: "decor:reaktor:a4" },
    about: [
      { kind: "device", id: "MFR-001" },
      { kind: "item", id: "anomaler_kern" },
    ],
  },
  {
    id: "a3_cooling_rule",
    tier: 1,
    value: 2,
    topic: "power",
    title: tr("Cooling rule on the gauges"),
    text: tr(
      "Dymo tape across the dials:\nTIER 3 RUNS HOT. THM-001 COOLING MANDATORY.\nEMC · QSM · QAN · AIC · SCA · TLP — none of them boot without the Thermal Manager.\nAuto-SCRAM: 0.8 s. Tested. Twice.",
    ),
    find: "read",
    at: { decor: "decor:reaktor:a5" },
    about: [
      { kind: "device", id: "THM-001" },
      { kind: "hub", id: "THM-001" },
    ],
  },
  {
    id: "a3_cryo_board",
    tier: 1,
    value: 1,
    topic: "building",
    title: tr("Quantum Lab whiteboard"),
    text: tr(
      "Two columns, Jade's hand:\nQSM-001 · 22 W — cryostat (high alloy, cooling block), 2 qubit chips, control module + exotic matter.\nQAN-001 · 80 W — cabinet, qubit chip + nanomaterial, then Crystal #0089 + 2 exotic matter.\nBoth need EMC-001 first. Everything down here does.",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:quanten:a5" },
    about: [
      { kind: "device", id: "QSM-001" },
      { kind: "device", id: "QAN-001" },
      { kind: "device", id: "EMC-001" },
    ],
  },
  {
    id: "a3_core_table",
    tier: 1,
    value: 2,
    topic: "building",
    title: tr("Holo table: compute core plan"),
    text: tr(
      "The holo table loops a wireframe:\nAIC-001 AI Core · 35 W · needs QAN-001 + CPU-001. Last stage: consciousness anchor = Synapsis shard + antimatter.\nSCA-001 Supercomputer · 45 W · needs AIC-001 + MFR-001. Sixteen nodes, four memory chips, antimatter in the interconnect.",
    ),
    find: "read",
    at: { decor: "decor:rechenkern:a4" },
    about: [
      { kind: "device", id: "AIC-001" },
      { kind: "device", id: "SCA-001" },
    ],
  },
  {
    id: "a3_halorider_poster",
    tier: 1,
    value: 2,
    topic: "devices",
    title: tr("HaloRider poster"),
    text: tr(
      "“HALORIDER — THE WAY BACK IS THE HARD PART.”\nFine print: successor TLP-001 · 100 W · needs SCA-001, DIM-001 and QCP-001.\nSomeone drew a small ghost in the corner. It is waving.",
    ),
    find: "read",
    at: { decor: "decor:teleport:a2" },
    about: [{ kind: "device", id: "TLP-001" }],
  },

  // ── tier 2 · tucked away ────────────────────────────────────────────────
  {
    id: "a3_heat_feel",
    tier: 2,
    value: 3,
    topic: "puzzles",
    title: tr("Containment operator's note"),
    text: tr(
      "Heat drives the pressure, one second late. Don't chase the needles — you'll just make them dance.\nSet the lever once, about two-thirds up, and take your hands off.\n— D.",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:containment:p2" },
    about: [
      { kind: "puzzle", id: "pz_heat" },
      { kind: "item", id: "anomaler_kern" },
    ],
  },
  {
    id: "a3_sigma_window",
    tier: 2,
    value: 3,
    topic: "puzzles",
    title: tr("Margin scribble on a log copy"),
    text: tr(
      "It didn't begin when the field changed colour (03:38). It didn't begin when they vanished (03:41). It began the first time coherence touched σ-17. Somewhere in between.\n— J.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:forge:p5" },
    about: [
      { kind: "puzzle", id: "pz_temporal" },
      { kind: "item", id: "slice_0089" },
    ],
  },
  {
    id: "a3_mem_address",
    tier: 2,
    value: 2,
    topic: "lore",
    title: tr("MCP note on the memory dumps"),
    text: tr(
      "MCP-000 SERVICE NOTE: the dump files are locked by their memory address. The address is part of the file name. I have mentioned this to eleven operators. Four of them laughed.",
    ),
    by: "MCP-000",
    find: "search",
    at: { decor: "decor:rechenkern:p6" },
    about: [{ kind: "room", id: "rechenkern" }],
  },
  {
    id: "a3_power_budget",
    tier: 2,
    value: 2,
    topic: "power",
    title: tr("Load sheet, Deep Lab"),
    text: tr(
      "Load sheet, pencil sums:\nMFR 250 W in. EMC 40 · QSM 22 · QAN 80 · AIC 35 · SCA 45 · TLP 100 = 322 W.\nIt does not add up. Switch off what you're not using. Nothing down here minds being switched off. Almost nothing.",
    ),
    find: "search",
    at: { decor: "decor:reaktor:p4" },
    about: [
      { kind: "device", id: "MFR-001" },
      { kind: "device", id: "TLP-001" },
    ],
  },
  {
    id: "a3_two_shards",
    tier: 2,
    value: 3,
    topic: "items",
    title: tr("Synapsis inventory"),
    text: tr(
      "Synapsis shards, 2 in existence:\n1 — Jade's station, here in the Forge.\n2 — relic display case, Vault L−2.\nThe AI Core swallows one as its anchor. The Quantum Analyzer only reads one. Plan accordingly.",
    ),
    find: "search",
    at: { decor: "decor:forge:p3" },
    about: [
      { kind: "item", id: "synapsis_splitter" },
      { kind: "device", id: "AIC-001" },
      { kind: "device", id: "QAN-001" },
    ],
  },

  // ── tier 3 · hidden ─────────────────────────────────────────────────────
  {
    id: "a3_cold_draught",
    tier: 3,
    value: 3,
    topic: "secrets",
    title: tr("Frost behind the grille"),
    text: tr(
      "The duct behind the grille is frosted from the inside. The draught doesn't come from the shaft. It comes from the Forge — from behind Damien's chair, where the wall is colder than any wall has a right to be.",
    ),
    find: "search",
    at: { decor: "decor:vorraum:p0" },
    about: [
      { kind: "door", id: "d_kaeltearchiv" },
      { kind: "room", id: "kaeltearchiv" },
    ],
  },
  {
    id: "a3_sigma_qsm",
    tier: 3,
    value: 3,
    topic: "endings",
    title: tr("Coherence trace, Forge pattern"),
    text: tr(
      "COHERENCE TRACE · the pattern under the Forge oscillates at σ-17 — exactly where it stopped.\nNote: a return requires the same coherence as the departure. σ-17. Not σ-16.9.",
    ),
    find: "device",
    at: { device: "QSM-001" },
    about: [
      { kind: "ending", id: "rueckkehr" },
      { kind: "device", id: "TLP-001" },
    ],
  },
  {
    id: "a3_capsule_address",
    tier: 3,
    value: 3,
    topic: "lore",
    title: tr("Frozen shelf label"),
    text: tr(
      "Shelf label, frozen to the metal:\nX9-H4L0 capsule — open ONLY with EMC-001 holding.\nThere is no bot inside. There never was. Only an address.",
    ),
    find: "search",
    at: { decor: "decor:kaeltearchiv:a1" },
    about: [
      { kind: "room", id: "kaeltearchiv" },
      { kind: "device", id: "EMC-001" },
    ],
  },
  {
    id: "a3_compass_ink",
    tier: 3,
    value: 3,
    topic: "endings",
    title: tr("Teleport calibration scrap"),
    text: tr(
      "The pad needs a target. The compass (QCP-001) will spin forever until you know what it's supposed to point at — and that's written in ink you can't see, in the Signal Lab. Prism light. INT-001.",
    ),
    find: "search",
    at: { decor: "decor:teleport:p2" },
    about: [
      { kind: "ending", id: "rueckkehr" },
      { kind: "device", id: "QCP-001" },
      { kind: "device", id: "INT-001" },
    ],
  },
  {
    id: "a3_patch_lid",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Scratches on a patch-box lid"),
    text: tr(
      "A spare lid, scratched with a key:\nY → A.  G stays in B.  V in the middle.\nThe other two: warm to warm, mostly.",
    ),
    find: "search",
    at: { decor: "decor:teleport:p1" },
    about: [{ kind: "puzzle", id: "pz_side_koordinaten" }],
  },

  // ── tier 4 · well hidden ────────────────────────────────────────────────
  {
    id: "a3_cavity_scan",
    tier: 4,
    value: 4,
    topic: "secrets",
    title: tr("Deep scan: cavity report"),
    text: tr(
      "DEEP SCAN (reactor-grade power detected)\nL−3 · Forge Chamber · wall section beside Damien's Synapsis station: CAVITY. Volume ~40 m³. Temperature: −41 °C. Not on any plan.\nWalk up to it with the scanner online. Or bring the laser.",
    ),
    find: "device",
    at: { device: "MSC-001" },
    when: { device: "MFR-001" },
    whenHint: tr("Deep scan mode available — but it needs reactor-grade power on the grid."),
    about: [
      { kind: "door", id: "d_kaeltearchiv" },
      { kind: "room", id: "kaeltearchiv" },
    ],
  },
  {
    id: "a3_heat_lever",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Thermal log: containment balance"),
    text: tr(
      "THM-001 FEED · last stable containment balance:\nlever 66 · heat 55–70 ° · pressure 45–65 bar (≈1 s later) · hold 4 s.\nOperator note: set 66, let go, wait. Never longer than 13 s.",
    ),
    find: "read",
    at: { terminal: "term_reaktor" },
    when: { device: "THM-001" },
    whenHint: tr("A thermal feed slot, empty. The Thermal Manager isn't reporting."),
    about: [
      { kind: "puzzle", id: "pz_heat" },
      { kind: "device", id: "THM-001" },
    ],
  },
  {
    id: "a3_prism_rotations",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Laser-lit prism plan"),
    text: tr(
      "Only visible where the laser light grazes the board:\nturn once — R1C3 · R2C2 · R2C3 · R3C1 · R3C3 · R4C2.\n“Light does not lie. It only takes detours.”",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:quanten:p0" },
    when: { device: "LCT-001" },
    whenHint: tr("Faint marks on the board. They'd need a hard, grazing light to show."),
    about: [{ kind: "puzzle", id: "pz_laser_prisma" }],
  },
  {
    id: "a3_patch_wiring",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Coordinate matrix export"),
    text: tr(
      "MATRIX EXPORT · patch box, teleport base:\nRED → D · GREEN → B · BLUE → E · YELLOW → A · VIOLET → C.\nThe box itself only unlocks while the AI Core is awake.",
    ),
    find: "device",
    at: { device: "SCA-001" },
    when: { device: "TLP-001", state: "built" },
    whenHint: tr("Matrix export available once there is a teleport pad to export it for."),
    about: [
      { kind: "puzzle", id: "pz_side_koordinaten" },
      { kind: "device", id: "AIC-001" },
    ],
  },
  {
    id: "a3_cold_sigils",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Catalogue card K-6"),
    text: tr(
      "Card K-6, in Damien's cramped hand:\nR1C6 · R2C4 · R3C6 · R4C2 · R4C3 · R4C6 · R6C1 · R6C2 · R6C3 · R6C4.\nTen presses, any order. “Told you it was simple. Told nobody else.”",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:kaeltearchiv:a10" },
    when: { device: "AIC-001" },
    whenHint: tr(
      "The card drawer's lock is dead — like every deep lock here, until the AI Core wakes.",
    ),
    about: [{ kind: "puzzle", id: "pz_side_kaeltekassette" }],
  },

  // ── tier 5 · buried ─────────────────────────────────────────────────────
  {
    id: "a3_return",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("HaloRider note v0.4, reverse side"),
    text: tr(
      "On the back, in a hurry:\nTo bring one of us home: the pad online. Coordinates from the compass. The handshake, so they know we're coming. And σ-17 — the minute from the Forge log where it all began.\nFour things. Not three. — D.F.",
    ),
    by: "D.F.",
    find: "read",
    at: { note: "n_tele_zurueck" },
    when: { all: [{ device: "TLP-001", state: "built" }, { insight: "sigma17" }] },
    whenHint: tr("Something is written on the back. It only makes sense next to a finished pad."),
    about: [
      { kind: "ending", id: "rueckkehr" },
      { kind: "device", id: "TLP-001" },
      { kind: "device", id: "QCP-001" },
    ],
  },
  {
    id: "a3_substrate",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("Substrate checklist"),
    text: tr(
      "Pinned under the margin note:\nNEW HOME, if it ever comes to that —\n1 AI Core + Supercomputer online.\n2 His pattern: let the Quantum Analyzer read a Synapsis shard (94.8 %).\n3 His voice as reference: the echo tape in the Signal Lab.\nAsk him first. — J.",
    ),
    by: "J.L.",
    find: "read",
    at: { note: "n_rkern_ai" },
    when: { all: [{ device: "AIC-001" }, { device: "QAN-001", state: "built" }] },
    whenHint: tr("A second page is pinned beneath. It waits for a mind to host."),
    about: [
      { kind: "ending", id: "substrat" },
      { kind: "device", id: "AIC-001" },
      { kind: "device", id: "SCA-001" },
      { kind: "device", id: "QAN-001" },
    ],
  },
  {
    id: "a3_together",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("Engraving on the Forge ring"),
    text: tr(
      "Visible only while the rift and the containment both hum:\nTO FOLLOW: containment holding · rift open · know that the Halo is a state, not a place · carry the crystal as your anchor.\nSit down at the station. Don't come back the same.",
    ),
    find: "read",
    at: { prop: "infinity_forge" },
    when: { all: [{ device: "EMC-001" }, { device: "DIM-001" }] },
    whenHint: tr(
      "Letters on the inner ring, too faint to read. The field isn't holding anything yet.",
    ),
    about: [
      { kind: "ending", id: "halo" },
      { kind: "device", id: "EMC-001" },
      { kind: "device", id: "DIM-001" },
    ],
  },
  {
    id: "a3_crystal_ask",
    tier: 5,
    value: 5,
    topic: "secrets",
    title: tr("Frost writing on the capsule"),
    text: tr(
      "Written into the frost from the inside:\nDON'T USE THE CRYSTAL. ASK IT.\nAll thirty facets side by side in the cache. See how thin the membrane is, down on −4. And remember why Harold was trapped — no one should be.",
    ),
    find: "read",
    at: { prop: "h4l0_kapsel" },
    when: { all: [{ device: "EMC-001" }, { insight: "kristall_0089" }] },
    whenHint: tr("The frost on the capsule has patterns. Not quite letters. Not yet."),
    about: [
      { kind: "ending", id: "kristall" },
      { kind: "device", id: "CDC-001" },
      { kind: "item", id: "kristall_0089" },
    ],
  },

  // ── Gap fillers (archive completeness) ────────────────────────────────────
  {
    id: "a3_ethics_print",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Calibration transcript"),
    text: tr(
      "MCP-000 calibration transcript, printed “for the next operator”:\nScenario and principle, counted left to right, top to bottom: 1+5 · 11+2 · 3+10 · 4+8 · 12+6 · 9+7.\nOne of the cards is called Crystal #0089. Please handle it as a case, not as a card.",
    ),
    by: "MCP-000",
    find: "search",
    at: { decor: "decor:rechenkern:p10" },
    when: { device: "QAN-001" },
    whenHint: tr("A thermal printout, blank. The printer only runs on the Quantum Analyzer's bus."),
    about: [
      { kind: "puzzle", id: "pz_ethics_aic" },
      { kind: "device", id: "AIC-001" },
    ],
  },
  {
    id: "a3_bridge_temps",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Synapse bridge, pad by pad"),
    text: tr(
      "Jade's soldering log, the one run that held:\n#1 ≈ 284 · #2 ≈ 295 · #3 ≈ 326 · #4 ≈ 259 · #5 ≈ 308 · #6 ≈ 280 · #7 ≈ 281 · #8 ≈ 279 °C — each window only ten degrees wide.\n“No pause needed. The board forgives patience; I don't.”",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:rechenkern:p8" },
    about: [
      { kind: "puzzle", id: "pz_solder_aic" },
      { kind: "device", id: "SCA-001" },
    ],
  },
  {
    id: "a3_harness_sketch",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Teleport harness sketch"),
    text: tr(
      "A sketch on the back of a cable invoice, 7×7:\nCYAN runs the outer ring — from R7C2 round the left edge and the top back to R2C2.\nMAGENTA takes the right edge down and the bottom row back to column 3. YELLOW loops the top two rows.\nRed, green and blue fit in the middle. Crossing wires means arriving halfway.",
    ),
    find: "search",
    at: { decor: "decor:teleport:p4" },
    about: [
      { kind: "puzzle", id: "pz_wiring_kabelbaum" },
      { kind: "device", id: "TLP-001" },
    ],
  },
  {
    id: "a3_hatch_trend",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Maintenance hatch cheat sheet"),
    text: tr(
      "Taped inside a crate lid:\nCompute core hatch, first six reads: ↻ ↺ ↺ ↺ ↻ ↺.\nClockwise, three times counter, clockwise, counter. Then it opens. Then the core pretends it was never closed.",
    ),
    find: "search",
    at: { decor: "decor:rechenkern:p7" },
    about: [{ kind: "puzzle", id: "pz_side_rechenkern" }],
  },
];

/**
 * Archive entries on floor 1 — L−1 Power & Fabrication (see ./types.ts).
 * German in lib/i18n/de/archive-f01.ts.
 *
 * The power chain is on the gauges in plain sight; puzzle solutions, the
 * service compartments and the secret recipes wait in bins, boxes and on
 * device INFO pages behind late conditions.
 */
import { tr } from "@/lib/i18n";
import type { ArchiveEntry } from "@/lib/world/content/archive/types";

export const ARCHIVE_FLOOR_1: readonly ArchiveEntry[] = [
  // ── Tier 1 · basics in plain sight ─────────────────────────────
  {
    id: "a1_geo_sequence",
    tier: 1,
    value: 2,
    topic: "power",
    title: tr("Geothermal tap, cold start"),
    text: tr(
      "Stencilled beside the gauges:\nGEO TAP · primary bore 847 kW · seep valve STUCK · distributor field UNROUTED.\nSequence: valve → distributor → core (UEC-001).",
    ),
    by: "MCP-000",
    find: "read",
    at: { decor: "decor:geo:a5" },
    about: [
      { kind: "puzzle", id: "pz_geo_valve" },
      { kind: "puzzle", id: "pz_power_flow" },
      { kind: "device", id: "UEC-001" },
    ],
  },
  {
    id: "a1_battery_chain",
    tier: 1,
    value: 2,
    topic: "building",
    title: tr("Battery room, build order"),
    text: tr(
      "Printed on the lever panel:\nBAT-001 needs the core running · PWR-001 needs BAT-001 · PWD-001 needs PWR-001 · VLT-001 only needs the battery.",
    ),
    find: "read",
    at: { decor: "decor:batterie:a4" },
    about: [
      { kind: "device", id: "BAT-001" },
      { kind: "device", id: "PWR-001" },
      { kind: "device", id: "PWD-001" },
      { kind: "device", id: "VLT-001" },
    ],
  },
  {
    id: "a1_cooling_chain",
    tier: 1,
    value: 2,
    topic: "devices",
    title: tr("Cooling needs air"),
    text: tr(
      "A tag wired to the gauge cluster:\nTMP-001 needs moving air — ventilation (VNT-001) up in the airlock. THM-001 needs TMP-001.\nWithout THM-001 the big machines downstairs cook.",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:kuehlung:a6" },
    about: [
      { kind: "device", id: "TMP-001" },
      { kind: "device", id: "THM-001" },
      { kind: "device", id: "VNT-001" },
    ],
  },
  {
    id: "a1_nexus_plinth",
    tier: 1,
    value: 2,
    topic: "devices",
    title: tr("Reserved for NEXUS"),
    text: tr(
      "Under the safety pictograms, in marker:\nNEXUS PLINTH. Before anything stands here: Abstractum Tank, Power Management and Thermal Manager online.\nLaser and fabricator only AFTER the Nexus.",
    ),
    by: "D.F.",
    find: "read",
    at: { decor: "decor:fertigung:a7" },
    about: [
      { kind: "device", id: "NXS-01" },
      { kind: "device", id: "ATK-001" },
      { kind: "device", id: "LCT-001" },
      { kind: "device", id: "P3D-001" },
    ],
  },

  // ── Tier 2 · tucked away ──────────────────────────────────────
  {
    id: "a1_p1ndr0_tag",
    tier: 2,
    value: 2,
    topic: "bots",
    title: tr("P1N-DR0, repair tag"),
    text: tr(
      "A repair tag hanging off the gauge:\nP1N-DR0 · light guide BROKEN · cannot search for packets.\nNeeds: 1 fiber bundle. (The data centre shelves had spares.)",
    ),
    by: "MCP-000",
    find: "read",
    at: { decor: "decor:versorgung:a0" },
    about: [
      { kind: "npc", id: "p1ndr0" },
      { kind: "item", id: "glasfaser" },
    ],
  },
  {
    id: "a1_valve_drill",
    tier: 2,
    value: 3,
    topic: "puzzles",
    title: tr("Valve drill"),
    text: tr(
      "Coffee-ringed drill sheet:\nGreen band 42–58. Steer AGAINST the needle — early and small. Hold four seconds.\nIf you chase it, you lose it. — D.F.",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:geo:p5" },
    about: [{ kind: "puzzle", id: "pz_geo_valve" }],
  },
  {
    id: "a1_flow_printout",
    tier: 2,
    value: 2,
    topic: "puzzles",
    title: tr("Crumpled distributor printout"),
    text: tr(
      "A crumpled printout:\n“Source left of row 4, sink right of row 4. Fifty units. Not forty-nine.”\nSomeone circled the bottom row and wrote “detour”.",
    ),
    find: "search",
    at: { decor: "decor:geo:p4" },
    about: [{ kind: "puzzle", id: "pz_power_flow" }],
  },
  {
    id: "a1_fluid_table",
    tier: 2,
    value: 3,
    topic: "puzzles",
    title: tr("Coolant fluid table"),
    text: tr(
      "Jade's fluid table:\nglycol −5 °C / 3.0 cP · nitrogen −40 °C / 0.3 cP · water +8 °C / 1.0 cP.\nTarget −15 °C ±1, viscosity 1.4–2.2. Only the ratio counts, not the amount.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:kuehlung:p6" },
    about: [{ kind: "puzzle", id: "pz_coolant" }],
  },
  {
    id: "a1_load_budget",
    tier: 2,
    value: 2,
    topic: "power",
    title: tr("Load budget"),
    text: tr(
      "Load budget, J.L.:\nCore 150 W on a good day · VLT-001 holds it at 150 on bad days · BAT-001 +40 W reserve · PWR-001 opens the tap: +100 W · PWD-001 trims reactive load: +20 W.\nShort grid? Put what matters on a PWR-001 priority circuit.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:batterie:p5" },
    about: [
      { kind: "device", id: "UEC-001" },
      { kind: "device", id: "VLT-001" },
      { kind: "device", id: "BAT-001" },
      { kind: "hub", id: "PWR-001" },
      { kind: "device", id: "PWD-001" },
    ],
  },

  // ── Tier 3 · hidden ───────────────────────────────────────────
  {
    id: "a1_flow_route",
    tier: 3,
    value: 4,
    topic: "puzzles",
    title: tr("The route, click by click"),
    text: tr(
      "Pencil on the back of a pay slip, rows counted from the top, quarter turns clockwise:\nR4C1×1 · R4C2×3 · R3C2×3 · R3C3×3 · R6C3×2 · R6C4×1 · R6C5×2 · R5C5×1 · R4C5×1 · R2C5×1 · R1C5×1 · R1C6×2 · R3C6×1 · R4C6×1",
    ),
    find: "search",
    at: { decor: "decor:geo:p8" },
    about: [{ kind: "puzzle", id: "pz_power_flow" }],
  },
  {
    id: "a1_mix_ratio",
    tier: 3,
    value: 4,
    topic: "puzzles",
    title: tr("Mixing desk preset"),
    text: tr(
      "INFO · stored preset “winter”\nGlycol 3 · nitrogen 2 · water 1 → −14.5 °C, 1.77 cP.\n(The coffee machine is still on the Singularity Bus. Nobody knows why.)",
    ),
    by: "MCP-000",
    find: "device",
    at: { device: "TMP-001" },
    about: [{ kind: "puzzle", id: "pz_coolant" }],
  },
  {
    id: "a1_slag_bucket",
    tier: 3,
    value: 3,
    topic: "items",
    title: tr("Slag bucket label"),
    text: tr(
      "A label on a bucket of slag:\n“Things that exploded. Nexus research turns three of these into alloy. Jade says mycelium eats it too and leaves rock behind. Jade says a lot of things.” — D.F.",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:fertigung:p6" },
    about: [
      { kind: "recipe", id: "geroell" },
      { kind: "item", id: "schlacke" },
    ],
  },
  {
    id: "a1_date_display",
    tier: 3,
    value: 4,
    topic: "doors",
    title: tr("Last peak"),
    text: tr(
      "The power display's history, day first, no dots:\n1302 · 1302 · ▒▒▒▒ ▲▲▲ (burnt into the screen) · then nothing, for 2,561 days.\nThe deepest lift clearance was set to the day it happened. The calendar that knew which day hangs upstairs.",
    ),
    by: "MCP-000",
    find: "read",
    at: { decor: "decor:batterie:a5" },
    when: { device: "PWD-001" },
    whenHint: tr("The gauges show only now. A power display panel would keep a history."),
    about: [{ kind: "puzzle", id: "pz_keypad_tiefe" }],
  },

  // ── Tier 4 · well hidden ──────────────────────────────────────
  {
    id: "a1_reserve_log",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Reserve box, charge log"),
    text: tr(
      "Jade's charge log, last page:\nReserve box, fresh open: EVEN · then NARROW–WIDE–NARROW · then TAPERING.\nParkes, Arecibo, Jodrell. If you miss, the curve changes. Read it again.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:batterie:p3" },
    when: { device: "NXS-01" },
    about: [{ kind: "puzzle", id: "pz_side_reservezellen" }],
  },
  {
    id: "a1_parity_dc2",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Chalk on the fuse box"),
    text: tr(
      "Chalk on the inside of the fuse box:\n“DC-2 → 2 / 7. Flip it DOWN.”\nUnderneath, in the MCP's printed label font: “Humans forget this every time.”",
    ),
    find: "search",
    at: { decor: "decor:rechen:p1" },
    when: { device: "NXS-01" },
    about: [{ kind: "puzzle", id: "pz_side_backup" }],
  },
  {
    id: "a1_relay_tuning",
    tier: 4,
    value: 4,
    topic: "bots",
    title: tr("F1N-DR's relay settings"),
    text: tr(
      "INFO · relay profile “F1N-DR”\nSpread and depth equal, mutation low: roughly 44 / 44 / 12.\nPress and hold on the spot. Don't chase the drift. — F1N-DR",
    ),
    by: "F1N-DR",
    find: "device",
    at: { device: "NET-001" },
    when: { insight: "f1ndr_relay" },
    whenHint: tr("An empty relay profile waits for a bot that has not transmitted yet."),
    about: [
      { kind: "puzzle", id: "pz_memetic_f1ndr" },
      { kind: "npc", id: "f1ndr" },
    ],
  },
  {
    id: "a1_magnet_separator",
    tier: 4,
    value: 4,
    topic: "items",
    title: tr("Sorting-bin label"),
    text: tr(
      "A stamped label on a sorting bin, O4-KR0N's mark:\n“SHAFT RUBBLE ×2 + ONE MAGNET → 2 SCREW SETS. Magnetic separation. Do not tell the fabricator.”",
    ),
    by: "O4-KR0N",
    find: "search",
    at: { decor: "decor:fertigung:p9" },
    when: { device: "RMG-001" },
    whenHint: tr(
      "Something metal is jammed at the bottom of the boxes. A strong magnet would pull it out.",
    ),
    about: [{ kind: "recipe", id: "schraubensatz" }],
  },
  {
    id: "a1_sigma_peak",
    tier: 4,
    value: 4,
    topic: "endings",
    title: tr("Peak log, 14 February"),
    text: tr(
      "INFO · peak log 14.02.2019\n03:27 σ-15 · shutdown discarded · 03:40 σ-17 · 03:41 load gone.\nPencilled on the casing: “Same coherence to bring him back. A pad to stand on, his coordinates, a hello he recognises.”",
    ),
    by: "J.L.",
    find: "device",
    at: { device: "PWD-001" },
    when: { device: "TLP-001" },
    whenHint: tr("The peak log is there, but nothing in the lab could use it yet."),
    about: [
      { kind: "ending", id: "rueckkehr" },
      { kind: "device", id: "TLP-001" },
    ],
  },

  // ── Tier 5 · buried ───────────────────────────────────────────
  {
    id: "a1_two_shadows",
    tier: 5,
    value: 4,
    topic: "items",
    title: tr("UV ink on the warning sign"),
    text: tr(
      "Invisible ink, glowing in the scanner's light:\n“All that the prism divides was once a whole. A shard that casts two shadows, through a prism: two quartz crystals. — J.L.”",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:batterie:a7" },
    when: { all: [{ device: "MSC-001" }, { device: "AND-001" }] },
    about: [
      { kind: "recipe", id: "quarzkristall" },
      { kind: "item", id: "halo_kristall" },
    ],
  },
  {
    id: "a1_dust_lens",
    tier: 5,
    value: 5,
    topic: "secrets",
    title: tr("Dust under a lens"),
    text: tr(
      "INFO · unsigned research margin, between two cycles:\n“Put shaft dust under a lens and it casts two shadows. Two rubble, one lens. What comes out is not dust any more.”",
    ),
    find: "device",
    at: { device: "NXS-01" },
    when: { all: [{ device: "LCT-001" }, { device: "AND-001" }] },
    whenHint: tr(
      "A research margin is blank. Something here needs a sharper light and a detector.",
    ),
    about: [
      { kind: "recipe", id: "halo_kristall" },
      { kind: "item", id: "geroell" },
    ],
  },

  // ── Gap fillers (archive completeness, see tests/world/archive.test.ts) ──
  {
    id: "a1_solder_core",
    tier: 2,
    value: 2,
    topic: "puzzles",
    title: tr("Core board solder card"),
    text: tr(
      "A laminated card, scorched at one corner:\nCORE BOARD · six pads, in silkscreen order. Windows are about 14 °C wide.\nPads 1, 2, 5: lukewarm, around 245–255 °C. Pads 3, 4, 6: hot, around 290–300 °C.\nHold to heat, let go inside the window. Smoke means you were brave, not right.",
    ),
    find: "search",
    at: { decor: "decor:geo:p12" },
    about: [
      { kind: "puzzle", id: "pz_solder_uec" },
      { kind: "device", id: "UEC-001" },
    ],
  },
  {
    id: "a1_wiring_plan",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Distributor wiring plan"),
    text: tr(
      "Pencil on graph paper, rows counted from the top:\nRED stays in the top-left corner: along row 1 from column 4, then down to R2C1.\nGREEN runs row 2 to column 5, then up and out at R1C6. BLUE drops straight down column 6.\nYELLOW is the long one — it snakes through rows 3 to 5. MAGENTA gets what is left along the bottom. — J.L.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:rechen:p10" },
    about: [
      { kind: "puzzle", id: "pz_wiring_net" },
      { kind: "device", id: "NET-001" },
    ],
  },
  {
    id: "a1_laser_card",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Burnt alignment card"),
    text: tr(
      "A test card with a neat hole burnt through it:\n“Containment grid: three pieces left the factory the wrong way round. R2C6, R4C6, R6C4 — one click each.\nThe hole in the wall downstairs is from my fourth guess.” — D.F.",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:fertigung:p10" },
    about: [
      { kind: "puzzle", id: "pz_laser_containment" },
      { kind: "device", id: "LCT-001" },
    ],
  },
  {
    id: "a1_layer_stack",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Fabricator housing, the copy that worked"),
    text: tr(
      "The Lawrence protocol, copied onto a delivery note:\nLayer 1 lead glass · 2 graphene foam · 3 copper mesh · 4 aerogel · 5 ferrite.\nCeramic stays in the drawer. It sulks, but it stays.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:fertigung:p11" },
    about: [
      { kind: "puzzle", id: "pz_layers_p3d" },
      { kind: "device", id: "P3D-001" },
    ],
  },
];

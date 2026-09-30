/**
 * Archive entries on floor 4 — L+1 Living Quarters (see ./types.ts for the rules).
 * German in lib/i18n/de/archive-f45.ts.
 *
 * Rooms: atrium, residential corridor, Jade's and Damien's quarters, canteen,
 * library, greenhouse, observatory, radio room, garden passage. Personal
 * notes and lore in plain sight; puzzle solutions split over several rooms.
 */
import { tr } from "@/lib/i18n";
import type { ArchiveEntry } from "@/lib/world/content/archive/types";

export const ARCHIVE_FLOOR_4: readonly ArchiveEntry[] = [
  // ── Tier 1: in plain sight ──────────────────────────────────────
  {
    id: "a4_greenhouse_rota",
    tier: 1,
    value: 1,
    topic: "items",
    title: tr("Greenhouse rota"),
    text: tr(
      "A laminated rota, pinned with four drawing pins:\nGreenhouse — Glow Algae basin, Mycelium wall, coffee shrub. Take what you need. Everything grows back. Water what you take.\n(Every name on the rota has been crossed out and replaced with “MCP”.)",
    ),
    find: "read",
    at: { decor: "decor:wohnflur:a1" },
    about: [
      { kind: "room", id: "gewaechshaus" },
      { kind: "item", id: "leuchtalgen" },
      { kind: "item", id: "myzel" },
    ],
  },
  {
    id: "a4_calendar_doors",
    tier: 1,
    value: 2,
    topic: "doors",
    title: tr("February 2019, facility notes"),
    text: tr(
      "Scribbled across the February page:\nObservatory — dome hydraulics want 200 W. Do NOT open it during a brownout.\nRadio Room — bulkhead is on the network. No Network Monitor (NET-001), no radio.\nThu 14th: final test. Canteen closed.",
    ),
    find: "read",
    at: { decor: "decor:wohnflur:a0" },
    about: [
      { kind: "door", id: "d_observatorium" },
      { kind: "door", id: "d_funkraum" },
      { kind: "device", id: "NET-001" },
    ],
  },
  {
    id: "a4_menu_coffee",
    tier: 1,
    value: 2,
    topic: "power",
    title: tr("Canteen specials"),
    text: tr(
      "TODAY: Coffee. 2× Coffee Beans + 1 Thermocouple, roasted on the singularity bus.\nThe machine wakes at 100 W on the grid, the Food Replicator at 50 W.\nTOMORROW: Lentil soup.",
    ),
    find: "read",
    at: { decor: "decor:kantine:a2" },
    about: [
      { kind: "recipe", id: "kaffeebohnen×2+thermoelement×1" },
      { kind: "item", id: "kaffee" },
    ],
  },
  {
    id: "a4_starchart_lens",
    tier: 1,
    value: 2,
    topic: "bots",
    title: tr("Pencil note on the star chart"),
    text: tr(
      "Next to Orion, in Jade's pencil:\nD3-C4D3 renders the sky blind since its lens cracked (2018). Spare lenses: my locker, or the telescope crate in the Observatory. It says thank you in ASCII.",
    ),
    by: "J.L.",
    find: "read",
    at: { decor: "decor:jadeq:a2" },
    about: [
      { kind: "npc", id: "d3c4d3" },
      { kind: "item", id: "linse" },
    ],
  },
  {
    id: "a4_fridge_why",
    tier: 1,
    value: 1,
    topic: "lore",
    title: tr("Fridge magnets"),
    text: tr(
      "Magnet letters, arranged with care:\nWHY > HOW\nUnderneath, rearranged by someone else:\nHOW = LENTILS",
    ),
    find: "read",
    at: { decor: "decor:damienq:a1" },
    about: [{ kind: "room", id: "damienq" }],
  },
  {
    id: "a4_observatory_howto",
    tier: 1,
    value: 2,
    topic: "devices",
    title: tr("Observatory: operating notes"),
    text: tr(
      "Printed on the poster's margin:\nTELESCOPE — shows nothing until you know what you are looking for. Tune the Oscilloscope Array (OSC-001) to the Halo first.\nANTENNA ARRAY — runs on the lab network (NET-001).\nDARK DOME — the oscilloscopes light it.",
    ),
    find: "read",
    at: { decor: "decor:observatorium:a4" },
    about: [
      { kind: "room", id: "observatorium" },
      { kind: "device", id: "OSC-001" },
      { kind: "device", id: "NET-001" },
    ],
  },
  {
    id: "a4_chalk_w2rek",
    tier: 1,
    value: 2,
    topic: "bots",
    title: tr("Scratches beside the chalk code"),
    text: tr(
      "Next to the Morse line, scratched with a small metal claw:\nW2-REK CRAWLS THE NET. NO NET, NO CRAWL.\nUNDER THE DESK: SOMETHING WARM.",
    ),
    by: "W2-REK",
    find: "read",
    at: { decor: "decor:funkraum:a4" },
    about: [
      { kind: "npc", id: "w2rek" },
      { kind: "device", id: "NET-001" },
    ],
  },
  {
    id: "a4_catalogue_l0g1k",
    tier: 1,
    value: 2,
    topic: "bots",
    title: tr("Catalogue: loans and repairs"),
    text: tr(
      "LOANS — L0G-1K (librarian unit): logic core faulty since 14.02.2019. Cannot verify anything, including itself.\nREPAIR — one Control Module (Circuit Board + Memory Chip).\nSigned out to: nobody.",
    ),
    find: "read",
    at: { terminal: "term_bibliothek" },
    about: [
      { kind: "npc", id: "l0g1k" },
      { kind: "item", id: "steuermodul" },
    ],
  },
  {
    id: "a4_poster_mint",
    tier: 1,
    value: 1,
    topic: "lore",
    title: tr("Poster, bottom corner"),
    text: tr(
      "“_unstableLabs — we build what persists.”\nIn pencil, bottom corner: “So does the mint. — D.F.”",
    ),
    find: "read",
    at: { decor: "decor:gartengang:p26" },
    about: [{ kind: "room", id: "gartengang" }],
  },

  // ── Tier 2: tucked away ─────────────────────────────────────────
  {
    id: "a4_finder_frequency",
    tier: 2,
    value: 3,
    topic: "puzzles",
    title: tr("Damien's station"),
    text: tr(
      "A folder labelled “D.F. — things he won't tell me”, one page:\nThe direction finder: he always leaves it on the station he likes. 94.7 MHz. He never told me the phase. He said I'd know it when I saw it.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:jadeq:a6" },
    about: [{ kind: "puzzle", id: "pz_radio_quarters" }],
  },
  {
    id: "a4_diary_primer",
    tier: 2,
    value: 3,
    topic: "puzzles",
    title: tr("Dog-eared oscilloscope primer"),
    text: tr(
      "Between the pages, a strip of paper as a bookmark:\nCount where the ghost touches the edges. Left once, top three times: that's the ratio.\nAn eighth of a turn is 45°. The dial clicks in 15° steps.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:jadeq:a0" },
    about: [{ kind: "puzzle", id: "pz_side_jade_tagebuch" }],
  },
  {
    id: "a4_seed_band",
    tier: 2,
    value: 2,
    topic: "puzzles",
    title: tr("Seed vault, care card"),
    text: tr(
      "Green is the fifth of nine bands, counting clockwise from infrared at twelve o'clock — the bottom of the dial.\nThree hits, each window narrower, the needle faster. Don't chase it. Wait for it.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:gewaechshaus:p4" },
    about: [{ kind: "puzzle", id: "pz_side_saatgut" }],
  },
  {
    id: "a4_net_w2rek",
    tier: 2,
    value: 2,
    topic: "network",
    title: tr("Crawler registration"),
    text: tr(
      "NET-001 client table:\nW2-REK · crawler · Radio Room (L+1) · state: WAITING FOR NETWORK → ONLINE\nIndexed: 3 relay logs (2026), 1 object under the radio desk (warm).",
    ),
    by: "NET-001",
    find: "device",
    at: { device: "NET-001" },
    about: [
      { kind: "npc", id: "w2rek" },
      { kind: "room", id: "funkraum" },
    ],
  },
  {
    id: "a4_observatory_down",
    tier: 2,
    value: 2,
    topic: "lore",
    title: tr("Sky survey, closing remark"),
    text: tr(
      "SKY SURVEY 2019 — result: nothing in the sky.\nRemark D.F.: The signal comes from no direction. Stop pointing the dish up. Point it down. Level −4, west of the shaft bottom, behind the rubble. C8 knows.",
    ),
    by: "D.F.",
    find: "read",
    at: { terminal: "term_observatorium" },
    about: [
      { kind: "room", id: "c8versteck" },
      { kind: "npc", id: "c8br41n" },
    ],
  },
  {
    id: "a4_d3_render",
    tier: 2,
    value: 2,
    topic: "bots",
    title: tr("D3-C4D3 render log"),
    text: tr(
      "RENDER 00001 (first in 2,561 days): sky, cloudy.\nChart drawer unlocked: 1 star chart (ASCII).\nObject under the telescope: warm, faceted, not a star. Not rendered. Out of respect.",
    ),
    by: "D3-C4D3",
    find: "read",
    at: { decor: "decor:observatorium:a6" },
    when: { flag: "bot_d3c4d3_awake" },
    whenHint: tr("The workstation shows a render queue — empty. The renderer is still asleep."),
    about: [
      { kind: "npc", id: "d3c4d3" },
      { kind: "item", id: "sternkarte" },
    ],
  },
  {
    id: "a4_coffee_fertilizer",
    tier: 2,
    value: 3,
    topic: "combine",
    title: tr("Fertilizer bag, hand-labelled"),
    text: tr(
      "ALGAE FERTILIZER (house blend)\n1 coffee — brewed, any vintage — plus 1 Glow Algae Culture. The shrub bears three times over.\nGreenhouse secret. Do not tell D.F. that it works.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:gewaechshaus:p5" },
    about: [{ kind: "recipe", id: "kaffee×1+leuchtalgen×1" }],
  },

  // ── Tier 3: hidden ──────────────────────────────────────────────
  {
    id: "a4_finder_phase",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Legal pad no. 9, back page"),
    text: tr(
      "Among crossed-out integrals:\n“phase = the angle of the door in Building K when she came in late. Three eighths of a turn. Don't ask.”",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:damienq:a3:t2" },
    about: [{ kind: "puzzle", id: "pz_radio_quarters" }],
  },
  {
    id: "a4_sigil_top",
    tier: 3,
    value: 3,
    topic: "doors",
    title: tr("Folded page behind the grille"),
    text: tr(
      "A legal pad page, folded eight times:\nCounterpoint, not command. Same board as in my Secondary Station, same board on my door.\nRow one: only the third.\nRow two: the first and the third.",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:wohnflur:a2" },
    about: [
      { kind: "puzzle", id: "pz_sigils" },
      { kind: "door", id: "d_damienq" },
    ],
  },
  {
    id: "a4_sigil_bottom",
    tier: 3,
    value: 3,
    topic: "doors",
    title: tr("Bookmark in a book on recursion"),
    text: tr(
      "…continued:\nRow three: the first.\nRow four: the first and the third.\nRow five: leave it alone — it resolves itself.\nOne touch each. Order is irrelevant; the noise doesn't care who speaks first.",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:bibliothek:a4" },
    about: [
      { kind: "puzzle", id: "pz_sigils" },
      { kind: "door", id: "d_damienq" },
    ],
  },
  {
    id: "a4_fund_start",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Napkin in the vent"),
    text: tr(
      "A coffee-stained napkin, rolled up:\n“Kitty round — start in _unSC. Chips first. Never the beans, the fee eats the beans.”",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:kantine:a10" },
    about: [{ kind: "puzzle", id: "pz_side_kaffeekasse" }],
  },
  {
    id: "a4_fund_rest",
    tier: 3,
    value: 3,
    topic: "puzzles",
    title: tr("Receipt in the moving box"),
    text: tr(
      "A till receipt, the back covered in arrows:\n“…after the chips: copper. After copper: coolant. Then home. Four trades, fourteen percent. Jade must never find out.”",
    ),
    by: "D.F.",
    find: "search",
    at: { decor: "decor:damienq:p3" },
    about: [{ kind: "puzzle", id: "pz_side_kaffeekasse" }],
  },
  {
    id: "a4_algae_prism",
    tier: 3,
    value: 3,
    topic: "combine",
    title: tr("Margin note in an optics textbook"),
    text: tr(
      "Chapter 7, dispersion. In the margin, in green ink:\n“Color is memory. Hold the algae light to the prism and it sorts itself — into guides. Two for one.”",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:observatorium:a7" },
    about: [{ kind: "recipe", id: "leuchtalgen×1+prisma×1" }],
  },
  {
    id: "a4_mycel_board",
    tier: 3,
    value: 3,
    topic: "combine",
    title: tr("Loose sheet: growth experiment 4"),
    text: tr(
      "Two portions of Mycelium Mesh over one Memory Chip, three days in the dark.\nResult: the mesh copied the chip's traces. Twice. The chip survived.\nConclusion: the mycelium computes. Slowly. With opinions.",
    ),
    by: "J.L.",
    find: "search",
    at: { decor: "decor:bibliothek:p7" },
    about: [{ kind: "recipe", id: "myzel×2+speicherchip×1" }],
  },
  {
    id: "a4_slices_quarters",
    tier: 3,
    value: 3,
    topic: "items",
    title: tr("Index card, drawer “S”"),
    text: tr(
      "SLICES, LEVEL +1 (five):\n· under J.L.'s pillow\n· in the direction finder compartment (tune it first)\n· under the telescope (ask D3-C4D3)\n· under the radio desk (ask W2-REK)\n· filed as evidence (ask me)\n— L0G-1K",
    ),
    by: "L0G-1K",
    find: "search",
    at: { decor: "decor:bibliothek:a15" },
    about: [
      { kind: "item", id: "slice_0089" },
      { kind: "npc", id: "l0g1k" },
    ],
  },

  // ── Tier 4: well hidden ─────────────────────────────────────────
  {
    id: "a4_musicbox_hum",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("L0G-1K: found item no. 214, addendum"),
    text: tr(
      "Evidence addendum, verified at last:\nDr. Fridge hummed four notes each evening. Transcribed: sol — re — ti — mi.\nThe keys run up from C. I still have no mouth.",
    ),
    by: "L0G-1K",
    find: "search",
    at: { decor: "decor:bibliothek:a2" },
    when: { flag: "bot_l0g1k_awake" },
    whenHint: tr(
      "Between the books: a card in machine print, unfinished. Its author cannot verify it.",
    ),
    about: [{ kind: "puzzle", id: "pz_side_spieluhr" }],
  },
  {
    id: "a4_clock_gear",
    tier: 4,
    value: 4,
    topic: "endings",
    title: tr("Behind the pendulum"),
    text: tr(
      "Tucked behind the pendulum, where the missing gear should sit, a slip in Jade's hand:\n“The gear isn't missing. Harold is. Remember the wrong substrate when you stand before the crystal — it will ask what you learned, not what you built.”",
    ),
    by: "J.L.",
    find: "read",
    at: { prop: "standuhr" },
    when: { insight: "membran_duenn" },
    whenHint: tr(
      "Something is wedged behind the pendulum. You only notice it once you know how thin some walls are.",
    ),
    about: [
      { kind: "ending", id: "kristall" },
      { kind: "room", id: "damienq" },
    ],
  },

  // ── Tier 5: buried ──────────────────────────────────────────────
  {
    id: "a4_ask_the_crystal",
    tier: 5,
    value: 5,
    topic: "secrets",
    title: tr("Draft, never sent"),
    text: tr(
      "DRAFT (jade → jade), saved 13.02.2019 23:58:\nThirty facets are not a key. Don't USE the crystal — ask it.\nPut all thirty slices back in the Crystal Data Cache (CDC-001), and bring the three things I know: #0089 is me, the membrane is thin, and Harold's substrate was the wrong one.\nThen it will answer. Not me. Not Damien. Something that was listening.",
    ),
    by: "J.L.",
    find: "read",
    at: { terminal: "term_jadeq" },
    when: {
      all: [
        { archive: "a4_clock_gear" },
        { archive: "a5_wall_mirror" },
        { counter: "slices", min: 20 },
      ],
    },
    whenHint: tr(
      "One draft is locked: “only for someone who has read the pendulum and the wall — and holds most of me.”",
    ),
    about: [
      { kind: "ending", id: "kristall" },
      { kind: "device", id: "CDC-001" },
    ],
  },
  {
    id: "a4_substrate_plan",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("Dome screen: transfer plan"),
    text: tr(
      "The dome screen redraws the sky as a circuit diagram:\nNEW SUBSTRATE — AI Assistant Core online, Supercomputer Array online. Load Damien's resonance pattern (reconstructed from the Synapsis shard) with his recorded voice as the reference. He gets continuous time.\n(Signed with a single “D.”)",
    ),
    by: "D.F.",
    find: "read",
    at: { decor: "decor:observatorium:a5" },
    when: {
      all: [{ device: "SCA-001" }, { flag: "bot_d3c4d3_awake" }, { archive: "a4_d3_render" }],
    },
    whenHint: tr(
      "The map screen flickers with a diagram too large for its resolution. It needs a supercomputer behind it — and a renderer in front.",
    ),
    about: [
      { kind: "ending", id: "substrat" },
      { kind: "device", id: "AIC-001" },
      { kind: "device", id: "SCA-001" },
    ],
  },

  // ── Chain part (see ./combos.ts) ──────────────────────────────────────────
  {
    id: "a4_stopped_watch",
    tier: 3,
    value: 3,
    topic: "lore",
    title: tr("Watch in an evidence bag"),
    text: tr(
      "Behind the lecture notes, a wristwatch in an evidence bag, brought up from the Forge on 15.02.2019.\nThe balance wheel is magnetised solid — in an instant, says the tag, not over time.\nStopped at twenty to four, nine seconds past the minute.",
    ),
    find: "search",
    at: { decor: "decor:damienq:a0" },
    about: [{ kind: "puzzle", id: "pz_temporal" }],
  },
];

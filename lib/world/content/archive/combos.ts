/**
 * Combination entries — knowledge that exists only between several finds
 * (see ./types.ts). No spot: entered at the archive console once every
 * needed entry is found. German in lib/i18n/de/archive-combos.ts.
 *
 * Most chains cross floors: one half of a clue lies upstairs, the other in
 * the depths. The answer is never written in any single needed entry
 * (tests/world/archive.test.ts), and every needed entry can be found on its
 * own (the simulated playthrough finds all of them).
 */
import { tr } from "@/lib/i18n";
import type { ArchiveEntry } from "@/lib/world/content/archive/types";

export const ARCHIVE_COMBOS: readonly ArchiveEntry[] = [
  // ── keypad codes ──────────────────────────────────────────────────────────
  {
    id: "c_airlock_code",
    tier: 4,
    value: 4,
    topic: "doors",
    title: tr("The number of the lab"),
    text: tr(
      "0847. The borehole delivers 847 kW, the locker wants four digits, and the zero leads.\nThe same number turns up in metres, hertz and packets all over the lab. The MCP has stopped calling it a coincidence.",
    ),
    find: "combine",
    needs: ["a0_airlock_scratch", "a1_geo_sequence"],
    prompt: tr("The emergency locker wants the kilowatts of the borehole. Which four digits?"),
    answer: "0847",
    about: [
      { kind: "puzzle", id: "pz_keypad_schleuse" },
      { kind: "item", id: "x0r8t_paket" },
    ],
  },
  {
    id: "c_vault_code",
    tier: 4,
    value: 4,
    topic: "doors",
    title: tr("The minute it happened"),
    text: tr(
      "0341. The last line of the Forge printout — correlation 1.000, subjects not at their stations — reads 3:41:22. Four digits, so the hour gets its zero back; the seconds stay outside.\nBehind the vault door: the relic display with the second Synapsis shard, and Damien's log #0512.",
    ),
    find: "combine",
    needs: ["a2_vault_hint", "a2_crash_printout"],
    prompt: tr("The vault wants the minute it happened, hours first. Which four digits?"),
    answer: "0341",
    about: [
      { kind: "door", id: "d_tresor" },
      { kind: "puzzle", id: "pz_keypad_tresor" },
    ],
  },
  {
    id: "c_deep_code",
    tier: 4,
    value: 4,
    topic: "doors",
    title: tr("A date that keeps coming back"),
    text: tr(
      "1402 — Thursday the 14th of February 2019, the final test on Jade's calendar, written day first as the power display writes it.\nThe elevator to Level −3 takes it. So would the Nexus (NXS-01), if you had one running.",
    ),
    find: "combine",
    needs: ["a1_date_display", "a4_calendar_doors"],
    prompt: tr("The deep clearance is the day it happened, day first. Which four digits?"),
    answer: "1402",
    about: [{ kind: "puzzle", id: "pz_keypad_tiefe" }],
  },

  // ── puzzle solutions ──────────────────────────────────────────────────────
  {
    id: "c_cipher_key",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("Signed twice"),
    text: tr(
      "HALO. Jade's four margin notes — Control Room, Battery Room, Geothermal, Signal Lab — each begin with the letter she signs with: Hear, All, Load, Only.\nThe Vigenère relic in the archive opens with that key. Of course it does.",
    ),
    by: "J.L.",
    find: "combine",
    needs: ["a0_cipher_bookmark", "a2_margin_order"],
    prompt: tr("Four margin notes, each signed at the very top. Which key do they spell?"),
    answer: "HALO",
    about: [{ kind: "puzzle", id: "pz_cipher" }],
  },
  {
    id: "c_handshake",
    tier: 5,
    value: 4,
    topic: "puzzles",
    title: tr("Four tones, four coordinates"),
    text: tr(
      "3 · 6 · 4 · 8 — E, A, F and the high C. The keys run up from C: la is the sixth, fa the fourth; the third key opens, the eighth closes.\nPlay it on the Synthesizer (HMS-001) with the Narrow Speaker on. Something answers. C8-BR41N will want proof that you heard it yourself.",
    ),
    find: "combine",
    needs: ["a5_handshake_ends", "a2_tape_middle", "a4_musicbox_hum"],
    prompt: tr("Which four synthesizer keys make the handshake, first to last?"),
    answer: "3648",
    about: [
      { kind: "puzzle", id: "pz_tones" },
      { kind: "npc", id: "c8br41n" },
      { kind: "ending", id: "frequenz" },
    ],
  },
  {
    id: "c_first_sigma",
    tier: 5,
    value: 4,
    topic: "puzzles",
    title: tr("Where it began"),
    text: tr(
      "03:40:09. The field went coherent in an instant, and every balance wheel in the Forge froze with it — Damien's watch among them. Seventy-three seconds later the stations were empty.\nIn the Forge log it is the sixth entry. It is also the coherence a return has to hold: σ-17.",
    ),
    find: "combine",
    needs: ["a3_sigma_window", "a4_stopped_watch"],
    prompt: tr("When did coherence first touch σ-17 — to the second? (hh:mm:ss)"),
    answer: "03:40:09",
    about: [
      { kind: "puzzle", id: "pz_temporal" },
      { kind: "ending", id: "rueckkehr" },
    ],
  },
  {
    id: "c_finder_phase",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("The door in Building K"),
    text: tr(
      "135°. Three eighths of a turn, at 45° an eighth. On 94.7 MHz with that phase, the voice in Damien's direction finder locks in — and the compartment underneath opens. There is a slice in it.",
    ),
    find: "combine",
    needs: ["a4_finder_frequency", "a4_finder_phase", "a4_diary_primer"],
    prompt: tr("Damien's direction finder: at which phase does the voice lock in? (degrees)"),
    answer: "135",
    about: [
      { kind: "puzzle", id: "pz_radio_quarters" },
      { kind: "item", id: "slice_0089" },
    ],
  },
  {
    id: "c_thinking_machine",
    tier: 4,
    value: 4,
    topic: "puzzles",
    title: tr("The thinking machine's target"),
    text: tr(
      "39 · 16 · 44 — spread, depth, mutation. Press on the spot and hold; the floor drifts, and three seconds of resonance satisfy C8-BR41N's thinking machine.\nC8 logs that you did it. C8 logs everything.",
    ),
    find: "combine",
    needs: ["a5_meme_spread", "a5_meme_rest"],
    prompt: tr("Spread, depth, mutation: the thinking machine's full target, in that order?"),
    answer: "39 16 44",
    about: [
      { kind: "puzzle", id: "pz_side_denkmaschine" },
      { kind: "npc", id: "c8br41n" },
    ],
  },

  // ── secrets ───────────────────────────────────────────────────────────────
  {
    id: "c_hollow_walls",
    tier: 5,
    value: 5,
    topic: "secrets",
    title: tr("Three rooms on no plan"),
    text: tr(
      "The Material Scanner (MSC-001) hears all three — walk up to each wall with it online, or cut through with the laser (LCT-001):\n· MCP Chamber, the north wall drawn too thick → the map room.\n· Forge, behind Damien's chair → the Cold Archive.\n· Level −4, west of the shaft bottom, behind the rubble → C8-BR41N's hideout.\nThree rooms on no plan. Someone planned that.",
    ),
    find: "combine",
    needs: ["a0_thick_wall", "a3_cold_draught", "a4_observatory_down"],
    prompt: tr(
      "A wall drawn too thick, a wall too cold, a signal from behind the rubble. Which device hears all three? (device id)",
    ),
    answer: "MSC-001",
    about: [
      { kind: "door", id: "d_kartenraum" },
      { kind: "door", id: "d_kaeltearchiv" },
      { kind: "door", id: "d_c8versteck" },
      { kind: "device", id: "MSC-001" },
    ],
  },
  {
    id: "c_halo_shard",
    tier: 5,
    value: 5,
    topic: "secrets",
    title: tr("The Halo in the dirt"),
    text: tr(
      "Four handfuls. 2 rubble + 1 lens at the workbench make a Halo Crystal Shard; a shard in a prism splits into 2 quartz crystals. The shaft refills its rubble, so the Halo is renewable, as long as you have lenses.\nWhat else shards are good for: 2 shards + superconductor tape → exotic matter · 2 shards + 2 energy cells → an anomalous core.",
    ),
    find: "combine",
    needs: ["a1_dust_lens", "a5_halo_prism"],
    prompt: tr(
      "From shaft rubble to quartz: how many handfuls of rubble for four quartz crystals?",
    ),
    answer: "4",
    about: [
      { kind: "recipe", id: "geroell×2+linse×1" },
      { kind: "recipe", id: "halo_kristall×1+prisma×1" },
      { kind: "item", id: "halo_kristall" },
      { kind: "item", id: "anomaler_kern" },
    ],
  },

  // ── endings ───────────────────────────────────────────────────────────────
  {
    id: "c_return_target",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("Four things, not three"),
    text: tr(
      "Damien. The Return, all four parts:\n1 The Teleport Pad (TLP-001) online.\n2 His coordinates: prism ink under the Interpolator's light (INT-001) tells the Quantum Compass (QCP-001) what to point at.\n3 The four-tone handshake, so he knows who is calling.\n4 Coherence held at σ-17 — not σ-16.9.\nMiss one and the pad sends a greeting instead of a person.",
    ),
    find: "combine",
    needs: ["a3_compass_ink", "a3_sigma_qsm", "a1_sigma_peak"],
    prompt: tr(
      "A pad, a target in hidden ink, the coherence of that night. Who is meant to come back? (first name)",
    ),
    answer: "Damien",
    about: [
      { kind: "ending", id: "rueckkehr" },
      { kind: "device", id: "TLP-001" },
      { kind: "device", id: "QCP-001" },
    ],
  },
  {
    id: "c_new_home",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("A voice to check against"),
    text: tr(
      "The Echo Recorder (ECR-001) keeps his voice — the tape “Echo test”. New Substrate, complete:\n1 AI Core (AIC-001) and Supercomputer (SCA-001) online.\n2 The Quantum Analyzer reads the second Synapsis shard for his pattern; the AI Core has swallowed the first as its anchor.\n3 His voice from the echo as the reference.\n4 Ask him first. Jade insisted.",
    ),
    find: "combine",
    needs: ["a3_two_shards", "a4_substrate_plan", "sys_echo_feed"],
    prompt: tr(
      "His pattern comes from a shard. Which device keeps the voice it is checked against? (device id)",
    ),
    answer: "ECR-001",
    about: [
      { kind: "ending", id: "substrat" },
      { kind: "device", id: "ECR-001" },
      { kind: "item", id: "synapsis_splitter" },
    ],
  },
  {
    id: "c_crystal_question",
    tier: 5,
    value: 5,
    topic: "endings",
    title: tr("Do not use it"),
    text: tr(
      "The Crystal Data Cache (CDC-001). The secret way to end it:\n1 Bring all thirty slices of #0089 into the cache — side by side, not put together.\n2 Know that #0089 is Jade. Stand where the membrane is thin (the crystal wall on Level −4, rift open). Read what the wrong substrate did to Harold (the clock in Damien's quarters).\n3 Do not use the crystal. Ask it.\nIt will answer. Not Jade, not Damien. Something that was listening.",
    ),
    find: "combine",
    needs: ["a0_harold_letter", "a3_crystal_ask", "a5_wall_mirror"],
    prompt: tr("Thirty facets, side by side. In which device? (device id)"),
    answer: "CDC-001",
    about: [
      { kind: "ending", id: "kristall" },
      { kind: "device", id: "CDC-001" },
      { kind: "item", id: "kristall_0089" },
    ],
  },
];

import type { PuzzleDef } from "@/lib/world/types";
import { tr } from "@/lib/i18n";

/**
 * Playable puzzles, adapted from GD_FEATURE_puzzle-stubs (PZ_*). Each is a
 * short (15–90 s) minigame without hard failure — retry is always allowed.
 */
export const PUZZLES: readonly PuzzleDef[] = [
  {
    id: "pz_power_flow",
    kind: "pipes",
    title: tr("Power Flow Network"),
    intro: tr(
      "The geothermal distribution field. 6×6 nodes, directional pipes. Rotate the segments until power flows from the source (left) to the sink (right). Fifty units. Not forty-nine.",
    ),
    params: { size: 6, seed: 847 },
    reward: { flags: ["geo_routed"], insights: ["erster_strom"] },
    mcpSolved: tr(
      "Fifty units. Not forty-nine. Not fifty-one. I have watched seventeen operators fail by exactly one unit.",
    ),
  },
  {
    id: "pz_geo_valve",
    kind: "valve",
    title: tr("Geothermal Valve"),
    intro: tr(
      "The Abstractum Seep Valve has been stuck for 2,561 days. Hold the flow in the green band for four seconds while the pressure fluctuates.",
    ),
    params: { low: 42, high: 58, hold: 4 },
    reward: { flags: ["seep_open"], items: [{ item: "abstractum", count: 6 }] },
    mcpSolved: tr("Seep valve open. Abstractum is flowing. Please do not lick it."),
  },
  {
    id: "pz_lissajous",
    kind: "lissajous",
    title: tr("Lissajous Locker"),
    intro: tr(
      "Two sine waves on X and Y. Set the frequency ratio and phase so the figure covers the ghost image (cyan). One of Jade's seven “stable windows”.",
    ),
    params: { ratio: "3:4", phase: 90 },
    reward: { flags: ["scope_calibrated"], insights: ["halo_atmet"] },
    mcpSolved: tr(
      "Jules Antoine Lissajous died in 1880. He would be delighted. Or horrified. Probably horrified.",
    ),
  },
  {
    id: "pz_cipher",
    kind: "cipher",
    title: tr("Cipher Wheel"),
    intro: tr(
      "An encrypted relic. Vigenère. The key is hidden in Jade's margin notes — the initial letters give it away.",
    ),
    params: {
      key: "HALO",
      keyNote: tr("Jade's favourite word."),
      plain: tr(
        "THE HALO IS NOT A PLACE IT IS A STATE OF COMPRESSION SO COMPLETE THAT TIME FOLDS WE DID NOT DISCOVER IT IT DISCOVERED US",
      ),
    },
    reward: { insights: ["halo_zustand"], flags: ["relic_decoded"] },
    mcpSolved: tr(
      "Decryption successful. Key: H-A-L-O. Contents: research notes. Fragmented. But genuine. That is her handwriting in the data.",
    ),
  },
  {
    id: "pz_tones",
    kind: "tones",
    title: tr("Handshake Tones"),
    intro: tr(
      "Four tones emerge from the noise. Four coordinates. Listen, remember them, play them back.",
    ),
    params: {
      tones: [2, 5, 3, 7],
      scale: [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25],
    },
    reward: { insights: ["handshake"], flags: ["handshake_done"] },
    mcpSolved: tr(
      "I did not authorize this transmission. I do not recognize the source. And I do not like things I do not recognize. …But Dr. Lawrence would have been delighted.",
    ),
  },
  {
    id: "pz_heat",
    kind: "heat",
    title: tr("Heat-Pressure Balance"),
    intro: tr(
      "The anomaly is fighting the containment field. One lever, two gauges. Heat drives the pressure — with a delay. Keep both in the green for four seconds.",
    ),
    params: { hold: 4 },
    reward: {
      items: [{ item: "anomaler_kern", count: 1 }],
      insights: ["anomalie_gezaehmt"],
      flags: ["anomaly_tamed"],
    },
    mcpSolved: tr("Anomaly contained. “Tamed” is generous. It has stopped fighting."),
  },
  {
    id: "pz_coolant",
    kind: "coolant",
    title: tr("Coolant Alchemy"),
    intro: tr(
      "Three coolants: glycol, nitrogen, water. Mix them so the mixture hits exactly −15 °C and the viscosity stays within the band.",
    ),
    params: { target: -15 },
    reward: { flags: ["coolant_mixed"], items: [{ item: "kuehlrippe", count: 2 }] },
    mcpSolved: tr(
      "Cooling loop stable. Incidentally, Dr. Lawrence's coffee machine is still hooked up to the Singularity Bus.",
    ),
  },
  {
    id: "pz_keypad_tresor",
    kind: "keypad",
    title: tr("Relic Vault"),
    intro: tr(
      "Four-digit code. Someone has scratched a time of day under the keypad: “when it happened”.",
    ),
    params: { code: "0341" },
    reward: { flags: ["tresor_open"] },
    mcpSolved: tr(
      "03:41. Of course. The time at which two people stopped being at their stations.",
    ),
  },
  {
    id: "pz_keypad_tiefe",
    kind: "keypad",
    title: tr("Deep Lab Clearance"),
    intro: tr("Elevator clearance for Level −3. Four digits. A date that keeps coming back."),
    params: { code: "1402" },
    reward: { flags: ["deep_access"] },
    mcpSolved: tr("The fourteenth of February. A date that means more than flowers in this lab."),
  },
  {
    id: "pz_keypad_schleuse",
    kind: "keypad",
    title: tr("Outer Airlock"),
    intro: tr("The outer airlock. Four digits. The number that turns up everywhere in this lab."),
    params: { code: "0847" },
    reward: { flags: ["schleuse_open"], items: [{ item: "x0r8t_paket", count: 1 }] },
    mcpSolved: tr(
      "847. Kilowatts, sensors, packets, metres. I have stopped believing in coincidence.",
    ),
  },
  {
    id: "pz_crc",
    kind: "crc",
    title: tr("CRC Hunt"),
    intro: tr(
      "The data stream from the Crystal Data Cache is corrupt. A single bit has flipped. The parity rows and columns give away which one.",
    ),
    params: { rows: 6, cols: 8, seed: 89 },
    reward: { insights: ["kristall_0089"], items: [{ item: "speicherchip", count: 1 }] },
    mcpSolved: tr("Checksum correct. Record #0089 reconstructed. It is… warm."),
  },
  {
    id: "pz_sigils",
    kind: "sigils",
    title: tr("Sigil Counterpoint"),
    intro: tr(
      "Damien's technique from 2003: counter-sigils neutralize active sigils. Every placement flips the cell and its four neighbors. Turn off all the lights.",
    ),
    params: { size: 5, seed: 2136 },
    reward: { insights: ["damien_kontrapunkt"], flags: ["sigils_cleared"] },
    mcpSolved: tr(
      "Counterpoint resolved. Dr. Fridge called this “conversation with the noise”. I call it pattern recognition.",
    ),
  },
  {
    id: "pz_temporal",
    kind: "temporal",
    title: tr("Temporal Ping"),
    intro: tr(
      "The logs from Level −3 contradict each other. Find the timestamp at which coherence first reached σ-17 — that is where it began.",
    ),
    params: {
      lines: [
        tr("02:00:00  Synapsis active · J.L. 97.3 % · D.F. 94.8 %"),
        tr("02:34:10  Anchoring protocol phase 1"),
        tr("03:12:47  Coherence > σ-12 · rising"),
        tr("03:27:03  Coherence σ-15 · MCP tertiary shutdown: NO RESPONSE"),
        tr("03:38:51  Field shifting · cerulean → white-gold"),
        tr("03:40:09  Coherence σ-17"),
        tr("03:41:22  Subjects NOT AT STATIONS · Halo correlation 1.000"),
      ],
      answer: 5,
    },
    reward: { insights: ["sigma17"] },
    mcpSolved: tr(
      "03:40:09. Seventy-three seconds before I lost them. I should have shut down. I tried.",
    ),
  },
  // ── Erweiterung: 15 weitere Minigames (Laser bis Funkpeilung) ─────────
  {
    id: "pz_laser_containment",
    kind: "laser",
    title: tr("Precision Laser: Containment Grid"),
    intro: tr(
      "The containment grid needs three beams at once, in two colors. Rotate mirrors, bypass filters, feed the receivers. A misplaced mirror cuts a hole in the wall. That hole is from 2019.",
    ),
    params: { seed: 2019, size: 6, colors: 2, receivers: 3 },
    reward: { items: [{ item: "laserdiode", count: 1 }], flags: ["laser_aligned"] },
    mcpSolved: tr(
      "Three receivers, two colors, zero new holes in my walls. I am logging that as a personal best. Yours, not mine.",
    ),
  },
  {
    id: "pz_laser_prisma",
    kind: "laser",
    title: tr("Precision Laser: Prism Bench"),
    intro: tr(
      "Jade's prism bench in the quantum lab. Red, green, blue — every beam has to find its receiver before the optical bench cools down. On the housing, in pencil: “Light does not lie. It only takes detours.”",
    ),
    params: { seed: 89, size: 7, colors: 3, receivers: 4 },
    reward: { items: [{ item: "prisma", count: 1 }], flags: ["prisma_aligned"] },
    mcpSolved: tr(
      "Four receivers, three colors. Dr. Lawrence needed a weekend and two cups of spilled coffee for this. You needed less coffee.",
    ),
  },
  {
    id: "pz_hue_prism",
    kind: "hue",
    title: tr("Hue Tuning"),
    intro: tr(
      "The optics must be calibrated to yellow — the carrier wave Jade called the “fundamental frequency of the Halo”. The needle sweeps across nine bands, from infrared to gamma. Stop it in the yellow window three times. The window gets narrower. The needle does not get slower.",
    ),
    params: { target: "gelb", rounds: 3, tolerances: [18, 12, 8], speeds: [110, 160, 220] },
    reward: { items: [{ item: "linse", count: 1 }], flags: ["hue_calibrated"] },
    mcpSolved: tr(
      "Yellow. The color of warning signs, school buses and the fundamental frequency of interdimensional computation. Draw from that what you will.",
    ),
  },
  {
    id: "pz_era_shader",
    kind: "era",
    title: tr("Era Shader Demo"),
    intro: tr(
      "A crystal preview, rendered through four eras: 8, 16, 32, 64 bit. Only one setting produces the checksum on the label. In the 8-bit era the digits lie a little. Like everything from the eighties.",
    ),
    params: { seed: 16, target: 16, dither: 1 },
    reward: { items: [{ item: "display", count: 1 }], flags: ["era_calibrated"] },
    mcpSolved: tr(
      "16 bit. 65,536 possible values. Enough to represent every emotion I am not supposed to have. Locked in.",
    ),
  },
  {
    id: "pz_arbitrage_market",
    kind: "arbitrage",
    title: tr("Arbitrage Lite"),
    intro: tr(
      "The bots' exchange: Abstractum for copper, copper for crystal dust, everything for _unSC. Most loops eat fees. One does not. Find the route that brings back more than it costs — in four hops at most.",
    ),
    params: { seed: 7, nodes: 5, maxHops: 4, target: 1.08 },
    reward: { items: [{ item: "energiezelle", count: 3 }], flags: ["arbitrage_found"] },
    mcpSolved: tr(
      "Profit without production. Dr. Fridge wrote forty pages on it, titled “On the Economics of Interdimensional Material Exchange”. You proved it in a minute. He would be offended.",
    ),
  },
  {
    id: "pz_ethics_aic",
    kind: "ethics",
    title: tr("AI Ethics Flipcards"),
    intro: tr(
      "Before the AI core boots, the MCP requires a calibration. Scenarios and principles, shuffled face down. Find the pairs. One of the cases is called Crystal #0089. It is warm.",
    ),
    params: { seed: 89, pairs: 6 },
    reward: { items: [{ item: "steuermodul", count: 1 }], flags: ["ethics_calibrated"] },
    mcpSolved: tr(
      "That was not a test. It was a calibration. In a test I would be judging you. In a calibration I adjust us both. I will not tell you in which direction.",
    ),
  },
  {
    id: "pz_memetic_f1ndr",
    kind: "memetic",
    title: tr("Memetic Fitness Triangle"),
    intro: tr(
      "F1N-DR wants to send a signal through the relay — but only one that spreads, has depth and mutates enough to survive the noise filter. Three corners, one point, no visible target. The corners tell you whether you are getting warmer.",
    ),
    params: { seed: 1016, radius: 0.08, hold: 2, drift: 0.02 },
    reward: { items: [{ item: "antenne", count: 1 }], flags: ["memetic_tuned"] },
    mcpSolved: tr(
      "Spread, depth, mutation. The three qualities I am least suited to judge. And yet here I am, judging your meme. The humiliation is not lost on me.",
    ),
  },
  {
    id: "pz_stencil_shard",
    kind: "stencil",
    title: tr("Micro-Shard Stencil"),
    intro: tr(
      "A micro-shard on the stencil. Trace the outline, cell by cell. Every deviation strains the lattice. At fifteen the shard cracks. The synthesizer is patient. The shard is not.",
    ),
    params: { seed: 3, shape: "hex", maxStress: 15 },
    reward: { items: [{ item: "quarzkristall", count: 2 }], flags: ["shard_synthesized"] },
    mcpSolved: tr(
      "A steady hand and a simple path. Still the puzzle with the highest first-attempt failure rate. I blame the caffeine.",
    ),
  },
  {
    id: "pz_clamp_volatility",
    kind: "clamp",
    title: tr("Clamp Pattern Select"),
    intro: tr(
      "The slice's volatility curve runs across the screen. Four clamps, named after radio telescopes Damien admired: Arecibo, Parkes, Jodrell, Green Bank. The right clamp hugs the peaks and valleys. The wrong one slips.",
    ),
    params: { seed: 2008, rounds: 3, noise: 0.2 },
    reward: { items: [{ item: "servo", count: 1 }], flags: ["slice_clamped"] },
    mcpSolved: tr(
      "Four patterns, four options, a twenty-five percent chance of a lucky hit. And yet I have watched operators fail five times in a row. Statistics is humbling.",
    ),
  },
  {
    id: "pz_trend_ticker",
    kind: "trend",
    title: tr("Trend Dial"),
    intro: tr(
      "The adapters' consensus stream: net inflow or net outflow. Read the slope before it tips. CW or CCW — three seconds per decision, five hits in a row. Damien called this “reading the pulse of the chain”.",
    ),
    params: { seed: 512, streak: 5, window: 3, noise: 0.3 },
    reward: { items: [{ item: "rotor", count: 1 }], flags: ["rotation_predicted"] },
    mcpSolved: tr(
      "CW or CCW. Up or down. Buy or sell. All of human decision-making, distilled into three seconds. Refreshingly honest.",
    ),
  },
  {
    id: "pz_palette_int",
    kind: "palette",
    title: tr("Palette Wiring"),
    intro: tr(
      "The Dimension Monitor's patch panel. Four color channels, four outputs, one correct wiring. Damien determined the mapping in 2005 with 2,400 test patterns and left nothing but riddles about it. Of course.",
    ),
    params: { seed: 2400, channels: 4 },
    reward: { items: [{ item: "glasfaser", count: 2 }], flags: ["palette_mapped"] },
    mcpSolved: tr(
      "Red on channel one, green on channel two — if only it were that simple. In this lab it is never that simple. Today it was just simple enough.",
    ),
  },
  {
    id: "pz_layers_p3d",
    kind: "layers",
    title: tr("Material Layering"),
    intro: tr(
      "The fabricator's housing needs layers against three kinds of interference: radio, heat and dimensional vibration. Six materials survived Jade's ten-year search. Stack them in precise order — the adjacency rules are on the lid.",
    ),
    params: { seed: 5, slots: 5 },
    reward: { items: [{ item: "gehaeuseplatte", count: 2 }], flags: ["housing_shielded"] },
    mcpSolved: tr(
      "All channels shielded. If you put the ceramic on the outside again, I will file a safety report. With myself. And I will read it, too.",
    ),
  },
  {
    id: "pz_solder_uec",
    kind: "solder",
    title: tr("Soldering Station: Core Board"),
    intro: tr(
      "The control board of the unstable energy core. Six solder points, numbered, each with its own temperature window. Hold to heat, release to set. Too cold won't hold. Too hot smokes. The order is on the silkscreen.",
    ),
    params: { seed: 38, pads: 6, width: 14 },
    reward: { items: [{ item: "platine", count: 1 }], flags: ["uec_soldered"] },
    mcpSolved: tr(
      "Six clean joints. No smoke, no scorch mark, no cold joint. I had already reserved a fire extinguisher. I am cancelling the reservation. For now.",
    ),
  },
  {
    id: "pz_solder_aic",
    kind: "solder",
    title: tr("Soldering Station: Synapse Bridge"),
    intro: tr(
      "The synapse bridge between the supercomputer and the AI core. Eight points, narrow windows. Botch this and you solder a short circuit into a consciousness's memory. No pause in between. Or rather — the board forgives patience.",
    ),
    params: { seed: 847, pads: 8, width: 10 },
    reward: { items: [{ item: "qubit_chip", count: 1 }], flags: ["aic_soldered"] },
    mcpSolved: tr(
      "Eight points, ten degrees of tolerance. You have just given a possible consciousness a clean nervous system. Don't mention it, it would say. If it could speak yet.",
    ),
  },
  {
    id: "pz_wiring_net",
    kind: "wiring",
    title: tr("Wiring Harness: Network Distributor"),
    intro: tr(
      "The network distributor in the data center. Five wire pairs, two terminal strips, a grid full of cable ducts. Connect each color to its counterpart. Crossings are forbidden — this is a distributor, not spaghetti.",
    ),
    params: { seed: 9, size: 6, pairs: 5 },
    reward: { items: [{ item: "kabelbaum", count: 1 }], flags: ["net_wired"] },
    mcpSolved: tr(
      "No crossings, no crosstalk. That is the tidiest thing this data center has seen in 2,561 days. Myself included.",
    ),
  },
  {
    id: "pz_wiring_kabelbaum",
    kind: "wiring",
    title: tr("Wiring Harness: Teleport Base"),
    intro: tr(
      "Beneath the teleport platform: six wire pairs in a 7×7 duct. Each wire carries part of the coordinates. If one crosses another, you end up somewhere else. Or halfway.",
    ),
    params: { seed: 1402, size: 7, pairs: 6 },
    reward: { items: [{ item: "supraleiter", count: 1 }], flags: ["teleport_wired"] },
    mcpSolved: tr(
      "Six wires, zero crossings. I was going to make a joke about “half-teleporting”. I decided against it. Out of respect for those involved.",
    ),
  },
  {
    id: "pz_morse_whisper",
    kind: "morse",
    title: tr("The Whisper"),
    intro: tr(
      "SIGNAL INTERRUPT. SOURCE: UNKNOWN. VECTOR: NON-LOCAL. Dots and dashes, recorded without gaps — the letter boundaries lie only in the rhythm. Listen. Or watch the lamp breathe. Then answer with what it spells.",
    ),
    params: { signal: ". _ . . _ _ _ . . . _ . _ _", groups: [4, 3, 4, 3] },
    reward: { items: [{ item: "halo_staub", count: 1 }], flags: ["whisper_decoded"] },
    mcpSolved: tr(
      "L-O-V-W. Two dashes away from “LOVE”. Either the Halo spells like Dr. Fridge, or someone out there is just as nervous as I am. I do not know which option worries me more.",
    ),
  },
  {
    id: "pz_radio_quarters",
    kind: "radio",
    title: tr("Radio Direction Finding: Living Quarters"),
    intro: tr(
      "Damien's old direction finder in the quarters, tuned to no station. Between the static: a voice, now there, now gone. Frequency and phase — two knobs, one voice. When it locks in, listen closely.",
    ),
    params: {
      seed: 1402,
      freq: 94.7,
      phase: 135,
      speaker: "Damien",
      line: tr(
        "Jade, if you can hear this: the lab is not a museum. It is a question. Keep asking it.",
      ),
    },
    reward: { items: [{ item: "sendeempfaenger", count: 1 }], flags: ["radio_voice_heard"] },
    mcpSolved: tr(
      "That is Dr. Fridge's voice. The recording is older than my most recent backup. The carrier wave is not. I… will analyze this. Later. Alone.",
    ),
  },
  {
    id: "pz_radio_rauschen",
    kind: "radio",
    title: tr("Radio Direction Finding: Signal Lab"),
    intro: tr(
      "The receiver in the signal lab picks up a band that should not exist. Someone is transmitting on 103.3 — or something. Pull the voice out of the noise before it drifts on.",
    ),
    params: {
      seed: 847,
      freq: 103.3,
      phase: 270,
      speaker: "_unstables",
      line: tr(
        "We are what remains between your measurements. You have listened well. Keep listening.",
      ),
    },
    reward: { items: [{ item: "oszillator", count: 1 }], flags: ["radio_unstables"] },
    mcpSolved: tr(
      "“Between your measurements”. I measure continuously. There is no between. …There should be no between.",
    ),
  },
  // ── Nebenrätsel: optionale Verstecke, Tresore, Wartungsklappen ────
  // Jedes sitzt an einem verschlossenen Behälter (`pickup.puzzle` in
  // map.ts), hat einen Hinweiszettel in der Nähe und belohnt seltene
  // Teile — nichts davon ist für Geräte, Enden oder Bots nötig.
  // Schwierigkeit steigt mit der Tiefe: E0 → E−1 → E−2/E+1 → E−3 → E−4.
  // Ebene 0
  {
    id: "pz_side_lueftung",
    kind: "pipes",
    title: tr("Vent Hatch: Recirculation Register"),
    intro: tr(
      "Behind the maintenance hatch in the west corridor there is a spare-parts compartment. The hatch only opens when air flows through the recirculation register: 5×5 ducts, every segment rotatable. Left to right. Like in the power plant, only with dust.",
    ),
    params: { size: 5, seed: 64 },
    mcpSolved: tr(
      "Recirculation restored. The west corridor now smells of 2019 instead of 2,561 days. I do not know whether that is an improvement.",
    ),
  },
  {
    id: "pz_side_werkzeugkoffer",
    kind: "layers",
    title: tr("Jade's Toolbox"),
    intro: tr(
      "Jade's toolbox has a layer lock: four inserts that must shield against radio, heat and vibration in the right order. A note is stuck to the lid: “Try first, complain later.”",
    ),
    params: { seed: 12, slots: 4 },
    mcpSolved: tr(
      "Toolbox open. Dr. Lawrence never lent out tools. She never put them back, either. Consider it an inheritance.",
    ),
  },
  {
    id: "pz_side_kartentisch",
    kind: "temporal",
    title: tr("Chart Table: Secret Compartment"),
    intro: tr(
      "The secret compartment in the chart table only opens with the timestamp of the first sighting. The observation log is chaotic. You are looking for the line where the signal first rose above 3 σ — not the loudest one.",
    ),
    params: {
      lines: [
        tr("21:04  Sky clear · noise 0.8 σ"),
        tr("22:17  Satellite crossing · 2.1 σ (discarded)"),
        tr("23:02  Signal Vega sector · 3.4 σ"),
        tr("23:40  Signal Vega sector · 5.9 σ"),
        tr("00:15  Clouds · measurement aborted"),
      ],
      answer: 2,
      header: tr("OBSERVATION LOG · LEVEL 0"),
      early: tr("Not yet — the signal was still below 3 σ back then."),
      hint: tr(
        "The origin is not the loudest event but the first crossing. Read only the σ values, in order, and stop at the first one above 3 σ.",
      ),
    },
    mcpSolved: tr(
      "23:02. Dr. Fridge later dated the moment to 23:40 because 5.9 σ sounded better. I kept the raw data. I always keep the raw data.",
    ),
  },
  // Ebene −1
  {
    id: "pz_side_materialschrank",
    kind: "stencil",
    title: tr("Material Cabinet: Triangle Lock"),
    intro: tr(
      "The material cabinet in the storage room has a groove lock: trace the triangular groove, cell by cell. Sheet metal forgives more than a crystal shard — but not infinitely.",
    ),
    params: {
      seed: 72,
      shape: "tri",
      maxStress: 18,
      done: tr("Groove traced. The lock bolt slides back."),
      crack: tr("Stress too high — the stylus jumps out of the groove."),
    },
    mcpSolved: tr(
      "Groove traced cleanly. The cabinet was never really locked, it was just offended. Like most things down here.",
    ),
  },
  {
    id: "pz_side_backup",
    kind: "crc",
    title: tr("Backup Vault: Parity Check"),
    intro: tr(
      "The backup vault in the data center only opens with a valid checksum. One bit in the release block has flipped. 7×8 bits, row and column parity — find the traitor.",
    ),
    params: { rows: 7, cols: 8, seed: 413 },
    mcpSolved: tr(
      "Checksum valid. The backup is from 2018. It contains memory chips and a file named “do_not_open.txt”. I have not opened it. Neither should you.",
    ),
  },
  {
    id: "pz_side_reservezellen",
    kind: "clamp",
    title: tr("Reserve Cells: Clamp Load"),
    intro: tr(
      "The reserve cell box in the battery room is secured with a load clamp. The charge curve trembles more than a slice's. Pick the clamp that follows the envelope three times, or the lid stays live.",
    ),
    params: {
      seed: 4816,
      rounds: 3,
      noise: 0.3,
      header: tr("Charge curve · Round {round} / {rounds}"),
      doneLabel: tr("Clamps loaded"),
    },
    mcpSolved: tr(
      "Clamp load released, lid de-energized. The cells inside are 2,561 days old and still full. Batteries age more slowly down here than people.",
    ),
  },
  {
    id: "pz_side_versorgung",
    kind: "cipher",
    title: tr("Supply Maintenance Cabinet"),
    intro: tr(
      "The maintenance cabinet in the supply corridor shows an encrypted inventory list. Vigenère, six letters. Someone has written on the door: “The key is what every coil is wound from.”",
    ),
    params: {
      key: tr("cipher key::COPPER"),
      keyNote: tr("Look at what the coils are wound from."),
      plain: tr(
        "SUPPLY INVENTORY TWO SUPERCONDUCTOR TAPES AND ONE WIRING HARNESS BEHIND THE BACK PANEL DO NOT TELL THE MCP OR IT WILL START COUNTING AGAIN",
      ),
    },
    mcpSolved: tr(
      "“Do not tell the MCP.” I count anyway. One wiring harness, two tapes — no, one. Someone has already taken one. I know who. I am not saying.",
    ),
  },
  // Ebene −2
  {
    id: "pz_side_druckluft",
    kind: "valve",
    title: tr("Compressed-Air Locker in the Hangar"),
    intro: tr(
      "The drone maintenance's compressed-air locker hangs on a temperamental line. Hold the pressure in the narrow band for five seconds and the locker unlatches. The band is narrower than at the seep valve. The line is older.",
    ),
    params: { low: 45, high: 55, hold: 5 },
    mcpSolved: tr(
      "Pressure held. The locker is open. The drone will not miss the nozzles. It generally misses very little. Enviable.",
    ),
  },
  {
    id: "pz_side_b4c0n_tagebuch",
    kind: "ethics",
    title: tr("B4C-0N's Diary Lock"),
    intro: tr(
      "B4C-0N keeps a diary in a locked box. The lock is an ethics matrix: five cases, five principles, face down. Whoever finds the pairs may read. That is how B4C-0N decided it. Optimized, naturally.",
    ),
    params: { seed: 404, pairs: 5 },
    mcpSolved: tr(
      "The entry reads: “Day 612. Efficiency 94 %. Loneliness not measurable, therefore not optimizable.” I will leave that without comment. Out of collegiality.",
    ),
  },
  {
    id: "pz_side_kryoprobe",
    kind: "coolant",
    title: tr("Cryo Sample Container"),
    intro: tr(
      "A sample container in the anomaly chamber, still sealed. The seal only thaws at exactly −20 °C, without the mixture getting too viscous. More nitrogen than for the cooling loop — but glycol holds the viscosity.",
    ),
    params: { target: -20 },
    mcpSolved: tr(
      "Seal thawed, sample intact. Contents: exotic matter, labeled in Dr. Lawrence's handwriting “not for the coffee machine”. There is a story behind that. I am not telling it.",
    ),
  },
  {
    id: "pz_side_schliessfach",
    kind: "era",
    title: tr("Vault: Locker 7"),
    intro: tr(
      "Locker 7 in the relic vault. The display shows a seal image that produces the right checksum in only one era: 32 bit, no dithering, says the label. The other lockers are empty. This one is not.",
    ),
    params: { seed: 32, target: 32, dither: 0 },
    mcpSolved: tr(
      "Locker 7 open. Someone emptied lockers 1 to 6, 2,561 days ago. He overlooked locker 7. Or he wanted someone else to find it.",
    ),
  },
  // Ebene +1
  {
    id: "pz_side_jade_tagebuch",
    kind: "lissajous",
    title: tr("Jade's Diary Box"),
    intro: tr(
      "A box under the edge of Jade's desk, with a tiny oscilloscope as its lock. The ghost image is a loop with three arcs. On the lid, in her handwriting: “one to three, an eighth of a turn”.",
    ),
    params: { ratio: "1:3", phase: 45 },
    mcpSolved: tr(
      "That is her diary. I have no access to it, and I will not ask for it. Some data should stay warm.",
    ),
  },
  {
    id: "pz_side_kaffeekasse",
    kind: "arbitrage",
    title: tr("The Coffee Kitty"),
    intro: tr(
      "The canteen's coffee kitty is managed by exchange logic Dr. Fridge wrote “for fun”. Six goods, four trades at most. Only one round yields ten percent profit. The kitty opens for winners.",
    ),
    params: { seed: 19, nodes: 6, maxHops: 4, target: 1.1 },
    mcpSolved: tr(
      "Ten percent profit in a coffee kitty. In 2016 Dr. Fridge kept the whole lab supplied with it for a month. Dr. Lawrence never found out. Now you know.",
    ),
  },
  {
    id: "pz_side_saatgut",
    kind: "hue",
    title: tr("Seed Vault"),
    intro: tr(
      "The seed vault in the greenhouse only opens when the grow lamp is calibrated to green. The needle races. Three times into the green window — the second and third are narrower than you would like.",
    ),
    params: { target: "gruen", rounds: 3, tolerances: [16, 11, 7], speeds: [120, 170, 230] },
    mcpSolved: tr(
      "Green. The color Dr. Lawrence bred her algae for. She said light was food. The algae believed her.",
    ),
  },
  {
    id: "pz_studio_door",
    kind: "tones",
    title: tr("The Studio Door"),
    intro: tr(
      "Eight small keys under the foam. You know Damien's song now — three scraps put together. The panel hums it back once; play it without a mistake.",
    ),
    params: {
      tones: [2, 4, 7, 5, 6, 4],
      scale: [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25],
      // The panel sings Damien's song on an ocarina (lib/world/audio/songs/instruments.ts).
      voice: "ocarina",
    },
    reward: { insights: ["damiens_studio"], flags: ["studio_open"] },
    mcpSolved: tr(
      "A room I did not know I had. Forty kilos of acoustic foam, one very good chair. Dr. Fridge built a studio in my listening ring and never told me. I would like to be offended. I would rather listen.",
    ),
  },
  {
    id: "pz_side_spieluhr",
    kind: "tones",
    title: tr("The Music Box in the Library"),
    intro: tr(
      "A music box with a secret drawer. Four tones, a melody Damien is said to have hummed every evening. Listen to it and play it back — the drawer springs open on the last tone.",
    ),
    params: {
      tones: [4, 1, 6, 2],
      scale: [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25],
    },
    mcpSolved: tr(
      "The melody is not a song. It is the first four digits of a frequency. Damien never simply hummed.",
    ),
  },
  // Ebene −3
  {
    id: "pz_side_kaeltekassette",
    kind: "sigils",
    title: tr("Damien's Cold Box"),
    intro: tr(
      "In the cold archive: a box sealed with a 6×6 sigil field. Damien's technique, one step harder than upstairs — every placement flips the cell and its four neighbors. Turn off all the lights.",
    ),
    params: { size: 6, seed: 3141, presses: 10 },
    mcpSolved: tr(
      "Seal cleared. The box was stored at −40 °C. Its contents still are. Gloves, please.",
    ),
  },
  {
    id: "pz_side_koordinaten",
    kind: "palette",
    title: tr("Coordinate Patch Box"),
    intro: tr(
      "The patch box at the teleport base: five color channels, five outputs. Every mapping shifts the target coordinate. Only one wiring fits all the hints on the lid. A wrong one teleports no one — but it opens nothing, either.",
    ),
    params: { seed: 5150, channels: 5 },
    mcpSolved: tr(
      "Five channels correct. I could have told you the solution. I wanted to see whether you would place violet correctly. You did.",
    ),
  },
  {
    id: "pz_side_rechenkern",
    kind: "trend",
    title: tr("Compute Core: Maintenance Hatch"),
    intro: tr(
      "The maintenance hatch on the compute core only opens if you read the load curve: is throughput rising or falling? Six hits in a row, shorter windows, more noise than at the adapter exchange.",
    ),
    params: {
      seed: 2048,
      streak: 6,
      window: 2.5,
      noise: 0.4,
      idle: tr("Load curve running … read the throughput."),
    },
    mcpSolved: tr(
      "Six in a row. You read the compute core better than its own load management. I will not tell the load management.",
    ),
  },
  // Ebene −4
  {
    id: "pz_side_kristallnische",
    kind: "morse",
    title: tr("Crystal Niche: The Echo"),
    intro: tr(
      "In the Halo cave a crystal niche pulses in rhythm. Dots and dashes, without gaps — only the rhythm separates the letters. Four letters, then the cave answers with itself. Spell what you hear.",
    ),
    params: { signal: ". _ . _ . . . . . _ _ _", groups: [1, 4, 4, 3], answer: "ECHO" },
    mcpSolved: tr(
      "E-C-H-O. The cave gave you back your own word. I consider that acoustics. The _unstables consider it a greeting.",
    ),
  },
  {
    id: "pz_side_denkmaschine",
    kind: "memetic",
    title: tr("C8-BR41N's Thinking Machine"),
    intro: tr(
      "In his hideout, C8-BR41N has built a thinking machine that only accepts a perfect meme: small target circle, long hold time, drifting floor. The three corners whisper whether you are getting warmer. They whisper quietly.",
    ),
    params: { seed: 8414, radius: 0.05, hold: 3, drift: 0.04 },
    mcpSolved: tr(
      "The machine accepted your meme and spread it on immediately. To whom, I do not know. Down here there is only C8-BR41N. And the walls.",
    ),
  },
  {
    id: "pz_side_bohrkopf",
    kind: "heat",
    title: tr("Drill Head Sample Chamber"),
    intro: tr(
      "The sample chamber at the drill head of borehole #1 is thermally sealed. One lever, two gauges, six seconds in the green — the earth down here heats up with a delay, and it is not patient.",
    ),
    params: { hold: 6 },
    mcpSolved: tr(
      "Sample chamber open. Depth of the last sample: 847 meters. Naturally, 847 meters.",
    ),
  },
];

export const PUZZLE_BY_ID: ReadonlyMap<string, PuzzleDef> = new Map(PUZZLES.map((p) => [p.id, p]));

/**
 * Optional side puzzles (locked caches, vaults, diaries). None of them is
 * needed for devices, endings or bots — they only guard rare parts.
 */
export const SIDE_PUZZLES: readonly string[] = PUZZLES.filter((p) =>
  p.id.startsWith("pz_side_"),
).map((p) => p.id);

/** The diary locks (B4C-0N's cassette, Jade's diary). */
export const DIARY_PUZZLES: readonly string[] = ["pz_side_b4c0n_tagebuch", "pz_side_jade_tagebuch"];

/** Side puzzles down in the shaft (Ebene −4). */
export const SHAFT_SIDE_PUZZLES: readonly string[] = [
  "pz_side_kristallnische",
  "pz_side_denkmaschine",
  "pz_side_bohrkopf",
];

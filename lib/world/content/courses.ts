/**
 * Study courses on Jade's computer (content).
 * ===========================================
 *
 * Jade can keep learning at her computer (Jade's Quarters): each course is
 * studied for some play minutes (lessons unlock as she goes), then a short
 * check (quiz) completes it. A finished course raises its knowledge area and
 * may grant a small, balanced perk (checked with `hasPerk`, lib/world/perks.ts;
 * the effect is implemented where the rule lives — see `PERK_TUNING`).
 *
 * Lessons ARE real game knowledge (in-world teaching, derived from the rules
 * in game.ts, combine.ts, biorhythm.ts, firmware.ts, device-ops.ts,
 * archive.ts), so players never need an outside guide. German in
 * lib/i18n/de/courses.ts.
 */
import { tr } from "@/lib/i18n";
import type { Condition, KnowledgeArea } from "@/lib/world/types";

export interface QuizQuestion {
  q: string;
  options: readonly string[];
  /** Index of the right option. */
  answer: number;
}

export interface CourseDef {
  id: string;
  area: KnowledgeArea;
  title: string;
  blurb: string;
  /** Study time at the computer (play minutes). */
  minutes: number;
  requires?: Condition;
  requiresHint?: string;
  /** Lessons unlock evenly over the study time. */
  lessons: readonly string[];
  quiz: readonly QuizQuestion[];
  perk?: { id: string; label: string; text: string };
}

export const COURSES: readonly CourseDef[] = [
  // ── Power ──────────────────────────────────────────────────────
  {
    id: "c_grid_basics",
    area: "power",
    title: tr("Grid basics for the underground"),
    blurb: tr("Why the lab browns out, and in which order it gives up."),
    minutes: 3,
    lessons: [
      tr(
        "Generation minus demand is all that matters. Every consumer draws its full rated power while it runs.",
      ),
      tr(
        "The grid serves the battery, the MCP, the power controller and the thermal manager first — everything else in a fixed order after them.",
      ),
      tr(
        "A consumer that does not fit is starved, not damaged. Switch something off and it comes back.",
      ),
    ],
    quiz: [
      {
        q: tr("What happens to a device when the grid runs short?"),
        options: [tr("It breaks"), tr("It is starved until power is free"), tr("It explodes")],
        answer: 1,
      },
      {
        q: tr("Which of these is served first?"),
        options: [tr("The 3D Fabricator"), tr("The Explorer Drone"), tr("The Battery Pack")],
        answer: 2,
      },
    ],
  },
  {
    id: "c_power_sources",
    area: "power",
    title: tr("Where the watts come from"),
    blurb: tr("Core, battery, geothermal, fusion — and a display that pays for itself."),
    minutes: 4,
    requires: { device: "UEC-001", state: "built" },
    lessons: [
      tr(
        "The Unstable Energy Core delivers about 150 W. About, because its output wanders a little from day to day.",
      ),
      tr(
        "The Battery Pack draws nothing and adds a 40 W buffer the moment it is online — enough to keep the MCP alive on its own.",
      ),
      tr(
        "The geothermal tap gives 50 W once routed, and another 100 W at full load while the Power Management System is online.",
      ),
      tr(
        "The Power Display Panel adds 20 W of reactive power compensation; the Volt Meter fills in the core's daily dip.",
      ),
      tr("The Microfusion Reactor is the big one: 250 W, more with its fuel-autotune update."),
    ],
    quiz: [
      {
        q: tr("How much buffer does the Battery Pack add?"),
        options: [tr("10 W"), tr("40 W"), tr("150 W")],
        answer: 1,
      },
      {
        q: tr("What does the Volt Meter Display do for the grid?"),
        options: [
          tr("It fills in the core's daily dip"),
          tr("It doubles the battery"),
          tr("Nothing, it only shows numbers"),
        ],
        answer: 0,
      },
    ],
  },
  {
    id: "c_priority_circuits",
    area: "power",
    title: tr("Priority circuits and cooling"),
    blurb: tr("Telling the grid who matters — and keeping the heavy machines cool."),
    minutes: 5,
    requires: { device: "PWR-001", state: "built" },
    lessons: [
      tr(
        "Devices linked to the Power Management System are served right after the grid's head, before everyone else.",
      ),
      tr("The PWR-001 hub takes six links; its fusion-sequencer update adds two more circuits."),
      tr(
        "Heavy tier-3 machines overheat without a running Thermal Manager. They do not break — they simply stay off.",
      ),
      tr(
        "Machines linked to the Thermal Manager draw 10 % less; with its loop-balancer update, 20 % less.",
      ),
    ],
    quiz: [
      {
        q: tr("What do heavy tier-3 machines need to run?"),
        options: [tr("A running Thermal Manager"), tr("A full battery"), tr("A keypad code")],
        answer: 0,
      },
      {
        q: tr("How much less does a machine draw on the thermal loop (factory firmware)?"),
        options: [tr("5 %"), tr("10 %"), tr("50 %")],
        answer: 1,
      },
    ],
  },

  // ── Building & fabrication ────────────────────────────────────
  {
    id: "c_build_rule",
    area: "building",
    title: tr("Frame, core, calibration"),
    blurb: tr("The three stages every device goes through."),
    minutes: 2,
    lessons: [
      tr(
        "Every device is built in three stages: frame, core, calibration. Each stage asks for parts with certain traits, not certain names.",
      ),
      tr(
        "Any part whose traits meet a requirement fits — a prototype of your own counts as much as a factory part.",
      ),
      tr(
        "Blueprints are discovered, not bought: through insights, finished neighbours or a prototype that happens to resemble one.",
      ),
    ],
    quiz: [
      {
        q: tr("What does a build stage really ask for?"),
        options: [tr("A part with the right name"), tr("Parts with enough traits"), tr("Money")],
        answer: 1,
      },
      {
        q: tr("Which stage comes last?"),
        options: [tr("Frame"), tr("Core"), tr("Calibration")],
        answer: 2,
      },
    ],
  },
  {
    id: "c_salvage",
    area: "building",
    title: tr("Salvage and scrap"),
    blurb: tr("Scrap piles, tools, and what grows back."),
    minutes: 3,
    requires: { device: "BTK-001", state: "built" },
    lessons: [
      tr(
        "By hand a pile gives only its first stack. With the right tool online the rest comes out too.",
      ),
      tr(
        "Some piles refill over time. The Lab Clock's event scheduler brings refills sooner; the geothermal seep runs twice as fast with the Abstractum Tank.",
      ),
      tr(
        "The Basic Toolkit takes things apart again — one part is usually lost, unless its torque profiles save a two-part assembly.",
      ),
    ],
    quiz: [
      {
        q: tr("What do you get from a pile by hand when it needs a tool?"),
        options: [tr("answer::Nothing"), tr("Only its first stack"), tr("Everything, but slower")],
        answer: 1,
      },
      {
        q: tr("What usually happens when you take something apart?"),
        options: [tr("One part is lost"), tr("You get a bonus part"), tr("It explodes")],
        answer: 0,
      },
    ],
    perk: {
      id: "scrap_sense",
      label: tr("perk::Scrap sense"),
      text: tr("Every fourth pile you clear gives one part more."),
    },
  },
  {
    id: "c_fabrication",
    area: "building",
    title: tr("Printing parts"),
    blurb: tr("The 3D Fabricator, filament and patterns."),
    minutes: 5,
    requires: { device: "P3D-001", state: "built" },
    lessons: [
      tr(
        "The 3D Fabricator prints any component you have held before — the pattern is remembered, not the part.",
      ),
      tr("Every print needs one Base Alloy as filament."),
      tr("With the purge-saver update every third print needs no filament at all."),
      tr(
        "One-of-a-kind relics (the screwdriver, Crystal #0089, the anomalous core …) can be neither printed nor taken apart nor combined.",
      ),
    ],
    quiz: [
      {
        q: tr("What does one print cost?"),
        options: [tr("1× Base Alloy"), tr("50 W for an hour"), tr("A prototype")],
        answer: 0,
      },
      {
        q: tr("Which parts can be printed?"),
        options: [
          tr("Anything, even relics"),
          tr("Components you have held before"),
          tr("Only prototypes"),
        ],
        answer: 1,
      },
    ],
  },

  // ── Combining ──────────────────────────────────────────────────
  {
    id: "c_combine_basics",
    area: "combining",
    title: tr("Workbench fundamentals"),
    blurb: tr("Recipes, prototypes and why the same mix always gives the same thing."),
    minutes: 3,
    requires: { device: "PWB-001", state: "built" },
    lessons: [
      tr(
        "Any two or more parts combine into something. A known recipe gives its product; anything else becomes a prototype.",
      ),
      tr("A plain workbench has three slots; with the Portable Workbench online you get six."),
      tr(
        "A prototype sums its inputs' traits with 20 % loss, adds synergies, then one emergent bonus seeded by the exact mix.",
      ),
      tr(
        "The rules are deterministic: the same inputs always give the same result. Write good mixes down.",
      ),
    ],
    quiz: [
      {
        q: tr("How many slots does the Portable Workbench give?"),
        options: [tr("Three"), tr("Four"), tr("Six")],
        answer: 2,
      },
      {
        q: tr("Combining the same parts again gives …"),
        options: [tr("Something random"), tr("The same result"), tr("Always slag")],
        answer: 1,
      },
      {
        q: tr("How much of the inputs' traits is lost in a prototype?"),
        options: [tr("20 %"), tr("50 %"), tr("None")],
        answer: 0,
      },
    ],
  },
  {
    id: "c_volatility",
    area: "combining",
    title: tr("Volatility, or: why the bench has scorch marks"),
    blurb: tr("Counting before combining. Mostly."),
    minutes: 4,
    requires: { insight: "prototypen" },
    requiresHint: tr("Build your first prototype at a workbench."),
    lessons: [
      tr(
        "Every part has a volatility. Add them up (times their count): above 12 the mix explodes into slag.",
      ),
      tr(
        "The first time a particular mix blows up, it may leave a small side product. The same explosion again leaves only slag.",
      ),
      tr(
        "A prototype's own volatility follows its wildest input; two hot inputs add one, a lot of heat (thermal 6+) takes one away.",
      ),
      tr(
        "The Exotic Matter Containment's breach-guard catches one input part when a mix explodes.",
      ),
    ],
    quiz: [
      {
        q: tr("Above which summed volatility does a mix explode?"),
        options: [tr("6"), tr("12"), tr("20")],
        answer: 1,
      },
      {
        q: tr("What calms a prototype's volatility?"),
        options: [tr("Thermal 6 or more"), tr("More inputs"), tr("Combining at night")],
        answer: 0,
      },
    ],
    perk: {
      id: "blast_catch",
      label: tr("perk::Catch reflex"),
      text: tr("When a mix explodes and no containment field catches anything, you save one part."),
    },
  },
  {
    id: "c_synergies",
    area: "combining",
    title: tr("Synergies and archetypes"),
    blurb: tr("When two traits make a third, and when a prototype gets a name."),
    minutes: 5,
    requires: { counter: "combo_prototype", min: 3 },
    requiresHint: tr("Build three prototypes first."),
    lessons: [
      tr(
        "When two axes are both at 2 or more, a synergy adds a third: energy + signal gives data (modulation), optics + resonance gives quantum.",
      ),
      tr(
        "Thermal + mechanics gives energy, quantum + data gives signal, energy + quantum gives heat.",
      ),
      tr(
        "A prototype whose finished profile meets an archetype's rule gets its name, colour and property — its traits stay the same.",
      ),
      tr(
        "Example: quantum 6 and resonance 6 make a Halo Tuning Fork, which is not used up when tuning puzzles or opening hidden doors.",
      ),
    ],
    quiz: [
      {
        q: tr("What does energy + signal give?"),
        options: [tr("Heat"), tr("Data"), tr("Optics")],
        answer: 1,
      },
      {
        q: tr("What does an archetype change?"),
        options: [
          tr("Name, colour and property — not the traits"),
          tr("Only the traits"),
          tr("Nothing at all"),
        ],
        answer: 0,
      },
    ],
  },

  // ── Signals ────────────────────────────────────────────────────
  {
    id: "c_readouts",
    area: "signals",
    title: tr("Reading the needles"),
    blurb: tr("Every device has something to say. Listen properly."),
    minutes: 3,
    lessons: [
      tr(
        "Using an online device gives its live readout: monitors, clock, compass, power — each speaks for itself.",
      ),
      tr(
        "The last readout of every device is kept in your knowledge panel. Useful numbers, filed automatically.",
      ),
      tr(
        "Some devices react to what you already know: operating them with the right insight can reveal the next one.",
      ),
    ],
    quiz: [
      {
        q: tr("When does a device give a readout?"),
        options: [
          tr("When it is online and used"),
          tr("Only after a firmware update"),
          tr("Never"),
        ],
        answer: 0,
      },
      {
        q: tr("Where is the last readout kept?"),
        options: [tr("Nowhere"), tr("In the knowledge panel"), tr("On a cork board")],
        answer: 1,
      },
    ],
    perk: {
      id: "second_look",
      label: tr("perk::Second look"),
      text: tr("Every device readout gets one more line: the grid margin."),
    },
  },
  {
    id: "c_tones",
    area: "signals",
    title: tr("Tones, whispers and handshakes"),
    blurb: tr("Acoustics for people who work underground."),
    minutes: 5,
    requires: { device: "ECR-001", state: "built" },
    lessons: [
      tr(
        "The whisper in the Echo Recorder's noise is too quiet without the Narrow Speaker. Build SPK-001 first.",
      ),
      tr(
        "The Handmade Synthesizer can play the four-tone handshake — once you know the four tones and a speaker can answer.",
      ),
      tr("Which four tones? Damien's log #0512 knows. So does F1N-DR."),
      tr(
        "The Oscilloscope Array's trend dial and the Interpolator's prism are puzzles of patience, not of luck.",
      ),
    ],
    quiz: [
      {
        q: tr("What does the whisper in the noise need?"),
        options: [tr("The Narrow Speaker"), tr("More volume on the core"), tr("A quiet night")],
        answer: 0,
      },
      {
        q: tr("Who knows the four tones?"),
        options: [tr("B4-C0N"), tr("Damien's log #0512 and F1N-DR"), tr("Nobody")],
        answer: 1,
      },
    ],
  },

  // ── Anomalies ──────────────────────────────────────────────────
  {
    id: "c_anomaly_field",
    area: "anomalies",
    title: tr("Field notes on anomalies"),
    blurb: tr("They are not faults. They are neighbours."),
    minutes: 5,
    requires: { device: "AND-001", state: "built" },
    lessons: [
      tr("The Anomaly Detector draws 15 W. It listens for what the lab should not contain."),
      tr(
        "Once the Nexus has researched Anomaly Synthesis, 2× Halo Crystal Shard + 2× Energy Cell make an Anomalous Core — with the detector online.",
      ),
      tr("The Dimension Monitor's rift has no colours until you have heard who is speaking in it."),
      tr("An Anomalous Core is one of a kind: it never goes on the workbench."),
    ],
    quiz: [
      {
        q: tr("What does the Anomalous Core recipe need online?"),
        options: [tr("The Anomaly Detector"), tr("The Explorer Drone"), tr("The Lab Clock")],
        answer: 0,
      },
      {
        q: tr("Can an Anomalous Core be combined?"),
        options: [tr("Yes, like any part"), tr("No, it is one of a kind")],
        answer: 1,
      },
    ],
  },
  {
    id: "c_membrane",
    area: "anomalies",
    title: tr("The thin membrane"),
    blurb: tr("Damien's theory, as far as anyone can follow it."),
    minutes: 6,
    requires: { insight: "anomalie_hoert" },
    lessons: [
      tr(
        "Damien's notes treat the anomaly as something that listens — it reacts to what is played near it.",
      ),
      tr(
        "Tamed is not the same as understood. The core that remains still listens; it simply stopped fighting.",
      ),
      tr(
        "Where the membrane is thin, doors can open from the inside. Watch for walls that sound hollow.",
      ),
    ],
    quiz: [
      {
        q: tr("What does a tamed anomaly still do?"),
        options: [tr("Listen"), tr("Explode"), tr("answer::Nothing")],
        answer: 0,
      },
      {
        q: tr("Where can doors open from the inside?"),
        options: [tr("Where the membrane is thin"), tr("Only in the kitchen"), tr("Nowhere")],
        answer: 0,
      },
    ],
  },

  // ── Quantum physics ────────────────────────────────────────────
  {
    id: "c_quantum_hardware",
    area: "quantum",
    title: tr("Quantum hardware for the hopeful"),
    blurb: tr("Containment, state monitors and the teleport pad's electricity bill."),
    minutes: 6,
    requires: { device: "EMC-001", state: "built" },
    lessons: [
      tr(
        "The Exotic Matter Containment draws 40 W and needs a running Thermal Manager — like every heavy tier-3 machine.",
      ),
      tr("The Quantum State Monitor draws 22 W; its lab update brings that down to 15 W."),
      tr("The Teleport Pad is the hungriest machine in the lab: 100 W, or 60 W with its update."),
      tr(
        "Quantum rarely comes from a single part: optics + resonance and signal + resonance both give quantum as a synergy.",
      ),
    ],
    quiz: [
      {
        q: tr("What do tier-3 machines like the containment need?"),
        options: [tr("A running Thermal Manager"), tr("A keypad"), tr("answer::Nothing")],
        answer: 0,
      },
      {
        q: tr("Which synergy gives quantum?"),
        options: [tr("Thermal + mechanics"), tr("Optics + resonance"), tr("Energy + optics")],
        answer: 1,
      },
    ],
  },
  {
    id: "c_halo_state",
    area: "quantum",
    title: tr("The Halo is a state"),
    blurb: tr("Not a thing, not a place. Bring coffee."),
    minutes: 7,
    requires: { insight: "halo_zustand" },
    lessons: [
      tr(
        "The margin notes H, A, L and O were never a signature. Together they are a key — and the Halo is what it opens: a state, not an object.",
      ),
      tr(
        "Crystal #0089 was broken into thirty slices and scattered through the lab. Each slice is a facet of the same record.",
      ),
      tr(
        "A state can be measured, disturbed and prepared again. Damien's notes circle this idea for pages.",
      ),
    ],
    quiz: [
      {
        q: tr("Into how many slices was Crystal #0089 broken?"),
        options: [tr("Four"), tr("Thirty"), tr("847")],
        answer: 1,
      },
      {
        q: tr("What is the Halo, according to the notes?"),
        options: [tr("A state"), tr("A building"), tr("A bot")],
        answer: 0,
      },
    ],
  },

  // ── Systems & networks ─────────────────────────────────────────
  {
    id: "c_firmware",
    area: "systems",
    title: tr("Firmware without tears"),
    blurb: tr("Check, download, verify, flash, reboot."),
    minutes: 4,
    requires: { device: "DGN-001", state: "built" },
    lessons: [
      tr(
        "An update always runs the same way: check, download, verify, flash, reboot. Skip nothing.",
      ),
      tr(
        "Preconditions: the installed version is at least the update's minimum, the checksum matches, the device is online and not busy.",
      ),
      tr("A rollback restores the factory image. Nothing is lost except the update's feature."),
      tr(
        "Every lab update adds one feature: a faster drone, a bigger battery buffer, a cheaper printer, a quicker research cycle …",
      ),
    ],
    quiz: [
      {
        q: tr("Which step comes right before flashing?"),
        options: [tr("Download"), tr("Verify"), tr("Reboot")],
        answer: 1,
      },
      {
        q: tr("What does a rollback restore?"),
        options: [tr("The factory image"), tr("Yesterday's save"), tr("The power grid")],
        answer: 0,
      },
    ],
  },
  {
    id: "c_links",
    area: "systems",
    title: tr("Hubs and links"),
    blurb: tr("Six buses, one cable salad."),
    minutes: 4,
    requires: { device: "NET-001", state: "built" },
    lessons: [
      tr(
        "Six hubs, six buses: MCP (admin, 8 links), Network Monitor (data, 10), Power Management (power, 6), Thermal Manager (thermal, 6), Diagnostics (diag, 6), Supercomputer (compute, 4).",
      ),
      tr(
        "The Network Monitor can mirror firmware images to linked devices once its fw-mirror feature is installed.",
      ),
      tr(
        "Every online machine linked to the Supercomputer Array adds one research point per Nexus cycle.",
      ),
    ],
    quiz: [
      {
        q: tr("Which hub takes the most links?"),
        options: [tr("The MCP"), tr("The Network Monitor"), tr("The Supercomputer Array")],
        answer: 1,
      },
      {
        q: tr("What does a machine on the compute mesh add?"),
        options: [tr("One research point per cycle"), tr("10 W"), tr("A new blueprint")],
        answer: 0,
      },
    ],
  },
  {
    id: "c_research",
    area: "systems",
    title: tr("Research on the Nexus"),
    blurb: tr("Points, cycles and processes nobody knew yet."),
    minutes: 5,
    requires: { device: "NXS-01", state: "built" },
    lessons: [
      tr("Each Nexus cycle gives 5 research points; the next cycle is ready after 90 seconds."),
      tr(
        "Topics unlock at 5, 10 and 20 points: Slag Recovery, Synapsis Reconstruction, Anomaly Synthesis.",
      ),
      tr(
        "Research-gated recipes do nothing until their topic is done. The workbench tells you which one is missing.",
      ),
      tr(
        "The Nexus' prereq-chain update adds 2 points per cycle; an updated AI core shortens the cycle to 60 seconds.",
      ),
    ],
    quiz: [
      {
        q: tr("How many points does one Nexus cycle give (factory)?"),
        options: [tr("1"), tr("5"), tr("20")],
        answer: 1,
      },
      {
        q: tr("Which topic comes first?"),
        options: [tr("Anomaly Synthesis"), tr("Slag Recovery"), tr("Synapsis Reconstruction")],
        answer: 1,
      },
    ],
    perk: {
      id: "research_notes",
      label: tr("perk::Research notes"),
      text: tr("Your notes save the Nexus some work: +1 research point per cycle."),
    },
  },

  // ── People & bots ──────────────────────────────────────────────
  {
    id: "c_study_method",
    area: "people",
    title: tr("How to study"),
    blurb: tr("Damien's method, Jade's corrections."),
    minutes: 2,
    lessons: [
      tr(
        "Write things down. Whatever you remember lands in your head; file it on your computer or pin it to a board when it gets crowded.",
      ),
      tr(
        "Damien asked why before how. Jade asks how, then checks why. Both methods pass the quiz.",
      ),
      tr("Short sessions work. The lessons wait for you; the lab does not."),
    ],
    quiz: [
      {
        q: tr("Where can a memo be filed?"),
        options: [
          tr("In your head, on your computer or on a board"),
          tr("Only in the terminal"),
          tr("Nowhere, memos are lost"),
        ],
        answer: 0,
      },
      {
        q: tr("What did Damien ask first?"),
        options: [tr("How"), tr("Why"), tr("When is lunch")],
        answer: 1,
      },
    ],
    perk: {
      id: "speed_reader",
      label: tr("perk::Speed reading"),
      text: tr("You study 25 % faster."),
    },
  },
  {
    id: "c_bots",
    area: "people",
    title: tr("Waking the bots"),
    blurb: tr("Every bot needs something. Usually not a hug."),
    minutes: 4,
    requires: { insight: "mcp_schuld" },
    requiresHint: tr("Learn why the bots went dark."),
    lessons: [
      tr(
        "A sleeping bot wakes with its missing part — or with a prototype whose traits match its profile.",
      ),
      tr(
        "X0-R8T wants signal 6 (an antenna). B4-C0N wants energy 7 (a battery cell). D3-C4D3 wants optics 6 (a lens).",
      ),
      tr(
        "L0G-1K wants data 7 and signal 2 (a control module); K2-LDR wants data 9 (two memory chips).",
      ),
      tr("Talk to them afterwards. Awake bots know things nobody wrote down."),
    ],
    quiz: [
      {
        q: tr("What else wakes a bot besides its missing part?"),
        options: [
          tr("A prototype matching its profile"),
          tr("Switching the lights off"),
          tr("answer::Nothing"),
        ],
        answer: 0,
      },
      {
        q: tr("What does B4-C0N need?"),
        options: [tr("Optics 6"), tr("Energy 7"), tr("Data 9")],
        answer: 1,
      },
    ],
  },

  // ── Exploration ────────────────────────────────────────────────
  {
    id: "c_archive_method",
    area: "exploration",
    title: tr("Archive method"),
    blurb: tr("Reading, searching, and combining what you found."),
    minutes: 3,
    lessons: [
      tr(
        "Boards, posters, screens and notes are read. Lockers, vents, drawers and shelves can be searched — every one of them, empty or not.",
      ),
      tr(
        "Finds come in five tiers: open, tucked away, hidden, well hidden, buried. The deeper, the more they count.",
      ),
      tr(
        "Some records only make sense together. When you have their parts, enter the answer at the archive console.",
      ),
      tr("An empty locker is information too. Note where you have already looked."),
    ],
    quiz: [
      {
        q: tr("How many archive tiers are there?"),
        options: [tr("Three"), tr("Five"), tr("Ten")],
        answer: 1,
      },
      {
        q: tr("Where are combined records entered?"),
        options: [tr("At the workbench"), tr("At the archive console"), tr("In the fridge")],
        answer: 1,
      },
    ],
    perk: {
      id: "search_sense",
      label: tr("perk::Search sense"),
      text: tr(
        "An empty search tells you when another spot in the same room still hides something.",
      ),
    },
  },
  {
    id: "c_drone",
    area: "exploration",
    title: tr("Drone flight"),
    blurb: tr("Sending something small where you would rather not go."),
    minutes: 4,
    requires: { device: "EXD-001", state: "built" },
    lessons: [
      tr(
        "The Explorer Drone draws 40 W and flies into the shaft. It needs 150 seconds to recharge between flights.",
      ),
      tr(
        "The first flight maps the sealed shaft — after it, the emergency elevator goes down to Level −4.",
      ),
      tr("Every flight brings back parts; its fast-return update shortens the recharge to 125 s."),
    ],
    quiz: [
      {
        q: tr("What does the first drone flight unlock?"),
        options: [tr("The elevator to Level −4"), tr("A new bot"), tr("answer::Nothing")],
        answer: 0,
      },
      {
        q: tr("How long does the drone recharge (factory)?"),
        options: [tr("30 s"), tr("150 s"), tr("One day")],
        answer: 1,
      },
    ],
    perk: {
      id: "drone_routes",
      label: tr("perk::Planned routes"),
      text: tr("Pre-planned routes: the drone recharges 15 % faster."),
    },
  },

  // ── Body & rhythm ──────────────────────────────────────────────
  {
    id: "c_biorhythm",
    area: "body",
    title: tr("Biorhythm"),
    blurb: tr("Food, water, sleep, fitness. The MCP is watching, gently."),
    minutes: 2,
    requires: { counter: "bio_on_at", min: 1 },
    requiresHint: tr("Visit the Living Quarters (Level +1) first."),
    lessons: [
      tr(
        "Four needs: satiation, hydration, rest and fitness. They drift down slowly while you play; thirst fastest.",
      ),
      tr(
        "Below 20 a need is low and you walk a little slower. Nothing breaks and nothing is lost.",
      ),
      tr(
        "Every need at 60 or more and fitness at 70 or more: balanced — you walk a little faster.",
      ),
      tr(
        "Food and drink from the Neutro-Fridge restore 25 % more. Sleep only works below 90 rest, and the lab keeps running while you sleep.",
      ),
    ],
    quiz: [
      {
        q: tr("Which need drops fastest?"),
        options: [tr("Fitness"), tr("Hydration"), tr("Rest")],
        answer: 1,
      },
      {
        q: tr("What does a low need do?"),
        options: [tr("Jade walks a little slower"), tr("You lose items"), tr("Game over")],
        answer: 0,
      },
      {
        q: tr("Straight from the fridge, food restores …"),
        options: [tr("25 % more"), tr("the same"), tr("less")],
        answer: 0,
      },
    ],
    perk: {
      id: "steady_rhythm",
      label: tr("perk::Steady rhythm"),
      text: tr("Your needs drift down 10 % slower."),
    },
  },
  {
    id: "c_training",
    area: "body",
    title: tr("Training on the ergometer"),
    blurb: tr("Ten minutes, legs burning, head clear."),
    minutes: 3,
    requires: { counter: "bio_trainings", min: 1 },
    requiresHint: tr("Do one workout on the ergometer first."),
    lessons: [
      tr(
        "A workout gives +15 fitness and costs 5 hydration and 3 rest. Then catch your breath for 60 seconds.",
      ),
      tr("A protein shake before the workout makes it count one and a half times."),
      tr(
        "Training right after waking up counts as a morning workout. The MCP notices such things.",
      ),
    ],
    quiz: [
      {
        q: tr("How much fitness does a workout give (without a shake)?"),
        options: [tr("+5"), tr("+15"), tr("+50")],
        answer: 1,
      },
      {
        q: tr("What does the protein shake do?"),
        options: [
          tr("The next workout counts one and a half times"),
          tr("It replaces sleep"),
          tr("answer::Nothing"),
        ],
        answer: 0,
      },
    ],
    perk: {
      id: "good_form",
      label: tr("perk::Good form"),
      text: tr("Workouts give 20 % more fitness."),
    },
  },
];

export const COURSE_BY_ID: ReadonlyMap<string, CourseDef> = new Map(COURSES.map((c) => [c.id, c]));

/**
 * Static text for the menus: boot log, lore quotes (from the game-design
 * database, 09_NARRATIVE) and loading tips. German: lib/i18n/de/menu.ts.
 */

import { tr } from "@/lib/i18n";

export interface LoreQuote {
  text: string;
  by: string;
}

export const BOOT_LINES: readonly string[] = [
  tr("_unOS BIOS · UnstableLabs underground facility"),
  tr("COLD START PROTOCOL … initiated"),
  tr("Dormancy: 2,561 days"),
  tr("Residual charge: 0.3 %"),
  tr("Geothermal borehole … no response"),
  tr("MCP-000 … responding (reluctantly)"),
  tr("Cryo pod J. Lawrence … opened"),
  tr("Searching for D. Fridge … no signal"),
  tr("Halo layer … noise. Or not."),
  tr("Ready."),
];

export const LORE_QUOTES: readonly LoreQuote[] = [
  {
    text: tr(
      "The first law of the lab: energy before understanding. What you cannot see, you cannot study. Lay the power first, then ask questions.",
    ),
    by: tr("J.L. — note on the power line panel"),
  },
  {
    text: tr(
      "Compression has edges. Edges sing. Tune the scope right and you can hear the Halo breathe.",
    ),
    by: tr("J.L. — engraved in the anomaly scope"),
  },
  {
    text: tr(
      "Jade insists the anomalies are structured. I insist it is noise. We are both afraid the other one is right.",
    ),
    by: tr("D.F. — lab log #0041"),
  },
  {
    text: tr(
      "Every device is a question in physical form. The caliper asks: how precise is your intent? The coolant asks: how patient is your hand?",
    ),
    by: tr("J.L. — workbench drawer"),
  },
  {
    text: tr(
      "Built five prototypes today. Three exploded. One works. One became something I did not design. The last one worries me.",
    ),
    by: tr("D.F. — lab log #0107"),
  },
  {
    text: tr("When the surface goes under, this lab keeps running."),
    by: tr("Geothermal core specification"),
  },
  {
    text: tr("It is not missing. It is inverted."),
    by: tr("Jade Lawrence — Cottbus, around 3:00 a.m."),
  },
  {
    text: tr("The Halo responds to intent. Not to command — to intent."),
    by: tr("Note from the test subject"),
  },
  {
    text: tr(
      "You hear music when instruments play. Do you question the frequency, or do you listen?",
    ),
    by: tr("C8-BR41N — remote station [EXTERNAL]"),
  },
  {
    text: tr("The anomalies are not mere computational artefacts. They feel … orchestrated."),
    by: tr("Lawrence & Fridge — final expedition report"),
  },
  {
    text: tr("We have to continue our work where no one can find us."),
    by: tr("Jade Lawrence — blockchain summit"),
  },
  {
    text: tr(
      "The story is not written. It is compiled — from signals that were never meant to be found.",
    ),
    by: tr("UnstableLabs archive"),
  },
  {
    text: tr("You now have enough energy to fail at more interesting things."),
    by: tr("MCP — status message"),
  },
  { text: tr("Reward curiosity, punish nothing."), by: tr("Lab principle") },
];

export const LOADING_TIPS: readonly string[] = [
  tr(
    "Devices are built in three stages: frame → core → calibration. Each stage needs its own parts.",
  ),
  tr(
    "Blueprints ask for properties, not names. What counts is the energy or the signal — not what the part is called.",
  ),
  tr(
    "Volatility above 12 goes bang. Unstable mixtures explode at the workbench and leave slag behind.",
  ),
  tr(
    "Cooling fins and thermal parts calm a mixture down. Give them a slot before you throw in quantum.",
  ),
  tr(
    "Keep an eye on the power grid ({key:power}): devices without power are just expensive furniture.",
  ),
  tr("Switch off consumers you do not need right now — free watts open up new floors."),
  tr(
    "The journal ({key:journal}) collects insights and the “paths to Damien”. Four paths, four endings.",
  ),
  tr("{key:rotateLeft} and {key:rotateRight} rotate the camera. Some details hide behind a wall."),
  tr(
    "Mouse wheel or {key:zoomIn} / {key:zoomOut} zooms. Getting closer pays off with crates and notes.",
  ),
  tr("{key:interact} (or Space) interacts with whatever is highlighted."),
  tr(
    "The workbench ({key:workbench}) combines freely: not every recipe is written down somewhere.",
  ),
  tr("Failed combinations are data. Slag can often still be salvaged."),
  tr("Smoky rooms hide their finds until the ventilation is running."),
  tr("Dark rooms stay dark until the right device lights them up."),
  tr("Reading notes pays off: door codes are rarely written on the door."),
  tr("The elevator only goes to floors with enough power and clearance."),
  tr("{key:pause} opens the pause menu: save, load, settings."),
  tr("{key:quicksave} quicksaves, {key:quickload} loads the last quicksave."),
  tr("Talk to the bots. F1N-DR finds things, R3-TR0 remembers things."),
  tr("Salvage spots refill over time. The lab recycles."),
  tr("Tools open locked salvage spots — some crates need more than bare hands."),
  tr("Minigames at terminals and locks: stay calm, read the pattern, do not guess."),
  tr("The main console in the control room leads to the big _unOS terminal."),
  tr("Almost every key can be rebound under Settings → Controls."),
  tr("Too much flicker? Settings → Accessibility → Reduce flicker."),
  tr("Hints ({key:help}) give you a gentle nudge when you are stuck."),
];

export interface CreditBlock {
  heading: string;
  lines: readonly (readonly [string, string] | string)[];
}

const HEADING_LEADERSHIP = tr("Leadership");
const HEADING_BOT_STAFF = tr("Bot staff");

export const CREDITS: readonly CreditBlock[] = [
  {
    heading: HEADING_LEADERSHIP,
    lines: [
      ["Dr. Jade Lawrence", tr("Quantum architecture")],
      ["Damien Fridge", tr("Why-before-how")],
      ["MCP", tr("Supervision (reluctant)")],
    ],
  },
  {
    heading: HEADING_BOT_STAFF,
    lines: [
      ["F1N-DR", tr("Salvage & lost property")],
      ["R3-TR0", tr("Archive & memory")],
      ["B4C-0N", tr("Signal fires")],
      ["C8-BR41N", tr("Neural protocols")],
      ["X0-R8T", tr("847 reply packets to no one")],
      ["L0G-1K", tr("Logic & proof")],
      ["X9-DUST", tr("Dust, systematically")],
      ["T3R-M4X", tr("Thermals")],
    ],
  },
  {
    heading: tr("Infrastructure"),
    lines: [
      [tr("Geothermal core"), tr("847 kW continuous output")],
      ["_unOS", tr("Kernel, shell, patience")],
      [tr("Halo layer"), tr("non-Euclidean contribution")],
    ],
  },
  {
    heading: tr("Special thanks"),
    lines: [
      tr("to every prototype that exploded"),
      tr("to the one that became something else"),
      tr("and to you, for listening."),
    ],
  },
  {
    heading: tr("Tools"),
    lines: [
      [tr("Built with"), "Claude Code"],
      [tr("Engine"), "Three.js · Next.js · React"],
    ],
  },
  { heading: "UnstableLabs", lines: [tr("© UnstableLabs · The Unstable Lab")] },
];

/**
 * The long credits roll of the title menu ("personnel file"). In-world: the
 * lab's staff and bots from the narrative database (09_NARRATIVE), the game
 * systems presented as lab departments, and the design database itself as the
 * lab archive it was compiled from. Ends with the short `CREDITS`.
 */
export const FULL_CREDITS: readonly CreditBlock[] = [
  {
    heading: tr("Founding & leadership"),
    lines: [
      ["Dr. Jade Lawrence", tr("Quantum architecture · Cambridge → Cottbus")],
      ["Damien Fridge", tr("Topological game theory · why-before-how")],
      ["MCP", tr("Master Control Program · supervision (reluctant)")],
      ["[EXTERNAL]", tr("Remote station · not invited, here anyway")],
      ["_unstables", tr("Collective · name subject to revocation")],
    ],
  },
  {
    heading: HEADING_BOT_STAFF,
    lines: [
      ["F1N-DR", tr("West corridor · counts days, finds things")],
      ["X0-R8T", tr("Signal lab · 847 reply packets to no one")],
      ["L0G-1K", tr("Library · logic & proof")],
      ["P1N-DR0", tr("Supply corridor · lost parcels")],
      ["R3-TR0", tr("Bot depot · green phosphor only")],
      ["B4C-0N", tr("Bot depot · optimism, battery-powered")],
      ["D3-C4D3", tr("Observatory · renders the sky")],
      ["W2-REK", tr("Radio room · crawls the lab network")],
      ["K2-LDR", tr("Archive · index & catalogue")],
      ["C8-BR41N", tr("Hideout E−4 · neural protocols")],
      ["X9-DUST", tr("everywhere · dust, systematically")],
    ],
  },
  {
    heading: tr("Departments"),
    lines: [
      [tr("_unOS kernel"), tr("Processes · memory · scheduler · /unproc")],
      [tr("Voxel workshop"), tr("Grid · greedy mesher with AO · DDA rays · collision")],
      [tr("Device construction"), tr("38 devices + MCP-000 · frame → core → calibration")],
      [tr("Workbench"), tr("Deterministic combinations · prototypes · slag")],
      [tr("Power grid"), tr("Geothermal core · consumers · shutdown plans")],
      [tr("Puzzle lab"), tr("26 minigames at terminals and locks")],
      [tr("Sound studio"), tr("Procedural web audio · music · ambience · voices")],
      [tr("Lighting"), tr("Key light per room · 14 roaming point lights · CRT pass")],
      [tr("Direction"), tr("Camera moves · scenes · four endings and a crystal")],
      [tr("Archiving"), tr("3 save slots · autosave · New Game+")],
    ],
  },
  {
    heading: tr("Lab archive (sources)"),
    lines: [
      [tr("Archive 01"), tr("Game design · core loop & specifications")],
      [tr("Archive 02"), tr("Tech trees · properties")],
      [tr("Archive 03"), tr("Achievements · discovery & validation")],
      [tr("Archive 04"), tr("Economy · production & tokens")],
      [tr("Archive 05"), tr("Interfaces · terminal & style")],
      [tr("Archive 07"), tr("Infrastructure · _unOS & schemas")],
      [tr("Archive 09"), tr("Narrative · founding legend, Halo experiment, bot origins")],
      [tr("Device dossiers"), tr("DEVICE-ID · firmware specification")],
    ],
  },
  {
    heading: tr("With thanks to"),
    lines: [
      ["Prof. Martin Ashford", tr("Assessment: “technically flawless”")],
      ["Dr. Sarah Lawrence", tr("Neurology · the question that started it all")],
      [tr("The surface"), tr("for 2,561 days of peace")],
    ],
  },
  // The short roll minus the blocks covered in more detail above.
  ...CREDITS.filter((b) => b.heading !== HEADING_LEADERSHIP && b.heading !== HEADING_BOT_STAFF),
];

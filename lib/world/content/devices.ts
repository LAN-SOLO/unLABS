/**
 * The 38 lab devices (devices/tier-1..3 + NXS-01) plus the MCP core.
 * ==================================================================
 *
 * Every device is built in three stages — RAHMEN → KERN → KALIBRIERUNG.
 * Slots accept a named part OR any item whose traits reach the
 * thresholds, so prototypes from the combination engine can stand in for
 * parts the player never found. `needs` follows the unlock chain of the
 * device docs (ep0_complete → CDC/BAT/…, anomaly_mode → AND/QCP, …),
 * translated into "which devices must already be online".
 *
 * Power draws are the full-load values from the firmware specs;
 * negative power = generation.
 */
import type {
  BuildStage,
  Condition,
  DeviceDef,
  DeviceEffect,
  Requirement,
  Traits,
} from "@/lib/world/types";
import { tr } from "@/lib/i18n";

function r(label: string, item?: string, t?: Partial<Traits>, count = 1): Requirement {
  const req: Requirement = { label, count };
  if (item) req.item = item;
  if (t) req.traits = t;
  return req;
}

const FRAME1 = r("Chassis", "rahmen", { mechanik: 6 });
const FRAME2: Requirement[] = [FRAME1, r(tr("Alloy"), "basislegierung", undefined, 2)];
const FRAME3: Requirement[] = [
  r(tr("High Alloy"), "hochlegierung"),
  r(tr("Support frame"), "rahmen", { mechanik: 9 }),
];

function st(
  name: string,
  requires: Requirement[],
  text: string,
  extra: Partial<BuildStage> = {},
): BuildStage {
  return { name, requires, text, ...extra };
}

function dev(
  id: string,
  name: string,
  tier: 1 | 2 | 3,
  room: string,
  x: number,
  z: number,
  power: number,
  needs: string[],
  effect: DeviceEffect,
  summary: string,
  mcp: string,
  signature: Partial<Traits>,
  stages: BuildStage[],
  extra: Partial<DeviceDef> = {},
): DeviceDef {
  return {
    id,
    name,
    tier,
    room,
    x,
    z,
    power,
    needs,
    effect,
    summary,
    mcp,
    signature,
    stages,
    discover: [],
    ...extra,
  };
}

export const DEVICES: readonly DeviceDef[] = [
  dev(
    "MCP-000",
    "Master Control Program",
    1,
    "mcp",
    104,
    52,
    5,
    [],
    "monitor",
    tr(
      "The lab's administrator. Running in emergency mode for 2,561 days. Repairs = more conversation, more memory, more hints.",
    ),
    tr(
      "Speech module online. I can form complete sentences again. Whether you want that is another question.",
    ),
    { daten: 8, signal: 3 },
    [
      st(tr("Emergency mode"), [], tr("The MCP flickers in emergency mode.")),
      st(
        tr("Speech module"),
        [
          r(tr("Control logic"), "steuermodul", { daten: 6 }),
          r(tr("Buffer"), "kondensator", { energie: 4 }),
        ],
        tr("Speech synthesis restored."),
      ),
      st(
        tr("Memory bank"),
        [r(tr("Memory"), "speicherchip", { daten: 4 }, 2)],
        tr("The logs from 2019 are readable again."),
        {
          when: { device: "MEM-001" },
          whenHint: tr(
            "The MCP needs a running Memory Monitor (Data Center, Level −1) to check its banks.",
          ),
        },
      ),
    ],
  ),

  // ── Tier 1 ───────────────────────────────────────────────────
  dev(
    "CLK-001",
    "Lab Clock",
    1,
    "kontroll",
    56,
    40,
    1,
    [],
    "clock",
    tr(
      "Time synchronization. Without it, every timestamp in the lab contradicts the others — including the logs at the Forge terminal.",
    ),
    tr("Time synchronized. Today is day 2,561 plus your presence. Congratulations."),
    { mechanik: 3, resonanz: 3, daten: 2 },
    [
      st(
        tr("Housing"),
        [r(tr("Housing"), "gehaeuseplatte", { mechanik: 3 })],
        tr("The clock housing hangs on the wall again."),
      ),
      st(
        tr("Clockwork"),
        [
          r(tr("Gearing"), "zahnrad", { mechanik: 3 }),
          r(tr("Clock source"), "quarzkristall", { resonanz: 3 }),
        ],
        tr("It ticks."),
      ),
      st(
        tr("Readout"),
        [r(tr("Readout"), "display", { daten: 2, optik: 1 })],
        tr("The digits light up: 03:41. Then they jump to now."),
      ),
    ],
  ),
  dev(
    "VNT-001",
    "Ventilation System",
    1,
    "schleuse",
    64,
    18,
    4,
    [],
    "vent",
    tr("Air exchange and HEPA filters. Clears the smoke from the airlock and the storage room."),
    tr("Ventilation running. The air now smells of 2019 instead of 2017. Progress."),
    { thermik: 3, mechanik: 3, energie: 2 },
    [
      st(tr("Frame"), [FRAME1], tr("The ventilation frame is in place.")),
      st(
        tr("Blower"),
        [r(tr("Fan"), "luefter", { thermik: 3 }), r("Motor", "kupferspule", { energie: 3 })],
        tr("The blades turn hesitantly."),
      ),
      st(
        "Filter",
        [r("Filter", "filterpatrone", { thermik: 1, mechanik: 2 })],
        tr("Fresh air. The smoke is clearing."),
      ),
    ],
  ),
  dev(
    "BTK-001",
    "Basic Toolkit",
    1,
    "werkstatt",
    54,
    96,
    2,
    [],
    "disassemble",
    tr("Tool wall with gripper arms. Salvages scrap completely and pries open unpowered doors."),
    tr("Tools ready. Please count your fingers afterwards."),
    { mechanik: 6 },
    [
      st(
        tr("Tool wall"),
        [r(tr("Wall panel"), "gehaeuseplatte", { mechanik: 3 })],
        tr("The pegboard is up."),
      ),
      st(
        tr("Tools"),
        [r(tr("Tool"), "schraubendreher"), r(tr("Fasteners"), "schraubensatz", { mechanik: 2 })],
        tr("Everything in its place."),
      ),
      st(
        tr("Gripper arm"),
        [r(tr("Actuator"), "servo", { mechanik: 4 })],
        tr("The gripper arm twitches and salutes."),
      ),
    ],
  ),
  dev(
    "BAT-001",
    "Battery Pack",
    1,
    "batterie",
    58,
    24,
    0,
    ["UEC-001"],
    "storage",
    tr("Buffer storage. +40 W of stable reserve power for the grid."),
    tr(
      "Battery buffer active. If the core gets the hiccups again, we will now die somewhat more slowly.",
    ),
    { energie: 10, daten: 2 },
    [
      st(
        tr("Shelving"),
        [r(tr("Sheet metal"), "gehaeuseplatte", { mechanik: 3 }, 2)],
        tr("The shelving stands."),
      ),
      st(
        tr("Cells"),
        [r(tr("Cells"), "batteriezelle", { energie: 5 }, 3)],
        tr("Cells inserted. Voltage: yes."),
      ),
      st(
        "BMS",
        [
          r("Controller", "platine", { daten: 3 }),
          r(tr("Wiring"), "kabelbaum", { signal: 2, energie: 1 }),
        ],
        tr("Balancing active."),
      ),
    ],
  ),
  dev(
    "PWB-001",
    "Portable Workbench",
    1,
    "werkstatt",
    62,
    84,
    3,
    ["BTK-001"],
    "workbench",
    tr("Large workbench with 6 slots — combine up to six parts, raw-material recipes included."),
    tr("Workbench operational. Six slots. Infinitely many bad ideas."),
    { mechanik: 8, daten: 1 },
    [
      st(tr("Frame"), [FRAME1], tr("The base frame stands.")),
      st(
        tr("Worktop"),
        [r(tr("Panels"), "gehaeuseplatte", { mechanik: 3 }, 2)],
        tr("A level surface. Rare in this lab."),
      ),
      st(
        tr("Clamping rig"),
        [
          r(tr("part::Clamp"), "servo", { mechanik: 4 }),
          r(tr("Screws"), "schraubensatz", { mechanik: 2 }),
        ],
        tr("The clamps bite."),
      ),
    ],
  ),
  dev(
    "CDC-001",
    "Crystal Data Cache",
    1,
    "archiv",
    98,
    80,
    15,
    ["UEC-001"],
    "decode",
    tr("Indexes crystals and slices. Reads relics, checks data streams (CRC)."),
    tr(
      "Crystal Data Cache online. 30 slices per crystal, and one of them is… warm. The protocol does not provide for that.",
    ),
    { daten: 8, optik: 2, resonanz: 2 },
    [
      st("Rack", [FRAME1], tr("The rack stands.")),
      st(
        tr("Memory"),
        [
          r(tr("Control unit"), "steuermodul", { daten: 6 }),
          r(tr("Memory"), "speicherchip", { daten: 4 }),
        ],
        tr("Memory banks detected."),
      ),
      st(
        tr("Crystal reader"),
        [
          r(tr("Optics"), "display", { optik: 2, daten: 2 }),
          r("Resonator", "quarzkristall", { resonanz: 3 }),
        ],
        tr("The reader glows violet."),
      ),
    ],
  ),
  dev(
    "MEM-001",
    "Memory Monitor",
    1,
    "rechen",
    34,
    66,
    0.6,
    ["CDC-001"],
    "monitor",
    tr("DIMM detection and SPD readout. Required for the MCP's memory."),
    tr("Memory counted. I remember things I would rather have forgotten."),
    { daten: 8 },
    [
      st("Board", [r("Board", "platine", { daten: 3 })], tr("Board mounted.")),
      st("DIMMs", [r(tr("Modules"), "speicherchip", { daten: 4 }, 2)], "SPD: 2019-02-13."),
      st(tr("Readout"), [r(tr("Readout"), "display", { daten: 2, optik: 2 })], tr("Green bars.")),
    ],
  ),
  dev(
    "CPU-001",
    "CPU Monitor",
    1,
    "rechen",
    22,
    66,
    0.8,
    ["MEM-001"],
    "monitor",
    tr(
      "Multi-core monitoring. Shows which devices are blocked. The basis for diagnostics and the AI.",
    ),
    tr("Processors counted. One of them is thinking about itself. That would be me, I suppose."),
    { daten: 6, thermik: 4 },
    [
      st(tr("Base"), [r(tr("Base"), "gehaeuseplatte", { mechanik: 3 })], tr("Socket seated.")),
      st(tr("Processor"), [r(tr("Logic"), "steuermodul", { daten: 6 })], "Post-Code: 00."),
      st(
        tr("Cooling"),
        [r(tr("Cooling"), "kuehlblock", { thermik: 6 })],
        tr("Temperatures in the green."),
      ),
    ],
  ),
  dev(
    "NET-001",
    "Network Monitor",
    1,
    "rechen",
    30,
    96,
    3.5,
    ["CDC-001"],
    "network",
    tr("The lab's runtime network. Opens network-controlled doors, connects F1N-DR."),
    tr(
      "Network active. 35 bot processes report in. One says “Hello”. They do not normally do that.",
    ),
    { signal: 6, daten: 4 },
    [
      st(
        "Hub",
        [r(tr("Housing"), "gehaeuseplatte", { mechanik: 3 })],
        tr("The hub is mounted in the rack."),
      ),
      st(
        "Ports",
        [
          r(tr("Line"), "glasfaser", { signal: 2, daten: 1 }),
          r(tr("Cable"), "kabelbaum", { signal: 2 }),
        ],
        tr("Link LEDs blinking."),
      ),
      st(
        "Uplink",
        [r(tr("Radio"), "sendeempfaenger", { signal: 6 })],
        tr("Uplink established. To wherever."),
        { puzzle: "pz_wiring_net" },
      ),
    ],
  ),
  dev(
    "TMP-001",
    "Temperature Monitor",
    1,
    "kuehlung",
    104,
    42,
    1.5,
    ["VNT-001"],
    "monitor",
    tr("Thermal probes throughout the lab. Makes the coolant mixing desk usable."),
    tr("Temperature: cold. Deep Lab: very cold. Somewhere beneath us: 0.015 kelvin."),
    { thermik: 4, signal: 2, daten: 2 },
    [
      st(
        tr("Housing"),
        [r(tr("Housing"), "gehaeuseplatte", { mechanik: 3 })],
        tr("Housing mounted."),
      ),
      st(
        tr("Probes"),
        [r(tr("Probe"), "thermoelement", { thermik: 3, signal: 1 })],
        tr("Probes laid."),
      ),
      st(tr("Readout"), [r(tr("Readout"), "display", { daten: 2 })], tr("Readings appear.")),
    ],
  ),
  dev(
    "THM-001",
    "Thermal Manager",
    1,
    "kuehlung",
    94,
    24,
    3,
    ["TMP-001"],
    "thermal",
    tr("Zone cooling. Tier 3 devices overheat without it."),
    tr("Thermal management active. The heavy devices may now sweat without melting."),
    { thermik: 9, mechanik: 2, daten: 2 },
    [
      st(tr("Frame"), [FRAME1], tr("Frame in place.")),
      st(tr("Cooling Block"), [r(tr("Cooling"), "kuehlblock", { thermik: 8 })], tr("Cold.")),
      st(
        tr("Regulation"),
        [r(tr("Regulator"), "steuermodul", { daten: 6 })],
        tr("The circuit regulates itself."),
        {
          puzzle: "pz_coolant",
        },
      ),
    ],
  ),

  // ── Tier 1 (continued) — power distribution ─────────────────
  dev(
    "PWR-001",
    "Power Management System",
    1,
    "batterie",
    76,
    24,
    2,
    ["BAT-001"],
    "power",
    tr("Power distribution. Opens the geothermal tap all the way: +100 W."),
    tr(
      "Load distribution active. Geothermal at full load. We now have more power than ideas. For now.",
    ),
    { energie: 8, daten: 4 },
    [
      st(tr("Switch cabinet"), [FRAME1], tr("The cabinet stands.")),
      st(
        tr("Contactors"),
        [r(tr("Contactor"), "induktor", { energie: 5 }, 2)],
        tr("Clack. Clack."),
      ),
      st(tr("Logic"), [r(tr("Logic"), "steuermodul", { daten: 6 })], tr("Priorities set.")),
    ],
  ),
  dev(
    "PWD-001",
    "Power Display Panel",
    1,
    "batterie",
    66,
    46,
    1,
    ["PWR-001"],
    "monitor",
    tr("Shows bus load, generation and reserve — and compensates reactive power: +20 W."),
    tr("Power display online. Now you can watch in real time how tight things are."),
    { daten: 4, optik: 2, energie: 2 },
    [
      st("Panel", [r("Panel", "gehaeuseplatte", { mechanik: 3 })], tr("Panel in place.")),
      st(tr("Readout"), [r(tr("Readout"), "display", { daten: 2, optik: 2 })], tr("LED bars.")),
      st(
        "Shunt",
        [r(tr("Cable"), "kabelbaum"), r(tr("Measuring logic"), "platine", { daten: 3 })],
        tr("The bars move."),
      ),
    ],
  ),
  dev(
    "VLT-001",
    "Volt Meter Display",
    1,
    "batterie",
    54,
    44,
    1,
    ["BAT-001"],
    "monitor",
    tr(
      "Voltage, current, peak values. Stabilizes the Energy Core: on weak days it holds it at 150 W.",
    ),
    tr("Voltage measured. It fluctuates with the volatility. Like everything here."),
    { energie: 3, signal: 2, daten: 2 },
    [
      st(tr("Housing"), [r(tr("Housing"), "gehaeuseplatte", { mechanik: 3 })], tr("Housing.")),
      st(
        tr("Meter movement"),
        [r(tr("Coil"), "kupferspule", { energie: 3 }), r("Magnet", "magnet")],
        tr("The needle trembles."),
      ),
      st("Display", [r("Display", "display", { daten: 2 })], tr("Digits.")),
    ],
  ),
  dev(
    "MSC-001",
    "Material Scanner",
    1,
    "diagnose",
    60,
    62,
    3.5,
    ["PWB-001"],
    "scan",
    tr("Material scan. Reveals hidden samples and cryo crystals."),
    tr("Scanner active. It finds things. I would like to stress that I did not hide them."),
    { signal: 4, optik: 3, daten: 2 },
    [
      st(tr("Frame"), [FRAME1], tr("Frame.")),
      st(
        tr("Sensors"),
        [
          r("Sensor", "sensorkopf", { signal: 3, daten: 1 }),
          r(tr("Optics"), "linse", { optik: 3 }),
        ],
        tr("The sensor blinks."),
      ),
      st(
        tr("Swivel arm"),
        [r(tr("Drive"), "servo", { mechanik: 4 })],
        tr("The arm sweeps across the floor."),
      ),
    ],
  ),
  dev(
    "RMG-001",
    "Resource Magnet",
    1,
    "lager",
    96,
    92,
    10,
    ["MSC-001"],
    "magnet",
    tr("Coil magnet. Pulls parts out of vent grilles and cracks."),
    tr("Magnetic field active. Please remove your pacemaker. That was a joke. I believe."),
    { energie: 5, mechanik: 3, quantum: 2 },
    [
      st(tr("Frame"), [FRAME1], tr("Frame.")),
      st(
        tr("Coils"),
        [r(tr("Coil"), "induktor", { energie: 5, quantum: 1 }), r(tr("Core"), "magnet")],
        tr("It hums."),
      ),
      st(
        tr("Field shaping"),
        [r(tr("Field"), undefined, { energie: 4, mechanik: 2 })],
        tr("Screws fly across the room."),
      ),
    ],
  ),
  dev(
    "ATK-001",
    "Abstractum Tank",
    1,
    "fertigung",
    56,
    70,
    4,
    ["RMG-001", "PWR-001"],
    "storage",
    tr("Abstractum storage. The seep valve delivers twice as fast."),
    tr("Abstractum tank filled. It glows. It hums. It is watching me. I am imagining that."),
    { mechanik: 5, quantum: 3, energie: 3 },
    [
      st(tr("Tank shell"), FRAME2, tr("The shell stands.")),
      st(
        tr("Inner glass"),
        [
          r(tr("Glass"), "linse", { optik: 3 }),
          r(tr("Field band"), "supraleiter", { quantum: 3, energie: 3 }),
        ],
        tr("Sealed."),
      ),
      st(tr("Filling"), [r("Abstractum", "abstractum", undefined, 6)], tr("Violet glow.")),
    ],
  ),

  // ── Tier 2 ───────────────────────────────────────────────────
  dev(
    "UEC-001",
    "Unstable Energy Core",
    2,
    "geo",
    30,
    40,
    -150,
    [],
    "power",
    tr("The first generator. 150 W ± daily volatility. Without it, the lab stays dark."),
    tr(
      "Energy Core online. Output: 150 W. Efficiency: laughable. Congratulations. Minimal survivability achieved.",
    ),
    { energie: 8, quantum: 2, resonanz: 2 },
    [
      st(tr("Frame"), [FRAME1], tr("The cage around the core stands.")),
      st(
        tr("Energy core"),
        [
          r(tr("Energy core"), undefined, { energie: 8 }),
          r("Abstractum", "abstractum", undefined, 3),
        ],
        tr("The core crackles violet."),
      ),
      st(
        tr("Calibration"),
        [r(tr("Field coil"), "kupferspule", { energie: 3, resonanz: 1 })],
        tr("The power flows."),
        { puzzle: "pz_power_flow" },
      ),
    ],
  ),
  dev(
    "DGN-001",
    "Diagnostics Console",
    2,
    "diagnose",
    72,
    60,
    3,
    ["CPU-001"],
    "monitor",
    tr("System diagnostics. Hints at what is missing next and unlocks the radiation bulkhead."),
    tr("Diagnostics running. Findings: everything broken, but in interesting ways."),
    { daten: 7, optik: 3 },
    [
      st(
        tr("Console"),
        [r(tr("Sheet metal"), "gehaeuseplatte", { mechanik: 3 }, 2)],
        tr("The console stands."),
      ),
      st(tr("Computer"), [r(tr("Logic"), "steuermodul", { daten: 6 })], tr("Booting.")),
      st(
        tr("Screens"),
        [r(tr("part::Screen"), "display", { daten: 2, optik: 2 }, 2)],
        tr("Error codes appear — and vanish."),
      ),
    ],
  ),
  dev(
    "ECR-001",
    "Echo Recorder",
    2,
    "signal",
    22,
    24,
    6,
    ["CDC-001", "NET-001"],
    "record",
    tr("Records what remains in the noise. Plays tapes — and captures echoes."),
    tr("Echo recorder active. It is recording something. I did not say anything."),
    { signal: 5, resonanz: 6 },
    [
      st(tr("Frame"), [FRAME1], tr("Frame.")),
      st(
        tr("Antennas"),
        [
          r(tr("Antenna"), "antenne", { signal: 4 }),
          r("Resonator", "quarzkristall", { resonanz: 3 }),
        ],
        tr("The golden spheres rotate."),
      ),
      st(
        tr("Resonance Chamber"),
        [r(tr("Chamber"), "resonanzkammer", { resonanz: 6 })],
        tr("The noise takes on structure."),
      ),
    ],
  ),
  dev(
    "SPK-001",
    "Narrow Speaker",
    2,
    "signal",
    44,
    22,
    3,
    ["ECR-001"],
    "tones",
    tr("Directional speaker. Without it, no one can answer."),
    tr("Speaker active. No requests, please."),
    { resonanz: 5, mechanik: 2 },
    [
      st(tr("Housing"), [r(tr("Housing"), "gehaeuseplatte", { mechanik: 3 })], tr("Housing.")),
      st(
        tr("Driver"),
        [r(tr("Diaphragm"), "membran", { resonanz: 3 }), r("Magnet", "magnet")],
        tr("A quiet crackle."),
      ),
      st(
        tr("Focus"),
        [r(tr("Oscillator"), "oszillator", { resonanz: 3 })],
        tr("The tone narrows like a laser."),
      ),
    ],
  ),
  dev(
    "HMS-001",
    "Handmade Synthesizer",
    2,
    "signal",
    32,
    44,
    8,
    ["SPK-001"],
    "tones",
    tr("Handmade synthesizer. Plays the four-tone handshake."),
    tr("Synthesizer online. Dr. Fridge called it “the instrument”. I call it a noise source."),
    { resonanz: 8, signal: 4, daten: 2 },
    [
      st(tr("Desk"), [FRAME1], tr("The desk stands.")),
      st(
        tr("Oscillators"),
        [r(tr("Oscillator"), "oszillator", { resonanz: 3, signal: 2 }, 2)],
        tr("Two waves looking for each other."),
      ),
      st(
        tr("Filter bank"),
        [
          r(tr("Logic"), "steuermodul", { daten: 6 }),
          r(tr("Chamber"), "resonanzkammer", { resonanz: 6 }),
        ],
        tr("It almost sounds like a voice."),
      ),
    ],
  ),
  dev(
    "OSC-001",
    "Oscilloscope Array",
    2,
    "signal",
    20,
    46,
    6,
    ["DGN-001"],
    "monitor",
    tr("Multi-channel oscilloscope. After the Lissajous calibration you can see the Halo breathe."),
    tr("Oscilloscope calibrated. The figure is stable. It looks like an eye."),
    { signal: 6, daten: 3, optik: 2 },
    [
      st("Chassis", [FRAME1], "Chassis."),
      st(
        tr("Tube"),
        [
          r(tr("part::Screen"), "display", { optik: 2, daten: 2 }),
          r(tr("Oscillator"), "oszillator"),
        ],
        tr("Green trace."),
      ),
      st(
        tr("Calibration"),
        [r(tr("Probe"), "sensorkopf", { signal: 3 })],
        tr("The figure holds."),
        {
          puzzle: "pz_lissajous",
        },
      ),
    ],
  ),
  dev(
    "INT-001",
    "Interpolator",
    2,
    "signal",
    44,
    46,
    20,
    ["OSC-001"],
    "optics",
    tr("Prism bench. Makes Jade's invisible ink readable."),
    tr("Interpolator online. Color is memory, said Dr. Lawrence. I now see 9 memories."),
    { optik: 8, daten: 3, resonanz: 2 },
    [
      st(tr("Bench"), FRAME2, tr("The rail is laid.")),
      st(tr("Prisms"), [r(tr("Optics"), "optikbank", { optik: 7 })], tr("A rainbow on the wall.")),
      st(
        tr("Predictor"),
        [r(tr("Logic"), "steuermodul", { daten: 6 }), r(tr("Light guide"), "glasfaser")],
        tr("The colors fall into order."),
      ),
    ],
  ),
  dev(
    "AND-001",
    "Anomaly Detector",
    2,
    "anomalie",
    68,
    28,
    15,
    ["OSC-001", "MSC-001"],
    "anomaly",
    tr("Finds anomalies — and everything they leave behind: Halo dust, exotic residue."),
    tr(
      "Anomaly detector active. Five signatures. You are now the leading expert on things we do not understand. The previous expert disappeared.",
    ),
    { signal: 7, quantum: 4, resonanz: 3 },
    [
      st(tr("Frame"), FRAME2, tr("Frame.")),
      st(
        tr("Detector"),
        [
          r(tr("Receiver"), "sendeempfaenger", { signal: 8 }),
          r(tr("Field band"), "supraleiter", { quantum: 3 }),
        ],
        tr("The beam probes."),
      ),
      st(
        tr("Waveform"),
        [
          r(tr("Oscillator"), "oszillator"),
          r(tr("Pattern filter"), undefined, { signal: 4, resonanz: 4, quantum: 1 }),
        ],
        tr("The air in the room stops shimmering — it becomes visible."),
      ),
    ],
  ),
  dev(
    "QCP-001",
    "Quantum Compass",
    2,
    "anomalie",
    78,
    44,
    2.5,
    ["AND-001", "RMG-001"],
    "compass",
    tr(
      "Points not north but to the pattern: to the scattered slices of Crystal #0089 — and, with the right knowledge, to Damien.",
    ),
    tr("Quantum compass active. The needle spins. Then it stops. It points down."),
    { quantum: 6, resonanz: 3, mechanik: 2 },
    [
      st(tr("Housing"), [r(tr("Gearing"), "zahnrad", { mechanik: 3 })], tr("Brass housing.")),
      st(
        tr("Needle"),
        [r(tr("Needle"), "magnet"), r("Qubit", "qubit_chip", { quantum: 5 })],
        tr("The needle floats."),
      ),
      st(
        tr("Quantum link"),
        [r(tr("Entanglement"), undefined, { quantum: 6, resonanz: 3 })],
        tr("The needle finds something."),
      ),
    ],
  ),
  dev(
    "DIM-001",
    "Dimension Monitor",
    2,
    "anomalie",
    60,
    42,
    4,
    ["AND-001", "INT-001"],
    "rift",
    tr("D-space probe. Opens rifts through which you can see into the Halo."),
    tr("Dimension monitor stable. I hereby put on record that I was against it."),
    { quantum: 7, optik: 4, resonanz: 4 },
    [
      st(tr("Frame"), FRAME2, tr("Frame.")),
      st(
        tr("Probes"),
        [r("Qubit", "qubit_chip", { quantum: 5 }), r(tr("Optics"), "optikbank", { optik: 7 })],
        tr("Geometric probes."),
      ),
      st(
        tr("Rift lock"),
        [r(tr("Anchor"), "halo_staub", { quantum: 6, resonanz: 6 })],
        tr("A rift. Behind it: light that does not fall."),
      ),
    ],
  ),
  dev(
    "EXD-001",
    "Explorer Drone",
    2,
    "hangar",
    30,
    76,
    40,
    ["RMG-001", "NET-001"],
    "drone",
    tr("Autonomous drone. Flies into the sealed shaft and brings back salvage."),
    tr("Drone ready for launch. It is braver than you. And more replaceable."),
    { mechanik: 7, signal: 4, energie: 3 },
    [
      st("Chassis", FRAME2, "Chassis."),
      st(
        tr("Drive"),
        [r(tr("Rotors"), "rotor", { mechanik: 3 }, 2), r("Servos", "servo", { mechanik: 4 }, 2)],
        tr("The rotors whir."),
      ),
      st(
        "Navigation",
        [
          r(tr("Radio"), "sendeempfaenger", { signal: 6 }),
          r(tr("Batteries"), "batteriezelle", { energie: 5 }, 2),
        ],
        tr("GPS lock: impossible, 40 m underground. It flies anyway."),
      ),
    ],
  ),
  dev(
    "NXS-01",
    "Nexus",
    2,
    "fertigung",
    68,
    84,
    12,
    ["ATK-001", "PWR-001", "THM-001"],
    "research",
    tr(
      "Research hub. Authorizes the Deep Lab. Every research cycle (+5) unlocks processes that are in no recipe book.",
    ),
    tr(
      "Nexus online. Research +5. Deep Lab clearance granted. I hope you know what is down there. I do.",
    ),
    { daten: 6, mechanik: 6, energie: 4 },
    [
      st(
        tr("Base"),
        [
          r(tr("Ingots"), "basislegierung", undefined, 4),
          r(tr("Frame"), "rahmen", { mechanik: 6 }, 2),
        ],
        tr("The base fills up."),
      ),
      st(
        tr("Core"),
        [r(tr("High Alloy"), "hochlegierung"), r(tr("Logic"), "steuermodul", { daten: 6 }, 2)],
        tr("The core rotates."),
      ),
      st(
        tr("Power"),
        [r(tr("Cells"), "energiezelle", undefined, 4)],
        tr("NEXUS lights up on its base."),
      ),
    ],
  ),
  dev(
    "LCT-001",
    "Precision Laser",
    2,
    "fertigung",
    78,
    96,
    55,
    ["NXS-01"],
    "laser",
    tr("Precision laser. Cuts bulkheads, exposes nanomaterial."),
    tr("Laser online. Do not look into it. With your remaining eye."),
    { optik: 8, energie: 5, thermik: 2 },
    [
      st(tr("Bench"), FRAME2, tr("Optical bench.")),
      st(
        tr("Diode array"),
        [r(tr("Diodes"), "laserdiode", { optik: 4, energie: 2 }, 2)],
        tr("Red light."),
      ),
      st(
        tr("Focus"),
        [
          r(tr("Optics"), "optikbank", { optik: 7 }),
          r(tr("Cooling"), "kuehlblock", { thermik: 6 }),
        ],
        tr("A point hotter than the sun."),
        { puzzle: "pz_laser_containment" },
      ),
    ],
  ),
  dev(
    "P3D-001",
    "3D Fabricator",
    2,
    "fertigung",
    56,
    96,
    60,
    ["NXS-01"],
    "fabricate",
    tr("Prints any known part from Base Alloy."),
    tr("Fabricator ready. It prints everything. Except understanding."),
    { mechanik: 7, thermik: 4, daten: 3 },
    [
      st(tr("Frame"), FRAME2, tr("Frame.")),
      st(
        tr("Print head"),
        [
          r(tr("Nozzle"), "duese", { mechanik: 2, thermik: 2 }),
          r(tr("Heater"), "thermoelement", { thermik: 3 }),
          r(tr("Axes"), "servo", { mechanik: 4 }, 2),
        ],
        tr("The head runs its homing cycle."),
      ),
      st(
        tr("Control unit"),
        [r(tr("Logic"), "steuermodul", { daten: 6 })],
        tr("The first layer sticks."),
        {
          puzzle: "pz_layers_p3d",
        },
      ),
    ],
  ),

  // ── Tier 3 ───────────────────────────────────────────────────
  dev(
    "MFR-001",
    "Microfusion Reactor",
    3,
    "reaktor",
    26,
    36,
    -250,
    ["AND-001", "NXS-01"],
    "power",
    tr("Microfusion. +250 W. The foundation for everything heavy."),
    tr("Reactor online. 250 W. Auto-SCRAM active. I repeat: ACTIVE. This time it works."),
    { energie: 9, thermik: 6, quantum: 4 },
    [
      st(tr("Pressure vessel"), FRAME3, tr("The vessel stands.")),
      st(
        "Plasma",
        [
          r(tr("Rings"), "plasmaring", { energie: 5, thermik: 4 }, 2),
          r(tr("Superconductor"), "supraleiter", { quantum: 3 }),
        ],
        tr("Magnetic rings rotate."),
      ),
      st(
        tr("Ignition"),
        [
          r(tr("Fuel"), "abstractum", undefined, 8),
          r(tr("Igniter"), "anomaler_kern", { energie: 8, quantum: 5 }),
        ],
        tr("A star, very small, very angry."),
        {
          when: { device: "THM-001" },
          whenHint: tr(
            "Without a Thermal Manager (Cooling, Level −1) the reactor would shut down immediately.",
          ),
        },
      ),
    ],
  ),
  dev(
    "EMC-001",
    "Exotic Matter Containment",
    3,
    "containment",
    100,
    32,
    40,
    ["MFR-001", "LCT-001"],
    "contain",
    tr("Containment for exotic matter. Tames anomalies, makes exotics manufacturable."),
    tr("Containment stable. What is inside stays inside. That is the whole concept."),
    { quantum: 8, thermik: 4, energie: 4 },
    [
      st(tr("Vessel"), FRAME3, tr("The containment vessel stands.")),
      st(
        tr("Field"),
        [
          r(tr("Field bands"), "supraleiter", { quantum: 3, energie: 3 }, 2),
          r(tr("Sample"), "exotische_materie", undefined, 2),
        ],
        tr("The field flickers cerulean."),
      ),
      st(
        tr("stage::Containment"),
        [r(tr("Lattice"), "nanomaterial", { optik: 4, quantum: 2, mechanik: 4 })],
        tr("The anomaly stops fighting."),
        { puzzle: "pz_heat" },
      ),
    ],
  ),
  dev(
    "QSM-001",
    "Quantum State Monitor",
    3,
    "quanten",
    76,
    96,
    22,
    ["EMC-001"],
    "analyze",
    tr("Coherence monitoring. Measures how stable a consciousness pattern is."),
    tr("Qubits coherent. Error correction running. One of the patterns is… not a qubit."),
    { quantum: 8, daten: 5 },
    [
      st(
        tr("Cryostat"),
        [r(tr("High Alloy"), "hochlegierung"), r(tr("Cooling"), "kuehlblock", { thermik: 8 })],
        tr("0.015 K."),
      ),
      st("Qubits", [r("Qubits", "qubit_chip", { quantum: 5 }, 2)], tr("Entangled.")),
      st(
        tr("Error correction"),
        [r(tr("Logic"), "steuermodul", { daten: 6 }), r(tr("Exotics"), "exotische_materie")],
        tr("Measuring σ."),
      ),
    ],
  ),
  dev(
    "QAN-001",
    "Quantum Analyzer",
    3,
    "quanten",
    52,
    96,
    80,
    ["EMC-001"],
    "analyze",
    tr("Deep analysis. Breaks Damien's resonance pattern out of Synapsis remnants."),
    tr("Quantum analyzer online. I have found a pattern. It has a signature: D.F."),
    { quantum: 8, daten: 7, resonanz: 2 },
    [
      st(tr("Cabinet"), FRAME3, tr("Cabinet.")),
      st(
        tr("Quantum core"),
        [r("Qubit", "qubit_chip", { quantum: 5 }), r(tr("Lattice"), "nanomaterial")],
        tr("The core hums."),
      ),
      st(
        tr("Neural net"),
        [
          r(tr("Reference"), "kristall_0089", { daten: 10, quantum: 4 }),
          r(tr("Exotics"), "exotische_materie", undefined, 2),
        ],
        tr("The patterns fall into order."),
      ),
    ],
  ),
  dev(
    "AIC-001",
    "AI Assistant Core",
    3,
    "rechenkern",
    26,
    72,
    35,
    ["QAN-001", "CPU-001"],
    "host",
    tr("Neural core. Can host a consciousness pattern."),
    tr("AI core online. I now have a colleague. He is smarter than I am. I am not jealous."),
    { daten: 9, quantum: 5, resonanz: 5 },
    [
      st(tr("Nodes"), FRAME3, tr("Nodes.")),
      st(
        tr("Neural core"),
        [r(tr("Logic"), "steuermodul", { daten: 6 }, 2), r(tr("Lattice"), "nanomaterial")],
        tr("The heat sinks glow blue."),
      ),
      st(
        tr("Consciousness anchor"),
        [
          r(tr("Anchor"), "synapsis_splitter", { resonanz: 6, quantum: 5, daten: 5 }),
          r(tr("Antimatter"), "antimaterie"),
        ],
        tr("A quiet intake of breath in the fan noise."),
        { puzzle: "pz_ethics_aic" },
      ),
    ],
  ),
  dev(
    "SCA-001",
    "Supercomputer Array",
    3,
    "rechenkern",
    26,
    94,
    45,
    ["AIC-001", "MFR-001"],
    "compute",
    tr("16 nodes. Reconstructs patterns, calculates coordinates in the Halo."),
    tr(
      "Supercomputer online. First task: where is Dr. Fridge? Computation time: unknown. I am waiting. I am good at that.",
    ),
    { daten: 10, thermik: 5, signal: 3 },
    [
      st(
        "Racks",
        [
          r(tr("High Alloy"), "hochlegierung", undefined, 2),
          r(tr("Frame"), "rahmen", { mechanik: 6 }, 2),
        ],
        tr("The racks stand."),
      ),
      st(
        tr("Nodes"),
        [
          r(tr("Memory"), "speicherchip", { daten: 4 }, 4),
          r("Qubit", "qubit_chip", { quantum: 5 }),
        ],
        tr("16 nodes report in."),
      ),
      st(
        "Interconnect",
        [
          r(tr("Optical fiber"), "glasfaser", undefined, 2),
          r(tr("Cooling"), "kuehlblock", { thermik: 8 }, 2),
          r(tr("Antimatter"), "antimaterie"),
        ],
        tr("The mesh glows."),
        { puzzle: "pz_solder_aic" },
      ),
    ],
  ),
  dev(
    "TLP-001",
    "Teleport Pad",
    3,
    "teleport",
    100,
    90,
    100,
    ["SCA-001", "DIM-001", "QCP-001"],
    "teleport",
    tr("HaloRider successor. Opens a portal to coordinates in the Halo."),
    tr("Teleport pad charged. I advise against using it. I have advised against it since 2017."),
    { quantum: 9, energie: 7, optik: 3 },
    [
      st(
        tr("Platform"),
        [...FRAME3, r(tr("Lattice"), "nanomaterial")],
        tr("The ring is in place."),
      ),
      st(
        "Matrix",
        [
          r(tr("Superconductor"), "supraleiter", { quantum: 3, energie: 3 }, 3),
          r(tr("Exotics"), "exotische_materie", undefined, 3),
        ],
        tr("The rings hover."),
      ),
      st(
        "Portal",
        [r(tr("Antimatter"), "antimaterie"), r("Plasma", "plasmaring", { energie: 5, thermik: 4 })],
        tr("A circle of light that does not fall."),
        { puzzle: "pz_wiring_kabelbaum" },
      ),
    ],
  ),
];

export const DEVICE_BY_ID: ReadonlyMap<string, DeviceDef> = new Map(DEVICES.map((d) => [d.id, d]));

/** Heavy tier-3 devices overheat without a running thermal manager. */
export const NEEDS_COOLING = (d: DeviceDef): boolean => d.tier === 3 && d.power > 0;

/** Puzzles hosted by an online device (opened from its panel). */
export const DEVICE_PUZZLES: Record<
  string,
  { puzzle: string; label: string; requires?: Condition; hint?: string }[]
> = {
  "CDC-001": [
    { puzzle: "pz_crc", label: tr("Check corrupted data stream #0089") },
    { puzzle: "pz_cipher", label: tr("Open the encrypted relic") },
    {
      puzzle: "pz_era_shader",
      label: tr("Calibrate the crystal display's era shader"),
      requires: { insight: "kristall_0089" },
      hint: tr("Only once the cache knows Crystal #0089 is there anything to render."),
    },
  ],
  "HMS-001": [
    {
      puzzle: "pz_tones",
      label: tr("Play the four-tone handshake"),
      requires: { all: [{ insight: "vier_toene" }, { device: "SPK-001" }] },
      hint: tr(
        "Without a speaker (SPK-001) no one can answer — and which tones? Damien's log #0512 or F1N-DR knows.",
      ),
    },
    { puzzle: "pz_stencil_shard", label: tr("Stencil a micro-shard for the resonator") },
  ],
  "UEC-001": [{ puzzle: "pz_solder_uec", label: tr("Re-solder the core board (optional)") }],
  "PWB-001": [
    { puzzle: "pz_clamp_volatility", label: tr("Choose a clamp pattern for volatile slices") },
  ],
  "OSC-001": [{ puzzle: "pz_trend_ticker", label: tr("Trend dial: predict the rotation") }],
  "INT-001": [{ puzzle: "pz_hue_prism", label: tr("Match the hue at the prism output") }],
  "DIM-001": [
    {
      puzzle: "pz_palette_int",
      label: tr("Wire the rift's color palette"),
      requires: { insight: "unstables" },
      hint: tr("The rift has no colors yet. First listen to who is speaking in it."),
    },
  ],
  "ECR-001": [
    {
      puzzle: "pz_morse_whisper",
      label: tr("Decipher the whisper in the noise"),
      requires: { device: "SPK-001" },
      hint: tr(
        "The whisper is too quiet. Without a Narrow Speaker (SPK-001) all you hear is noise.",
      ),
    },
  ],
  "NET-001": [
    {
      puzzle: "pz_memetic_f1ndr",
      label: tr("Tune F1N-DR's memetic relay"),
      requires: { insight: "f1ndr_relay" },
      hint: tr("F1N-DR has to transmit over the network first (talk to him in the west corridor)."),
    },
  ],
};

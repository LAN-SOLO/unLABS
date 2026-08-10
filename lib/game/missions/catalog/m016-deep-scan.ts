/**
 * M016 — "Deep Scan"
 * ====================
 *
 * The three science devices (EMC-001, QAN-001, QSM-001) must all be
 * operational. Completing this mission sets `deep_scan_complete` which
 * gates EP5 step 3.
 *
 * Task 1 is the calibration ritual straight out of Fridge's report #003
 * (detector at maximum, dimension monitor scanning) — which is also,
 * not coincidentally, the DARK-CARRIER resonance recipe. Task 2 is the
 * scan itself plus the power margin to sustain 142 W of science.
 */

import type { Mission } from "../types";

export const M016: Mission = {
  id: "M016",
  title: "Deep Scan",
  flavor: "Three devices, 142 watts, one anomaly. Time to see what it actually is.",
  category: "progression",
  priority: 16,
  unlockRequires: ["quantum_pair_online", "emc_001_online"],
  sequential: false,
  tasks: [
    {
      id: "m016.task.calibrate",
      label: "Calibrate the array",
      objectives: [
        {
          id: "m016.obj.read_calibration",
          description: "Read Fridge's calibration report #003",
          type: "command",
          target: "cat /unvar/log/fridge/calibration_003.dat",
          targetValue: 1,
          hint: "Fridge cross-referenced the instruments once before. The report is in /unvar/log/fridge/.",
          deepDiveHint:
            "Run: cat /unvar/log/fridge/calibration_003.dat — the report documents a secondary carrier that only appears when AND-001 sits at maximum sensitivity while DIM-001 scans and the oscilloscope listens. Three independent confirmations. 'This signal predates the lab.'",
        },
        {
          id: "m016.obj.and_max",
          description: "Set AND-001 sensitivity to maximum (100)",
          type: "device_action",
          target: "AND-001",
          targetValue: 100,
          property: "sensitivity",
          hint: "Drag the SENS slider on the AND-001 tile all the way up, or run `and signal 100`.",
          deepDiveHint:
            "The detector must be online first. From the terminal: `and signal 100` (aliases: `anomaly`, `detector`); from the panel: the SENS slider on AND-001's tile in the Core Operations row. At 100 the noise floor is brutal — which is precisely where the carrier hides.",
          relatedDeviceIds: ["AND-001"],
        },
        {
          id: "m016.obj.dim_diag",
          description: "Run DIM-001 diagnostics with `dim test`",
          type: "command",
          target: "dim test",
          targetValue: 1,
          hint: "Power on the Dimension Monitor and run `dim test` — the diagnostic sweep includes a rift scan.",
          deepDiveHint:
            "`dim test` requires DIM-001 online and walks the device through its full diagnostic cycle, including the rift-scan phase Fridge's report calls 'mode: scan'. Run it while the detector is pinned at 100 and the oscilloscope is live — per report #003, the window is about 20 seconds.",
          relatedDeviceIds: ["DIM-001", "OSC-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "fridge",
          text: "ENG LOG: deep scan pre-flight. required: AND-001 at maximum gain, DIM-001 in scan mode, OSC-001 listening. reference: calibration report #003. read it. I wrote it for a reason.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ CAL ] instrument cross-calibration complete · array phase-aligned · awaiting deep scan window",
        },
      ],
    },
    {
      id: "m016.task.scan",
      label: "Run the deep anomaly scan",
      objectives: [
        {
          // Was a flag objective on `deep_scan_complete` — circular, since
          // only this mission's own claim reward sets that flag (the claim
          // still sets it; EP5 gates on it downstream). The player action
          // is the `scan` command; the sibling objectives enforce that the
          // array is actually up when it happens.
          id: "m016.obj.scan",
          description: "Run the deep scan (type `scan`) with EMC-001, QAN-001, and QSM-001 up",
          type: "command",
          target: "scan",
          targetValue: 1,
          hint: "Bring all three science devices online, then run `scan` in the terminal.",
          deepDiveHint:
            "EMC-001 (40W) + QAN-001 (80W) + QSM-001 (22W) = 142W combined draw. Make sure your energy budget can sustain all three simultaneously, then type `scan` — the deep scan triangulates the anomaly across dimensional axes.",
          relatedDeviceIds: ["EMC-001", "QAN-001", "QSM-001"],
        },
        {
          id: "m016.obj.power_margin",
          description: "Hold 1,000 Energy while the array runs",
          type: "resource_threshold",
          target: "energy",
          targetValue: 1000,
          hint: "142 watts of continuous science needs headroom. Keep the bank above 1,000 during the scan.",
          deepDiveHint:
            "The triad draws 142 W sustained on top of everything else in the lab. With MFR-001's +250 E/s the bank recovers fast, but a rush of production jobs can still drain it mid-scan. Hold 1,000 banked — a scan interrupted by a brownout is a scan you run twice.",
          relatedDeviceIds: ["MFR-001"],
        },
        {
          id: "m016.obj.detector_watch",
          description: "Monitor the detector with `and`",
          type: "command",
          target: "and",
          targetValue: 1,
          hint: "Run `and` in the terminal to watch the detector feed while the array scans.",
          deepDiveHint:
            "`and` prints AND-001's live status — signal strength, sensitivity, anomalies found. During the deep scan the detector is your early-warning channel: if the anomaly reacts to being measured, this is where it will show first.",
          relatedDeviceIds: ["AND-001"],
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ SCAN ] deep triangulation complete · 7 dimensional axes resolved · dataset sealed",
        },
        {
          voice: "jade",
          text: "you looked all the way down. remember that it looked back. it always looks back.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "deep_scan_complete", value: true },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 5 },
    { kind: "grant_resource", resourceId: "research", amount: 10 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Seven dimensional axes. The anomaly is not a point — it is a volume. A volume that contains this lab, this conversation, and approximately everything we thought we understood about spatial geometry.",
    },
  ],
};

/**
 * M016 — "Deep Scan"
 * ====================
 *
 * The three science devices (EMC-001, QAN-001, QSM-001) must all be
 * operational. Completing this mission sets `deep_scan_complete` which
 * gates EP5 step 3.
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
      id: "m016.task.scan",
      label: "Run the deep anomaly scan",
      objectives: [
        {
          id: "m016.obj.scan",
          description: "Run a deep scan with EMC-001, QAN-001, and QSM-001 all operational",
          type: "flag",
          target: "deep_scan_complete",
          targetValue: 1,
          hint: "All three science devices must be built and powered. The scan runs automatically once all conditions are met.",
          deepDiveHint:
            "EMC-001 (40W) + QAN-001 (80W) + QSM-001 (22W) = 142W combined draw. Make sure your energy budget can sustain all three simultaneously. The deep scan triangulates the anomaly across dimensional axes.",
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

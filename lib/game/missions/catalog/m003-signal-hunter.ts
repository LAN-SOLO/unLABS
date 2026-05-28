/**
 * M003 — "Signal Hunter"
 * ======================
 *
 * Exploration mission introducing the Anomaly Detector (AND-001) and
 * terminal-based anomaly scanning. Teaches the player that the terminal
 * is a first-class discovery tool.
 */

import type { Mission } from "../types";

export const M003: Mission = {
  id: "M003",
  title: "Signal Hunter",
  flavor: "The oscilloscope showed you a shadow. The anomaly detector will show you what casts it.",
  category: "exploration",
  priority: 3,
  unlockRequires: ["missions_unlocked", "anomaly_mode"],
  tasks: [
    {
      id: "m003.task.power_and",
      label: "Power on AND-001",
      objectives: [
        {
          id: "m003.obj.and_powered",
          description: "Power on the Anomaly Detector",
          type: "device_action",
          target: "AND-001",
          targetValue: 1,
          property: "powered",
          hint: "Find AND-001 in the Core Operations section of the panel and toggle it on.",
          deepDiveHint:
            "The Anomaly Detector (AND-001) is in the Core Operations row, middle section. Click its power indicator or toggle to bring it online. It draws moderate power.",
          relatedDeviceIds: ["AND-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "mcp",
          text: "The Anomaly Detector is the closest thing this lab has to a stethoscope. It listens to frequencies I cannot hear.",
        },
      ],
    },
    {
      id: "m003.task.sensitivity",
      label: "Calibrate sensitivity",
      objectives: [
        {
          id: "m003.obj.and_sensitivity",
          description: "Set AND-001 sensitivity above 70",
          type: "device_action",
          target: "AND-001",
          targetValue: 70,
          property: "sensitivity",
          hint: "Adjust the sensitivity slider on AND-001. Higher sensitivity means more noise — but also more signal.",
          deepDiveHint:
            "On the AND-001 tile, find the sensitivity control. Drag it above 70. At high sensitivity the detector picks up faint anomaly signatures that would otherwise be lost in the thermal noise floor.",
          relatedDeviceIds: ["AND-001"],
        },
      ],
    },
    {
      id: "m003.task.scan",
      label: "Run an anomaly scan",
      objectives: [
        {
          id: "m003.obj.scan_command",
          description: "Execute `scan anomaly` in the terminal",
          type: "command",
          target: "scan anomaly",
          targetValue: 1,
          hint: "Open the terminal and type `scan anomaly`. The detector feeds data to the scan subsystem.",
          deepDiveHint:
            "Click the terminal module or press the terminal shortcut. Type `scan anomaly` and press Enter. The scan uses AND-001's current sensitivity setting — make sure it is above 70 before scanning.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ AND ] anomaly signatures detected · 3 candidates tagged · recommend further analysis",
        },
        {
          voice: "jade",
          text: "the anomalies do not hide from the detector. they just stop moving when they know you are looking. clever, in a polite sort of way.",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "anomaly_hunter", value: true },
    { kind: "grant_resource", resourceId: "research", amount: 3 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Three anomaly candidates. I was hoping for zero. Well done, I suppose.",
    },
  ],
};

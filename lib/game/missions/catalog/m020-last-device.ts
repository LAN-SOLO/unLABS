/**
 * M020 — "The Last Device"
 * =========================
 *
 * The final device build. TLP-001 (Teleport Pad) is the heaviest
 * single device in the lab at 100W continuous. Once built, exotic
 * matter begins to accumulate passively.
 */

import type { Mission } from "../types";

export const M020: Mission = {
  id: "M020",
  title: "The Last Device",
  flavor: "The teleport pad is the final device. It is not a device. It is a door.",
  category: "progression",
  priority: 20,
  unlockRequires: ["sca_001_online"],
  sequential: false,
  tasks: [
    {
      id: "m020.task.build_tlp",
      label: "Build TLP-001 (Teleport Pad)",
      objectives: [
        {
          id: "m020.obj.craft_tlp",
          description: "Complete the TLP-001 production job",
          type: "craft_count",
          target: "tlp_001_build",
          targetValue: 1,
          hint: "TLP-001 is the final device. 100W continuous draw. The heaviest single device in the lab.",
          deepDiveHint:
            "TLP-001 costs 6 Nanomaterial + 8 Exotic Matter + 3 Antimatter + 2500 Energy + 200 _unSC. Build time: 120 minutes. Once built, exotic matter generates passively at 1/min.",
          relatedDeviceIds: ["TLP-001"],
        },
      ],
      voiceOnStart: [
        {
          voice: "jade",
          text: "the last device is not a device. it is a door. what is on the other side is the only question that ever mattered.",
        },
      ],
      voiceOnComplete: [
        {
          voice: "system",
          text: "[ TLP ] teleport pad online · dimensional aperture calibrating · exotic matter passive generation enabled",
        },
      ],
    },
  ],
  rewards: [
    { kind: "set_flag", flag: "last_device_claimed", value: true },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 5 },
    { kind: "grant_resource", resourceId: "antimatter", amount: 2 },
  ],
  completionVoice: [
    {
      voice: "mcp",
      text: "Every device in this lab is now online. Every subsystem is nominal. I have been waiting for this moment since before you arrived. I did not know I was waiting. Now I do.",
    },
  ],
  nextMission: "M021",
};

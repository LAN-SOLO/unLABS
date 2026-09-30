/**
 * What firmware updates mean in the Lab World (content).
 * ======================================================
 *
 * The factory manifests (version, build, checksum, feature tags) come from
 * the device docs (`devices/tier-*\/<ID>/firmware.json`). This table adds the
 * world meaning of each device's one lab update:
 *
 * - `source` — where the image comes from:
 *   - `net`    NET-001 online and the device linked to it (download);
 *   - `mcp`    MCP-000 online and the device linked to it (admin push);
 *   - `manual` a service image already on the device, but the checksum must be
 *              typed in by hand (FIRMWARE-SPEC "checksum match") — the player
 *              has to find it somewhere in the lab (archive entry, terminal file).
 * - `unlock` — the feature tag the update adds, and what it does in play
 *   (checked with `hasFeature`, lib/world/firmware.ts).
 * - `changelog` — shown in the device interface before flashing.
 * - `requires` — extra precondition (device, puzzle, insight …).
 * - `image` — only for devices whose docs list no update: the lab's own image.
 *
 * Player-visible text is English inside `tr()`; German in lib/i18n/de/firmware.ts.
 */
import { tr } from "@/lib/i18n";
import type { FirmwareImage, FirmwareManifest } from "@/lib/world/firmware";
import type { Condition } from "@/lib/world/types";

export type FirmwareSource = "net" | "mcp" | "manual";

export interface WorldFirmwareDef {
  source: FirmwareSource;
  unlock: {
    /** Feature tag (kebab-case, FIRMWARE-SPEC §8). */
    tag: string;
    label: string;
    /** What the feature does in the game (device interface, archive). */
    text: string;
  };
  changelog: readonly string[];
  requires?: Condition;
  requiresHint?: string;
  /** Update image for devices whose firmware.json has no `update`. */
  image?: FirmwareImage & { minVersion: string; reboot: boolean };
}

/** MCP-000 has no firmware.json (it is not a buildable lab device). */
export const MCP_MANIFEST: FirmwareManifest = {
  id: "MCP-000",
  factory: {
    version: "0.9.7",
    build: "2019.03.07",
    checksum: "MCP00097",
    features: ["lab-admin", "device-registry", "link-broker", "fw-push", "voice-dry"],
    securityPatch: "2019.03.01",
  },
};

/**
 * Lab updates per device. Devices missing here keep their factory image
 * (their docs may list an update, but the lab has no way to get it).
 *
 * The numbers behind each feature live in `FW_TUNING` (lib/world/firmware.ts)
 * and are applied where the rule lives (game.ts power/drone/research/salvage,
 * device-ops.ts hub capacity). Mandatory on the main path: NET-001 (EXD-001
 * navigation) and PWR-001 (MFR-001 plasma stage); every other update is a
 * bonus.
 */
export const WORLD_FIRMWARE: Readonly<Record<string, WorldFirmwareDef>> = {
  // ── manual: checksum hidden in the lab (content/archive/*) ─────────
  "NET-001": {
    source: "manual",
    unlock: {
      tag: "fw-mirror",
      label: tr("Firmware mirror"),
      text: tr(
        "NET-001 mirrors update images for every device linked to it — a linked device can then be flashed over the network. The Explorer Drone's navigation needs this image too.",
      ),
    },
    changelog: [
      tr("Adds a local firmware mirror for linked devices."),
      tr("Deep packet inspection: drone beacon telemetry is no longer dropped as noise."),
      tr("Packet inspector no longer flags the MCP's sighs as malware."),
    ],
  },
  "VNT-001": {
    source: "manual",
    unlock: {
      tag: "quiet-mode",
      label: tr("Quiet mode"),
      text: tr("The ventilation throttles its fans between gusts: 1.5 W instead of 4 W."),
    },
    changelog: [
      tr("Quiet mode: fans idle between gusts (draw 4 W → 1.5 W)."),
      tr("Filter clog prediction. The filter is clogged. Predicted."),
    ],
  },
  "BTK-001": {
    source: "manual",
    unlock: {
      tag: "torque-profiles",
      label: tr("Torque profiles"),
      text: tr(
        "Gentle torque profiles for delicate assemblies: anything made of two parts comes apart without losing either.",
      ),
    },
    changelog: [
      tr("New torque profiles: two-part assemblies are taken apart without loss."),
      tr("Tool wear estimation. The screwdriver is fine. The screwdriver has always been fine."),
    ],
  },
  "LCT-001": {
    source: "manual",
    unlock: {
      tag: "adaptive-focus",
      label: tr("Adaptive focus"),
      text: tr("The laser tracks the surface distance and wastes less beam: 40 W instead of 55 W."),
    },
    changelog: [
      tr("Adaptive beam focus with surface distance compensation (draw 55 W → 40 W)."),
      tr("Dual-sensor beam path interlock. Please keep your eyes where they are."),
    ],
  },
  "MFR-001": {
    source: "manual",
    unlock: {
      tag: "fuel-autotune",
      label: tr("Fuel auto-tune"),
      text: tr("The reactor tunes its fuel mixture continuously: 285 W instead of 250 W."),
    },
    changelog: [
      tr("Fuel mixture auto-tuning: +35 W sustained output."),
      tr("Auto-SCRAM cascade under 100 ms. Previously: “eventually”."),
    ],
  },
  // ── net: NET-001 with its firmware mirror, device linked to it ─────
  "EXD-001": {
    source: "net",
    unlock: {
      tag: "fast-return",
      label: tr("Fast return"),
      text: tr(
        "Path optimisation in the shaft and a smarter charge cycle: the drone is ready again after 125 s instead of 150 s.",
      ),
    },
    changelog: [
      tr("Obstacle avoidance and path optimisation in the shaft."),
      tr("Charge cycle shortened: 150 s → 125 s between flights."),
    ],
  },
  "RMG-001": {
    source: "net",
    unlock: {
      tag: "duty-cycle",
      label: tr("Coil duty cycling"),
      text: tr("The magnet pulses its coils instead of holding them: 8 W instead of 10 W."),
    },
    changelog: [
      tr("Adaptive coil duty cycling (draw 10 W → 8 W)."),
      tr("Selective polarity. Paper clips are no longer a crystal component."),
    ],
  },
  "MSC-001": {
    source: "net",
    unlock: {
      tag: "batch-scan",
      label: tr("Batch scan"),
      text: tr(
        "The scanner sweeps every refilling source within reach at once: its readout names the ones that are full right now.",
      ),
    },
    changelog: [
      tr("Batch analysis mode: the readout lists refilling sources ready to harvest."),
      tr("200+ new compound signatures. None of them is coffee."),
    ],
  },
  "CDC-001": {
    source: "net",
    unlock: {
      tag: "slice-cache",
      label: tr("Slice cache"),
      text: tr(
        "Predictive cache warming: the cache's readout lists, per level, how many slices of Crystal #0089 are still missing.",
      ),
    },
    changelog: [
      tr("Parallel slice lookups; the readout counts missing slices per level."),
      tr("Fixed a race condition in auto-sync. The race was won by nobody."),
    ],
  },
  "BAT-001": {
    source: "net",
    unlock: {
      tag: "fast-charge",
      label: tr("Adaptive charging"),
      text: tr(
        "Adaptive current profiles: the battery buffer adds 55 W to the grid instead of 40 W.",
      ),
    },
    changelog: [
      tr("Adaptive current profiling: buffer +40 W → +55 W."),
      tr("Deep-discharge recovery. For the next time nobody comes back for seven years."),
    ],
  },
  "P3D-001": {
    source: "net",
    unlock: {
      tag: "purge-saver",
      label: tr("Purge saver"),
      text: tr("Less purge waste when switching material: every third print needs no Base Alloy."),
    },
    changelog: [
      tr("Multi-material switching with 60 % less purge waste: every third print is free."),
      tr("Layer defect inspection. It found some. In the previous firmware."),
    ],
  },
  "AIC-001": {
    source: "net",
    unlock: {
      tag: "self-optimize",
      label: tr("Self-optimising scheduler"),
      text: tr(
        "The AI core plans the Nexus research queue: while it is online, a research cycle takes 60 s instead of 90 s.",
      ),
    },
    changelog: [
      tr("Self-optimising learning mode: Nexus research cycles every 60 s."),
      tr("Expanded context window. It now remembers what it was about to say. Mostly."),
    ],
  },
  "MEM-001": {
    source: "net",
    unlock: {
      tag: "leak-trace",
      label: tr("Leak trace"),
      text: tr(
        "The memory monitor traces unindexed records: its readout names a room that still holds an unread note.",
      ),
    },
    changelog: [
      tr("Leak detection with origin tracing: the readout points to unread notes."),
      tr("Page fault prediction. It predicts you will read this. It was right."),
    ],
  },
  // ── mcp: MCP-000 online, device in its device registry ────────────
  "PWR-001": {
    source: "mcp",
    unlock: {
      tag: "fusion-sequencer",
      label: tr("Fusion start sequencer"),
      text: tr(
        "Load shedding for a fusion ignition — the Microfusion Reactor will not ignite without it. Also adds two priority circuits (8 instead of 6).",
      ),
    },
    changelog: [
      tr("Fusion start sequencer: sheds load during an ignition (required by MFR-001)."),
      tr("Two additional priority circuits."),
      tr("Emergency cutoff no longer cuts off the emergency."),
    ],
    image: {
      version: "1.1.0",
      build: "2019.02.11",
      checksum: "P1W4R3F5",
      minVersion: "1.0.0",
      reboot: true,
    },
  },
  "NXS-01": {
    source: "mcp",
    unlock: {
      tag: "prereq-chain",
      label: tr("Prerequisite chains"),
      text: tr(
        "The Nexus sees which steps a topic really needs and skips the rest: +2 research points per cycle.",
      ),
    },
    changelog: [
      tr("Prerequisite-chain highlighting: +2 research points per cycle."),
      tr("Less graph jitter. The graph was nervous. Understandably."),
    ],
  },
  "CLK-001": {
    source: "mcp",
    unlock: {
      tag: "event-scheduler",
      label: tr("Event scheduler"),
      text: tr(
        "The clock schedules the lab's refill cycles: refilling sources come back 20 % sooner.",
      ),
    },
    changelog: [
      tr("Lab event scheduling: refill cycles 20 % shorter."),
      tr("Drift under 0.5 ppm. Day 2,561 is now exactly day 2,561."),
    ],
  },
  "DGN-001": {
    source: "mcp",
    unlock: {
      tag: "deep-scan",
      label: tr("Deep scan"),
      text: tr(
        "Full device bus analysis: the console reports on every open blueprint (not just three) and on pending updates of its probed devices.",
      ),
    },
    changelog: [
      tr("Deep-scan mode: findings for every open blueprint."),
      tr("Firmware certificate checks for probed devices."),
    ],
  },
  "THM-001": {
    source: "mcp",
    unlock: {
      tag: "loop-balancer",
      label: tr("Loop balancer"),
      text: tr("Balanced cooling loops: linked machines draw 20 % less instead of 10 %."),
    },
    changelog: [
      tr("Loop balancing across all cooling circuits (linked machines −20 % draw)."),
      tr("Emergency cooling now asks before freezing the coffee."),
    ],
    image: {
      version: "1.1.0",
      build: "2019.02.11",
      checksum: "T2H5M4L7",
      minVersion: "1.0.0",
      reboot: true,
    },
  },
  "TLP-001": {
    source: "mcp",
    unlock: {
      tag: "precharge",
      label: tr("Pre-charge buffer"),
      text: tr("The pad pre-charges its capacitors in the idle time: 60 W instead of 100 W."),
    },
    changelog: [
      tr("Energy buffer pre-charge mode (draw 100 W → 60 W)."),
      tr("Destination cache. It remembers where you went. It will not tell anyone. Probably."),
    ],
  },
  "EMC-001": {
    source: "mcp",
    unlock: {
      tag: "breach-guard",
      label: tr("Breach guard"),
      text: tr(
        "Triple-redundant containment: when a mix blows up on the workbench, one of its parts is caught and returned.",
      ),
    },
    changelog: [
      tr("Breach prediction: explosions spare one input part."),
      tr("Particle trajectory prediction. The particles were not consulted."),
    ],
  },
  "QSM-001": {
    source: "mcp",
    unlock: {
      tag: "collapse-watch",
      label: tr("Collapse watch"),
      text: tr(
        "The simulator only re-measures qubits that are about to decohere: 15 W instead of 22 W.",
      ),
    },
    changelog: [
      tr("Predictive decoherence warnings (draw 22 W → 15 W)."),
      tr("Wave function display. It looks like soup. Quantum soup."),
    ],
  },
};

/**
 * Resonance protocol catalog
 * ==========================
 *
 * Static definitions of all resonance protocols. Like recipes, protocols
 * are code (not DB rows) because their sequences and rewards are part of
 * the game's balance and belong in version control.
 */

import type { ResonanceProtocol } from "./types";

export const PROTOCOLS: ResonanceProtocol[] = [
  // ── UNCOMMON ────────────────────────────────────────────────────────

  {
    id: "HARMONIC-7",
    codename: "Harmonic Convergence",
    description:
      "When three devices sing the same frequency, the lab remembers a resonance pattern from its first activation. The walls hum. The oscilloscope stutters. Something wakes up.",
    loreClue: "when three sing the same note, the lab remembers what it forgot",
    loreLocation: "/unvar/log/jade/day47.txt",
    sequence: [
      {
        kind: "device_param",
        deviceId: "HMS-001",
        param: "frequency",
        condition: "== 37",
        description: "Set HMS-001 frequency to 37 Hz",
      },
      {
        kind: "device_param",
        deviceId: "ECR-001",
        param: "pulseValue",
        condition: "== 37",
        description: "Set ECR-001 pulse value to 37",
      },
      {
        kind: "device_param",
        deviceId: "SPK-001",
        param: "volume",
        condition: "== 37",
        description: "Set SPK-001 volume to 37",
      },
    ],
    windowSec: 30,
    rewards: [
      { kind: "grant_resource", resourceId: "research", amount: 5 },
      { kind: "set_flag", flag: "resonance_harmonic", value: true },
    ],
    discoveryFlag: "resonance_harmonic",
    repeatable: false,
    rarity: "uncommon",
  },

  // ── RARE ────────────────────────────────────────────────────────────

  {
    id: "ENTANGLE-ALPHA",
    codename: "Quantum Entanglement",
    description:
      "The Quantum State Monitor and Quantum Analyzer form an entangled pair when synchronized. Running the bridge protocol locks them into correlated states — information transfers instantaneously between the devices.",
    loreClue: "entanglement is not magic. it is the universe's refusal to forget a relationship.",
    loreLocation: "/unproc/quantum/decoherence_log",
    sequence: [
      {
        kind: "device_state",
        deviceId: "QSM-001",
        condition: "active",
        description: "Power on QSM-001",
      },
      {
        kind: "device_state",
        deviceId: "QUA-001",
        condition: "active",
        description: "Power on QUA-001",
      },
      {
        kind: "command",
        command: "qbridge sync",
        condition: "executed",
        description: "Run qbridge sync in the terminal",
      },
    ],
    windowSec: 10,
    rewards: [
      { kind: "grant_resource", resourceId: "research", amount: 10 },
      { kind: "grant_resource", resourceId: "exotic_matter", amount: 1 },
      { kind: "set_flag", flag: "resonance_entangle", value: true },
    ],
    discoveryFlag: "resonance_entangle",
    repeatable: false,
    rarity: "rare",
  },

  {
    id: "DARK-CARRIER",
    codename: "Dark Carrier Signal",
    description:
      "A secondary carrier wave hidden in the oscilloscope output. It appears only when the anomaly detector is at maximum sensitivity and the dimensional monitor is actively scanning. The carrier contains a signal that predates the lab by several decades.",
    loreClue:
      "secondary carrier at f\u2080\u00b1\u03b4 \u2014 origin external \u2014 instrument error?",
    loreLocation: "/unvar/log/fridge/calibration_003.dat",
    sequence: [
      {
        kind: "device_state",
        deviceId: "OSC-001",
        condition: "active",
        description: "Oscilloscope must be powered on",
      },
      {
        kind: "device_param",
        deviceId: "AND-001",
        param: "sensitivity",
        condition: "== 100",
        description: "Set AND-001 sensitivity to maximum (100)",
      },
      {
        kind: "device_param",
        deviceId: "DIM-001",
        param: "mode",
        condition: "== scan",
        description: "Set DIM-001 mode to scan",
      },
    ],
    windowSec: 20,
    rewards: [
      { kind: "grant_resource", resourceId: "research", amount: 15 },
      { kind: "grant_resource", resourceId: "exotic_matter", amount: 2 },
      { kind: "set_flag", flag: "resonance_dark_carrier", value: true },
    ],
    discoveryFlag: "resonance_dark_carrier",
    repeatable: false,
    rarity: "rare",
  },

  // ── LEGENDARY ───────────────────────────────────────────────────────

  {
    id: "THERMAL-PHOENIX",
    codename: "Thermal Phoenix",
    description:
      "The lab was designed to survive extreme heat — but it was also designed to use it. A rapid thermal cycle (heat to critical, purge, then power the exotic matter containment during cooldown) triggers a catalytic reaction that produces antimatter from the thermal gradient itself.",
    loreClue:
      "the lab was designed to survive heat. what nobody expected was that it was designed to *use* it.",
    loreLocation: "Jade voice line (EP3, future)",
    sequence: [
      {
        kind: "thermal_zone",
        condition: ">= 85",
        description: "Let panel temperature reach critical (85\u00b0C+)",
      },
      {
        kind: "device_state",
        deviceId: "VNT-001",
        condition: "purge",
        description: "Trigger VNT-001 emergency purge",
      },
      {
        kind: "device_state",
        deviceId: "EMC-001",
        condition: "active",
        description: "Power on EMC-001 during cooldown",
      },
    ],
    windowSec: 45,
    rewards: [
      { kind: "grant_resource", resourceId: "antimatter", amount: 2 },
      { kind: "grant_resource", resourceId: "research", amount: 25 },
      { kind: "set_flag", flag: "resonance_phoenix", value: true },
    ],
    discoveryFlag: "resonance_phoenix",
    repeatable: false,
    rarity: "legendary",
  },

  {
    id: "NULL-RESONANCE",
    codename: "Null Resonance",
    description:
      "When every Tier 1 device in the lab is powered simultaneously and the kernel performs a deep sync, the lab enters a brief state of total coherence. Every system harmonizes. The anomalies go silent. And for exactly one second, the energy reading shows a number that should be impossible.",
    loreClue: "",
    loreLocation: "Only discoverable by experimentation or community sharing",
    sequence: [
      {
        kind: "device_state",
        deviceId: "CDC-001",
        condition: "active",
        description: "Crystal Data Cache powered",
      },
      {
        kind: "device_state",
        deviceId: "UEC-001",
        condition: "active",
        description: "Unstable Energy Core powered",
      },
      {
        kind: "device_state",
        deviceId: "BAT-001",
        condition: "active",
        description: "Battery Pack powered",
      },
      {
        kind: "device_state",
        deviceId: "HMS-001",
        condition: "active",
        description: "Handmade Synthesizer powered",
      },
      {
        kind: "device_state",
        deviceId: "ECR-001",
        condition: "active",
        description: "Echo Recorder powered",
      },
      {
        kind: "device_state",
        deviceId: "IPL-001",
        condition: "active",
        description: "Interpolator powered",
      },
      {
        kind: "device_state",
        deviceId: "CPU-001",
        condition: "active",
        description: "CPU Monitor powered",
      },
      {
        kind: "device_state",
        deviceId: "CLK-001",
        condition: "active",
        description: "Lab Clock powered",
      },
      {
        kind: "device_state",
        deviceId: "MEM-001",
        condition: "active",
        description: "Memory Monitor powered",
      },
      {
        kind: "command",
        command: "kernel sync --deep",
        condition: "executed",
        description: "Run kernel sync --deep",
      },
    ],
    windowSec: 60,
    rewards: [
      { kind: "grant_resource", resourceId: "antimatter", amount: 3 },
      { kind: "grant_resource", resourceId: "research", amount: 50 },
      { kind: "grant_resource", resourceId: "nanomaterial", amount: 1 },
      { kind: "set_flag", flag: "resonance_null", value: true },
    ],
    discoveryFlag: "resonance_null",
    repeatable: false,
    rarity: "legendary",
  },
];

export function getProtocol(id: string): ResonanceProtocol | null {
  return PROTOCOLS.find((p) => p.id === id) ?? null;
}

export function listProtocols(): ResonanceProtocol[] {
  return PROTOCOLS;
}

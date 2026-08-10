/**
 * Tech-tree catalog.
 *
 * All eight branches are populated. Refine + Tools shipped with the MVP
 * (3 nodes each); the remaining six trees carry 4 nodes (tiers 1–4) in a
 * linear chain per tree — gadgets additionally pulls a cross-tree
 * prerequisite (synergy tree).
 *
 * Effect-ownership rules (set_resource_rate / set_resource_capacity SET
 * absolute values via tick.setRate/setCapacity — they do not add):
 *   - abstractum rate      → tools tree (existing)
 *   - abstractum capacity  → adapters tree
 *   - nanomaterial rate+cap→ optics tree
 *   - exotic_matter cap    → synthesizers tree
 *   - antimatter rate+cap  → synthesizers T4 (single setter)
 *   - research rate        → science tree
 *   - base/advanced alloy caps + energy cap (beyond refine T2) → devices tree
 * Within each linear chain the values are monotonically increasing, so a
 * later claim never regresses an earlier one. One-time grants are used
 * where no safe ladder exists (gadgets).
 *
 * Layout: x is the tree column (0..7, TECH_TREES order), y is the tier
 * (1..5). The graph renderer flips y visually so tier 1 sits at the bottom.
 */

import type { TechNode } from "./types";

// ── Refine tree ────────────────────────────────────────────────────────
const REFINE_T1_ALLOY_EFFICIENCY: TechNode = {
  id: "refine.alloy_efficiency.t1",
  title: "Alloy Efficiency",
  description: "Retool the Smelter feed rate. Base Alloy Ingot jobs complete 25 % faster.",
  tree: "refine",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 40 },
    { resourceId: "energy", amount: 300 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [{ kind: "set_flag", flag: "research_alloy_efficiency", value: true }],
  layout: { x: 0, y: 1 },
};

const REFINE_T2_POWER_CONDENSE: TechNode = {
  id: "refine.power_condense.t2",
  title: "Power Condense",
  description: "Condenser upgrade — energy capacity bumped to 1,500.",
  tree: "refine",
  tier: 2,
  requires: ["refine.alloy_efficiency.t1"],
  costs: [
    { resourceId: "base_alloy", amount: 5 },
    { resourceId: "energy", amount: 800 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "energy", capacity: 1500 },
    { kind: "set_flag", flag: "research_power_condense", value: true },
  ],
  layout: { x: 0, y: 2 },
};

const REFINE_T3_NANOMATERIAL_CATALYST: TechNode = {
  id: "refine.nanomaterial_catalyst.t3",
  title: "Nanomaterial Catalyst",
  description:
    "Halves the time to fabricate Nanomaterial Blocks — useful once you're crafting them at scale.",
  tree: "refine",
  tier: 3,
  requires: ["refine.power_condense.t2"],
  costs: [
    { resourceId: "advanced_alloy", amount: 3 },
    { resourceId: "energy", amount: 2000 },
  ],
  unscBurn: 80,
  durationSec: 1800, // 30 min
  effects: [{ kind: "set_flag", flag: "research_nanomaterial_catalyst", value: true }],
  layout: { x: 0, y: 3 },
};

// ── Tools tree ─────────────────────────────────────────────────────────
const TOOLS_T1_SEEP_TAP: TechNode = {
  id: "tools.seep_tap.t1",
  title: "Extended Seep Tap",
  description:
    "Widens the geothermal tap. Abstractum seep climbs from 1 + 2 = 3/min to 5/min total.",
  tree: "tools",
  tier: 1,
  requires: [],
  costs: [{ resourceId: "abstractum", amount: 20 }],
  unscBurn: 10,
  durationSec: 180, // 3 min
  effects: [
    // +2/min over the post-SMT-01 rate of 3/min → 5/min total.
    { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 5 / 60 },
    { kind: "set_flag", flag: "research_seep_tap", value: true },
  ],
  layout: { x: 1, y: 1 },
};

const TOOLS_T2_EXPLORER_DRONE: TechNode = {
  id: "tools.explorer_drone.t2",
  title: "Explorer Drone Protocol",
  description:
    "Teaches the Explorer Drone to prospect for Abstractum veins autonomously. Unlocks EXD-001 deployment missions.",
  tree: "tools",
  tier: 2,
  requires: ["tools.seep_tap.t1", "refine.alloy_efficiency.t1"],
  costs: [
    { resourceId: "base_alloy", amount: 4 },
    { resourceId: "energy", amount: 600 },
  ],
  unscBurn: 30,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 20 / 60 },
    { kind: "set_flag", flag: "research_explorer_drone", value: true },
  ],
  layout: { x: 1, y: 2 },
};

const TOOLS_T3_DRONE_SWARM: TechNode = {
  id: "tools.drone_swarm.t3",
  title: "Drone Swarm",
  description:
    "Coordinates multiple drones on overlapping Abstractum fields. Seep rate jumps to 100/min.",
  tree: "tools",
  tier: 3,
  requires: ["tools.explorer_drone.t2"],
  costs: [
    { resourceId: "advanced_alloy", amount: 2 },
    { resourceId: "energy", amount: 2500 },
  ],
  unscBurn: 100,
  durationSec: 2400, // 40 min
  effects: [
    { kind: "set_resource_rate", resourceId: "abstractum", ratePerSecond: 100 / 60 },
    { kind: "set_flag", flag: "research_drone_swarm", value: true },
  ],
  layout: { x: 1, y: 3 },
};

// ── Optics tree ────────────────────────────────────────────────────────
// Light + wavelength control. Owns the nanomaterial rate/capacity ladder.
const OPTICS_T1_BEAM_COLLIMATION: TechNode = {
  id: "optics.beam_collimation.t1",
  title: "Beam Collimation",
  description:
    "Aligns the salvaged laser bench to a single coherent axis. Standing-wave traps hold Nanomaterial stock — capacity raised to 25.",
  tree: "optics",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 40 },
    { resourceId: "energy", amount: 300 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [{ kind: "set_resource_capacity", resourceId: "nanomaterial", capacity: 25 }],
  layout: { x: 2, y: 1 },
};

const OPTICS_T2_INTERFERENCE_LITHOGRAPHY: TechNode = {
  id: "optics.interference_lithography.t2",
  title: "Interference Lithography",
  description:
    "Writes sub-wavelength structures with crossed beams. First print run yields 5 Nanomaterial; trap capacity climbs to 40.",
  tree: "optics",
  tier: 2,
  requires: ["optics.beam_collimation.t1"],
  costs: [
    { resourceId: "energy", amount: 900 },
    { resourceId: "nanomaterial", amount: 2 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "nanomaterial", capacity: 40 },
    { kind: "grant_resource", resourceId: "nanomaterial", amount: 5 },
  ],
  layout: { x: 2, y: 2 },
};

const OPTICS_T3_PHOTONIC_LATTICE: TechNode = {
  id: "optics.photonic_lattice.t3",
  title: "Photonic Lattice Printer",
  description:
    "Continuous holographic exposure assembles Nanomaterial unattended — passive output at 0.5/min.",
  tree: "optics",
  tier: 3,
  requires: ["optics.interference_lithography.t2"],
  costs: [
    { resourceId: "energy", amount: 2000 },
    { resourceId: "nanomaterial", amount: 5 },
  ],
  unscBurn: 60,
  durationSec: 2700, // 45 min
  effects: [{ kind: "set_resource_rate", resourceId: "nanomaterial", ratePerSecond: 0.5 / 60 }],
  layout: { x: 2, y: 3 },
};

const OPTICS_T4_COHERENT_MATTER_BEAM: TechNode = {
  id: "optics.coherent_matter_beam.t4",
  title: "Coherent Matter Beam",
  description:
    "Phase-locks the printer array into a single matter beam. Nanomaterial output rises to 2/min, storage lattice to 80.",
  tree: "optics",
  tier: 4,
  requires: ["optics.photonic_lattice.t3"],
  costs: [
    { resourceId: "energy", amount: 2500 },
    { resourceId: "nanomaterial", amount: 8 },
  ],
  unscBurn: 130,
  durationSec: 7200, // 2 h
  effects: [
    { kind: "set_resource_rate", resourceId: "nanomaterial", ratePerSecond: 2 / 60 },
    { kind: "set_resource_capacity", resourceId: "nanomaterial", capacity: 80 },
  ],
  layout: { x: 2, y: 4 },
};

// ── Adapters tree ──────────────────────────────────────────────────────
// Oracle integration. Owns the abstractum capacity ladder; each tier's
// capacity bump makes the next tier's abstractum cost payable.
const ADAPTERS_T1_ORACLE_HANDSHAKE: TechNode = {
  id: "adapters.oracle_handshake.t1",
  title: "Oracle Handshake",
  description:
    "Registers the lab's vault manifest with the off-site oracle. Attested storage raises Abstractum capacity to 250.",
  tree: "adapters",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 50 },
    { resourceId: "research", amount: 5 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [{ kind: "set_resource_capacity", resourceId: "abstractum", capacity: 250 }],
  layout: { x: 3, y: 1 },
};

const ADAPTERS_T2_LEDGER_ATTESTATION: TechNode = {
  id: "adapters.ledger_attestation.t2",
  title: "Ledger Attestation",
  description:
    "Every seep batch now settles against a signed ledger entry. Abstractum capacity climbs to 600; audit notes yield 10 Research.",
  tree: "adapters",
  tier: 2,
  requires: ["adapters.oracle_handshake.t1"],
  costs: [
    { resourceId: "abstractum", amount: 150 },
    { resourceId: "research", amount: 15 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "abstractum", capacity: 600 },
    { kind: "grant_resource", resourceId: "research", amount: 10 },
  ],
  layout: { x: 3, y: 2 },
};

const ADAPTERS_T3_CROSS_CHAIN_BRIDGE: TechNode = {
  id: "adapters.cross_chain_bridge.t3",
  title: "Cross-Chain Bridge",
  description:
    "Bridges the vault index across sibling-lab chains. Abstractum capacity jumps to 1,500; bridge telemetry yields 25 Research.",
  tree: "adapters",
  tier: 3,
  requires: ["adapters.ledger_attestation.t2"],
  costs: [
    { resourceId: "abstractum", amount: 400 },
    { resourceId: "research", amount: 40 },
  ],
  unscBurn: 60,
  durationSec: 2700, // 45 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "abstractum", capacity: 1500 },
    { kind: "grant_resource", resourceId: "research", amount: 25 },
  ],
  layout: { x: 3, y: 3 },
};

const ADAPTERS_T4_AUTONOMOUS_SETTLEMENT: TechNode = {
  id: "adapters.autonomous_settlement.t4",
  title: "Autonomous Settlement",
  description:
    "The oracle clears vault deltas without operator sign-off. Abstractum capacity reaches 4,000; settlement logs yield 60 Research.",
  tree: "adapters",
  tier: 4,
  requires: ["adapters.cross_chain_bridge.t3"],
  costs: [
    { resourceId: "abstractum", amount: 900 },
    { resourceId: "research", amount: 90 },
  ],
  unscBurn: 140,
  durationSec: 7200, // 2 h
  effects: [
    { kind: "set_resource_capacity", resourceId: "abstractum", capacity: 4000 },
    { kind: "grant_resource", resourceId: "research", amount: 60 },
  ],
  layout: { x: 3, y: 4 },
};

// ── Synthesizers tree ──────────────────────────────────────────────────
// Slice/crystal deterministic fabrication. Owns the exotic-matter capacity
// ladder and the (sole) antimatter drip at T4.
const SYNTH_T1_SLICE_COMPILER: TechNode = {
  id: "synthesizers.slice_compiler.t1",
  title: "Slice Compiler",
  description:
    "Compiles a waveform slice into a reproducible crystal seed. The proof-of-determinism run yields 2 Exotic Matter.",
  tree: "synthesizers",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 60 },
    { resourceId: "energy", amount: 300 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [{ kind: "grant_resource", resourceId: "exotic_matter", amount: 2 }],
  layout: { x: 4, y: 1 },
};

const SYNTH_T2_SEED_CRYSTAL_VAULT: TechNode = {
  id: "synthesizers.seed_crystal_vault.t2",
  title: "Seed Crystal Vault",
  description:
    "Cryo-damped racks keep compiled seeds inert. Exotic Matter capacity rises to 40; racking the archive yields 3 more.",
  tree: "synthesizers",
  tier: 2,
  requires: ["synthesizers.slice_compiler.t1"],
  costs: [
    { resourceId: "exotic_matter", amount: 3 },
    { resourceId: "energy", amount: 700 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "exotic_matter", capacity: 40 },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 3 },
  ],
  layout: { x: 4, y: 2 },
};

const SYNTH_T3_DETERMINISTIC_GROWTH: TechNode = {
  id: "synthesizers.deterministic_growth.t3",
  title: "Deterministic Growth Chamber",
  description:
    "Grows whole crystals from a single slice, bit-exact every run. Capacity climbs to 60; the calibration batch yields 6 Exotic Matter.",
  tree: "synthesizers",
  tier: 3,
  requires: ["synthesizers.seed_crystal_vault.t2"],
  costs: [
    { resourceId: "exotic_matter", amount: 8 },
    { resourceId: "energy", amount: 1800 },
  ],
  unscBurn: 60,
  durationSec: 2700, // 45 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "exotic_matter", capacity: 60 },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 6 },
  ],
  layout: { x: 4, y: 3 },
};

const SYNTH_T4_ANTIMATTER_LATTICE: TechNode = {
  id: "synthesizers.antimatter_lattice.t4",
  title: "Antimatter Lattice Seed",
  description:
    "A mirrored slice compiled in reverse. The chamber condenses Antimatter at 0.1/min; containment capacity rises to 25.",
  tree: "synthesizers",
  tier: 4,
  requires: ["synthesizers.deterministic_growth.t3"],
  costs: [
    { resourceId: "exotic_matter", amount: 15 },
    { resourceId: "nanomaterial", amount: 4 },
  ],
  unscBurn: 140,
  durationSec: 7200, // 2 h
  effects: [
    { kind: "set_resource_rate", resourceId: "antimatter", ratePerSecond: 0.1 / 60 },
    { kind: "set_resource_capacity", resourceId: "antimatter", capacity: 25 },
  ],
  layout: { x: 4, y: 4 },
};

// ── Science tree ───────────────────────────────────────────────────────
// Knowledge production. Owns the research rate ladder (base rate is 0;
// only recipes/missions grant one-off Research elsewhere).
const SCIENCE_T1_STRUCTURED_INQUIRY: TechNode = {
  id: "science.structured_inquiry.t1",
  title: "Structured Inquiry",
  description:
    "Replaces ad-hoc note piles with a review protocol. The lab produces a passive 2 Research/min.",
  tree: "science",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 40 },
    { resourceId: "research", amount: 10 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [{ kind: "set_resource_rate", resourceId: "research", ratePerSecond: 2 / 60 }],
  layout: { x: 5, y: 1 },
};

const SCIENCE_T2_PEER_SIMULATION: TechNode = {
  id: "science.peer_simulation.t2",
  title: "Peer Simulation",
  description:
    "Simulated reviewers argue with every draft overnight. Research output rises to 6/min; the backlog clears for 20 Research.",
  tree: "science",
  tier: 2,
  requires: ["science.structured_inquiry.t1"],
  costs: [
    { resourceId: "research", amount: 30 },
    { resourceId: "energy", amount: 600 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [
    { kind: "set_resource_rate", resourceId: "research", ratePerSecond: 6 / 60 },
    { kind: "grant_resource", resourceId: "research", amount: 20 },
  ],
  layout: { x: 5, y: 2 },
};

const SCIENCE_T3_HYPOTHESIS_ENGINE: TechNode = {
  id: "science.hypothesis_engine.t3",
  title: "Hypothesis Engine",
  description:
    "An unsupervised process generates and discards theories faster than the staff can read them. Research output rises to 15/min.",
  tree: "science",
  tier: 3,
  requires: ["science.peer_simulation.t2"],
  costs: [
    { resourceId: "research", amount: 80 },
    { resourceId: "energy", amount: 1500 },
  ],
  unscBurn: 60,
  durationSec: 2700, // 45 min
  effects: [{ kind: "set_resource_rate", resourceId: "research", ratePerSecond: 15 / 60 }],
  layout: { x: 5, y: 3 },
};

const SCIENCE_T4_UNIFIED_FIELD_DRAFT: TechNode = {
  id: "science.unified_field_draft.t4",
  title: "Unified Field Draft",
  description:
    "A working draft that almost closes — the margins glow faintly. Research output rises to 40/min.",
  tree: "science",
  tier: 4,
  requires: ["science.hypothesis_engine.t3"],
  costs: [
    { resourceId: "research", amount: 200 },
    { resourceId: "exotic_matter", amount: 5 },
  ],
  unscBurn: 150,
  durationSec: 7200, // 2 h
  effects: [
    { kind: "set_resource_rate", resourceId: "research", ratePerSecond: 40 / 60 },
    // consumer: TBD (endgame theory gate — no reader yet; wire into an EP7
    // quest trigger or late-mission unlockRequires before shipping).
    { kind: "set_flag", flag: "research_unified_field", value: true },
  ],
  layout: { x: 5, y: 4 },
};

// ── Devices tree ───────────────────────────────────────────────────────
// Physical structure + housings. Owns the alloy capacity ladders and the
// late-game energy capacity steps above refine T2's 1,500.
const DEVICES_T1_CHASSIS_STANDARD: TechNode = {
  id: "devices.chassis_standard.t1",
  title: "Chassis Standard",
  description:
    "One rail spec, one bolt pitch, every rack. Base Alloy storage capacity rises to 120.",
  tree: "devices",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 80 },
    { resourceId: "base_alloy", amount: 4 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [{ kind: "set_resource_capacity", resourceId: "base_alloy", capacity: 120 }],
  layout: { x: 6, y: 1 },
};

const DEVICES_T2_ALLOY_FRAME_LATTICE: TechNode = {
  id: "devices.alloy_frame_lattice.t2",
  title: "Alloy Frame Lattice",
  description:
    "Load-bearing lattice frames free up the heavy shelving. Advanced Alloy capacity rises to 60.",
  tree: "devices",
  tier: 2,
  requires: ["devices.chassis_standard.t1"],
  costs: [
    { resourceId: "base_alloy", amount: 10 },
    { resourceId: "energy", amount: 600 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [{ kind: "set_resource_capacity", resourceId: "advanced_alloy", capacity: 60 }],
  layout: { x: 6, y: 2 },
};

const DEVICES_T3_SUBSTRATE_FOUNDRY: TechNode = {
  id: "devices.substrate_foundry.t3",
  title: "Substrate Foundry Rack",
  description:
    "Crystal substrates cast in-house instead of scavenged. Energy capacity rises to 2,500; the first casting run yields 20 Base Alloy.",
  tree: "devices",
  tier: 3,
  requires: ["devices.alloy_frame_lattice.t2"],
  costs: [
    { resourceId: "advanced_alloy", amount: 5 },
    { resourceId: "energy", amount: 1800 },
  ],
  unscBurn: 60,
  durationSec: 2700, // 45 min
  effects: [
    { kind: "set_resource_capacity", resourceId: "energy", capacity: 2500 },
    { kind: "grant_resource", resourceId: "base_alloy", amount: 20 },
  ],
  layout: { x: 6, y: 3 },
};

const DEVICES_T4_SINGULARITY_HOUSING: TechNode = {
  id: "devices.singularity_housing.t4",
  title: "Singularity Housing",
  description:
    "A chassis rated for loads that bend the room around them. Energy capacity rises to 4,000; the offcuts yield 10 Advanced Alloy.",
  tree: "devices",
  tier: 4,
  requires: ["devices.substrate_foundry.t3"],
  costs: [
    { resourceId: "advanced_alloy", amount: 10 },
    { resourceId: "nanomaterial", amount: 4 },
  ],
  unscBurn: 140,
  durationSec: 7200, // 2 h
  effects: [
    { kind: "set_resource_capacity", resourceId: "energy", capacity: 4000 },
    { kind: "grant_resource", resourceId: "advanced_alloy", amount: 10 },
  ],
  layout: { x: 6, y: 4 },
};

// ── Gadgets tree ───────────────────────────────────────────────────────
// Field gear + cross-tree synergies. No rate/capacity ownership — nodes
// pay out one-time expedition hauls instead, so claim order never
// conflicts with the other trees' ladders.
const GADGETS_T1_RESOURCE_MAGNET: TechNode = {
  id: "gadgets.resource_magnet.t1",
  title: "Resource Magnet",
  description:
    "A handheld coil that drags stray fragments out of the vents. The first sweep recovers 80 Abstractum and 300 Energy.",
  tree: "gadgets",
  tier: 1,
  requires: [],
  costs: [
    { resourceId: "abstractum", amount: 30 },
    { resourceId: "energy", amount: 150 },
  ],
  unscBurn: 10,
  durationSec: 300, // 5 min
  effects: [
    { kind: "grant_resource", resourceId: "abstractum", amount: 80 },
    { kind: "grant_resource", resourceId: "energy", amount: 300 },
  ],
  layout: { x: 7, y: 1 },
};

const GADGETS_T2_QUANTUM_COMPASS: TechNode = {
  id: "gadgets.quantum_compass.t2",
  title: "Quantum Compass",
  description:
    "Points at whatever the lab needs most, which is unsettling. The survey logs yield 25 Research and 8 Base Alloy.",
  tree: "gadgets",
  tier: 2,
  requires: ["gadgets.resource_magnet.t1"],
  costs: [
    { resourceId: "abstractum", amount: 90 },
    { resourceId: "energy", amount: 500 },
  ],
  unscBurn: 25,
  durationSec: 900, // 15 min
  effects: [
    { kind: "grant_resource", resourceId: "research", amount: 25 },
    { kind: "grant_resource", resourceId: "base_alloy", amount: 8 },
  ],
  layout: { x: 7, y: 2 },
};

const GADGETS_T3_RESONANCE_HARVESTER: TechNode = {
  id: "gadgets.resonance_harvester.t3",
  title: "Resonance Harvester",
  description:
    "Taps the hum of the seed-crystal vault and bottles it. The first harvest yields 8 Exotic Matter and 40 Research.",
  tree: "gadgets",
  tier: 3,
  // Cross-tree synergy: needs the synthesizer vault to harvest from.
  requires: ["gadgets.quantum_compass.t2", "synthesizers.seed_crystal_vault.t2"],
  costs: [
    { resourceId: "advanced_alloy", amount: 4 },
    { resourceId: "energy", amount: 1600 },
  ],
  unscBurn: 60,
  durationSec: 2700, // 45 min
  effects: [
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 8 },
    { kind: "grant_resource", resourceId: "research", amount: 40 },
  ],
  layout: { x: 7, y: 3 },
};

const GADGETS_T4_TEMPORAL_POCKET_WATCH: TechNode = {
  id: "gadgets.temporal_pocket_watch.t4",
  title: "Temporal Pocket Watch",
  description:
    "Runs a few seconds ahead of the lab and reports back. The paradox residue condenses into 3 Antimatter, 12 Exotic Matter, and 80 Research.",
  tree: "gadgets",
  tier: 4,
  requires: ["gadgets.resonance_harvester.t3"],
  costs: [
    { resourceId: "exotic_matter", amount: 10 },
    { resourceId: "nanomaterial", amount: 5 },
    { resourceId: "energy", amount: 2200 },
  ],
  unscBurn: 150,
  durationSec: 7200, // 2 h
  effects: [
    { kind: "grant_resource", resourceId: "antimatter", amount: 3 },
    { kind: "grant_resource", resourceId: "exotic_matter", amount: 12 },
    { kind: "grant_resource", resourceId: "research", amount: 80 },
  ],
  layout: { x: 7, y: 4 },
};

export const TECH_NODES: TechNode[] = [
  REFINE_T1_ALLOY_EFFICIENCY,
  REFINE_T2_POWER_CONDENSE,
  REFINE_T3_NANOMATERIAL_CATALYST,
  TOOLS_T1_SEEP_TAP,
  TOOLS_T2_EXPLORER_DRONE,
  TOOLS_T3_DRONE_SWARM,
  OPTICS_T1_BEAM_COLLIMATION,
  OPTICS_T2_INTERFERENCE_LITHOGRAPHY,
  OPTICS_T3_PHOTONIC_LATTICE,
  OPTICS_T4_COHERENT_MATTER_BEAM,
  ADAPTERS_T1_ORACLE_HANDSHAKE,
  ADAPTERS_T2_LEDGER_ATTESTATION,
  ADAPTERS_T3_CROSS_CHAIN_BRIDGE,
  ADAPTERS_T4_AUTONOMOUS_SETTLEMENT,
  SYNTH_T1_SLICE_COMPILER,
  SYNTH_T2_SEED_CRYSTAL_VAULT,
  SYNTH_T3_DETERMINISTIC_GROWTH,
  SYNTH_T4_ANTIMATTER_LATTICE,
  SCIENCE_T1_STRUCTURED_INQUIRY,
  SCIENCE_T2_PEER_SIMULATION,
  SCIENCE_T3_HYPOTHESIS_ENGINE,
  SCIENCE_T4_UNIFIED_FIELD_DRAFT,
  DEVICES_T1_CHASSIS_STANDARD,
  DEVICES_T2_ALLOY_FRAME_LATTICE,
  DEVICES_T3_SUBSTRATE_FOUNDRY,
  DEVICES_T4_SINGULARITY_HOUSING,
  GADGETS_T1_RESOURCE_MAGNET,
  GADGETS_T2_QUANTUM_COMPASS,
  GADGETS_T3_RESONANCE_HARVESTER,
  GADGETS_T4_TEMPORAL_POCKET_WATCH,
];

export function getTechNode(id: string): TechNode | null {
  return TECH_NODES.find((n) => n.id === id) ?? null;
}

export function listTechNodes(): TechNode[] {
  return TECH_NODES;
}

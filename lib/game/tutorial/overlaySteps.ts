/**
 * Tutorial-overlay step library
 * =============================
 *
 * Walks the player through the first missions one click at a time. Each
 * step's `advance` predicate auto-fires the moment the matching state lands,
 * so the player never has to dismiss a step they've already accomplished.
 *
 * Add missions by appending step blocks to `OVERLAY_STEPS` in story order.
 * The overlay starts at step 1 (index 0 means "not started or skipped") so
 * the very first step in this array is the first thing a fresh easy-mode
 * player sees.
 */

import type { OverlayStep } from "./overlayTypes";

export const OVERLAY_STEPS: OverlayStep[] = [
  // ─── Welcome / orientation ─────────────────────────────────────────────
  {
    id: "welcome",
    title: "Welcome to _unOS",
    body:
      "This is your lab terminal. The bottom area is _unOS — type here to run commands.\n\n" +
      "Around it, the hardware panel shows live device readouts. We'll walk through the first few missions together.",
    target: null,
    position: "center",
    advance: { kind: "manual" },
    allowSkipAhead: true,
  },
  {
    id: "open-missions",
    title: "Find the Missions Panel",
    body:
      "Look at the left side of the panel — there's a MISSIONS card listing your active jobs.\n\n" +
      "Each mission has a checklist of tasks. The first one is Power Budget.",
    target: "[aria-label='Missions panel'], .mission-panel, [data-mission-panel]",
    position: "right",
    advance: { kind: "manual" },
    allowSkipAhead: true,
  },

  // ─── M001 — Power Budget ───────────────────────────────────────────────
  {
    id: "m001-craft-energy-cell-intro",
    title: "Mission 1 · Craft an Energy Cell",
    body:
      "Open the Lab to start a production job. From the terminal, type:\n\n" +
      "  lab\n\n" +
      "or click the LAB tab in the panel toolbar.",
    target: "[data-tab='lab'], a[href='/lab']",
    position: "bottom",
    advance: {
      kind: "anyOf",
      conditions: [
        { kind: "objectiveStatus", key: "M001.m001.obj.craft_energy_cell", status: "completed" },
        { kind: "objectiveStatus", key: "M001.m001.obj.craft_energy_cell", status: "in_progress" },
      ],
    },
    allowSkipAhead: true,
  },
  {
    id: "m001-craft-energy-cell",
    title: "Queue an Energy Cell",
    body:
      "Find the Energy Cell recipe in the Lab. It costs 3 Abstractum and takes 30 seconds.\n\n" +
      "Click START to begin the job, then claim it once the timer finishes.",
    target: "[data-recipe='energy_cell'], button[data-recipe-start='energy_cell']",
    position: "right",
    advance: {
      kind: "objectiveStatus",
      key: "M001.m001.obj.craft_energy_cell",
      status: "completed",
    },
  },
  {
    id: "m001-craft-alloy-intro",
    title: "Mission 1 · Craft a Base Alloy Ingot",
    body:
      "Energy alone won't get you far — you need materials. The Base Alloy Ingot is the workhorse for everything you'll build.\n\n" +
      "Recipe: 5 Abstractum, 60 Energy, 1 _unSC. 90 seconds.",
    target: "[data-recipe='base_alloy_ingot']",
    position: "right",
    advance: {
      kind: "objectiveStatus",
      key: "M001.m001.obj.craft_alloy",
      status: "completed",
    },
    allowSkipAhead: true,
  },
  {
    id: "m001-energy-pressure",
    title: "Watch the energy rate",
    body:
      "Check the energy bar at the top of the panel. Right now you're producing energy faster than you spend it.\n\n" +
      "Power on a few more devices from the panel — each one draws power. The mission completes when your net rate dips below 40 E/s.",
    target: "[data-resource='energy']",
    position: "bottom",
    advance: {
      kind: "objectiveStatus",
      key: "M001.m001.obj.energy_rate_dip",
      status: "completed",
    },
  },
  {
    id: "m001-claim",
    title: "Mission complete — claim the reward",
    body: "Power Budget is done. Open the missions panel and click CLAIM to bank the +50 Energy reward and unlock the next gate.",
    target: "[aria-label='Missions panel'], [data-mission-claim='M001']",
    position: "right",
    advance: { kind: "missionStatus", missionId: "M001", status: "claimed" },
    allowSkipAhead: true,
  },

  // ─── M002 — Forge Awakens ──────────────────────────────────────────────
  {
    id: "m002-stockpile-intro",
    title: "Mission 2 · Forge Awakens",
    body:
      "Power Budget taught you that alloys cost energy. Now stockpile three of them — you'll need the surplus for the next recipe.\n\n" +
      "Queue jobs in the Lab. Up to three at once is fine.",
    target: "[data-recipe='base_alloy_ingot']",
    position: "right",
    advance: {
      kind: "objectiveStatus",
      key: "M002.m002.obj.craft_3_alloy",
      status: "completed",
    },
    allowSkipAhead: true,
  },
  {
    id: "m002-advanced",
    title: "Forge an Advanced Alloy",
    body:
      "Three Base Alloys melt into one Advanced Alloy. Find the Advanced Alloy recipe in the Lab and start the job.\n\n" +
      "Cost: 3 Base Alloy + 120 Energy + 3 _unSC. Takes ~2 minutes.",
    target: "[data-recipe='advanced_alloy']",
    position: "right",
    advance: {
      kind: "objectiveStatus",
      key: "M002.m002.obj.craft_advanced",
      status: "completed",
    },
  },

  // ─── M003 — Signal Hunter ──────────────────────────────────────────────
  {
    id: "m003-power-and",
    title: "Mission 3 · Power on AND-001",
    body:
      "AND-001 is the Anomaly Detector. Find it in the Core Operations section of the panel and toggle its power.\n\n" +
      "From the terminal you can also type:\n\n  power on AND-001",
    target: "[data-device='AND-001']",
    position: "left",
    advance: {
      kind: "objectiveStatus",
      key: "M003.m003.obj.and_powered",
      status: "completed",
    },
  },
  {
    id: "m003-sensitivity",
    title: "Calibrate AND-001 sensitivity",
    body:
      "Look for the sensitivity slider on the AND-001 module and push it above 70.\n\n" +
      "Higher sensitivity surfaces more noise, but also more signal — exactly what you want for the next step.",
    target: "[data-device='AND-001'] [data-control='sensitivity']",
    position: "left",
    advance: {
      kind: "objectiveStatus",
      key: "M003.m003.obj.and_sensitivity",
      status: "completed",
    },
    allowSkipAhead: true,
  },
  {
    id: "m003-scan",
    title: "Run an anomaly scan",
    body:
      "AND-001 is feeding data to the scan subsystem. Drop into the terminal and run:\n\n  scan anomaly\n\n" +
      "Watch the output — anything irregular should bubble up.",
    target: "[data-terminal-input], textarea[data-terminal]",
    position: "top",
    advance: {
      kind: "objectiveStatus",
      key: "M003.m003.obj.scan_command",
      status: "completed",
    },
  },

  // ─── M004 — First Resonance ────────────────────────────────────────────
  {
    id: "m004-read-jade",
    title: "Mission 4 · Read Jade's notes",
    body:
      "Jade left research logs in /unvar/log/jade/. Day 47 is the one to start with.\n\n" +
      "From the terminal:\n\n  cat /unvar/log/jade/day47.txt",
    target: "[data-terminal-input], textarea[data-terminal]",
    position: "top",
    advance: {
      kind: "objectiveStatus",
      key: "M004.m004.obj.read_day47",
      status: "completed",
    },
  },
  {
    id: "m004-harmonic",
    title: "Trigger Harmonic Convergence",
    body:
      'Three devices need to "sing the same note". Power on HMS-001, ECR-001, and INT-001, then align them through the resonance subsystem.\n\n' +
      "If you get stuck, type 'guide' in the terminal — that prints the active mission's full walkthrough.",
    target: null,
    position: "center",
    advance: {
      kind: "objectiveStatus",
      key: "M004.m004.obj.harmonic_discovery",
      status: "completed",
    },
    allowSkipAhead: true,
  },

  // ─── Handoff ────────────────────────────────────────────────────────────
  {
    id: "handoff",
    title: "You're set up",
    body:
      "Four missions in — you've got the rhythm. The overlay will step back from here so the lab is yours.\n\n" +
      "Useful commands going forward:\n\n  whatnext   — context-aware next-action suggestion\n  guide      — full walkthrough of the active mission\n  missions   — browse all missions",
    target: null,
    position: "center",
    advance: { kind: "manual" },
    allowSkipAhead: true,
  },
];

/** Total step count, used for progress display ("Step 3/8"). */
export const OVERLAY_STEP_COUNT = OVERLAY_STEPS.length;

/** 1-indexed lookup that matches `tutorial_state.overlayStepIndex` semantics. */
export function getOverlayStep(stepIndex: number): OverlayStep | null {
  if (stepIndex <= 0 || stepIndex > OVERLAY_STEPS.length) return null;
  return OVERLAY_STEPS[stepIndex - 1] ?? null;
}

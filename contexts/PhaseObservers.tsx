"use client";

/**
 * PhaseObservers
 * ==============
 *
 * Small client-side observers that watch derived conditions on the tick
 * engine and emit quest flags when a threshold is held. Lives outside
 * MissionProvider / QuestProvider because it writes server flags (through
 * the allow-listed setQuestFlagAction) rather than in-memory mission
 * state.
 *
 * Observers are idempotent — once the flag is set server-side, the
 * observer does nothing on subsequent ticks.
 *
 * Currently implements:
 *   - abstractum_bottleneck_observed — set when the player has held
 *     Abstractum ≤ 50 for ≥ 60 consecutive seconds AND at least one
 *     production chain is online. Drives EP2 step 3 + mission M009.
 */

import { useEffect, useRef } from "react";

import { useGameTick } from "@/contexts/GameTickProvider";
import { useQuest } from "@/contexts/QuestProvider";
import { useProduction } from "@/contexts/ProductionProvider";
import { useTechTreeOptional } from "@/contexts/TechTreeProvider";
import { setQuestFlagAction } from "@/app/(game)/actions/quest";
import { getTechNode } from "@/lib/game/techTree";

const ABSTRACTUM_THRESHOLD = 50;
const HOLD_SECONDS = 60;

export function PhaseObservers() {
  const tick = useGameTick();
  const quest = useQuest();
  const production = useProduction();
  const techTree = useTechTreeOptional();

  // Track when the player first dipped below the threshold this run.
  // Reset whenever the amount goes back above. Once ≥60 s have elapsed
  // continuously, fire the server action exactly once.
  const firstDipAtRef = useRef<number | null>(null);
  const firedRef = useRef<boolean>(quest.state.flags.abstractum_bottleneck_observed === true);
  const firstProductionFiredRef = useRef<boolean>(quest.state.flags.first_production_run === true);
  const researchStartedFiredRef = useRef<boolean>(quest.state.flags.research_started === true);
  const pickPathFiredRef = useRef<boolean>(quest.state.flags.pick_path_done === true);
  const pickPathDeepFiredRef = useRef<boolean>(quest.state.flags.pick_path_deep === true);
  const welcomeBackFiredRef = useRef<boolean>(quest.state.flags.welcome_back_seen === true);

  // One-shot: flip `first_production_run` the first time we see any
  // claimed production job. This gates EP2 step 2 without needing the
  // full M008 mission (which demands 3 ingots).
  useEffect(() => {
    if (firstProductionFiredRef.current) return;
    if (quest.state.flags.first_production_run === true) {
      firstProductionFiredRef.current = true;
      return;
    }
    const anyClaimed = production.jobs.some((j) => j.status === "claimed");
    if (anyClaimed) {
      firstProductionFiredRef.current = true;
      void setQuestFlagAction("first_production_run", true);
    }
  }, [production.jobs, quest.state.flags.first_production_run]);

  // One-shot: `research_started` — the first time any research job exists
  // (active, claimed, or cancelled). Gates EP3 step 1 + M010.
  useEffect(() => {
    if (researchStartedFiredRef.current) return;
    if (quest.state.flags.research_started === true) {
      researchStartedFiredRef.current = true;
      return;
    }
    if (techTree && techTree.history.length > 0) {
      researchStartedFiredRef.current = true;
      void setQuestFlagAction("research_started", true);
    }
  }, [techTree, quest.state.flags.research_started]);

  // One-shot: `pick_path_done` — unlocked tech-tree nodes span ≥ 2 trees.
  // Gates EP3 step 4 + M012. Catalog metadata (node.tree) is authoritative.
  useEffect(() => {
    if (pickPathFiredRef.current) return;
    if (quest.state.flags.pick_path_done === true) {
      pickPathFiredRef.current = true;
      return;
    }
    if (!techTree) return;
    const trees = new Set<string>();
    for (const nodeId of techTree.treeState.unlocked) {
      const node = getTechNode(nodeId);
      if (node) trees.add(node.tree);
      if (trees.size >= 2) break;
    }
    if (trees.size >= 2) {
      pickPathFiredRef.current = true;
      void setQuestFlagAction("pick_path_done", true);
    }
  }, [techTree, quest.state.flags.pick_path_done]);

  // One-shot: `pick_path_deep` — unlocked contains ≥ 1 node tier ≥ 2 in
  // each of ≥ 2 trees. Gates EP4 step 2 + M013.
  useEffect(() => {
    if (pickPathDeepFiredRef.current) return;
    if (quest.state.flags.pick_path_deep === true) {
      pickPathDeepFiredRef.current = true;
      return;
    }
    if (!techTree) return;
    const deepTrees = new Set<string>();
    for (const nodeId of techTree.treeState.unlocked) {
      const node = getTechNode(nodeId);
      if (node && node.tier >= 2) deepTrees.add(node.tree);
      if (deepTrees.size >= 2) break;
    }
    if (deepTrees.size >= 2) {
      pickPathDeepFiredRef.current = true;
      void setQuestFlagAction("pick_path_deep", true);
    }
  }, [techTree, quest.state.flags.pick_path_deep]);

  // One-shot: `welcome_back_seen` — the player has dismissed the
  // Welcome-Back modal at least once. Cheap proxy for "came back after
  // being away". Uses the tutorial_state.welcomeBackAckAt timestamp
  // written by ackWelcomeBack (see app/(game)/actions/tutorial.ts).
  useEffect(() => {
    if (welcomeBackFiredRef.current) return;
    if (quest.state.flags.welcome_back_seen === true) {
      welcomeBackFiredRef.current = true;
      return;
    }
    if (!tick.hasUnseenOfflineCatchUp && tick.offlineCatchUpSeconds > 60) {
      // The modal was shown and dismissed this session.
      welcomeBackFiredRef.current = true;
      void setQuestFlagAction("welcome_back_seen", true);
    }
  }, [
    tick.hasUnseenOfflineCatchUp,
    tick.offlineCatchUpSeconds,
    quest.state.flags.welcome_back_seen,
  ]);

  useEffect(() => {
    if (firedRef.current) return;
    if (quest.state.flags.abstractum_bottleneck_observed === true) {
      firedRef.current = true;
      return;
    }

    const abstractum = tick.resources.abstractum?.amount ?? 0;
    const anyChainOnline =
      quest.state.flags.smt_01_online === true ||
      quest.state.flags.cnd_01_online === true ||
      quest.state.flags.mix_01_online === true;

    if (!anyChainOnline) {
      firstDipAtRef.current = null;
      return;
    }

    if (abstractum > ABSTRACTUM_THRESHOLD) {
      firstDipAtRef.current = null;
      return;
    }

    const now = Date.now();
    if (firstDipAtRef.current == null) {
      firstDipAtRef.current = now;
      return;
    }

    const elapsed = (now - firstDipAtRef.current) / 1000;
    if (elapsed >= HOLD_SECONDS) {
      firedRef.current = true;
      void setQuestFlagAction("abstractum_bottleneck_observed", true);
    }
  }, [tick.tickCount, tick.resources.abstractum?.amount, quest.state.flags]);

  return null;
}

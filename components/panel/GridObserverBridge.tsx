"use client";

import { useEffect, useRef } from "react";

import { useBATManagerOptional } from "@/contexts/BATManager";
import { useNETManagerOptional } from "@/contexts/NETManager";
import { useMEMManagerOptional } from "@/contexts/MEMManager";
import { useQuest } from "@/contexts/QuestProvider";

/**
 * One-shot observer for the "wake the basic grid" tutorial beat. Must be
 * mounted below the device manager providers (next to PanelSaveBridge).
 * When the operator has powered BAT-001, NET-001, and MEM-001, it sets the
 * `grid_online` quest flag once — the tutorial overlay advances on it.
 */
export function GridObserverBridge() {
  const bat = useBATManagerOptional();
  const net = useNETManagerOptional();
  const mem = useMEMManagerOptional();
  const quest = useQuest();

  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (quest.state.flags.grid_online === true) {
      firedRef.current = true;
      return;
    }
    if (bat?.isPowered && net?.isPowered && mem?.isPowered) {
      firedRef.current = true;
      void quest.setFlag("grid_online", true);
    }
  }, [bat?.isPowered, net?.isPowered, mem?.isPowered, quest]);

  return null;
}

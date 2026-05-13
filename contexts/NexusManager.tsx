"use client";

/**
 * NexusManager
 * ============
 *
 * Client-side state for the NXS-01 "Nexus" device. Intentionally minimal:
 * the device is a gate for the research subsystem, not a mechanical
 * contributor like UEC-001 or MFR-001. We only track online/offline
 * status + firmware metadata; the actual research-job state lives in
 * TechTreeProvider.
 *
 * `isPowered` is derived from the `nexus_built` quest flag (recipe claim
 * sets it). Operators can toggle between online/standby after build — but
 * standby blocks research, matching the design's "must be booted to use"
 * rule.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { useQuest } from "@/contexts/QuestProvider";

export const NXS_FIRMWARE = {
  version: "1.0.0",
  build: "2026.04.24",
  checksum: "NX10A4F2",
  features: ["tech-graph-render", "research-queue", "prereq-resolver", "holo-projection"],
  securityPatch: "2026.04.24",
};

export const NXS_POWER_SPECS = {
  full: 45,
  idle: 12,
  standby: 2,
  category: "light" as const,
  priority: 2 as const,
};

export interface NexusState {
  /** True once the NXS-01 build has been claimed. */
  isBuilt: boolean;
  /** True when the device is powered on (standby when false). */
  isOnline: boolean;
  isExpanded: boolean;
}

interface NexusContextValue extends NexusState {
  firmware: typeof NXS_FIRMWARE;
  powerSpecs: typeof NXS_POWER_SPECS;
  powerOn: () => void;
  powerOff: () => void;
  toggleExpanded: () => void;
}

const NexusContext = createContext<NexusContextValue | null>(null);

export interface NexusProviderProps {
  children: ReactNode;
  initialOnline?: boolean;
}

export function NexusProvider({ children, initialOnline = true }: NexusProviderProps) {
  const quest = useQuest();
  const isBuilt = quest.state.flags.nexus_built === true;

  // Default to online once built so players don't have to toggle. Keep the
  // local toggle in state so a future panel button can surface it.
  const [isOnline, setIsOnline] = useState(initialOnline);
  const [isExpanded, setIsExpanded] = useState(true);

  const powerOn = () => setIsOnline(true);
  const powerOff = () => setIsOnline(false);
  const toggleExpanded = () => setIsExpanded((e) => !e);

  const value = useMemo<NexusContextValue>(
    () => ({
      isBuilt,
      isOnline: isBuilt && isOnline,
      isExpanded,
      firmware: NXS_FIRMWARE,
      powerSpecs: NXS_POWER_SPECS,
      powerOn,
      powerOff,
      toggleExpanded,
    }),
    [isBuilt, isOnline, isExpanded],
  );

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}

export function useNexus(): NexusContextValue {
  const ctx = useContext(NexusContext);
  if (!ctx) {
    throw new Error("useNexus must be used inside <NexusProvider>");
  }
  return ctx;
}

export function useNexusOptional(): NexusContextValue | null {
  return useContext(NexusContext);
}

"use client";

/**
 * useDeviceUnlocked
 * =================
 *
 * Resolves the unlock state for a single device against the live quest flag
 * map. Returns `true` for starter devices, `true` for gated devices whose
 * required flag is set, and `false` otherwise (including unmapped devices).
 *
 * Consumers (device managers, terminal `power on` command, panel modules)
 * use the returned boolean to early-return from `powerOn`, render disabled
 * power buttons, or surface a "LOCKED" indicator.
 */

import { useQuest } from "@/contexts/QuestProvider";
import { isDeviceUnlocked } from "@/lib/game/devices/unlocks";

export function useDeviceUnlocked(deviceId: string): boolean {
  const { state } = useQuest();
  return isDeviceUnlocked(deviceId, state.flags);
}

/**
 * Device unlock gating
 * ====================
 *
 * Source of truth for which devices a player has earned. Devices are either:
 *   - in `STARTER_DEVICES` (always available, no gate), or
 *   - in `DEVICE_UNLOCK_FLAGS` (require a specific quest/mission flag), or
 *   - not listed (locked by default — fail closed).
 *
 * Resolved against `quest.state.flags` (Record<string, boolean>) at runtime
 * via `useDeviceUnlocked()`. The check has no side effects; the consumer
 * decides whether to short-circuit `powerOn`, render a disabled button, etc.
 */

export const STARTER_DEVICES = [
  "CDC-001",
  "BAT-001",
  "BTK-001",
  "CLK-001",
  "MEM-001",
  "NET-001",
  "PWB-001",
  "VNT-001",
] as const;

const STARTER_SET = new Set<string>(STARTER_DEVICES);

/**
 * Maps non-starter device IDs to the quest flag that unlocks them. Flag must
 * resolve truthy in `quest.state.flags` for the device to be powerable.
 */
export const DEVICE_UNLOCK_FLAGS: Readonly<Record<string, string>> = {
  // Tier-1 (non-starter)
  "CPU-001": "tutorial_graduated",
  "MSC-001": "tutorial_graduated",
  "RMG-001": "tutorial_graduated",
  "TMP-001": "tutorial_graduated",
  "THM-001": "tutorial_graduated",
  "ECR-001": "first_resonance",
  "SPK-001": "first_resonance",
  "ATK-001": "missions_power_budget",
  "PWD-001": "missions_power_budget",
  "PWR-001": "missions_power_budget",
  "VLT-001": "missions_power_budget",

  // Tier-2
  "DGN-001": "tutorial_graduated",
  "UEC-001": "missions_power_budget",
  "OSC-001": "osc_001_online",
  "AND-001": "anomaly_mode",
  "QCP-001": "anomaly_mode",
  "HMS-001": "first_resonance",
  "INT-001": "first_resonance",
  "DIM-001": "anomaly_depth",
  "EXD-001": "research_explorer_drone",
  "NXS-01": "nexus_blueprint_visible",
  "LCT-001": "nexus_built",
  "P3D-001": "nexus_built",

  // Tier-3
  "MFR-001": "reactor_online",
  "EMC-001": "forge_mastered",
  "QSM-001": "pick_path_done",
  "AIC-001": "ep3_complete",
  "QAN-001": "ep3_complete",
  "TLP-001": "ep4_complete",
  "SCA-001": "ENDGAME_UNLOCKED",
};

/** Pure check — does the player's current flag set unlock this device? */
export function isDeviceUnlocked(
  deviceId: string,
  flags: Readonly<Record<string, boolean>>,
): boolean {
  if (STARTER_SET.has(deviceId)) return true;
  const flag = DEVICE_UNLOCK_FLAGS[deviceId];
  if (!flag) return false; // unmapped device — fail closed
  return flags[flag] === true;
}

/** Returns the flag name required to unlock a device, or null for starters/unmapped. */
export function getDeviceUnlockFlag(deviceId: string): string | null {
  if (STARTER_SET.has(deviceId)) return null;
  return DEVICE_UNLOCK_FLAGS[deviceId] ?? null;
}

export function isStarterDevice(deviceId: string): boolean {
  return STARTER_SET.has(deviceId);
}

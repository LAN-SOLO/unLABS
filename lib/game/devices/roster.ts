/**
 * Device roster — pure read-side views over the two independent "has the
 * player built this" systems in the active game:
 *
 *   - Panel devices: gated by `lib/game/devices/unlocks.ts` (flag-based).
 *   - Lab production devices: one-shot recipes in `lib/game/recipes.ts`
 *     (`category === "device"`), built status via `isRecipeBuilt`.
 *
 * These are deliberately kept separate rather than merged into one list —
 * they answer different questions ("can I power this panel tile" vs. "have
 * I crafted this device in the Lab") and conflating them would misrepresent
 * either system.
 */

import { getDeviceFirmware } from "@/lib/firmware/registry";
import {
  STARTER_DEVICES,
  DEVICE_UNLOCK_FLAGS,
  isDeviceUnlocked,
  getDeviceUnlockFlag,
} from "./unlocks";
import { RECIPES, isRecipeBuilt, type Recipe } from "@/lib/game/recipes";

export interface PanelDeviceRosterEntry {
  id: string;
  name: string;
  tier: number | null;
  built: boolean;
  /** Quest flag required to unlock, or null for starters. */
  requiredFlag: string | null;
}

export interface ProductionDeviceRosterEntry {
  recipeId: string;
  label: string;
  tier: Recipe["tier"];
  built: boolean;
}

const ALL_PANEL_DEVICE_IDS: readonly string[] = [
  ...STARTER_DEVICES,
  ...Object.keys(DEVICE_UNLOCK_FLAGS),
];

/** All panel devices (~38), with built status derived from quest flags. */
export function buildPanelDeviceRoster(
  flags: Readonly<Record<string, boolean>>,
): PanelDeviceRosterEntry[] {
  return ALL_PANEL_DEVICE_IDS.map((id) => {
    const firmware = getDeviceFirmware(id);
    return {
      id,
      name: firmware?.device_name ?? id,
      tier: firmware?.tier ?? null,
      built: isDeviceUnlocked(id, flags),
      requiredFlag: getDeviceUnlockFlag(id),
    };
  }).sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name));
}

/** Lab-craftable device recipes (~11), with built status via isRecipeBuilt. */
export function buildProductionDeviceRoster(
  flags: Readonly<Record<string, boolean>>,
): ProductionDeviceRosterEntry[] {
  return RECIPES.filter((r) => r.category === "device")
    .map((r) => ({
      recipeId: r.id,
      label: r.label,
      tier: r.tier,
      built: isRecipeBuilt(r, flags),
    }))
    .sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label));
}

/**
 * Achievement registry.
 *
 * Adding a new achievement: create it in `catalog/<branch>.ts`, then import
 * the branch array here and fold it into `ACHIEVEMENTS`. The engine does
 * the rest — no provider changes required.
 */

import { RESOURCE_ACHIEVEMENTS } from "./catalog/resource";
import { ENERGY_ACHIEVEMENTS } from "./catalog/energy";
import { CONSTRUCTION_ACHIEVEMENTS } from "./catalog/construction";
import { BREADTH_ACHIEVEMENTS } from "./catalog/breadth";
import { TRADE_ACHIEVEMENTS } from "./catalog/trade";
import { EXPLORATION_ACHIEVEMENTS } from "./catalog/exploration";
import type { Achievement } from "./types";

export * from "./types";
export * from "./engine";

export const ACHIEVEMENTS: Achievement[] = [
  ...RESOURCE_ACHIEVEMENTS,
  ...ENERGY_ACHIEVEMENTS,
  ...CONSTRUCTION_ACHIEVEMENTS,
  ...BREADTH_ACHIEVEMENTS,
  ...TRADE_ACHIEVEMENTS,
  ...EXPLORATION_ACHIEVEMENTS,
];

export function getAchievement(id: string): Achievement | null {
  return ACHIEVEMENTS.find((a) => a.id === id) ?? null;
}

export function listAchievements(): Achievement[] {
  return ACHIEVEMENTS;
}

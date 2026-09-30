/**
 * Shared live values for device interfaces (pure). Everything a faceplate
 * shows should come from the game state; `wobble` only adds sensor jitter.
 */
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { UEC_NOMINAL, isBuilt, uecOutput } from "@/lib/world/game";
import { linksOf } from "@/lib/world/links";
import type { UiCtx } from "@/lib/world/device-ui/types";

/** Smooth deterministic jitter in −1…1 (sensor noise). */
export function wobble(t: number, seed = 0): number {
  return (
    Math.sin(t * 1.7 + seed * 12.9898) * 0.6 +
    Math.sin(t * 4.3 + seed * 78.233) * 0.3 +
    Math.sin(t * 11.1 + seed * 3.7) * 0.1
  );
}

/** The device's rated draw (W; generators negative), 0 when offline. */
export function drawW(c: UiCtx): number {
  const d = DEVICE_BY_ID.get(c.id);
  return c.online && d ? d.power : 0;
}

/** Grid load 0…1 (demand / generation). */
export function gridLoad(c: UiCtx): number {
  return c.power.generation > 0 ? Math.min(1, c.power.demand / c.power.generation) : 0;
}

/** Spare watts on the grid. */
export function spareW(c: UiCtx): number {
  return Math.max(0, Math.round(c.power.generation - c.power.demand));
}

/** Today's UEC output relative to nominal (volatility), 0…~1.3. */
export function uecRatio(): number {
  return uecOutput() / UEC_NOMINAL;
}

export function counter(c: UiCtx, key: string): number {
  return c.s.counters[key] ?? 0;
}

export function items(c: UiCtx, id: string): number {
  return c.s.inventory[id] ?? 0;
}

/** Number of built devices in the lab. */
export function builtCount(c: UiCtx): number {
  return [...DEVICE_BY_ID.keys()].filter((id) => isBuilt(c.s, id)).length;
}

/** Number of online devices. */
export function onlineCount(c: UiCtx): number {
  return c.power.online.size;
}

export function linkCount(c: UiCtx, hub = c.id): number {
  return linksOf(c.s, hub).length;
}

/** Play time in minutes. */
export function minutes(c: UiCtx): number {
  return Math.floor(c.s.playTime / 60);
}

/** Clamp to 0…1. */
export function unit(v: number): number {
  return Math.max(0, Math.min(1, v));
}

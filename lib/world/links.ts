/**
 * Device links — state queries (pure, no game.ts import).
 * =======================================================
 *
 * `WorldState.links[hub]` lists the devices connected to a hub (content in
 * content/links.ts). Linking / unlinking with all its rules lives in
 * device-ops.ts (it needs the power grid from game.ts); this file only reads.
 */
import { HUBS, HUB_BY_ID, type HubDef, type LinkBus } from "@/lib/world/content/links";
import type { WorldState } from "@/lib/world/types";

export { HUBS, HUB_BY_ID };
export type { HubDef, LinkBus };

/** Devices linked to `hub`. */
export function linksOf(s: WorldState, hub: string): readonly string[] {
  return s.links[hub] ?? [];
}

/** `to` is linked to `hub`. */
export function isLinked(s: WorldState, hub: string, to: string): boolean {
  return linksOf(s, hub).includes(to);
}

/** Hubs a device hangs on. */
export function hubsOf(s: WorldState, id: string): HubDef[] {
  return HUBS.filter((h) => isLinked(s, h.id, id));
}

/** The device is linked on `bus` (to any hub of that bus). */
export function onBus(s: WorldState, id: string, bus: LinkBus): boolean {
  return HUBS.some((h) => h.bus === bus && isLinked(s, h.id, id));
}

/** The device is a hub. */
export function isHub(id: string): boolean {
  return HUB_BY_ID.has(id);
}

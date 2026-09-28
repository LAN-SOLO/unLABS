/**
 * Device emitters from world state.
 * =================================
 *
 * Turns the device catalogue + the current power status into the emitter
 * list `AudioSystem.setEmitters()` consumes: position (model centre), floor,
 * timbre family (from the device id, see `humCategory`), powered, load and
 * brownout (built + switched on but starved).
 */
import { humCategory, type DeviceEmitter } from "@/lib/world/audio/ambience";
import { clamp } from "@/lib/world/audio/synth";
import { DEVICES } from "@/lib/world/content/devices";
import { ROOM_BY_ID } from "@/lib/world/content/map";
import type { DeviceDef } from "@/lib/world/types";

/** The subset of `PowerStatus` (game.ts) the emitters need. */
export interface EmitterPower {
  generation: number;
  demand: number;
  online: ReadonlySet<string>;
  starved: readonly { id: string }[];
}

/** Largest consumer draw in the catalogue (normalises per-device load). */
const MAX_DRAW = Math.max(1, ...DEVICES.map((d) => Math.abs(d.power)));

/**
 * How hard a device works, 0..1: its own draw relative to the biggest
 * consumer, blended with how loaded the grid is. Generators work as hard
 * as the grid demands of them.
 */
export function deviceLoad(d: Pick<DeviceDef, "power">, p: EmitterPower): number {
  const grid = p.generation > 0 ? clamp(p.demand / p.generation, 0, 1) : 0;
  if (d.power < 0) return clamp(0.25 + grid * 0.75, 0, 1);
  const own = clamp(Math.abs(d.power) / MAX_DRAW, 0, 1);
  return clamp(0.2 + own * 0.5 + grid * 0.3, 0, 1);
}

/** Emitters for every device (optionally only those on `floor`). */
export function deviceEmitters(p: EmitterPower, floor?: number): DeviceEmitter[] {
  const starved = new Set(p.starved.map((s) => s.id));
  const out: DeviceEmitter[] = [];
  for (const d of DEVICES) {
    const f = ROOM_BY_ID.get(d.room)?.floor;
    if (floor !== undefined && f !== floor) continue;
    const powered = p.online.has(d.id);
    const e: DeviceEmitter = {
      id: d.id,
      x: d.x,
      z: d.z,
      powered,
      category: humCategory(d.id),
      load: deviceLoad(d, p),
      brownout: !powered && starved.has(d.id),
    };
    if (f !== undefined) e.floor = f;
    out.push(e);
  }
  return out;
}

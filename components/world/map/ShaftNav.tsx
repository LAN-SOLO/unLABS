"use client";

import { tr } from "@/lib/i18n";
import { FOCUS_RING } from "@/components/world/ui";
import type { MapModel } from "@/lib/world/map-data";
import type { FloorId } from "@/lib/world/types";

/**
 * Level tabs drawn as the elevator shaft: one stop per floor, top-down,
 * with the cabin at the player's floor, a lock on floors the elevator does
 * not reach yet and the Emergency Ladder between L0 and L−1.
 */
export function ShaftNav({
  model,
  floor,
  onFloor,
}: {
  model: MapModel;
  floor: FloorId;
  onFloor: (f: FloorId) => void;
}) {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label={tr("Levels")}
      className="relative flex shrink-0 flex-row gap-1 lg:w-[7.5rem] lg:flex-col"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-3 bottom-3 left-[13px] hidden w-[3px] border-x border-[#FFB800]/25 bg-[repeating-linear-gradient(0deg,rgba(255,184,0,0.18)_0px,rgba(255,184,0,0.18)_1px,transparent_1px,transparent_6px)] lg:block"
      />
      {model.shaft.map((stop, i) => {
        const fl = model.floors[stop.floor];
        const active = stop.floor === floor;
        const here = stop.floor === model.current;
        const next = model.shaft[i + 1];
        const ladder = stop.ladder && next?.ladder;
        const p = fl.progress;
        const found = p.devices.found + p.notes.found + p.slices.found + p.caches.found;
        const total = p.devices.total + p.notes.total + p.slices.total + p.caches.total;
        return (
          <div key={stop.floor} className="relative">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onFloor(stop.floor)}
              title={stop.accessible ? stop.name : `${stop.name} — ${stop.hint}`}
              className={`relative flex w-full items-center gap-2 rounded-sm border px-1.5 py-1 text-left text-[10px] ${FOCUS_RING} ${
                active
                  ? "border-[#FFB800] bg-[#FFB800]/10 text-[#FFB800]"
                  : "border-white/10 bg-black/50 text-[#33FF33]/75 hover:border-[#33FF33]/40"
              }`}
            >
              <span
                aria-hidden
                className={`relative z-10 grid h-4 w-4 shrink-0 place-items-center rounded-[2px] border text-[8px] ${
                  here
                    ? "border-[#00FFFF] bg-[#00FFFF]/25 text-[#00FFFF]"
                    : stop.accessible
                      ? "border-[#FFB800]/60 bg-black text-[#FFB800]/80"
                      : "border-white/25 bg-black text-white/40"
                }`}
              >
                {here ? "●" : stop.accessible ? "" : "×"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold tracking-wider">{stop.short}</span>
                <span className="hidden text-[9px] text-white/40 lg:block">
                  {stop.accessible
                    ? tr("{found}/{total} found", { found, total })
                    : tr("map::locked")}
                </span>
              </span>
              <span className="sr-only">
                {here ? tr("You are here.") : ""}{" "}
                {stop.accessible
                  ? tr("Reachable.")
                  : tr("Not reachable yet: {hint}", { hint: stop.hint })}
              </span>
            </button>
            {ladder && (
              <div
                aria-hidden
                title={tr("Emergency Ladder")}
                className="absolute -bottom-1 left-[7px] z-10 hidden h-2 w-4 bg-[repeating-linear-gradient(0deg,#FFB800_0px,#FFB800_1px,transparent_1px,transparent_3px)] opacity-60 lg:block"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { tr } from "@/lib/i18n";
import { memo, useMemo } from "react";
import { MapSvg, type PlayerInfo } from "@/components/world/map/MapSvg";
import { HOME_VIEW, VB } from "@/components/world/map/view";
import { mapModelCached, type MapCategory, type MapFloor } from "@/lib/world/map-data";
import type { FloorId, WorldState } from "@/lib/world/types";

export { MapOverlay, type MapOverlayProps } from "@/components/world/map/MapOverlay";

/** What the HUD minimap shows: things that still matter (no decor, stations, doors). */
const MINI_CATS: ReadonlySet<MapCategory> = new Set<MapCategory>([
  "device",
  "item",
  "slice",
  "cache",
  "note",
  "npc",
  "puzzle",
  "elevator",
]);

/** Pixels per viewBox unit of the HUD minimap. */
const MINI_SCALE = 1.6;

function targetKey(t: MinimapProps["target"]): string {
  return t ? `${t.floor}:${t.x}:${t.z}` : "";
}

export interface MinimapProps {
  state: WorldState;
  floor: FloorId;
  /** Player position (world units) and facing (radians, 0 = +z). */
  player: () => PlayerInfo | null;
  target?: { floor: FloorId; x: number; z: number } | null;
  /** The target is the objective pinned in the journal (drawn with a crosshair). */
  tracked?: boolean;
  version: number;
}

/**
 * HUD minimap: a light version of the large map's SVG renderer — tinted
 * rooms with fog, doors, the open things (done ones are left out), the
 * objective, the waypoint and the live player marker. The host wraps it in
 * a button that opens the large map.
 */
function MinimapImpl({ state, floor, player, target, tracked = false, version }: MinimapProps) {
  const model = mapModelCached(state, version);
  const full = model.floors[floor];
  const lite: MapFloor = useMemo(
    () => ({ ...full, entities: full.entities.filter((e) => !e.done) }),
    [full],
  );
  const pin = model.pin && model.pin.floor === floor ? model.pin : null;
  return (
    <div style={{ width: VB.w * MINI_SCALE, height: VB.h * MINI_SCALE }}>
      <MapSvg
        mini
        floor={lite}
        cats={MINI_CATS}
        view={HOME_VIEW}
        smooth={false}
        target={target && target.floor === floor ? target : null}
        tracked={tracked}
        pin={pin}
        player={floor === state.floor ? player : null}
        label={tr("Level map")}
      />
    </div>
  );
}

/**
 * The host re-renders every animation frame with a fresh `target` object;
 * compare the target by position so the map is not rebuilt each frame.
 */
export const Minimap = memo(
  MinimapImpl,
  (a, b) =>
    a.state === b.state &&
    a.floor === b.floor &&
    a.version === b.version &&
    a.player === b.player &&
    a.tracked === b.tracked &&
    targetKey(a.target) === targetKey(b.target),
);

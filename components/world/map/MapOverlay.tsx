"use client";

import { tr } from "@/lib/i18n";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { fmtNum } from "@/components/world/format";
import { useEscLayer } from "@/components/world/menu/shared";
import { CrtButton, FOCUS_RING, FilterChip, Panel } from "@/components/world/ui";
import { DossierPanel, type DossierAction } from "@/components/world/map/DossierPanel";
import { entityDossier, roomDossier } from "@/components/world/map/dossier";
import { MapIcon } from "@/components/world/map/MapIcon";
import { MapSvg, type PlayerInfo } from "@/components/world/map/MapSvg";
import { FoundList, MapIndex } from "@/components/world/map/MapSidebar";
import { ShaftNav } from "@/components/world/map/ShaftNav";
import { HOME_VIEW, VB, focusOn, panBy, zoomAt, type MapView } from "@/components/world/map/view";
import { CODEX_BY_ID, type CodexTab } from "@/lib/world/content/codex";
import {
  CATEGORY_LABEL,
  DEFAULT_MAP_FILTER,
  MAP_CATEGORIES,
  mapModelCached,
  setMapPin,
  totalProgress,
  type MapCategory,
  type MapEntity,
} from "@/lib/world/map-data";
import { setTrackedObjective } from "@/lib/world/quests";
import type { FloorId, WorldState } from "@/lib/world/types";

export interface MapOverlayProps {
  state: WorldState;
  /** World change counter (`useWorld().version`); the model is rebuilt only when it changes. */
  version: number;
  player: () => PlayerInfo | null;
  /** Compass target (HUD objective) and whether it is the pinned one. */
  target?: { floor: FloorId; x: number; z: number } | null;
  tracked?: boolean;
  /** Mutate the world (`useWorld().act`): track objectives, set the waypoint. */
  act: (fn: (s: WorldState) => void) => void;
  onClose: () => void;
  /** Walk to a spot on the player's floor (click-to-move). Hidden when not wired. */
  onGoTo?: (x: number, z: number) => void;
  /** Open the handbook at an entry. Hidden when not wired. */
  onOpenCodex?: (entryId: string, tab: CodexTab) => void;
  /** Open a (read) note. Hidden when not wired. */
  onOpenNote?: (id: string) => void;
}

type SideTab = "index" | "found";

const PAN_STEP = 12;
const ZOOM_STEP = 1.35;

function targetKey(t: MapOverlayProps["target"]): string {
  return t ? `${t.floor}:${t.x}:${t.z}` : "";
}

/**
 * The large map (M): level tabs as the elevator shaft, the zoomable SVG
 * floor plan, hover tooltips and a side panel with search, filters, the
 * "Found" list and the dossier of the selected thing.
 */
function MapOverlayImpl({
  state,
  version,
  player,
  target,
  tracked = false,
  act,
  onClose,
  onGoTo,
  onOpenCodex,
  onOpenNote,
}: MapOverlayProps) {
  const model = useMemo(
    () => mapModelCached(state, version),
    // The state is mutated in place; `version` is the change signal.
    [state, version],
  );
  const [floorId, setFloorId] = useState<FloorId>(state.floor);
  const [view, setView] = useState<MapView>(HOME_VIEW);
  const [cats, setCats] = useState<ReadonlySet<MapCategory>>(DEFAULT_MAP_FILTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [listHover, setListHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ entity: MapEntity; left: number; top: number } | null>(null);
  const [tab, setTab] = useState<SideTab>("index");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; view: MapView; moved: boolean; id: number } | null>(
    null,
  );
  const suppressClick = useRef(false);

  const floor = model.floors[floorId];
  const onPlayerFloor = floorId === model.current;

  // Esc closes the dossier first, then (Panel) the map.
  useEscLayer(() => setSelected(null), selected !== null);

  /** viewBox units per CSS pixel and the letterbox offset (preserveAspectRatio meet). */
  const metrics = useCallback(() => {
    const el = boxRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const scale = Math.min(r.width / VB.w, r.height / VB.h);
    return {
      r,
      scale,
      ox: (r.width - VB.w * scale) / 2,
      oz: (r.height - VB.h * scale) / 2,
    };
  }, []);

  // Wheel zoom around the cursor (non-passive so the page does not scroll).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = metrics();
      const factor = Math.exp(-e.deltaY * 0.0015);
      if (!m) {
        setView((v) => zoomAt(v, factor));
        return;
      }
      const ux = VB.x + (e.clientX - m.r.left - m.ox) / m.scale;
      const uz = VB.z + (e.clientY - m.r.top - m.oz) / m.scale;
      setView((v) => zoomAt(v, factor, ux, uz));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [metrics]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      setTip(null);
      try {
        e.currentTarget.setPointerCapture(d.id);
      } catch {
        // Capture is a nicety (jsdom / synthetic events have no active pointer).
      }
    }
    const scale = metrics()?.scale ?? 4;
    setView(panBy(d.view, dx / scale, dy / scale));
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
    }
    setDragging(false);
  };

  const onMapKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: MapView | null = null;
    if (e.key === "ArrowLeft") next = panBy(view, PAN_STEP, 0);
    else if (e.key === "ArrowRight") next = panBy(view, -PAN_STEP, 0);
    else if (e.key === "ArrowUp") next = panBy(view, 0, PAN_STEP);
    else if (e.key === "ArrowDown") next = panBy(view, 0, -PAN_STEP);
    else if (e.key === "+" || e.key === "=") next = zoomAt(view, ZOOM_STEP);
    else if (e.key === "-" || e.key === "_") next = zoomAt(view, 1 / ZOOM_STEP);
    else if (e.key === "0") next = HOME_VIEW;
    if (!next) return;
    e.preventDefault();
    e.stopPropagation();
    setView(next);
  };

  const select = useCallback(
    (key: string) => {
      if (suppressClick.current) return;
      const e = model.entities.get(key);
      const r = model.rooms.get(key);
      const at = e ?? (r ? { floor: r.floor, x: r.ax, z: r.az } : null);
      if (!at) return;
      setSelected(key);
      setTip(null);
      if (at.floor !== floorId) {
        setFloorId(at.floor);
        setView(focusOn(HOME_VIEW, at.x, at.z));
      } else setView((v) => (v.k < 1.6 ? v : focusOn(v, at.x, at.z, v.k)));
      // Found entities hidden by a filter become visible again.
      if (e && !cats.has(e.category)) setCats((c) => new Set([...c, e.category]));
    },
    [model, floorId, cats],
  );

  const onEntityHover = useCallback((e: MapEntity | null, el: Element | null) => {
    const box = boxRef.current;
    if (!e || !el || !box) {
      setTip(null);
      return;
    }
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({ entity: e, left: r.left + r.width / 2 - b.left, top: r.top - b.top });
  }, []);

  const changeFloor = (f: FloorId) => {
    setFloorId(f);
    setView(HOME_VIEW);
    setTip(null);
    setListHover(null);
  };

  const toggleCat = (c: MapCategory) =>
    setCats((cur) => {
      const next = new Set(cur);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  // ── Dossier ────────────────────────────────────────────────────
  const selEntity = selected ? model.entities.get(selected) : undefined;
  const selRoom = selected ? model.rooms.get(selected) : undefined;
  const dossier = selEntity
    ? entityDossier(state, model, selEntity)
    : selRoom
      ? roomDossier(model, selRoom)
      : null;
  const actions: DossierAction[] = [];
  const place =
    selEntity ??
    (selRoom
      ? { floor: selRoom.floor, x: selRoom.x + selRoom.w / 2, z: selRoom.z + selRoom.d / 2 }
      : null);
  if (selEntity?.objectiveId) {
    const id = selEntity.objectiveId;
    const on = model.trackedId === id;
    actions.push({
      id: "track",
      label: on ? tr("Untrack") : tr("Track"),
      tone: "cyan",
      pressed: on,
      title: tr("Pin this objective to the compass"),
      onClick: () => act((s) => setTrackedObjective(s, on ? null : id)),
    });
  }
  if (place) {
    const pin = model.pin;
    const on = !!pin && pin.floor === place.floor && pin.x === place.x && pin.z === place.z;
    actions.push({
      id: "pin",
      label: on ? tr("Remove waypoint") : tr("Set waypoint"),
      tone: "cyan",
      pressed: on,
      title: tr("Mark this spot on the map and minimap"),
      onClick: () =>
        act((s) => setMapPin(s, on ? null : { floor: place.floor, x: place.x, z: place.z })),
    });
  }
  const codexId = selEntity?.codexId ?? selRoom?.codexId ?? null;
  const codexTab = codexId ? CODEX_BY_ID.get(codexId)?.tab : undefined;
  if (codexId && codexTab && onOpenCodex)
    actions.push({
      id: "codex",
      label: tr("Show in handbook"),
      tone: "amber",
      onClick: () => onOpenCodex(codexId, codexTab),
    });
  if (place && onGoTo && place.floor === model.current)
    actions.push({
      id: "goto",
      label: tr("Go there"),
      onClick: () => onGoTo(place.x, place.z),
    });
  if (dossier?.noteId && onOpenNote) {
    const noteId = dossier.noteId;
    actions.push({ id: "note", label: tr("Open note"), onClick: () => onOpenNote(noteId) });
  }

  const total = totalProgress(model);
  const foundTotal =
    total.devices.found +
    total.notes.found +
    total.slices.found +
    total.caches.found +
    total.items.found;
  const tgt = target && target.floor === floorId ? target : null;
  const pin = model.pin && model.pin.floor === floorId ? model.pin : null;
  const hoverKey = listHover ?? tip?.entity.key ?? null;

  return (
    <Panel
      title={tr("Map · {floor}", { floor: floor.name })}
      subtitle={tr("{rooms}/{roomsTotal} rooms explored · {found} things documented", {
        rooms: total.rooms.found,
        roomsTotal: total.rooms.total,
        found: foundTotal,
      })}
      onClose={onClose}
      wide
    >
      <div className="flex flex-col gap-3 lg:flex-row">
        <ShaftNav model={model} floor={floorId} onFloor={changeFloor} />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="toolbar"
            aria-label={tr("Map view")}
          >
            <CrtButton
              tone="green"
              onClick={() => setView((v) => zoomAt(v, ZOOM_STEP))}
              aria-label={tr("Zoom in")}
              className="px-2"
            >
              +
            </CrtButton>
            <CrtButton
              tone="green"
              onClick={() => setView((v) => zoomAt(v, 1 / ZOOM_STEP))}
              aria-label={tr("Zoom out")}
              className="px-2"
            >
              −
            </CrtButton>
            <CrtButton
              tone="green"
              onClick={() => setView(HOME_VIEW)}
              title={tr("Whole level (0)")}
            >
              {tr("map::Fit")}
            </CrtButton>
            {onPlayerFloor && (
              <CrtButton
                tone="cyan"
                onClick={() => {
                  const pl = player();
                  if (pl) setView((v) => focusOn(v, pl.x, pl.z, Math.max(2, v.k)));
                }}
              >
                {tr("Centre on me")}
              </CrtButton>
            )}
            {!onPlayerFloor && (
              <FilterChip role="button" active={false} onClick={() => changeFloor(model.current)}>
                {tr("Back to my level")}
              </FilterChip>
            )}
            <span className="ml-auto text-[10px] text-white/40">
              {tr("×{zoom} · drag to pan · wheel to zoom", { zoom: fmtNum(view.k, 1) })}
            </span>
          </div>

          <div
            ref={boxRef}
            tabIndex={0}
            role="group"
            aria-label={tr(
              "Map of {floor}. Arrow keys pan, plus and minus zoom, Tab steps through the markers.",
              { floor: floor.name },
            )}
            onKeyDown={onMapKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={() => setTip((t) => (drag.current ? null : t))}
            className={`relative mx-auto aspect-[148/132] max-h-[62vh] w-full touch-none overflow-hidden rounded-sm border border-[#33FF33]/25 bg-black ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            } ${FOCUS_RING}`}
          >
            <MapSvg
              floor={floor}
              cats={cats}
              view={view}
              smooth={!dragging}
              selectedKey={selected}
              hoverKey={hoverKey}
              target={tgt}
              tracked={tracked}
              pin={pin}
              player={onPlayerFloor ? player : null}
              onEntityHover={onEntityHover}
              onEntitySelect={select}
              onRoomSelect={(id) => select(`room:${id}`)}
              label={tr("Floor plan of {floor}", { floor: floor.name })}
            />
            {tip && !dragging && (
              <div
                role="tooltip"
                className="pointer-events-none absolute z-10 max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-sm border border-[#00FFFF]/40 bg-black/90 px-2 py-1 text-[11px] shadow-[0_0_12px_rgba(0,255,255,0.15)]"
                style={{ left: tip.left, top: tip.top - 4 }}
              >
                <div className="flex items-center gap-1.5 text-[#d8ffd8]">
                  <MapIcon
                    category={tip.entity.category}
                    status={tip.entity.status}
                    done={tip.entity.done}
                    size={12}
                  />
                  <span className="truncate">{tip.entity.name}</span>
                </div>
                <div className="text-[10px] text-[#00FFFF]/80">{tip.entity.statusText}</div>
                <div className="text-[9px] text-white/40">
                  {CATEGORY_LABEL[tip.entity.category]} · {tr("click for details")}
                </div>
              </div>
            )}
          </div>

          <div
            className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/55"
            aria-label={tr("Legend")}
          >
            {MAP_CATEGORIES.filter((c) => cats.has(c)).map((c) => (
              <span key={c} className="inline-flex items-center gap-1">
                <MapIcon category={c} status="available" size={11} />
                {CATEGORY_LABEL[c]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <MapIcon category="device" status="blueprint" size={11} />
              {tr("dashed = not built / only located")}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapIcon category="item" status="taken" done size={11} />
              {tr("dim + ✓ = done")}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapIcon category="puzzle" status="blocked" size={11} />
              {tr("lock = not yet possible")}
            </span>
            <span className="inline-flex items-center gap-1 text-[#E91E8C]">
              ◎ {tr("objective")}
            </span>
            <span className="inline-flex items-center gap-1 text-[#00FFFF]">▲ {tr("you")}</span>
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-72" aria-label={tr("Map index")}>
          {dossier ? (
            <DossierPanel
              dossier={dossier}
              category={selEntity?.category}
              status={selEntity?.status}
              done={selEntity?.done}
              actions={actions}
              onBack={() => setSelected(null)}
            />
          ) : (
            <>
              <div className="flex gap-1" role="tablist" aria-label={tr("Map index")}>
                <FilterChip active={tab === "index"} onClick={() => setTab("index")}>
                  {tr("map::Index")}
                </FilterChip>
                <FilterChip active={tab === "found"} onClick={() => setTab("found")}>
                  {tr("map::Found")}
                </FilterChip>
              </div>
              {tab === "index" ? (
                <MapIndex
                  model={model}
                  floor={floor}
                  cats={cats}
                  onToggleCat={toggleCat}
                  onAllCats={(on) => setCats(on ? new Set(MAP_CATEGORIES) : new Set())}
                  query={query}
                  onQuery={setQuery}
                  onSelect={select}
                  onHover={setListHover}
                />
              ) : (
                <FoundList model={model} floor={floorId} onSelect={select} />
              )}
            </>
          )}
        </aside>
      </div>
    </Panel>
  );
}

/**
 * The host re-renders every animation frame with fresh callbacks and a
 * fresh `target` object; re-render only on world changes (version) and a
 * moved target. Callbacks only close over stable refs/setters.
 */
export const MapOverlay = memo(
  MapOverlayImpl,
  (a, b) =>
    a.state === b.state &&
    a.version === b.version &&
    a.tracked === b.tracked &&
    targetKey(a.target) === targetKey(b.target) &&
    !!a.onGoTo === !!b.onGoTo &&
    !!a.onOpenCodex === !!b.onOpenCodex &&
    !!a.onOpenNote === !!b.onOpenNote,
);

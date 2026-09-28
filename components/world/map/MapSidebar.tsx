"use client";

import { tr } from "@/lib/i18n";
import {
  FOCUS_RING,
  FilterChip,
  Meter,
  SearchField,
  SectionTitle,
  UI,
} from "@/components/world/ui";
import { MapIcon } from "@/components/world/map/MapIcon";
import { CATEGORY_COLOR } from "@/components/world/map/theme";
import {
  CATEGORY_LABEL,
  MAP_CATEGORIES,
  foundByCategory,
  searchMap,
  type FloorProgress,
  type MapCategory,
  type MapEntity,
  type MapFloor,
  type MapModel,
  type MapSearchHit,
} from "@/lib/world/map-data";
import type { FloorId } from "@/lib/world/types";

/** Row button for one entity (lists, search hits, found list). */
function EntityRow({
  entity,
  onSelect,
  onHover,
  floorShort,
}: {
  entity: MapEntity | MapSearchHit;
  onSelect: (key: string) => void;
  onHover?: (key: string | null) => void;
  floorShort?: string;
}) {
  const isHit = "kind" in entity;
  const kind = isHit ? entity.kind : entity.category;
  return (
    <li>
      <button
        type="button"
        data-nav
        onClick={() => onSelect(entity.key)}
        onMouseEnter={() => onHover?.(entity.key)}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(entity.key)}
        onBlur={() => onHover?.(null)}
        className={`flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-[11px] hover:bg-white/5 ${FOCUS_RING}`}
      >
        {kind === "room" ? (
          <span
            aria-hidden
            className="inline-block h-3 w-3.5 shrink-0 rounded-[1px] border border-[#FFB800]/60"
          />
        ) : (
          <MapIcon
            category={kind}
            status={isHit ? "available" : entity.status}
            done={isHit ? false : entity.done}
            size={13}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-[#d8ffd8]">{entity.name}</span>
        {floorShort && <span className="shrink-0 text-[9px] text-[#FFB800]/70">{floorShort}</span>}
        <span className="max-w-[45%] shrink-0 truncate text-[9px] text-white/40">
          {entity.statusText}
        </span>
      </button>
    </li>
  );
}

/** Search, category filters and the list of everything known on the level. */
export function MapIndex({
  model,
  floor,
  cats,
  onToggleCat,
  onAllCats,
  query,
  onQuery,
  onSelect,
  onHover,
}: {
  model: MapModel;
  floor: MapFloor;
  cats: ReadonlySet<MapCategory>;
  onToggleCat: (c: MapCategory) => void;
  onAllCats: (on: boolean) => void;
  query: string;
  onQuery: (q: string) => void;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}) {
  const hits = query.trim() ? searchMap(model, query) : [];
  const counts = new Map<MapCategory, number>();
  for (const e of floor.entities) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const groups = MAP_CATEGORIES.filter((c) => cats.has(c))
    .map((c) => ({ c, list: floor.entities.filter((e) => e.category === c) }))
    .filter((g) => g.list.length > 0);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <SearchField
          value={query}
          onChange={onQuery}
          label={tr("Search the map (all levels)")}
          placeholder={tr("Search all levels …")}
          className="w-full"
        />
        {query.trim() && (
          <div className="mt-1.5" aria-live="polite">
            <div className="mb-0.5 text-[10px] text-white/45">
              {hits.length ? tr("{n} result(s)", { n: hits.length }) : tr("Nothing known matches.")}
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {hits.map((h) => (
                <EntityRow
                  key={h.key}
                  entity={model.entities.get(h.key) ?? h}
                  onSelect={onSelect}
                  floorShort={model.floors[h.floor].short}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
      <div>
        <SectionTitle
          right={
            <span className="flex gap-2">
              <button
                type="button"
                className={`hover:text-white ${FOCUS_RING}`}
                onClick={() => onAllCats(true)}
              >
                {tr("map::all")}
              </button>
              <button
                type="button"
                className={`hover:text-white ${FOCUS_RING}`}
                onClick={() => onAllCats(false)}
              >
                {tr("map::none")}
              </button>
            </span>
          }
        >
          {tr("Show on map")}
        </SectionTitle>
        <div className="flex flex-wrap gap-1" role="group" aria-label={tr("Map filters")}>
          {MAP_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              role="button"
              active={cats.has(c)}
              onClick={() => onToggleCat(c)}
              accent={CATEGORY_COLOR[c]}
              count={counts.get(c) ?? 0}
            >
              <span className="inline-flex items-center gap-1">
                <MapIcon category={c} status="available" size={10} />
                {CATEGORY_LABEL[c]}
              </span>
            </FilterChip>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle right={floor.short}>{tr("On this level")}</SectionTitle>
        {groups.length === 0 && (
          <p className="text-[11px] text-white/40">
            {tr("Nothing documented here yet. Explore the rooms to fill the map.")}
          </p>
        )}
        {groups.map((g) => (
          <div key={g.c} className="mb-1.5">
            <div
              className="text-[9px] tracking-widest uppercase"
              style={{ color: CATEGORY_COLOR[g.c] }}
            >
              {CATEGORY_LABEL[g.c]} · {g.list.length}
            </div>
            <ul>
              {g.list.map((e) => (
                <EntityRow key={e.key} entity={e} onSelect={onSelect} onHover={onHover} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const PROGRESS_KEYS: { key: keyof FloorProgress; label: string; color: string }[] = [
  { key: "devices", label: tr("map::Devices"), color: UI.green },
  { key: "notes", label: tr("map::Notes"), color: UI.ice },
  { key: "slices", label: tr("map::Slices"), color: UI.magenta },
  { key: "caches", label: tr("map::Caches"), color: "#E69F00" },
  { key: "items", label: tr("map::Finds"), color: UI.amber },
  { key: "people", label: tr("map::People"), color: "#9AD0FF" },
  { key: "rooms", label: tr("map::Rooms"), color: UI.cyan },
];

/** Progress meters of one floor ("Devices 5/9", …); empty categories are left out. */
export function ProgressGrid({ progress }: { progress: FloorProgress }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
      {PROGRESS_KEYS.filter((p) => progress[p.key].total > 0).map((p) => {
        const c = progress[p.key];
        return (
          <div key={p.key} className="text-[10px]">
            <div className="flex justify-between">
              <span className="text-white/55">{p.label}</span>
              <span style={{ color: p.color }}>
                {c.found}/{c.total}
              </span>
            </div>
            <Meter
              value={c.found}
              max={c.total}
              color={p.color}
              height={3}
              label={tr("{label}: {found} of {total}", {
                label: p.label,
                found: c.found,
                total: c.total,
              })}
            />
          </div>
        );
      })}
    </div>
  );
}

/** "Found": everything collected, read, discovered or met — per level, with progress. */
export function FoundList({
  model,
  floor,
  onSelect,
}: {
  model: MapModel;
  floor: FloorId;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {model.order.map((f) => {
        const fl = model.floors[f];
        const groups = foundByCategory(fl);
        const n = groups.reduce((a, g) => a + g.entities.length, 0);
        return (
          <details
            key={f}
            open={f === floor}
            className="rounded-sm border border-white/10 bg-black/30 px-2 py-1"
          >
            <summary className={`cursor-pointer text-[11px] text-[#FFB800] ${FOCUS_RING}`}>
              {fl.name}
              <span className="ml-1 text-white/40">· {n}</span>
              {f === model.current && (
                <span className="ml-1 text-[#00FFFF]">{tr("map::(you)")}</span>
              )}
            </summary>
            <div className="mt-1.5 flex flex-col gap-2">
              <ProgressGrid progress={fl.progress} />
              {groups.length === 0 && (
                <p className="text-[10px] text-white/40">{tr("Nothing found here yet.")}</p>
              )}
              {groups.map((g) => (
                <div key={g.category}>
                  <div
                    className="text-[9px] tracking-widest uppercase"
                    style={{ color: CATEGORY_COLOR[g.category] }}
                  >
                    {CATEGORY_LABEL[g.category]} · {g.entities.length}
                  </div>
                  <ul>
                    {g.entities.map((e) => (
                      <EntityRow key={e.key} entity={e} onSelect={onSelect} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

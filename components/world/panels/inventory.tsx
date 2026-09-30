"use client";

import { tr } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  CrtButton,
  FOCUS_RING,
  FilterChip,
  INPUT_CLASS,
  ItemTile,
  KIND_LABEL,
  NewBadge,
  Panel,
  SearchField,
  SectionTitle,
  TraitBars,
  TraitRadar,
  UI,
  VolatilityPips,
  gridKeyNav,
} from "@/components/world/ui";
import { ItemIcon } from "@/components/world/ItemIcon";
import { ProvisionList } from "@/components/world/BioPanels";
import { memoPanel, useSeen, type WorldApi } from "@/components/world/panels/shared";
import { PrototypeUse, type ProtoUseHandler } from "@/components/world/panels/prototype";
import {
  ITEM_SORT_LABEL,
  inventoryItems,
  matchesQuery,
  recipeUses,
  salvageInfo,
  sortItems,
  stageUses,
  type ItemSort,
} from "@/components/world/panels/derive";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { PROTO_EFFECT_BY_ID, archetypeOf, prototypeAffordances } from "@/lib/world/combine";
import { disassemble, isProtected, itemDef } from "@/lib/world/game";
import { AXIS_LABEL, SPECTRUM_HEX } from "@/lib/world/traits";
import { TRAIT_AXES } from "@/lib/world/types";
import type { ItemDef, TraitAxis } from "@/lib/world/types";

type Tab = "alle" | "rohstoff" | "bauteil" | "prototyp" | "relikt";

const TABS: { id: Tab; label: string; kinds: ItemDef["kind"][] }[] = [
  { id: "alle", label: tr("All"), kinds: [] },
  { id: "rohstoff", label: tr("Raw materials"), kinds: ["rohstoff", "schlacke"] },
  { id: "bauteil", label: tr("Components"), kinds: ["bauteil", "werkzeug"] },
  { id: "prototyp", label: tr("Prototypes"), kinds: ["prototyp"] },
  { id: "relikt", label: tr("Relics"), kinds: ["relikt"] },
];

const inTab = (it: ItemDef, t: Tab) =>
  t === "alle" || (TABS.find((x) => x.id === t)?.kinds ?? []).includes(it.kind);

/** Extra quick filters (combinable with the category tabs). */
type Quick = "baubar" | "volatil" | "neu";
const QUICK_LABEL: Record<Quick, string> = {
  baubar: tr("For blueprints"),
  volatil: tr("Volatile ≥ 3"),
  neu: tr("New"),
};

function InventoryPanelImpl({
  api,
  onClose,
  onProto,
  onWardrobe,
}: {
  api: WorldApi;
  onClose: () => void;
  onProto?: ProtoUseHandler;
  /** Opens Jade's character menu (button next to the provisions). */
  onWardrobe?: () => void;
}) {
  const s = api.get();
  const version = api.version;
  const [tab, setTab] = useState<Tab>("alle");
  const [sort, setSort] = useState<ItemSort>("art");
  const [axis, setAxis] = useState<TraitAxis>("energie");
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<Set<Quick>>(() => new Set());

  const all = useMemo(
    () => inventoryItems(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, version],
  );
  const allIds = useMemo(() => all.map((x) => x.id), [all]);
  const seen = useSeen("items", allIds);
  const buildable = useMemo(
    () => new Set(all.filter((it) => stageUses(s, it).length > 0).map((it) => it.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, s, version],
  );
  const items = useMemo(() => {
    const list = all
      .filter((it) => inTab(it, tab))
      .filter((it) => matchesQuery(it, query))
      .filter((it) => !quick.has("baubar") || buildable.has(it.id))
      .filter((it) => !quick.has("volatil") || it.volatility >= 3)
      .filter((it) => !quick.has("neu") || seen.isNew(it.id));
    return sortItems(list, sort, s.inventory, axis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, tab, query, quick, buildable, seen, sort, axis, s, version]);
  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, all.filter((it) => inTab(it, t.id)).length])),
    [all],
  );

  const [sel, setSel] = useState<string | null>(null);
  const selected = sel && (s.inventory[sel] ?? 0) > 0 ? sel : (items[0]?.id ?? null);
  const def = selected ? itemDef(s, selected) : undefined;
  const total = Object.values(s.inventory).reduce((a, b) => a + b, 0);

  const toggleQuick = (q: Quick) => {
    const next = new Set(quick);
    if (next.has(q)) next.delete(q);
    else next.add(q);
    setQuick(next);
  };

  return (
    <Panel
      title={tr("Inventory")}
      subtitle={tr("{kinds} kinds · {total} parts", { kinds: all.length, total })}
      onClose={onClose}
      wide
    >
      {onWardrobe && (
        <div className="mb-2 flex justify-end">
          <CrtButton
            tone="cyan"
            onClick={onWardrobe}
            title={tr("Jade's wardrobe and replicator (O)")}
          >
            {tr("Wardrobe [O]")}
          </CrtButton>
        </div>
      )}
      {/* Biorhythm provisions (kept outside the item grid — never workbench material). */}
      <ProvisionList api={api} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div role="tablist" aria-label={tr("Category")} className="mb-2 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <FilterChip
                key={t.id}
                active={tab === t.id}
                onClick={() => setTab(t.id)}
                count={tabCounts[t.id]}
              >
                {t.label}
              </FilterChip>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-1" aria-label={tr("Filter")}>
            {(Object.keys(QUICK_LABEL) as Quick[]).map((q) => (
              <FilterChip
                key={q}
                role="button"
                accent={UI.cyan}
                active={quick.has(q)}
                onClick={() => toggleQuick(q)}
              >
                {QUICK_LABEL[q]}
              </FilterChip>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
            <SearchField
              value={query}
              onChange={setQuery}
              label={tr("Search the inventory")}
              className="min-w-0 flex-1"
            />
            <label className="flex items-center gap-1 text-white/50">
              {tr("Sort by")}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as ItemSort)}
                className={INPUT_CLASS}
              >
                {(Object.keys(ITEM_SORT_LABEL) as ItemSort[]).map((k) => (
                  <option key={k} value={k}>
                    {ITEM_SORT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            {sort === "eigenschaft" && (
              <select
                value={axis}
                aria-label={tr("Trait")}
                onChange={(e) => setAxis(e.target.value as TraitAxis)}
                className={INPUT_CLASS}
              >
                {TRAIT_AXES.map((a) => (
                  <option key={a} value={a}>
                    {AXIS_LABEL[a]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div
            role="group"
            aria-label={tr("Items")}
            onKeyDown={gridKeyNav}
            className="flex h-[52vh] min-h-[200px] flex-wrap content-start gap-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
          >
            {items.map((it) => (
              <ItemTile
                key={it.id}
                item={it}
                count={s.inventory[it.id]}
                selected={selected === it.id}
                isNew={seen.isNew(it.id)}
                onClick={() => setSel(it.id)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-xs text-white/40">
                {all.length === 0 ? tr("Nothing found yet.") : tr("Nothing in this selection.")}
              </p>
            )}
          </div>
        </div>
        <div className="h-[62vh] min-h-[240px] min-w-0 overflow-y-auto [scrollbar-gutter:stable]">
          {def ? (
            <ItemDetail
              api={api}
              def={def}
              isNew={seen.isNew(def.id)}
              onSelect={(id) => setSel(id)}
              onProto={onProto}
            />
          ) : (
            <p className="p-3 text-xs text-white/40">{tr("Choose an item.")}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function ItemDetail({
  api,
  def,
  isNew,
  onSelect,
  onProto,
}: {
  api: WorldApi;
  def: ItemDef;
  isNew: boolean;
  onSelect: (id: string) => void;
  onProto?: ProtoUseHandler;
}) {
  const s = api.get();
  const parents = new Map<string, number>();
  for (const p of def.parents ?? []) parents.set(p, (parents.get(p) ?? 0) + 1);
  const recipes = recipeUses(s, def.id);
  const stages = stageUses(s, def);
  const salvage = salvageInfo(s, def.id);
  const arch = archetypeOf(def);
  const uses = def.kind === "prototyp" ? prototypeAffordances(def) : [];

  return (
    <div className="rounded-sm border border-[#33FF33]/15 bg-black/30 p-3">
      <div className="flex gap-3">
        <ItemIcon item={def} size={104} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[#00FFFF]">
            <span className="truncate">{def.name}</span>
            {isNew && <NewBadge />}
          </p>
          <p className="text-[11px] text-white/50">
            {KIND_LABEL[def.kind]} · ×{s.inventory[def.id]}
            {def.depth ? ` · ${tr("Generation {n}", { n: def.depth })}` : ""}
            {isProtected(def.id) ? ` · ${tr("One of a kind")}` : ""}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/50">
            <span
              className="inline-block h-2 w-2 rounded-[1px]"
              style={{
                background: SPECTRUM_HEX[def.color],
                boxShadow: `0 0 4px ${SPECTRUM_HEX[def.color]}`,
              }}
            />
            {tr("Colour {color}", { color: def.color })}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/50">
            {tr("Volatility {value}", { value: def.volatility })}{" "}
            <VolatilityPips value={def.volatility} />
          </p>
        </div>
      </div>
      <p className="my-2 text-xs text-[#d8ffd8]/80">{def.description}</p>
      {arch && (
        <p
          className="mb-2 rounded-sm border px-2 py-1 text-[11px]"
          style={{ borderColor: `${arch.hex}66`, color: arch.hex }}
        >
          ◆ {tr("Archetype {name}", { name: arch.name })} —{" "}
          <span className="text-[#d8ffd8]/80">{arch.property}</span>
        </p>
      )}
      {uses.length > 0 && (
        <p className="mb-2 text-[11px] text-white/55">
          {tr("Good for:")}{" "}
          <span className="text-[#ffb0dc]">
            {uses.map((u) => PROTO_EFFECT_BY_ID.get(u)?.name ?? u).join(", ")}
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <TraitRadar traits={def.traits} size={120} color={SPECTRUM_HEX[def.color]} />
        <div className="min-w-[10rem] flex-1">
          <TraitBars item={def} />
        </div>
      </div>

      {parents.size > 0 && (
        <div className="mt-3">
          <SectionTitle accent={UI.magenta}>{tr("Lineage")}</SectionTitle>
          <div className="flex flex-wrap items-center gap-1">
            {[...parents].map(([pid, n]) => {
              const p = itemDef(s, pid);
              if (!p) return null;
              const have = (s.inventory[pid] ?? 0) > 0;
              return (
                <button
                  key={pid}
                  type="button"
                  disabled={!have}
                  onClick={() => onSelect(pid)}
                  title={have ? tr("Show {name}", { name: p.name }) : p.name}
                  className={`flex items-center gap-1 rounded-sm border border-white/10 px-1 py-0.5 text-[10px] text-white/60 enabled:hover:border-[#E91E8C]/60 ${FOCUS_RING}`}
                >
                  <ItemIcon item={p} size={24} frame={false} />
                  {n > 1 ? `${n}×` : ""}
                  <span className="max-w-[7rem] truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3">
        <SectionTitle right={stages.length + recipes.length || undefined}>
          {tr("Uses")}
        </SectionTitle>
        {stages.length === 0 && recipes.length === 0 && (
          <p className="text-[10px] text-white/40">
            {tr("No known use — maybe try it at the workbench.")}
          </p>
        )}
        {stages.length > 0 && (
          <ul className="mb-1 space-y-0.5 text-[10px]">
            {stages.slice(0, 8).map((u) => (
              <li key={`${u.device.id}-${u.stageIndex}`} className="flex gap-1.5">
                <span className={u.next ? "text-[#FFB800]" : "text-white/40"}>⚙</span>
                <span className="text-white/70">
                  {tr("{device} · Stage {n} ({stage}):", {
                    device: u.device.name,
                    n: u.stageIndex + 1,
                    stage: u.stageName,
                  })}{" "}
                  <span className={u.exact ? "text-[#33FF33]" : "text-[#aefcff]/80"}>
                    {u.label}
                    {u.exact ? "" : ` ${tr("(fits by traits)")}`}
                  </span>
                </span>
              </li>
            ))}
            {stages.length > 8 && (
              <li className="text-white/35">{tr("… and {n} more", { n: stages.length - 8 })}</li>
            )}
          </ul>
        )}
        {recipes.length > 0 && (
          <ul className="space-y-0.5 text-[10px] text-white/60">
            {recipes.map((r) => {
              const out = ITEM_BY_ID.get(r.output);
              return (
                <li
                  key={r.output + Object.keys(r.inputs).join()}
                  className="flex items-center gap-1.5"
                >
                  {out && <ItemIcon item={out} size={18} frame={false} />}
                  {Object.entries(r.inputs)
                    .map(([k, n]) => `${n}× ${ITEM_BY_ID.get(k)?.name}`)
                    .join(" + ")}{" "}
                  → {out?.name}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Cooling: calm this prototype with another one. */}
      <PrototypeUse api={api} target={def.id} onUse={onProto} className="mt-3" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {salvage.returns.length > 0 || salvage.ok ? (
          <>
            <CrtButton
              tone="amber"
              disabled={!salvage.ok}
              title={salvage.reason}
              onClick={() => {
                const r = api.act((st) => disassemble(st, def.id));
                api.toast(r.message, r.ok ? "good" : "warn");
              }}
            >
              {tr("Salvage (BTK-001)")}
            </CrtButton>
            <span className="text-[10px] text-white/45">
              {salvage.ok
                ? tr("yields {items} (one part is lost)", {
                    items: salvage.returns.map((id) => itemDef(s, id)?.name ?? id).join(", "),
                  })
                : salvage.reason}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-white/35">{tr("Cannot be salvaged.")}</span>
        )}
      </div>
    </div>
  );
}

export const InventoryPanel = memoPanel(InventoryPanelImpl);

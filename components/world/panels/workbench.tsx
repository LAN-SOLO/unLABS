"use client";

import { tr } from "@/lib/i18n";
import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  CrtButton,
  FOCUS_RING,
  ItemTile,
  KIND_LABEL,
  Meter,
  Panel,
  Reveal,
  SearchField,
  SectionTitle,
  TraitBars,
  TraitRadar,
  TraitSumBar,
  UI,
  VolatilityPips,
  getCombineHistory,
  gridKeyNav,
  pushCombineHistory,
} from "@/components/world/ui";
import { ItemIcon } from "@/components/world/ItemIcon";
import { announce, memoPanel, type WorldApi } from "@/components/world/panels/shared";
import { RememberButton } from "@/components/world/knowledge/Remember";
import { comboKey } from "@/lib/world/content/items";
import {
  fillSlots,
  inventoryItems,
  knownCombos,
  matchesQuery,
  previewCombine,
  slotCounts,
  sortItems,
  volatilityRisk,
} from "@/components/world/panels/derive";
import {
  PROTO_EFFECT_BY_ID,
  VOLATILITY_LIMIT,
  archetypeFlag,
  type ArchetypeDef,
  type ExplosionEventDef,
  type ProtoEffectId,
} from "@/lib/world/combine";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { doCombine, isProtected, itemDef, maxCombineInputs } from "@/lib/world/game";
import { SPECTRUM_HEX } from "@/lib/world/traits";
import type { ItemDef } from "@/lib/world/types";
import { trackAction } from "@/components/world/ops/track";

/** MIME type used for workbench drag & drop. */
export const DRAG_MIME = "application/x-unlabs-item";

const RISK_COLOR = {
  ruhig: UI.green,
  warm: UI.amber,
  kritisch: UI.orange,
  explosion: UI.red,
} as const;

const RISK_LABEL = {
  ruhig: tr("stable"),
  warm: tr("warm"),
  kritisch: tr("critical"),
  explosion: tr("unstable — explodes!"),
};

const KIND_TEXT = {
  recipe: tr("Standard recipe"),
  prototype: tr("New prototype"),
  explosion: tr("Explosion → slag"),
  "missing-station": tr("Station missing"),
  invalid: tr("Invalid"),
};

interface ResultView {
  item: ItemDef;
  count: number;
  synergies: string[];
  kind: string;
  isNew: boolean;
  discovered: string[];
  seq: number;
  /** Prototype: the named archetype it hit, and whether that was a first. */
  archetype?: ArchetypeDef;
  archetypeNew?: boolean;
  /** Prototype: effect families it qualifies for ("Good for: …"). */
  uses: ProtoEffectId[];
  /** Explosion: side event and what it left behind. */
  event?: ExplosionEventDef;
  extras: { item: string; count: number }[];
  /** Combination key and the parts as text (for "Remember"). */
  key: string;
  inputsText: string;
}

const usesText = (uses: readonly ProtoEffectId[]): string =>
  uses.map((u) => PROTO_EFFECT_BY_ID.get(u)?.name ?? u).join(", ");

function WorkbenchPanelImpl({ api, onClose }: { api: WorldApi; onClose: () => void }) {
  const s = api.get();
  const version = api.version;
  const max = maxCombineInputs(s);
  const [slots, setSlots] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResultView | null>(null);
  const [dragOver, setDragOver] = useState<number | "bench" | "inv" | null>(null);
  const [recipeQuery, setRecipeQuery] = useState("");
  const dragging = useRef<{ id: string; fromSlot?: number } | null>(null);

  // The inventory list only changes with the world (version) — not per slot click.
  const items = useMemo(
    () => sortItems(inventoryItems(s), "art", s.inventory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, version],
  );
  const shownItems = useMemo(() => items.filter((x) => matchesQuery(x, query)), [items, query]);
  const combos = useMemo(
    () => knownCombos(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, version],
  );
  const shownCombos = useMemo(() => {
    const q = recipeQuery.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter(
      (c) =>
        c.output?.name.toLowerCase().includes(q) ||
        Object.keys(c.inputs).some((i) => itemDef(s, i)?.name.toLowerCase().includes(q)),
    );
  }, [combos, recipeQuery, s]);
  const preview = useMemo(
    () => previewCombine(s, slots),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, slots, version],
  );

  const used = (id: string) => slots.filter((x) => x === id).length;
  const left = (id: string) => (s.inventory[id] ?? 0) - used(id);
  const canAdd = (id: string) => !isProtected(id) && left(id) > 0 && slots.length < max;

  const add = (id: string, at?: number) => {
    if (isProtected(id)) {
      api.toast(
        tr("{name} is one of a kind — it cannot be combined.", {
          name: itemDef(s, id)?.name ?? id,
        }),
        "warn",
      );
      return;
    }
    if (at !== undefined && at < slots.length) {
      // Replace the part in that slot.
      const next = [...slots];
      next[at] = id;
      if (slotsFit(next)) setSlots(next);
      return;
    }
    if (canAdd(id)) setSlots([...slots, id]);
  };
  const slotsFit = (next: string[]) =>
    next.length <= max &&
    Object.entries(slotCounts(next)).every(([k, n]) => (s.inventory[k] ?? 0) >= n);
  const removeAt = (i: number) => setSlots(slots.filter((_, j) => j !== i));

  const onDragStart = (id: string, fromSlot?: number) => (e: DragEvent<HTMLElement>) => {
    dragging.current = { id, fromSlot };
    try {
      e.dataTransfer.setData(DRAG_MIME, id);
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    } catch {
      // Some environments have no DataTransfer; the ref carries the drag.
    }
  };
  const dragId = (e: DragEvent<HTMLElement>): string | null => {
    try {
      const v = e.dataTransfer?.getData(DRAG_MIME);
      if (v) return v;
    } catch {
      // ignore
    }
    return dragging.current?.id ?? null;
  };
  const allowDrop = (target: number | "bench" | "inv") => (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (dragOver !== target) setDragOver(target);
  };
  const dropOnSlot = (i: number | "bench") => (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(null);
    const id = dragId(e);
    const from = dragging.current?.fromSlot;
    dragging.current = null;
    if (!id) return;
    if (from !== undefined) {
      // Reorder inside the bench: swap two slots.
      if (typeof i === "number" && i < slots.length && i !== from) {
        const next = [...slots];
        [next[i], next[from]] = [next[from]!, next[i]!];
        setSlots(next);
      }
      return;
    }
    add(id, typeof i === "number" ? i : undefined);
  };
  const dropOnInventory = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(null);
    const from = dragging.current?.fromSlot;
    dragging.current = null;
    if (from !== undefined) removeAt(from);
  };

  const doIt = () => {
    const inputDefs = slots.map((id) => itemDef(s, id)).filter((x): x is ItemDef => !!x);
    const r = api.act((st) => doCombine(st, preview.inputs));
    if (!r.ok || !r.output) return api.toast(r.message, "warn");
    trackAction(api, { kind: "craft", id: comboKey(preview.inputs) });
    if (r.kind === "recipe" || r.kind === "prototype" || r.kind === "explosion")
      api.workbenchFx?.(r.kind);
    const inputsText = Object.entries(preview.inputs)
      .map(([k, n]) => `${n}× ${itemDef(s, k)?.name ?? k}`)
      .join(" + ");
    setResult({
      key: comboKey(preview.inputs),
      inputsText,
      item: r.output,
      count: r.count,
      synergies: r.synergies,
      kind: r.kind,
      isNew: r.isNew,
      discovered: r.discovered,
      seq: (result?.seq ?? 0) + 1,
      archetype: r.archetype,
      archetypeNew: r.archetypeNew,
      uses: r.uses ?? [],
      event: r.event,
      extras: r.extras ?? [],
    });
    pushCombineHistory({ inputs: inputDefs, output: r.output, count: r.count, kind: r.kind });
    setSlots([]);
    if (r.kind === "explosion") {
      api.sound?.("explosion");
      api.toast(
        r.event && r.event.id !== "verpufft"
          ? tr("Explosion — {name}. Dr. Fridge would have laughed.", { name: r.event.name })
          : tr("Bang. Dr. Fridge would have laughed."),
        "warn",
      );
      for (const x of r.extras ?? [])
        api.toast(
          tr("Left over: {count}× {name}", {
            count: x.count,
            name: itemDef(s, x.item)?.name ?? x.item,
          }),
          "good",
          x.item,
        );
    } else api.sound?.(r.kind === "prototype" ? "prototype" : "combine");
    if (r.archetype && r.archetypeNew) {
      api.sound?.("insight");
      api.toast(
        tr("Archetype discovered: {name}", { name: r.archetype.name }),
        "insight",
        r.output.id,
      );
      api.toast(r.archetype.property, "info");
    }
    if (r.kind === "prototype" && r.uses?.length)
      api.toast(tr("Good for: {uses}", { uses: usesText(r.uses) }), "info");
    announce(api, r);
  };

  /** Put a known combination into the slots, if the parts are there. */
  const fill = (inputs: Record<string, number>) => {
    const r = fillSlots(s, inputs);
    if ("error" in r) return api.toast(r.error, "warn");
    setSlots(r.slots);
  };

  const history = getCombineHistory();
  const risk = preview.safe ? "ruhig" : volatilityRisk(preview.volSum);
  const out = preview.result?.output;
  const outTraits = out?.traits;

  return (
    <Panel
      title={tr("Workbench · {n} slots", { n: max })}
      subtitle={tr(
        "Drag or click to put parts on the workbench. Same parts → same result. Too much volatility → slag.",
      )}
      onClose={onClose}
      wide
      accent={UI.cyan}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Inventory */}
        <section
          aria-label={tr("Inventory")}
          onDragOver={allowDrop("inv")}
          onDragLeave={() => setDragOver(null)}
          onDrop={dropOnInventory}
          className={`min-w-0 rounded-sm ${dragOver === "inv" ? "ring-1 ring-[#FFB800]/60" : ""}`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionTitle>{tr("Inventory")}</SectionTitle>
            <SearchField
              value={query}
              onChange={setQuery}
              label={tr("Search the inventory")}
              className="w-36"
            />
          </div>
          <div
            role="group"
            aria-label={tr("Parts")}
            onKeyDown={gridKeyNav}
            className="flex h-[40vh] min-h-[180px] flex-wrap content-start gap-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
          >
            {shownItems.map((it) => {
              const n = left(it.id);
              return (
                <ItemTile
                  key={it.id}
                  item={it}
                  count={n}
                  size={56}
                  dim={!canAdd(it.id)}
                  title={
                    isProtected(it.id)
                      ? tr("{name} is one of a kind — it cannot be combined.", { name: it.name })
                      : `${it.name} — ${it.description}`
                  }
                  onClick={() => canAdd(it.id) && add(it.id)}
                  onDragStart={canAdd(it.id) ? onDragStart(it.id) : undefined}
                  onDragEnd={() => {
                    dragging.current = null;
                    setDragOver(null);
                  }}
                />
              );
            })}
            {shownItems.length === 0 && (
              <p className="text-xs text-white/40">
                {query ? tr("Nothing found.") : tr("Empty. Search crates, shelves and scrap.")}
              </p>
            )}
          </div>
          <p className="mt-1 text-[10px] text-white/35">
            {tr(
              "Arrow keys select · Enter puts it on the workbench · drag parts back to remove them.",
            )}
          </p>
        </section>

        {/* Bench */}
        <section aria-label={tr("Workbench")} className="min-w-0">
          <SectionTitle right={`${slots.length}/${max}`}>{tr("Slots")}</SectionTitle>
          <div
            role="group"
            aria-label={tr("Slots")}
            onKeyDown={gridKeyNav}
            onDragOver={allowDrop("bench")}
            onDrop={dropOnSlot("bench")}
            className="grid grid-cols-3 gap-1"
          >
            {Array.from({ length: max }, (_, i) => {
              const id = slots[i];
              const def = id ? itemDef(s, id) : undefined;
              const over = dragOver === i;
              return (
                <button
                  key={i}
                  type="button"
                  data-nav=""
                  draggable={def ? true : undefined}
                  onDragStart={def && id ? onDragStart(id, i) : undefined}
                  onDragOver={(e) => {
                    e.stopPropagation();
                    allowDrop(i)(e);
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    dropOnSlot(i)(e);
                  }}
                  onClick={() => id && removeAt(i)}
                  onKeyDown={(e) => {
                    if ((e.key === "Delete" || e.key === "Backspace") && id) {
                      e.preventDefault();
                      e.stopPropagation();
                      removeAt(i);
                    }
                  }}
                  aria-label={
                    def
                      ? tr("Slot {n}: {name} — remove", { n: i + 1, name: def.name })
                      : tr("Slot {n}: empty", { n: i + 1 })
                  }
                  title={
                    def
                      ? tr("{name} — click to remove", { name: def.name })
                      : tr("Drag a part here")
                  }
                  className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-sm border p-1 text-[10px] text-[#aefcff] transition-colors hover:bg-[#00FFFF]/5 ${FOCUS_RING} ${
                    over
                      ? "border-[#FFB800] bg-[#FFB800]/10"
                      : def
                        ? "border-[#00FFFF]/50 bg-[#00FFFF]/[0.04]"
                        : "border-dashed border-[#00FFFF]/30"
                  }`}
                >
                  {def ? (
                    <>
                      <ItemIcon item={def} size={36} frame={false} />
                      <span className="w-full truncate text-center text-[9px]">{def.name}</span>
                    </>
                  ) : (
                    <span className="text-white/30">{tr("empty")}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Live preview */}
          <div className="mt-2 space-y-2 text-xs">
            <div>
              <p className="mb-0.5 text-[10px] text-white/50">
                {tr("Slot traits (sum, before loss)")}
              </p>
              {slots.length > 0 ? (
                <TraitSumBar traits={preview.slotTraits} />
              ) : (
                <div className="h-[26px] w-full">
                  <div className="h-2.5 w-full rounded-[2px] bg-white/5" />
                </div>
              )}
            </div>
            <div>
              <div className="mb-0.5 flex justify-between text-[10px]">
                <span className="text-white/50">{tr("Explosion risk")}</span>
                <span style={{ color: RISK_COLOR[risk] }}>
                  {preview.safe && slots.length >= 2
                    ? tr("Recipe — safe")
                    : `${preview.volSum}/${VOLATILITY_LIMIT} · ${RISK_LABEL[risk]}`}
                </span>
              </div>
              <div className="relative">
                <Meter
                  value={Math.min(preview.volSum, VOLATILITY_LIMIT * 1.25)}
                  max={VOLATILITY_LIMIT * 1.25}
                  color={RISK_COLOR[risk]}
                  label={tr("Volatility {n} of {total}", {
                    n: preview.volSum,
                    total: VOLATILITY_LIMIT,
                  })}
                  height={6}
                />
                <span
                  aria-hidden
                  className="absolute top-[-2px] h-[10px] w-px bg-red-400"
                  style={{ left: `${(1 / 1.25) * 100}%` }}
                  title={tr("Limit")}
                />
              </div>
            </div>

            <div
              aria-live="polite"
              className="flex min-h-[112px] gap-3 rounded-sm border border-white/10 bg-black/30 p-2"
            >
              {slots.length < 2 ? (
                <p className="self-center text-white/45">
                  {tr("At least two parts — the preview shows what comes out.")}
                </p>
              ) : (
                <>
                  <div className="shrink-0">
                    {outTraits ? (
                      <TraitRadar
                        traits={outTraits}
                        size={104}
                        color={out ? SPECTRUM_HEX[out.color] : UI.cyan}
                      />
                    ) : (
                      <div className="h-[104px] w-[104px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-[10px] tracking-widest text-white/45 uppercase">
                      {tr("Preview ·")}{" "}
                      {preview.blocked
                        ? tr("blocked")
                        : preview.result
                          ? KIND_TEXT[preview.result.kind]
                          : ""}
                      {!preview.blocked && preview.isNew && (
                        <span className="ml-1 text-[#FFB800]">{tr("· unknown")}</span>
                      )}
                    </p>
                    {preview.blocked ? (
                      <p className="text-red-400/90">{preview.blocked}</p>
                    ) : out ? (
                      <>
                        <p className="flex items-center gap-1.5 text-[#00FFFF]">
                          <ItemIcon item={out} size={24} frame={false} />
                          <span className="truncate">
                            {preview.result?.count ?? 1}× {out.name}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5 text-[10px] text-white/50">
                          {KIND_LABEL[out.kind]} ·{" "}
                          {tr("Volatility {value}", { value: out.volatility })}
                          <VolatilityPips value={out.volatility} />
                        </p>
                        {preview.result?.archetype &&
                          (s.flags[archetypeFlag(preview.result.archetype.id)] ? (
                            <p
                              className="truncate text-[10px]"
                              style={{ color: preview.result.archetype.hex }}
                              title={preview.result.archetype.property}
                            >
                              ◆ {tr("Archetype: {name}", { name: preview.result.archetype.name })}
                            </p>
                          ) : (
                            <p className="truncate text-[10px] text-[#E91E8C]">
                              ◆ {tr("Archetype: ??? — something with a name stirs")}
                            </p>
                          ))}
                        {preview.result?.kind === "explosion" && preview.result.event && (
                          <p className="truncate text-[10px] text-red-300/80">
                            ✸ {tr("Side effect:")}{" "}
                            {s.flags[`explosion_${preview.result.event.id}`]
                              ? preview.result.event.name
                              : "?"}
                          </p>
                        )}
                        {preview.result?.synergies.map((x) => (
                          <p key={x} className="truncate text-[10px] text-[#E91E8C]">
                            ✦ {x}
                          </p>
                        ))}
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <CrtButton tone="cyan" disabled={slots.length < 2 || !!preview.blocked} onClick={doIt}>
              {tr("Combine")}
            </CrtButton>
            <CrtButton tone="amber" disabled={!slots.length} onClick={() => setSlots([])}>
              {tr("workbench::Clear")}
            </CrtButton>
          </div>

          {result && (
            <div className="mt-3">
              <Reveal
                revealKey={result.seq}
                accent={
                  result.kind === "explosion"
                    ? UI.red
                    : result.archetype
                      ? result.archetype.hex
                      : result.isNew
                        ? UI.amber
                        : UI.cyan
                }
              >
                <div className="flex items-center gap-3 p-2">
                  <ItemIcon item={result.item} size={64} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-start gap-2 text-sm text-[#00FFFF]">
                      <span className="min-w-0 flex-1">
                        {result.count}× {result.item.name}{" "}
                        {result.isNew && <span className="text-[#FFB800]">{tr("· NEW")}</span>}
                      </span>
                      <RememberButton
                        api={api}
                        src={{
                          kind: result.kind === "recipe" ? "recipe" : "experiment",
                          id: result.key,
                          title:
                            result.kind === "explosion"
                              ? tr("Explosion: {name}", { name: result.item.name })
                              : result.item.name,
                          text: [
                            `${result.inputsText} → ${result.count}× ${result.item.name}`,
                            result.archetype
                              ? `${result.archetype.name}: ${result.archetype.property}`
                              : "",
                            result.uses.length
                              ? tr("Good for: {uses}", { uses: usesText(result.uses) })
                              : "",
                            result.event ? `${result.event.name}: ${result.event.text}` : "",
                          ]
                            .filter(Boolean)
                            .join("\n"),
                          tags: [result.kind],
                        }}
                      />
                    </p>
                    <p className="text-[11px] text-white/50">
                      {KIND_LABEL[result.item.kind]} ·{" "}
                      {tr("Volatility {value} · Gen. {depth}", {
                        value: result.item.volatility,
                        depth: result.item.depth,
                      })}
                    </p>
                  </div>
                </div>
                <div className="px-2 pb-2">
                  <TraitBars item={result.item} />
                  {result.archetype && (
                    <p className="mt-1 text-[11px]" style={{ color: result.archetype.hex }}>
                      ◆{" "}
                      {result.archetypeNew
                        ? tr("Archetype discovered: {name}", { name: result.archetype.name })
                        : tr("Archetype: {name}", { name: result.archetype.name })}
                      <span className="block text-white/60">{result.archetype.property}</span>
                    </p>
                  )}
                  {result.uses.length > 0 && (
                    <p className="mt-1 text-[11px] text-white/55">
                      {tr("Good for:")}{" "}
                      <span className="text-[#ffb0dc]">{usesText(result.uses)}</span>
                    </p>
                  )}
                  {result.event && (
                    <p className="mt-1 text-[11px] text-red-300/90">
                      ✸ {result.event.name}:{" "}
                      {result.extras.length || result.event.id === "verpufft"
                        ? result.event.text
                        : tr("The same mixture — this time nothing special is left over.")}
                    </p>
                  )}
                  {result.extras.map((x) => (
                    <p key={x.item} className="text-[11px] text-[#33FF33]">
                      + {x.count}× {itemDef(s, x.item)?.name ?? x.item}
                    </p>
                  ))}
                  {result.discovered.map((d) => (
                    <p key={d} className="text-[11px] text-[#FFB800]">
                      ⚙{" "}
                      {tr("Recalls a blueprint: {name}", { name: DEVICE_BY_ID.get(d)?.name ?? d })}
                    </p>
                  ))}
                </div>
              </Reveal>
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-3">
              <SectionTitle>{tr("Recent combinations")}</SectionTitle>
              <ul className="space-y-0.5">
                {history.map((h, i) => (
                  <li key={`${h.output.id}-${i}`}>
                    <button
                      type="button"
                      onClick={() => fill(slotCounts(h.inputs.map((d) => d.id)))}
                      title={tr("Put these parts into the slots again")}
                      className={`flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-[10px] text-white/60 hover:bg-white/5 ${FOCUS_RING}`}
                    >
                      {h.inputs.map((d, j) => (
                        <ItemIcon key={`${d.id}-${j}`} item={d} size={20} frame={false} />
                      ))}
                      <span className="px-1 text-[#00FFFF]">→</span>
                      <ItemIcon item={h.output} size={22} />
                      <span
                        className={`truncate ${h.kind === "explosion" ? "text-red-400" : "text-[#d8ffd8]"}`}
                      >
                        {h.count}× {h.output.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {combos.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-[#FFB800]">
                {tr("Known recipes ({n})", { n: combos.length })}
              </summary>
              <SearchField
                value={recipeQuery}
                onChange={setRecipeQuery}
                label={tr("Search recipes")}
                className="mt-1 w-full"
              />
              <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto pr-1">
                {shownCombos.map((c) => {
                  const ok = !("error" in fillSlots(s, c.inputs));
                  return (
                    <li key={c.key} className="flex items-center gap-1.5 text-[10px] text-white/60">
                      {c.output && <ItemIcon item={c.output} size={18} frame={false} />}
                      <span className="min-w-0 flex-1 truncate">
                        {Object.entries(c.inputs)
                          .map(([k, n]) => `${n}× ${itemDef(s, k)?.name ?? k}`)
                          .join(" + ")}{" "}
                        → {c.output?.name ?? "?"}
                        {c.note ? ` (${c.note})` : ""}
                        {c.source === "entdeckt" && (
                          <span className="ml-1 text-[#E91E8C]">{tr("· your own")}</span>
                        )}
                      </span>
                      {c.output && (
                        <RememberButton
                          api={api}
                          src={{
                            kind: "recipe",
                            id: c.key,
                            title: c.output.name,
                            text: `${Object.entries(c.inputs)
                              .map(([k, n]) => `${n}× ${itemDef(s, k)?.name ?? k}`)
                              .join(" + ")} → ${c.output.name}${c.note ? ` (${c.note})` : ""}`,
                            tags: ["recipe"],
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => fill(c.inputs)}
                        aria-label={tr("Load recipe for {name}", { name: c.output?.name ?? "?" })}
                        className={`shrink-0 rounded-sm border px-1.5 text-[9px] tracking-wider uppercase ${FOCUS_RING} ${
                          ok
                            ? "border-[#00FFFF]/50 text-[#00FFFF] hover:bg-[#00FFFF]/10"
                            : "border-white/10 text-white/30"
                        }`}
                      >
                        {tr("load")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </section>
      </div>
    </Panel>
  );
}

export const WorkbenchPanel = memoPanel(WorkbenchPanelImpl);

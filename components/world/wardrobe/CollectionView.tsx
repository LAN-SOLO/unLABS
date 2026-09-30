"use client";

import { tr } from "@/lib/i18n";
import { useState } from "react";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import {
  WEAR_GROUPS,
  WEAR_ITEMS,
  WEAR_SLOT_BY_ID,
  WEAR_SLOTS,
  type WearGroup,
  type WearItem,
} from "@/lib/world/content/wardrobe";
import { patternUnlocked, sourceProgress, wardrobeStats } from "@/lib/world/wardrobe";
import { FilterChip, Meter, UI } from "@/components/world/ui";
import { WearIcon } from "@/components/world/wardrobe/WearIcon";
import type { WorldState } from "@/lib/world/types";

type SourceFilter = "all" | "find" | "craft" | "reward" | "start";

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: tr("All") },
  { id: "find", label: tr("Hidden") },
  { id: "craft", label: tr("Replicator") },
  { id: "reward", label: tr("Rewards") },
  { id: "start", label: tr("From the start") },
];

/** How to get a piece (shown for pieces not owned yet, and as a note for owned ones). */
export function howToGet(s: WorldState, w: WearItem): string {
  const src = w.source;
  switch (src.kind) {
    case "start":
      return tr("In the wardrobe from the first day.");
    case "find":
      return s.wardrobe.owned[w.id]
        ? tr("Found in the lab.")
        : tr("??? — {hint}", { hint: src.hint });
    case "reward":
      return s.wardrobe.owned[w.id] ? tr("A reward.") : tr("Reward: {hint}", { hint: src.hint });
    case "craft": {
      const cost = Object.entries(src.recipe)
        .map(([id, n]) => `${n}× ${ITEM_BY_ID.get(id)?.name ?? id}`)
        .join(", ");
      if (!s.wardrobe.owned[w.id] && !patternUnlocked(s, w))
        return tr("Replicator pattern, locked: {hint}", { hint: src.unlockHint ?? "?" });
      return tr("Replicator: {cost} · {n} s", { cost, n: src.seconds });
    }
  }
}

/** Every piece of the wardrobe with how to get it, plus the progress counters. */
export function CollectionView({ s }: { s: WorldState }) {
  const [source, setSource] = useState<SourceFilter>("all");
  const [group, setGroup] = useState<WearGroup | "all">("all");
  const st = wardrobeStats(s);
  const craft = sourceProgress(s, "craft");
  const reward = sourceProgress(s, "reward");
  const list = WEAR_ITEMS.filter(
    (w) =>
      (source === "all" || w.source.kind === source) &&
      (group === "all" || WEAR_SLOT_BY_ID.get(w.slot)?.group === group),
  );
  const rows: { label: string; value: number; max: number }[] = [
    { label: tr("Pieces owned"), value: st.owned, max: st.total },
    { label: tr("Hidden pieces found"), value: st.found, max: st.totalFinds },
    { label: tr("Replicator patterns made"), value: craft.owned, max: craft.total },
    { label: tr("Rewards"), value: reward.owned, max: reward.total },
  ];
  return (
    <div className="space-y-3" data-collection>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="text-[11px]">
            <div className="flex justify-between text-white/70">
              <span>{r.label}</span>
              <span className="text-[#FFB800]">
                {r.value}/{r.max}
              </span>
            </div>
            <Meter value={r.value} max={r.max} color={UI.magenta} label={r.label} />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/45">
        {tr(
          "{n} pieces replicated in total · {slots} of {total} slots differ from the first day.",
          { n: st.crafted, slots: st.changedSlots, total: WEAR_SLOTS.length },
        )}
      </p>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label={tr("Source")}>
        {SOURCE_FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={source === f.id}
            accent={UI.magenta}
            onClick={() => setSource(f.id)}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label={tr("Group")}>
        <FilterChip active={group === "all"} onClick={() => setGroup("all")}>
          {tr("All")}
        </FilterChip>
        {WEAR_GROUPS.map((g) => (
          <FilterChip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>
            {g.label}
          </FilterChip>
        ))}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2" aria-label={tr("Collection")}>
        {list.map((w) => {
          const owned = !!s.wardrobe.owned[w.id];
          const secret = !owned && w.source.kind === "find";
          return (
            <li
              key={w.id}
              data-collection-item={w.id}
              data-owned={owned || undefined}
              className={`flex items-start gap-2 rounded-sm border p-1.5 ${
                owned ? "border-[#E91E8C]/30" : "border-white/10"
              }`}
            >
              <WearIcon item={w.id} size={36} dim={!owned && !secret} unknown={secret} />
              <span className="flex min-w-0 flex-col">
                <span className={`text-xs ${owned ? "text-[#d8ffd8]" : "text-white/55"}`}>
                  {secret ? "???" : w.name}
                  <span className="ml-1 text-[9px] text-white/35 uppercase">
                    {WEAR_SLOT_BY_ID.get(w.slot)?.label}
                  </span>
                </span>
                <span className="text-[10px] leading-snug text-white/50">{howToGet(s, w)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

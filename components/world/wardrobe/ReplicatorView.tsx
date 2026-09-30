"use client";

import { tr } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { ItemIcon } from "@/components/world/ItemIcon";
import type { WorldApi } from "@/components/world/panels";
import { CrtButton, FilterChip, Meter, SectionTitle, UI } from "@/components/world/ui";
import { WearIcon } from "@/components/world/wardrobe/WearIcon";
import { colorHex } from "@/lib/world/content/palette";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import {
  REFINE_RECIPES,
  REPLICATOR_POWER,
  WEAR_BY_ID,
  WEAR_ITEMS,
  type WearItem,
} from "@/lib/world/content/wardrobe";
import {
  canRecycle,
  craftStatus,
  dyeStatus,
  jobProgress,
  jobRemaining,
  patternUnlocked,
  recycle,
  recycleYield,
  refineStatus,
  replicatorPowered,
  startCraft,
  startDye,
  startRefine,
  type CraftStatus,
} from "@/lib/world/wardrobe";
import type { WorldState } from "@/lib/world/types";

export type ReplicatorTab = "fabricate" | "refine" | "dye" | "recycle";

const TABS: { id: ReplicatorTab; label: string }[] = [
  { id: "fabricate", label: tr("Fabricate") },
  { id: "refine", label: tr("Refine") },
  { id: "dye", label: tr("Dye") },
  { id: "recycle", label: tr("Recycle") },
];

/** Name of what the running job makes. */
export function jobLabel(s: WorldState): string {
  const j = s.wardrobe.job;
  if (!j) return "";
  if (j.kind === "craft") return WEAR_BY_ID.get(j.id)?.name ?? j.id;
  if (j.kind === "refine") {
    const r = REFINE_RECIPES.find((x) => x.id === j.id);
    return r ? `${r.count}× ${ITEM_BY_ID.get(r.output)?.name ?? r.output}` : j.id;
  }
  const [item, cw] = j.id.split(".");
  const w = WEAR_BY_ID.get(item ?? "");
  const c = w?.colorways.find((x) => x.id === cw);
  return tr("{name} in {colour}", { name: w?.name ?? "?", colour: c?.label ?? "?" });
}

/** Resource chips: icon, have / need, missing ones in red. */
function Cost({ s, cost }: { s: WorldState; cost: Readonly<Record<string, number>> }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {Object.entries(cost).map(([id, n]) => {
        const def = ITEM_BY_ID.get(id);
        const have = s.inventory[id] ?? 0;
        const short = have < n;
        return (
          <span
            key={id}
            data-cost={id}
            data-missing={short || undefined}
            className={`inline-flex items-center gap-1 rounded-sm border px-1 py-0.5 text-[10px] ${
              short ? "border-red-500/60 text-red-300" : "border-[#33FF33]/25 text-[#d8ffd8]"
            }`}
            title={def?.description}
          >
            {def && <ItemIcon item={def} size={18} frame={false} />}
            <span>{def?.name ?? id}</span>
            <span className={short ? "text-red-300" : "text-[#FFB800]"}>
              {have}/{n}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function stateText(st: CraftStatus): string {
  switch (st.state) {
    case "busy":
      return tr("The replicator is busy.");
    case "offline":
      return tr("Needs {w} W on the grid.", { w: REPLICATOR_POWER });
    case "missing":
      return tr("Resources missing.");
    case "owned":
      return tr("Already in the wardrobe.");
    case "locked":
      return tr("Pattern locked.");
    default:
      return "";
  }
}

/**
 * The replicator page of the character menu: running job, then the four
 * tabs. Jobs only start standing at Needle's Eye (`present`); elsewhere the
 * page is a read-only status view.
 */
export function ReplicatorView({
  api,
  present,
  intro,
  onIntroDone,
}: {
  api: WorldApi;
  present: boolean;
  /** Show Jade's first-use card. */
  intro: boolean;
  onIntroDone: () => void;
}) {
  const s = api.get();
  const [tab, setTab] = useState<ReplicatorTab>("fabricate");
  const [, setTick] = useState(0);
  const running = !!s.wardrobe.job;
  // Progress bar: re-read the play clock once a second while a job runs.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      api.sound?.("sew_rattle");
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, api]);

  const start = (fn: (st: WorldState) => boolean, what: string) => {
    const ok = api.act(fn);
    if (ok) {
      api.sound?.("sew_rattle");
      api.toast(tr("Needle's Eye starts: {what}", { what }), "info");
    } else {
      api.sound?.("fail_buzz");
    }
  };
  const gate = !present
    ? tr("Only at Needle's Eye in Jade's quarters.")
    : !replicatorPowered(s)
      ? tr("Needs {w} W on the grid.", { w: REPLICATOR_POWER })
      : null;

  return (
    <div className="space-y-3" data-replicator>
      {intro && (
        <div className="rounded-sm border border-[#FFB800]/40 bg-[#FFB800]/5 p-3 text-xs text-[#ffe6a8]">
          <p className="mb-1 tracking-widest text-[#FFB800] uppercase">
            {tr("Jade's note, taped to the gantry")}
          </p>
          <p className="leading-relaxed">
            {tr(
              "NDL-0 “Needle's Eye”. Built in 2018 from a scrapped industrial sewing head, the spare gantry of the first 3D fabricator, the dye carousel of the canteen's slush machine and Damien's bathroom mirror. He never noticed. It sews, prints, dyes and eats old clothes. Feed it scraps, fibre and pigment. Do not feed it the lab coat you are wearing. Again.",
            )}
          </p>
          <CrtButton tone="amber" className="mt-2" onClick={onIntroDone}>
            {tr("Got it")}
          </CrtButton>
        </div>
      )}

      <div className="rounded-sm border border-[#E91E8C]/30 bg-black/40 p-2 text-xs">
        {s.wardrobe.job ? (
          <>
            <div className="flex justify-between gap-2">
              <span className="text-[#ffd0ea]">
                {tr("Working on: {what}", { what: jobLabel(s) })}
              </span>
              <span className="shrink-0 text-white/60">
                {jobRemaining(s) > 0
                  ? tr("{n} s left", { n: Math.ceil(jobRemaining(s)) })
                  : tr("done — ping!")}
              </span>
            </div>
            <Meter
              value={Math.round(jobProgress(s) * 100)}
              max={100}
              color={UI.magenta}
              label={tr("Replicator job progress")}
              className="mt-1"
              height={6}
            />
          </>
        ) : (
          <span className="text-white/60">
            {tr("Idle. The needle waits, the spools turn slowly.")}
          </span>
        )}
        {gate && <p className="mt-1 text-[#FFB800]/80">{gate}</p>}
      </div>

      <div role="tablist" aria-label={tr("Replicator")} className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <FilterChip
            key={t.id}
            active={tab === t.id}
            accent={UI.magenta}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </FilterChip>
        ))}
      </div>

      {tab === "fabricate" && (
        <ul className="space-y-1.5" aria-label={tr("Patterns")}>
          {WEAR_ITEMS.filter((w) => w.source.kind === "craft").map((w) => (
            <PatternRow
              key={w.id}
              s={s}
              w={w}
              gate={gate}
              onStart={() => start((st) => startCraft(st, w.id), w.name)}
            />
          ))}
        </ul>
      )}

      {tab === "refine" && (
        <ul className="space-y-1.5" aria-label={tr("Refine")}>
          {REFINE_RECIPES.map((r) => {
            const st = refineStatus(s, r.id);
            const out = ITEM_BY_ID.get(r.output);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-sm border border-[#33FF33]/15 p-1.5"
              >
                <span className="min-w-0 flex-1 text-xs text-[#d8ffd8]">{r.label}</span>
                <Cost s={s} cost={r.inputs} />
                <span className="text-[10px] text-white/50">→</span>
                {out && <ItemIcon item={out} size={22} frame={false} />}
                <span className="text-[10px] text-[#FFB800]">
                  {r.count}× · {r.seconds} s
                </span>
                <CrtButton
                  tone="green"
                  disabled={!!gate || st.state !== "ready"}
                  title={gate ?? stateText(st)}
                  onClick={() =>
                    start((x) => startRefine(x, r.id), `${r.count}× ${out?.name ?? r.output}`)
                  }
                >
                  {tr("Refine")}
                </CrtButton>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "dye" && <DyeList s={s} gate={gate} start={start} />}

      {tab === "recycle" && (
        <ul className="space-y-1.5" aria-label={tr("Recycle")}>
          {WEAR_ITEMS.filter((w) => w.source.kind === "craft" && s.wardrobe.owned[w.id]).map(
            (w) => {
              const ok = canRecycle(s, w.id);
              return (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center gap-2 rounded-sm border border-[#33FF33]/15 p-1.5"
                >
                  <WearIcon item={w.id} size={32} />
                  <span className="min-w-0 flex-1 text-xs text-[#d8ffd8]">{w.name}</span>
                  <span className="text-[10px] text-white/60">
                    {tr("gives back")}{" "}
                    {Object.entries(recycleYield(w.id))
                      .map(([id, n]) => `${n}× ${ITEM_BY_ID.get(id)?.name ?? id}`)
                      .join(", ")}
                  </span>
                  <CrtButton
                    tone="red"
                    disabled={!present || !ok}
                    title={ok ? undefined : tr("Take it off first.")}
                    onClick={() => {
                      const back = api.act((st) => recycle(st, w.id));
                      if (back) {
                        api.sound?.("combine");
                        api.toast(tr("Back into the maw: {name}", { name: w.name }), "info");
                      }
                    }}
                  >
                    {tr("Recycle")}
                  </CrtButton>
                </li>
              );
            },
          )}
          {!WEAR_ITEMS.some((w) => w.source.kind === "craft" && s.wardrobe.owned[w.id]) && (
            <li className="text-xs text-white/50">{tr("Nothing replicated yet.")}</li>
          )}
        </ul>
      )}
    </div>
  );
}

function PatternRow({
  s,
  w,
  gate,
  onStart,
}: {
  s: WorldState;
  w: WearItem;
  gate: string | null;
  onStart: () => void;
}) {
  if (w.source.kind !== "craft") return null;
  const st = craftStatus(s, w.id);
  const unlocked = st.state === "owned" || patternUnlocked(s, w);
  return (
    <li
      data-pattern={w.id}
      data-state={st.state}
      className="flex flex-wrap items-center gap-2 rounded-sm border border-[#33FF33]/15 p-1.5"
    >
      <WearIcon item={w.id} size={36} dim={!unlocked} unknown={!unlocked} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs text-[#d8ffd8]">
          {unlocked ? w.name : tr("Locked pattern")}
        </span>
        {unlocked ? (
          <span className="text-[10px] text-white/45">{tr("{n} s", { n: w.source.seconds })}</span>
        ) : (
          <span className="text-[10px] text-[#FFB800]/80">
            {w.source.unlockHint ?? tr("Pattern locked.")}
          </span>
        )}
      </span>
      {unlocked && st.state !== "owned" && <Cost s={s} cost={w.source.recipe} />}
      {st.state === "owned" ? (
        <span className="text-[10px] text-[#33FF33]">{tr("✓ in the wardrobe")}</span>
      ) : (
        unlocked && (
          <CrtButton
            tone="green"
            disabled={!!gate || st.state !== "ready"}
            title={gate ?? stateText(st)}
            onClick={onStart}
          >
            {tr("Fabricate")}
          </CrtButton>
        )
      )}
    </li>
  );
}

function DyeList({
  s,
  gate,
  start,
}: {
  s: WorldState;
  gate: string | null;
  start: (fn: (st: WorldState) => boolean, what: string) => void;
}) {
  const rows = WEAR_ITEMS.filter((w) => s.wardrobe.owned[w.id]).flatMap((w) =>
    w.colorways.filter((c) => c.dye).map((c) => ({ w, c })),
  );
  if (!rows.length)
    return (
      <p className="text-xs text-white/50">
        {tr("No piece in the wardrobe has a colour to dye yet.")}
      </p>
    );
  return (
    <>
      <SectionTitle accent={UI.magenta}>{tr("Colours to dye")}</SectionTitle>
      <ul className="space-y-1.5" aria-label={tr("Dye")}>
        {rows.map(({ w, c }) => {
          const st = dyeStatus(s, w.id, c.id);
          return (
            <li
              key={`${w.id}.${c.id}`}
              className="flex flex-wrap items-center gap-2 rounded-sm border border-[#33FF33]/15 p-1.5"
            >
              <WearIcon item={w.id} colorway={c.id} size={32} />
              <span
                aria-hidden
                className="h-3 w-3 rounded-full border border-white/30"
                style={{ background: colorHex(c.tones.main) }}
              />
              <span className="min-w-0 flex-1 text-xs text-[#d8ffd8]">
                {tr("{name} in {colour}", { name: w.name, colour: c.label })}
              </span>
              {st.state === "owned" ? (
                <span className="text-[10px] text-[#33FF33]">{tr("✓ dyed")}</span>
              ) : (
                <>
                  <Cost s={s} cost={c.dye!} />
                  <CrtButton
                    tone="green"
                    disabled={!!gate || st.state !== "ready"}
                    title={gate ?? stateText(st)}
                    onClick={() =>
                      start(
                        (x) => startDye(x, w.id, c.id),
                        tr("{name} in {colour}", { name: w.name, colour: c.label }),
                      )
                    }
                  >
                    {tr("Dye")}
                  </CrtButton>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

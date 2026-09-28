"use client";

import { tr } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  FOCUS_RING,
  FilterChip,
  Meter,
  NewBadge,
  Panel,
  SearchField,
  SectionTitle,
  UI,
} from "@/components/world/ui";
import {
  Missing,
  RecipeChain,
  memoPanel,
  useSeen,
  type WorldApi,
} from "@/components/world/panels/shared";
import { DEVICES, DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { ENDINGS, INSIGHTS } from "@/lib/world/content/story";
import {
  canTrack,
  objectiveSections,
  objectivesCached,
  setTrackedObjective,
  trackedObjectiveId,
} from "@/lib/world/quests";
import { isPostgame, postgameObjectives } from "@/lib/world/postgame";
import {
  evalCond,
  isBuilt,
  missingParts,
  openBlueprints,
  power,
  stagesDone,
} from "@/lib/world/game";
import type { Condition, InsightDef, WorldState } from "@/lib/world/types";

/** A secret path shows up in the journal once any of its clues is known. */
function evalCondPartial(s: WorldState, c: Condition): boolean {
  const parts = "all" in c ? c.all : [c];
  return parts.filter((x) => evalCond(s, x)).length >= 2;
}

const THREAD_LABEL: Record<InsightDef["thread"], string> = {
  damien: tr("Damien"),
  halo: tr("The Halo"),
  signal: tr("Signals"),
  anomalie: tr("Anomalies"),
  relikt: tr("Relics"),
  strom: tr("Lab & power"),
  bots: tr("Bots & MCP"),
};

type Tab = "auftraege" | "wege" | "insights" | "devices" | "log";
const TABS: readonly [Tab, string][] = [
  ["auftraege", tr("Objectives")],
  ["wege", tr("Paths to Damien")],
  ["insights", tr("Insights")],
  ["devices", tr("Devices")],
  ["log", tr("Log")],
];

const has = (text: string | undefined, q: string) => !q || (text ?? "").toLowerCase().includes(q);

/** "Aftermath": what is still open after an ending (postgame.ts). */
function PostgameSection({ s }: { s: WorldState }) {
  const list = postgameObjectives(s);
  return (
    <div className="rounded-sm border border-[#E91E8C]/30 p-2">
      <SectionTitle accent={UI.magenta}>{tr("Aftermath")}</SectionTitle>
      {list.length === 0 ? (
        <p className="text-xs text-[#d8ffd8]/70">
          {tr(
            "Everything found, everyone woken, every path taken. New Game+ is waiting in the menu.",
          )}
        </p>
      ) : (
        <ul className="space-y-1">
          {list.map((o) => (
            <li key={o.id} className="text-xs">
              <span className={o.ready ? "text-[#33FF33]" : "text-[#ffd0ea]"}>
                › {o.title}
                {o.progress ? ` (${o.progress.current}/${o.progress.target})` : ""}
              </span>
              <span className="block pl-3 text-white/45">{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Open blueprints whose next stage lacks a craftable named part, with the recipe chain. */
function BlockedBlueprints({ s }: { s: WorldState }) {
  const rows = openBlueprints(s)
    .map((d) => ({ d, parts: missingParts(s, d.id) }))
    .filter((r) => r.parts.length > 0);
  if (!rows.length) return null;
  return (
    <div className="mb-3 space-y-2">
      <SectionTitle>{tr("Missing parts")}</SectionTitle>
      {rows.map(({ d, parts }) => (
        <div key={d.id} className="rounded-sm border border-white/10 p-2 text-xs">
          <p className="text-[#d8ffd8]">
            {d.name}{" "}
            <span className="text-white/40">
              {tr("· Stage {n}", { n: stagesDone(s, d.id) + 1 })}
            </span>
          </p>
          {parts.map((p) => (
            <div key={p.label + p.item} className="mt-1">
              <p className="text-red-400/80">
                {tr("Missing: {count}× {label} ({name}, have {have})", {
                  count: p.count,
                  label: p.label,
                  name: ITEM_BY_ID.get(p.item)?.name ?? p.item,
                  have: p.have,
                })}
              </p>
              <RecipeChain lines={p.chain} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Progress({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-[10px] text-white/50">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">
          {value}/{max}
        </span>
      </div>
      <Meter
        value={value}
        max={max}
        color={color}
        label={tr("{title}: {n} of {total}", { title: label, n: value, total: max })}
      />
    </div>
  );
}

function JournalPanelImpl({ api, onClose }: { api: WorldApi; onClose: () => void }) {
  const s = api.get();
  const version = api.version;
  const [tab, setTab] = useState<Tab>("auftraege");
  const [query, setQuery] = useState("");
  const [thread, setThread] = useState<InsightDef["thread"] | "alle">("alle");
  const q = query.trim().toLowerCase();
  const tracked = trackedObjectiveId(s);

  const known = useMemo(
    () => INSIGHTS.filter((i) => s.insights[i.id]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, version],
  );
  const knownIds = useMemo(() => known.map((i) => i.id), [known]);
  const seen = useSeen("insights", knownIds);
  const newCount = known.filter((i) => seen.isNew(i.id)).length;

  const stats = useMemo(
    () => ({
      insights: known.length,
      devices: DEVICES.filter((d) => isBuilt(s, d.id)).length,
      endings: ENDINGS.filter((e) => s.endings[e.id]).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [known, s, version],
  );

  const byThread = useMemo(() => {
    const m = new Map<InsightDef["thread"], InsightDef[]>();
    for (const i of known) {
      if (thread !== "alle" && i.thread !== thread) continue;
      if (!has(i.title, q) && !has(i.text, q)) continue;
      m.set(i.thread, [...(m.get(i.thread) ?? []), i]);
    }
    return m;
  }, [known, thread, q]);
  const threadCounts = useMemo(() => {
    const m = new Map<InsightDef["thread"], number>();
    for (const i of known) m.set(i.thread, (m.get(i.thread) ?? 0) + 1);
    return m;
  }, [known]);

  return (
    <Panel title={tr("Lab journal · J. Lawrence")} onClose={onClose} wide>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Progress
          label={tr("Insights")}
          value={stats.insights}
          max={INSIGHTS.length}
          color={UI.cyan}
        />
        <Progress
          label={tr("Devices built")}
          value={stats.devices}
          max={DEVICES.length}
          color={UI.green}
        />
        <Progress label={tr("Endings")} value={stats.endings} max={ENDINGS.length} color={UI.ice} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <div role="tablist" aria-label={tr("Journal")} className="flex flex-wrap gap-1">
          {TABS.map(([k, label]) => (
            <FilterChip key={k} active={tab === k} onClick={() => setTab(k)}>
              {label}
              {k === "insights" && newCount > 0 && <NewBadge className="ml-1" />}
            </FilterChip>
          ))}
        </div>
        <SearchField
          value={query}
          onChange={setQuery}
          label={tr("Search the journal")}
          className="ml-auto w-44"
        />
      </div>

      {tab === "auftraege" && (
        <div className="space-y-4">
          <p className="text-xs text-white/50">
            {tr("No fixed order — everything here is possible right now.")}
          </p>
          {isPostgame(s) && <PostgameSection s={s} />}
          {objectiveSections(s, objectivesCached(s, version)).map((sec) => {
            const list = sec.items.filter((o) => has(o.text, q) || has(o.detail, q));
            if (!list.length) return null;
            return (
              <div key={sec.group}>
                <SectionTitle right={list.length}>{sec.title}</SectionTitle>
                <ul className="space-y-1">
                  {list.map((o) => (
                    <li key={o.id} className="text-xs">
                      <span className="flex items-start gap-2">
                        <span className={o.id === tracked ? "text-[#E91E8C]" : "text-[#d8ffd8]"}>
                          {o.id === tracked ? "⚑" : "›"} {o.text}
                        </span>
                        {canTrack(o) && (
                          <button
                            type="button"
                            aria-pressed={o.id === tracked}
                            aria-label={
                              o.id === tracked
                                ? tr("Stop tracking: {objective}", { objective: o.text })
                                : tr("Track on the compass: {objective}", { objective: o.text })
                            }
                            onClick={() =>
                              api.act((st) =>
                                setTrackedObjective(st, o.id === tracked ? null : o.id),
                              )
                            }
                            className={`ml-auto shrink-0 rounded-sm border px-1.5 text-[10px] tracking-wider uppercase ${FOCUS_RING} ${
                              o.id === tracked
                                ? "border-[#E91E8C] bg-[#E91E8C]/15 text-[#E91E8C]"
                                : "border-white/15 text-white/50 hover:border-[#E91E8C]/60 hover:text-[#ffd0ea]"
                            }`}
                          >
                            {o.id === tracked ? tr("objective::Tracked") : tr("objective::Track")}
                          </button>
                        )}
                      </span>
                      {o.detail && <span className="block pl-3 text-white/45">{o.detail}</span>}
                      {o.recipe && (
                        <div className="pl-3">
                          <RecipeChain lines={o.recipe.map((text) => ({ item: text, text }))} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {tab === "wege" && (
        <div className="space-y-3">
          <p className="text-xs text-white/50">
            {tr("There is no single path. Each one here can be reached in any order.")}
          </p>
          {ENDINGS.filter(
            (e) => !e.secret || s.endings[e.id] || evalCondPartial(s, e.requires),
          ).map((e) => {
            const dev = DEVICE_BY_ID.get(e.device);
            const clues =
              "all" in e.requires ? e.requires.all.filter((c) => evalCond(s, c)).length : 0;
            const total = "all" in e.requires ? e.requires.all.length : 1;
            const reached = !!s.endings[e.id];
            const isKnown = reached || clues > 0;
            if (q && !(isKnown && (has(e.title, q) || has(e.prompt, q)))) return null;
            return (
              <div key={e.id} className="rounded-sm border border-white/10 p-2">
                <p className={reached ? "text-[#33FF33]" : "text-[#E8F4FF]"}>
                  {reached ? "✓ " : ""}
                  {isKnown ? e.title : "???"}{" "}
                  <span className="text-xs text-white/40">
                    — {dev ? dev.name : tr("Infinity Forge")}
                  </span>
                </p>
                {!reached && (
                  <Meter
                    value={clues}
                    max={total}
                    color={UI.ice}
                    label={tr("{title}: {n} of {total} clues", {
                      title: isKnown ? e.title : tr("Unknown path"),
                      n: clues,
                      total,
                    })}
                    className="my-1"
                    height={3}
                  />
                )}
                {isKnown && !reached && (
                  <>
                    <p className="text-xs text-white/50">{e.prompt}</p>
                    <Missing cond={e.requires} s={s} />
                  </>
                )}
                {!isKnown && (
                  <p className="text-xs text-white/40">
                    {tr("{n}/{total} clues", { n: clues, total })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "insights" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1" aria-label={tr("Threads")}>
            <FilterChip
              role="button"
              accent={UI.cyan}
              active={thread === "alle"}
              onClick={() => setThread("alle")}
              count={known.length}
            >
              {tr("All")}
            </FilterChip>
            {(Object.keys(THREAD_LABEL) as InsightDef["thread"][])
              .filter((t) => threadCounts.has(t))
              .map((t) => (
                <FilterChip
                  key={t}
                  role="button"
                  accent={UI.cyan}
                  active={thread === t}
                  onClick={() => setThread(t)}
                  count={threadCounts.get(t)}
                >
                  {THREAD_LABEL[t]}
                </FilterChip>
              ))}
          </div>
          {[...byThread.entries()].map(([t, list]) => (
            <div key={t}>
              <SectionTitle>{THREAD_LABEL[t] ?? t}</SectionTitle>
              <ul className="space-y-1">
                {list.map((i) => (
                  <li key={i.id} className="text-xs">
                    <span className="text-[#00FFFF]">{i.title}</span>{" "}
                    {seen.isNew(i.id) && <NewBadge className="mr-1" />}
                    <span className="text-[#d8ffd8]/70">— {i.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {byThread.size === 0 && (
            <p className="text-xs text-white/40">
              {known.length === 0
                ? tr("No insights yet. Listen before you build.")
                : tr("Nothing found.")}
            </p>
          )}
        </div>
      )}

      {tab === "devices" && (
        <>
          {!q && <BlockedBlueprints s={s} />}
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {DEVICES.map((d) => {
              const isKnownDev = s.discovered[d.id];
              if (q && !(isKnownDev && (has(d.name, q) || has(d.id, q)))) return null;
              const st = stagesDone(s, d.id);
              const on = power(s).online.has(d.id);
              const built = isBuilt(s, d.id);
              return (
                <div key={d.id} className="rounded-sm border border-white/10 px-2 py-1">
                  <div className="flex justify-between">
                    <span className={isKnownDev ? "text-[#d8ffd8]" : "text-white/30"}>
                      {isKnownDev ? `${d.id} ${d.name}` : `${d.id} ???`}
                    </span>
                    <span
                      className={on ? "text-[#33FF33]" : built ? "text-red-400" : "text-white/40"}
                    >
                      {built
                        ? on
                          ? tr("online")
                          : tr("off")
                        : isKnownDev
                          ? `${st}/${d.stages.length}`
                          : ""}
                    </span>
                  </div>
                  {isKnownDev && !built && (
                    <Meter
                      value={st}
                      max={d.stages.length}
                      color={UI.amber}
                      label={tr("{name}: stage {n} of {total}", {
                        name: d.name,
                        n: st,
                        total: d.stages.length,
                      })}
                      className="mt-0.5"
                      height={2}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "log" && (
        <ul className="space-y-0.5 text-xs text-[#d8ffd8]/70">
          {[...s.log]
            .reverse()
            .filter((l) => has(l.text, q))
            .map((l, i) => (
              <li key={i}>
                <span className="text-white/30">
                  [{String(Math.floor(l.t / 60)).padStart(3, "0")}:
                  {String(l.t % 60).padStart(2, "0")}]
                </span>{" "}
                {l.text}
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}

export const JournalPanel = memoPanel(JournalPanelImpl);

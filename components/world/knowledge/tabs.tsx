"use client";

import { useMemo, useState, type ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { fmtNum } from "@/components/world/format";
import { CrtButton, FilterChip, Meter, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { NEED_COLOR, NEED_ICON, NEED_LABEL } from "@/components/world/BioPanels";
import { RememberButton } from "@/components/world/knowledge/Remember";
import { KnowledgeRadar } from "@/components/world/knowledge/Radar";
import { clock } from "@/components/world/knowledge/MemoCard";
import {
  BIO_LOW,
  BIO_NEEDS,
  bioActive,
  bioEffects,
  bioRate,
  bioTips,
  bioValues,
  minutesUntilLow,
} from "@/lib/world/biorhythm";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { itemDef } from "@/lib/world/game";
import {
  AREA_HOW,
  AREA_LABEL,
  RANKS,
  areaScore,
  hubsRun,
  rankProgress,
  type AreaScore,
  type DeviceKnowledge,
} from "@/lib/world/knowledge";
import { loadSettings, type BiorhythmMode } from "@/lib/world/settings";
import type { Experiment, KnowledgeArea, WorldState } from "@/lib/world/types";

export const AREA_COLOR: Readonly<Record<KnowledgeArea, string>> = {
  power: UI.amber,
  building: UI.orange,
  combining: UI.magenta,
  signals: UI.cyan,
  anomalies: "#B7A6FF",
  quantum: "#7FD4FF",
  systems: UI.green,
  people: "#FF9ECF",
  exploration: "#C8FF6B",
  body: UI.red,
};

/** A headline number. */
export function Stat({
  label,
  value,
  accent = UI.amber,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-sm border border-white/10 px-2 py-1">
      <div className="text-[9px] tracking-widest text-white/45 uppercase">{label}</div>
      <div className="text-sm" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────

export function OverviewTab({
  areas,
  xp,
  stats,
  onAchievements,
}: {
  areas: readonly AreaScore[];
  xp: number;
  stats: { label: string; value: ReactNode }[];
  onAchievements?: () => void;
}) {
  const rank = rankProgress(xp);
  const [open, setOpen] = useState<KnowledgeArea | null>(null);
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-sm border border-[#FFB800]/30 p-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-[#FFB800]" data-rank={rank.index}>
            {rank.title}
          </span>
          <span className="text-white/55">
            {rank.next !== undefined
              ? tr("{xp} XP · next: {title} at {next} XP", {
                  xp: fmtNum(xp, 0),
                  title: rank.nextTitle ?? "",
                  next: fmtNum(rank.next, 0),
                })
              : tr("{xp} XP · highest rank", { xp: fmtNum(xp, 0) })}
          </span>
        </div>
        <Meter
          value={Math.round(rank.frac * 100)}
          max={100}
          color={UI.amber}
          label={tr("Progress to the next rank")}
          className="mt-1"
          height={5}
        />
        <div className="mt-1 flex flex-wrap gap-x-2 text-[9px] text-white/30">
          {RANKS.map((r, i) => (
            <span key={r.xp} style={i <= rank.index ? { color: `${UI.amber}aa` } : undefined}>
              {r.title}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {stats.map((x) => (
          <Stat key={x.label} label={x.label} value={x.value} />
        ))}
      </div>
      {onAchievements && (
        <CrtButton tone="amber" onClick={onAchievements}>
          {tr("Open achievements")}
        </CrtButton>
      )}

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <KnowledgeRadar areas={areas} />
        <ul className="w-full min-w-0 flex-1 space-y-1.5">
          {areas.map((a) => (
            <li key={a.area} data-area={a.area}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setOpen(open === a.area ? null : a.area)}
                aria-expanded={open === a.area}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span style={{ color: AREA_COLOR[a.area] }}>{AREA_LABEL[a.area]}</span>
                  <span className="text-[10px] text-white/50">
                    {a.levelLabel} · {a.pct}%
                  </span>
                </div>
                <Meter
                  value={a.pct}
                  max={100}
                  color={AREA_COLOR[a.area]}
                  label={tr("{area}: {pct}% — {level}", {
                    area: AREA_LABEL[a.area],
                    pct: a.pct,
                    level: a.levelLabel,
                  })}
                  height={3}
                />
              </button>
              {open === a.area && (
                <p className="mt-0.5 text-[10px] text-white/55">
                  {AREA_HOW[a.area]}{" "}
                  <span className="text-white/35">
                    {tr("({points} of {max} points)", { points: a.points, max: a.max })}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-white/35">{tr("Click an area to see what raises it.")}</p>
    </div>
  );
}

// ── Experience ───────────────────────────────────────────────────

const OUTCOME_LABEL: Readonly<Record<Experiment["outcome"], string>> = {
  recipe: tr("outcome::Recipe"),
  prototype: tr("outcome::Prototype"),
  explosion: tr("outcome::Explosion"),
  fail: tr("outcome::Nothing"),
};

const OUTCOME_COLOR: Readonly<Record<Experiment["outcome"], string>> = {
  recipe: UI.cyan,
  prototype: UI.magenta,
  explosion: UI.red,
  fail: "#ffffff66",
};

export function experimentText(s: WorldState, e: Experiment): string {
  const ins = Object.entries(e.inputs)
    .map(([k, n]) => `${n}× ${itemDef(s, k)?.name ?? k}`)
    .join(" + ");
  const out = e.output ? (itemDef(s, e.output)?.name ?? e.output) : "—";
  return `${ins} → ${out}`;
}

export function ExperienceTab({
  api,
  parts,
  query,
}: {
  api: WorldApi;
  parts: { label: string; n: number; xp: number }[];
  query: string;
}) {
  const s = api.get();
  const q = query.trim().toLowerCase();
  const sorted = [...parts].sort((a, b) => b.xp - a.xp);
  const exps = [...s.experiments].reverse().slice(0, 20);
  const log = [...s.log]
    .reverse()
    .filter((l) => !q || l.text.toLowerCase().includes(q))
    .slice(0, 40);
  return (
    <div className="space-y-3 text-xs">
      <section>
        <SectionTitle>{tr("Where your experience comes from")}</SectionTitle>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-[9px] tracking-widest text-white/40 uppercase">
              <th className="font-normal">{tr("Activity")}</th>
              <th className="text-right font-normal">{tr("Count")}</th>
              <th className="text-right font-normal">XP</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.label} className={p.n ? "text-[#d8ffd8]/85" : "text-white/30"}>
                <td>{p.label}</td>
                <td className="text-right">{fmtNum(p.n, 0)}</td>
                <td className="text-right text-[#FFB800]">{fmtNum(p.xp, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <SectionTitle right={s.experiments.length}>{tr("Recent experiments")}</SectionTitle>
        {exps.length === 0 && (
          <p className="text-white/40">{tr("No experiments yet. The workbench is waiting.")}</p>
        )}
        <ul className="space-y-0.5">
          {exps.map((e, i) => (
            <li key={`${e.t}-${i}`} className="flex items-start gap-2">
              <span className="text-white/30">[{clock(e.t)}]</span>
              <span className="w-20 shrink-0" style={{ color: OUTCOME_COLOR[e.outcome] }}>
                {OUTCOME_LABEL[e.outcome]}
              </span>
              <span className="min-w-0 flex-1 text-[#d8ffd8]/75">{experimentText(s, e)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>{tr("Log")}</SectionTitle>
        <ul className="space-y-0.5 text-[11px] text-[#d8ffd8]/70">
          {log.map((l, i) => (
            <li key={`${l.t}-${i}`} className="flex items-start gap-2">
              <span className="text-white/30">[{clock(l.t)}]</span>
              <span className="min-w-0 flex-1">{l.text}</span>
              <RememberButton
                api={api}
                src={{
                  kind: "log",
                  id: `${l.t}:${l.text.slice(0, 40)}`,
                  title: l.text.slice(0, 40),
                  text: l.text,
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Body & rhythm ────────────────────────────────────────────────

function readMode(): BiorhythmMode {
  try {
    return loadSettings().gameplay.biorhythm;
  } catch {
    return "normal";
  }
}

export function BodyTab({ api }: { api: WorldApi }) {
  const s = api.get();
  const [mode] = useState<BiorhythmMode>(readMode);
  const body = useMemo(
    () => areaScore(s, "body"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, api.version],
  );
  const c = (k: string) => Math.round(s.counters[k] ?? 0);
  const active = bioActive(s);
  const v = bioValues(s);
  const fx = bioEffects(s, mode);
  const tips = bioTips(s, mode);
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Stat label={tr("Body & rhythm")} value={`${body.levelLabel} · ${body.pct}%`} />
        <Stat label={tr("Workouts")} value={c("bio_trainings")} accent={UI.green} />
        <Stat label={tr("Nights slept")} value={c("bio_sleeps")} accent="#B7A6FF" />
        <Stat label={tr("Meals")} value={c("bio_meals")} accent={UI.cyan} />
      </div>
      {!active ? (
        <p className="text-white/45">
          {tr(
            "Your biorhythm starts once you reach Level +1 — until then the lab keeps you going on adrenaline.",
          )}
        </p>
      ) : mode === "off" ? (
        <p className="text-white/45">{tr("The biorhythm is switched off in the settings.")}</p>
      ) : (
        <section className="space-y-2">
          <SectionTitle
            right={
              fx.status === "balanced"
                ? tr("bio::Balanced")
                : fx.status === "low"
                  ? tr("bio::Worn out")
                  : tr("bio::Fine")
            }
          >
            {tr("Biorhythm now")}
          </SectionTitle>
          {BIO_NEEDS.map((n) => {
            const left = minutesUntilLow(s, n, mode);
            const rate = bioRate(n, mode);
            return (
              <div key={n} data-need={n}>
                <div className="flex items-baseline justify-between gap-2">
                  <span style={{ color: NEED_COLOR[n] }}>
                    {NEED_ICON[n]} {NEED_LABEL[n]}
                  </span>
                  <span className="text-[10px] text-white/50">
                    {Math.round(v[n])}/100 · {tr("↓ {rate}/min", { rate: fmtNum(rate, 2) })} ·{" "}
                    {left === null
                      ? tr("steady")
                      : left <= 0
                        ? tr("low now")
                        : tr("low in ~{min} min", { min: Math.round(left) })}
                  </span>
                </div>
                <Meter
                  value={Math.round(v[n])}
                  max={100}
                  color={v[n] < BIO_LOW ? UI.red : NEED_COLOR[n]}
                  label={NEED_LABEL[n]}
                  height={4}
                />
              </div>
            );
          })}
          {tips.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-[#d8ffd8]/75">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      <p className="text-[10px] text-white/40">{AREA_HOW.body}</p>
    </div>
  );
}

// ── Systems ──────────────────────────────────────────────────────

export function SystemsTab({
  api,
  devices,
  query,
}: {
  api: WorldApi;
  devices: readonly DeviceKnowledge[];
  query: string;
}) {
  const s = api.get();
  const [only, setOnly] = useState<"all" | "built" | "online" | "flashed">("all");
  const q = query.trim().toLowerCase();
  const hubs = useMemo(
    () => hubsRun(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, api.version],
  );
  const name = (id: string) => DEVICE_BY_ID.get(id)?.name ?? id;
  const shown = devices.filter(
    (d) =>
      (only === "all" ||
        (only === "built" && d.built) ||
        (only === "online" && d.online) ||
        (only === "flashed" && d.updated)) &&
      (!q || `${d.id} ${d.name} ${d.features.join(" ")}`.toLowerCase().includes(q)),
  );
  const count = {
    built: devices.filter((d) => d.built).length,
    online: devices.filter((d) => d.online).length,
    flashed: devices.filter((d) => d.updated).length,
    operated: devices.filter((d) => d.readoutAt !== undefined).length,
  };
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Stat label={tr("Known devices")} value={devices.length} />
        <Stat label={tr("Built")} value={count.built} accent={UI.green} />
        <Stat label={tr("Operated")} value={count.operated} accent={UI.cyan} />
        <Stat label={tr("Firmware updated")} value={count.flashed} accent={UI.magenta} />
      </div>

      <section>
        <SectionTitle right={hubs.length}>{tr("Hubs you run")}</SectionTitle>
        {hubs.length === 0 ? (
          <p className="text-white/40">
            {tr("No hub links yet. Hubs (network, power bus, MCP) connect devices to each other.")}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {hubs.map((h) => (
              <li key={h.id}>
                <span className="text-[#33FF33]">{name(h.id)}</span>{" "}
                <span className="text-white/40">· {h.label}:</span>{" "}
                <span className="text-[#d8ffd8]/75">{h.links.map(name).join(", ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label={tr("Device filter")}>
        <FilterChip active={only === "all"} onClick={() => setOnly("all")} count={devices.length}>
          {tr("All")}
        </FilterChip>
        <FilterChip active={only === "built"} onClick={() => setOnly("built")} count={count.built}>
          {tr("Built")}
        </FilterChip>
        <FilterChip
          active={only === "online"}
          onClick={() => setOnly("online")}
          count={count.online}
        >
          {tr("online")}
        </FilterChip>
        <FilterChip
          active={only === "flashed"}
          onClick={() => setOnly("flashed")}
          count={count.flashed}
        >
          {tr("Firmware updated")}
        </FilterChip>
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {shown.map((d) => (
          <li key={d.id} data-device={d.id} className="rounded-sm border border-white/10 px-2 py-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className={d.built ? "text-[#d8ffd8]" : "text-white/45"}>
                {d.id} {d.name}
              </span>
              <span
                className="text-[10px]"
                style={{ color: d.online ? UI.green : d.built ? UI.red : "#ffffff66" }}
              >
                {d.built ? (d.online ? tr("online") : tr("off")) : `${d.stages}/${d.total}`}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-white/50">
              <span>
                {tr("fw {version}", { version: d.firmware })}
                {d.updated ? (
                  <span className="text-[#E91E8C]"> {tr("· updated")}</span>
                ) : d.hasUpdate && d.built ? (
                  <span className="text-white/35"> {tr("· update available")}</span>
                ) : null}
              </span>
              {d.readoutAt !== undefined && (
                <span className="text-[#00FFFF]/70">
                  {tr("last readout {time}", { time: clock(d.readoutAt) })}
                </span>
              )}
              {d.hubs.length > 0 && (
                <span>{tr("on {hubs}", { hubs: d.hubs.map(name).join(", ") })}</span>
              )}
              {d.hubLinks && d.hubLinks.length > 0 && (
                <span className="text-[#33FF33]/70">
                  {tr("hub for {n}", { n: d.hubLinks.length })}
                </span>
              )}
            </div>
            {d.features.length > 0 && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {d.features.map((f) => (
                  <code
                    key={f}
                    className="rounded-sm border border-[#33FF33]/20 px-1 text-[9px] text-[#33FF33]/70"
                  >
                    {f}
                  </code>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-white/40">{tr("Nothing found.")}</p>}
    </div>
  );
}

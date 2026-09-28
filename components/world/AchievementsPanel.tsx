"use client";

import { tr } from "@/lib/i18n";
import { memo, useMemo, useState } from "react";
import {
  FilterChip,
  Meter,
  NewBadge,
  Panel,
  SearchField,
  SectionTitle,
} from "@/components/world/ui";
import { useSeen } from "@/components/world/panels/shared";
import {
  achievementCount,
  achievementsByBranch,
  type AchievementBranch,
  type AchievementView,
} from "@/lib/world/achievements";
import type { WorldState } from "@/lib/world/types";

const BRANCH_COLOR: Record<AchievementBranch, string> = {
  energie: "#FFD700",
  ressourcen: "#FFB800",
  konstruktion: "#FF4444",
  vielseitigkeit: "#33FF33",
  anomalie: "#00FFFF",
  relikt: "#C4B9A0",
  kosmos: "#8B00FF",
  ki: "#9AD0FF",
  transzendenz: "#E8F4FF",
  labor: "#33FF33",
};

type Status = "alle" | "offen" | "erreicht";

function Row({ v, color, isNew }: { v: AchievementView; color: string; isNew: boolean }) {
  const masked = v.def.hidden && !v.unlocked;
  return (
    <li
      className={`rounded-sm border px-2 py-1.5 ${v.unlocked ? "" : "opacity-70"}`}
      style={{ borderColor: v.unlocked ? `${color}88` : "rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[13px]"
          style={{ color: v.unlocked ? color : v.available ? "#d8ffd8" : "rgba(255,255,255,0.4)" }}
        >
          {v.unlocked ? "★ " : v.available ? "☆ " : "· "}
          {masked ? "???" : v.def.title}
          {isNew && <NewBadge className="ml-1.5 align-middle" />}
        </span>
        {v.progress && !v.unlocked && !masked && (
          <span className="shrink-0 text-[10px] text-white/50 tabular-nums">
            {v.progress.current}/{v.progress.target}
          </span>
        )}
      </div>
      <p className="text-[11px] text-white/50">
        {masked
          ? tr("A secret. The lab will only reveal it when the time comes.")
          : v.def.description}
      </p>
      {v.progress && !v.unlocked && !masked && (
        <Meter
          value={Math.min(v.progress.current, v.progress.target)}
          max={Math.max(1, v.progress.target)}
          color={color}
          label={tr("{title}: {n} of {total}", {
            title: v.def.title,
            n: v.progress.current,
            total: v.progress.target,
          })}
          className="mt-1"
        />
      )}
    </li>
  );
}

/**
 * CRT overlay listing every achievement branch with locked / unlocked
 * state, per-branch progress, search and "new" markers. `version` is the
 * world change counter (the state object is mutated in place).
 */
function AchievementsPanelImpl({
  state,
  onClose,
  version = 0,
}: {
  state: WorldState;
  onClose: () => void;
  version?: number;
}) {
  const branches = useMemo(
    () => achievementsByBranch(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, version],
  );
  const [filter, setFilter] = useState<AchievementBranch | "alle">("alle");
  const [status, setStatus] = useState<Status>("alle");
  const [query, setQuery] = useState("");
  const { unlocked, total } = achievementCount(state);
  const unlockedIds = useMemo(
    () => branches.flatMap((b) => b.items.filter((i) => i.unlocked).map((i) => i.def.id)),
    [branches],
  );
  const seen = useSeen("achievements", unlockedIds);
  const q = query.trim().toLowerCase();

  const shown = branches
    .filter((b) => filter === "alle" || b.branch === filter)
    .map((b) => ({
      ...b,
      items: b.items.filter((v) => {
        if (status === "offen" && v.unlocked) return false;
        if (status === "erreicht" && !v.unlocked) return false;
        if (!q) return true;
        if (v.def.hidden && !v.unlocked) return false;
        return v.def.title.toLowerCase().includes(q) || v.def.description.toLowerCase().includes(q);
      }),
    }))
    .filter((b) => b.items.length > 0);

  return (
    <Panel
      title={tr("Achievements")}
      subtitle={tr(
        "{n}/{total} unlocked · “Keep listening. Keep building. Keep the lab unstable.”",
        { n: unlocked, total },
      )}
      onClose={onClose}
      wide
    >
      <Meter
        value={unlocked}
        max={total}
        color="#FFB800"
        label={tr("Achievements: {n} of {total}", { n: unlocked, total })}
        height={5}
        className="mb-3"
      />
      <div role="tablist" aria-label={tr("Branches")} className="mb-2 flex flex-wrap gap-1">
        <FilterChip active={filter === "alle"} onClick={() => setFilter("alle")}>
          {tr("All")}
        </FilterChip>
        {branches.map((b) => {
          const done = b.items.filter((i) => i.unlocked).length;
          const fresh = b.items.some((i) => i.unlocked && seen.isNew(i.def.id));
          return (
            <FilterChip
              key={b.branch}
              active={filter === b.branch}
              accent={BRANCH_COLOR[b.branch]}
              onClick={() => setFilter(b.branch)}
              count={`${done}/${b.items.length}`}
            >
              {b.label}
              {fresh && (
                <span aria-label={tr("new")} className="ml-1 text-[#E91E8C]">
                  •
                </span>
              )}
            </FilterChip>
          );
        })}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {(["alle", "offen", "erreicht"] as const).map((st) => (
          <FilterChip
            key={st}
            role="button"
            accent="#00FFFF"
            active={status === st}
            onClick={() => setStatus(st)}
          >
            {st === "alle" ? tr("All") : st === "offen" ? tr("Open") : tr("Achieved")}
          </FilterChip>
        ))}
        <SearchField
          value={query}
          onChange={setQuery}
          label={tr("Search achievements")}
          className="ml-auto w-44"
        />
      </div>
      <div className="grid min-h-[40vh] content-start gap-4 md:grid-cols-2">
        {shown.map((b) => {
          const all = branches.find((x) => x.branch === b.branch)?.items ?? b.items;
          const done = all.filter((i) => i.unlocked).length;
          return (
            <section key={b.branch} aria-label={b.label}>
              <SectionTitle accent={BRANCH_COLOR[b.branch]} right={`${done}/${all.length}`}>
                {b.label}
              </SectionTitle>
              <Meter
                value={done}
                max={all.length}
                color={BRANCH_COLOR[b.branch]}
                label={tr("{title}: {n} of {total}", {
                  title: b.label,
                  n: done,
                  total: all.length,
                })}
                height={2}
                className="mb-1.5"
              />
              <ul className="space-y-1.5">
                {b.items.map((v) => (
                  <Row
                    key={v.def.id}
                    v={v}
                    color={BRANCH_COLOR[b.branch]}
                    isNew={v.unlocked && seen.isNew(v.def.id)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
        {shown.length === 0 && <p className="text-xs text-white/40">{tr("Nothing found.")}</p>}
      </div>
    </Panel>
  );
}

export const AchievementsPanel = memo(
  AchievementsPanelImpl,
  (a, b) => a.state === b.state && a.version === b.version,
);

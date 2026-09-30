"use client";

import { useMemo, useState } from "react";
import { tr } from "@/lib/i18n";
import { fmtNum } from "@/components/world/format";
import { FilterChip, Panel, SearchField } from "@/components/world/ui";
import { memoPanel, type WorldApi } from "@/components/world/panels/shared";
import { MemosTab } from "@/components/world/knowledge/MemosTab";
import { ProcessedTab } from "@/components/world/knowledge/ProcessedTab";
import { BodyTab, ExperienceTab, OverviewTab, SystemsTab } from "@/components/world/knowledge/tabs";
import { clock } from "@/components/world/knowledge/MemoCard";
import { achievementCount } from "@/lib/world/achievements";
import { allAreas, experience, processed, rankOf, systemKnowledge } from "@/lib/world/knowledge";

export type KnowledgeTab = "overview" | "experience" | "body" | "systems" | "processed" | "memos";

const TABS: readonly [KnowledgeTab, string][] = [
  ["overview", tr("knowledge::Overview")],
  ["experience", tr("knowledge::Experience")],
  ["body", tr("knowledge::Body")],
  ["systems", tr("knowledge::Systems")],
  ["processed", tr("knowledge::Processed")],
  ["memos", tr("knowledge::Memos")],
];

/**
 * Jade's knowledge panel (hotkey N): areas, experience, body & rhythm,
 * system knowledge, processed information, memos. Rules: lib/world/knowledge.ts,
 * lib/world/memos.ts. Everything is derived from the save, recomputed per
 * world change (`api.version`), never per frame.
 */
function KnowledgePanelImpl({
  api,
  onClose,
  initialTab = "overview",
  onAchievements,
}: {
  api: WorldApi;
  onClose: () => void;
  initialTab?: KnowledgeTab;
  /** Opens the achievements panel (link in the overview). */
  onAchievements?: () => void;
}) {
  const s = api.get();
  const [tab, setTab] = useState<KnowledgeTab>(initialTab);
  const [query, setQuery] = useState("");

  const d = useMemo(
    () => {
      const xp = experience(s);
      return {
        areas: allAreas(s),
        xp,
        info: processed(s),
        devices: systemKnowledge(s),
        ach: achievementCount(s),
      };
    },
    // `api.version` covers every state change (the state is mutated in place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, api.version],
  );
  const rank = rankOf(d.xp.xp);
  const avg = Math.round(d.areas.reduce((n, a) => n + a.pct, 0) / d.areas.length);

  return (
    <Panel
      title={tr("Knowledge")}
      subtitle={tr("J. Lawrence · {rank} · {xp} XP", {
        rank: rank.title,
        xp: fmtNum(d.xp.xp, 0),
      })}
      onClose={onClose}
      wide
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={tr("Knowledge sections")}>
          {TABS.map(([k, label]) => (
            <FilterChip
              key={k}
              active={tab === k}
              onClick={() => setTab(k)}
              {...(k === "memos" ? { count: s.memos.length } : {})}
            >
              {label}
            </FilterChip>
          ))}
        </div>
        {tab !== "overview" && tab !== "body" && (
          <SearchField
            value={query}
            onChange={setQuery}
            label={tr("Search your knowledge")}
            className="ml-auto w-44"
          />
        )}
      </div>

      {tab === "overview" && (
        <OverviewTab
          areas={d.areas}
          xp={d.xp.xp}
          {...(onAchievements ? { onAchievements } : {})}
          stats={[
            { label: tr("Knowledge (avg.)"), value: `${avg}%` },
            { label: tr("Information processed"), value: d.info.total },
            { label: tr("Memos"), value: d.info.memos },
            {
              label: tr("Achievements"),
              value: `${d.ach.unlocked}/${d.ach.total}`,
            },
            { label: tr("Devices built"), value: d.devices.filter((x) => x.built).length },
            { label: tr("Experiments"), value: s.combos },
            { label: tr("Courses done"), value: d.info.courses },
            { label: tr("Time in the lab"), value: clock(s.playTime) },
          ]}
        />
      )}
      {tab === "experience" && <ExperienceTab api={api} parts={d.xp.parts} query={query} />}
      {tab === "body" && <BodyTab api={api} />}
      {tab === "systems" && <SystemsTab api={api} devices={d.devices} query={query} />}
      {tab === "processed" && <ProcessedTab api={api} info={d.info} query={query} />}
      {tab === "memos" && <MemosTab api={api} query={query} />}
    </Panel>
  );
}

export const KnowledgePanel = memoPanel(KnowledgePanelImpl);

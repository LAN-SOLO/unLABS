"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, INPUT_CLASS, SectionTitle, UI } from "@/components/world/ui";
import { EntryCard } from "@/components/world/ArchiveSpot";
import type { WorldApi } from "@/components/world/panels/shared";
import {
  TIER_LABEL,
  archiveProgress,
  combine,
  foundEntries,
  openCombos,
} from "@/lib/world/archive";
import type { ArchiveTier, ArchiveTopic } from "@/lib/world/content/archive";

export const TOPIC_LABEL: Readonly<Record<ArchiveTopic, string>> = {
  basics: tr("topic::Basics"),
  power: tr("topic::Power"),
  building: tr("topic::Building"),
  devices: tr("topic::Devices"),
  firmware: tr("topic::Firmware"),
  network: tr("topic::Network"),
  combine: tr("topic::Combining"),
  puzzles: tr("topic::Puzzles"),
  doors: tr("topic::Doors & codes"),
  items: tr("topic::Items"),
  bots: tr("topic::Bots"),
  lore: tr("topic::Lore"),
  secrets: tr("topic::Secrets"),
  endings: tr("topic::Endings"),
};

/**
 * Journal → Archive: everything found in the lab, grouped by topic, plus the
 * combination console (answers that follow from several finds together).
 */
export function ArchiveTab({ api, query }: { api: WorldApi; query: string }) {
  const s = api.get();
  const found = foundEntries(s);
  const progress = archiveProgress(s);
  const open = openCombos(s);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const shown = found.filter((e) => !q || `${e.title} ${e.text}`.toLowerCase().includes(q));
  const topics = [...new Set(shown.map((e) => e.topic))];

  const tryAnswer = () => {
    const hit = api.act((st) => combine(st, answer));
    if (hit.length) {
      api.sound?.("item_rare");
      for (const e of hit) api.toast(tr("Archive — {title}", { title: e.title }), "insight");
      setMsg(null);
      setAnswer("");
    } else {
      api.sound?.("fail_buzz");
      setMsg(tr("Nothing connects to that. Yet."));
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap gap-3 text-[11px] text-white/55">
        {([1, 2, 3, 4, 5] as ArchiveTier[]).map((t) => (
          <span key={t}>
            {TIER_LABEL[t]}: <b style={{ color: UI.amber }}>{progress[t].found}</b>/
            {progress[t].total}
          </span>
        ))}
      </div>

      <div className="rounded-sm border border-[#00FFFF]/30 p-2">
        <SectionTitle accent={UI.cyan}>{tr("Combine findings")}</SectionTitle>
        {open.length === 0 ? (
          <p className="text-white/40">
            {tr(
              "Some knowledge is not written down anywhere — it only appears when you put several finds together.",
            )}
          </p>
        ) : (
          <ul className="mb-2 list-disc pl-4 text-[#d8ffd8]/80">
            {open.map((e) => (
              <li key={e.id}>{e.prompt ?? tr("Something connects your notes …")}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${INPUT_CLASS} w-56`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") tryAnswer();
              e.stopPropagation();
            }}
            placeholder={tr("your conclusion …")}
            aria-label={tr("Your conclusion")}
          />
          <CrtButton tone="cyan" disabled={!answer.trim()} onClick={tryAnswer}>
            {tr("Connect")}
          </CrtButton>
          {msg && <span className="text-white/45">{msg}</span>}
        </div>
      </div>

      {found.length === 0 && (
        <p className="text-white/40">
          {tr("Nothing archived yet. Read boards and screens, search lockers, drawers and vents.")}
        </p>
      )}
      {topics.map((t) => (
        <section key={t} className="space-y-1.5">
          <SectionTitle>{TOPIC_LABEL[t]}</SectionTitle>
          {shown
            .filter((e) => e.topic === t)
            .map((e) => (
              <EntryCard key={e.id} e={e} api={api} />
            ))}
        </section>
      ))}
    </div>
  );
}

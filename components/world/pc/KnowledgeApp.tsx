"use client";

import { tr } from "@/lib/i18n";
import { Meter, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { AppWindow, Muted } from "@/components/world/pc/common";
import { BIO_NEEDS, bioActive, bioValues, type BioNeed } from "@/lib/world/biorhythm";
import { allPerks, hasPerk } from "@/lib/world/courses";
import { AREA_LABEL, allAreas, experience, processed, rankOf } from "@/lib/world/knowledge";

const NEED_LABEL: Readonly<Record<BioNeed, string>> = {
  food: tr("pcneed::Satiation"),
  drink: tr("pcneed::Hydration"),
  rest: tr("pcneed::Rest"),
  fit: tr("pcneed::Fitness"),
};

/** JadeOS "Knowledge": a compact summary (areas, rank, body, processed info, perks). */
export function KnowledgeApp({ api }: { api: WorldApi }) {
  const s = api.get();
  const areas = allAreas(s);
  const { xp } = experience(s);
  const rank = rankOf(xp);
  const info = processed(s);
  const perks = allPerks().filter((p) => hasPerk(s, p.id));
  const bio = bioActive(s) ? bioValues(s) : null;
  return (
    <AppWindow title={tr("pc::Knowledge")} right={tr("Press N in the lab for the full panel")}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <SectionTitle right={`${xp} XP`}>{rank.title}</SectionTitle>
          {rank.next !== undefined && (
            <Meter
              value={xp}
              max={rank.next}
              color={UI.amber}
              label={tr("Experience to the next rank")}
            />
          )}
          <SectionTitle className="pt-2">{tr("pc::Areas")}</SectionTitle>
          <ul className="space-y-1">
            {areas.map((a) => (
              <li key={a.area}>
                <div className="flex justify-between text-[11px]">
                  <span style={{ color: UI.text }}>{AREA_LABEL[a.area]}</span>
                  <span className="text-white/45">{`${a.levelLabel} · ${a.pct} %`}</span>
                </div>
                <Meter
                  value={a.pct}
                  max={100}
                  color={UI.green}
                  label={AREA_LABEL[a.area]}
                  height={3}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1">
          <SectionTitle>{tr("pc::Body & rhythm")}</SectionTitle>
          {bio ? (
            <ul className="space-y-1">
              {BIO_NEEDS.map((n) => (
                <li key={n}>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: UI.text }}>{NEED_LABEL[n]}</span>
                    <span className="text-white/45">{Math.round(bio[n])}</span>
                  </div>
                  <Meter
                    value={Math.round(bio[n])}
                    max={100}
                    color={UI.cyan}
                    label={NEED_LABEL[n]}
                    height={3}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Muted>{tr("No biorhythm data yet.")}</Muted>
          )}
          <SectionTitle className="pt-2" right={String(info.total)}>
            {tr("pc::Processed information")}
          </SectionTitle>
          <dl className="grid grid-cols-2 gap-x-3 text-[11px]">
            {(
              [
                [tr("pcinfo::Insights"), info.insights],
                [tr("pcinfo::Archive finds"), info.archive],
                [tr("pcinfo::Notes read"), info.notes],
                [tr("pcinfo::Readouts"), info.readouts],
                [tr("pcinfo::Recipes"), info.recipes],
                [tr("pcinfo::Experiments"), info.experiments],
                [tr("pcinfo::Memos"), info.memos],
                [tr("pcinfo::Courses"), info.courses],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-white/50">{k}</dt>
                <dd style={{ color: UI.text }}>{v}</dd>
              </div>
            ))}
          </dl>
          <SectionTitle className="pt-2" right={`${perks.length}/${allPerks().length}`}>
            {tr("pc::Perks")}
          </SectionTitle>
          {perks.length ? (
            <ul className="space-y-0.5 text-[11px]">
              {perks.map((p) => (
                <li key={p.id}>
                  <span style={{ color: UI.green }}>{p.label}</span>
                  <span className="text-white/45">{` — ${p.text}`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>{tr("No perks yet. Courses in the Learn app grant some.")}</Muted>
          )}
        </div>
      </div>
    </AppWindow>
  );
}

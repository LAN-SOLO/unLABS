"use client";

import { useMemo, type ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { TOPIC_LABEL } from "@/components/world/panels/archive";
import { parseComboKey } from "@/components/world/panels/derive";
import { RememberButton, type RememberSource } from "@/components/world/knowledge/Remember";
import { Stat } from "@/components/world/knowledge/tabs";
import { clock } from "@/components/world/knowledge/MemoCard";
import { foundEntries } from "@/lib/world/archive";
import { COURSES } from "@/lib/world/content/courses";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { NOTES } from "@/lib/world/content/map";
import { INSIGHTS } from "@/lib/world/content/story";
import { itemDef } from "@/lib/world/game";
import type { ProcessedInfo } from "@/lib/world/knowledge";
import type { InsightDef } from "@/lib/world/types";

const THREAD_LABEL: Readonly<Record<InsightDef["thread"], string>> = {
  damien: tr("Damien"),
  halo: tr("The Halo"),
  signal: tr("Signals"),
  anomalie: tr("Anomalies"),
  relikt: tr("Relics"),
  strom: tr("Lab & power"),
  bots: tr("Bots & MCP"),
};

interface Row {
  key: string;
  title: string;
  text: string;
  meta?: string;
  src: RememberSource;
}

function Group({
  title,
  rows,
  api,
  empty,
  accent = UI.amber,
  sub,
}: {
  title: string;
  rows: readonly Row[];
  api: WorldApi;
  empty: string;
  accent?: string;
  sub?: (r: Row) => string | undefined;
}) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const g = sub?.(r) ?? "";
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return (
    <details className="rounded-sm border border-white/10 p-2" data-processed={title}>
      <summary className="cursor-pointer" style={{ color: accent }}>
        {title} <span className="text-white/40">({rows.length})</span>
      </summary>
      {rows.length === 0 && <p className="mt-1 text-white/40">{empty}</p>}
      {[...groups.entries()].map(([g, list]) => (
        <div key={g} className="mt-1.5">
          {g && <SectionTitle accent={UI.cyan}>{g}</SectionTitle>}
          <ul className="space-y-1">
            {list.map((r) => (
              <li key={r.key} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[#d8ffd8]">{r.title}</span>
                  {r.meta && <span className="text-white/35"> · {r.meta}</span>}
                  <p className="line-clamp-3 text-[11px] whitespace-pre-line text-[#d8ffd8]/60">
                    {r.text}
                  </p>
                </div>
                <RememberButton api={api} src={r.src} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

export function ProcessedTab({
  api,
  info,
  query,
}: {
  api: WorldApi;
  info: ProcessedInfo;
  query: string;
}) {
  const s = api.get();
  const q = query.trim().toLowerCase();
  const lists = useMemo(() => {
    const insights: Row[] = INSIGHTS.filter((i) => s.insights[i.id]).map((i) => ({
      key: i.id,
      title: i.title,
      text: i.text,
      meta: THREAD_LABEL[i.thread],
      src: { kind: "insight", id: i.id, title: i.title, text: i.text, tags: [i.thread] },
    }));
    const archive: Row[] = foundEntries(s).map((e) => ({
      key: e.id,
      title: e.title,
      text: e.text,
      meta: TOPIC_LABEL[e.topic],
      src: { kind: "archive", id: e.id, title: e.title, text: e.text, tags: [e.topic] },
    }));
    const notes: Row[] = NOTES.filter((n) => s.read[n.id]).map((n) => ({
      key: n.id,
      title: n.title,
      text: n.body,
      src: { kind: "note", id: n.id, title: n.title, text: n.body },
    }));
    const recipes: Row[] = Object.entries(s.recipesKnown).map(([key, out]) => {
      const name = itemDef(s, out)?.name ?? out;
      const text = `${Object.entries(parseComboKey(key))
        .map(([k, n]) => `${n}× ${itemDef(s, k)?.name ?? k}`)
        .join(" + ")} → ${name}`;
      return { key, title: name, text, src: { kind: "recipe", id: key, title: name, text } };
    });
    const readouts: Row[] = Object.entries(s.readouts).map(([id, r]) => {
      const title = tr("Readout {name}", { name: DEVICE_BY_ID.get(id)?.name ?? id });
      const text = r.lines.join("\n");
      return {
        key: id,
        title,
        text,
        meta: clock(r.t),
        src: { kind: "readout", id: `${id}@${r.t}`, title, text, tags: [id.toLowerCase()] },
      };
    });
    const courses: Row[] = COURSES.filter((c) => s.flags[`course_${c.id}`]).map((c) => {
      const text = c.lessons.join("\n");
      return {
        key: c.id,
        title: c.title,
        text,
        meta: c.blurb,
        src: { kind: "course", id: c.id, title: c.title, text },
      };
    });
    return { insights, archive, notes, recipes, readouts, courses };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, api.version]);
  const f = (rows: Row[]) =>
    q ? rows.filter((r) => `${r.title} ${r.text}`.toLowerCase().includes(q)) : rows;

  const tiles: [string, number, string?][] = [
    [tr("Insights"), info.insights, UI.cyan],
    [tr("Archive finds"), info.archive],
    [tr("Notes read"), info.notes],
    [tr("Mails read"), info.mails],
    [tr("Files unlocked"), info.files],
    [tr("Recipes known"), info.recipes, UI.magenta],
    [tr("Readouts on file"), info.readouts, UI.cyan],
    [tr("Experiments"), info.experiments],
    [tr("Memos"), info.memos, UI.amber],
    [tr("Courses done"), info.courses, UI.green],
  ];
  const groups: [string, Row[], string, ((r: Row) => string | undefined)?][] = [
    [tr("Insights by thread"), f(lists.insights), tr("No insights yet."), (r) => r.meta],
    [tr("Archive by topic"), f(lists.archive), tr("Nothing archived yet."), (r) => r.meta],
    [tr("Notes read"), f(lists.notes), tr("No notes read yet.")],
    [tr("Recipes known"), f(lists.recipes), tr("No recipes yet.")],
    [
      tr("Device readouts on file"),
      f(lists.readouts),
      tr("No readouts yet. Use “Read out” on a device."),
    ],
    [tr("Courses done"), f(lists.courses), tr("No course finished yet. Study at your computer.")],
  ];
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-baseline justify-between">
        <SectionTitle>{tr("Information processed")}</SectionTitle>
        <span className="text-lg text-[#FFB800]" data-processed-total>
          {info.total}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {tiles.map(
          ([label, n, accent]): ReactNode => (
            <Stat key={label} label={label} value={n} accent={accent ?? UI.amber} />
          ),
        )}
      </div>
      {groups.map(([title, rows, empty, sub]) => (
        <Group
          key={title}
          title={title}
          rows={rows}
          api={api}
          empty={empty}
          {...(sub ? { sub } : {})}
        />
      ))}
    </div>
  );
}

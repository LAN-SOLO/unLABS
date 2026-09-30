"use client";

import { useMemo, useState } from "react";
import { tr } from "@/lib/i18n";
import { FilterChip, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { MemoAction, MemoCard, MemoEditor } from "@/components/world/knowledge/MemoCard";
import { placeLabel } from "@/components/world/knowledge/boards";
import {
  MEMO_MAX,
  addMemo,
  boardsInUse,
  canMoveFrom,
  deleteMemo,
  editMemo,
  memoTags,
  moveMemo,
  pinnedAt,
  searchMemos,
} from "@/lib/world/memos";
import type { Memo } from "@/lib/world/types";

type PlaceFilter = "all" | "mind" | "pc" | "boards";

/** Memos tab: write, edit, tag, filter and move Jade's notes; boards in use. */
export function MemosTab({ api, query }: { api: WorldApi; query: string }) {
  const s = api.get();
  const [place, setPlace] = useState<PlaceFilter>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const tags = useMemo(
    () => memoTags(s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, api.version],
  );
  const boards = useMemo(
    () => boardsInUse(s).map((p) => ({ place: p, label: placeLabel(p), n: pinnedAt(s, p).length })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, api.version],
  );
  const labels = useMemo(() => new Map(boards.map((b) => [b.place, b.label])), [boards]);
  const where = (m: Memo) =>
    m.place.startsWith("decor:")
      ? (labels.get(m.place) ?? placeLabel(m.place))
      : placeLabel(m.place);

  const counts = {
    all: s.memos.length,
    mind: s.memos.filter((m) => m.place === "mind").length,
    pc: s.memos.filter((m) => m.place === "pc").length,
    boards: s.memos.filter((m) => m.place.startsWith("decor:")).length,
  };
  const shown = searchMemos(s, query)
    .filter(
      (m) =>
        place === "all" || (place === "boards" ? m.place.startsWith("decor:") : m.place === place),
    )
    .filter((m) => !tag || (m.tags ?? []).includes(tag))
    .sort((a, b) => b.t - a.t);

  const toMind = (m: Memo) => {
    const r = api.act((st) => moveMemo(st, m.id, "mind"));
    if (!r.ok) return api.toast(r.message, "warn");
    api.toast(
      m.place.startsWith("decor:")
        ? tr("Taken off the board — back in your head: {title}", { title: m.title })
        : tr("Back in your head: {title}", { title: m.title }),
      "info",
    );
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={tr("Where the memos are")}>
          {(
            [
              ["all", tr("All")],
              ["mind", tr("In my head")],
              ["pc", tr("Computer")],
              ["boards", tr("Boards")],
            ] as const
          ).map(([k, label]) => (
            <FilterChip key={k} active={place === k} onClick={() => setPlace(k)} count={counts[k]}>
              {label}
            </FilterChip>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-white/40">
          {tr("{n} of {max} memos", { n: s.memos.length, max: MEMO_MAX })}
        </span>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label={tr("Tags")}>
          {tags.slice(0, 24).map((t) => (
            <FilterChip
              key={t.tag}
              role="button"
              accent={UI.cyan}
              active={tag === t.tag}
              onClick={() => setTag(tag === t.tag ? null : t.tag)}
              count={t.n}
            >
              #{t.tag}
            </FilterChip>
          ))}
        </div>
      )}

      {writing ? (
        <div className="rounded-sm border border-[#FFB800]/30 p-2">
          <SectionTitle>{tr("New memo")}</SectionTitle>
          <MemoEditor
            submitLabel={tr("Save memo")}
            onCancel={() => setWriting(false)}
            onSave={(m) => {
              const r = api.act((st) =>
                addMemo(st, {
                  title: m.title,
                  text: m.text,
                  tags: m.tags,
                  place: "mind",
                  source: { kind: "custom" },
                }),
              );
              if (!r.ok) {
                api.toast(r.message, "warn");
                return false;
              }
              api.sound?.("ui_click");
              api.toast(tr("Noted — {title}", { title: r.memo.title }), "good");
              setWriting(false);
              return true;
            }}
          />
        </div>
      ) : (
        <MemoAction tone="amber" onClick={() => setWriting(true)}>
          {tr("+ New memo")}
        </MemoAction>
      )}

      {shown.length === 0 && (
        <p className="text-white/40">
          {s.memos.length === 0
            ? tr(
                "No memos yet. Press “+ Remember” on anything you read — archive finds, insights, readouts, recipes, notes — or write your own.",
              )
            : tr("Nothing found.")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {shown.map((m) =>
          editing === m.id ? (
            <div key={m.id} className="rounded-sm border border-[#FFB800]/40 p-2">
              <MemoEditor
                initial={m}
                submitLabel={tr("Save")}
                onCancel={() => setEditing(null)}
                onSave={(p) => {
                  api.act((st) => editMemo(st, m.id, p));
                  setEditing(null);
                  return true;
                }}
              />
            </div>
          ) : (
            <MemoCard key={m.id} memo={m} where={where(m)} paper={m.place.startsWith("decor:")}>
              <MemoAction onClick={() => setEditing(m.id)}>{tr("Edit")}</MemoAction>
              {m.place !== "mind" && canMoveFrom(m, { kind: "knowledge" }) && (
                <MemoAction tone="cyan" onClick={() => toMind(m)}>
                  {m.place.startsWith("decor:") ? tr("Take off") : tr("To my head")}
                </MemoAction>
              )}
              {confirmDel === m.id ? (
                <>
                  <MemoAction
                    tone="red"
                    onClick={() => {
                      api.act((st) => deleteMemo(st, m.id));
                      setConfirmDel(null);
                    }}
                  >
                    {tr("Really delete")}
                  </MemoAction>
                  <MemoAction onClick={() => setConfirmDel(null)}>{tr("Keep")}</MemoAction>
                </>
              ) : (
                <MemoAction tone="red" onClick={() => setConfirmDel(m.id)}>
                  {tr("Delete")}
                </MemoAction>
              )}
            </MemoCard>
          ),
        )}
      </div>

      <section>
        <SectionTitle right={boards.length}>{tr("Boards in use")}</SectionTitle>
        {boards.length === 0 ? (
          <p className="text-white/40">
            {tr(
              "Cork boards, whiteboards, sticky-note walls and the fridge take notes. Walk up to one to pin a memo.",
            )}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {boards.map((b) => (
              <li key={b.place} className="flex justify-between gap-2" data-board={b.place}>
                <span className="text-[#d8ffd8]/80">{b.label}</span>
                <span className="text-white/45">{tr("{n} pinned", { n: b.n })}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[10px] text-white/35">
          {tr(
            "Your computer in Jade's Quarters files memos too. A memo on a board is taken off at that board — or here.",
          )}
        </p>
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, INPUT_CLASS, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { MemoAction, MemoCard, MemoEditor, keepKeys } from "@/components/world/knowledge/MemoCard";
import {
  BOARD_CAPACITY,
  addMemo,
  boardPlace,
  canMoveFrom,
  carried,
  pinMemo,
  pinnedAt,
  unpinMemo,
} from "@/lib/world/memos";

/**
 * A board Jade can pin memos to (cork board, whiteboard, sticky-note wall,
 * fridge …): the notes pinned here are readable, she can pin one of hers
 * (from her head or her computer), write a note straight onto the board,
 * or take a note off (it goes back into her head).
 */
export function PinBoard({ api, placementId }: { api: WorldApi; placementId: string }) {
  const s = api.get();
  const place = boardPlace(placementId);
  const pinned = pinnedAt(s, place).sort((a, b) => a.t - b.t);
  const mine = carried(s);
  const [pick, setPick] = useState("");
  const [writing, setWriting] = useState(false);
  const full = pinned.length >= BOARD_CAPACITY;

  const pin = (id: string) => {
    const r = api.act((st) => pinMemo(st, id, placementId));
    if (!r.ok) return api.toast(r.message, "warn");
    api.sound?.("ui_click");
    api.toast(tr("Pinned — {title}", { title: r.memo.title }), "good");
    setPick("");
  };
  const takeOff = (id: string) => {
    const r = api.act((st) => unpinMemo(st, id));
    if (!r.ok) return api.toast(r.message, "warn");
    api.toast(tr("Taken off — back in your head: {title}", { title: r.memo.title }), "info");
  };

  return (
    <section className="space-y-2 text-xs" data-pinboard={placementId}>
      <SectionTitle accent={UI.amber} right={`${pinned.length}/${BOARD_CAPACITY}`}>
        {tr("Your notes on this board")}
      </SectionTitle>
      {pinned.length === 0 && (
        <p className="text-white/40">
          {tr(
            "Nothing of yours pinned here yet. A board remembers what you would rather not carry.",
          )}
        </p>
      )}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {pinned.map((m) => (
          <MemoCard key={m.id} memo={m} paper>
            {canMoveFrom(m, { kind: "board", placement: placementId }) && (
              <MemoAction
                onClick={() => takeOff(m.id)}
                label={tr("Take off: {title}", { title: m.title })}
              >
                {tr("Take off")}
              </MemoAction>
            )}
          </MemoCard>
        ))}
      </div>
      {!full && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${INPUT_CLASS} max-w-[16rem] min-w-0 flex-1`}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            onKeyDown={keepKeys}
            aria-label={tr("Memo to pin")}
            disabled={mine.length === 0}
          >
            <option value="">
              {mine.length ? tr("Pick one of your memos …") : tr("No memos to pin")}
            </option>
            {mine.map((m) => (
              <option key={m.id} value={m.id}>
                {m.place === "pc" ? "▣ " : "◇ "}
                {m.title}
              </option>
            ))}
          </select>
          <CrtButton tone="amber" disabled={!pick} onClick={() => pin(pick)}>
            {tr("Pin")}
          </CrtButton>
          {!writing && (
            <CrtButton tone="cyan" onClick={() => setWriting(true)}>
              {tr("Write a note here")}
            </CrtButton>
          )}
        </div>
      )}
      {full && <p className="text-white/45">{tr("This board is full.")}</p>}
      {writing && !full && (
        <MemoEditor
          compact
          submitLabel={tr("Pin note")}
          onCancel={() => setWriting(false)}
          onSave={(m) => {
            const r = api.act((st) =>
              addMemo(st, { title: m.title, text: m.text, tags: m.tags, place }),
            );
            if (!r.ok) {
              api.toast(r.message, "warn");
              return false;
            }
            api.sound?.("ui_click");
            api.toast(tr("Pinned — {title}", { title: r.memo.title }), "good");
            setWriting(false);
            return true;
          }}
        />
      )}
    </section>
  );
}

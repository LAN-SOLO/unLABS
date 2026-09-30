"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, INPUT_CLASS, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { AppWindow, Muted, stopKeys } from "@/components/world/pc/common";
import { TAG_DIARY, clock } from "@/components/world/pc/sources";
import { MEMO_TEXT_MAX, addMemo, memosIn } from "@/lib/world/memos";

/** JadeOS "Notes to self": a quick diary; entries are memos in the `diary` folder. */
export function NotesApp({ api }: { api: WorldApi }) {
  const s = api.get();
  const [text, setText] = useState("");
  const diary = memosIn(s, "pc").filter((m) => m.tags?.includes(TAG_DIARY));
  const write = () => {
    const body = text.trim();
    if (!body) return;
    const r = api.act((st) =>
      addMemo(st, {
        title: tr("Diary — {time}", { time: clock(st.playTime) }),
        text: body,
        place: "pc",
        source: { kind: "custom" },
        tags: [TAG_DIARY],
      }),
    );
    if (r.ok) {
      setText("");
      api.sound?.("typing");
    } else api.toast(r.message, "warn");
  };
  return (
    <AppWindow title={tr("pc::Notes to self")} right={tr("{n} entries", { n: diary.length })}>
      <div className="space-y-2">
        <textarea
          value={text}
          rows={4}
          maxLength={MEMO_TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            stopKeys(e);
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              write();
            }
          }}
          placeholder={tr("Dear diary, today the lab …")}
          aria-label={tr("New diary entry")}
          className={`${INPUT_CLASS} block w-full resize-y`}
        />
        <div className="flex items-center justify-between gap-2">
          <Muted>{tr("Ctrl+Enter saves. Entries land in the diary folder of Files.")}</Muted>
          <CrtButton onClick={write} disabled={!text.trim()}>
            {tr("pc::Write down")}
          </CrtButton>
        </div>
        {diary.length === 0 && (
          <Muted>{tr("No entries yet. The MCP promises not to read them. Formally.")}</Muted>
        )}
        <ul className="space-y-1">
          {diary.slice(0, 12).map((m) => (
            <li key={m.id} className="rounded-sm border border-white/10 px-2 py-1">
              <p className="text-[10px] text-white/35">{clock(m.t)}</p>
              <p className="text-[11px] whitespace-pre-wrap" style={{ color: UI.text }}>
                {m.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </AppWindow>
  );
}

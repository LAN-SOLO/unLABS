"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, INPUT_CLASS, UI } from "@/components/world/ui";
import { MEMO_TEXT_MAX, MEMO_TITLE_MAX, parseTags } from "@/lib/world/memos";
import type { Memo, MemoSourceKind } from "@/lib/world/types";

/** Keys typed into a memo field never reach the world hotkeys (Esc still closes). */
export function keepKeys(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Escape") e.stopPropagation();
}

export const SOURCE_LABEL: Readonly<Record<MemoSourceKind, string>> = {
  archive: tr("memo::Archive"),
  insight: tr("memo::Insight"),
  readout: tr("memo::Readout"),
  recipe: tr("memo::Recipe"),
  note: tr("memo::Note"),
  log: tr("memo::Log"),
  puzzle: tr("memo::Puzzle"),
  device: tr("memo::Device"),
  course: tr("memo::Course"),
  experiment: tr("memo::Experiment"),
  message: tr("memo::Message"),
  custom: tr("memo::Own note"),
};

/** mm:ss play time. */
export function clock(t: number): string {
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

/** One memo, readable; actions go into `children`. */
export function MemoCard({
  memo,
  where,
  children,
  paper = false,
}: {
  memo: Memo;
  /** Place label (omitted on a board). */
  where?: string;
  children?: ReactNode;
  /** Pinned look (on a board). */
  paper?: boolean;
}) {
  return (
    <article
      data-memo={memo.id}
      className="rounded-sm border p-2 text-xs"
      style={
        paper
          ? { borderColor: `${UI.amber}55`, background: "#FFB8000a" }
          : { borderColor: "#ffffff1a" }
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="min-w-0 truncate text-[#FFB800]">{memo.title}</h4>
        <span className="shrink-0 text-[9px] text-white/35">
          {memo.source ? SOURCE_LABEL[memo.source.kind] : SOURCE_LABEL.custom} · {clock(memo.t)}
        </span>
      </div>
      {memo.text && <p className="mt-0.5 whitespace-pre-line text-[#d8ffd8]/80">{memo.text}</p>}
      {(memo.tags?.length || where) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px]">
          {memo.tags?.map((t) => (
            <span key={t} className="rounded-sm border border-[#00FFFF]/30 px-1 text-[#00FFFF]/80">
              #{t}
            </span>
          ))}
          {where && <span className="ml-auto text-white/40">{where}</span>}
        </div>
      )}
      {children && <div className="mt-1.5 flex flex-wrap gap-1">{children}</div>}
    </article>
  );
}

/** Small action button inside a memo card. */
export function MemoAction({
  onClick,
  children,
  tone = "green",
  disabled,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "green" | "amber" | "cyan" | "red";
  disabled?: boolean;
  label?: string;
}) {
  return (
    <CrtButton
      tone={tone}
      className="!px-1.5 !py-0 !text-[9px]"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </CrtButton>
  );
}

/** Title / text / tags form for writing or editing a memo. */
export function MemoEditor({
  initial,
  submitLabel,
  onSave,
  onCancel,
  compact = false,
}: {
  initial?: { title: string; text: string; tags?: readonly string[] };
  submitLabel: string;
  onSave: (m: { title: string; text: string; tags: string[] }) => boolean;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const empty = !title.trim() && !text.trim();
  const save = () => {
    if (empty) return;
    if (onSave({ title, text, tags: parseTags(tags) }) && !initial) {
      setTitle("");
      setText("");
      setTags("");
    }
  };
  return (
    <div className="space-y-1" data-memo-editor>
      <input
        className={`${INPUT_CLASS} w-full`}
        value={title}
        maxLength={MEMO_TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={keepKeys}
        placeholder={tr("Title")}
        aria-label={tr("Memo title")}
      />
      <textarea
        className={`${INPUT_CLASS} block w-full resize-y`}
        rows={compact ? 2 : 3}
        value={text}
        maxLength={MEMO_TEXT_MAX}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          keepKeys(e);
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
        }}
        placeholder={tr("What do you want to remember?")}
        aria-label={tr("Memo text")}
      />
      {!compact && (
        <input
          className={`${INPUT_CLASS} w-full`}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onKeyDown={keepKeys}
          placeholder={tr("tags, comma separated")}
          aria-label={tr("Memo tags")}
        />
      )}
      <div className="flex items-center gap-2">
        <CrtButton tone="amber" disabled={empty} onClick={save}>
          {submitLabel}
        </CrtButton>
        {onCancel && (
          <CrtButton tone="green" onClick={onCancel}>
            {tr("Cancel")}
          </CrtButton>
        )}
        <span className="ml-auto text-[9px] text-white/30">
          {text.length}/{MEMO_TEXT_MAX}
        </span>
      </div>
    </div>
  );
}

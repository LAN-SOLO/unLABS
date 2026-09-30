"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, FOCUS_RING, INPUT_CLASS, SearchField, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { AppWindow, Muted, stopKeys } from "@/components/world/pc/common";
import {
  clock,
  importSource,
  importSources,
  parseTags,
  pcFolders,
} from "@/components/world/pc/sources";
import {
  MEMO_TEXT_MAX,
  MEMO_TITLE_MAX,
  addMemo,
  deleteMemo,
  editMemo,
  memosIn,
  moveMemo,
} from "@/lib/world/memos";
import type { Memo } from "@/lib/world/types";

type Folder =
  | { kind: "all" }
  | { kind: "untagged" }
  | { kind: "tag"; tag: string }
  | { kind: "mind" }
  | { kind: "import" };

const same = (a: Folder, b: Folder): boolean =>
  a.kind === b.kind && (a.kind !== "tag" || (b.kind === "tag" && a.tag === b.tag));

function FolderButton({
  active,
  onClick,
  children,
  n,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
  n?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-2 rounded-sm px-2 py-0.5 text-left text-[11px] ${FOCUS_RING} ${
        active ? "bg-[#00FFFF]/15 text-[#00FFFF]" : "text-[#33FF33]/70 hover:bg-white/5"
      }`}
    >
      <span className="truncate">{children}</span>
      {n !== undefined && <span className="text-white/35">{n}</span>}
    </button>
  );
}

function Editor({ api, memo, onGone }: { api: WorldApi; memo: Memo; onGone: () => void }) {
  const [title, setTitle] = useState(memo.title);
  const [text, setText] = useState(memo.text);
  const [tags, setTags] = useState((memo.tags ?? []).join(", "));
  const [confirm, setConfirm] = useState(false);
  const dirty = title !== memo.title || text !== memo.text || tags !== (memo.tags ?? []).join(", ");
  const save = () => {
    const list = parseTags(tags);
    api.act((s) => editMemo(s, memo.id, { title, text, tags: list }));
    setTags(list.join(", "));
    setTitle(memo.title);
    api.sound?.("typing");
    api.toast(tr("Saved on the computer."), "good");
  };
  return (
    <div className="space-y-2" data-memo-editor={memo.id}>
      <label className="block text-[10px] tracking-widest text-white/45 uppercase">
        {tr("pc::Title")}
        <input
          value={title}
          maxLength={MEMO_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={stopKeys}
          className={`${INPUT_CLASS} mt-0.5 block w-full normal-case`}
        />
      </label>
      <label className="block text-[10px] tracking-widest text-white/45 uppercase">
        {tr("pc::Text")}
        <textarea
          value={text}
          maxLength={MEMO_TEXT_MAX}
          rows={7}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={stopKeys}
          className={`${INPUT_CLASS} mt-0.5 block w-full resize-y normal-case`}
        />
      </label>
      <label className="block text-[10px] tracking-widest text-white/45 uppercase">
        {tr("Folders (comma-separated)")}
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onKeyDown={stopKeys}
          className={`${INPUT_CLASS} mt-0.5 block w-full normal-case`}
        />
      </label>
      <Muted>{tr("Written at {time} play time.", { time: clock(memo.t) })}</Muted>
      <div className="flex flex-wrap gap-2">
        <CrtButton onClick={save} disabled={!dirty}>
          {tr("Save")}
        </CrtButton>
        <CrtButton
          tone="amber"
          onClick={() => {
            api.act((s) => moveMemo(s, memo.id, "mind"));
            api.toast(tr("Back in your head."), "info");
            onGone();
          }}
        >
          {tr("pc::Take along")}
        </CrtButton>
        <CrtButton
          tone="red"
          onClick={() => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            api.act((s) => deleteMemo(s, memo.id));
            api.sound?.("page_turn");
            onGone();
          }}
        >
          {confirm ? tr("Really delete?") : tr("Delete")}
        </CrtButton>
      </div>
    </div>
  );
}

/** JadeOS "Files": memos filed on her computer, folders by tag, imports from her knowledge. */
export function FilesApp({ api }: { api: WorldApi }) {
  const s = api.get();
  const [folder, setFolder] = useState<Folder>({ kind: "all" });
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const pc = memosIn(s, "pc");
  const mind = memosIn(s, "mind");
  const folders = pcFolders(pc);
  const sources = importSources(s);
  const k = q.trim().toLowerCase();
  const match = (m: Memo) =>
    !k || `${m.title} ${m.text} ${(m.tags ?? []).join(" ")}`.toLowerCase().includes(k);
  const list =
    folder.kind === "all"
      ? pc
      : folder.kind === "untagged"
        ? pc.filter((m) => !m.tags?.length)
        : folder.kind === "tag"
          ? pc.filter((m) => m.tags?.includes(folder.tag))
          : [];
  const open = sel ? pc.find((m) => m.id === sel) : undefined;
  const pick = (f: Folder) => {
    setFolder(f);
    setSel(null);
  };
  const create = () => {
    const tag = folder.kind === "tag" ? [folder.tag] : [];
    const r = api.act((st) =>
      addMemo(st, {
        title: tr("pc::New memo"),
        text: "",
        place: "pc",
        source: { kind: "custom" },
        tags: tag,
      }),
    );
    if (r.ok) {
      if (folder.kind !== "tag") setFolder({ kind: "all" });
      setSel(r.memo.id);
    } else api.toast(r.message, "warn");
  };

  return (
    <AppWindow title={tr("pc::Files")} right={tr("{n} memos on this machine", { n: pc.length })}>
      <div className="grid gap-3 md:grid-cols-[11rem_1fr]">
        <nav aria-label={tr("pc::Folders")} className="space-y-0.5">
          <FolderButton
            active={same(folder, { kind: "all" })}
            onClick={() => pick({ kind: "all" })}
            n={pc.length}
          >
            {tr("pc::All files")}
          </FolderButton>
          {folders.map((f) => (
            <FolderButton
              key={f.tag}
              active={same(folder, { kind: "tag", tag: f.tag })}
              onClick={() => pick({ kind: "tag", tag: f.tag })}
              n={f.n}
            >
              {`/${f.tag}`}
            </FolderButton>
          ))}
          <FolderButton
            active={same(folder, { kind: "untagged" })}
            onClick={() => pick({ kind: "untagged" })}
            n={pc.filter((m) => !m.tags?.length).length}
          >
            {tr("pc::Unsorted")}
          </FolderButton>
          <div className="my-1 border-t border-white/10" />
          <FolderButton
            active={same(folder, { kind: "mind" })}
            onClick={() => pick({ kind: "mind" })}
            n={mind.length}
          >
            {tr("pc::In your head")}
          </FolderButton>
          <FolderButton
            active={same(folder, { kind: "import" })}
            onClick={() => pick({ kind: "import" })}
            n={sources.length}
          >
            {tr("Import from knowledge")}
          </FolderButton>
          <div className="pt-2">
            <CrtButton onClick={create} className="w-full">
              {tr("pc::New memo")}
            </CrtButton>
          </div>
        </nav>

        <div className="min-w-0 space-y-2">
          {folder.kind === "mind" && (
            <>
              <Muted>{tr("What you carry in your head. File it here to free your mind.")}</Muted>
              {mind.length === 0 && <Muted>{tr("Nothing on your mind. Enviable.")}</Muted>}
              <ul className="space-y-1">
                {mind.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-2 rounded-sm border border-white/10 px-2 py-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-[#d8ffd8]">{m.title}</p>
                      <p className="line-clamp-2 text-[11px] text-white/45">{m.text}</p>
                    </div>
                    <CrtButton
                      className="shrink-0"
                      onClick={() => {
                        api.act((st) => moveMemo(st, m.id, "pc"));
                        api.toast(tr("Filed on the computer."), "good");
                      }}
                    >
                      {tr("pc::File")}
                    </CrtButton>
                  </li>
                ))}
              </ul>
            </>
          )}

          {folder.kind === "import" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <Muted>
                  {tr("Insights, archive finds, readouts and courses not yet on file.")}
                </Muted>
                <CrtButton
                  disabled={!sources.length}
                  onClick={() => {
                    const n = api.act((st) =>
                      importSources(st).reduce((a, x) => a + (importSource(st, x) ? 1 : 0), 0),
                    );
                    api.toast(tr("{n} memos imported.", { n }), "good");
                  }}
                >
                  {tr("Import all")}
                </CrtButton>
              </div>
              {sources.length === 0 && (
                <Muted>{tr("Everything you know is already on file.")}</Muted>
              )}
              <ul className="space-y-1">
                {sources.slice(0, 40).map((x) => (
                  <li
                    key={`${x.kind}:${x.id}`}
                    className="flex items-center justify-between gap-2 rounded-sm border border-white/10 px-2 py-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-[#d8ffd8]">{x.title}</p>
                      <p className="text-[10px] text-white/35">{`/${x.tag}`}</p>
                    </div>
                    <CrtButton
                      className="shrink-0"
                      onClick={() => {
                        api.act((st) => importSource(st, x));
                        api.sound?.("typing");
                      }}
                    >
                      {tr("Import")}
                    </CrtButton>
                  </li>
                ))}
              </ul>
              {sources.length > 40 && (
                <Muted>{tr("… and {n} more.", { n: sources.length - 40 })}</Muted>
              )}
            </>
          )}

          {folder.kind !== "mind" && folder.kind !== "import" && (
            <>
              {open ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSel(null)}
                    className={`text-[11px] text-[#00FFFF]/80 hover:text-[#00FFFF] ${FOCUS_RING}`}
                  >
                    {tr("← back to the list")}
                  </button>
                  <Editor key={open.id} api={api} memo={open} onGone={() => setSel(null)} />
                </>
              ) : (
                <>
                  <SearchField
                    value={q}
                    onChange={setQ}
                    label={tr("Search files")}
                    className="w-full"
                  />
                  {list.filter(match).length === 0 && (
                    <Muted>
                      {pc.length
                        ? tr("No file matches.")
                        : tr("The disk is empty. Write something, or import what you know.")}
                    </Muted>
                  )}
                  <ul className="space-y-1">
                    {list.filter(match).map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setSel(m.id)}
                          className={`block w-full rounded-sm border border-white/10 px-2 py-1 text-left hover:border-[#00FFFF]/40 ${FOCUS_RING}`}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-xs" style={{ color: UI.text }}>
                              {m.title}
                            </span>
                            <span className="shrink-0 text-[10px] text-white/30">{clock(m.t)}</span>
                          </span>
                          <span className="line-clamp-1 text-[11px] text-white/45">{m.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppWindow>
  );
}

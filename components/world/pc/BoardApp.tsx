"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, INPUT_CLASS, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { LabNotice, ageLabel, callLab, keepKeys, useDesktop } from "@/components/world/pc/MailApp";
import { deletePost, listBoard, postBoard, reportPost } from "@/app/(game)/actions/labMessages";
import {
  LAB_POST_MAX,
  isDraftError,
  remaining,
  validatePost,
  type LabClientError,
  type LabPostView,
} from "@/lib/game/labMessages";

/** The public lab board: short posts every player can read. */
export function BoardApp({ api }: { api: WorldApi }) {
  const desktop = useDesktop();
  const [posts, setPosts] = useState<LabPostView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LabClientError | null>(desktop ? "desktop" : null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; what: "delete" | "report" } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  const ids = useId();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (desktop) return;
    setLoading(true);
    const r = await callLab(listBoard);
    if (!alive.current) return;
    setLoading(false);
    setNow(Date.now());
    if (r.ok) {
      setPosts(r.data.posts);
      setError(null);
    } else setError(r.error);
  }, [desktop]);

  useEffect(() => {
    // Deferred a tick: no synchronous setState inside the effect.
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const post = async () => {
    if (desktop) {
      setError("desktop");
      return;
    }
    const v = validatePost(text);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setPosting(true);
    const r = await callLab(() => postBoard(v.value));
    if (!alive.current) return;
    setPosting(false);
    if (!r.ok) {
      setError(r.error);
      api.sound?.("fail_buzz");
      return;
    }
    setText("");
    setError(null);
    api.sound?.("page_turn");
    api.toast(tr("Pinned to the lab board."), "good");
    void load();
  };

  const act = async (p: LabPostView, what: "delete" | "report") => {
    if (confirm?.id !== p.id || confirm.what !== what) {
      setConfirm({ id: p.id, what });
      return;
    }
    setConfirm(null);
    if (what === "delete") {
      const r = await callLab(() => deletePost(p.id));
      if (!alive.current) return;
      if (!r.ok && r.error !== "not_found") {
        setError(r.error);
        return;
      }
      setPosts((ps) => ps?.filter((x) => x.id !== p.id) ?? null);
      api.toast(tr("Post removed."), "info");
    } else {
      const r = await callLab(() => reportPost(p.id));
      if (!alive.current) return;
      if (!r.ok && r.error !== "already_reported") {
        setError(r.error);
        return;
      }
      const hidden = r.ok && r.data.hidden;
      setPosts(
        (ps) =>
          ps
            ?.filter((x) => !(hidden && x.id === p.id))
            .map((x) => (x.id === p.id ? { ...x, reportedByMe: true } : x)) ?? null,
      );
      api.toast(tr("Reported. The moderation bot has been notified."), "info");
    }
  };

  const left = remaining(text.trim(), LAB_POST_MAX);

  return (
    <div className="flex min-h-0 flex-col gap-2 text-[12px]" style={{ color: UI.text }}>
      <SectionTitle
        right={
          !desktop && (
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="tracking-wider text-[#33FF33]/60 uppercase hover:text-[#33FF33] disabled:opacity-40"
            >
              {loading ? tr("Loading …") : tr("Refresh")}
            </button>
          )
        }
      >
        {tr("Lab board")}
      </SectionTitle>
      <p className="text-[10px] text-white/40">
        {tr("Public notes from researchers in every lab. Posts fade after 30 days.")}
      </p>

      {error && (
        <LabNotice
          code={error}
          onRetry={!desktop && !isDraftError(error) ? () => void load() : undefined}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${ids}-post`} className="flex justify-between text-[10px] text-white/50">
          <span>{tr("New post")}</span>
          <span style={{ color: left < 0 ? UI.red : left < 20 ? UI.amber : undefined }}>
            {left}
          </span>
        </label>
        <textarea
          id={`${ids}-post`}
          className={`${INPUT_CLASS} resize-none`}
          rows={3}
          value={text}
          placeholder={tr("Found something worth sharing? Keep it short.")}
          onKeyDown={keepKeys}
          onChange={(e) => {
            setText(e.target.value);
            if (error && isDraftError(error)) setError(null);
          }}
        />
        <div>
          <CrtButton tone="cyan" onClick={() => void post()} disabled={posting || desktop}>
            {posting ? tr("Posting …") : tr("Post")}
          </CrtButton>
        </div>
      </div>

      {!desktop &&
        (posts === null ? (
          loading && <p className="text-white/45">{tr("Loading …")}</p>
        ) : posts.length === 0 ? (
          <p className="text-white/45">
            {tr("The board is empty. Be the first to pin something.")}
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {posts.map((p) => (
              <li
                key={p.id}
                className="rounded-sm border bg-black/30 px-2 py-1"
                style={{ borderColor: p.mine ? `${UI.amber}40` : "rgba(51,255,51,0.15)" }}
              >
                <div className="flex items-baseline gap-2 text-[10px] text-white/50">
                  <span style={{ color: p.mine ? UI.amber : UI.green }}>
                    {p.mine ? tr("{name} (you)", { name: p.author }) : p.author}
                  </span>
                  <span>{ageLabel(p.createdAt, now)}</span>
                  {p.hidden && <span style={{ color: UI.red }}>{tr("hidden after reports")}</span>}
                  <span className="ml-auto flex gap-2">
                    {p.mine ? (
                      <button
                        type="button"
                        className="text-red-400/70 hover:text-red-400"
                        onClick={() => void act(p, "delete")}
                      >
                        {confirm?.id === p.id && confirm.what === "delete"
                          ? tr("Really delete?")
                          : tr("Delete")}
                      </button>
                    ) : p.reportedByMe ? (
                      <span className="text-white/35">{tr("reported")}</span>
                    ) : (
                      <button
                        type="button"
                        className="text-white/40 hover:text-red-400"
                        onClick={() => void act(p, "report")}
                      >
                        {confirm?.id === p.id && confirm.what === "report"
                          ? tr("Really report?")
                          : tr("Report")}
                      </button>
                    )}
                  </span>
                </div>
                <p className="break-words whitespace-pre-wrap">{p.body}</p>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

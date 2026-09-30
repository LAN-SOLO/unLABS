"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { tr } from "@/lib/i18n";
import { CrtButton, FilterChip, INPUT_CLASS, SectionTitle, UI } from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { isDesktopApp } from "@/lib/desktop";
import { addMemo } from "@/lib/world/memos";
import {
  deleteMessage,
  listInbox,
  listSent,
  markRead,
  sendMessage,
} from "@/app/(game)/actions/labMessages";
import {
  LAB_BODY_MAX,
  LAB_SUBJECT_MAX,
  appendAttachment,
  excerpt,
  isDraftError,
  messageAge,
  quoteReply,
  remaining,
  replySubject,
  validateMessage,
  type LabClientError,
  type LabMessageView,
  type LabResult,
} from "@/lib/game/labMessages";

// ── Shared with BoardApp ──────────────────────────────────────────────

/** Player-facing text for a lab-network error code. */
export function labErrorText(code: LabClientError): string {
  switch (code) {
    case "not_authenticated":
    case "unauthorized":
      return tr("You are not logged in. The lab network only talks to signed-in researchers.");
    case "desktop":
      return tr("Messaging needs the online version of the lab. Drafts stay on this machine.");
    case "offline":
      return tr("No connection to the lab network. Your text is kept — try again later.");
    case "recipient_required":
      return tr("Who is this for? Enter a username.");
    case "recipient_not_found":
      return tr("No researcher with that username.");
    case "self_message":
      return tr("Writing to yourself? That is what memos are for.");
    case "empty_subject":
      return tr("A subject, please. Even a short one.");
    case "subject_too_long":
      return tr("The subject is too long.");
    case "empty_body":
      return tr("An empty message says nothing. Write something.");
    case "body_too_long":
      return tr("Too long — trim it down a little.");
    case "rate_limited":
      return tr("Slow down. The relay needs a breather — try again in a moment.");
    case "daily_limit":
      return tr("Daily limit reached. The relay resets in 24 hours.");
    case "not_found":
      return tr("That entry no longer exists.");
    case "not_author":
      return tr("Only the author can remove that.");
    case "own_post":
      return tr("You cannot report your own post.");
    case "already_reported":
      return tr("You already reported that.");
    case "invalid_id":
    case "read_failed":
    case "rpc_failed":
    case "rpc_no_row":
      return tr("The lab network hiccuped. Try again.");
  }
}

/** "3 min ago" style label. */
export function ageLabel(iso: string, nowMs: number): string {
  const a = messageAge(iso, nowMs);
  switch (a.unit) {
    case "now":
      return tr("just now");
    case "min":
      return tr("{n} min ago", { n: a.n });
    case "h":
      return tr("{n} h ago", { n: a.n });
    case "d":
      return a.n === 1 ? tr("1 day ago") : tr("{n} days ago", { n: a.n });
  }
}

/** Keys typed into a text field never reach the world hotkeys (Esc still closes). */
export function keepKeys(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Escape") e.stopPropagation();
}

/** Call a server action; a thrown call (network, server down) becomes "offline". */
export async function callLab<T>(
  fn: () => Promise<LabResult<T>>,
): Promise<LabResult<T> | { ok: false; error: "offline" }> {
  try {
    return await fn();
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** Status line for errors / notices. */
export function LabNotice({ code, onRetry }: { code: LabClientError; onRetry?: () => void }) {
  const tone =
    code === "desktop" || code === "not_authenticated" || code === "offline" ? UI.amber : UI.red;
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-2 rounded-sm border px-2 py-1 text-[11px]"
      style={{ borderColor: `${tone}66`, color: tone, background: `${tone}10` }}
    >
      <span>{labErrorText(code)}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 underline hover:no-underline">
          {tr("Retry")}
        </button>
      )}
    </div>
  );
}

export function useDesktop(): boolean {
  const [desktop] = useState(() => isDesktopApp());
  return desktop;
}

// ── Drafts (per-viewer convenience, browser storage) ─────────────────

interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  savedAt: number;
}

const DRAFTS_KEY = "unlabs.pc.mail.drafts.v1";
const DRAFTS_MAX = 20;

function readDrafts(): Draft[] {
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (d): d is Draft =>
          typeof d === "object" &&
          d !== null &&
          typeof (d as Draft).id === "string" &&
          typeof (d as Draft).to === "string" &&
          typeof (d as Draft).subject === "string" &&
          typeof (d as Draft).body === "string" &&
          typeof (d as Draft).savedAt === "number",
      )
      .slice(0, DRAFTS_MAX);
  } catch {
    return [];
  }
}

function writeDrafts(drafts: Draft[]): void {
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.slice(0, DRAFTS_MAX)));
  } catch {
    /* storage unavailable — drafts live in memory only */
  }
}

// ── Mail app ──────────────────────────────────────────────────────────

type View = "inbox" | "sent" | "compose" | "drafts";

interface Box {
  messages: LabMessageView[];
  unread: number;
}

const EMPTY = { to: "", subject: "", body: "" };

/** Messages to other players (inbox, sent, compose). Backend: app/(game)/actions/labMessages.ts. */
export function MailApp({ api }: { api: WorldApi }) {
  const desktop = useDesktop();
  const [view, setView] = useState<View>(desktop ? "drafts" : "inbox");
  const [boxes, setBoxes] = useState<Partial<Record<"inbox" | "sent", Box>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LabClientError | null>(desktop ? "desktop" : null);
  const [open, setOpen] = useState<LabMessageView | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>(readDrafts);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  const ids = useId();

  useEffect(() => {
    alive.current = true;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      alive.current = false;
      window.clearInterval(t);
    };
  }, []);

  const load = useCallback(
    async (box: "inbox" | "sent") => {
      if (desktop) return;
      setLoading(true);
      const r = await callLab(box === "inbox" ? listInbox : listSent);
      if (!alive.current) return;
      setLoading(false);
      setNow(Date.now());
      if (r.ok) {
        setBoxes((b) => ({ ...b, [box]: r.data }));
        setError(null);
      } else setError(r.error);
    },
    [desktop],
  );

  useEffect(() => {
    if (view !== "inbox" && view !== "sent") return;
    // Deferred a tick: no synchronous setState inside the effect.
    const t = window.setTimeout(() => void load(view), 0);
    return () => window.clearTimeout(t);
  }, [view, load]);

  const unread = boxes.inbox?.unread ?? 0;

  const openMessage = (m: LabMessageView) => {
    setOpen(m);
    setConfirmDelete(null);
    api.sound?.("ui_click");
    if (m.outgoing || m.read) return;
    // Optimistic: mark read locally, then tell the server.
    setBoxes((b) => {
      const inbox = b.inbox;
      if (!inbox) return b;
      return {
        ...b,
        inbox: {
          messages: inbox.messages.map((x) => (x.id === m.id ? { ...x, read: true } : x)),
          unread: Math.max(0, inbox.unread - 1),
        },
      };
    });
    void callLab(() => markRead(m.id));
  };

  const remove = async (m: LabMessageView) => {
    if (confirmDelete !== m.id) {
      setConfirmDelete(m.id);
      return;
    }
    setConfirmDelete(null);
    const r = await callLab(() => deleteMessage(m.id));
    if (!alive.current) return;
    if (!r.ok && r.error !== "not_found") {
      setError(r.error);
      return;
    }
    const box = m.outgoing ? "sent" : "inbox";
    setBoxes((b) => {
      const cur = b[box];
      if (!cur) return b;
      return {
        ...b,
        [box]: {
          messages: cur.messages.filter((x) => x.id !== m.id),
          unread: cur.unread - (!m.read && !m.outgoing ? 1 : 0),
        },
      };
    });
    setOpen(null);
    api.toast(tr("Message deleted."), "info");
  };

  const reply = (m: LabMessageView) => {
    setDraft({
      to: m.outgoing ? m.to : m.from,
      subject: replySubject(m.subject),
      body: quoteReply(m.body, tr("{name} wrote:", { name: m.outgoing ? tr("You") : m.from })),
    });
    setDraftId(null);
    setOpen(null);
    setView("compose");
  };

  const fileToPc = (m: LabMessageView) => {
    const r = api.act((s) =>
      addMemo(s, {
        title: m.subject,
        text: m.outgoing
          ? tr("To {name}: {text}", { name: m.to, text: m.body })
          : tr("From {name}: {text}", { name: m.from, text: m.body }),
        place: "pc",
        source: { kind: "message", id: m.id },
        tags: ["mail"],
      }),
    );
    if (r.ok) {
      api.sound?.("page_turn");
      api.toast(tr("Filed on the computer."), "good");
    } else api.toast(r.message, "warn");
  };

  const saveDraft = (quiet = false) => {
    if (!draft.to.trim() && !draft.subject.trim() && !draft.body.trim()) return;
    const id = draftId ?? `d${Date.now().toString(36)}`;
    const next = [
      { id, ...draft, savedAt: Date.now() },
      ...drafts.filter((d) => d.id !== id),
    ].slice(0, DRAFTS_MAX);
    setDraftId(id);
    setDrafts(next);
    writeDrafts(next);
    if (!quiet) api.toast(tr("Draft saved."), "info");
  };

  const dropDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    writeDrafts(next);
    if (draftId === id) setDraftId(null);
  };

  const send = async () => {
    if (desktop) {
      setError("desktop");
      saveDraft(true);
      return;
    }
    const v = validateMessage(draft);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    setSending(true);
    const r = await callLab(() => sendMessage(v.value.to, v.value.subject, v.value.body));
    if (!alive.current) return;
    setSending(false);
    if (!r.ok) {
      setError(r.error);
      if (!isDraftError(r.error)) saveDraft(true);
      api.sound?.("fail_buzz");
      return;
    }
    if (draftId) dropDraft(draftId);
    setDraft(EMPTY);
    setDraftId(null);
    setError(null);
    api.sound?.("typing");
    api.toast(tr("Message sent to {name}.", { name: v.value.to }), "good");
    setView("sent");
  };

  const memos = api.get().memos.filter((m) => m.place === "mind" || m.place === "pc");
  const attach = (memoId: string) => {
    const m = memos.find((x) => x.id === memoId);
    if (!m) return;
    const next = appendAttachment(draft.body, m.title, m.text);
    if (next === null) {
      api.toast(tr("That memo does not fit into the message any more."), "warn");
      return;
    }
    setDraft((d) => ({ ...d, body: next }));
  };

  const tab = (v: View) => {
    setView(v);
    setOpen(null);
    setConfirmDelete(null);
    if (!desktop && error !== null && !isDraftError(error)) setError(null);
  };

  // ── render ──

  const list = view === "inbox" || view === "sent" ? boxes[view] : undefined;

  return (
    <div className="flex min-h-0 flex-col gap-2 text-[12px]" style={{ color: UI.text }}>
      <div role="tablist" aria-label={tr("Mailbox")} className="flex flex-wrap gap-1">
        {!desktop && (
          <>
            <FilterChip
              active={view === "inbox"}
              onClick={() => tab("inbox")}
              count={unread || undefined}
            >
              {tr("Inbox")}
            </FilterChip>
            <FilterChip active={view === "sent"} onClick={() => tab("sent")}>
              {tr("mail::Sent")}
            </FilterChip>
          </>
        )}
        <FilterChip active={view === "compose"} onClick={() => tab("compose")} accent={UI.cyan}>
          {tr("Compose")}
        </FilterChip>
        <FilterChip
          active={view === "drafts"}
          onClick={() => tab("drafts")}
          count={drafts.length || undefined}
        >
          {tr("Drafts")}
        </FilterChip>
        {(view === "inbox" || view === "sent") && !open && (
          <button
            type="button"
            onClick={() => void load(view)}
            disabled={loading}
            className="ml-auto text-[10px] tracking-wider text-[#33FF33]/60 uppercase hover:text-[#33FF33] disabled:opacity-40"
          >
            {loading ? tr("Loading …") : tr("Refresh")}
          </button>
        )}
      </div>

      {error && (
        <LabNotice
          code={error}
          onRetry={
            (view === "inbox" || view === "sent") && !desktop && !isDraftError(error)
              ? () => void load(view)
              : undefined
          }
        />
      )}

      {open ? (
        <article className="flex flex-col gap-2 rounded-sm border border-[#33FF33]/20 bg-black/30 p-2">
          <header className="flex flex-col gap-0.5 border-b border-[#33FF33]/15 pb-1">
            <h4 className="text-[13px]" style={{ color: UI.amber }}>
              {open.subject}
            </h4>
            <span className="text-[10px] text-white/50">
              {open.outgoing
                ? tr("To {name} · {age}", { name: open.to, age: ageLabel(open.createdAt, now) })
                : tr("From {name} · {age}", {
                    name: open.from,
                    age: ageLabel(open.createdAt, now),
                  })}
            </span>
          </header>
          <p className="max-h-72 overflow-y-auto break-words whitespace-pre-wrap">{open.body}</p>
          <div className="flex flex-wrap gap-2">
            <CrtButton onClick={() => setOpen(null)}>{tr("Back")}</CrtButton>
            <CrtButton tone="cyan" onClick={() => reply(open)}>
              {tr("Reply")}
            </CrtButton>
            <CrtButton tone="amber" onClick={() => fileToPc(open)}>
              {tr("File on PC")}
            </CrtButton>
            <CrtButton tone="red" onClick={() => void remove(open)}>
              {confirmDelete === open.id ? tr("Really delete?") : tr("Delete")}
            </CrtButton>
          </div>
        </article>
      ) : view === "inbox" || view === "sent" ? (
        <MessageList
          messages={list?.messages}
          loading={loading}
          now={now}
          empty={
            view === "inbox"
              ? tr("No messages. The lab is quiet — suspiciously quiet.")
              : tr("Nothing sent yet.")
          }
          onOpen={openMessage}
        />
      ) : view === "compose" ? (
        <div className="flex flex-col gap-2">
          <SectionTitle accent={UI.cyan}>{tr("New message")}</SectionTitle>
          <label className="flex flex-col gap-0.5" htmlFor={`${ids}-to`}>
            <span className="text-[10px] text-white/50">{tr("To (username)")}</span>
            <input
              id={`${ids}-to`}
              className={INPUT_CLASS}
              value={draft.to}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              placeholder={tr("e.g. damien_f")}
              onKeyDown={keepKeys}
              onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5" htmlFor={`${ids}-subject`}>
            <span className="flex justify-between text-[10px] text-white/50">
              <span>{tr("Subject")}</span>
              <Counter left={remaining(draft.subject.trim(), LAB_SUBJECT_MAX)} />
            </span>
            <input
              id={`${ids}-subject`}
              className={INPUT_CLASS}
              value={draft.subject}
              maxLength={LAB_SUBJECT_MAX + 20}
              onKeyDown={keepKeys}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-0.5" htmlFor={`${ids}-body`}>
            <span className="flex justify-between text-[10px] text-white/50">
              <span>{tr("Message")}</span>
              <Counter left={remaining(draft.body.trim(), LAB_BODY_MAX)} />
            </span>
            <textarea
              id={`${ids}-body`}
              className={`${INPUT_CLASS} min-h-32 resize-y`}
              rows={8}
              value={draft.body}
              onKeyDown={keepKeys}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
          </label>
          {memos.length > 0 && (
            <label className="flex items-center gap-2" htmlFor={`${ids}-memo`}>
              <span className="text-[10px] text-white/50">{tr("Attach a memo")}</span>
              <select
                id={`${ids}-memo`}
                className={`${INPUT_CLASS} max-w-64 flex-1`}
                value=""
                onKeyDown={keepKeys}
                onChange={(e) => attach(e.target.value)}
              >
                <option value="">{tr("— choose —")}</option>
                {memos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <CrtButton tone="cyan" onClick={() => void send()} disabled={sending || desktop}>
              {sending ? tr("Sending …") : tr("Send")}
            </CrtButton>
            <CrtButton tone="amber" onClick={() => saveDraft()}>
              {tr("Save draft")}
            </CrtButton>
            <CrtButton
              tone="red"
              onClick={() => {
                setDraft(EMPTY);
                setDraftId(null);
                if (error && isDraftError(error)) setError(null);
              }}
            >
              {tr("Discard")}
            </CrtButton>
          </div>
          <p className="text-[10px] text-white/35">
            {tr("Messages go to real researchers. Be kind; the relay keeps a log.")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {drafts.length === 0 ? (
            <p className="text-white/45">
              {tr("No drafts. Unwritten thoughts are the tidiest kind.")}
            </p>
          ) : (
            drafts.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-2 rounded-sm border border-[#33FF33]/15 bg-black/30 px-2 py-1"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:text-white"
                  onClick={() => {
                    setDraft({ to: d.to, subject: d.subject, body: d.body });
                    setDraftId(d.id);
                    setView("compose");
                  }}
                >
                  <span className="block truncate" style={{ color: UI.amber }}>
                    {d.subject || tr("(no subject)")}
                  </span>
                  <span className="block truncate text-[10px] text-white/45">
                    {d.to ? tr("To {name}", { name: d.to }) : tr("(no recipient)")} ·{" "}
                    {excerpt(d.body, 40)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={tr("Delete draft")}
                  className="text-[10px] text-red-400/70 hover:text-red-400"
                  onClick={() => dropDraft(d.id)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Counter({ left }: { left: number }) {
  return (
    <span
      style={{ color: left < 0 ? UI.red : left < 20 ? UI.amber : undefined }}
      aria-live="polite"
    >
      {left}
    </span>
  );
}

function MessageList({
  messages,
  loading,
  now,
  empty,
  onOpen,
}: {
  messages: LabMessageView[] | undefined;
  loading: boolean;
  now: number;
  empty: string;
  onOpen: (m: LabMessageView) => void;
}) {
  if (!messages) return loading ? <p className="text-white/45">{tr("Loading …")}</p> : null;
  if (messages.length === 0) return <p className="text-white/45">{empty}</p>;
  return (
    <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
      {messages.map((m) => {
        const unread = !m.read && !m.outgoing;
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onOpen(m)}
              className="flex w-full items-baseline gap-2 rounded-sm border border-[#33FF33]/15 bg-black/30 px-2 py-1 text-left hover:border-[#33FF33]/40"
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: unread ? UI.cyan : "transparent" }}
              />
              <span className="w-24 shrink-0 truncate text-[11px] text-white/60">
                {m.outgoing ? tr("To {name}", { name: m.to }) : m.from}
              </span>
              <span
                className="min-w-0 flex-1 truncate"
                style={{ color: unread ? UI.ice : undefined }}
              >
                {unread && <span className="sr-only">{tr("Unread:")} </span>}
                {m.subject}
                <span className="ml-2 text-[10px] text-white/35">{excerpt(m.body, 40)}</span>
              </span>
              <span className="shrink-0 text-[10px] text-white/40">
                {ageLabel(m.createdAt, now)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

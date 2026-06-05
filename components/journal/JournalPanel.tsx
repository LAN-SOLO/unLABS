"use client";

/**
 * JournalPanel
 * ============
 *
 * Left-edge slide-out drawer rendering the _unOS journal. Exists so the
 * narrative breadcrumbs written by quests, missions, and the hint engine
 * have somewhere to live outside the scrolling terminal.
 *
 * Design:
 *   - Collapsed: narrow vertical strip with entry-count badge and a
 *     priority indicator (ERR/WARN pulse if any unread critical entries)
 *   - Expanded: scrolling list, newest first, colored by priority, with
 *     a filter chip for unit (all / hint / mission / voice / system)
 *   - Keyboard-accessible: `J` toggles open/close when no input is focused
 *
 * The `useJournalOptional()` path means this component renders nothing when
 * the provider is absent (e.g. in isolated dev routes), so it's safe to
 * mount at game-shell level.
 */

import { useEffect, useMemo, useState } from "react";

import { useJournalOptional } from "@/contexts/JournalProvider";
import type { JournalEntry } from "@/lib/unos/journal";

const FILTERS = [
  { id: "all", label: "ALL" },
  { id: "hint", label: "HINT" },
  { id: "mission", label: "MISS" },
  { id: "achievement", label: "ACHV" },
  { id: "voice", label: "VOICE" },
  { id: "session", label: "SYS" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function priorityColor(priority: number): string {
  if (priority <= 3) return "text-red-400";
  if (priority === 4) return "text-amber-300";
  if (priority === 5) return "text-green-300";
  if (priority === 6) return "text-green-500/80";
  return "text-gray-500";
}

function priorityLabel(priority: number): string {
  if (priority <= 2) return "CRIT";
  if (priority === 3) return "ERR";
  if (priority === 4) return "WARN";
  if (priority === 5) return "NOTE";
  if (priority === 6) return "INFO";
  return "DBG";
}

function unitMatchesFilter(unit: string, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "voice") return unit.startsWith("voice/");
  return unit === filter;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function JournalPanel() {
  const ctx = useJournalOptional();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");
  const [lastSeenVersion, setLastSeenVersion] = useState(0);

  // Keyboard shortcut: 'J' toggles the drawer unless a form element is focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "j" && e.key !== "J") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      const editable = (el as HTMLElement | null)?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;
      e.preventDefault();
      setIsOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const entries = useMemo<JournalEntry[]>(() => {
    if (!ctx) return [];
    // `version` in deps is intentional even though it's unused in the body —
    // bumping it forces recomputation when the journal mutates.
    return ctx.query({ tail: 100 }).reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, ctx?.version]);

  const filtered = useMemo(
    () => entries.filter((e) => unitMatchesFilter(e.unit, filter)),
    [entries, filter],
  );

  // Unread count drives the collapsed badge pulse.
  const unreadCount = ctx ? Math.max(0, ctx.version - lastSeenVersion) : 0;

  useEffect(() => {
    if (isOpen && ctx) setLastSeenVersion(ctx.version);
  }, [isOpen, ctx]);

  if (!ctx) return null;

  return (
    <aside
      aria-label="Journal"
      className={`pointer-events-auto fixed top-1/2 left-0 z-50 -translate-y-1/2 font-mono text-xs text-green-400 transition-all ${
        isOpen ? "w-[min(22rem,calc(100vw-2rem))]" : "w-8"
      }`}
    >
      {/* Toggle strip (always visible) */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="absolute top-1/2 right-0 flex h-32 w-8 -translate-y-1/2 flex-col items-center justify-between border border-green-500/50 bg-black/90 py-2 text-[10px] tracking-wider text-green-300 transition-colors hover:bg-green-500/10"
        aria-label={isOpen ? "Close journal" : "Open journal"}
      >
        <span className="[writing-mode:vertical-rl]">JOURNAL</span>
        {unreadCount > 0 && !isOpen && (
          <span className="rounded-full bg-amber-500/80 px-1 text-[9px] text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mr-8 flex h-[min(36rem,calc(100vh-6rem))] flex-col border border-green-500/60 bg-black/95 shadow-[0_0_30px_rgba(34,197,94,0.25)]">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-green-500/40 px-3 py-2">
            <span className="text-green-300">[ JOURNAL ]</span>
            <span className="text-[10px] text-gray-500">press J to toggle</span>
          </header>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1 border-b border-green-500/20 px-2 py-1">
            {FILTERS.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`border px-1.5 py-0.5 text-[10px] tracking-wider transition-colors ${
                  filter === f.id
                    ? "border-green-400/80 bg-green-500/20 text-green-200"
                    : "border-green-500/30 text-green-400/60 hover:bg-green-500/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Entries */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-gray-500">No entries.</p>
            ) : (
              <ul className="divide-y divide-green-500/10">
                {filtered.map((entry, i) => (
                  <li key={`${entry.timestamp}-${i}`} className="px-3 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-gray-500 tabular-nums">
                        {formatTime(entry.timestamp)}
                      </span>
                      <span
                        className={`rounded border px-1 text-[9px] tracking-wider ${priorityColor(entry.priority)} border-current/40`}
                      >
                        {priorityLabel(entry.priority)}
                      </span>
                    </div>
                    <p className="text-[10px] text-green-500/60">{entry.unit}</p>
                    <p
                      className={`break-words ${entry.unit.startsWith("voice/") ? "text-teal-300 italic" : "text-green-200"}`}
                    >
                      {entry.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <footer className="border-t border-green-500/40 px-3 py-1.5 text-[10px] text-gray-500">
            showing {filtered.length} / {entries.length} entries
          </footer>
        </div>
      )}
    </aside>
  );
}

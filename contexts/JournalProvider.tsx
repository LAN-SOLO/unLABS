"use client";

/**
 * JournalProvider
 * ===============
 *
 * Owns the _unOS Journal singleton for the game session. Previously the
 * Journal lived inside <Terminal/> as a useRef, which prevented non-terminal
 * UI (hint escalation, mission completion, JournalPanel) from appending
 * entries. Lifting it into a provider keeps a single instance while making
 * the entry log reactive for downstream UIs.
 *
 * The underlying Journal class is a mutable circular buffer — React won't
 * re-render on mutation. We track a `version` counter that the provider
 * bumps on every `write`, and expose it so consumers can `useMemo` on the
 * journal's contents without cloning the entire buffer every second.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Journal, type JournalEntry, type JournalQueryOptions } from "@/lib/unos/journal";
import { loadPanelState } from "@/lib/panel/panelState";

interface JournalContextValue {
  /** The singleton Journal instance. Use `entries`/`query()` for reads. */
  journal: Journal;
  /** Monotonic version bumped on every `write()`. */
  version: number;
  /** Append an entry and bump `version` so React consumers re-render. */
  write: (unit: string, priority: number, message: string, pid?: number) => void;
  /** Convenience wrapper; identical to `journal.query(opts)` but stable. */
  query: (opts?: JournalQueryOptions) => JournalEntry[];
}

const JournalContext = createContext<JournalContextValue | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const journalRef = useRef<Journal | null>(null);
  const [version, setVersion] = useState(0);

  // Lazy init from localStorage so SSR doesn't touch `window`. The panel
  // save is the only place journals are persisted today; if it's absent we
  // start a fresh session-scoped journal.
  if (!journalRef.current) {
    if (typeof window !== "undefined") {
      const saved = loadPanelState();
      journalRef.current = saved?.journal ? Journal.fromJSON(saved.journal) : new Journal();
    } else {
      journalRef.current = new Journal();
    }
  }

  // Boot narrative beat: one line per session so JournalPanel isn't empty
  // on first open.
  useEffect(() => {
    journalRef.current!.write("session", 6, "Operator session established.");
    setVersion((v) => v + 1);
  }, []);

  const write = useCallback((unit: string, priority: number, message: string, pid?: number) => {
    journalRef.current!.write(unit, priority, message, pid);
    setVersion((v) => v + 1);
  }, []);

  const query = useCallback((opts?: JournalQueryOptions) => {
    return journalRef.current!.query(opts);
  }, []);

  const value = useMemo<JournalContextValue>(
    () => ({ journal: journalRef.current!, version, write, query }),
    [version, write, query],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error("useJournal must be used inside <JournalProvider>");
  }
  return ctx;
}

/**
 * Optional variant that returns null when the provider is absent. Useful in
 * places (e.g. Terminal.tsx) that historically owned their own Journal and
 * may render outside the game shell during tests or isolated dev views.
 */
export function useJournalOptional(): JournalContextValue | null {
  return useContext(JournalContext);
}

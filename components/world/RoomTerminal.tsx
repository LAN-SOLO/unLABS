"use client";

/**
 * RoomTerminal — CRT overlay for the small room terminals.
 *
 * Green phosphor screen in a bezel, blinking block cursor, history (↑/↓,
 * kept per terminal for the browser session, `!!` / `!n`), Tab completion,
 * PageUp/PageDown scrolling, Ctrl+C / Ctrl+L, and typewriter output
 * (instant with reduceMotion or text speed "sofort"). Commands run through
 * the pure `terminal-lite` shell; their effects (harmless `terminal_*`
 * flags, device relays, codes) are applied inside `act` with the regular
 * game functions, so the world, the panels and the save stay in sync.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CrtButton } from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";
import { ROOM_TERMINAL_BY_ID } from "@/lib/world/content/terminals";
import { textCharsPerSecond, useSettings } from "@/lib/world/settings";
import {
  applyTerminalEffects,
  completeInput,
  expandHistory,
  runCommand,
  terminalBanner,
  terminalUsable,
} from "@/lib/world/terminal-lite";
import type { WorldState } from "@/lib/world/types";

type LineKind = "out" | "in" | "sys";

interface Line {
  id: number;
  text: string;
  kind: LineKind;
}

export interface RoomTerminalProps {
  terminalId: string;
  getState: () => WorldState;
  act: <T>(fn: (s: WorldState) => T) => T;
  onClose: () => void;
  /** `terminal` / `unos` command: hand over to the big terminal (/terminal). */
  onOpenBigTerminal: () => void;
}

const MAX_LINES = 400;
const HISTORY_MAX = 50;

function historyKey(terminalId: string): string {
  return `unlabs.terminal.history.${terminalId}`;
}

/** Arrow-key history (newest first) of a terminal from sessionStorage. */
function loadHistory(terminalId: string): string[] {
  try {
    const raw = sessionStorage.getItem(historyKey(terminalId));
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(terminalId: string, h: readonly string[]): void {
  try {
    sessionStorage.setItem(historyKey(terminalId), JSON.stringify(h));
  } catch {
    // Storage blocked — history just isn't kept.
  }
}

let lineSeq = 0;

function mk(text: string, kind: LineKind): Line {
  lineSeq += 1;
  return { id: lineSeq, text, kind };
}

function lineColor(l: Line): string {
  if (l.kind === "in") return "#FFB800";
  if (l.kind === "sys") return "#7CFF7C";
  if (l.text.startsWith("MCP>")) return "#FF5A4A";
  if (l.text.startsWith("[EXTERNAL]")) return "#E8F4FF";
  if (l.text.startsWith("!") || l.text.startsWith("R3-TR0>")) return "#FFB800";
  if (l.text.startsWith(tr("[ACCEPTED]"))) return "#B8FFB8";
  if (/^\[(BLOCKED|UNKNOWN|FAILED|NOWORLD)\]/.test(l.text)) return "#FF5A4A";
  return "#33FF33";
}

export function RoomTerminal({
  terminalId,
  getState,
  act,
  onClose,
  onOpenBigTerminal,
}: RoomTerminalProps) {
  const [settings] = useSettings();
  const def = ROOM_TERMINAL_BY_ID.get(terminalId);
  const instant = settings.accessibility.reduceMotion || settings.gameplay.textSpeed === "sofort";
  const cps = instant
    ? Number.POSITIVE_INFINITY
    : textCharsPerSecond(settings.gameplay.textSpeed) * 3;
  const calm = settings.accessibility.reduceMotion || settings.accessibility.reduceFlicker;

  const usable = useMemo(() => terminalUsable(getState(), terminalId), [getState, terminalId]);
  const [lines, setLines] = useState<Line[]>(() => {
    const s = getState();
    if (!def) return [mk(tr("tty: unknown terminal “{id}”", { id: terminalId }), "sys")];
    if (!terminalUsable(s, terminalId))
      return [
        mk(tr("[ NO SIGNAL ]"), "sys"),
        mk(def.requiresHint ?? tr("The terminal does not respond."), "out"),
      ];
    return terminalBanner(s, terminalId).map((t) => mk(t, "sys"));
  });
  /** Lines from this index on are being typed out. */
  const [animFrom, setAnimFrom] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>(() => loadHistory(terminalId));
  /** Every input of this session, oldest first (for `verlauf` / `!n`). */
  const session = useRef<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [cursorOn, setCursorOn] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const pending = useMemo(
    () => lines.slice(animFrom).reduce((a, l) => a + l.text.length + 1, 0),
    [lines, animFrom],
  );
  const typing = Number.isFinite(cps) && revealed < pending;

  // Typewriter.
  useEffect(() => {
    if (!typing) return;
    // Interval (not rAF) so output keeps flowing in background windows.
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setRevealed((r) => Math.min(pending, r + Math.max(1, Math.round(dt * cps))));
    }, 30);
    return () => window.clearInterval(id);
  }, [typing, pending, cps]);

  // Blinking cursor.
  useEffect(() => {
    if (calm) return;
    const id = window.setInterval(() => setCursorOn((c) => !c), 530);
    return () => window.clearInterval(id);
  }, [calm]);

  // Keep the newest line in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, revealed]);

  useEffect(() => {
    inputRef.current?.focus();
    const refocus = () => inputRef.current?.focus();
    window.addEventListener("focus", refocus);
    const list = timers.current;
    return () => {
      window.removeEventListener("focus", refocus);
      for (const t of list) window.clearTimeout(t);
    };
  }, []);

  useEffect(() => saveHistory(terminalId, history), [terminalId, history]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const append = useCallback(
    (echo: Line | null, out: Line[]) => {
      const base = echo ? [...lines, echo] : lines;
      const next = [...base, ...out];
      const drop = Math.max(0, next.length - MAX_LINES);
      setLines(drop ? next.slice(drop) : next);
      setAnimFrom(base.length - drop);
      setRevealed(0);
    },
    [lines],
  );

  const prompt = `jade@${def?.room ?? "unlab"}:~$`;

  const submit = useCallback(
    (raw: string) => {
      setHistIdx(-1);
      setInput("");
      const expanded = expandHistory(raw, session.current);
      if (expanded === null) {
        append(mk(`${prompt} ${raw}`, "in"), [
          mk(tr("{input}: event not found", { input: raw.trim() }), "out"),
        ]);
        return;
      }
      const echo = mk(`${prompt} ${expanded}`, "in");
      const cmd = expanded.trim();
      if (!cmd) {
        append(echo, []);
        return;
      }
      setHistory((h) => [cmd, ...h.filter((x) => x !== cmd)].slice(0, HISTORY_MAX));
      const res = runCommand(getState(), cmd, { terminalId, history: session.current });
      session.current = [...session.current, cmd].slice(-HISTORY_MAX);
      const fx = res.effects;
      const extra =
        fx?.flags?.length || fx?.actions?.length
          ? act((s) => applyTerminalEffects(s, fx, terminalId))
          : [];
      if (fx?.clear) {
        setLines([]);
        setAnimFrom(0);
        setRevealed(0);
        return;
      }
      append(
        echo,
        [...res.lines, ...extra].map((t) => mk(t, "out")),
      );
      if (fx?.openBigTerminal) later(onOpenBigTerminal, instant ? 0 : 700);
      if (fx?.close) later(onClose, instant ? 0 : 350);
    },
    [act, append, getState, instant, later, onClose, onOpenBigTerminal, prompt, terminalId],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Keep keys away from the engine / global shortcuts.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (!usable) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (typing) {
        setRevealed(pending);
        return;
      }
      submit(input);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(history.length - 1, histIdx + 1);
      if (i >= 0) {
        setHistIdx(i);
        setInput(history[i] ?? "");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = histIdx - 1;
      setHistIdx(Math.max(-1, i));
      setInput(i >= 0 ? (history[i] ?? "") : "");
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const c = completeInput(getState(), input, { terminalId });
      setInput(c.value);
      if (c.options.length > 1) append(null, [mk(c.options.join("  "), "sys")]);
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const el = scrollRef.current;
      if (el) el.scrollTop += (e.key === "PageUp" ? -1 : 1) * el.clientHeight * 0.8;
      return;
    }
    if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      append(mk(`${prompt} ${input}^C`, "in"), []);
      setInput("");
      setHistIdx(-1);
      return;
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
      setAnimFrom(0);
      setRevealed(0);
    }
  };

  // Render with the typewriter budget.
  let budget = typing ? revealed : Number.POSITIVE_INFINITY;
  const view: { line: Line; text: string; partial: boolean }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (i < animFrom || !typing) {
      view.push({ line: l, text: l.text, partial: false });
      continue;
    }
    if (budget <= 0) break;
    const n = Math.min(l.text.length, budget);
    view.push({ line: l, text: l.text.slice(0, n), partial: n < l.text.length });
    budget -= l.text.length + 1;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={def?.label ?? "Terminal"}
    >
      <div
        className="relative w-full max-w-3xl rounded-[22px] border border-[#2a2a2a] bg-gradient-to-b from-[#3a3a36] to-[#1e1e1c] p-4 shadow-[0_0_60px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-6"
        onMouseDown={(e) => {
          e.stopPropagation();
          // Keep focus in the hidden input (the default mousedown would blur it).
          if (!(e.target instanceof HTMLElement && e.target.closest("button"))) e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1 font-mono text-[10px] tracking-[0.25em] text-[#9a9a90] uppercase">
          <span className="truncate">{def?.label ?? "Terminal"}</span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: usable ? "#33FF33" : "#FF3333",
                boxShadow: `0 0 6px ${usable ? "#33FF33" : "#FF3333"}`,
              }}
            />
            <CrtButton tone="amber" onClick={onClose} aria-label={tr("Close")}>
              Esc
            </CrtButton>
          </span>
        </div>
        <div
          className="relative overflow-hidden rounded-[14px] border-4 border-black bg-[#020a03] shadow-[inset_0_0_40px_rgba(0,0,0,0.95)]"
          style={calm ? undefined : { animation: "unlabTermFlicker 5s infinite" }}
        >
          <div
            ref={scrollRef}
            className="relative h-[60vh] max-h-[520px] overflow-y-auto px-4 py-3 font-mono text-[13px] leading-[1.35] break-words whitespace-pre-wrap"
            style={{ textShadow: "0 0 4px rgba(51,255,51,0.55), 0 0 1px rgba(51,255,51,0.9)" }}
            aria-live="polite"
          >
            {view.map(({ line, text, partial }) => (
              <div key={line.id} style={{ color: lineColor(line) }}>
                {text || " "}
                {partial && <span className="text-[#b8ffb8]">█</span>}
              </div>
            ))}
            {usable && !typing && (
              <div className="flex text-[#33FF33]">
                <span className="mr-2 shrink-0 text-[#FFB800]">{prompt}</span>
                <span className="whitespace-pre">{input}</span>
                <span
                  aria-hidden
                  className="inline-block w-[0.6em] bg-[#33FF33]"
                  style={{ opacity: cursorOn || calm ? 1 : 0, boxShadow: "0 0 6px #33FF33" }}
                >
                  &nbsp;
                </span>
              </div>
            )}
          </div>
          {/* Scanlines, vignette and glass glare. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 1px, transparent 1px, transparent 3px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%), linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 35%)",
            }}
          />
        </div>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setHistIdx(-1);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          className="absolute h-px w-px opacity-0"
          aria-label={tr("Command input")}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={160}
        />
        <div className="mt-2 flex justify-between px-1 font-mono text-[9px] tracking-[0.3em] text-[#6f6f66] uppercase">
          <span>_unOS lite</span>
          <span>unstable laboratories</span>
        </div>
        <style>{`@keyframes unlabTermFlicker { 0%, 100% { opacity: 1 } 92% { opacity: 1 } 93% { opacity: 0.94 } 94% { opacity: 1 } 97% { opacity: 0.97 } }`}</style>
      </div>
    </div>
  );
}

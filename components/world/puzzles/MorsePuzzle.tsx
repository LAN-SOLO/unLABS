"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import {
  answerMatches,
  classifyPress,
  decodeCode,
  DEFAULT_GROUPS,
  DEFAULT_WHISPER,
  MORSE,
  morseSolution,
  morseTimeline,
  type MorseSymbol,
} from "@/components/world/puzzles/engine/morse";
import { nums, str } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StatusLine,
  isTypingTarget,
  useFailFx,
  useFailHint,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const UNIT_MS = 110;
const TONE_HZ = 620;
const LETTER_PAUSE_MS = 650;
const LETTERS = Object.keys(MORSE);

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const g = globalThis as typeof globalThis & {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function glyph(s: string): string {
  return s === "." ? "·" : "−";
}

export function MorsePuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const signal = str(params, "signal", DEFAULT_WHISPER);
  const groupsKey = nums(params, "groups", [...DEFAULT_GROUPS]).join(",");
  const answerParam = str(params, "answer", "");
  const sol = useMemo(
    () => morseSolution(signal, groupsKey.split(",").map(Number), answerParam || undefined),
    [signal, groupsKey, answerParam],
  );
  const len = sol.answer.length;

  const [entry, setEntry] = useState("");
  const [playing, setPlaying] = useState(false);
  const [lamp, setLamp] = useState(false);
  const [activeSym, setActiveSym] = useState(-1);
  const [noAudio, setNoAudio] = useState(false);
  const [keyDown, setKeyDown] = useState(false);
  const [keyed, setKeyed] = useState<MorseSymbol[]>([]);
  const [log, setLog] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "info"; text: string }>({
    tone: "info",
    text: tr("The signal came without pauses. Only the timing gives away the letters."),
  });
  const sfx = useSfx(sound);
  const { fail, fails, hint } = useFailHint(3, 90, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const { reduceFlicker } = usePuzzleFx();

  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<number[]>([]);
  const sideRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const pressStartRef = useRef(0);
  const letterTimerRef = useRef<number | null>(null);
  const keyedRef = useRef<MorseSymbol[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const audio = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = getAudioCtor();
    if (!Ctor) {
      setNoAudio(true);
      return null;
    }
    try {
      ctxRef.current = new Ctor();
    } catch {
      setNoAudio(true);
      return null;
    }
    return ctxRef.current;
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) window.clearTimeout(t);
      if (letterTimerRef.current !== null) window.clearTimeout(letterTimerRef.current);
      try {
        sideRef.current?.osc.stop();
      } catch {
        // already stopped
      }
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, []);

  const beepAt = (ctx: AudioContext, startIn: number, durMs: number) => {
    const t0 = ctx.currentTime + startIn;
    const dur = durMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(TONE_HZ, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.008);
    gain.gain.setValueAtTime(0.16, t0 + Math.max(0.01, dur - 0.01));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  const play = () => {
    if (playing) return;
    sfx("ui_click");
    setPlaying(true);
    const events = morseTimeline(sol.codes, UNIT_MS);
    const ctx = audio();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    let at = 250;
    for (const ev of events) {
      if (ev.on) {
        if (ctx) beepAt(ctx, at / 1000, ev.ms);
        const sym = ev.symbol;
        later(() => {
          setLamp(true);
          setActiveSym(sym);
        }, at);
        later(() => setLamp(false), at + ev.ms);
      }
      at += ev.ms;
    }
    later(() => {
      setActiveSym(-1);
      setLamp(false);
      setPlaying(false);
    }, at + 200);
  };

  // --- Practice key -------------------------------------------------------
  const keyStart = () => {
    if (keyDown) return;
    setKeyDown(true);
    pressStartRef.current = performance.now();
    if (letterTimerRef.current !== null) window.clearTimeout(letterTimerRef.current);
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = TONE_HZ;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.008);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    sideRef.current = { osc, gain };
  };

  const keyEnd = () => {
    if (!keyDown) return;
    setKeyDown(false);
    const side = sideRef.current;
    sideRef.current = null;
    if (side && ctxRef.current) {
      const t = ctxRef.current.currentTime;
      side.gain.gain.cancelScheduledValues(t);
      side.gain.gain.setValueAtTime(Math.max(0.0001, side.gain.gain.value), t);
      side.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
      side.osc.stop(t + 0.02);
    }
    const sym = classifyPress(performance.now() - pressStartRef.current);
    const next = [...keyedRef.current, sym].slice(-6);
    keyedRef.current = next;
    setKeyed(next);
    letterTimerRef.current = window.setTimeout(() => {
      const letter = decodeCode(keyedRef.current.join("")) ?? "?";
      keyedRef.current = [];
      setKeyed([]);
      setLog((l) => (l + letter).slice(-16));
    }, LETTER_PAUSE_MS);
  };

  // --- Answer --------------------------------------------------------------
  const typeLetter = (ch: string) => {
    if (solved) return;
    sfx("ui_click");
    setEntry((e) => (e.length < len ? e + ch : e));
  };

  const submit = () => {
    if (solved) return;
    if (entry.length < len) {
      sfx("ui_click");
      setStatus({ tone: "info", text: tr("{n} letter(s) still open.", { n: len - entry.length }) });
      return;
    }
    if (answerMatches(entry, sol.answer)) {
      setStatus({
        tone: "ok",
        text: tr("Decrypted: {answer}", { answer: sol.answer.split("").join(" · ") }),
      });
      onSolve();
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    setStatus({
      tone: "bad",
      text: tr("“{entry}” — the Halo stays silent. Listen to the pauses.", { entry }),
    });
    setEntry("");
  };

  const backspace = () => {
    if (solved) return;
    sfx("ui_click");
    setEntry((x) => x.slice(0, -1));
  };

  const clearLog = () => {
    if (letterTimerRef.current !== null) window.clearTimeout(letterTimerRef.current);
    keyedRef.current = [];
    setKeyed([]);
    setLog("");
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    setEntry("");
    clearLog();
    setStatus({
      tone: "info",
      text: tr("Everything cleared. The signal plays again whenever you want."),
    });
  };

  const handlers = { keyStart, keyEnd, typeLetter, submit, backspace, play, clearLog };
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  // Space = Morsetaste (always, it is the instrument). Enter sends unless a
  // button has focus (then the button acts). Letters type, 1 plays, 0 clears
  // the practice log. Escape is left to the host.
  useEffect(() => {
    const onButton = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && e.target.closest("button") !== null;
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const h = handlersRef.current;
      if (e.key === " ") {
        e.preventDefault();
        if (!e.repeat) h.keyStart();
      } else if (e.key === "Enter") {
        if (onButton(e)) return;
        e.preventDefault();
        if (!e.repeat) h.submit();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        h.backspace();
      } else if (e.key === "1") {
        e.preventDefault();
        h.play();
      } else if (e.key === "0") {
        e.preventDefault();
        h.clearLog();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        h.typeLetter(e.key.toUpperCase());
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        handlersRef.current.keyEnd();
      }
    };
    // Lost focus mid-press must not leave the sidetone ringing.
    const blur = () => handlersRef.current.keyEnd();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // Flat symbol index → is it the last symbol of a letter (for hint separators).
  const letterEnds = useMemo(() => {
    const ends = new Set<number>();
    let i = 0;
    for (const c of sol.codes) {
      i += c.length;
      ends.add(i - 1);
    }
    return ends;
  }, [sol.codes]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          aria-hidden
          className={`relative h-12 w-12 shrink-0 rounded-full border-2 ${
            reduceFlicker ? "transition-all duration-150" : "transition-colors duration-75"
          } ${
            lamp
              ? reduceFlicker
                ? "border-[#B266FF] bg-[#6A1FB0] shadow-[0_0_10px_#8B00FF]"
                : "border-[#E0B0FF] bg-[#8B00FF] shadow-[0_0_28px_#8B00FF,0_0_60px_rgba(139,0,255,0.45)]"
              : "border-[#8B00FF]/40 bg-[#1A0A26] shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]"
          }`}
        >
          <span
            className={`absolute top-2 left-2.5 h-2.5 w-3 rounded-full ${lamp ? "bg-white/70" : "bg-white/10"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-xs text-[#FFB800]">
            {tr("SIGNAL INTERRUPT · SOURCE: UNKNOWN")}
          </div>
          <div
            className="flex flex-wrap items-center gap-x-1 rounded-sm border border-[#8B00FF]/40 bg-black px-3 py-2 text-2xl leading-none"
            aria-label={tr("Signal: {symbols}", {
              symbols: sol.symbols.map((s) => (s === "." ? tr("short") : tr("long"))).join(" "),
            })}
          >
            {sol.symbols.map((s, i) => (
              <span key={i} className="flex items-center">
                <span
                  className={
                    i === activeSym
                      ? "text-[#E0B0FF] [text-shadow:0_0_8px_#B266FF]"
                      : "text-[#B266FF]/80"
                  }
                >
                  {glyph(s)}
                </span>
                {hint && letterEnds.has(i) && i < sol.symbols.length - 1 && (
                  <span className="mx-1 text-base text-[#FFB800]">/</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CrtButton tone="cyan" onClick={play} disabled={playing}>
          {playing ? tr("Playing …") : tr("▶ Play")} <kbd className="ml-1">1</kbd>
        </CrtButton>
        <span className="text-[10px] text-[#33FF33]/60">
          {tr("Lamp and tone run in sync — the long pauses separate the letters.")}
        </span>
      </div>
      {noAudio && (
        <p className="text-xs text-red-400">
          {tr("No audio available — the lamp carries the same signal.")}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1 text-xs text-[#FFB800]">{tr("Codebook (click = enter letter)")}</div>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-5">
            {LETTERS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => typeLetter(l)}
                disabled={solved}
                className="flex items-center justify-between rounded-sm border border-[#33FF33]/25 bg-black px-1.5 py-1 text-left text-xs text-[#33FF33] transition-colors hover:border-[#00FFFF] hover:bg-[#00FFFF]/10 active:bg-[#00FFFF]/25 disabled:opacity-40"
                aria-label={`${l}: ${MORSE[l]
                  .split("")
                  .map((s) => (s === "." ? tr("short") : tr("long")))
                  .join(" ")}`}
              >
                <span className="text-[#00FFFF]">{l}</span>
                <span className="tracking-tight text-[#33FF33]/80">
                  {MORSE[l].split("").map(glyph).join("")}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-[#FFB800]">{tr("Practice key")}</div>
          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              keyStart();
            }}
            onPointerUp={keyEnd}
            onPointerCancel={keyEnd}
            className={`h-16 w-24 rounded-md border-2 text-xs tracking-widest transition-all select-none ${
              keyDown
                ? "translate-y-0.5 border-[#00FFFF] bg-[#00FFFF]/25 text-[#00FFFF] shadow-[0_0_12px_#00FFFF]"
                : "border-[#33FF33]/50 bg-[#1A1A1A] text-[#33FF33]"
            }`}
            aria-label={tr("Morse key (press and hold)")}
          >
            {tr("KEY")}
          </button>
          <div className="h-5 text-lg leading-none text-[#00FFFF]" aria-live="polite">
            {keyed.map(glyph).join("")}
          </div>
          <div className="w-28 truncate rounded-sm border border-[#33FF33]/20 bg-black px-2 py-0.5 text-center text-xs tracking-widest text-[#33FF33]/80">
            {log || "—"}
          </div>
          <CrtButton
            tone="amber"
            className="px-2 py-0.5 text-[10px]"
            onClick={() => {
              sfx("ui_click");
              clearLog();
            }}
          >
            {tr("Clear log")} <kbd>0</kbd>
          </CrtButton>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs text-[#FFB800]">{tr("Plaintext")}</div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`flex gap-2 rounded-sm p-1 outline-offset-2 ${failClass}`}
            tabIndex={0}
            data-pz-autofocus
            role="textbox"
            aria-readonly="false"
            aria-label={tr("Plaintext, {len} letters. Input: {input}. Type letters, Enter sends.", {
              len,
              input: entry.split("").join(" ") || tr("empty"),
            })}
          >
            {Array.from({ length: len }, (_, i) => (
              <span
                key={`${i}-${entry[i] ?? "_"}`}
                className={`flex h-11 w-9 items-center justify-center rounded-sm border text-2xl ${
                  solved
                    ? "border-[#33FF33] text-[#33FF33] [text-shadow:0_0_8px_#33FF33]"
                    : i === entry.length
                      ? "border-[#00FFFF] text-[#00FFFF] shadow-[0_0_8px_rgba(0,255,255,0.4)]"
                      : "border-[#33FF33]/40 text-[#33FF33]"
                } ${entry[i] ? "pz-flip" : ""}`}
              >
                {entry[i] ?? <span className="pz-blink">_</span>}
              </span>
            ))}
          </div>
          <CrtButton tone="amber" onClick={backspace} disabled={solved || entry.length === 0}>
            ⌫ {tr("Delete")}
          </CrtButton>
          <CrtButton tone="green" onClick={submit} disabled={solved}>
            {tr("Send")}
          </CrtButton>
        </div>
      </div>
      <StatusLine tone={status.tone}>{status.text}</StatusLine>
      <HintBox show={hint}>
        {tr(
          "I have marked the pauses. {n} letters. If the result looks like a typo: Dr. Fridge spelled it that way too.",
          { n: sol.codes.length },
        )}
        {fails >= 6 &&
          ` ${tr("The first letter is “{letter}”. Read the codebook backwards: look for the symbols, not the letters.", { letter: sol.answer[0] ?? "?" })}`}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>A</kbd>–<kbd>Z</kbd> {tr("type")} · <kbd>⌫</kbd> {tr("deletes")} · <kbd>Enter</kbd>{" "}
            {tr("sends")} · <kbd>1</kbd> {tr("play")} · <kbd>{tr("Space")}</kbd>{" "}
            {tr("hold = Morse key")}
          </>
        }
        onReset={reset}
        resetDisabled={solved}
      />
    </div>
  );
}

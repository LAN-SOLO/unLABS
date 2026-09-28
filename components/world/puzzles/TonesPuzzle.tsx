"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nums } from "@/components/world/puzzles/logic";
import { tr } from "@/lib/i18n";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StepPips,
  useFailFx,
  useFailHint,
  useHotkeys,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const DEFAULT_SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const TONE_MS = 450;
const GAP_MS = 120;

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const g = globalThis as typeof globalThis & {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function barHeight(freq: number, scale: readonly number[]): number {
  const lo = Math.min(...scale);
  const hi = Math.max(...scale);
  if (hi <= lo) return 60;
  return 20 + ((freq - lo) / (hi - lo)) * 80;
}

function WaveBars({
  indices,
  scale,
  color,
  label,
}: {
  indices: readonly number[];
  scale: readonly number[];
  color: string;
  label: string;
}) {
  return (
    <div>
      <div className="mb-1 text-xs text-[#FFB800]">{label}</div>
      <div
        className="flex h-16 items-end gap-2 rounded-sm border border-[#33FF33]/30 bg-black p-2"
        aria-label={`${label}: ${indices.map((i) => i + 1).join(", ") || tr("empty")}`}
      >
        {indices.map((i, k) => (
          <div key={k} className="flex w-8 flex-col items-center justify-end">
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${barHeight(scale[i] ?? 0, scale) * 0.4}px`,
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }}
            />
            <span className="mt-0.5 text-[10px] text-[#33FF33]/80">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TonesPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const rawScale = nums(params, "scale", DEFAULT_SCALE);
  const scale = rawScale.length > 0 ? rawScale : DEFAULT_SCALE;
  const keyCount = Math.min(8, scale.length);
  // Only tones that have a key; an empty sequence would never solve.
  const validTones = nums(params, "tones", [0, 1, 2, 3]).filter(
    (i) => Number.isInteger(i) && i >= 0 && i < keyCount,
  );
  const tones = validTones.length > 0 ? validTones : [0, 1, 2, 3].filter((i) => i < keyCount);

  const [attempt, setAttempt] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [noAudio, setNoAudio] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  const sfx = useSfx(sound);
  const { reduceMotion } = usePuzzleFx();
  const { fails, fail, hint } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();

  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) window.clearTimeout(t);
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, []);

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

  const beep = useCallback(
    (freq: number, startIn: number, durMs: number, type: OscillatorType, peak: number) => {
      const ctx = audio();
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      const t0 = ctx.currentTime + startIn;
      const dur = durMs / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
      gain.gain.setValueAtTime(peak, t0 + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    [audio],
  );

  const playSequence = () => {
    if (playing) return;
    sfx("ui_click");
    setPlaying(true);
    setAttempt([]);
    tones.forEach((idx, k) => {
      const at = k * (TONE_MS + GAP_MS);
      beep(scale[idx], at / 1000, TONE_MS, "sine", 0.18);
      later(() => setActive(idx), at);
    });
    later(
      () => {
        setActive(null);
        setPlaying(false);
      },
      tones.length * (TONE_MS + GAP_MS),
    );
  };

  const press = (idx: number) => {
    if (solved || playing || idx < 0 || idx >= keyCount) return;
    beep(scale[idx], 0, TONE_MS, "sine", 0.18);
    setActive(idx);
    setPressCount((c) => c + 1);
    later(() => setActive((a) => (a === idx ? null : a)), TONE_MS);
    const next = [...attempt, idx];
    if (tones[next.length - 1] !== idx) {
      if (sound) later(() => sfx("fail_buzz"), TONE_MS * 0.6);
      else beep(110, TONE_MS / 1000, 260, "triangle", 0.08);
      fail();
      failFx();
      setAttempt([]);
      return;
    }
    setAttempt(next);
    if (next.length === tones.length) onSolve();
  };

  const clearAttempt = () => {
    setAttempt([]);
    sfx("ui_click");
  };

  useHotkeys(
    (key) => {
      if (/^[1-8]$/.test(key)) {
        press(Number(key) - 1);
        return true;
      }
      if (key === "p" || key === "P" || key === "Enter") {
        if (!solved) playSequence();
        return true;
      }
      if (key === "Backspace") {
        if (!solved && attempt.length > 0) clearAttempt();
        return true;
      }
      return false;
    },
    !solved,
    { repeat: false },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <CrtButton
          tone="cyan"
          onClick={playSequence}
          disabled={playing || solved}
          data-pz-autofocus
        >
          {playing ? tr("▶ Playing …") : tr("▶ Play")}
        </CrtButton>
        <CrtButton
          tone="amber"
          onClick={() => {
            setShowHelp((s) => !s);
            sfx("ui_click");
          }}
          aria-pressed={showHelp}
        >
          {showHelp ? tr("Help: hide waveform") : tr("Help: show waveform")}
        </CrtButton>
        <span className="ml-auto flex items-center gap-2 text-xs text-[#33FF33]/70">
          {tr("Input")}
          <StepPips
            done={solved ? tones.length : attempt.length}
            total={tones.length}
            label={tr("Input")}
          />
        </span>
      </div>
      {noAudio && (
        <p className="text-xs text-red-400">{tr("No audio available — use the waveform help.")}</p>
      )}
      <div
        className={`grid grid-cols-4 gap-2 rounded-sm p-1 transition-colors ${failClass}`}
        role="group"
        aria-label={tr("Tone keys 1 to 8, ascending")}
      >
        {Array.from({ length: keyCount }, (_, i) => {
          const lit = active === i;
          return (
            <button
              key={lit ? `${i}-${pressCount}` : i}
              type="button"
              onClick={() => press(i)}
              disabled={solved || playing}
              className={`relative h-16 overflow-hidden rounded-sm border font-mono text-lg transition-[background-color,box-shadow] duration-100 disabled:cursor-not-allowed ${
                lit
                  ? `border-[#00FFFF] bg-[#00FFFF]/25 text-[#00FFFF] shadow-[0_0_16px_#00FFFF] [text-shadow:0_0_8px_#00FFFF] ${reduceMotion ? "" : "pz-pop"}`
                  : "border-[#33FF33]/50 bg-[#1A1A1A] text-[#33FF33] hover:bg-[#33FF33]/10 hover:shadow-[0_0_8px_rgba(51,255,51,0.3)]"
              } focus-visible:border-[#00FFFF]`}
              aria-label={tr("Tone {n}", { n: i + 1 })}
            >
              <span
                aria-hidden
                className={`absolute inset-x-2 bottom-1 rounded-t-sm ${lit ? "bg-[#00FFFF]/60" : "bg-[#33FF33]/15"}`}
                style={{ height: `${barHeight(scale[i] ?? 0, scale) * 0.12}px` }}
              />
              <span className="relative">{i + 1}</span>
            </button>
          );
        })}
      </div>
      <WaveBars indices={attempt} scale={scale} color="#33FF33" label={tr("Your input")} />
      {showHelp && (
        <WaveBars indices={tones} scale={scale} color="#00FFFF" label={tr("Target waveform")} />
      )}
      <HintBox show={hint && !solved && !showHelp}>
        {tr(
          "The keys are tuned in ascending order: 1 hums, 8 whistles — the bars show the pitch. Listen for the jumps between the tones, not the tones themselves. And should your hearing go on strike: the waveform help is not an admission of defeat. Only a slight one.",
        )}
        {fails >= 6 && ` ${tr("The first tone is {n}.", { n: tones[0] + 1 })}`}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>P</kbd>/<kbd>Enter</kbd> {tr("plays")} · <kbd>1</kbd>–<kbd>{keyCount}</kbd>{" "}
            {tr("tone keys")} · <kbd>⌫</kbd> {tr("clear input")} · {tr("bars = pitch")}
          </>
        }
        onReset={clearAttempt}
        resetDisabled={solved || attempt.length === 0}
        resetLabel={tr("Clear input")}
      />
    </div>
  );
}

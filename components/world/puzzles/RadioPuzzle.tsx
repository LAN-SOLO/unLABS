"use client";

import { fmtNum } from "@/components/world/format";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  clampFreq,
  FREQ_MAX,
  FREQ_MIN,
  LOCK_THRESHOLD,
  phaseDelta,
  radioClarity,
  radioStart,
  voiceSample,
  wrapPhase,
} from "@/components/world/puzzles/engine/radio";
import { num, str } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  ProgressBar,
  PuzzleFooter,
  StatusLine,
  arrowDelta,
  useFailFx,
  useFailHint,
  useHotkeys,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const SCOPE_W = 520;
const SCOPE_H = 140;
const DEFAULT_LINE = tr(
  "…if you can hear this, the lab is still warm. Don't look for us. Look for the frequency.",
);
const TYPE_MS = 2200;

type AudioCtor = typeof AudioContext;

function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const g = globalThis as typeof globalThis & {
    AudioContext?: AudioCtor;
    webkitAudioContext?: AudioCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

interface KnobProps {
  label: string;
  display: string;
  /** 0..1 position of the pointer on the dial. */
  ratio: number;
  disabled: boolean;
  /** Steps to add (positive = clockwise); `coarse` for Shift/PageUp. */
  onSteps: (steps: number, coarse?: boolean) => void;
  /**
   * Arrow axis this knob answers to: "x" = ←/→ (A/D), "y" = ↑/↓ (W/S). The
   * other axis falls through to the global map, so ←/→ always tune the
   * frequency and ↑/↓ the phase, whichever knob has focus.
   */
  axis: "x" | "y";
  hintArrow?: string;
  valueNow: number;
  valueMin: number;
  valueMax: number;
  autoFocus?: boolean;
}

function Knob({
  label,
  display,
  ratio,
  disabled,
  onSteps,
  axis,
  hintArrow,
  valueNow,
  valueMin,
  valueMax,
  autoFocus = false,
}: KnobProps) {
  const ref = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ y: number; acc: number } | null>(null);
  const stepsRef = useRef(onSteps);
  useEffect(() => {
    stepsRef.current = onSteps;
  }, [onSteps]);

  // Native non-passive wheel listener so the modal doesn't scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stepsRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { y: e.clientY, acc: 0 };
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || disabled) return;
    d.acc += d.y - e.clientY;
    d.y = e.clientY;
    const steps = Math.trunc(d.acc / 6);
    if (steps !== 0) {
      d.acc -= steps * 6;
      onSteps(steps);
    }
  };
  const up = () => {
    dragRef.current = null;
  };

  const angle = -135 + ratio * 270;
  const rad = ((angle - 90) * Math.PI) / 180;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs text-[#FFB800]">{label}</div>
      <svg
        ref={ref}
        viewBox="0 0 100 100"
        className={`group h-28 w-28 touch-none rounded-full select-none ${disabled ? "opacity-60" : "cursor-ns-resize"}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => {
          // A focused knob owns its own axis (+ PageUp/Down); the other axis
          // goes to the global map (←/→ frequency, ↑/↓ phase).
          if (disabled) return;
          const d = arrowDelta(e.key);
          const page = e.key === "PageUp" ? 1 : e.key === "PageDown" ? -1 : 0;
          const step = d ? (axis === "x" ? d[0] : -d[1]) : 0;
          if (!step && !page) return;
          e.preventDefault();
          if (page) onSteps(page, true);
          else onSteps(step, e.shiftKey);
        }}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        data-pz-autofocus={autoFocus ? true : undefined}
        aria-label={label}
        aria-valuetext={display}
        aria-valuenow={valueNow}
        aria-valuemin={valueMin}
        aria-valuemax={valueMax}
        aria-disabled={disabled}
      >
        {Array.from({ length: 28 }, (_, i) => {
          const a = ((-135 + (i / 27) * 270 - 90) * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * 44}
              y1={50 + Math.sin(a) * 44}
              x2={50 + Math.cos(a) * (i % 3 === 0 ? 38 : 41)}
              y2={50 + Math.sin(a) * (i % 3 === 0 ? 38 : 41)}
              stroke="#33FF33"
              strokeOpacity={i / 27 <= ratio ? 0.9 : 0.25}
              strokeWidth={1.5}
            />
          );
        })}
        <circle
          cx={50}
          cy={50}
          r={32}
          fill="#1A1A1A"
          stroke="#3A3A3A"
          strokeWidth={3}
          className="transition-[stroke] group-hover:stroke-[#33FF33]/60 group-focus-visible:stroke-[#00FFFF]"
        />
        <circle cx={50} cy={50} r={26} fill="#111" stroke="#2A2A2A" />
        <line
          x1={50}
          y1={50}
          x2={50 + Math.cos(rad) * 28}
          y2={50 + Math.sin(rad) * 28}
          stroke="#00FFFF"
          strokeWidth={3}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 3px #00FFFF)" }}
        />
      </svg>
      <div className="text-sm text-[#00FFFF] tabular-nums">{display}</div>
      <div className="h-4 text-xs text-[#FFB800]">{hintArrow ?? ""}</div>
    </div>
  );
}

export function RadioPuzzle({ params, onSolve, solved, sound: sfxSink }: PuzzleProps) {
  const seed = num(params, "seed", 1);
  const tFreq = clampFreq(num(params, "freq", 94.7));
  const tPhase = wrapPhase(num(params, "phase", 135));
  const line = str(params, "line", DEFAULT_LINE);
  const speaker = str(params, "speaker", tr("unknown"));
  const start = useMemo(() => radioStart(seed, tFreq, tPhase), [seed, tFreq, tPhase]);

  const [freq, setFreq] = useState(start.freq);
  const [phase, setPhase] = useState(start.phase);
  const [locked, setLocked] = useState(false);
  const [typed, setTyped] = useState(0);
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "info"; text: string }>({
    tone: "info",
    text: tr("Somewhere under the static, someone is talking."),
  });
  const [sound, setSound] = useState(false);
  const [noAudio, setNoAudio] = useState(false);
  const sfx = useSfx(sfxSink);
  const { fail, fails, hint } = useFailHint(3, 60, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const { reduceFlicker } = usePuzzleFx();
  const flickerRef = useRef(reduceFlicker);
  useEffect(() => {
    flickerRef.current = reduceFlicker;
  }, [reduceFlicker]);

  const clarity = radioClarity(freq, phase, tFreq, tPhase);
  const clarityRef = useRef(clarity);
  useEffect(() => {
    clarityRef.current = clarity;
  }, [clarity]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inactive = solved || locked;

  const stepFreq = useCallback(
    (steps: number, coarse = false) => {
      if (inactive) return;
      sfx("ui_click");
      setFreq((f) => clampFreq(f + steps * (coarse ? 1 : 0.1)));
    },
    [inactive, sfx],
  );
  const stepPhase = useCallback(
    (steps: number) => {
      if (inactive) return;
      sfx("ui_click");
      setPhase((p) => wrapPhase(p + steps * 5));
    },
    [inactive, sfx],
  );

  const lock = () => {
    if (inactive) return;
    if (clarity >= LOCK_THRESHOLD) {
      sfx("keypad_beep");
      setLocked(true);
      setStatus({ tone: "ok", text: tr("Signal locked. Voice isolated.") });
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    setStatus({
      tone: "bad",
      text: tr("Only static ({c} %). The lock holds from {t} %.", {
        c: Math.round(clarity * 100),
        t: Math.round(LOCK_THRESHOLD * 100),
      }),
    });
  };

  const reset = () => {
    if (inactive) return;
    sfx("ui_click");
    setFreq(start.freq);
    setPhase(start.phase);
    setStatus({ tone: "info", text: tr("Back to the start. The static waits patiently.") });
  };

  // Typewriter after lock, then solve.
  useEffect(() => {
    if (!locked) return;
    const perChar = Math.max(12, Math.min(45, TYPE_MS / Math.max(1, line.length)));
    let n = 0;
    const id = window.setInterval(() => {
      n++;
      setTyped(n);
      if (n >= line.length) {
        window.clearInterval(id);
        onSolve();
      }
    }, perChar);
    return () => window.clearInterval(id);
  }, [locked, line, onSolve]);

  // Unfocused play: ←/→ (A/D) frequency, ↑/↓ (W/S) phase, Shift = coarse,
  // Enter/Space locks. A focused knob handles only its own axis first.
  useHotkeys((key, e) => {
    if (key === "Enter" || key === " ") {
      lock();
      return true;
    }
    const d = arrowDelta(key);
    if (!d) return false;
    if (d[0] !== 0) stepFreq(d[0], e.shiftKey);
    else stepPhase(-d[1]);
    return true;
  }, !inactive);

  // Oscilloscope.
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const t = (now - t0) / 1000;
        const c = clarityRef.current;
        ctx.fillStyle = "rgba(5,8,5,0.55)";
        ctx.fillRect(0, 0, SCOPE_W, SCOPE_H);
        ctx.strokeStyle = "rgba(51,255,51,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, SCOPE_H / 2);
        ctx.lineTo(SCOPE_W, SCOPE_H / 2);
        ctx.stroke();
        const color = c >= LOCK_THRESHOLD ? "#00FFFF" : "#33FF33";
        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4 + c * 8;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x <= SCOPE_W; x += 2) {
          const v = voiceSample(t * 0.9 + x / 220, c, seed);
          const y = SCOPE_H / 2 - v * (SCOPE_H * 0.4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        // Static: specks and a jittering baseline, fading as the signal clears.
        const noiseAmt = 1 - c;
        if (!flickerRef.current && noiseAmt > 0.05) {
          ctx.fillStyle = `rgba(200,255,200,${(0.35 * noiseAmt).toFixed(3)})`;
          const specks = Math.round(90 * noiseAmt);
          for (let i = 0; i < specks; i++) {
            ctx.fillRect(Math.random() * SCOPE_W, Math.random() * SCOPE_H, 1.5, 1.5);
          }
          if (Math.random() < 0.12 * noiseAmt) {
            ctx.fillStyle = `rgba(51,255,51,${(0.08 * noiseAmt).toFixed(3)})`;
            ctx.fillRect(0, Math.random() * SCOPE_H, SCOPE_W, 2 + Math.random() * 6);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seed]);

  // Optional audio: looping noise + a warbling carrier, mixed by clarity.
  const audioRef = useRef<{
    ctx: AudioContext;
    noiseGain: GainNode;
    voiceGain: GainNode;
  } | null>(null);

  useEffect(() => {
    if (!sound) return;
    const Ctor = getAudioCtor();
    if (!Ctor) {
      const id = window.setTimeout(() => {
        setNoAudio(true);
        setSound(false);
      }, 0);
      return () => window.clearTimeout(id);
    }
    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      const id = window.setTimeout(() => {
        setNoAudio(true);
        setSound(false);
      }, 0);
      return () => window.clearTimeout(id);
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let x = seed * 9301 + 49297;
    for (let i = 0; i < data.length; i++) {
      x = (x * 9301 + 49297) % 233280;
      data[i] = (x / 233280) * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;
    noise.connect(noiseGain).connect(ctx.destination);

    const voice = ctx.createOscillator();
    voice.type = "triangle";
    voice.frequency.value = 196;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 24;
    lfo.connect(lfoGain).connect(voice.frequency);
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0;
    voice.connect(voiceGain).connect(ctx.destination);
    noise.start();
    voice.start();
    lfo.start();
    audioRef.current = { ctx, noiseGain, voiceGain };
    return () => {
      audioRef.current = null;
      void ctx.close().catch(() => undefined);
    };
  }, [sound, seed]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = a.ctx.currentTime;
    a.noiseGain.gain.setTargetAtTime(0.045 * (1 - clarity) + 0.003, t, 0.05);
    a.voiceGain.gain.setTargetAtTime(0.06 * clarity * clarity, t, 0.05);
  }, [clarity, sound]);

  const dPhase = phaseDelta(phase, tPhase);
  const freqArrow =
    Math.abs(freq - tFreq) < 0.05
      ? "✓"
      : freq < tFreq
        ? tr("Frequency higher ▲")
        : tr("Frequency lower ▼");
  const phaseArrow =
    Math.abs(dPhase) < 5 ? "✓" : dPhase > 0 ? tr("Turn phase ↻") : tr("Turn phase ↺");

  return (
    <div className="flex flex-col gap-4">
      <div className={failClass}>
        <canvas
          ref={canvasRef}
          width={SCOPE_W}
          height={SCOPE_H}
          className={`w-full rounded-sm border bg-[#050805] transition-[border-color,box-shadow] ${
            clarity >= LOCK_THRESHOLD
              ? "border-[#00FFFF]/70 shadow-[0_0_14px_rgba(0,255,255,0.35)]"
              : "border-[#33FF33]/40"
          }`}
          role="img"
          aria-label={tr("Oscilloscope, signal clarity {n} percent", {
            n: Math.round(clarity * 100),
          })}
        />
      </div>
      <ProgressBar value={clarity} label={tr("Signal: {n} %", { n: Math.round(clarity * 100) })} />
      <div className="flex flex-wrap items-start justify-around gap-4">
        <Knob
          label={tr("Frequency")}
          display={`${fmtNum(freq, 1)} MHz`}
          ratio={(freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)}
          disabled={inactive}
          onSteps={stepFreq}
          axis="x"
          valueNow={freq}
          valueMin={FREQ_MIN}
          valueMax={FREQ_MAX}
          autoFocus
          hintArrow={hint ? freqArrow : undefined}
        />
        <Knob
          label={tr("Phase")}
          display={`${phase}°`}
          ratio={phase / 355}
          disabled={inactive}
          onSteps={(st, coarse) => stepPhase(coarse ? st * 6 : st)}
          axis="y"
          valueNow={phase}
          valueMin={0}
          valueMax={355}
          hintArrow={hint ? phaseArrow : undefined}
        />
      </div>
      {locked && (
        <div
          className="min-h-[3rem] rounded-sm border border-[#00FFFF]/40 bg-black p-3 text-sm leading-relaxed text-[#00FFFF] [text-shadow:0_0_6px_#00FFFF]"
          aria-live="polite"
        >
          <span className="mr-2 text-[#FFB800]">[{speaker.toUpperCase()}]</span>
          {line.slice(0, typed)}
          {typed < line.length && <span className="animate-pulse">▌</span>}
        </div>
      )}
      <StatusLine tone={status.tone}>{status.text}</StatusLine>
      <div className="flex flex-wrap items-center gap-2">
        <CrtButton tone="green" onClick={lock} disabled={inactive}>
          {tr("Lock")}
        </CrtButton>
        <CrtButton
          tone="cyan"
          onClick={() => {
            sfx("ui_click");
            setSound((s) => !s);
          }}
          aria-pressed={sound}
          disabled={noAudio}
        >
          {sound ? tr("Sound off") : tr("Sound on")}
        </CrtButton>
        {noAudio && <span className="text-xs text-red-400">{tr("No audio available.")}</span>}
      </div>
      <HintBox show={hint}>
        {tr(
          "The arrows under the knobs show which way. First find the frequency roughly (Shift + ←/→), then bring the phase in — without phase the voice stays half in the static.",
        )}
        {fails >= 6 &&
          ` ${tr("Target band: {f} MHz. The phase I leave to your ear.", { f: fmtNum(tFreq, 1) })}`}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            {tr("Drag knobs (up/down) or mouse wheel")} · <kbd>←</kbd>
            <kbd>→</kbd>/<kbd>A</kbd>
            <kbd>D</kbd> {tr("Frequency ±{a}", { a: fmtNum(0.1, 1) })} (<kbd>⇧</kbd> ±{fmtNum(1, 1)}
            ) · <kbd>↑</kbd>
            <kbd>↓</kbd>/<kbd>W</kbd>
            <kbd>S</kbd> {tr("Phase ±5°")} · <kbd>Enter</kbd> {tr("locks")}
          </>
        }
        onReset={reset}
        resetDisabled={inactive}
      />
    </div>
  );
}

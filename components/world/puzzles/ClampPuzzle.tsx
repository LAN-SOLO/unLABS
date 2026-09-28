"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLAMPS,
  WAVE_SAMPLES,
  clampEnvelope,
  makeWave,
  type ClampKind,
} from "@/components/world/puzzles/engine/clamp";
import { num, str } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StatusLine,
  StepPips,
  arrowDelta,
  useFailFx,
  useFailHint,
  useHotkeys,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { interpolate, tr } from "@/lib/i18n";

const W = 520;
const H = 180;
const MID = H / 2;
const AMP = 66;
const SWEEP_S = 2.4;
const FEEDBACK_MS = 800;

type Feedback = "lock" | "slip" | null;

function ClampIcon({ kind, color }: { kind: ClampKind; color: string }) {
  const pts = 24;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= pts; i++) {
    const x = 6 + (i / pts) * 68;
    const e = clampEnvelope(kind, i / pts) * 14;
    top.push(`${x},${20 - e}`);
    bottom.push(`${x},${20 + e}`);
  }
  return (
    <svg viewBox="0 0 80 40" className="h-8 w-full" aria-hidden>
      <polyline points={top.join(" ")} fill="none" stroke={color} strokeWidth={2} />
      <polyline points={bottom.join(" ")} fill="none" stroke={color} strokeWidth={2} />
      <line x1={6} y1={6} x2={6} y2={34} stroke={color} strokeWidth={2} />
      <line x1={74} y1={6} x2={74} y2={34} stroke={color} strokeWidth={2} />
    </svg>
  );
}

export function ClampPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 2008);
  const rounds = Math.max(1, Math.floor(num(params, "rounds", 3)));
  const noise = Math.max(0, num(params, "noise", 0.2));
  // Flavour for the host device (defaults: the _unSLC slice clamp).
  const header = str(params, "header", tr("_unSLC volatility · Round {round} / {rounds}"));
  const doneLabel = str(params, "doneLabel", tr("Slices clamped"));

  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [prevKind, setPrevKind] = useState<ClampKind | undefined>(undefined);
  const [selected, setSelected] = useState<ClampKind | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const sfx = useSfx(sound);
  const { fails, fail, hint } = useFailHint(3, 45, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const { reduceFlicker } = usePuzzleFx();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const wave = useMemo(
    () => makeWave(seed, round, attempt, noise, prevKind),
    [seed, round, attempt, noise, prevKind],
  );
  // The hint names the true pattern (the envelope fit can misread noisy waves).
  const suggested = wave.kind;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef({ wave, selected, feedback, feedbackAt: 0, reduceFlicker });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    drawRef.current = {
      wave,
      selected,
      feedback,
      feedbackAt: feedback === drawRef.current.feedback ? drawRef.current.feedbackAt : 0,
      reduceFlicker,
    };
  }, [wave, selected, feedback, reduceFlicker]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const d = drawRef.current;
      if (d.feedback && d.feedbackAt === 0) d.feedbackAt = now;
      const samples = d.wave.samples;
      ctx.fillStyle = "#050805";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(51,255,51,0.1)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const x = (i / 10) * W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let i = 1; i < 6; i++) {
        const y = (i / 6) * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Waveform: dim full trace plus a bright sweeping head (phosphor persistence).
      const head = ((t % SWEEP_S) / SWEEP_S) * (WAVE_SAMPLES - 1);
      const px = (i: number) => (i / (WAVE_SAMPLES - 1)) * W;
      const flicker = (i: number) => (d.reduceFlicker ? 0 : 0.015 * Math.sin(t * 37 + i * 1.7));
      ctx.save();
      ctx.lineWidth = 1.5;
      for (let i = 1; i < WAVE_SAMPLES; i++) {
        const age = (head - i + WAVE_SAMPLES) % WAVE_SAMPLES;
        const bright = Math.max(0.18, 1 - age / (WAVE_SAMPLES * 0.7));
        ctx.strokeStyle = `rgba(51,255,51,${bright.toFixed(3)})`;
        ctx.shadowColor = "#33FF33";
        ctx.shadowBlur = bright > 0.6 ? 6 : 0;
        ctx.beginPath();
        ctx.moveTo(px(i - 1), MID - (samples[i - 1] + flicker(i - 1)) * AMP);
        ctx.lineTo(px(i), MID - (samples[i] + flicker(i)) * AMP);
        ctx.stroke();
      }
      ctx.restore();

      // Clamp overlay.
      if (d.selected) {
        const since = d.feedbackAt > 0 ? (now - d.feedbackAt) / 1000 : 0;
        const slip = d.feedback === "slip" ? Math.min(1, since * 2.5) : 0;
        const color =
          d.feedback === "lock" ? "#33FF33" : d.feedback === "slip" ? "#FF4D4D" : "#00FFFF";
        const off = slip * 40 * (1 + 0.3 * Math.sin(since * 30));
        ctx.save();
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.lineWidth = d.feedback === "lock" ? 3 : 2;
        ctx.globalAlpha = d.feedback === "slip" ? 1 - slip * 0.5 : 0.85;
        const scale = AMP * 1.05;
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          for (let i = 0; i <= 80; i++) {
            const x = i / 80;
            const y = MID + sign * (clampEnvelope(d.selected, x) * scale + 4) + sign * off;
            if (i === 0) ctx.moveTo(x * W, y + sign * 10);
            ctx.lineTo(x * W, y);
          }
          ctx.lineTo(W, MID + sign * (clampEnvelope(d.selected, 1) * scale + 14) + sign * off);
          ctx.stroke();
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const confirm = (kind: ClampKind | null = selected) => {
    if (solved || !kind || feedback !== null) return;
    if (kind !== selected) setSelected(kind);
    if (kind === wave.kind) {
      // The final lock is the solving move — the host plays that sound.
      if (round + 1 < rounds) sfx("keypad_beep");
      setFeedback("lock");
      timerRef.current = window.setTimeout(() => {
        const next = round + 1;
        if (next >= rounds) {
          onSolve();
          return;
        }
        setPrevKind(wave.kind);
        setRound(next);
        setAttempt(0);
        setSelected(null);
        setFeedback(null);
      }, FEEDBACK_MS);
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    setFeedback("slip");
    timerRef.current = window.setTimeout(() => {
      setAttempt((a) => a + 1);
      setSelected(null);
      setFeedback(null);
    }, FEEDBACK_MS);
  };

  const select = (kind: ClampKind) => {
    if (solved || feedback !== null) return;
    if (kind !== selected) sfx("ui_click");
    setSelected(kind);
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setRound(0);
    setAttempt((a) => a + 1);
    setPrevKind(undefined);
    setSelected(null);
    setFeedback(null);
  };

  /** Select by index; focus follows when the player is already in the group. */
  const selectAt = (i: number) => {
    select(CLAMPS[i].kind);
    if (feedback === null && optionRefs.current.some((b) => b === document.activeElement))
      optionRefs.current[i]?.focus();
  };

  const cycle = (dir: number) => {
    const at = CLAMPS.findIndex((c) => c.kind === selected);
    const next =
      at < 0 ? (dir > 0 ? 0 : CLAMPS.length - 1) : (at + dir + CLAMPS.length) % CLAMPS.length;
    selectAt(next);
  };

  // Enter / Space clamp the *selected* pattern, even while a card has focus.
  useHotkeys(
    (key) => {
      if (solved) return false;
      const d = Number(key);
      if (Number.isInteger(d) && d >= 1 && d <= CLAMPS.length) {
        selectAt(d - 1);
        return true;
      }
      if (key === "Enter" || key === " ") {
        // Nothing selected yet: a focused card keeps its native click (select).
        if (!selected) return false;
        confirm();
        return true;
      }
      const delta = arrowDelta(key);
      if (delta) {
        cycle(delta[0] !== 0 ? delta[0] : delta[1]);
        return true;
      }
      return false;
    },
    true,
    { claim: ["Enter", " "] },
  );

  const selName = CLAMPS.find((c) => c.kind === selected)?.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#FFB800]">
          {interpolate(header, { round: Math.min(round + 1, rounds), rounds })}
        </span>
        <StepPips done={round + (feedback === "lock" ? 1 : 0)} total={rounds} label={doneLabel} />
      </div>
      <div className={failClass}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className={`w-full rounded-sm border transition-colors ${
            feedback === "slip"
              ? "border-red-500"
              : feedback === "lock"
                ? "border-[#33FF33]"
                : "border-[#33FF33]/40"
          }`}
          role="img"
          aria-label={
            selName
              ? tr("Volatility oscillogram, preview {name}", { name: selName })
              : tr("Volatility oscillogram")
          }
        />
      </div>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="radiogroup"
        aria-label={tr("Clamp patterns")}
      >
        {CLAMPS.map((c, i) => {
          const active = selected === c.kind;
          const hinted = hint && suggested === c.kind;
          return (
            <button
              key={c.kind}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${c.name}, ${c.shape}${hinted ? ` (${tr("MCP suggestion")})` : ""}`}
              tabIndex={active || (!selected && i === 0) ? 0 : -1}
              data-pz-autofocus={i === 0 ? true : undefined}
              onClick={() => select(c.kind)}
              onKeyDown={(e) => {
                // Enter clamps the selection; with none yet, it picks this
                // pattern and clamps in one go.
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm(selected ?? c.kind);
                }
              }}
              disabled={solved}
              className={`relative flex flex-col items-center gap-1 rounded-sm border px-2 py-1.5 text-xs transition-[background-color,box-shadow,border-color] duration-100 ${
                active
                  ? "border-[#00FFFF] bg-[#00FFFF]/10 text-[#00FFFF] shadow-[0_0_8px_rgba(0,255,255,0.4)]"
                  : hinted
                    ? "border-dashed border-[#FFB800] text-[#FFB800]"
                    : "border-[#33FF33]/40 text-[#33FF33] hover:bg-[#33FF33]/10"
              }`}
            >
              <span className="flex w-full justify-between text-[10px] opacity-70">
                <kbd>{i + 1}</kbd>
                <span aria-hidden>{active ? "◉" : hinted ? "?" : "○"}</span>
              </span>
              <ClampIcon
                kind={c.kind}
                color={active ? "#00FFFF" : hinted ? "#FFB800" : "#33FF33"}
              />
              <span className="tracking-wider">{c.name}</span>
              <span className="text-[9px] opacity-60">{c.shape}</span>
            </button>
          );
        })}
      </div>
      <StatusLine tone={feedback === "lock" ? "ok" : feedback === "slip" ? "bad" : "info"}>
        {feedback === "lock"
          ? tr("Clamp {name} grips. Slice secured.", { name: selName ?? "" })
          : feedback === "slip"
            ? tr("Clamp slips. Wrong pattern — a new slice is being loaded.")
            : selected
              ? tr("Preview: {name}. Enter clamps.", { name: selName ?? "" })
              : tr("Pick the pattern that hugs the peaks and troughs.")}
        {fails > 0 && feedback === null ? ` · ${tr("Missed grips: {n}", { n: fails })}` : ""}
      </StatusLine>
      <HintBox show={hint}>
        {tr(
          "Ignore the individual spikes. Read only the envelope: where is the wave wide, where narrow? The pattern marked with a dashed border resonates best — the preview shows whether it hugs the peaks and troughs before you clamp.",
        )}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>1</kbd>–<kbd>4</kbd> {tr("or")} <kbd>←</kbd>
            <kbd>→</kbd> {tr("select")} · <kbd>Enter</kbd>/<kbd>{tr("Spacebar")}</kbd>{" "}
            {tr("clamps")}
          </>
        }
        onReset={reset}
        resetDisabled={solved}
        extra={
          <CrtButton
            tone="cyan"
            onClick={() => confirm()}
            disabled={solved || !selected || feedback !== null}
          >
            {tr("Clamp")}
          </CrtButton>
        }
      />
    </div>
  );
}

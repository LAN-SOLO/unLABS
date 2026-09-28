"use client";

import { fmtNum } from "@/components/world/format";
import { tr } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { num, valveStep } from "@/components/world/puzzles/logic";
import {
  DialGauge,
  Gauge,
  HintBox,
  ProgressBar,
  PuzzleFooter,
  isTypingTarget,
  useFailFx,
  useFailHint,
  useRisingEdge,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const CONTROL_MAX = 40;
const KEY_RATE = 45; // control units per second while an arrow key is held
const CLICK_STEP = 5; // a detent click every 5 control units
/** Losing the band after holding this long counts as a slip (buzz + shake). */
const SLIP_AFTER = 0.8;

const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);

export function ValvePuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const low = num(params, "low", 42);
  const high = num(params, "high", 58);
  const hold = Math.max(0.5, num(params, "hold", 3));
  const sfx = useSfx(sound);

  const [control, setControl] = useState(0);
  const [value, setValue] = useState(50);
  const [held, setHeld] = useState(0);
  const [drift, setDrift] = useState(0);
  const { hint, fail: countSlip } = useFailHint(3, 25, sfx);
  const { failClass, fail: shake } = useFailFx();
  /** Only buzz once the player has actually touched the controls. */
  const touchedRef = useRef(false);
  const heldRef = useRef(0);
  useEffect(() => {
    heldRef.current = held;
  }, [held]);

  const controlRef = useRef(0);
  const keysRef = useRef({ left: false, right: false });
  const onSolveRef = useRef(onSolve);
  useEffect(() => {
    onSolveRef.current = onSolve;
  }, [onSolve]);

  const inBand = value >= low && value <= high;
  useRisingEdge(
    inBand && !solved,
    () => sfx("keypad_beep"),
    () => {
      if (solved || !touchedRef.current || heldRef.current < SLIP_AFTER) return;
      sfx("fail_buzz");
      shake();
      countSlip();
    },
  );

  const detent = (prev: number, next: number) => {
    if (Math.floor(prev / CLICK_STEP) !== Math.floor(next / CLICK_STEP)) sfx("ui_click");
  };

  const applyControl = (v: number) => {
    touchedRef.current = true;
    const c = Math.max(-CONTROL_MAX, Math.min(CONTROL_MAX, v));
    detent(controlRef.current, c);
    controlRef.current = c;
    setControl(c);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // The slider cancels its own native step (see onKeyDown) — anything
      // else that types (none today) keeps its keys.
      if (isTypingTarget(e.target)) return;
      if (LEFT_KEYS.has(e.key)) keysRef.current.left = true;
      else if (RIGHT_KEYS.has(e.key)) keysRef.current.right = true;
      else if (e.key === "n" || e.key === "N" || e.key === "0") {
        controlRef.current = 0;
        setControl(0);
        sfx("ui_click");
      } else return;
      touchedRef.current = true;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      if (LEFT_KEYS.has(e.key)) keysRef.current.left = false;
      if (RIGHT_KEYS.has(e.key)) keysRef.current.right = false;
    };
    const blur = () => {
      keysRef.current.left = false;
      keysRef.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [sfx]);

  useEffect(() => {
    if (solved) return;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let v = 50;
    let slope = 0;
    let inBandFor = 0;
    let done = false;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      const keys = keysRef.current;
      if (keys.left !== keys.right) {
        const prev = controlRef.current;
        const c = prev + (keys.right ? 1 : -1) * KEY_RATE * dt;
        controlRef.current = Math.max(-CONTROL_MAX, Math.min(CONTROL_MAX, c));
        if (Math.floor(prev / CLICK_STEP) !== Math.floor(controlRef.current / CLICK_STEP))
          sfx("ui_click");
        setControl(controlRef.current);
      }
      const nv = valveStep(v, controlRef.current, t, dt);
      if (dt > 0) slope += ((nv - v) / dt - slope) * Math.min(1, dt * 4);
      v = nv;
      inBandFor = v >= low && v <= high ? inBandFor + dt : 0;
      setValue(v);
      setHeld(inBandFor);
      setDrift(slope);
      if (!done && inBandFor >= hold) {
        done = true;
        onSolveRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [low, high, hold, solved, sfx]);

  const driftLabel =
    Math.abs(drift) < 2
      ? tr("steady")
      : drift > 0
        ? tr("rising ▲ — steer left")
        : tr("falling ▼ — steer right");

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex flex-col items-center gap-3 rounded-sm border bg-black/60 p-2 transition-colors sm:flex-row sm:items-end ${
          inBand ? "border-[#33FF33]/40" : "border-[#FFB800]/30"
        } ${failClass}`}
      >
        <DialGauge label={tr("Flow")} value={value} zone={[low, high]} unit=" %" size={190} />
        <div className="flex w-full flex-col gap-3">
          <Gauge label={tr("Flow (linear)")} value={value} zone={[low, high]} unit=" %" />
          <ProgressBar
            value={held / hold}
            label={tr("Held in band: {held} / {hold} s", {
              held: fmtNum(Math.min(held, hold), 1),
              hold: fmtNum(hold, 1),
            })}
          />
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs text-[#FFB800]">
        <span className="flex justify-between">
          <span>{tr("Countersteer")}</span>
          <span className="tabular-nums">
            {control > 0 ? "+" : ""}
            {control.toFixed(0)}
          </span>
        </span>
        <input
          data-pz-autofocus
          aria-label={tr("Countersteer")}
          aria-valuetext={
            inBand
              ? tr("{control}, flow {value} percent, in band", {
                  control: `${control > 0 ? "+" : ""}${control.toFixed(0)}`,
                  value: value.toFixed(0),
                })
              : tr("{control}, flow {value} percent", {
                  control: `${control > 0 ? "+" : ""}${control.toFixed(0)}`,
                  value: value.toFixed(0),
                })
          }
          onKeyDown={(e) => {
            // Arrow keys glide via the held-key loop instead of 1-unit steps.
            if (/^Arrow(Left|Right|Up|Down)$/.test(e.key)) e.preventDefault();
          }}
          type="range"
          min={-CONTROL_MAX}
          max={CONTROL_MAX}
          step={1}
          value={control}
          disabled={solved}
          onChange={(e) => applyControl(Number(e.target.value))}
          className="w-full cursor-ew-resize accent-[#33FF33]"
        />
      </label>
      <p
        className={`text-xs ${inBand ? "text-[#33FF33] [text-shadow:0_0_6px_#33FF33]" : "text-[#FFB800]"}`}
        aria-live="polite"
      >
        <span aria-hidden className="mr-1">
          {inBand ? "▣" : "▲"}
        </span>
        {inBand ? tr("In band — hold.") : tr("Outside the band.")}
      </p>
      <HintBox show={hint && !solved}>
        {tr(
          "Do not chase the needle — it is slower than your hand. Current trend: {trend}. Small corrections, applied early.",
          { trend: driftLabel },
        )}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>←</kbd>/<kbd>→</kbd> {tr("or")} <kbd>A</kbd>/<kbd>D</kbd>{" "}
            {tr("hold to countersteer")} · <kbd>N</kbd> {tr("neutral")} ·{" "}
            {tr("Drag with the mouse")}
          </>
        }
        onReset={() => {
          applyControl(0);
          sfx("ui_click");
        }}
        resetLabel={tr("Neutral")}
        resetDisabled={solved}
      />
    </div>
  );
}

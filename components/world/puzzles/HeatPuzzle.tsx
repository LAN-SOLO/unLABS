"use client";

import { fmtNum } from "@/components/world/format";
import { tr } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import {
  HEAT_ZONE,
  PRESSURE_ZONE,
  heatStep,
  inZone,
  num,
  type HeatState,
} from "@/components/world/puzzles/logic";
import {
  DialGauge,
  HintBox,
  ProgressBar,
  PuzzleFooter,
  useFailFx,
  useFailHint,
  useHotkeys,
  useRisingEdge,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const DETENT = 10;
const START_LEVER = 20;
/** Dropping out of the green after holding this long counts as a slip. */
const SLIP_AFTER = 1;

export function HeatPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const hold = Math.max(0.5, num(params, "hold", 4));
  const sfx = useSfx(sound);
  const [lever, setLever] = useState(START_LEVER);
  const [state, setState] = useState<HeatState>({ heat: 20, pressure: 10 });
  const [held, setHeld] = useState(0);
  const { hint, fail: countSlip } = useFailHint(3, 30, sfx);
  const { failClass, fail: shake } = useFailFx();
  const touchedRef = useRef(false);
  const heldRef = useRef(0);
  useEffect(() => {
    heldRef.current = held;
  }, [held]);

  const leverRef = useRef(START_LEVER);
  const onSolveRef = useRef(onSolve);
  useEffect(() => {
    onSolveRef.current = onSolve;
  }, [onSolve]);

  const bothGreen = inZone(state.heat, HEAT_ZONE) && inZone(state.pressure, PRESSURE_ZONE);
  useRisingEdge(
    bothGreen && !solved,
    () => sfx("keypad_beep"),
    () => {
      if (solved || !touchedRef.current || heldRef.current < SLIP_AFTER) return;
      sfx("fail_buzz");
      shake();
      countSlip();
    },
  );

  const moveLever = (v: number) => {
    if (solved) return;
    const next = Math.max(0, Math.min(100, Math.round(v)));
    if (next === leverRef.current) return;
    if (Math.floor(next / DETENT) !== Math.floor(leverRef.current / DETENT)) sfx("ui_click");
    touchedRef.current = true;
    leverRef.current = next;
    setLever(next);
  };

  // A/D nudge by 5, number keys jump to a detent (3 → 30 … 0 → 100).
  useHotkeys((key) => {
    if (solved) return false;
    if (key === "a" || key === "A") moveLever(leverRef.current - 5);
    else if (key === "d" || key === "D") moveLever(leverRef.current + 5);
    else if (/^[0-9]$/.test(key)) moveLever(key === "0" ? 100 : Number(key) * 10);
    else if (key === "r" || key === "R") {
      moveLever(START_LEVER);
      sfx("ui_click");
    } else return false;
    return true;
  });

  useEffect(() => {
    if (solved) return;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let s: HeatState = { heat: 20, pressure: 10 };
    let inGreen = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      s = heatStep(s, leverRef.current, t, dt);
      inGreen = inZone(s.heat, HEAT_ZONE) && inZone(s.pressure, PRESSURE_ZONE) ? inGreen + dt : 0;
      setState(s);
      setHeld(inGreen);
      if (inGreen >= hold) {
        onSolveRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hold, solved]);

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex flex-wrap items-start justify-around gap-2 rounded-sm border bg-black/60 py-2 transition-colors ${
          bothGreen ? "border-[#33FF33]/50" : "border-[#33FF33]/20"
        } ${failClass}`}
      >
        <DialGauge label={tr("Heat")} value={state.heat} zone={HEAT_ZONE} unit=" °" size={180} />
        <DialGauge
          label={tr("Pressure")}
          value={state.pressure}
          zone={PRESSURE_ZONE}
          unit=" bar"
          size={180}
        />
      </div>
      <ProgressBar
        value={held / hold}
        label={tr("Both in the green: {held} / {hold} s", {
          held: fmtNum(Math.min(held, hold), 1),
          hold: fmtNum(hold, 1),
        })}
      />
      <label className="flex flex-col gap-1 text-xs text-[#FFB800]">
        <span className="flex justify-between">
          <span>{tr("Lever")}</span>
          <span className="tabular-nums">{lever}</span>
        </span>
        <input
          data-pz-autofocus
          aria-label={tr("Lever")}
          aria-valuetext={
            bothGreen
              ? tr("{lever}; heat {heat}, pressure {pressure}, both in the green", {
                  lever,
                  heat: state.heat.toFixed(0),
                  pressure: state.pressure.toFixed(0),
                })
              : tr("{lever}; heat {heat}, pressure {pressure}", {
                  lever,
                  heat: state.heat.toFixed(0),
                  pressure: state.pressure.toFixed(0),
                })
          }
          type="range"
          min={0}
          max={100}
          step={1}
          value={lever}
          disabled={solved}
          onChange={(e) => moveLever(Number(e.target.value))}
          className="w-full cursor-ew-resize accent-[#FFB800]"
        />
      </label>
      <p className="text-xs text-[#33FF33]/70">
        {tr(
          "Heat follows the lever sluggishly, pressure follows the heat even more sluggishly. The anomaly pushes in between. Steer ahead.",
        )}
      </p>
      <HintBox show={hint && !solved}>
        {bothGreen ? tr("Do not touch it now.") : tr("Less is more.")}{" "}
        {tr(
          "Set the lever roughly to the middle of the green heat band, then hands off — the pressure needs a good second to catch up. Whoever keeps readjusting is fighting themselves.",
        )}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>←</kbd>/<kbd>→</kbd> {tr("fine")} · <kbd>A</kbd>/<kbd>D</kbd> ±5 · <kbd>1</kbd>–
            <kbd>0</kbd> {tr("jumps to 10–100")} · <kbd>R</kbd> {tr("Reset lever")}
          </>
        }
        onReset={() => {
          moveLever(START_LEVER);
          sfx("ui_click");
        }}
        resetLabel={tr("Reset lever")}
        resetDisabled={solved}
      />
    </div>
  );
}

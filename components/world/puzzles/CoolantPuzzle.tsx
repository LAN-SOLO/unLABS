"use client";

import { fmtNum } from "@/components/world/format";
import { tr } from "@/lib/i18n";
import { useRef, useState } from "react";
import {
  COOLANTS,
  VISCOSITY_BAND,
  coolantMix,
  coolantOk,
  num,
} from "@/components/world/puzzles/logic";
import {
  HintBox,
  PuzzleFooter,
  SHAPE_GLYPH,
  ShapeMark,
  useFailHint,
  useHotkeys,
  useRisingEdge,
  useSfx,
  type ShapeName,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

const FLUID_COLOR: Record<(typeof COOLANTS)[number]["id"], string> = {
  glykol: "#FFB800",
  stickstoff: "#00FFFF",
  wasser: "#3D8BFF",
};
/** Shape per fluid so the layers read without colour. */
const FLUID_SHAPE: Record<(typeof COOLANTS)[number]["id"], ShapeName> = {
  glykol: "triangle",
  stickstoff: "diamond",
  wasser: "circle",
};
const MAX_PARTS = 30;

function Beaker({ parts }: { parts: readonly number[] }) {
  const total = parts.reduce((a, b) => a + b, 0);
  const innerH = 104;
  const tops = COOLANTS.map(
    (_, i) => 116 - (parts.slice(0, i + 1).reduce((a, b) => a + b, 0) / MAX_PARTS) * innerH,
  );
  const surface = tops[tops.length - 1] ?? 116;
  return (
    <svg viewBox="0 0 80 124" className="h-32 w-20 shrink-0" aria-hidden>
      <path
        d="M 10 6 L 10 112 Q 10 118 16 118 L 64 118 Q 70 118 70 112 L 70 6"
        fill="#050805"
        stroke="#33FF33"
        strokeOpacity={0.5}
        strokeWidth={2}
      />
      {COOLANTS.map((c, i) => {
        const h = (parts[i] / MAX_PARTS) * innerH;
        const y = tops[i];
        return (
          <g key={c.id}>
            <rect
              x={12}
              y={y}
              width={56}
              height={h}
              fill={FLUID_COLOR[c.id]}
              fillOpacity={0.45}
              className="transition-all duration-300"
            />
            {h >= 9 && (
              <ShapeMark
                shape={FLUID_SHAPE[c.id]}
                cx={40}
                cy={y + h / 2}
                r={3.5}
                fill="#0D0D0D"
                opacity={0.75}
              />
            )}
          </g>
        );
      })}
      {total > 0 && (
        <line
          x1={12}
          x2={68}
          y1={surface}
          y2={surface}
          stroke="#E8FFE8"
          strokeOpacity={0.8}
          style={{ filter: "drop-shadow(0 0 3px #E8FFE8)" }}
        />
      )}
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={62}
          x2={70}
          y1={116 - f * innerH}
          y2={116 - f * innerH}
          stroke="#33FF33"
          strokeOpacity={0.4}
        />
      ))}
    </svg>
  );
}

export function CoolantPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const target = num(params, "target", -12);
  const sfx = useSfx(sound);
  const [parts, setParts] = useState<number[]>([0, 0, 0]);
  const [changes, setChanges] = useState(0);
  const { hint: timeHint } = useFailHint(99, 35, sfx);
  const hint = (timeHint || changes >= 18) && !solved;
  useRisingEdge(changes >= 18 && !timeHint, () => sfx("hint_pop"));
  const sliderRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mix = coolantMix(parts);
  const tempOk = mix.total > 0 && Math.abs(mix.temp - target) <= 1;
  const viscOk =
    mix.total > 0 && mix.viscosity >= VISCOSITY_BAND[0] && mix.viscosity <= VISCOSITY_BAND[1];
  useRisingEdge(tempOk && !solved, () => sfx("keypad_beep"));
  useRisingEdge(viscOk && !solved, () => sfx("keypad_beep"));

  const set = (i: number, v: number) => {
    if (solved || parts[i] === v) return;
    const next = parts.slice();
    next[i] = v;
    setParts(next);
    setChanges((c) => c + 1);
    if (coolantOk(coolantMix(next), target)) {
      onSolve();
      return;
    }
    sfx("ui_click");
  };

  const drain = () => {
    if (solved) return;
    setParts([0, 0, 0]);
    sfx("ui_click");
  };

  // 1–3 pick a fluid slider (arrows then dose it), R drains the beaker.
  useHotkeys((key) => {
    if (solved) return false;
    const i = ["1", "2", "3"].indexOf(key);
    if (i >= 0) {
      sliderRefs.current[i]?.focus();
      return true;
    }
    if (key === "r" || key === "R") {
      drain();
      return true;
    }
    return false;
  });

  const mark = (ok: boolean) => (
    <span aria-hidden className="ml-1">
      {ok ? "✓" : "✗"}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Beaker parts={parts} />
        <div className="flex w-full flex-col gap-3">
          {COOLANTS.map((c, i) => (
            <label key={c.id} className="flex flex-col gap-1 text-xs text-[#FFB800]">
              <span className="flex justify-between">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block w-3 text-center"
                    style={{
                      color: FLUID_COLOR[c.id],
                      textShadow: `0 0 5px ${FLUID_COLOR[c.id]}`,
                    }}
                  >
                    {SHAPE_GLYPH[FLUID_SHAPE[c.id]]}
                  </span>
                  <kbd aria-hidden>{i + 1}</kbd>
                  {c.label} ({c.temp > 0 ? "+" : ""}
                  {c.temp} °C · {fmtNum(c.viscosity, 1)} cP)
                </span>
                <span className="text-[#33FF33] tabular-nums">
                  {tr("{n} parts", { n: parts[i] })}
                </span>
              </span>
              <input
                ref={(el) => {
                  sliderRefs.current[i] = el;
                }}
                data-pz-autofocus={i === 0 ? "" : undefined}
                aria-label={tr("{fluid}, parts", { fluid: c.label })}
                aria-valuetext={tr("{n} parts {fluid}", { n: parts[i], fluid: c.label })}
                type="range"
                min={0}
                max={10}
                step={1}
                value={parts[i]}
                disabled={solved}
                onChange={(e) => set(i, Number(e.target.value))}
                className="w-full cursor-ew-resize accent-[#33FF33]"
              />
            </label>
          ))}
        </div>
      </div>
      <div
        className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-sm border border-[#33FF33]/30 bg-black p-3 text-sm"
        aria-live="polite"
      >
        <span className="text-[#FFB800]">{tr("Mix temperature")}</span>
        <span className={tempOk ? "text-[#33FF33] [text-shadow:0_0_6px_#33FF33]" : "text-red-400"}>
          {mix.total > 0 ? `${fmtNum(mix.temp, 1)} °C` : "—"}
          {mix.total > 0 && mark(tempOk)}{" "}
          <span className="text-[#00FFFF]/70">{tr("(target {target} ±1)", { target })}</span>
        </span>
        <span className="text-[#FFB800]">{tr("Viscosity")}</span>
        <span className={viscOk ? "text-[#33FF33] [text-shadow:0_0_6px_#33FF33]" : "text-red-400"}>
          {mix.total > 0 ? `${fmtNum(mix.viscosity, 2)} cP` : "—"}
          {mix.total > 0 && mark(viscOk)}{" "}
          <span className="text-[#00FFFF]/70">
            ({fmtNum(VISCOSITY_BAND[0], 1)}–{fmtNum(VISCOSITY_BAND[1], 1)})
          </span>
        </span>
        <span className="text-[#FFB800]">{tr("Total")}</span>
        <span className="text-[#33FF33]">{tr("{n} parts", { n: mix.total })}</span>
      </div>
      <HintBox show={hint}>
        {tr(
          "Nitrogen pushes the temperature down hard and thins the mix. Glycol thickens, water warms and thins. Start with equal parts and correct in single steps — the ratio counts, not the amount.",
        )}
      </HintBox>
      <PuzzleFooter
        help={
          <>
            <kbd>1</kbd>–<kbd>3</kbd> {tr("selects a fluid")} · <kbd>←</kbd>/<kbd>→</kbd>{" "}
            {tr("doses")} · <kbd>R</kbd> {tr("drains")}
          </>
        }
        onReset={drain}
        resetLabel={tr("Drain")}
        resetDisabled={solved}
      />
    </div>
  );
}

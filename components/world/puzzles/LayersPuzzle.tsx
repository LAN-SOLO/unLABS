"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  COVERAGE_MIN,
  INTERFERENCES,
  INTERFERENCE_LABEL,
  MATERIALS,
  blockingSlot,
  coverage,
  evaluateStack,
  generateLayers,
  ruleText,
  type Interference,
  type StackEvaluation,
} from "@/components/world/puzzles/engine/layers";
import { num } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StatusLine,
  useFailFx,
  useFailHint,
  useHotkeys,
  usePuzzleFx,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { tr } from "@/lib/i18n";

const SLOT_H = 40;
const GAP = 4;
const TOP = 24;
const LANE_W = 26;
/** Misses after which the MCP names the outer layer (second hint stage). */
const REVEAL_FAILS = 6;
const LANE_COLOR: Record<Interference, string> = {
  rf: "#00FFFF",
  thermik: "#FFB800",
  mechanik: "#FF6FD8",
};

function arrowPath(t: Interference, x: number, y1: number, y2: number): string {
  if (t === "mechanik") return `M${x},${y1} L${x},${y2}`;
  const pts: string[] = [`M${x},${y1}`];
  const step = 8;
  let i = 0;
  for (let y = y1 + step; y <= y2; y += step) {
    i++;
    const dx = t === "rf" ? (i % 2 === 0 ? 6 : -6) : 6 * Math.sin((y - y1) / 6);
    pts.push(`L${x + dx},${y}`);
  }
  pts.push(`L${x},${y2}`);
  return pts.join(" ");
}

type Tested = { stack: (number | null)[]; ev: StackEvaluation; n: number };

export function LayersPuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 5);
  const slotParam = num(params, "slots", 5);
  const puzzle = useMemo(() => generateLayers(seed, slotParam), [seed, slotParam]);
  const { slots, rules } = puzzle;

  const [stack, setStack] = useState<(number | null)[]>(() =>
    new Array<number | null>(slots).fill(null),
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [tested, setTested] = useState<Tested | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "info"; text: string }>({
    tone: "info",
    text: tr("Fill all {n} layers. Every interference type must hit ≥ {min} % somewhere.", {
      n: slots,
      min: COVERAGE_MIN,
    }),
  });
  const sfx = useSfx(sound);
  const { fail, hint, fails } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const reveal = fails >= REVEAL_FAILS ? puzzle.solutions[0] : undefined;
  const { reduceMotion } = usePuzzleFx();

  const cov = coverage(stack);
  const liveEval = evaluateStack(stack, rules);

  const place = (m: number, slot: number) => {
    if (solved) return;
    sfx("ui_click");
    setStack((s) => s.map((x, i) => (i === slot ? m : x === m ? null : x)));
    setPicked(null);
    setTested(null);
  };

  const clear = (slot: number) => {
    if (solved) return;
    sfx("ui_click");
    setStack((s) => s.map((x, i) => (i === slot ? null : x)));
    setTested(null);
  };

  const clickSlot = (slot: number) => {
    if (solved) return;
    setCursor(slot);
    if (picked !== null) place(picked, slot);
    else {
      const m = stack[slot];
      if (m !== null) {
        clear(slot);
        setPicked(m);
      }
    }
  };

  const test = () => {
    if (solved) return;
    const ev = evaluateStack(stack, rules);
    setTested((t) => ({ stack: stack.slice(), ev, n: (t?.n ?? 0) + 1 }));
    if (!ev.complete) {
      failFx();
      sfx("fail_buzz");
      setStatus({ tone: "bad", text: tr("Layers still empty — the housing is open.") });
      return;
    }
    if (ev.ok) {
      setStatus({
        tone: "ok",
        text: tr("SHIELDED. All three interference types are stopped at the wall."),
      });
      onSolve();
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    const leaks = INTERFERENCES.filter((t) => ev.coverage[t] < COVERAGE_MIN).map(
      (t) => INTERFERENCE_LABEL[t],
    );
    const parts: string[] = [];
    if (leaks.length > 0) parts.push(tr("Breakthrough: {list}", { list: leaks.join(", ") }));
    if (ev.violations.length === 1) parts.push(tr("1 rule broken"));
    else if (ev.violations.length > 1)
      parts.push(tr("{n} rules broken", { n: ev.violations.length }));
    setStatus({
      tone: "bad",
      text: tr("Shielding insufficient. {details}.", { details: parts.join(" · ") }),
    });
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    setStack(new Array<number | null>(slots).fill(null));
    setPicked(null);
    setTested(null);
    setCursor(0);
    setStatus({ tone: "info", text: tr("Housing emptied. New stack.") });
  };

  const togglePick = (m: number) => {
    sfx("ui_click");
    setPicked((p) => (p === m ? null : m));
  };
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /**
   * Moves the layer cursor; DOM focus follows while it sits on a layer, so a
   * native Enter/Space click on the focused button hits the cursor's layer.
   */
  const moveCursor = (d: number) => {
    const next = (cursor + slots + d) % slots;
    setCursor(next);
    if (slotRefs.current.some((b) => b !== null && b === document.activeElement))
      slotRefs.current[next]?.focus();
  };
  useHotkeys((key) => {
    if (solved) return false;
    const d = Number(key);
    const k = key.toLowerCase();
    if (Number.isInteger(d) && d >= 1 && d <= MATERIALS.length) togglePick(d - 1);
    else if (key === "ArrowUp" || k === "w") moveCursor(-1);
    else if (key === "ArrowDown" || k === "s") moveCursor(1);
    else if (key === "Enter" || key === " ") {
      if (picked !== null) place(picked, cursor);
      else clickSlot(cursor);
    } else if (key === "Backspace" || key === "Delete") clear(cursor);
    else if (k === "t") test();
    else return false;
    return true;
  }, !solved);

  const onDragStart = (e: DragEvent, m: number) => {
    e.dataTransfer.setData("text/plain", String(m));
    e.dataTransfer.effectAllowed = "move";
  };
  const dropMaterial = (e: DragEvent): number | null => {
    e.preventDefault();
    const m = Number(e.dataTransfer.getData("text/plain"));
    return Number.isInteger(m) && m >= 0 && m < MATERIALS.length ? m : null;
  };

  const housingH = TOP + slots * (SLOT_H + GAP) + 20;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Housing */}
        <div className="flex gap-1 self-center sm:self-start">
          <svg
            width={LANE_W * 3}
            height={housingH}
            viewBox={`0 0 ${LANE_W * 3} ${housingH}`}
            aria-hidden
            className="shrink-0"
          >
            {INTERFERENCES.map((t, k) => {
              const x = LANE_W * k + LANE_W / 2;
              const label = (
                <text
                  key={`l${t}`}
                  x={x}
                  y={12}
                  textAnchor="middle"
                  fontSize={8}
                  fill={LANE_COLOR[t]}
                  fontFamily="monospace"
                >
                  {t === "rf" ? "RF" : t === "thermik" ? "TH" : "ME"}
                </text>
              );
              if (!tested || !tested.ev.complete) return label;
              const b = blockingSlot(tested.stack, t);
              const y2 = b >= 0 ? TOP + b * (SLOT_H + GAP) + SLOT_H / 2 : housingH - 4;
              return (
                <g key={`${t}${tested.n}`}>
                  {label}
                  <path
                    d={arrowPath(t, x, TOP - 4, y2)}
                    stroke={b >= 0 ? LANE_COLOR[t] : "#FF4040"}
                    strokeWidth={2}
                    fill="none"
                    pathLength={1}
                    strokeDasharray="1"
                    strokeDashoffset="0"
                    style={{ filter: `drop-shadow(0 0 3px ${b >= 0 ? LANE_COLOR[t] : "#FF4040"})` }}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="1"
                      to="0"
                      dur={reduceMotion ? "0.001s" : "0.9s"}
                    />
                  </path>
                  <text
                    x={x}
                    y={y2 + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fill={b >= 0 ? "#33FF33" : "#FF4040"}
                    fontFamily="monospace"
                  >
                    {b >= 0 ? "■" : "!"}
                  </text>
                </g>
              );
            })}
          </svg>
          <div
            className={`flex w-full max-w-56 min-w-0 flex-col rounded-sm border-2 border-[#555] bg-[#111] p-1 sm:w-56 ${failClass}`}
            role="list"
            aria-label={tr("Housing cross-section")}
          >
            <div className="h-[14px] text-center text-[9px] tracking-widest text-[#FFB800]">
              {tr("OUTSIDE ▼ INTERFERENCE FIELD")}
            </div>
            {stack.map((m, slot) => {
              const mat = m === null ? null : MATERIALS[m];
              const isCur = cursor === slot;
              return (
                <button
                  key={slot}
                  ref={(el) => {
                    slotRefs.current[slot] = el;
                  }}
                  type="button"
                  role="listitem"
                  disabled={solved}
                  draggable={mat !== null && !solved}
                  onDragStart={(e) => m !== null && onDragStart(e, m)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const dm = dropMaterial(e);
                    if (dm !== null) place(dm, slot);
                  }}
                  onClick={() => clickSlot(slot)}
                  onFocus={() => setCursor(slot)}
                  className={`relative flex items-center justify-between rounded-sm border px-2 text-xs transition-[background-color,filter] ${
                    isCur ? "border-[#00FFFF]" : "border-[#33FF33]/25"
                  } ${mat ? "text-black hover:brightness-110" : "text-[#33FF33]/40 hover:bg-[#33FF33]/10"} ${
                    picked !== null && !solved ? "border-dashed" : ""
                  }`}
                  style={{
                    height: SLOT_H,
                    marginTop: GAP,
                    background: mat
                      ? `repeating-linear-gradient(135deg, ${mat.color}, ${mat.color} 6px, ${mat.color}CC 6px, ${mat.color}CC 9px)`
                      : undefined,
                    boxShadow: isCur
                      ? "0 0 8px #00FFFF"
                      : mat
                        ? `inset 0 0 6px rgba(0,0,0,0.5), 0 0 6px ${mat.color}55`
                        : undefined,
                  }}
                  aria-label={
                    picked !== null
                      ? tr("Layer {n}: {mat} — insert {pick} here", {
                          n: slot + 1,
                          mat: mat ? mat.label : tr("empty"),
                          pick: MATERIALS[picked].label,
                        })
                      : tr("Layer {n}: {mat}", { n: slot + 1, mat: mat ? mat.label : tr("empty") })
                  }
                >
                  <span className={mat ? "font-bold" : ""}>
                    {slot + 1}. {mat ? mat.label : `— ${tr("empty")} —`}
                  </span>
                  {mat && (
                    <span className="text-[9px] opacity-80">
                      {mat.profile.rf}/{mat.profile.thermik}/{mat.profile.mechanik}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="mt-1 h-[14px] text-center text-[9px] tracking-widest text-[#33FF33]/50">
              {tr("INSIDE · DEVICE CORE")}
            </div>
          </div>
        </div>

        {/* Tray */}
        <div
          className="flex flex-1 flex-col gap-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const dm = dropMaterial(e);
            if (dm !== null) {
              const slot = stack.indexOf(dm);
              if (slot >= 0) clear(slot);
            }
          }}
        >
          <div className="text-xs text-[#FFB800]">
            {tr("Material store (RF / Thermal / Mechanical)")}
          </div>
          {MATERIALS.map((mat, i) => {
            const used = stack.includes(i);
            const isPicked = picked === i;
            return (
              <button
                key={mat.id}
                type="button"
                draggable={!solved}
                disabled={solved}
                onDragStart={(e) => onDragStart(e, i)}
                onClick={() => togglePick(i)}
                aria-pressed={isPicked}
                className={`flex items-center gap-2 rounded-sm border px-2 py-1 text-left text-xs transition-colors ${
                  isPicked
                    ? "border-[#00FFFF] bg-[#00FFFF]/15 text-[#00FFFF]"
                    : "border-[#33FF33]/30 text-[#33FF33] hover:bg-[#33FF33]/10"
                } ${used ? "opacity-50" : ""}`}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-sm border border-black"
                  style={{ background: mat.color }}
                />
                <span className="w-28 shrink-0">
                  {i + 1} {mat.label}
                </span>
                <span className="flex flex-1 gap-1">
                  {INTERFERENCES.map((t) => (
                    <span
                      key={t}
                      className="h-2 flex-1 rounded-sm bg-black"
                      title={`${INTERFERENCE_LABEL[t]} ${mat.profile[t]} %`}
                    >
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${mat.profile[t]}%`,
                          background:
                            mat.profile[t] >= COVERAGE_MIN ? LANE_COLOR[t] : `${LANE_COLOR[t]}66`,
                        }}
                      />
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
          <div className="mt-1 grid grid-cols-3 gap-2 text-[10px]">
            {INTERFERENCES.map((t) => (
              <div key={t} className={cov[t] >= COVERAGE_MIN ? "text-[#33FF33]" : "text-red-400"}>
                <span aria-hidden>{cov[t] >= COVERAGE_MIN ? "✓ " : "✗ "}</span>
                {INTERFERENCE_LABEL[t]}: {cov[t]} %
              </div>
            ))}
          </div>
        </div>
      </div>

      <ol className="flex flex-col gap-0.5 rounded-sm border border-[#33FF33]/30 bg-black p-2 text-xs">
        <li className="mb-1 text-[#FFB800]">{tr("Lawrence protocol, layer rules:")}</li>
        {rules.map((r, k) => {
          const liveBad = hint && liveEval.violations.includes(k);
          return (
            <li key={k} className={liveBad ? "text-red-400" : "text-[#33FF33]/90"}>
              {k + 1}. {ruleText(r)}
              {hint && (liveBad ? " ✗" : liveEval.complete ? " ✓" : "")}
            </li>
          );
        })}
      </ol>

      <StatusLine tone={status.tone}>{status.text}</StatusLine>
      <HintBox show={hint && !solved}>
        {tr("Broken rules are now marked red (✗) — live, while you stack.")}{" "}
        {liveEval.violations.length > 0
          ? tr("Currently broken: {list}.", {
              list: liveEval.violations.map((v) => tr("No. {n}", { n: v + 1 })).join(", "),
            })
          : tr(
              "No rule is broken right now — check the coverage: every interference type needs at least one layer that actually stops it.",
            )}
        {reveal &&
          ` ${tr("And a favour between friends: outside, layer 1, takes {mat}.", { mat: MATERIALS[reveal[0]].label })}`}
      </HintBox>
      <div className={`flex justify-end ${failClass}`}>
        <CrtButton tone="cyan" onClick={test} disabled={solved}>
          {tr("Test (T)")}
        </CrtButton>
      </div>
      <PuzzleFooter
        help={
          <>
            {tr("Drag or click")} · <kbd>1</kbd>–<kbd>{MATERIALS.length}</kbd> {tr("material")} ·{" "}
            <kbd>↑↓</kbd>/<kbd>W</kbd>
            <kbd>S</kbd> {tr("layer")} · <kbd>Enter</kbd> {tr("place/pick up")} · <kbd>⌫</kbd>{" "}
            {tr("clear")} · <kbd>T</kbd> {tr("test")} · {tr("Failed attempts: {n}", { n: fails })}
          </>
        }
        onReset={reset}
        resetDisabled={solved}
      />
    </div>
  );
}

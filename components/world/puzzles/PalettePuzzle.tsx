"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import {
  clueHolds,
  clueText,
  colorName,
  generatePalette,
  mixColor,
  toHex,
  wiringSolved,
} from "@/components/world/puzzles/engine/palette";
import { num } from "@/components/world/puzzles/logic";
import { tr } from "@/lib/i18n";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  SHAPE_GLYPH,
  ShapeMark,
  StatusLine,
  shapeAt,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";

/** Wide enough for the jack labels on both sides (≈ 12 monospace chars each). */
const W = 520;
const ROW = 56;
const IN_X = 104;
const OUT_X = 360;
const JACK_R = 12;
const OUT_KEYS = ["a", "b", "c", "d", "e"];
/** Misses after which the MCP pins one correct cable (second hint stage). */
const REVEAL_FAILS = 6;
/** Per-input dash pattern so cables differ by more than colour. */
const WIRE_DASH = [undefined, "10 4", "3 3", "12 3 3 3", "6 2 1 2"];

function wirePath(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + mid},${y1} ${x2 - mid},${y2} ${x2},${y2}`;
}

interface Drag {
  input: number;
  x: number;
  y: number;
  moved: boolean;
}

export function PalettePuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 2400);
  const channelCount = num(params, "channels", 4);
  const puzzle = useMemo(() => generatePalette(seed, channelCount), [seed, channelCount]);
  const { channels, solution, clues } = puzzle;
  const n = channels.length;
  const H = n * ROW + 24;
  const rowY = (i: number) => 24 + i * ROW + ROW / 2 - 12;

  const [perm, setPerm] = useState<(number | null)[]>(() => new Array<number | null>(n).fill(null));
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "info"; text: string }>({
    tone: "info",
    text: tr("Wire each colour to exactly one channel. The notes fix the assignment."),
  });
  const sfx = useSfx(sound);
  const { fail, hint, fails } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  const svgRef = useRef<SVGSVGElement | null>(null);
  /** Second hint stage: one input whose correct channel is revealed. */
  const revealed =
    fails >= REVEAL_FAILS && !solved ? solution.findIndex((o, i) => perm[i] !== o) : -1;

  const mix = mixColor(perm, channels);
  const target = mixColor(solution, channels);
  const allWired = perm.every((o) => o !== null);

  const connect = (input: number, out: number) => {
    if (solved) return;
    sfx("ui_click");
    setPerm((p) => p.map((o, i) => (i === input ? out : o === out ? null : o)));
    setSelected(null);
  };

  const unwire = (input: number) => {
    if (solved) return;
    sfx("ui_click");
    setPerm((p) => p.map((o, i) => (i === input ? null : o)));
  };

  const unwireOutput = (out: number) => {
    if (solved) return;
    sfx("ui_click");
    setPerm((p) => p.map((o) => (o === out ? null : o)));
  };

  const submit = () => {
    if (solved) return;
    if (!allWired) {
      failFx();
      sfx("fail_buzz");
      setStatus({ tone: "bad", text: tr("Not all channels are patched yet.") });
      return;
    }
    if (wiringSolved(perm, solution)) {
      setStatus({
        tone: "ok",
        text: tr("Palette mapped: [{color}]. The spectrum obeys.", { color: colorName(target) }),
      });
      onSolve();
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    const correct = perm.filter((o, i) => o === solution[i]).length;
    setStatus({
      tone: "bad",
      text: hint
        ? tr("Wrong mix: [{mix}] instead of [{target}]. {correct}/{n} cables are right.", {
            mix: colorName(mix),
            target: colorName(target),
            correct,
            n,
          })
        : tr("Wrong mix: [{mix}] instead of [{target}].", {
            mix: colorName(mix),
            target: colorName(target),
          }),
    });
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    setPerm(new Array<number | null>(n).fill(null));
    setSelected(null);
    setStatus({ tone: "info", text: tr("All cables pulled. Start fresh.") });
  };

  const toSvg = (e: PointerEvent<SVGElement>): [number, number] => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  };

  const onInputDown = (e: PointerEvent<SVGElement>, input: number) => {
    if (solved) return;
    e.preventDefault();
    const [x, y] = toSvg(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    setDrag({ input, x, y, moved: false });
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const [x, y] = toSvg(e);
    const moved = drag.moved || Math.hypot(x - IN_X, y - rowY(drag.input)) > JACK_R + 4;
    setDrag({ ...drag, x, y, moved });
  };

  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const [x, y] = toSvg(e);
    const out = channels.findIndex((_, o) => Math.hypot(x - OUT_X, y - rowY(o)) <= JACK_R + 12);
    if (out >= 0) connect(drag.input, out);
    else if (!drag.moved) {
      sfx("ui_click");
      setSelected((s) => (s === drag.input ? null : drag.input));
    } else unwire(drag.input);
    setDrag(null);
  };

  const onOutputClick = (out: number) => {
    if (solved) return;
    if (selected !== null) connect(selected, out);
    else unwireOutput(out);
  };

  const selectInput = (i: number) => {
    sfx("ui_click");
    setSelected(i);
  };
  useHotkeys((key) => {
    if (solved) return false;
    const d = Number(key);
    const oi = OUT_KEYS.indexOf(key.toLowerCase());
    if (Number.isInteger(d) && d >= 1 && d <= n) selectInput(d - 1);
    else if (oi >= 0 && oi < n) {
      if (selected !== null) connect(selected, oi);
      else {
        sfx("fail_buzz");
        setStatus({
          tone: "bad",
          text: tr("Pick an input first (1–{n}), then the channel.", { n }),
        });
      }
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      const step = key === "ArrowUp" ? -1 : 1;
      selectInput(selected === null ? (step > 0 ? 0 : n - 1) : (selected + step + n) % n);
    } else if ((key === "ArrowRight" || key === " ") && selected !== null) {
      // Plug the selected input into the next free channel (cycling).
      const cur = perm[selected];
      const start = cur === null ? 0 : cur + 1;
      for (let k = 0; k < n; k++) {
        const o = (start + k) % n;
        if (!perm.includes(o) || o === cur) {
          connect(selected, o);
          setSelected(selected);
          break;
        }
      }
    } else if (
      (key === "Backspace" || key === "Delete" || key === "ArrowLeft") &&
      selected !== null
    )
      unwire(selected);
    else if (key === "Enter") submit();
    else return false;
    return true;
  }, !solved);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <ol className="flex flex-col gap-1 rounded-sm border border-[#33FF33]/30 bg-black p-2 text-xs">
          <li className="mb-1 text-[#FFB800]">{tr("Fridge's wiring notes (2005):")}</li>
          {clues.map((c, k) => {
            const ok = clueHolds(c, perm, channels);
            return (
              <li key={k} className="flex gap-2 text-[#33FF33]/90">
                <span className="w-4 shrink-0 text-center">
                  {hint ? (
                    ok === null ? (
                      <span className="text-[#33FF33]/40">?</span>
                    ) : ok ? (
                      <span className="text-[#33FF33]">✓</span>
                    ) : (
                      <span className="text-red-400">✗</span>
                    )
                  ) : (
                    <span className="text-[#33FF33]/40">{k + 1}.</span>
                  )}
                </span>
                <span>{clueText(c, channels)}</span>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-row gap-3 text-[10px] sm:flex-col">
          {[
            { label: tr("Preview"), rgb: mix, show: perm.some((o) => o !== null) },
            { label: tr("Target"), rgb: target, show: true },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-[#FFB800]">{s.label}</span>
              <div
                className="h-10 w-24 rounded-sm border border-[#33FF33]/40"
                style={{
                  background: s.show ? toHex(s.rgb) : "#000",
                  boxShadow: s.show ? `0 0 10px ${toHex(s.rgb)}` : undefined,
                }}
              />
              <span style={{ color: s.show ? toHex(s.rgb) : "#33FF33" }}>
                [{s.show ? colorName(s.rgb).toUpperCase() : "—"}: ####]
              </span>
            </div>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`w-full max-w-[560px] touch-none self-center rounded-sm border border-[#33FF33]/30 bg-[#0A0F0A] select-none ${failClass}`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDrag(null)}
        role="group"
        // Keyboard play starts on the panel: the »Feed in« button is disabled
        // until every cable is patched, and Enter must never hit »Reset«.
        tabIndex={0}
        data-pz-autofocus
        aria-label={
          selected !== null
            ? tr("Patch panel, selected: input {i} {label}", {
                i: selected + 1,
                label: channels[selected].label,
              })
            : tr("Patch panel")
        }
      >
        <text
          x={IN_X}
          y={16}
          textAnchor="middle"
          fontSize={10}
          fill="#FFB800"
          fontFamily="monospace"
        >
          {tr("INPUT")}
        </text>
        <text
          x={OUT_X}
          y={16}
          textAnchor="middle"
          fontSize={10}
          fill="#FFB800"
          fontFamily="monospace"
        >
          {tr("OUTPUT")}
        </text>
        {perm.map((o, i) =>
          o === null || (drag !== null && drag.input === i && drag.moved) ? null : (
            <g key={`w${i}`}>
              <path
                d={wirePath(IN_X + JACK_R, rowY(i), OUT_X - JACK_R, rowY(o))}
                stroke={channels[i].color}
                strokeWidth={4}
                strokeDasharray={WIRE_DASH[i]}
                fill="none"
                className="cursor-pointer"
                style={{ filter: `drop-shadow(0 0 4px ${channels[i].color})` }}
                onClick={() => unwire(i)}
              />
              <path
                d={wirePath(IN_X + JACK_R, rowY(i), OUT_X - JACK_R, rowY(o))}
                stroke="#FFFFFF"
                strokeOpacity={0.65}
                strokeWidth={1.4}
                fill="none"
                className="pz-flow"
                pointerEvents="none"
              />
            </g>
          ),
        )}
        {drag && drag.moved && (
          <path
            d={wirePath(IN_X + JACK_R, rowY(drag.input), drag.x, drag.y)}
            stroke={channels[drag.input].color}
            strokeWidth={4}
            strokeDasharray="6 4"
            fill="none"
            pointerEvents="none"
          />
        )}
        {channels.map((ch, i) => {
          const y = rowY(i);
          const isSel = selected === i;
          return (
            <g
              key={ch.id}
              className={solved ? "" : "cursor-grab"}
              onPointerDown={(e) => onInputDown(e, i)}
              role="button"
              aria-label={
                perm[i] !== null
                  ? tr("Input {i}: {label}, channel {n}", {
                      i: i + 1,
                      label: ch.label,
                      n: (perm[i] ?? 0) + 1,
                    })
                  : tr("Input {i}: {label}", { i: i + 1, label: ch.label })
              }
            >
              <text
                x={IN_X - 22}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill={ch.color}
                fontFamily="monospace"
              >
                {i + 1} {SHAPE_GLYPH[shapeAt(i)]} {ch.label}
              </text>
              <circle
                cx={IN_X}
                cy={y}
                r={JACK_R}
                fill="#111"
                stroke={isSel ? "#00FFFF" : ch.color}
                strokeWidth={isSel ? 3 : 2}
                style={isSel ? { filter: "drop-shadow(0 0 6px #00FFFF)" } : undefined}
              />
              <ShapeMark
                shape={shapeAt(i)}
                cx={IN_X}
                cy={y}
                r={5}
                fill={perm[i] !== null ? ch.color : "#555"}
              />
              {revealed === i && (
                <circle
                  cx={IN_X}
                  cy={y}
                  r={JACK_R + 5}
                  fill="none"
                  stroke="#FFB800"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  className="animate-pulse"
                />
              )}
            </g>
          );
        })}
        {channels.map((_, o) => {
          const y = rowY(o);
          const src = perm.findIndex((p) => p === o);
          const color = src >= 0 ? channels[src].color : "#33FF33";
          return (
            <g
              key={`o${o}`}
              className={solved ? "" : "cursor-pointer"}
              onClick={() => onOutputClick(o)}
              role="button"
              aria-label={
                src >= 0
                  ? tr("Channel {n}: {label}", { n: o + 1, label: channels[src].label })
                  : tr("Channel {n}", { n: o + 1 })
              }
            >
              <circle cx={OUT_X} cy={y} r={JACK_R + 6} fill="transparent" />
              <circle
                cx={OUT_X}
                cy={y}
                r={JACK_R}
                fill="#111"
                stroke={color}
                strokeWidth={2}
                opacity={src >= 0 ? 1 : 0.6}
              />
              {src >= 0 ? (
                <ShapeMark shape={shapeAt(src)} cx={OUT_X} cy={y} r={5} fill={color} />
              ) : (
                <circle cx={OUT_X} cy={y} r={4} fill="#333" />
              )}
              <text x={OUT_X + 22} y={y + 4} fontSize={11} fill="#33FF33" fontFamily="monospace">
                {OUT_KEYS[o].toUpperCase()} · {tr("Channel {n}", { n: o + 1 })}
              </text>
            </g>
          );
        })}
      </svg>

      <StatusLine tone={status.tone}>{status.text}</StatusLine>
      <HintBox show={hint && !solved}>
        {tr(
          "The notes now show live which condition your wiring meets (✓) and which it doesn't (✗). Channel 1 dominates the mix. Start with the note that pins down a single colour.",
        )}
        {revealed >= 0 &&
          ` ${tr("And since I am feeling generous today: {label} belongs on channel {n}.", {
            label: channels[revealed].label,
            n: solution[revealed] + 1,
          })}`}
      </HintBox>
      <div className={`flex justify-end gap-2 ${failClass}`}>
        <CrtButton tone="cyan" onClick={submit} disabled={solved || !allWired}>
          {tr("Feed in (Enter)")}
        </CrtButton>
      </div>
      <PuzzleFooter
        help={
          <>
            {tr("Drag: input → channel")} · <kbd>1</kbd>–<kbd>{n}</kbd>/<kbd>↑↓</kbd>{" "}
            {tr("select input")} · <kbd>{OUT_KEYS[0].toUpperCase()}</kbd>–
            <kbd>{OUT_KEYS[n - 1].toUpperCase()}</kbd> {tr("plug in")} · <kbd>→</kbd>/
            <kbd>{tr("Space")}</kbd> {tr("next free channel")} · <kbd>⌫</kbd>/<kbd>←</kbd>{" "}
            {tr("unplug")} · <kbd>Enter</kbd> {tr("feed in")} ·{" "}
            {tr("Failed attempts: {n}", { n: fails })}
          </>
        }
        onReset={reset}
        resetDisabled={solved}
      />
    </div>
  );
}

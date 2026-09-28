"use client";

import { useMemo, useState } from "react";
import {
  bestCycle,
  generateMarket,
  isClosedRoute,
  pathYield,
} from "@/components/world/puzzles/engine/arbitrage";
import { fmtNum } from "@/components/world/format";
import { num } from "@/components/world/puzzles/logic";
import {
  CrtButton,
  HintBox,
  PuzzleFooter,
  StatusLine,
  StepPips,
  useFailFx,
  useFailHint,
  useHotkeys,
  useSfx,
  type PuzzleProps,
} from "@/components/world/puzzles/ui";
import { intlLocale, tr } from "@/lib/i18n";

const W = 400;
const H = 280;
const CAPITAL = 100;

function fmt(v: number, digits = 2): string {
  return fmtNum(v, digits);
}

function fmtRate(v: number): string {
  return v.toLocaleString(intlLocale(), { maximumSignificantDigits: 4 });
}

export function ArbitragePuzzle({ params, onSolve, solved, sound }: PuzzleProps) {
  const seed = num(params, "seed", 7);
  const nodes = num(params, "nodes", 5);
  const maxHopsParam = num(params, "maxHops", 4);
  const targetParam = num(params, "target", 1.08);
  const market = useMemo(
    () => generateMarket(seed, nodes, maxHopsParam, targetParam),
    [seed, nodes, maxHopsParam, targetParam],
  );
  const best = useMemo(() => bestCycle(market, 0, market.maxHops), [market]);
  const n = market.names.length;
  const { maxHops, target } = market;

  const [route, setRoute] = useState<number[]>([0]);
  const [hover, setHover] = useState<number | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "bad" | "info"; text: string }>({
    tone: "info",
    text: tr("Starting capital {capital} _unSC. Goal: ×{target} in at most {max} trade steps.", {
      capital: CAPITAL,
      target: fmt(target, 2),
      max: maxHops,
    }),
  });
  const sfx = useSfx(sound);
  const { fail, hint, fails } = useFailHint(3, undefined, sfx);
  const { failClass, fail: failFx } = useFailFx();
  /** Keyboard cursor over the market nodes. */
  const [cursor, setCursor] = useState(0);

  const current = route[route.length - 1];
  const hops = route.length - 1;
  const closed = isClosedRoute(route, maxHops);
  const amounts = route.map((_, i) => CAPITAL * pathYield(market, route.slice(0, i + 1)));

  const pos = (i: number): [number, number] => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [W / 2 + Math.cos(a) * 105, H / 2 + Math.sin(a) * 105];
  };

  const canVisit = (j: number): boolean => {
    if (solved || closed || j === current || hops >= maxHops) return false;
    if (j === 0) return hops >= 2;
    // The last allowed hop must return to _unSC — never strand the route.
    if (hops >= maxHops - 1) return false;
    return !route.includes(j);
  };

  const visit = (j: number) => {
    if (solved || j < 0 || j >= n) return;
    if (!canVisit(j)) {
      if (j === current) return;
      // Illegal hop: explain why, with a small buzz (does not count as a failed trade).
      failFx();
      sfx("fail_buzz");
      setStatus({
        tone: "bad",
        text: closed
          ? tr("Route is closed — “Trade” or ⌫ back.")
          : hops >= maxHops - 1
            ? tr("At most {max} steps — the last one must return to _unSC.", { max: maxHops })
            : j === 0
              ? tr("Back to _unSC only after at least two purchases.")
              : tr("{name} is already in the route.", { name: market.names[j] }),
      });
      return;
    }
    const next = [...route, j];
    setRoute(next);
    if (isClosedRoute(next, maxHops)) {
      sfx("keypad_beep");
      setStatus({ tone: "info", text: tr("Route closed. “Trade” executes it.") });
    } else {
      sfx("ui_click");
      setStatus({ tone: "info", text: tr("{name} bought.", { name: market.names[j] }) });
    }
  };

  const undo = () => {
    if (solved || route.length <= 1) return;
    sfx("ui_click");
    setRoute(route.slice(0, -1));
  };

  const reset = () => {
    if (solved) return;
    sfx("ui_click");
    setRoute([0]);
  };

  const trade = () => {
    if (solved) return;
    if (!closed) {
      failFx();
      sfx("fail_buzz");
      setStatus({ tone: "bad", text: tr("The route has to lead back to _unSC.") });
      return;
    }
    const y = pathYield(market, route);
    if (y >= target) {
      setStatus({
        tone: "ok",
        text: tr("Deal executed: {from} → {to} _unSC (×{factor}).", {
          from: fmt(CAPITAL),
          to: fmt(CAPITAL * y),
          factor: fmt(y, 3),
        }),
      });
      onSolve();
      return;
    }
    fail();
    failFx();
    sfx("fail_buzz");
    setStatus({
      tone: "bad",
      text:
        y < 1
          ? tr("Result {amount} _unSC (×{factor}). The fees ate you alive.", {
              amount: fmt(CAPITAL * y),
              factor: fmt(y, 3),
            })
          : tr("Result {amount} _unSC (×{factor}). Profit, but below the goal.", {
              amount: fmt(CAPITAL * y),
              factor: fmt(y, 3),
            }),
    });
    setRoute([0]);
  };

  useHotkeys((key) => {
    if (solved) return false;
    const d = Number(key);
    if (Number.isInteger(d) && d >= 1 && d <= n) {
      setCursor(d - 1);
      visit(d - 1);
    } else if (key === "ArrowRight" || key === "ArrowDown") setCursor((c) => (c + 1) % n);
    else if (key === "ArrowLeft" || key === "ArrowUp") setCursor((c) => (c - 1 + n) % n);
    else if (key === " ") visit(cursor);
    else if (key === "Backspace") undo();
    else if (key === "Enter") trade();
    else if (key === "Delete") reset();
    else return false;
    return true;
  });

  const focusNode = hover ?? current;
  const hintHop = best.path[1];
  /** Progressive hint: after 3 fails the first hop, after 6 the whole route. */
  const hintRoute = fails >= 6 ? best.path : best.path.slice(0, 2);
  /** Next node the hint suggests from the current position (if still on track). */
  const onTrack = route.every((j, k) => hintRoute[k] === undefined || hintRoute[k] === j);
  const hintNext = hint && !solved && onTrack ? hintRoute[route.length] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[520px] self-center select-none"
        aria-label={tr("Market graph")}
      >
        <defs>
          <marker
            id="arb-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#00FFFF" />
          </marker>
          <marker
            id="arb-arrow-dim"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#FFB800" />
          </marker>
        </defs>
        {/* Candidate edges from the focused node */}
        {Array.from({ length: n }, (_, j) => {
          if (j === focusNode) return null;
          const [x1, y1] = pos(focusNode);
          const [x2, y2] = pos(j);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          const ux = dx / len;
          const uy = dy / len;
          const ok = hover === null ? canVisit(j) : true;
          return (
            <g key={`c${j}`} opacity={ok ? 0.8 : 0.2}>
              <line
                x1={x1 + ux * 22}
                y1={y1 + uy * 22}
                x2={x2 - ux * 24}
                y2={y2 - uy * 24}
                stroke="#FFB800"
                strokeWidth={1}
                strokeDasharray="3 4"
                markerEnd="url(#arb-arrow-dim)"
              />
              <text
                x={x1 + dx * 0.55 - uy * 9}
                y={y1 + dy * 0.55 + ux * 9 + 3}
                textAnchor="middle"
                fontSize={9}
                fill="#FFB800"
                fontFamily="monospace"
              >
                ×{fmtRate(market.rates[focusNode][j])}
              </text>
            </g>
          );
        })}
        {/* Chosen route */}
        {route.slice(1).map((j, k) => {
          const [x1, y1] = pos(route[k]);
          const [x2, y2] = pos(j);
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          return (
            <g key={`r${k}`}>
              <line
                x1={x1 + (dx / len) * 22}
                y1={y1 + (dy / len) * 22}
                x2={x2 - (dx / len) * 24}
                y2={y2 - (dy / len) * 24}
                stroke="#00FFFF"
                strokeWidth={2.5}
                markerEnd="url(#arb-arrow)"
                style={{ filter: "drop-shadow(0 0 4px #00FFFF)" }}
              />
              <line
                x1={x1 + (dx / len) * 22}
                y1={y1 + (dy / len) * 22}
                x2={x2 - (dx / len) * 30}
                y2={y2 - (dy / len) * 30}
                stroke="#E8FFFF"
                strokeWidth={1.4}
                className="pz-flow"
              />
            </g>
          );
        })}
        {market.names.map((name, i) => {
          const [x, y] = pos(i);
          const inRoute = route.includes(i);
          const isCur = i === current;
          const visitable = canVisit(i);
          const hinted = hintNext === i;
          const hasCursor = i === cursor && !solved;
          return (
            <g
              key={name}
              role="button"
              tabIndex={0}
              aria-label={`${i + 1}: ${name}${isCur ? ` (${tr("current")})` : ""}${inRoute && !isCur ? ` (${tr("in route")})` : ""}${hinted ? ` (${tr("MCP recommendation")})` : ""}${visitable ? "" : ` (${tr("not selectable")})`}`}
              aria-disabled={!visitable}
              className={`pz-cell ${visitable ? "cursor-pointer outline-none" : "outline-none"}`}
              onClick={() => {
                setCursor(i);
                visit(i);
              }}
              onFocus={() => setCursor(i)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  // Enter on a closed route executes the trade (as it does globally).
                  if (e.key === "Enter" && closed) trade();
                  else visit(i);
                }
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                cx={x}
                cy={y}
                r={20}
                fill={isCur ? "#003333" : "#0D0D0D"}
                stroke={hinted ? "#FFB800" : isCur ? "#00FFFF" : inRoute ? "#00FF66" : "#33FF33"}
                strokeWidth={isCur || hinted ? 2.5 : 1.2}
                opacity={visitable || isCur || inRoute ? 1 : 0.55}
                style={isCur ? { filter: "drop-shadow(0 0 6px #00FFFF)" } : undefined}
                className={visitable ? "transition-[fill] hover:fill-[#0F2A0F]" : undefined}
              />
              {/* Focus ring (keyboard) + cursor ring. */}
              <circle
                cx={x}
                cy={y}
                r={25}
                fill="none"
                stroke="#00FFFF"
                strokeWidth={2}
                strokeDasharray="4 3"
                className="pz-focus"
              />
              {hasCursor && (
                <circle
                  cx={x}
                  cy={y}
                  r={25}
                  fill="none"
                  stroke="#00FFFF"
                  strokeOpacity={0.5}
                  strokeDasharray="2 4"
                  className="pz-cursor"
                  pointerEvents="none"
                />
              )}
              {/* Shape cues next to colour: current = double ring, route = tick, hint = ? */}
              {isCur && (
                <circle cx={x} cy={y} r={15} fill="none" stroke="#00FFFF" strokeOpacity={0.6} />
              )}
              {inRoute && !isCur && (
                <text x={x + 14} y={y - 12} fontSize={10} fill="#00FF66" fontFamily="monospace">
                  ✓
                </text>
              )}
              {hinted && (
                <text
                  x={x + 14}
                  y={y - 12}
                  fontSize={11}
                  fill="#FFB800"
                  fontFamily="monospace"
                  className="pz-blink"
                >
                  ?
                </text>
              )}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={12}
                fill={isCur ? "#00FFFF" : "#33FF33"}
                fontFamily="monospace"
              >
                {i + 1}
              </text>
              <text
                x={x}
                y={y + (y < H / 2 ? -26 : 34)}
                textAnchor="middle"
                fontSize={10}
                fill="#FFB800"
                fontFamily="monospace"
              >
                {name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className={`rounded-sm border border-[#33FF33]/30 bg-black p-2 text-xs ${failClass}`}>
        <div className="mb-1 flex items-center justify-between gap-2 text-[#FFB800]">
          <span>{tr("Route ({hops}/{max} steps)", { hops, max: maxHops })}</span>
          <StepPips done={hops} total={maxHops} label={tr("Trade steps")} />
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {route.map((j, k) => (
            <span key={k} className="flex items-center gap-1">
              {k > 0 && <span className="text-[#00FFFF]/60">→</span>}
              <span className={k === route.length - 1 ? "text-[#00FFFF]" : "text-[#33FF33]"}>
                {market.names[j]}
              </span>
              <span className="text-[#33FF33]/50">[{fmt(amounts[k])}]</span>
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="p-1 text-left text-[#FFB800]">{tr("1 unit →")}</th>
              {market.names.map((nm, j) => (
                <th key={nm} className="p-1 text-right font-normal text-[#FFB800]">
                  {j + 1}·{nm.slice(0, 6)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {market.names.map((nm, i) => (
              <tr
                key={nm}
                className={i === current ? "bg-[#00FFFF]/10 text-[#00FFFF]" : "text-[#33FF33]/80"}
              >
                <td className="p-1">
                  {i + 1}·{nm}
                </td>
                {market.names.map((_, j) => (
                  <td key={j} className="p-1 text-right tabular-nums">
                    {i === j ? "—" : fmtRate(market.rates[i][j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StatusLine tone={status.tone}>{status.text}</StatusLine>
      <HintBox show={hint && !solved}>
        {fails >= 6 ? (
          <>
            {tr(
              "Very well, I shall do the arithmetic: {route} (marked with “?”). Click along once, then “Trade”.",
              { route: hintRoute.map((j) => market.names[j]).join(" → ") },
            )}
          </>
        ) : (
          <>
            {tr(
              "The most profitable route begins with “{name}” (marked with “?”). Keep calculating: rates multiply, and so do fees. The number in square brackets is your capital after each step — watch where it shrinks.",
              { name: market.names[hintHop] ?? "?" },
            )}
          </>
        )}
      </HintBox>
      <div className="flex flex-wrap justify-end gap-2">
        <CrtButton tone="amber" onClick={undo} disabled={solved || route.length <= 1}>
          ⌫ {tr("Back")}
        </CrtButton>
        <CrtButton
          tone="cyan"
          onClick={trade}
          disabled={solved || !closed}
          className={closed && !solved ? "shadow-[0_0_10px_rgba(0,255,255,0.4)]" : ""}
        >
          ⏎ {tr("Trade")}
        </CrtButton>
      </div>
      <PuzzleFooter
        help={
          <>
            <kbd>1</kbd>–<kbd>{n}</kbd> {tr("buy node")} · <kbd>←</kbd>/<kbd>→</kbd> +{" "}
            <kbd>{tr("short::Space")}</kbd> {tr("select")} · <kbd>⌫</kbd> {tr("back")} ·{" "}
            <kbd>{tr("Del")}</kbd> {tr("clear")} · <kbd>Enter</kbd> {tr("trade")} ·{" "}
            {tr("Failed attempts: {n}", { n: fails })}
          </>
        }
        onReset={reset}
        resetDisabled={solved || route.length <= 1}
      />
    </div>
  );
}

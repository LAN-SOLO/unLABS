"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FOCUS_RING, UI } from "@/components/world/ui";
import { fmtNum } from "@/components/world/format";
import { getSettings } from "@/lib/world/settings";
import type { Tone, UiAction, UiCtx, Val, Widget } from "@/lib/world/device-ui/types";

/** Resolve a live value. */
export function val<T>(v: Val<T>, c: UiCtx): T {
  return typeof v === "function" ? (v as (c: UiCtx) => T)(c) : v;
}

const TONE: Record<Tone, string> = {
  ok: UI.green,
  warn: UI.amber,
  bad: UI.red,
  info: UI.cyan,
  off: "#3a4a3a",
};

/** Interface animation clock (s), ~12 fps; frozen with reduced motion. */
export function useUiClock(active: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active || getSettings().accessibility.reduceMotion) return;
    const start = performance.now();
    const id = window.setInterval(() => setT((performance.now() - start) / 1000), 83);
    return () => window.clearInterval(id);
  }, [active]);
  return t;
}

export interface WidgetHost {
  ctx: UiCtx;
  accent: string;
  font: string;
  setTuning: (key: string, value: number) => void;
  onAction: (a: UiAction) => void;
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="mb-0.5 text-[9px] tracking-[0.2em] text-white/45 uppercase">{children}</div>
  );
}

function Screen({
  children,
  accent,
  className = "",
}: {
  children: ReactNode;
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[3px] border bg-black/70 ${className}`}
      style={{ borderColor: `${accent}40`, boxShadow: `inset 0 0 18px ${accent}14` }}
    >
      {children}
    </div>
  );
}

const fmt = (v: string | number, digits?: number): string =>
  typeof v === "number" ? fmtNum(v, digits ?? (Number.isInteger(v) ? 0 : 1)) : v;

function Readout({ w, h }: { w: Extract<Widget, { kind: "readout" }>; h: WidgetHost }) {
  const tone = w.tone ? TONE[val(w.tone, h.ctx)] : h.accent;
  return (
    <Screen accent={h.accent} className="min-w-[6.5rem] flex-1 px-2 py-1">
      <Label>{w.label}</Label>
      <div
        className={`text-lg leading-none tabular-nums ${h.font}`}
        style={{ color: tone, textShadow: `0 0 6px ${tone}88` }}
      >
        {fmt(val(w.value, h.ctx), w.digits)}
        {w.unit && <span className="ml-1 text-[10px] opacity-60">{w.unit}</span>}
      </div>
    </Screen>
  );
}

function Gauge({ w, h }: { w: Extract<Widget, { kind: "gauge" }>; h: WidgetHost }) {
  const v = val(w.value, h.ctx);
  const k = Math.max(0, Math.min(1, (v - w.min) / (w.max - w.min || 1)));
  const a = -Math.PI * 0.75 + k * Math.PI * 1.5;
  const color =
    w.bad !== undefined && v >= w.bad
      ? UI.red
      : w.warn !== undefined && v >= w.warn
        ? UI.amber
        : h.accent;
  const arc = (from: number, to: number) => {
    const p = (t: number) => [50 + Math.sin(t) * 38, 52 - Math.cos(t) * 38];
    const [x0, y0] = p(from);
    const [x1, y1] = p(to);
    return `M${x0} ${y0} A38 38 0 ${to - from > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  return (
    <Screen accent={h.accent} className="w-[7.5rem] px-1 pt-1">
      <Label>{w.label}</Label>
      <svg viewBox="0 0 100 70" className="w-full" aria-hidden>
        <path
          d={arc(-Math.PI * 0.75, Math.PI * 0.75)}
          stroke="#ffffff22"
          strokeWidth={6}
          fill="none"
        />
        <path d={arc(-Math.PI * 0.75, a)} stroke={color} strokeWidth={6} fill="none" />
        <line
          x1={50}
          y1={52}
          x2={50 + Math.sin(a) * 30}
          y2={52 - Math.cos(a) * 30}
          stroke={UI.ice}
          strokeWidth={2}
        />
        <text x={50} y={68} textAnchor="middle" fontSize={11} fill={color}>
          {fmt(Math.round(v * 10) / 10)}
          {w.unit ?? ""}
        </text>
      </svg>
    </Screen>
  );
}

function Bar({ w, h }: { w: Extract<Widget, { kind: "bar" }>; h: WidgetHost }) {
  const v = val(w.value, h.ctx);
  const max = val(w.max, h.ctx) || 1;
  const tone = w.tone ? TONE[val(w.tone, h.ctx)] : h.accent;
  return (
    <div className="min-w-[10rem] flex-1">
      <Label>
        {w.label} · {fmt(Math.round(v * 10) / 10)}
        {w.unit ? ` ${w.unit}` : ""}
      </Label>
      <div className="h-2.5 overflow-hidden rounded-sm bg-white/10">
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`,
            background: tone,
            boxShadow: `0 0 8px ${tone}`,
          }}
        />
      </div>
    </div>
  );
}

function Leds({ w, h }: { w: Extract<Widget, { kind: "leds" }>; h: WidgetHost }) {
  const blinkOn = Math.floor(h.ctx.t * 3) % 2 === 0;
  return (
    <div className="flex-1">
      {w.label && <Label>{w.label}</Label>}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {w.items.map((it) => {
          const on = val(it.on, h.ctx) && (!it.blink || blinkOn);
          const c = TONE[it.tone ?? "ok"];
          return (
            <span key={it.label} className="flex items-center gap-1 text-[10px] text-white/60">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: on ? c : "#222", boxShadow: on ? `0 0 6px ${c}` : undefined }}
              />
              {it.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Scope({ w, h }: { w: Extract<Widget, { kind: "scope" }>; h: WidgetHost }) {
  const color = w.color ?? h.accent;
  const n = 96;
  const pts = Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1);
    const y = Math.max(-1, Math.min(1, h.ctx.online ? w.wave(x, h.ctx) : 0));
    return `${(x * 200).toFixed(1)},${(40 - y * 34).toFixed(1)}`;
  }).join(" ");
  return (
    <div className="min-w-[12rem] flex-1">
      <Label>{w.label}</Label>
      <Screen accent={h.accent}>
        <svg viewBox="0 0 200 80" preserveAspectRatio="none" className="h-20 w-full" aria-hidden>
          {w.grid !== false &&
            [20, 40, 60].map((y) => (
              <line key={y} x1={0} x2={200} y1={y} y2={y} stroke="#ffffff10" />
            ))}
          {w.grid !== false &&
            [40, 80, 120, 160].map((x) => (
              <line key={x} y1={0} y2={80} x1={x} x2={x} stroke="#ffffff10" />
            ))}
          <polyline
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
          />
        </svg>
      </Screen>
    </div>
  );
}

function Spectrum({ w, h }: { w: Extract<Widget, { kind: "spectrum" }>; h: WidgetHost }) {
  const bands = val(w.bands, h.ctx);
  const color = w.color ?? h.accent;
  const bw = 200 / Math.max(1, bands.length);
  return (
    <div className="min-w-[12rem] flex-1">
      <Label>{w.label}</Label>
      <Screen accent={h.accent}>
        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
          {bands.map((b, i) => {
            const v = Math.max(0, Math.min(1, b));
            return (
              <rect
                key={i}
                x={i * bw + 1}
                width={bw - 2}
                y={60 - v * 58}
                height={v * 58}
                fill={color}
                opacity={0.35 + v * 0.65}
              />
            );
          })}
        </svg>
      </Screen>
    </div>
  );
}

function Graph({ w, h }: { w: Extract<Widget, { kind: "graph" }>; h: WidgetHost }) {
  const s = val(w.series, h.ctx);
  const color = w.color ?? h.accent;
  const pts = s
    .map(
      (v, i) =>
        `${((i / Math.max(1, s.length - 1)) * 200).toFixed(1)},${(58 - Math.max(0, Math.min(1, v)) * 54).toFixed(1)}`,
    )
    .join(" ");
  return (
    <div className="min-w-[12rem] flex-1">
      <Label>{w.label}</Label>
      <Screen accent={h.accent}>
        <svg viewBox="0 0 200 60" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
          <polyline points={`0,60 ${pts} 200,60`} fill={`${color}22`} stroke="none" />
          <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} />
        </svg>
      </Screen>
    </div>
  );
}

function Matrix({ w, h }: { w: Extract<Widget, { kind: "matrix" }>; h: WidgetHost }) {
  const color = w.color ?? h.accent;
  const cells = w.cols * w.rows;
  return (
    <div>
      <Label>{w.label}</Label>
      <Screen accent={h.accent} className="p-1">
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${w.cols}, 0.6rem)` }}
        >
          {Array.from({ length: cells }, (_, i) => {
            const v = Math.max(0, Math.min(1, w.cell(i, h.ctx)));
            return (
              <span
                key={i}
                className="h-[0.6rem] w-[0.6rem] rounded-[1px]"
                style={{ background: color, opacity: 0.08 + v * 0.92 }}
              />
            );
          })}
        </div>
      </Screen>
    </div>
  );
}

function Radar({ w, h }: { w: Extract<Widget, { kind: "radar" }>; h: WidgetHost }) {
  const blips = val(w.blips, h.ctx);
  const sweep = (h.ctx.t * 1.3) % (Math.PI * 2);
  return (
    <div>
      <Label>{w.label}</Label>
      <Screen accent={h.accent}>
        <svg viewBox="0 0 100 100" className="h-32 w-32" aria-hidden>
          {[15, 30, 45].map((r) => (
            <circle key={r} cx={50} cy={50} r={r} stroke={`${h.accent}33`} fill="none" />
          ))}
          {w.sweep !== false && h.ctx.online && (
            <line
              x1={50}
              y1={50}
              x2={50 + Math.sin(sweep) * 45}
              y2={50 - Math.cos(sweep) * 45}
              stroke={h.accent}
              strokeWidth={1.5}
            />
          )}
          {blips.map((b, i) => (
            <g key={i}>
              <circle
                cx={50 + Math.sin(b.a) * b.r * 45}
                cy={50 - Math.cos(b.a) * b.r * 45}
                r={2.2}
                fill={UI.amber}
              />
              {b.label && (
                <text
                  x={53 + Math.sin(b.a) * b.r * 45}
                  y={50 - Math.cos(b.a) * b.r * 45}
                  fontSize={6}
                  fill={UI.amber}
                >
                  {b.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </Screen>
    </div>
  );
}

function Dial({ w, h }: { w: Extract<Widget, { kind: "dial" }>; h: WidgetHost }) {
  const a = val(w.angle, h.ctx);
  const marks = w.marks ?? [];
  return (
    <div>
      <Label>{w.label}</Label>
      <Screen accent={h.accent}>
        <svg viewBox="0 0 100 100" className="h-28 w-28" aria-hidden>
          <circle cx={50} cy={50} r={44} stroke={`${h.accent}55`} fill="none" strokeWidth={2} />
          {marks.map((m, i) => {
            const t = (i / marks.length) * Math.PI * 2;
            return (
              <text
                key={i}
                x={50 + Math.sin(t) * 36}
                y={53 - Math.cos(t) * 36}
                fontSize={8}
                textAnchor="middle"
                fill={`${h.accent}aa`}
              >
                {m}
              </text>
            );
          })}
          <line
            x1={50}
            y1={50}
            x2={50 + Math.sin(a) * 40}
            y2={50 - Math.cos(a) * 40}
            stroke={UI.red}
            strokeWidth={2.5}
          />
          <circle cx={50} cy={50} r={3} fill={UI.ice} />
        </svg>
      </Screen>
    </div>
  );
}

function Log({ w, h }: { w: Extract<Widget, { kind: "log" }>; h: WidgetHost }) {
  const lines = val(w.lines, h.ctx).slice(-(w.max ?? 8));
  return (
    <div className="min-w-[14rem] flex-1">
      <Label>{w.label}</Label>
      <Screen accent={h.accent} className="px-2 py-1">
        {lines.map((l, i) => (
          <div key={i} className={`truncate text-[11px] ${h.font}`} style={{ color: h.accent }}>
            <span className="opacity-40">› </span>
            {l}
          </div>
        ))}
      </Screen>
    </div>
  );
}

function Knob({
  w,
  h,
}: {
  w: Extract<Widget, { kind: "knob" } | { kind: "slider" }>;
  h: WidgetHost;
}) {
  const v = h.ctx.get(w.key, w.def);
  const step = w.step ?? 1;
  return (
    <label className="flex min-w-[9rem] flex-1 flex-col">
      <Label>
        {w.label} · {fmt(v)}
        {w.unit ? ` ${w.unit}` : ""}
      </Label>
      <input
        type="range"
        min={w.min}
        max={w.max}
        step={step}
        value={v}
        disabled={!h.ctx.online}
        onChange={(e) => h.setTuning(w.key, Number(e.target.value))}
        className={`accent-current ${FOCUS_RING}`}
        style={{ color: h.accent }}
      />
    </label>
  );
}

function Switch({ w, h }: { w: Extract<Widget, { kind: "switch" }>; h: WidgetHost }) {
  const on = h.ctx.get(w.key, w.def) > 0;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!h.ctx.online}
      onClick={() => h.setTuning(w.key, on ? 0 : 1)}
      className={`flex items-center gap-2 rounded-sm border border-white/15 px-2 py-1 text-[11px] text-white/70 disabled:opacity-40 ${FOCUS_RING}`}
    >
      <span className="relative inline-block h-3.5 w-7 rounded-full bg-white/10">
        <span
          className="absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all"
          style={{
            left: on ? "0.95rem" : "0.15rem",
            background: on ? h.accent : "#666",
            boxShadow: on ? `0 0 6px ${h.accent}` : undefined,
          }}
        />
      </span>
      {w.label}
    </button>
  );
}

function Mode({ w, h }: { w: Extract<Widget, { kind: "mode" }>; h: WidgetHost }) {
  const v = h.ctx.get(w.key, w.def);
  return (
    <div className="flex-1">
      <Label>{w.label}</Label>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={w.label}>
        {w.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={v === o.value}
            disabled={!h.ctx.online}
            onClick={() => h.setTuning(w.key, o.value)}
            className={`rounded-sm border px-2 py-0.5 text-[11px] disabled:opacity-40 ${FOCUS_RING}`}
            style={
              v === o.value
                ? { borderColor: h.accent, color: h.accent, background: `${h.accent}1a` }
                : { borderColor: "#ffffff22", color: "#ffffff88" }
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ w, h }: { w: Extract<Widget, { kind: "button" }>; h: WidgetHost }) {
  const disabled =
    (w.disabled ? val(w.disabled, h.ctx) : false) ||
    (!h.ctx.online && w.action !== "service" && w.action !== "power");
  return (
    <button
      type="button"
      disabled={disabled}
      title={w.hint}
      onClick={() => h.onAction(w.action)}
      className={`rounded-sm border px-3 py-1 text-[11px] tracking-wider uppercase disabled:opacity-40 ${FOCUS_RING}`}
      style={{ borderColor: `${h.accent}88`, color: h.accent, background: `${h.accent}12` }}
    >
      {w.label}
    </button>
  );
}

export function WidgetView({ w, h }: { w: Widget; h: WidgetHost }): ReactNode {
  switch (w.kind) {
    case "readout":
      return <Readout w={w} h={h} />;
    case "gauge":
      return <Gauge w={w} h={h} />;
    case "bar":
      return <Bar w={w} h={h} />;
    case "leds":
      return <Leds w={w} h={h} />;
    case "scope":
      return <Scope w={w} h={h} />;
    case "spectrum":
      return <Spectrum w={w} h={h} />;
    case "graph":
      return <Graph w={w} h={h} />;
    case "matrix":
      return <Matrix w={w} h={h} />;
    case "radar":
      return <Radar w={w} h={h} />;
    case "dial":
      return <Dial w={w} h={h} />;
    case "log":
      return <Log w={w} h={h} />;
    case "text": {
      const tone = w.tone ? TONE[val(w.tone, h.ctx)] : UI.text;
      return (
        <p className="w-full text-[12px] leading-snug" style={{ color: tone }}>
          {val(w.text, h.ctx)}
        </p>
      );
    }
    case "knob":
    case "slider":
      return <Knob w={w} h={h} />;
    case "switch":
      return <Switch w={w} h={h} />;
    case "mode":
      return <Mode w={w} h={h} />;
    case "button":
      return <ActionButton w={w} h={h} />;
    case "row":
      return (
        <div className="flex w-full flex-wrap items-end gap-2">
          {w.widgets.map((x, i) => (
            <WidgetView key={i} w={x} h={h} />
          ))}
        </div>
      );
  }
}

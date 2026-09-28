"use client";

import { tr } from "@/lib/i18n";
import { fmtNum } from "@/components/world/format";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useEscLayer } from "@/components/world/menu/shared";
import { ItemIcon } from "@/components/world/ItemIcon";
import { CrtButton } from "@/components/world/puzzles/ui";
import { AXIS_COLOR, AXIS_LABEL, traitTotal } from "@/lib/world/traits";
import { activeBuffs, type ActiveBuff } from "@/lib/world/buffs";
import type { BuffKind } from "@/lib/world/content/decor-actions";
import { NPC_SPEAKERS } from "@/lib/world/content/story";
import { TRAIT_AXES, type ItemDef, type Traits, type WorldState } from "@/lib/world/types";

export { CrtButton };

/**
 * Splice React nodes into an already translated string: every `{name}` in
 * `text` is replaced by `nodes[name]` (for inline markup such as <b>/<span>
 * inside a translated sentence). Unknown placeholders stay as text.
 */
export function trNodes(text: string, nodes: Readonly<Record<string, ReactNode>>): ReactNode[] {
  return text.split(/(\{[A-Za-z_][A-Za-z0-9_]*\})/).map((part, i) => {
    const m = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(part);
    if (m && Object.prototype.hasOwnProperty.call(nodes, m[1]!))
      return <Fragment key={i}>{nodes[m[1]!]}</Fragment>;
    return part;
  });
}

// ── Styling tokens (shared by every lab-world panel) ─────────────

/** Colour tokens of the CRT look. Use these instead of ad-hoc hex values. */
export const UI = {
  amber: "#FFB800",
  green: "#33FF33",
  cyan: "#00FFFF",
  red: "#FF3333",
  orange: "#FF6B00",
  magenta: "#E91E8C",
  ice: "#E8F4FF",
  text: "#d8ffd8",
  bg: "#0D0D0D",
} as const;

/** Section heading (small caps, amber). */
export const SECTION_TITLE_CLASS = "mb-1 text-xs tracking-widest uppercase";

/** Text inputs and selects inside panels. */
export const INPUT_CLASS =
  "rounded-sm border border-[#33FF33]/30 bg-black/50 px-2 py-0.5 text-[11px] text-[#d8ffd8] outline-none placeholder:text-white/30 focus:border-[#00FFFF]/70 focus-visible:ring-1 focus-visible:ring-[#00FFFF]/40";

/** Visible keyboard focus ring for custom buttons. */
export const FOCUS_RING =
  "outline-none focus-visible:ring-1 focus-visible:ring-[#00FFFF] focus-visible:ring-offset-1 focus-visible:ring-offset-black";

export function SectionTitle({
  children,
  accent = UI.amber,
  right,
  className = "",
}: {
  children: ReactNode;
  accent?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${className}`}>
      <h3 className={SECTION_TITLE_CLASS} style={{ color: accent }}>
        {children}
      </h3>
      {right !== undefined && <span className="text-[10px] text-white/45">{right}</span>}
    </div>
  );
}

/** Toggle chip for categories / filters (role=tab when inside a tablist). */
export function FilterChip({
  active,
  onClick,
  children,
  count,
  role = "tab",
  accent = UI.amber,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number | string;
  role?: "tab" | "button";
  accent?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === "tab" ? active : undefined}
      aria-pressed={role === "button" ? active : undefined}
      onClick={onClick}
      title={title}
      className={`rounded-sm border px-2 py-0.5 text-[10px] tracking-wider uppercase transition-colors ${FOCUS_RING} ${
        active ? "" : "border-[#33FF33]/20 text-[#33FF33]/60 hover:border-[#33FF33]/50"
      }`}
      style={active ? { borderColor: accent, color: accent, background: `${accent}1a` } : undefined}
    >
      {children}
      {count !== undefined && <span className="ml-1 text-white/40">{count}</span>}
    </button>
  );
}

/**
 * Search box for panels. Keys typed here never reach the world hotkeys
 * (only Escape bubbles up so it still closes the panel).
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder = tr("Search …"),
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") e.stopPropagation();
        else if (value) {
          // First Esc clears the query, the next one closes the panel.
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          onChange("");
        }
      }}
      placeholder={placeholder}
      aria-label={label}
      className={`${INPUT_CLASS} ${className}`}
    />
  );
}

/** Thin progress bar with an accessible value. */
export function Meter({
  value,
  max,
  color = UI.green,
  label,
  className = "",
  height = 4,
}: {
  value: number;
  max: number;
  color?: string;
  label: string;
  className?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`w-full overflow-hidden rounded-[2px] bg-white/5 ${className}`}
      style={{ height }}
    >
      <div
        className="h-full transition-[width] duration-300 motion-reduce:transition-none"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Small "NEW" marker for things unlocked since the panel was last opened. */
export function NewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-[2px] border border-[#E91E8C]/70 px-1 text-[8px] leading-[12px] tracking-widest text-[#E91E8C] uppercase ${className}`}
    >
      {tr("new")}
    </span>
  );
}

/**
 * Arrow-key navigation over the focusable children marked `data-nav`
 * inside the element the handler is attached to. Left/Right step, Up/Down
 * jump to the nearest item in the row above/below, Home/End jump to the
 * ends. Handled keys never reach the world hotkeys.
 */
export function gridKeyNav(e: KeyboardEvent<HTMLElement>): void {
  const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-nav]")].filter(
    (el) => !(el as HTMLButtonElement).disabled,
  );
  const cur = items.findIndex((el) => el === document.activeElement);
  if (!items.length) return;
  e.preventDefault();
  e.stopPropagation();
  let next = cur;
  if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  else if (cur < 0) next = 0;
  else if (e.key === "ArrowLeft") next = Math.max(0, cur - 1);
  else if (e.key === "ArrowRight") next = Math.min(items.length - 1, cur + 1);
  else {
    const down = e.key === "ArrowDown";
    const r = items[cur]!.getBoundingClientRect();
    let best = -1;
    let bestScore = Infinity;
    items.forEach((el, i) => {
      const q = el.getBoundingClientRect();
      const dy = q.top - r.top;
      if (down ? dy <= 1 : dy >= -1) return;
      const score = Math.abs(dy) * 1000 + Math.abs(q.left - r.left);
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    // Without layout (tests, single row) fall back to a linear step.
    next = best >= 0 ? best : down ? Math.min(items.length - 1, cur + 1) : Math.max(0, cur - 1);
  }
  items[next]?.focus();
}

function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-2 w-2 rounded-full bg-[#3A3A3A] shadow-[inset_0_0_1px_#000,0_0_0_1px_#555] ${className}`}
    />
  );
}

/** Modal CRT panel used by every overlay in the lab world. */
export function Panel({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  accent = "#FFB800",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  accent?: string;
}) {
  // Esc closes only the top-most layer (a confirm dialog above a panel wins).
  useEscLayer(onClose);
  const boxRef = useRef<HTMLDivElement>(null);
  // Focus moves into the panel. On close it is dropped (not restored to the
  // HUD button that opened it): Space/Enter are game keys and would
  // otherwise re-click that button.
  useEffect(() => {
    const box = boxRef.current;
    const prev = document.activeElement;
    // Children may have focused themselves already (autoFocus inputs).
    if (box && !(prev && box.contains(prev))) {
      if (prev instanceof HTMLElement && prev !== document.body) prev.blur();
      box.focus({ preventScroll: true });
    }
    return () => {
      const a = document.activeElement;
      if (a instanceof HTMLElement && a !== document.body) a.blur();
    };
  }, []);
  /** Keep Tab / Shift+Tab inside the panel. */
  const trapTab = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !boxRef.current) return;
    const items = [
      ...boxRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === boxRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={trapTab}
        className={`relative flex max-h-[88vh] w-full flex-col rounded-sm border bg-[#0D0D0D]/95 font-mono text-[#33FF33] shadow-[0_0_40px_rgba(0,0,0,0.8)] outline-none ${wide ? "max-w-5xl" : "max-w-2xl"}`}
        style={{ borderColor: `${accent}66` }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Screw className="top-1.5 left-1.5" />
        <Screw className="top-1.5 right-1.5" />
        <Screw className="bottom-1.5 left-1.5" />
        <Screw className="right-1.5 bottom-1.5" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
          }}
        />
        <div
          className="flex items-start justify-between gap-4 border-b px-5 pt-4 pb-3"
          style={{ borderColor: `${accent}33` }}
        >
          <div>
            <h2 className="text-sm tracking-[0.2em] uppercase" style={{ color: accent }}>
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs text-[#33FF33]/60">{subtitle}</p>}
          </div>
          <CrtButton tone="amber" onClick={onClose} aria-label={tr("Close")}>
            Esc
          </CrtButton>
        </div>
        <div className="relative overflow-y-auto px-5 py-4 text-sm leading-relaxed [scrollbar-gutter:stable]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function TraitBars({
  item,
  compact = false,
  traits,
}: {
  item?: ItemDef;
  compact?: boolean;
  /** Raw traits to show instead of an item's (e.g. a live preview). */
  traits?: Traits;
}) {
  const t = traits ?? item?.traits;
  if (!t) return null;
  const max = Math.max(8, ...TRAIT_AXES.map((a) => t[a]));
  return (
    <div
      className={
        compact ? "grid grid-cols-4 gap-x-2 gap-y-0.5" : "grid grid-cols-2 gap-x-4 gap-y-1"
      }
    >
      {TRAIT_AXES.map((a) => (
        <div key={a} className="flex items-center gap-1.5 text-[10px]">
          <span className="w-12 shrink-0 truncate" style={{ color: AXIS_COLOR[a] }}>
            {compact ? AXIS_LABEL[a].slice(0, 4) : AXIS_LABEL[a]}
          </span>
          <div className="h-1.5 flex-1 bg-white/5">
            <div
              className="h-full transition-[width] duration-300"
              style={{ width: `${(t[a] / max) * 100}%`, background: AXIS_COLOR[a] }}
            />
          </div>
          {!compact && <span className="w-7 text-right text-white/60">{fmtNum(t[a], 1)}</span>}
        </div>
      ))}
    </div>
  );
}

/** Octagon radar of the eight trait axes. */
export function TraitRadar({
  traits,
  size = 132,
  color = "#00FFFF",
}: {
  traits: Traits;
  size?: number;
  color?: string;
}) {
  const max = Math.max(8, ...TRAIT_AXES.map((a) => traits[a]));
  const c = size / 2;
  const r = size / 2 - 16;
  const pt = (i: number, k: number): [number, number] => {
    const a = (i / TRAIT_AXES.length) * Math.PI * 2 - Math.PI / 2;
    return [c + Math.cos(a) * r * k, c + Math.sin(a) * r * k];
  };
  const poly = (k: (i: number) => number) =>
    TRAIT_AXES.map((_, i) => pt(i, k(i)).join(",")).join(" ");
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={TRAIT_AXES.map((a) => `${AXIS_LABEL[a]} ${traits[a]}`).join(", ")}
      className="shrink-0"
    >
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={poly(() => k)} fill="none" stroke="#33FF3322" strokeWidth={1} />
      ))}
      {TRAIT_AXES.map((a, i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.2);
        return (
          <g key={a}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="#33FF3318" />
            <text
              x={lx}
              y={ly}
              fontSize={8}
              fill={AXIS_COLOR[a]}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="monospace"
            >
              {AXIS_LABEL[a].slice(0, 3)}
            </text>
          </g>
        );
      })}
      <polygon
        points={poly((i) => traits[TRAIT_AXES[i]!] / max)}
        fill={`${color}33`}
        stroke={color}
        strokeWidth={1.2}
      />
      {TRAIT_AXES.map((a, i) => {
        const [x, y] = pt(i, traits[a] / max);
        return traits[a] > 0 ? <circle key={a} cx={x} cy={y} r={1.8} fill={AXIS_COLOR[a]} /> : null;
      })}
    </svg>
  );
}

/** Stacked bar of trait mass per axis (live workbench preview). */
export function TraitSumBar({ traits, limit = 40 }: { traits: Traits; limit?: number }) {
  const total = traitTotal(traits);
  const scale = Math.max(limit, total);
  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-[2px] bg-white/5"
        role="img"
        aria-label={tr("Trait total: {n}", { n: fmtNum(total, 1) })}
      >
        {TRAIT_AXES.filter((a) => traits[a] > 0).map((a) => (
          <div
            key={a}
            title={`${AXIS_LABEL[a]} ${fmtNum(traits[a], 1)}`}
            className="h-full transition-[width] duration-300"
            style={{ width: `${(traits[a] / scale) * 100}%`, background: AXIS_COLOR[a] }}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]">
        {TRAIT_AXES.filter((a) => traits[a] > 0).map((a) => (
          <span key={a} style={{ color: AXIS_COLOR[a] }}>
            {AXIS_LABEL[a]} {traits[a].toFixed(0)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Five pips; filled up to the item's volatility, hotter colours when unstable. */
export function VolatilityPips({ value, className = "" }: { value: number; className?: string }) {
  const tone = value >= 4 ? "#FF3333" : value >= 3 ? "#FF6B00" : value >= 2 ? "#FFB800" : "#33FF33";
  return (
    <span
      className={`inline-flex shrink-0 gap-[2px] ${className}`}
      title={tr("Volatility {value}/5", { value })}
      aria-label={tr("Volatility {value} of 5", { value })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1 rounded-[1px]"
          style={{ background: i <= value ? tone : "#ffffff14" }}
        />
      ))}
    </span>
  );
}

export function ItemChip({
  item,
  count,
  onClick,
  selected,
  dim,
  title,
  iconSize = 28,
}: {
  item: ItemDef;
  count?: number;
  onClick?: () => void;
  selected?: boolean;
  dim?: boolean;
  title?: string;
  iconSize?: number;
}) {
  return (
    <button
      type="button"
      title={title ?? item.description}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2 rounded-sm border px-1.5 py-1 text-left text-xs transition-colors ${
        selected
          ? "border-[#00FFFF] bg-[#00FFFF]/10"
          : "border-[#33FF33]/25 hover:border-[#33FF33]/60"
      } ${dim ? "opacity-40" : ""}`}
    >
      <ItemIcon item={item} size={iconSize} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[#d8ffd8]">{item.name}</span>
        <VolatilityPips value={item.volatility} className="mt-0.5" />
      </span>
      {count !== undefined && <span className="shrink-0 text-[#FFB800]">×{count}</span>}
    </button>
  );
}

/** Square grid tile: icon, count badge, volatility pips, name. */
export function ItemTile({
  item,
  count,
  onClick,
  selected,
  dim,
  title,
  size = 64,
  isNew = false,
  onDragStart,
  onDragEnd,
  onFocus,
}: {
  item: ItemDef;
  count?: number;
  onClick?: () => void;
  selected?: boolean;
  dim?: boolean;
  title?: string;
  size?: number;
  /** Show a "NEW" marker. */
  isNew?: boolean;
  /** Makes the tile draggable (workbench). */
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  onFocus?: () => void;
}) {
  return (
    <button
      type="button"
      data-nav=""
      title={title ?? `${item.name} — ${item.description}`}
      aria-label={
        count === undefined
          ? item.name
          : count === 1
            ? tr("{name}, 1 pc", { name: item.name })
            : tr("{name}, {count} pcs", { name: item.name, count })
      }
      aria-pressed={selected}
      onClick={onClick}
      onFocus={onFocus}
      onMouseEnter={onFocus}
      draggable={onDragStart ? true : undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative flex flex-col items-center rounded-sm border p-1 transition-colors ${FOCUS_RING} ${
        selected
          ? "border-[#00FFFF] bg-[#00FFFF]/10 shadow-[0_0_8px_#00FFFF55]"
          : "border-[#33FF33]/20 hover:border-[#33FF33]/60 hover:bg-white/[0.03]"
      } ${dim ? "opacity-40" : ""}`}
      style={{ width: size + 10 }}
    >
      <ItemIcon item={item} size={size - 8} />
      <span className="mt-0.5 w-full truncate text-center text-[9px] leading-tight text-[#d8ffd8]/80">
        {item.name}
      </span>
      {count !== undefined && (
        <span className="absolute top-0.5 right-1 font-mono text-[10px] text-[#FFB800] [text-shadow:0_0_3px_#000]">
          {count}
        </span>
      )}
      {item.volatility >= 2 && (
        <VolatilityPips value={item.volatility} className="absolute top-1 left-1" />
      )}
      {isNew && <NewBadge className="absolute bottom-3 left-0.5 bg-black/70" />}
    </button>
  );
}

/**
 * Wrapper that animates its children in (scale + fade + glow flash) each
 * time `revealKey` changes.
 */
export function Reveal({
  revealKey,
  accent = "#00FFFF",
  children,
}: {
  revealKey: string | number;
  accent?: string;
  children: ReactNode;
}) {
  const [shownKey, setShownKey] = useState<string | number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShownKey(revealKey));
    return () => cancelAnimationFrame(id);
  }, [revealKey]);
  const shown = shownKey === revealKey;
  return (
    <div
      className={`rounded-sm border transition-all duration-500 ease-out motion-reduce:transition-none ${
        shown ? "scale-100 opacity-100 blur-none" : "scale-90 opacity-0 blur-[2px]"
      }`}
      style={{
        borderColor: `${accent}66`,
        boxShadow: shown ? `0 0 18px ${accent}33, inset 0 0 12px ${accent}14` : "none",
      }}
    >
      {children}
    </div>
  );
}

// ── Combination history (session memory, survives closing the panel) ──

export interface CombineHistoryEntry {
  inputs: ItemDef[];
  output: ItemDef;
  count: number;
  kind: string;
}

const combineHistory: CombineHistoryEntry[] = [];
export const COMBINE_HISTORY_MAX = 8;

export function pushCombineHistory(e: CombineHistoryEntry): void {
  combineHistory.unshift(e);
  combineHistory.length = Math.min(combineHistory.length, COMBINE_HISTORY_MAX);
}

export function getCombineHistory(): readonly CombineHistoryEntry[] {
  return combineHistory;
}

export const KIND_LABEL: Record<ItemDef["kind"], string> = {
  rohstoff: tr("Raw material"),
  bauteil: tr("Component"),
  prototyp: tr("Prototype"),
  relikt: tr("Relic"),
  schlacke: tr("Slag"),
  werkzeug: tr("Tool"),
  verbrauch: tr("Provision"),
};

/** Speaker names and colours (all NPCs, Jade, the Halo, the _unstables). */
export const SPEAKER: Record<string, { name: string; color: string }> = NPC_SPEAKERS;

// ── Buffs (decor actions: coffee, fresh air, greenhouse …) ───────

export const BUFF_ICON: Record<BuffKind, string> = {
  walk_speed: "»", // i18n-ignore (icon)
  hint_boost: "?",
  respawn_boost: "✿",
};

/** What a buff kind does, for chip tooltips. */
export const BUFF_EFFECT: Record<BuffKind, string> = {
  walk_speed: tr("Faster on your feet"),
  hint_boost: tr("Hints come more often"),
  respawn_boost: tr("Pickup spots refill faster"),
};

function buffTime(seconds: number): string {
  const t = Math.max(0, Math.ceil(seconds));
  return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}` : `${t} s`;
}

/** One buff: icon, label, remaining time. */
export function BuffChip({ buff }: { buff: Pick<ActiveBuff, "kind" | "label" | "remaining"> }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border border-[#00FFFF]/50 bg-[#00FFFF]/10 px-1.5 py-0.5 text-[10px] text-[#00FFFF]"
      title={tr("{label}: {effect} · {time} left", {
        label: buff.label,
        effect: BUFF_EFFECT[buff.kind],
        time: buffTime(buff.remaining),
      })}
    >
      <span aria-hidden>{BUFF_ICON[buff.kind]}</span>
      <span>{buff.label}</span>
      <span className="text-[#00FFFF]/60 tabular-nums">{buffTime(buff.remaining)}</span>
    </span>
  );
}

/**
 * Active buffs as small HUD chips; re-reads the play clock once a second
 * (the world only re-renders every few seconds on its own). Renders
 * nothing when no buff runs.
 */
export function BuffHud({ getState }: { getState: () => WorldState }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = getState();
  const buffs = activeBuffs(s, s.playTime);
  if (!buffs.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1" role="status" aria-label={tr("Active effects")}>
      {buffs.map((b) => (
        <BuffChip key={b.id} buff={b} />
      ))}
    </div>
  );
}

export interface HudMenuItem {
  id: string;
  label: ReactNode;
  /** Accessible name when `label` is not plain text (e.g. "★ 3/40"). */
  ariaLabel?: string;
  /** Tooltip (shortcut hint). */
  title?: string;
  onSelect: () => void;
}

/**
 * Compact HUD: one "☰" button that folds the panel buttons into a dropdown
 * menu. Keyboard: Enter/Space/↓ opens and focuses the first entry, ↑/↓/
 * Home/End move, Enter/Space picks, Esc or Tab closes (Esc returns focus to
 * the button). Keys handled here never reach the world hotkeys; while the
 * menu is open it counts as a menu layer, so the game ignores its own Esc.
 */
export function HudMenu({
  items,
  label,
  className = "",
}: {
  items: readonly HudMenuItem[];
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusOnOpen = useRef<number | null>(null);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  };
  useEscLayer(() => close(true), open);

  useEffect(() => {
    if (!open) return;
    const i = focusOnOpen.current;
    focusOnOpen.current = null;
    if (i !== null) itemRefs.current[i]?.focus();
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openAt = (i: number) => {
    focusOnOpen.current = i;
    setOpen(true);
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      openAt(e.key === "ArrowUp" ? items.length - 1 : 0);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = itemRefs.current.filter((x): x is HTMLButtonElement => !!x);
    const at = list.findIndex((x) => x === document.activeElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (at + 1) % list.length;
    else if (e.key === "ArrowUp") next = (at - 1 + list.length) % list.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else if (e.key === "Tab") {
      setOpen(false);
      return;
    } else if (e.key !== "Escape") {
      // Letters/space/enter stay inside the menu (no world hotkeys while it is open).
      e.stopPropagation();
      return;
    }
    if (next !== null) {
      e.preventDefault();
      e.stopPropagation();
      list[next]?.focus();
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <CrtButton
        tone="cyan"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onKeyDown={onButtonKey}
        onClick={(e) => {
          // Keyboard activation (detail 0) moves focus into the menu.
          if (open) close(false);
          else if (e.detail === 0) openAt(0);
          else setOpen(true);
        }}
      >
        ☰
      </CrtButton>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute top-full right-0 z-30 mt-1 flex min-w-44 flex-col gap-0.5 rounded-sm border border-[#00FFFF]/40 bg-black/90 p-1 shadow-[0_0_12px_rgba(0,255,255,0.15)]"
        >
          {items.map((it, i) => (
            <button
              key={it.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-label={it.ariaLabel}
              title={it.title}
              onClick={() => {
                close(true);
                it.onSelect();
              }}
              className={`rounded-sm px-2 py-1 text-left font-mono text-[11px] tracking-wider text-[#aefcff] uppercase hover:bg-[#00FFFF]/10 focus:bg-[#00FFFF]/15 ${FOCUS_RING}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

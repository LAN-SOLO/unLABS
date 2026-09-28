"use client";

import { tr } from "@/lib/i18n";
import { memo, useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { SPEAKER, UI } from "@/components/world/ui";
import type { Toast } from "@/components/world/useWorld";
import type { SfxName } from "@/lib/world/audio/sfx";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { INSIGHT_BY_ID } from "@/lib/world/content/story";
import { describeCond, evalCond } from "@/lib/world/game";
import type { Condition, DialogueLine, WorldState } from "@/lib/world/types";

export interface WorldApi {
  get: () => WorldState;
  act: <T>(fn: (s: WorldState) => T) => T;
  toast: (text: string, tone?: Toast["tone"], item?: string) => void;
  version: number;
  /** Optional sound hook (audio system). */
  sound?: (name: SfxName) => void;
  /** Optional speech synth for dialogue lines. */
  speak?: (text: string, who: string) => void;
  /** Optional 3D burst at the nearest workbench after a combination. */
  workbenchFx?: (kind: "recipe" | "prototype" | "explosion") => void;
}

/** Announce new insights and blueprints as toasts. */
export function announce(api: WorldApi, r: { insights?: string[]; discovered?: string[] }): void {
  for (const i of r.insights ?? []) {
    const def = INSIGHT_BY_ID.get(i);
    if (def) api.toast(tr("Insight — {title}", { title: def.title }), "insight");
  }
  for (const d of r.discovered ?? []) {
    const def = DEVICE_BY_ID.get(d);
    if (def) api.toast(tr("Blueprint discovered — {name}", { name: def.name }), "good");
  }
}

/**
 * Props equality for panels: the world state is mutated in place and
 * `api.version` is its change signal, so `api` compares by version. Callback
 * props are re-created on every render of the host (which re-renders every
 * animation frame) and are ignored — they only close over stable refs and
 * setters. Everything else compares by identity.
 */
export function panelPropsEqual<P extends object>(a: P, b: P): boolean {
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const k of keys) {
    const va = ra[k];
    const vb = rb[k];
    if (typeof va === "function" && typeof vb === "function") continue;
    if (k === "api" && isApi(va) && isApi(vb)) {
      if (va.version !== vb.version || va.get !== vb.get) return false;
      continue;
    }
    if (!Object.is(va, vb)) return false;
  }
  return true;
}

function isApi(v: unknown): v is WorldApi {
  return typeof v === "object" && v !== null && "version" in v && "get" in v;
}

/** Memoize a panel so it re-renders on world changes, not on every host frame. */
export function memoPanel<P extends object>(c: ComponentType<P>): ComponentType<P> {
  return memo(c, panelPropsEqual);
}

// ── "New" markers (per browser, UI convenience only) ─────────────

export type SeenScope = "achievements" | "codex" | "insights" | "items";
const SEEN_KEY = "unlabs.ui.seen.v1";

function readAll(): Partial<Record<SeenScope, string[]>> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Partial<Record<SeenScope, string[]>>)
      : {};
  } catch {
    return {};
  }
}

export function readSeen(scope: SeenScope): Set<string> {
  const list = readAll()[scope];
  return new Set(Array.isArray(list) ? list.filter((x) => typeof x === "string") : []);
}

export function writeSeen(scope: SeenScope, ids: Iterable<string>): void {
  try {
    const all = readAll();
    const set = readSeen(scope);
    for (const id of ids) set.add(id);
    all[scope] = [...set];
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable (private mode): markers simply stay.
  }
}

/**
 * Which ids were unseen when the panel opened. `markOnClose` ids are
 * stored as seen when the panel unmounts (so the markers stay visible while
 * it is open); `mark` stores ids immediately (e.g. a codex entry opened).
 */
export function useSeen(
  scope: SeenScope,
  markOnClose?: readonly string[],
): { isNew: (id: string) => boolean; mark: (ids: readonly string[]) => void } {
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(scope));
  const pending = useRef(markOnClose);
  useEffect(() => {
    pending.current = markOnClose;
  });
  useEffect(
    () => () => {
      if (pending.current?.length) writeSeen(scope, pending.current);
    },
    [scope],
  );
  const mark = useCallback(
    (ids: readonly string[]) => {
      if (!ids.length) return;
      writeSeen(scope, ids);
      setSeen((prev) => {
        if (ids.every((id) => prev.has(id))) return prev;
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    },
    [scope],
  );
  const isNew = useCallback((id: string) => !seen.has(id), [seen]);
  return { isNew, mark };
}

/** Re-render once a second while `active` (countdowns inside memoized panels). */
export function useSecondTick(active: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);
}

// ── Small shared views ───────────────────────────────────────────

export function Lines({ lines }: { lines: DialogueLine[] }) {
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const sp = SPEAKER[l.who] ?? { name: l.who, color: "#fff" };
        return (
          <p key={i} className="text-[13px]">
            <span
              className="mr-2 text-[11px] tracking-widest uppercase"
              style={{ color: sp.color }}
            >
              {sp.name}
            </span>
            <span style={{ color: UI.text }}>{l.text}</span>
          </p>
        );
      })}
    </div>
  );
}

/** "High Alloy = 2 Base Alloy + Energy Cell" … for a missing named part. */
export function RecipeChain({ lines }: { lines: { item: string; text: string }[] }) {
  if (!lines.length) return null;
  return (
    <ul className="mt-1 space-y-0.5 border-l border-[#00FFFF]/30 pl-2 text-[11px] text-[#aefcff]/80">
      {lines.map((l) => (
        <li key={l.item}>{l.text}</li>
      ))}
    </ul>
  );
}

export function Missing({ cond, s }: { cond: Condition; s: WorldState }) {
  const parts = "all" in cond ? cond.all : [cond];
  return (
    <ul className="mt-2 space-y-0.5 text-xs">
      {parts.map((c, i) => {
        const ok = evalCond(s, c);
        return (
          <li key={i} className={ok ? "text-[#33FF33]" : "text-white/50"}>
            {ok ? "✓" : "·"} {describeCond(c)}
          </li>
        );
      })}
    </ul>
  );
}

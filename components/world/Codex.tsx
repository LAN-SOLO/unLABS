"use client";

import { tr } from "@/lib/i18n";
import { memo, useEffect, useMemo, useState } from "react";
import {
  FOCUS_RING,
  Meter,
  NewBadge,
  Panel,
  SearchField,
  UI,
  gridKeyNav,
} from "@/components/world/ui";
import { useKeyText } from "@/components/world/keys";
import { useSeen } from "@/components/world/panels/shared";
import {
  CODEX_TABS,
  CODEX_TAB_LABEL,
  codexEntriesFor,
  codexProgress,
  codexUnlocked,
  CODEX_ENTRIES,
  searchCodex,
  type CodexBlock,
  type CodexEntry,
  type CodexTab,
} from "@/lib/world/content/codex";
import {
  archetypeCodex,
  protoEffectCodex,
  type ArchetypeCodexEntry,
  type ProtoEffectCodexEntry,
} from "@/lib/world/combine";
import type { WorldState } from "@/lib/world/types";

const LOCKED = "???";

/** Sandbox chapters rendered from `lib/world/combine` (not codex content entries). */
type SandboxTab = "archetypen" | "wirkungen";
const SANDBOX_TABS: readonly SandboxTab[] = ["archetypen", "wirkungen"];
const SANDBOX_LABEL: Record<SandboxTab, string> = {
  archetypen: tr("Archetypes"),
  wirkungen: tr("Prototype effects"),
};
const isSandboxTab = (t: string): t is SandboxTab =>
  (SANDBOX_TABS as readonly string[]).includes(t);

interface SandboxRow {
  id: string;
  title: string;
  sub?: string;
  open: boolean;
  color?: string;
}

function sandboxRows(state: WorldState, tab: SandboxTab): SandboxRow[] {
  return tab === "archetypen"
    ? archetypeCodex(state.flags).map((a) => ({
        id: a.id,
        title: a.discovered ? a.name : LOCKED,
        sub: a.discovered ? a.property : undefined,
        open: a.discovered,
        color: a.hex,
      }))
    : protoEffectCodex(state.flags).map((e) => ({
        id: e.id,
        title: e.name,
        sub: e.used ? tr("used · {rule}", { rule: e.rule }) : e.rule,
        open: true,
        color: e.used ? UI.magenta : undefined,
      }));
}

function ArchetypeDetail({ a }: { a: ArchetypeCodexEntry }) {
  if (!a.discovered)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
        <span
          aria-hidden
          className="h-3 w-10 rounded-[2px] opacity-40"
          style={{ background: a.hex, boxShadow: `0 0 8px ${a.hex}` }}
        />
        <p className="text-2xl tracking-[0.3em] text-white/25">{LOCKED}</p>
        <p className="text-xs text-white/40">
          {tr(
            "A named archetype, never built. The colour gives away the wavelength — the rest happens at the workbench.",
          )}
        </p>
      </div>
    );
  return (
    <article className="space-y-3">
      <header>
        <h3 className="text-sm tracking-wider" style={{ color: a.hex }}>
          ◆ {a.name}
        </h3>
        <p className="mt-0.5 text-[11px] text-white/50">
          {tr("Wavelength {color}", { color: a.color })}
        </p>
      </header>
      <p className="text-xs leading-relaxed text-[#d8ffd8]">{a.property}</p>
      <p className="text-[11px] text-white/60">
        <span className="text-[#FFB800]">{tr("Detection:")}</span> {a.rule}
      </p>
      {a.lore && <p className="text-xs text-[#E8F4FF]/70 italic">{a.lore}</p>}
    </article>
  );
}

function EffectDetail({ e }: { e: ProtoEffectCodexEntry }) {
  return (
    <article className="space-y-3">
      <header>
        <h3 className="text-sm tracking-wider" style={{ color: e.used ? UI.magenta : UI.cyan }}>
          {e.name}
          {e.used && (
            <span className="ml-2 rounded-sm border border-[#33FF33]/60 px-1.5 py-px align-middle text-[9px] tracking-widest text-[#33FF33] uppercase">
              {tr("used")}
            </span>
          )}
        </h3>
        <p className="mt-0.5 text-[11px] text-white/50">
          {tr("Threshold: {rule}", { rule: e.rule })}
        </p>
      </header>
      <ul className="space-y-1 text-xs text-[#d8ffd8]">
        <li className="flex gap-2">
          <span className="text-[#FFB800]">{tr("Target")}</span>
          <span>{e.targets}</span>
        </li>
        <li className="flex gap-2">
          <span className="text-[#FFB800]">{tr("Effect")}</span>
          <span>{e.effect}</span>
        </li>
      </ul>
      <p className="text-[11px] text-white/60 italic">{e.hint}</p>
      <p className="text-[10px] text-white/35">
        {tr(
          "In the game: look at a device, station, door, bot or pickup spot and choose “Use with prototype …”. Failed attempts cost nothing.",
        )}
      </p>
    </article>
  );
}

function SandboxDetail({ state, tab, id }: { state: WorldState; tab: SandboxTab; id: string }) {
  if (tab === "archetypen") {
    const a = archetypeCodex(state.flags).find((x) => x.id === id);
    return a ? <ArchetypeDetail a={a} /> : null;
  }
  const e = protoEffectCodex(state.flags).find((x) => x.id === id);
  return e ? <EffectDetail e={e} /> : null;
}

function Block({ block, state }: { block: CodexBlock; state: WorldState }) {
  const k = useKeyText();
  switch (block.kind) {
    case "p":
      return block.text ? (
        <p className="text-xs leading-relaxed text-[#d8ffd8]">{k(block.text)}</p>
      ) : null;
    case "list":
      return (
        <ul className="space-y-1 text-xs text-[#d8ffd8]">
          {block.items.map((it) => (
            <li key={it} className="flex gap-2">
              <span className="text-[#FFB800]">›</span>
              <span>{k(it)}</span>
            </li>
          ))}
        </ul>
      );
    case "swatch":
      return (
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <span
            className="h-3 w-8 rounded-[2px]"
            style={{ background: block.color, boxShadow: `0 0 8px ${block.color}` }}
          />
          <span>{block.label}</span>
          <span className="text-white/30">{block.color}</span>
        </div>
      );
    case "table": {
      const hasHead = block.head.some(Boolean);
      return (
        <table className="w-full border-collapse text-[11px]">
          {hasHead && (
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-[#FFB800]/25 py-1 pr-3 text-left font-normal tracking-wider text-[#FFB800]/80 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((r, i) => {
              const open = codexUnlocked(state, r.unlock);
              return (
                <tr key={i} className="border-b border-white/5">
                  {r.cells.map((c, j) => (
                    <td
                      key={j}
                      className={`py-1 pr-3 align-top ${open ? "text-[#d8ffd8]" : "text-white/25"}`}
                      style={open && j === 0 && r.color ? { color: r.color } : undefined}
                    >
                      {open ? k(c) : j === 0 ? LOCKED : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
  }
}

function EntryDetail({ entry, state }: { entry: CodexEntry; state: WorldState }) {
  const k = useKeyText();
  if (!codexUnlocked(state, entry.unlock)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
        <p className="text-2xl tracking-[0.3em] text-white/25">{LOCKED}</p>
        <p className="text-xs text-white/40">
          {tr("Not discovered yet. The handbook fills up as you explore the lab.")}
        </p>
      </div>
    );
  }
  return (
    <article className="space-y-3">
      <header>
        <h3 className="text-sm tracking-wider" style={{ color: entry.color ?? "#00FFFF" }}>
          {entry.title}
          {entry.badge && (
            <span className="ml-2 rounded-sm border border-[#E91E8C]/60 px-1.5 py-px align-middle text-[9px] tracking-widest text-[#E91E8C] uppercase">
              {entry.badge}
            </span>
          )}
        </h3>
        {entry.sub && <p className="mt-0.5 text-[11px] text-white/50">{k(entry.sub)}</p>}
      </header>
      {entry.blocks.map((b, i) => (
        <Block key={i} block={b} state={state} />
      ))}
    </article>
  );
}

/**
 * In-game "Lab handbook": tabbed, searchable, entries unlock from the save
 * state. Unlocked entries not opened yet carry a "NEW" marker. `version` is
 * the world change counter (the state object is mutated in place).
 */
function CodexImpl({
  state,
  onClose,
  initialTab = "grundlagen",
  initialEntry,
  version = 0,
}: {
  state: WorldState;
  onClose: () => void;
  initialTab?: CodexTab;
  /** Entry to select on open (e.g. from the map dossier). */
  initialEntry?: string;
  version?: number;
}) {
  const [tab, setTab] = useState<CodexTab | SandboxTab>(initialTab);
  const sandbox = isSandboxTab(tab) ? tab : null;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(initialEntry ?? null);
  const seen = useSeen("codex");
  const k = useKeyText();

  const searching = query.trim().length > 0;
  const entries = useMemo(
    () => (searching ? searchCodex(state, query) : isSandboxTab(tab) ? [] : codexEntriesFor(tab)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searching, state, query, tab, version],
  );
  const current =
    entries.find((e) => e.id === selected) ??
    entries.find((e) => codexUnlocked(state, e.unlock)) ??
    entries[0];
  const progress = useMemo(
    () => new Map(CODEX_TABS.map((t) => [t, codexProgress(state, t)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, version],
  );
  const total = [...progress.values()].reduce(
    (acc, p) => ({ unlocked: acc.unlocked + p.unlocked, total: acc.total + p.total }),
    { unlocked: 0, total: 0 },
  );
  /** Tabs holding unlocked entries that were never opened. */
  const freshTabs = useMemo(
    () =>
      new Set(
        CODEX_ENTRIES.filter((e) => codexUnlocked(state, e.unlock) && seen.isNew(e.id)).map(
          (e) => e.tab,
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, version, seen],
  );

  // Opening an entry marks it as read.
  const currentId = current && codexUnlocked(state, current.unlock) ? current.id : null;
  const rows = useMemo(
    () => (sandbox ? sandboxRows(state, sandbox) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sandbox, state, version],
  );
  const sandboxProgress = useMemo(
    () =>
      new Map(
        SANDBOX_TABS.map((t) => {
          const all = sandboxRows(state, t);
          const done =
            t === "archetypen"
              ? all.filter((r) => r.open).length
              : protoEffectCodex(state.flags).filter((e) => e.used).length;
          return [t, { unlocked: done, total: all.length }];
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, version],
  );
  const sandboxCurrent = sandbox
    ? (rows.find((r) => r.id === selected) ?? rows.find((r) => r.open) ?? rows[0])
    : undefined;
  const { mark } = seen;
  useEffect(() => {
    if (currentId) mark([currentId]);
  }, [currentId, mark]);

  return (
    <Panel
      title={tr("Lab handbook")}
      subtitle={tr("_unLAB · {n}/{total} entries discovered", {
        n: total.unlocked,
        total: total.total,
      })}
      onClose={onClose}
      wide
    >
      <div className="flex flex-col gap-3">
        <Meter
          value={total.unlocked}
          max={total.total}
          color={UI.amber}
          label={tr("Handbook: {n} of {total} entries", { n: total.unlocked, total: total.total })}
        />
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={tr("Chapters")}>
          {CODEX_TABS.map((t) => {
            const p = progress.get(t) ?? { unlocked: 0, total: 0 };
            const active = !searching && t === tab;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(t);
                  setQuery("");
                  setSelected(null);
                }}
                className={`relative rounded-sm border px-2 py-1 text-[11px] tracking-wider uppercase transition-colors ${FOCUS_RING} ${
                  active
                    ? "border-[#FFB800] bg-[#FFB800]/15 text-[#FFB800]"
                    : "border-[#33FF33]/25 text-[#33FF33]/70 hover:border-[#33FF33]/60"
                }`}
              >
                {CODEX_TAB_LABEL[t]}
                <span className="ml-1.5 text-[9px] text-white/40">
                  {p.unlocked}/{p.total}
                </span>
                {freshTabs.has(t) && (
                  <span aria-label={tr("new entries")} className="ml-1 text-[#E91E8C]">
                    •
                  </span>
                )}
                <span
                  aria-hidden
                  className="absolute right-0 bottom-0 left-0 h-px bg-[#FFB800]/60"
                  style={{ width: `${p.total ? (p.unlocked / p.total) * 100 : 0}%` }}
                />
              </button>
            );
          })}
          {SANDBOX_TABS.map((t) => {
            const p = sandboxProgress.get(t) ?? { unlocked: 0, total: 0 };
            const active = !searching && t === tab;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(t);
                  setQuery("");
                  setSelected(null);
                }}
                className={`relative rounded-sm border px-2 py-1 text-[11px] tracking-wider uppercase transition-colors ${FOCUS_RING} ${
                  active
                    ? "border-[#E91E8C] bg-[#E91E8C]/15 text-[#E91E8C]"
                    : "border-[#E91E8C]/30 text-[#E91E8C]/70 hover:border-[#E91E8C]/60"
                }`}
              >
                {SANDBOX_LABEL[t]}
                <span className="ml-1.5 text-[9px] text-white/40">
                  {p.unlocked}/{p.total}
                </span>
                <span
                  aria-hidden
                  className="absolute right-0 bottom-0 left-0 h-px bg-[#E91E8C]/60"
                  style={{ width: `${p.total ? (p.unlocked / p.total) * 100 : 0}%` }}
                />
              </button>
            );
          })}
        </div>

        <SearchField
          value={query}
          onChange={(v) => {
            setQuery(v);
            setSelected(null);
          }}
          placeholder={tr("Search … (e.g. volatility, brownout, Halo)")}
          label={tr("Search the handbook")}
          className="w-full px-3 py-1.5 text-xs"
        />

        <div className="grid h-[52vh] min-h-[240px] grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul
            className="h-full space-y-0.5 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
            onKeyDown={gridKeyNav}
            aria-label={tr("Entries")}
          >
            {sandbox &&
              !searching &&
              rows.map((r) => {
                const active = sandboxCurrent?.id === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      data-nav=""
                      aria-current={active ? "true" : undefined}
                      onClick={() => setSelected(r.id)}
                      onFocus={() => setSelected(r.id)}
                      className={`w-full rounded-sm border px-2 py-1 text-left text-xs transition-colors ${FOCUS_RING} ${
                        active
                          ? "border-[#E91E8C]/70 bg-[#E91E8C]/10"
                          : "border-transparent hover:border-[#E91E8C]/30"
                      }`}
                    >
                      <span
                        className={r.open ? "text-[#d8ffd8]" : "text-white/25"}
                        style={
                          r.color && (r.open || sandbox === "archetypen")
                            ? { color: r.open ? r.color : `${r.color}88` }
                            : undefined
                        }
                      >
                        {sandbox === "archetypen" ? "◆ " : ""}
                        {r.title}
                      </span>
                      {r.sub && (
                        <span className="block truncate text-[10px] text-white/40" title={r.sub}>
                          {r.sub}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            {!(sandbox && !searching) && entries.length === 0 && (
              <li className="px-2 py-4 text-xs text-white/40">
                {searching ? tr("Nothing found — or not discovered yet.") : tr("Empty.")}
              </li>
            )}
            {entries.map((e) => {
              const open = codexUnlocked(state, e.unlock);
              const active = current?.id === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    data-nav=""
                    aria-current={active ? "true" : undefined}
                    onClick={() => setSelected(e.id)}
                    onFocus={() => setSelected(e.id)}
                    className={`w-full rounded-sm border px-2 py-1 text-left text-xs transition-colors ${FOCUS_RING} ${
                      active
                        ? "border-[#00FFFF]/70 bg-[#00FFFF]/10"
                        : "border-transparent hover:border-[#33FF33]/30"
                    }`}
                  >
                    <span
                      className={open ? "text-[#d8ffd8]" : "text-white/25"}
                      style={open && e.color ? { color: e.color } : undefined}
                    >
                      {open ? e.title : LOCKED}
                    </span>
                    {open && seen.isNew(e.id) && !active && <NewBadge className="ml-1.5" />}
                    {open && e.badge && (
                      <span className="ml-1.5 text-[9px] tracking-wider text-[#E91E8C] uppercase">
                        {e.badge}
                      </span>
                    )}
                    {searching && (
                      <span className="ml-1.5 text-[9px] text-white/35 uppercase">
                        {CODEX_TAB_LABEL[e.tab]}
                      </span>
                    )}
                    {open && e.sub && (
                      <span className="block truncate text-[10px] text-white/40" title={k(e.sub)}>
                        {k(e.sub)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="h-full overflow-y-auto border-t border-[#FFB800]/20 pt-3 [scrollbar-gutter:stable] md:border-t-0 md:border-l md:pt-0 md:pl-4">
            {sandbox && !searching ? (
              sandboxCurrent ? (
                <SandboxDetail state={state} tab={sandbox} id={sandboxCurrent.id} />
              ) : null
            ) : current ? (
              <EntryDetail entry={current} state={state} />
            ) : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export const Codex = memo(
  CodexImpl,
  (a, b) => a.state === b.state && a.version === b.version && a.initialTab === b.initialTab,
);

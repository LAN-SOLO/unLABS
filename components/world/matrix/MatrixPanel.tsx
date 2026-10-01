"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tr } from "@/lib/i18n";
import {
  CrtButton,
  FilterChip,
  INPUT_CLASS,
  Meter,
  Panel,
  SectionTitle,
  UI,
} from "@/components/world/ui";
import type { WorldApi } from "@/components/world/panels/shared";
import { ITEM_BY_ID } from "@/lib/world/content/items";
import { DEVICES } from "@/lib/world/content/devices";
import { count, power } from "@/lib/world/game";
import { FRAME_MS, captureLabel, captureName } from "@/lib/world/uneth-crystal";
import type { MatrixField, MatrixSlice, WorldState } from "@/lib/world/types";
import {
  RARITIES,
  RARITY_NAME,
  SLICE_POSITIONS,
  rarityOf,
  sliceCode,
  tokenById,
  type Rarity,
  type SliceLine,
} from "@/lib/world/matrix/archive";
import {
  HISTORY_DAYS,
  HISTORY_END,
  HISTORY_SOURCE,
  HISTORY_START,
  chainStateAt,
  dateOf,
  dayAt,
  indexOf,
  indicatorsAt,
  monochromeDays,
} from "@/lib/world/matrix/history";
import {
  FIELDS,
  FIELD_COST,
  FIELD_WATTS,
  abortExtraction,
  autoArrange,
  composeBlock,
  crystalMotion,
  dismantleCrystal,
  freeSlices,
  jobProgress,
  jobRemainingMs,
  labCompletion,
  lineChances,
  matrixAwake,
  saveCrystal,
  sliceByUid,
  startBlock,
  startBlockText,
  startExtraction,
  type CrystalMotion,
} from "@/lib/world/matrix/rules";
import { MINT_NETWORKS, crystalMetadata, mintReadiness } from "@/lib/world/matrix/mint";
import {
  crystalGif,
  downloadBlob,
  drawFrame,
  sliceCanvas,
  type FrameRef,
} from "@/lib/world/matrix/capture";

/**
 * The Matrix Chamber console (Control Room, post-game): tune to a day of
 * the real ETH ledger, feed energy and rare materials, wait 2–24 h of real
 * time for a slice to dissolve out of the matrix, collect the slices,
 * compose crystals at 30 positions and keep them (GIF) in the chamber's
 * inventory. Minting is prepared, not open yet.
 */

type Tab = "extract" | "archive" | "compose" | "mint";

const TABS: readonly [Tab, string][] = [
  ["extract", tr("matrix::Extraction")],
  ["archive", tr("matrix::Slices")],
  ["compose", tr("matrix::Composer")],
  ["mint", tr("matrix::Mint")],
];

const RARITY_LABEL = RARITY_NAME;

const RARITY_COLOR: Readonly<Record<Rarity, string>> = {
  common: "#9fb3a6",
  uncommon: UI.green,
  rare: UI.cyan,
  epic: UI.magenta,
  legendary: UI.amber,
};

const LINE_LABEL: Readonly<Record<SliceLine, string>> = {
  pure: tr("P02 pure"),
  rgb: tr("P03 RGB"),
  mono: tr("P01 mono"),
};

const MOTION_LABEL: Readonly<Record<CrystalMotion, string>> = {
  turning: tr("turns like the original capture"),
  still: tr("stands still"),
  partial: tr("turns, with gaps"),
  exotic: tr("exotic — mixed slices"),
};

function fmtDuration(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h} h ${String(m).padStart(2, "0")} min`
    : `${m} min ${String(sec).padStart(2, "0")} s`;
}

function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** A slice thumbnail drawn by the capture renderer. */
function SliceThumb({ token, pos, size = 56 }: { token: number; pos: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(sliceCanvas(token, pos, 128), 0, 0, size, size);
  }, [token, pos, size]);
  return <canvas ref={ref} width={size} height={size} className="block bg-black" />;
}

/** The crystal playing its 30 positions (80 ms each). */
function CrystalPlayer({ frames, size = 200 }: { frames: readonly FrameRef[]; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % SLICE_POSITIONS), FRAME_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawFrame(ctx, frames[frame] ?? null, size);
  }, [frame, frames, size]);
  return (
    <div className="flex flex-col items-center gap-1">
      <canvas
        ref={ref}
        width={size}
        height={size}
        className="block rounded-sm border border-[#33FF33]/20 bg-black"
      />
      <span className="text-[10px] text-white/40">
        P{String(frame + 1).padStart(2, "0")} · {frame * 6}°
      </span>
    </div>
  );
}

export function MatrixPanel({ api, onClose }: { api: WorldApi; onClose: () => void }) {
  const s = api.get();
  const [tab, setTab] = useState<Tab>("extract");
  const awake = matrixAwake(s);
  const done = labCompletion(s);
  return (
    <Panel
      title={tr("Matrix Chamber")}
      subtitle={tr("Slices from the matrix of the Ethereum chain")}
      onClose={onClose}
      wide
      accent={UI.cyan}
    >
      <div className="mb-3 flex flex-wrap gap-1" role="tablist">
        {TABS.map(([id, label]) => (
          <FilterChip key={id} active={tab === id} onClick={() => setTab(id)} accent={UI.cyan}>
            {label}
            {id === "archive" && ` ${s.matrix.slices.length}`}
            {id === "compose" && ` ${s.matrix.crystals.length}`}
          </FilterChip>
        ))}
      </div>
      {!awake ? (
        <div className="space-y-2 text-xs leading-relaxed text-[#d8ffd8]">
          <p>
            {tr(
              "The chamber sleeps. Before Damien vanished, the researchers learned to pull slices out of the matrix of the Ethereum chain — the apparatus wakes only when the whole lab runs again.",
            )}
          </p>
          <Meter
            value={done.built}
            max={done.total}
            color={UI.cyan}
            label={tr("{n} of {total} devices built", { n: done.built, total: done.total })}
          />
          <p className="text-white/50">
            {tr("{n} of {total} devices built", { n: done.built, total: done.total })}
          </p>
        </div>
      ) : (
        <>
          {tab === "extract" && <ExtractTab api={api} s={s} />}
          {tab === "archive" && <ArchiveTab s={s} />}
          {tab === "compose" && <ComposeTab api={api} s={s} />}
          {tab === "mint" && <MintTab s={s} />}
        </>
      )}
    </Panel>
  );
}

// ── Extraction ───────────────────────────────────────────────────

function ExtractTab({ api, s }: { api: WorldApi; s: WorldState }) {
  const job = s.matrix.job;
  const now = useNow(true);
  const [day, setDay] = useState(() => job?.day ?? "2018-03-07");
  const [field, setField] = useState<MatrixField>(job?.field ?? 1);
  const mono = useMemo(() => monochromeDays().map(dateOf), []);
  const i = indexOf(day);
  const valid = i >= 0;
  const d = valid ? dayAt(i) : null;
  const ind = valid ? indicatorsAt(i) : null;
  const st = valid ? chainStateAt(i) : null;
  const block = startBlock(s, field, day);
  const chances = st ? lineChances(field, st) : null;
  const gen = power(s).generation;

  if (job) {
    const left = jobRemainingMs(s, now);
    return (
      <div className="space-y-3 text-xs text-[#d8ffd8]">
        <SectionTitle accent={UI.cyan}>{tr("Extraction running")}</SectionTitle>
        <p>
          {tr("Tuned to {day} · field {n}. A slice is dissolving out of the matrix.", {
            day: job.day,
            n: job.field,
          })}
        </p>
        <Meter
          value={jobProgress(s, now)}
          max={1}
          color={UI.cyan}
          height={8}
          label={tr("Extraction progress")}
        />
        <p className="text-white/60">
          {left > 0
            ? tr("Ready in {t} — keeps running while the game is closed.", { t: fmtDuration(left) })
            : tr("Materialising…")}
        </p>
        <p className="text-white/40">
          {tr("Started {a} · ends {b}", {
            a: new Date(job.start).toLocaleString(),
            b: new Date(job.end).toLocaleString(),
          })}
        </p>
        <CrtButton
          tone="red"
          onClick={() => {
            if (api.act((w) => abortExtraction(w)))
              api.toast(tr("Extraction aborted. The materials are lost."), "warn");
          }}
        >
          {tr("Abort")}
        </CrtButton>
      </div>
    );
  }

  return (
    <div className="grid gap-4 text-xs text-[#d8ffd8] md:grid-cols-2">
      <div className="space-y-2">
        <SectionTitle accent={UI.cyan}>{tr("Ledger day")}</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className={INPUT_CLASS}
            min={HISTORY_START}
            max={HISTORY_END}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-label={tr("Ledger day")}
          />
          <CrtButton
            tone="cyan"
            onClick={() => setDay(dateOf(Math.floor(Math.random() * HISTORY_DAYS)))}
          >
            {tr("Random day")}
          </CrtButton>
        </div>
        <p className="text-white/40">
          {tr("Recorded {a} – {b}, {n} days. Source: {src}.", {
            a: HISTORY_START,
            b: HISTORY_END,
            n: fmtNum(HISTORY_DAYS),
            src: HISTORY_SOURCE,
          })}
        </p>
        {d && ind && st ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt className="text-white/50">{tr("Price")}</dt>
            <dd>
              {d.priceUsd > 0
                ? `$${fmtNum(d.priceUsd, 2)} (${ind.change >= 0 ? "+" : ""}${fmtNum((Math.exp(ind.change) - 1) * 100, 1)} %)`
                : tr("no market yet")}
            </dd>
            <dt className="text-white/50">{tr("Block height")}</dt>
            <dd>{fmtNum(d.height)}</dd>
            <dt className="text-white/50">{tr("Transactions")}</dt>
            <dd>{fmtNum(d.txs)}</dd>
            <dt className="text-white/50">{tr("Fees")}</dt>
            <dd>{fmtNum(d.feesEth, 1)} ETH</dd>
            <dt className="text-white/50">{tr("Burned")}</dt>
            <dd>{fmtNum(d.burnedEth, 1)} ETH</dd>
            <dt className="text-white/50">{tr("Chain state")}</dt>
            <dd>
              T{st.tier} · {st.io === "IO" ? "I/O" : st.io} · {st.era} bit · {st.rotation} ·{" "}
              {st.stasis}
            </dd>
          </dl>
        ) : (
          <p style={{ color: UI.red }}>{tr("The ledger has no record of that day.")}</p>
        )}
        {st?.mono && (
          <p style={{ color: UI.amber }}>
            {tr(
              "A monochrome day: every indicator stood at an extreme at once. At field 5 the mono line is within reach.",
            )}
          </p>
        )}
        <details className="text-white/50">
          <summary className="cursor-pointer">
            {tr("Monochrome days in the ledger ({n})", { n: mono.length })}
          </summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {mono.map((m) => (
              <FilterChip
                key={m}
                role="button"
                active={m === day}
                onClick={() => setDay(m)}
                accent={UI.amber}
              >
                {m}
              </FilterChip>
            ))}
          </div>
        </details>
      </div>
      <div className="space-y-2">
        <SectionTitle accent={UI.cyan}>{tr("Field strength")}</SectionTitle>
        <div className="flex flex-wrap gap-1">
          {FIELDS.map((f) => (
            <FilterChip
              key={f}
              role="button"
              active={f === field}
              onClick={() => setField(f)}
              accent={UI.cyan}
            >
              {f} · {FIELD_WATTS[f]} W
            </FilterChip>
          ))}
        </div>
        <p className="text-white/50">{tr("Grid: {w} W", { w: fmtNum(gen) })}</p>
        <SectionTitle accent={UI.cyan}>{tr("Materials")}</SectionTitle>
        <ul className="space-y-0.5">
          {Object.entries(FIELD_COST[field]).map(([id, n]) => {
            const have = count(s, id);
            return (
              <li key={id} style={{ color: have >= n ? UI.text : UI.red }}>
                {n}× {ITEM_BY_ID.get(id)?.name ?? id}{" "}
                <span className="text-white/40">({have})</span>
              </li>
            );
          })}
        </ul>
        {chances && (
          <>
            <SectionTitle accent={UI.cyan}>{tr("What can dissolve")}</SectionTitle>
            <ul className="space-y-0.5">
              {(Object.keys(chances) as SliceLine[]).map((l) => (
                <li key={l} className={chances[l] > 0 ? "" : "text-white/30"}>
                  {LINE_LABEL[l]}:{" "}
                  {chances[l] > 0 ? `${fmtNum(chances[l] * 100, 1)} %` : tr("out of reach")}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-white/40">
          {tr(
            "Takes 2 to 24 hours of real time — the duration says nothing about the slice. The exact moment cannot be found again: which capture and position dissolves is random.",
          )}
        </p>
        <CrtButton
          tone="cyan"
          disabled={!!block}
          onClick={() => {
            const b = api.act((w) => startExtraction(w, field, day, Date.now()));
            if (b) api.toast(startBlockText(b, field), "warn");
            else api.toast(tr("The chamber hums. Tuned to {day}.", { day }), "info");
          }}
        >
          {tr("Start extraction")}
        </CrtButton>
        {block && <p style={{ color: UI.amber }}>{startBlockText(block, field)}</p>}
      </div>
    </div>
  );
}

// ── Slices ───────────────────────────────────────────────────────

function SliceInfo({ x }: { x: MatrixSlice }) {
  const t = tokenById(x.token);
  if (!t) return null;
  const r = rarityOf(t);
  return (
    <div className="space-y-1 text-xs text-[#d8ffd8]">
      <div className="flex items-start gap-3">
        <SliceThumb token={x.token} pos={x.pos} size={128} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <dt className="text-white/50">{tr("Slice")}</dt>
          <dd>{sliceCode(x.token, x.pos)}</dd>
          <dt className="text-white/50">{tr("Rarity")}</dt>
          <dd style={{ color: RARITY_COLOR[r] }}>{RARITY_LABEL[r]}</dd>
          <dt className="text-white/50">{tr("matrix::Line")}</dt>
          <dd>
            {t.phase} · {captureLabel(t.traits)} · {t.traits.color}
          </dd>
          <dt className="text-white/50">{tr("matrix::Traits")}</dt>
          <dd>
            T{t.traits.tier} · {t.traits.io === "IO" ? "I/O" : t.traits.io} · {t.traits.era} bit ·{" "}
            {t.traits.rotation} · {t.traits.stasis}
          </dd>
          <dt className="text-white/50">{tr("Ledger day")}</dt>
          <dd>
            {x.day} · {tr("field {n}", { n: x.field })}
          </dd>
          <dt className="text-white/50">{tr("Materialised")}</dt>
          <dd>{new Date(x.at).toLocaleString()}</dd>
        </dl>
      </div>
      <p className="break-all text-white/40">{captureName(t.traits)}</p>
    </div>
  );
}

function ArchiveTab({ s }: { s: WorldState }) {
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [pick, setPick] = useState<string | null>(null);
  const list = s.matrix.slices
    .filter((x) => {
      const t = tokenById(x.token);
      return t && (filter === "all" || rarityOf(t) === filter);
    })
    .slice()
    .reverse();
  const sel = pick ? sliceByUid(s, pick) : undefined;
  if (!s.matrix.slices.length)
    return (
      <p className="text-xs text-white/50">
        {tr("No slices yet. Start an extraction and come back when it is done.")}
      </p>
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} accent={UI.cyan}>
          {tr("all")}
        </FilterChip>
        {RARITIES.map((r) => (
          <FilterChip
            key={r}
            active={filter === r}
            onClick={() => setFilter(r)}
            accent={RARITY_COLOR[r]}
          >
            {RARITY_LABEL[r]}
          </FilterChip>
        ))}
      </div>
      {sel && <SliceInfo x={sel} />}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {list.map((x) => {
          const t = tokenById(x.token)!;
          const r = rarityOf(t);
          return (
            <button
              key={x.uid}
              type="button"
              onClick={() => setPick(x.uid)}
              className="flex flex-col items-center gap-0.5 rounded-sm border p-1 text-[9px]"
              style={{ borderColor: pick === x.uid ? UI.cyan : `${RARITY_COLOR[r]}55` }}
              title={sliceCode(x.token, x.pos)}
            >
              <SliceThumb token={x.token} pos={x.pos} />
              <span style={{ color: RARITY_COLOR[r] }}>{sliceCode(x.token, x.pos).slice(4)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────

const emptySlots = (): (string | null)[] => Array.from({ length: SLICE_POSITIONS }, () => null);

function ComposeTab({ api, s }: { api: WorldApi; s: WorldState }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [slots, setSlots] = useState<(string | null)[]>(emptySlots);
  const [name, setName] = useState("");
  const [held, setHeld] = useState<string | null>(null);
  const free = freeSlices(s, editing ?? undefined).filter((x) => !slots.includes(x.uid));
  const frames: FrameRef[] = slots.map((u) => {
    const x = u ? sliceByUid(s, u) : undefined;
    return x ? { token: x.token, pos: x.pos } : null;
  });
  const block = composeBlock(s, slots, editing ?? undefined);
  const motion = crystalMotion(s, slots);

  const load = (id: string | null) => {
    const c = id ? s.matrix.crystals.find((k) => k.id === id) : undefined;
    setEditing(c?.id ?? null);
    setSlots(c ? [...c.slots] : emptySlots());
    setName(c?.name ?? "");
    setHeld(null);
  };
  const place = (i: number) => {
    const next = [...slots];
    next[i] = held;
    setSlots(next);
    setHeld(null);
  };

  return (
    <div className="grid gap-4 text-xs text-[#d8ffd8] lg:grid-cols-[1fr_auto]">
      <div className="space-y-3">
        <SectionTitle
          accent={UI.cyan}
          right={<span className="text-white/40">{MOTION_LABEL[motion]}</span>}
        >
          {editing ? tr("Edit crystal") : tr("New crystal")}
        </SectionTitle>
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-10">
          {slots.map((u, i) => {
            const x = u ? sliceByUid(s, u) : undefined;
            return (
              <button
                key={i}
                type="button"
                onClick={() => place(i)}
                className="flex flex-col items-center rounded-sm border p-0.5 text-[9px]"
                style={{ borderColor: held ? `${UI.cyan}aa` : "#33FF3333" }}
                title={x ? sliceCode(x.token, x.pos) : tr("Position {n}", { n: i + 1 })}
              >
                {x ? (
                  <SliceThumb token={x.token} pos={x.pos} size={44} />
                ) : (
                  <div className="h-[44px] w-[44px] bg-black" />
                )}
                <span className="text-white/40">P{String(i + 1).padStart(2, "0")}</span>
              </button>
            );
          })}
        </div>
        <SectionTitle accent={UI.cyan}>{tr("Free slices ({n})", { n: free.length })}</SectionTitle>
        <p className="text-white/40">
          {tr("Pick a slice, then a position. Click a filled position to take its slice out.")}
        </p>
        <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
          {free.map((x) => (
            <button
              key={x.uid}
              type="button"
              onClick={() => setHeld(held === x.uid ? null : x.uid)}
              className="rounded-sm border p-0.5"
              style={{ borderColor: held === x.uid ? UI.cyan : "#33FF3322" }}
              title={sliceCode(x.token, x.pos)}
            >
              <SliceThumb token={x.token} pos={x.pos} size={40} />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <CrtButton tone="cyan" onClick={() => setSlots(autoArrange(s, editing ?? undefined))}>
            {tr("Auto-arrange")}
          </CrtButton>
          <CrtButton onClick={() => setSlots(emptySlots())}>{tr("matrix::Clear")}</CrtButton>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <CrystalPlayer frames={frames} />
        <input
          className={`${INPUT_CLASS} w-48`}
          value={name}
          maxLength={40}
          placeholder={tr("Crystal name")}
          onChange={(e) => setName(e.target.value)}
          aria-label={tr("Crystal name")}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <CrtButton
            tone="cyan"
            disabled={!!block}
            onClick={() => {
              const c = api.act((w) =>
                saveCrystal(w, name, slots, Date.now(), editing ?? undefined),
              );
              if (c) {
                setEditing(c.id);
                setName(c.name);
                api.toast(tr("Crystal kept in the chamber: {name}", { name: c.name }), "good");
              }
            }}
          >
            {tr("Keep crystal")}
          </CrtButton>
          <CrtButton
            disabled={!frames.some(Boolean)}
            onClick={() =>
              downloadBlob(
                crystalGif(frames, 320),
                `${(name || "crystal").replace(/[^\w-]+/g, "_")}.gif`,
              )
            }
          >
            GIF
          </CrtButton>
        </div>
        <SectionTitle accent={UI.cyan}>{tr("Chamber inventory")}</SectionTitle>
        <ul className="w-56 space-y-1">
          <li>
            <button type="button" className="text-white/60 underline" onClick={() => load(null)}>
              {tr("+ new crystal")}
            </button>
          </li>
          {s.matrix.crystals.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="truncate text-left"
                style={{ color: c.id === editing ? UI.cyan : UI.text }}
                onClick={() => load(c.id)}
              >
                {c.name} <span className="text-white/40">{c.slots.filter(Boolean).length}/30</span>
              </button>
              <button
                type="button"
                className="text-white/40 hover:text-[#FF3333]"
                onClick={() => {
                  if (api.act((w) => dismantleCrystal(w, c.id))) {
                    if (editing === c.id) load(null);
                    api.toast(tr("Crystal taken apart. Its slices are free again."), "info");
                  }
                }}
                title={tr("Take apart")}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Mint ─────────────────────────────────────────────────────────

const CHECK_LABEL: Readonly<Record<string, string>> = {
  chamber: tr("Matrix Chamber awake"),
};

function MintTab({ s }: { s: WorldState }) {
  const checks = mintReadiness(s);
  const sample = s.matrix.crystals[0];
  const deviceName = (id: string) => DEVICES.find((d) => d.id === id)?.name ?? id;
  return (
    <div className="space-y-3 text-xs text-[#d8ffd8]">
      <p>
        {tr(
          "Slices and crystals are made in the lab first. Later they can be minted as NFTs on the Solana devnet through the lab's uplink — with the right devices running and the chamber set to devnet. Mainnet opens only after the legal review.",
        )}
      </p>
      <SectionTitle accent={UI.cyan}>{tr("Uplink")}</SectionTitle>
      <ul className="space-y-0.5">
        {checks.map((c) => (
          <li key={c.id} style={{ color: c.ok ? UI.green : UI.amber }}>
            {c.ok ? "✓" : "·"}{" "}
            {CHECK_LABEL[c.id] ?? tr("{device} built and on", { device: deviceName(c.id) })}
          </li>
        ))}
        <li style={{ color: MINT_NETWORKS.devnet ? UI.green : UI.amber }}>
          ✓ {tr("Network: Solana devnet")}
        </li>
        <li className="text-white/40">· {tr("Mainnet: closed until the legal review")}</li>
      </ul>
      <p style={{ color: UI.amber }}>
        {tr(
          "Minting is being prepared: the server must verify every slice before it signs. The button opens once the server side and the marketplace are ready.",
        )}
      </p>
      <CrtButton tone="cyan" disabled>
        {tr("Mint on devnet")}
      </CrtButton>
      {sample && (
        <details className="text-white/50">
          <summary className="cursor-pointer">
            {tr("Metadata preview: {name}", { name: sample.name })}
          </summary>
          <pre className="mt-1 max-h-60 overflow-auto text-[10px] whitespace-pre-wrap">
            {JSON.stringify(
              crystalMetadata(sample, (u) => sliceByUid(s, u)),
              null,
              2,
            )}
          </pre>
        </details>
      )}
    </div>
  );
}

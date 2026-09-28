"use client";

/**
 * Biorhythm UI — HUD meters, the Bio panel, the station panels (Food
 * Replicator, Neutro-Fridge, bed, ergometer) and the provisions strip of
 * the inventory. Rules live in `lib/world/biorhythm.ts`; everything here
 * only reads the state and calls those rules inside `api.act`.
 */
import { tr } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { ItemIcon } from "@/components/world/ItemIcon";
import { CrtButton, Meter, Panel, SectionTitle, UI } from "@/components/world/ui";
import { memoPanel, type WorldApi } from "@/components/world/panels/shared";
import {
  BIO_BALANCED_WALK,
  BIO_LOW,
  BIO_LOW_WALK,
  BIO_MAX,
  BIO_NEEDS,
  CARRY_LIMIT,
  COFFEE_ITEM,
  COFFEE_RESTORE,
  FRESH_BONUS,
  FRIDGE_CAPACITY,
  PROTEIN_BONUS,
  PROVISIONS,
  SLEEP_SECONDS,
  TRAIN_COST,
  TRAIN_GAIN,
  bagCount,
  bioActive,
  bioEffects,
  bioEnabled,
  bioNum,
  bioRate,
  bioTips,
  bioValue,
  consume,
  fridgeCount,
  fridgeStore,
  fridgeTake,
  fridgeTotal,
  minutesUntilLow,
  replicate,
  replicatorCooldown,
  sleepBlocked,
  train,
  trainCooldown,
  type BioNeed,
  type BioReport,
  type BioStation,
  type ConsumeFrom,
  type ProvisionDef,
} from "@/lib/world/biorhythm";
import { count, itemDef } from "@/lib/world/game";
import type { BiorhythmMode, HudMode } from "@/lib/world/settings";
import type { WorldState } from "@/lib/world/types";

export const NEED_LABEL: Record<BioNeed, string> = {
  food: tr("bio::Satiation"),
  drink: tr("bio::Hydration"),
  rest: tr("bio::Rest"),
  fit: tr("bio::Fitness"),
};

export const NEED_ICON: Record<BioNeed, string> = {
  food: "♨",
  drink: "≈",
  rest: "☾",
  fit: "♥",
};

export const NEED_COLOR: Record<BioNeed, string> = {
  food: UI.amber,
  drink: UI.cyan,
  rest: "#B7A6FF",
  fit: UI.green,
};

const STATUS_LABEL = {
  low: tr("bio::Worn out"),
  balanced: tr("bio::Balanced"),
  ok: tr("bio::Fine"),
  hidden: "",
} as const;

/** "+35 Satiation, −5 Hydration" for a report's gains. */
export function gainText(gains: BioReport["gains"]): string {
  return BIO_NEEDS.filter((n) => gains[n])
    .map((n) => {
      const g = gains[n]!;
      return `${g > 0 ? "+" : "−"}${bioNum(Math.abs(g), 1)} ${NEED_LABEL[n]}`;
    })
    .join(", ");
}

/** "+35 Satiation" etc. for a restore table (optionally scaled). */
function restoreText(restore: Partial<Record<BioNeed, number>>, factor = 1): string {
  return gainText(
    Object.fromEntries(
      Object.entries(restore).map(([k, v]) => [k, Math.round(v * factor * 10) / 10]),
    ) as Partial<Record<BioNeed, number>>,
  );
}

/** Re-render once a second (play-clock countdowns, decay). */
function useSecondTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
}

/** Toast + sound for a rules report. */
export function announceBio(api: WorldApi, r: BioReport, drink = false): void {
  if (!r.ok) {
    api.sound?.("fail_buzz");
    api.toast(r.text, "warn");
    return;
  }
  api.sound?.(drink ? "coffee_brew" : "ui_click");
  const g = gainText(r.gains);
  api.toast(g ? tr("{text} ({gains})", { text: r.text, gains: g }) : r.text, "good", r.item);
}

// ── HUD widget ───────────────────────────────────────────────────

/**
 * Four tiny meters in the status panel (only while the rhythm runs).
 * full: icon + bar + value · compact: bars only · minimal: a chip only
 * when a need is low. Click opens the Bio panel.
 */
export function BioHud({
  getState,
  mode,
  hud,
  onOpen,
}: {
  getState: () => WorldState;
  mode: BiorhythmMode;
  hud: HudMode;
  onOpen: () => void;
}) {
  useSecondTick();
  const s = getState();
  if (!bioEnabled(s, mode)) return null;
  const fx = bioEffects(s, mode);
  if (hud === "minimal" && fx.status !== "low") return null;
  const title = tr("Biorhythm — {status} (click for details)", {
    status: STATUS_LABEL[fx.status],
  });
  if (hud === "minimal")
    return (
      <button
        type="button"
        onClick={onOpen}
        title={title}
        data-bio-hud="minimal"
        className="mt-2 rounded-sm border border-red-500/50 px-1.5 py-0.5 text-[10px] text-red-300"
      >
        {fx.low.map((n) => NEED_ICON[n]).join(" ")} {STATUS_LABEL.low}
      </button>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      aria-label={title}
      data-bio-hud={hud}
      className="mt-2 block w-full rounded-sm border border-white/10 px-1.5 py-1 text-left hover:border-[#00FFFF]/40"
    >
      <div className={hud === "full" ? "grid grid-cols-2 gap-x-3 gap-y-0.5" : "flex gap-1.5"}>
        {BIO_NEEDS.map((n) => {
          const v = bioValue(s, n);
          const low = v < BIO_LOW;
          const color = low ? UI.red : NEED_COLOR[n];
          return (
            <div
              key={n}
              className="flex min-w-0 flex-1 items-center gap-1"
              title={`${NEED_LABEL[n]} ${Math.round(v)}`}
            >
              <span aria-hidden className="w-3 text-center text-[10px]" style={{ color }}>
                {NEED_ICON[n]}
              </span>
              <Meter value={Math.round(v)} max={BIO_MAX} color={color} label={NEED_LABEL[n]} />
              {hud === "full" && (
                <span
                  className="w-6 text-right text-[10px] tabular-nums"
                  style={{ color: low ? UI.red : "#ffffff99" }}
                >
                  {Math.round(v)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {fx.status !== "ok" && (
        <p
          className="mt-0.5 text-[10px]"
          style={{ color: fx.status === "low" ? UI.red : UI.green }}
        >
          {fx.status === "low"
            ? tr("Worn out · walking ×{f}", { f: bioNum(BIO_LOW_WALK) })
            : tr("Balanced · walking ×{f}", { f: bioNum(BIO_BALANCED_WALK) })}
        </p>
      )}
    </button>
  );
}

// ── Provisions (bag + coffee) ────────────────────────────────────

function ProvisionRow({
  api,
  def,
  n,
  from,
  restore,
  factor = 1,
  extra,
}: {
  api: WorldApi;
  def: ProvisionDef["item"];
  n: number;
  from: ConsumeFrom;
  restore: Partial<Record<BioNeed, number>>;
  factor?: number;
  extra?: ReactNode;
}) {
  const s = api.get();
  const drink = def.id === COFFEE_ITEM || PROVISIONS.find((p) => p.id === def.id)?.verb === "drink";
  return (
    <li className="flex items-center gap-2 rounded-sm border border-white/10 bg-black/30 px-2 py-1">
      <ItemIcon item={def} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-[#d8ffd8]">
          {def.name} <span className="text-white/45">×{n}</span>
        </p>
        <p className="truncate text-[10px] text-white/50">{restoreText(restore, factor)}</p>
      </div>
      {extra}
      <CrtButton
        tone="green"
        disabled={n < 1 || !bioActive(s)}
        onClick={() =>
          announceBio(
            api,
            api.act((st) => consume(st, def.id, from)),
            drink,
          )
        }
      >
        {drink ? tr("bio::Drink") : tr("bio::Eat")}
      </CrtButton>
    </li>
  );
}

/**
 * Carried provisions with a "Consume" button each (inventory panel, Bio
 * panel). Coffee from the inventory is listed too. Renders nothing when
 * there is nothing to eat or drink.
 */
export function ProvisionList({ api, title = true }: { api: WorldApi; title?: boolean }) {
  const s = api.get();
  const rows = PROVISIONS.filter((p) => bagCount(s, p.id) > 0);
  const coffee = count(s, COFFEE_ITEM);
  const coffeeDef = itemDef(s, COFFEE_ITEM);
  if (!rows.length && !(coffee > 0 && bioActive(s))) return null;
  return (
    <div className="mb-3" data-provisions>
      {title && <SectionTitle accent={UI.cyan}>{tr("Provisions (biorhythm)")}</SectionTitle>}
      <ul className="grid gap-1 sm:grid-cols-2">
        {rows.map((p) => (
          <ProvisionRow
            key={p.id}
            api={api}
            def={p.item}
            n={bagCount(s, p.id)}
            from="bag"
            restore={p.restore}
          />
        ))}
        {coffee > 0 && coffeeDef && bioActive(s) && (
          <ProvisionRow api={api} def={coffeeDef} n={coffee} from="bag" restore={COFFEE_RESTORE} />
        )}
      </ul>
    </div>
  );
}

// ── Bio panel ────────────────────────────────────────────────────

function BioPanelImpl({
  api,
  mode,
  onClose,
}: {
  api: WorldApi;
  mode: BiorhythmMode;
  onClose: () => void;
}) {
  useSecondTick();
  const s = api.get();
  const fx = bioEffects(s, mode);
  const tips = bioTips(s, mode);
  return (
    <Panel
      title={tr("Biorhythm")}
      subtitle={
        mode === "off"
          ? tr("Switched off in the settings — no decay, no effects.")
          : mode === "relaxed"
            ? tr("Relaxed: everything drops at half speed.")
            : tr("Jade's needs drop slowly with play time. Nothing is ever lost.")
      }
      onClose={onClose}
      accent={UI.cyan}
    >
      <div data-bio-panel className="space-y-2">
        {BIO_NEEDS.map((n) => {
          const v = bioValue(s, n);
          const until = minutesUntilLow(s, n, mode);
          const rate = bioRate(n, mode);
          return (
            <div key={n}>
              <div className="flex items-baseline justify-between text-xs">
                <span style={{ color: NEED_COLOR[n] }}>
                  <span aria-hidden>{NEED_ICON[n]}</span> {NEED_LABEL[n]}
                </span>
                <span className="text-white/60 tabular-nums">
                  {Math.round(v)} / {BIO_MAX}
                </span>
              </div>
              <Meter
                value={Math.round(v)}
                max={BIO_MAX}
                color={v < BIO_LOW ? UI.red : NEED_COLOR[n]}
                label={NEED_LABEL[n]}
                height={6}
              />
              <p className="mt-0.5 text-[10px] text-white/45">
                {rate > 0 ? tr("−{rate} per minute", { rate: bioNum(rate) }) : tr("bio::steady")}
                {until !== null && until > 0 && fx.status !== "hidden"
                  ? ` · ${tr("low in about {min} min", { min: Math.max(1, Math.round(until)) })}`
                  : ""}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-sm border border-white/10 px-3 py-2 text-xs">
        <SectionTitle accent={fx.status === "low" ? UI.red : UI.green}>{tr("Effect")}</SectionTitle>
        <p className="text-[#d8ffd8]/80">
          {fx.status === "low"
            ? tr("Worn out: walking ×{f}. Eat, drink or sleep and it passes.", {
                f: bioNum(BIO_LOW_WALK),
              })
            : fx.status === "balanced"
              ? tr("Balanced: walking ×{f}.", { f: bioNum(BIO_BALANCED_WALK) })
              : fx.status === "hidden"
                ? tr("No effects.")
                : tr(
                    "All fine — no effect. Balanced (every need 60+, fitness 70+) gives a small speed bonus.",
                  )}
        </p>
      </div>
      {tips.length > 0 && (
        <div className="mt-3">
          <SectionTitle>{tr("Tips")}</SectionTitle>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-white/65">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3">
        <ProvisionList api={api} />
      </div>
    </Panel>
  );
}

export const BioPanel = memoPanel(BioPanelImpl);

// ── Stations ─────────────────────────────────────────────────────

const STATION_TITLE: Record<BioStation, string> = {
  replicator: tr("Food Replicator"),
  fridge: tr("Neutro-Fridge"),
  bed: tr("Jade's Bed"),
  trainer: tr("Ergometer"),
};

function Countdown({ seconds }: { seconds: number }) {
  if (seconds <= 0) return null;
  return (
    <span className="text-[10px] text-white/45 tabular-nums">
      {tr("ready in {n} s", { n: Math.ceil(seconds) })}
    </span>
  );
}

function ReplicatorView({ api }: { api: WorldApi }) {
  const s = api.get();
  const cd = replicatorCooldown(s);
  return (
    <>
      <p className="mb-2 text-xs text-[#d8ffd8]/80">
        {tr(
          "A kitchen fabricator on the lab grid. It prints one portion at a time into your bag (up to {n} of each).",
          { n: CARRY_LIMIT },
        )}
      </p>
      <ul className="space-y-1">
        {PROVISIONS.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-sm border border-white/10 bg-black/30 px-2 py-1.5"
          >
            <ItemIcon item={p.item} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#00FFFF]">{p.item.name}</p>
              <p className="text-[10px] text-white/55">
                {restoreText(p.restore)}
                {p.protein ? ` · ${tr("next workout ×{f}", { f: bioNum(PROTEIN_BONUS) })}` : ""}
              </p>
              <p className="text-[10px] text-white/40">
                {tr("In your bag: {n}/{max}", { n: bagCount(s, p.id), max: CARRY_LIMIT })}
              </p>
            </div>
            <CrtButton
              tone="cyan"
              disabled={cd > 0 || bagCount(s, p.id) >= CARRY_LIMIT}
              onClick={() =>
                announceBio(
                  api,
                  api.act((st) => replicate(st, p.id)),
                )
              }
            >
              {tr("Print")}
            </CrtButton>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex justify-end">
        <Countdown seconds={cd} />
      </div>
      <div className="mt-3">
        <ProvisionList api={api} />
      </div>
    </>
  );
}

function FridgeView({ api, first }: { api: WorldApi; first: boolean }) {
  const s = api.get();
  const stored = fridgeTotal(s);
  const inBag = PROVISIONS.filter((p) => bagCount(s, p.id) > 0);
  return (
    <>
      {first && (
        <p className="mb-2 rounded-sm border border-[#FFB800]/30 px-2 py-1 text-[11px] text-[#FFB800]/90">
          {tr(
            "Behind the new neutrino cooling, on the bottom shelf: a plate under cling film, labelled “D.F. — DO NOT TOUCH. That means you too, Jade.” The lasagne stays. Everything else is yours.",
          )}
        </p>
      )}
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-white/70">{tr("Stored")}</span>
        <span className="text-white/60 tabular-nums">
          {stored} / {FRIDGE_CAPACITY}
        </span>
      </div>
      <Meter value={stored} max={FRIDGE_CAPACITY} color={UI.cyan} label={tr("Fridge capacity")} />
      <p className="mt-1 mb-2 text-[10px] text-white/45">
        {tr("Fresh from the fridge: +{p} % more. Nothing spoils — not here, not in your bag.", {
          p: Math.round((FRESH_BONUS - 1) * 100),
        })}
      </p>
      <SectionTitle accent={UI.cyan}>{tr("In the fridge")}</SectionTitle>
      {stored === 0 && (
        <p className="text-[11px] text-white/40">{tr("Empty, apart from the lasagne.")}</p>
      )}
      <ul className="space-y-1">
        {PROVISIONS.filter((p) => fridgeCount(s, p.id) > 0).map((p) => (
          <ProvisionRow
            key={p.id}
            api={api}
            def={p.item}
            n={fridgeCount(s, p.id)}
            from="fridge"
            restore={p.restore}
            factor={FRESH_BONUS}
            extra={
              <CrtButton
                tone="amber"
                disabled={bagCount(s, p.id) >= CARRY_LIMIT}
                onClick={() =>
                  announceBio(
                    api,
                    api.act((st) => fridgeTake(st, p.id)),
                  )
                }
              >
                {tr("Take")}
              </CrtButton>
            }
          />
        ))}
      </ul>
      <div className="mt-3">
        <SectionTitle>{tr("In your bag")}</SectionTitle>
        {inBag.length === 0 && (
          <p className="text-[11px] text-white/40">
            {tr("Nothing to store. The Food Replicator is right next door.")}
          </p>
        )}
        <ul className="space-y-1">
          {inBag.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-sm border border-white/10 bg-black/30 px-2 py-1"
            >
              <ItemIcon item={p.item} size={30} />
              <p className="min-w-0 flex-1 truncate text-xs text-[#d8ffd8]">
                {p.item.name} <span className="text-white/45">×{bagCount(s, p.id)}</span>
              </p>
              <CrtButton
                tone="cyan"
                disabled={stored >= FRIDGE_CAPACITY}
                onClick={() =>
                  announceBio(
                    api,
                    api.act((st) => fridgeStore(st, p.id)),
                  )
                }
              >
                {tr("Store")}
              </CrtButton>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function BedView({ api, onSleep }: { api: WorldApi; onSleep: () => void }) {
  const s = api.get();
  const why = sleepBlocked(s);
  const rest = bioValue(s, "rest");
  return (
    <>
      <p className="mb-2 text-xs text-[#d8ffd8]/80">
        {tr(
          "Made, and hardly ever slept in. A few minutes of real sleep bring rest back to 100 — {min} minutes of play time pass meanwhile.",
          { min: SLEEP_SECONDS / 60 },
        )}
      </p>
      <div className="mb-1 flex justify-between text-xs">
        <span style={{ color: NEED_COLOR.rest }}>{NEED_LABEL.rest}</span>
        <span className="text-white/60 tabular-nums">{Math.round(rest)}</span>
      </div>
      <Meter
        value={Math.round(rest)}
        max={BIO_MAX}
        color={NEED_COLOR.rest}
        label={NEED_LABEL.rest}
        height={6}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CrtButton tone="cyan" disabled={!!why} onClick={onSleep}>
          {tr("Sleep")}
        </CrtButton>
        {why && <span className="text-[10px] text-white/50">{why}</span>}
      </div>
    </>
  );
}

function TrainerView({ api }: { api: WorldApi }) {
  const s = api.get();
  const cd = trainCooldown(s);
  const fit = bioValue(s, "fit");
  const protein = (s.counters.bio_protein ?? 0) > 0;
  return (
    <>
      <p className="mb-2 text-xs text-[#d8ffd8]/80">
        {tr(
          "Damien called it “the hamster wheel”. Ten minutes: +{gain} fitness, costs {drink} hydration and {rest} rest.",
          { gain: TRAIN_GAIN, drink: TRAIN_COST.drink ?? 0, rest: TRAIN_COST.rest ?? 0 },
        )}
      </p>
      <div className="mb-1 flex justify-between text-xs">
        <span style={{ color: NEED_COLOR.fit }}>{NEED_LABEL.fit}</span>
        <span className="text-white/60 tabular-nums">{Math.round(fit)}</span>
      </div>
      <Meter
        value={Math.round(fit)}
        max={BIO_MAX}
        color={NEED_COLOR.fit}
        label={NEED_LABEL.fit}
        height={6}
      />
      {protein && (
        <p className="mt-1 text-[10px] text-[#FFB800]">
          {tr("Protein shake: this workout counts ×{f}.", { f: bioNum(PROTEIN_BONUS) })}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CrtButton
          tone="green"
          disabled={cd > 0 || !bioActive(s)}
          onClick={() => {
            const r = api.act((st) => train(st));
            if (r.ok) api.sound?.("buff_on");
            announceBio(api, r);
          }}
        >
          {tr("Train")}
        </CrtButton>
        <Countdown seconds={cd} />
      </div>
    </>
  );
}

function BioStationPanelImpl({
  api,
  station,
  mode,
  first = false,
  onClose,
  onSleep,
}: {
  api: WorldApi;
  station: BioStation;
  mode: BiorhythmMode;
  /** First time at this station (fridge: the lasagne line). */
  first?: boolean;
  onClose: () => void;
  onSleep: () => void;
}) {
  useSecondTick();
  const s = api.get();
  return (
    <Panel
      title={STATION_TITLE[station]}
      subtitle={
        !bioEnabled(s, mode)
          ? mode === "off"
            ? tr("The biorhythm is switched off in the settings.")
            : tr("Jade is not hungry, thirsty or tired yet.")
          : undefined
      }
      onClose={onClose}
      accent={UI.cyan}
    >
      <div data-bio-station={station}>
        {station === "replicator" && <ReplicatorView api={api} />}
        {station === "fridge" && <FridgeView api={api} first={first} />}
        {station === "bed" && <BedView api={api} onSleep={onSleep} />}
        {station === "trainer" && <TrainerView api={api} />}
      </div>
    </Panel>
  );
}

export const BioStationPanel = memoPanel(BioStationPanelImpl);

/** Focus-label verb for a station prop. */
export const STATION_VERB: Record<BioStation, string> = {
  replicator: tr("bio::print"),
  fridge: tr("bio::open"),
  bed: tr("bio::sleep"),
  trainer: tr("bio::train"),
};

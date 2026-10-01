/**
 * The ETH ledger — the real daily history of the Ethereum chain (pure).
 * =====================================================================
 *
 * `content/eth-history.json` holds one record per day from the genesis
 * (2015-07-30) to the last complete day it was fetched (Blockchair daily
 * aggregates, `scripts/eth-history/fetch.mjs`). Nothing is invented: the
 * Matrix Chamber can only tune to days that happened.
 *
 * Every day gets indicators ranked against the month before it (only the
 * past), and from them the "state of the chain" the chamber resonates with:
 * trend → rotation, volatility → tier and I/O state, activity → era. A
 * "monochrome day" is a day on which every indicator stood at an extreme at
 * once — only on such days can the chamber reach the mono line (P01).
 */
import data from "@/lib/world/content/eth-history.json";

export interface EthDay {
  /** Index in the history (0 = 2015-07-30). */
  index: number;
  /** ISO date (UTC). */
  date: string;
  blocks: number;
  height: number;
  txs: number;
  gasMega: number;
  valueEth: number;
  /** Implied USD price (0 = no market yet, before 2015-08-07). */
  priceUsd: number;
  feesEth: number;
  burnedEth: number;
  baseFeeGwei: number;
}

/**
 * A day's indicators, each ranked (0..1) against the 30 days before it —
 * only the past, as the chamber would have seen it on that day.
 */
export interface DayIndicators {
  /** Price change vs the day before (log return; 0 without a market). */
  change: number;
  /** |change| rank — the day's volatility. */
  volatility: number;
  /** Transactions rank. */
  activity: number;
  /** Fee per transaction rank — gas pressure. */
  pressure: number;
  /** Gas used rank — load on the chain. */
  load: number;
}

/** The chain state a day resonates with (archive trait space). */
export interface ChainState {
  rotation: "CW" | "CCW";
  tier: 1 | 2 | 3 | 4 | 5;
  io: "O" | "I" | "IO";
  era: 16 | 32 | 64;
  stasis: "S" | "NOS";
  /** Every indicator at an extreme at once: the mono line is reachable. */
  mono: boolean;
}

const COLS = data.columns;
const col = (name: string): number => {
  const i = COLS.indexOf(name);
  if (i < 0) throw new Error(`eth-history: column ${name} missing`);
  return i;
};
const C_BLOCKS = col("blocks");
const C_HEIGHT = col("height");
const C_TXS = col("txs");
const C_GAS = col("gasMega");
const C_VALUE = col("valueEth");
const C_PRICE = col("priceUsd");
const C_FEES = col("feesEth");
const C_BURNED = col("burnedEth");
const C_BASEFEE = col("baseFeeGwei");

const ROWS = data.rows as number[][];
const START = Date.UTC(
  Number(data.start.slice(0, 4)),
  Number(data.start.slice(5, 7)) - 1,
  Number(data.start.slice(8, 10)),
);
const DAY_MS = 86_400_000;

/** Number of recorded days. */
export const HISTORY_DAYS = ROWS.length;
/** First and last recorded day. */
export const HISTORY_START: string = data.start;
export const HISTORY_END: string = data.end;
/** Where the data comes from. */
export const HISTORY_SOURCE: string = data.source;

export function dateOf(index: number): string {
  return new Date(START + index * DAY_MS).toISOString().slice(0, 10);
}

/** Index of an ISO date, or -1 outside the recorded history. */
export function indexOf(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return -1;
  const i = Math.round((t - START) / DAY_MS);
  return i >= 0 && i < HISTORY_DAYS ? i : -1;
}

export function dayAt(index: number): EthDay {
  const r = ROWS[index];
  if (!r) throw new Error(`eth-history: no day ${index}`);
  return {
    index,
    date: dateOf(index),
    blocks: r[C_BLOCKS]!,
    height: r[C_HEIGHT]!,
    txs: r[C_TXS]!,
    gasMega: r[C_GAS]!,
    valueEth: r[C_VALUE]!,
    priceUsd: r[C_PRICE]!,
    feesEth: r[C_FEES]!,
    burnedEth: r[C_BURNED]!,
    baseFeeGwei: r[C_BASEFEE]!,
  };
}

// ── Indicators (ranked once, lazily) ─────────────────────────────

/** Days before a day its indicators are ranked against. */
export const RANK_WINDOW = 30;
/** Extreme band of the monochrome condition (top or bottom share of the window). */
export const MONO_BAND = 0.1;

let ranked: {
  change: Float64Array;
  volatility: Float32Array;
  activity: Float32Array;
  pressure: Float32Array;
  load: Float32Array;
} | null = null;

/** Share of the previous `RANK_WINDOW` days below each value (0.5 without a past). */
function pastRanks(values: Float64Array): Float32Array {
  const n = values.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let below = 0;
    let count = 0;
    for (let k = Math.max(0, i - RANK_WINDOW); k < i; k++) {
      count++;
      if (values[k]! < values[i]!) below++;
    }
    out[i] = count ? below / count : 0.5;
  }
  return out;
}

function rank() {
  if (ranked) return ranked;
  const n = HISTORY_DAYS;
  const change = new Float64Array(n);
  const absChange = new Float64Array(n);
  const txs = new Float64Array(n);
  const feePerTx = new Float64Array(n);
  const gas = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = ROWS[i]!;
    const p = r[C_PRICE]!;
    const q = i > 0 ? ROWS[i - 1]![C_PRICE]! : 0;
    change[i] = p > 0 && q > 0 ? Math.log(p / q) : 0;
    absChange[i] = Math.abs(change[i]!);
    txs[i] = r[C_TXS]!;
    feePerTx[i] = r[C_TXS]! > 0 ? r[C_FEES]! / r[C_TXS]! : 0;
    gas[i] = r[C_GAS]!;
  }
  ranked = {
    change,
    volatility: pastRanks(absChange),
    activity: pastRanks(txs),
    pressure: pastRanks(feePerTx),
    load: pastRanks(gas),
  };
  return ranked;
}

export function indicatorsAt(index: number): DayIndicators {
  const r = rank();
  return {
    change: r.change[index]!,
    volatility: r.volatility[index]!,
    activity: r.activity[index]!,
    pressure: r.pressure[index]!,
    load: r.load[index]!,
  };
}

/**
 * Every indicator of a traded day at the same extreme of its month (all in
 * the top or all in the bottom tenth) — about one day in a hundred, e.g.
 * the DAO hack (2016-06-17) or the March 2020 crash.
 */
export function isMonochromeDay(index: number): boolean {
  // A full month of trading behind it, so the ranks mean something.
  const p = index - RANK_WINDOW;
  if (p < 1 || ROWS[p]![C_PRICE]! <= 0) return false;
  const ind = indicatorsAt(index);
  const xs = [ind.volatility, ind.activity, ind.pressure, ind.load];
  return xs.every((x) => x >= 1 - MONO_BAND) || xs.every((x) => x <= MONO_BAND);
}

/** The chain state of a day (see module doc). */
export function chainStateAt(index: number): ChainState {
  const ind = indicatorsAt(index);
  const tier = (1 + Math.min(4, Math.floor(ind.volatility * 5))) as ChainState["tier"];
  return {
    rotation: ind.change >= 0 ? "CW" : "CCW",
    tier,
    io: tier >= 4 ? "IO" : tier >= 2 ? "I" : "O",
    era: ind.load < 1 / 3 ? 16 : ind.load < 2 / 3 ? 32 : 64,
    stasis: Math.abs(ind.change) < 0.005 ? "S" : "NOS",
    mono: isMonochromeDay(index),
  };
}

/** Indices of every monochrome day in the history. */
export function monochromeDays(): number[] {
  const out: number[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) if (isMonochromeDay(i)) out.push(i);
  return out;
}

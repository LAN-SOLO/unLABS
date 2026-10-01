/**
 * Fetch the real daily history of the Ethereum chain (Blockchair, free API)
 * and write lib/world/content/eth-history.json — the "blockchain records"
 * the Matrix Chamber reads. Only the past: every day from the genesis
 * (2015-07-30) up to yesterday (UTC). Nothing is invented or extrapolated.
 *
 *   node scripts/eth-history/fetch.mjs
 *
 * Re-run to extend the history to the current date.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = "https://api.blockchair.com/ethereum/blocks";
// Blockchair allows a handful of aggregates per query.
const QUERIES = [
  ["count()", "max(id)", "sum(transaction_count)", "sum(gas_used)"],
  ["sum(value_total)", "sum(value_total_usd)", "sum(fee_total)", "sum(burned_total)"],
  ["avg(base_fee_per_gas)"],
];

async function query(fields) {
  const url = `${API}?a=date,${fields.join(",")}&limit=10000`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    const body = await res.json();
    if (body.data) return body.data;
    console.warn("retry", body.context?.error);
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
  throw new Error(`blockchair query failed: ${fields.join(",")}`);
}

const byDate = new Map();
for (const fields of QUERIES) {
  for (const row of await query(fields)) {
    const d = byDate.get(row.date) ?? { date: row.date };
    Object.assign(d, row);
    byDate.set(row.date, d);
  }
}
const today = new Date().toISOString().slice(0, 10);
const days = [...byDate.values()]
  .filter((d) => d.date < today) // complete days only
  .sort((a, b) => (a.date < b.date ? -1 : 1));

const WEI = 1e18;
const FIRST_TRADE = "2015-08-07";
const num = (v) => (v == null ? 0 : Number(v));
const round = (v, k) => Math.round(v * 10 ** k) / 10 ** k;
// Columns (one array per day, same order):
const columns = [
  "blocks", // blocks mined that day
  "height", // last block height of the day
  "txs", // transactions
  "gasMega", // gas used (millions)
  "valueEth", // ETH transferred
  "priceUsd", // implied price: USD value / ETH value transferred (0 = no market yet)
  "feesEth", // fees paid
  "burnedEth", // ETH burned (EIP-1559, from 2021-08-05)
  "baseFeeGwei", // average base fee (0 before London)
];
const rows = days.map((d) => {
  const value = num(d["sum(value_total)"]) / WEI;
  const usd = num(d["sum(value_total_usd)"]);
  return [
    num(d["count()"]),
    num(d["max(id)"]),
    num(d["sum(transaction_count)"]),
    round(num(d["sum(gas_used)"]) / 1e6, 1),
    round(value, 1),
    // No market before the first exchange listing (2015-08-07): price unknown = 0.
    value > 0 && d.date >= FIRST_TRADE ? round(usd / value, 4) : 0,
    round(num(d["sum(fee_total)"]) / WEI, 3),
    round(num(d["sum(burned_total)"]) / WEI, 3),
    round(num(d["avg(base_fee_per_gas)"]) / 1e9, 3),
  ];
});
// Days are consecutive; check, so the index → date mapping holds.
for (let i = 1; i < days.length; i++) {
  const prev = new Date(days[i - 1].date + "T00:00:00Z").getTime();
  const cur = new Date(days[i].date + "T00:00:00Z").getTime();
  if (cur - prev !== 86400000)
    throw new Error(`gap between ${days[i - 1].date} and ${days[i].date}`);
}
const out = {
  source: "Blockchair API (api.blockchair.com/ethereum/blocks, daily aggregates)",
  fetched: new Date().toISOString(),
  start: days[0].date,
  end: days[days.length - 1].date,
  columns,
  rows,
};
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "../../lib/world/content/eth-history.json");
writeFileSync(file, JSON.stringify(out));
console.log(`${rows.length} days ${out.start} … ${out.end} → ${file}`);

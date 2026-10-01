/**
 * Export the released unETH captures (P01 mono, P02 pure, P03 RGB — the
 * 880 IDs of the 2018-03-07 release lists) from the undevbook's archive
 * (../unlabsundevbook/src/data/uneth-archive.json, built from the research
 * sheets) into lib/world/content/uneth-release.json for the Matrix Chamber.
 * Only what the archive records: no IDs or traits are invented.
 *
 *   node scripts/uneth/export-release.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "../../../unlabsundevbook/src/data/uneth-archive.json");
const out = path.join(here, "../../lib/world/content/uneth-release.json");
const archive = JSON.parse(readFileSync(src, "utf8"));

const rowById = new Map(archive.rows.map((r) => [r[0], r]));
const COLORS = ["white", "green", "yellow", "blue", "purple", "red", "orange", "rgb"];
const io = (v) => {
  const s = String(v ?? "0");
  return s === "I" ? "I" : s === "I0" || s === "IO" ? "IO" : "O";
};

// [id, phase, style, color, tier, rotation, stasis, io, era]
const tokens = [];
for (const [key, rel] of Object.entries(archive.release)) {
  const id = Number(key);
  const row = rowById.get(id);
  if (!row) throw new Error(`release ID ${id} missing in the archive sheet`);
  const [phase, , style, color, state, tier, bit] = rel;
  if (!COLORS.includes(color)) throw new Error(`ID ${id}: unknown colour ${color}`);
  tokens.push([
    id,
    phase,
    style === "mono" ? "mono" : "px",
    color,
    Math.min(5, Math.max(1, Number(tier))),
    row[2] === "CCW" ? "CCW" : "CW",
    row[3] === "S" ? "S" : "NOS",
    io(state),
    Number(bit),
  ]);
}
tokens.sort((a, b) => a[0] - b[0]);
writeFileSync(
  out,
  JSON.stringify({
    source: "unETH archive (research sheets + release lists), via unlabsundevbook",
    collection: archive.collection,
    releaseDate: archive.releaseDate,
    columns: ["id", "phase", "style", "color", "tier", "rotation", "stasis", "io", "era"],
    tokens,
  }),
);
const by = (k) => tokens.reduce((m, t) => ((m[t[k]] = (m[t[k]] ?? 0) + 1), m), {});
console.log(tokens.length, "tokens", by(1), by(3), by(8));

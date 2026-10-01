/**
 * Dump Jade's groom (guide strands + clump data, character space) to JSON
 * for the Blender hair build (scripts/hero/blender/hair.py).
 *
 *   pnpm exec vite-node --config scripts/audio/vite.config.mjs scripts/hero/export-groom.ts [density] [out]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { JADE_EYES } from "@/lib/world/hero/jade-sculpt";
import { GUIDE_POINTS, jadeGroom } from "@/lib/world/hero/jade-groom";

const density = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? ".crystal/jade/groom.json";
const g = jadeGroom(density);
const round = (a: ArrayLike<number>): number[] => Array.from(a, (v) => Math.round(v * 1e4) / 1e4);
const data = {
  points: GUIDE_POINTS,
  eyes: JADE_EYES,
  guides: g.guides.map((q) => ({
    kind: q.kind,
    rest: round(q.rest),
    normals: round(q.normals),
    children: q.children,
    spreadRoot: q.spreadRoot,
    spreadTip: q.spreadTip,
    depth: q.depth,
    curl: q.curl,
    curlTurns: q.curlTurns,
    width: q.width,
  })),
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data));
console.log(
  `groom: ${data.guides.length} guides, ${data.guides.reduce((s, q) => s + q.children, 0)} strands → ${out}`,
);

// .voxel/index.html — every model: the undevbook's picture, Blender's iso
// clone (pixel-exact), the lit views and the cutaway, plus the verify numbers.
//   node scripts/voxel/gallery.mjs   (after voxel:verify and voxel:beauty)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const VOX = join(ROOT, ".voxel");
const inv = JSON.parse(readFileSync(join(VOX, "inventory.json"), "utf8")).models;
const ver = existsSync(join(VOX, "verify.json"))
  ? JSON.parse(readFileSync(join(VOX, "verify.json"), "utf8"))
  : { summary: null, models: [] };
const byId = new Map(ver.models.map((r) => [r.id, r]));
const VIEWS = [
  "iso-front-right",
  "iso-front-left",
  "iso-back-right",
  "iso-back-left",
  "front",
  "side",
  "top",
  "cutaway",
];
const esc = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const img = (abs, cap) =>
  existsSync(abs)
    ? `<figure><a href="${esc(relative(VOX, abs))}"><img loading="lazy" src="${esc(relative(VOX, abs))}"></a><figcaption>${esc(cap)}</figcaption></figure>`
    : "";
const cards = inv.map((e) => {
  const r = byId.get(e.id) ?? {};
  const ok = r.voxel_exact && r.pixel_exact && (r.parts ?? 0) === (r.parts_exact ?? 0);
  const facts = [
    `${e.size.join("×")} cells · ${e.voxels.toLocaleString()} voxels · unit ${e.unit}`,
    r.faces ? `${r.faces.toLocaleString()} faces` : "",
    r.vs_ref ? `pixels ≠ ${r.vs_ref.pixels_differ ?? "size"}` : "",
    r.vs_book ? `vs book ≠ ${r.vs_book.pixels_differ ?? "size"}` : "",
    r.parts ? `parts ${r.parts_exact}/${r.parts}` : "",
  ].filter(Boolean);
  return `<section id="${esc(e.id)}"><h2>${esc(e.id)} <span class="${ok ? "ok" : "bad"}">${ok ? "1:1" : "check"}</span> <small>${esc(e.kind)}</small></h2>
<p>${facts.map(esc).join(" · ")}</p>
<div class="row">${e.book ? img(e.book, "undevbook") : img(join(VOX, e.ref), "game reference")}${img(join(VOX, "blender/iso", `${e.kind}s`, `${e.id}.png`), "Blender clone (iso)")}${VIEWS.map((v) => img(join(VOX, "blender/beauty", e.kind === "device-detail" ? `${e.id}.detail` : e.id, `${v}.png`), v)).join("")}</div></section>`;
});
const s = ver.summary;
writeFileSync(
  join(VOX, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Clones</title><style>
:root{color-scheme:dark;--bg:#0d0e10;--fg:#e6e6e6;--mut:#9aa0a6;--line:#24262a}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}main{max-width:1500px;margin:0 auto;padding:16px}
h2{font-size:16px;margin:22px 0 2px}small{color:var(--mut);font-weight:400}p{margin:2px 0;color:var(--mut)}section{border-top:1px solid var(--line);padding-bottom:8px}
.ok{color:#5be08a}.bad{color:#ff6b6b}.row{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));margin-top:6px}
figure{margin:0}img{width:100%;aspect-ratio:1;object-fit:contain;background:#16181b;border-radius:4px;image-rendering:pixelated}figcaption{font-size:11px;color:var(--mut)}
</style></head><body><main><h1>Voxel clones — Blender 1:1</h1>
<p>${s ? `${s.models} models · voxel-exact ${s.voxel_exact} · pixel-exact ${s.pixel_exact} · assembly parts ${s.parts_exact}/${s.parts}` : "run pnpm voxel:verify"}</p>
${cards.join("\n")}</main></body></html>`,
);
console.log(`gallery → ${join(VOX, "index.html")}`);

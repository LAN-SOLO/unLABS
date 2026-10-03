// Cut a trailer from its rendered frames (docs/TRAILERS.md, docs/TRANSMISSIONS.md).
//
//   node scripts/trailer/assemble.mjs t1 h [--preview] [--clean]
//
// Video: every shot's PNG sequence (or frames borrowed from another trailer's
// shot via `src`), joined by its transition (cut = concat, dissolve / black =
// xfade overlap). Then the transmission layer: link readout + labels (crisp
// voxel-font PNGs from hud.mjs) and the glitches (glitch.mjs); --clean leaves
// it out. Audio: the game's song(s) + sound-effect cues, static bursts on
// glitches, music ducking on dropouts, normalised to −14 LUFS / −1 dBTP.
// Output: .voxel/trailer/out/unlabs-<t>-<16x9|9x16>[-preview][-clean].mp4
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { between, dropWindows, linkSteps, shotGlitches, videoGlitches } from "./glitch.mjs";
import { hudText } from "./hud.mjs";
import { TIMELINES } from "./timeline.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");
const TR = join(ROOT, ".voxel/trailer");
const MUSIC = process.env.TRAILER_MUSIC ?? join(TR, "music");
const [trailer, fmt = "h", ...rest] = process.argv.slice(2);
const preview = rest.includes("--preview");
const clean = rest.includes("--clean");
const DBG = process.env.TRAILER_DBG ?? "";
const tl = TIMELINES[trailer];
if (!tl) throw new Error(`unknown trailer ${trailer}`);
const FPS = 24;
const [W, H] = fmt === "h" ? [1920, 1080] : [1080, 1920];
const [OW, OH] = preview ? [W / 2, H / 2] : [W, H];

const inputs = [];
const vf = [];
const af = [];
let nIn = 0;
const input = (...args) => {
  inputs.push(...args);
  return nIn++;
};

// ── Shots ──
let cur = null;
let curDur = 0;
const starts = [];
tl.shots.forEach((s, i) => {
  const src = s.src ?? { trailer, shot: s.id, from: 0 };
  const dir = join(TR, "frames", src.trailer, preview ? `${fmt}-preview` : fmt, src.shot);
  if (!existsSync(dir)) throw new Error(`missing frames: ${dir}`);
  const total = readdirSync(dir).filter((f) => f.endsWith(".png")).length;
  const first = Math.round((src.from ?? 0) * FPS) + 1;
  const n = s.src ? Math.min(Math.round(s.seconds * FPS), total - first + 1) : total;
  const dur = n / FPS;
  const k = input(
    "-framerate",
    String(FPS),
    "-start_number",
    String(first),
    "-i",
    join(dir, "f%04d.png"),
  );
  vf.push(
    `[${k}:v]trim=end_frame=${n},scale=${OW}:${OH}:flags=lanczos,setsar=1,format=yuv420p,fps=${FPS},settb=AVTB,setpts=PTS-STARTPTS[v${i}]`,
  );
  if (cur === null) {
    starts.push(0);
    const fin = s.in === "black" ? `,fade=t=in:st=0:d=${s.dur ?? 0.6}` : "";
    vf.push(`[v${i}]null${fin}[c${i}]`);
    curDur = dur;
  } else if (s.in === "cut" || !s.in) {
    starts.push(curDur);
    vf.push(`[${cur}][v${i}]concat=n=2:v=1:a=0,fps=${FPS},settb=AVTB[c${i}]`);
    curDur += dur;
  } else {
    const d = s.dur ?? 0.5;
    const off = Math.max(0, curDur - d);
    starts.push(off);
    const kind = s.in === "black" ? "fadeblack" : "fade";
    vf.push(
      `[${cur}][v${i}]xfade=transition=${kind}:duration=${d}:offset=${off.toFixed(3)},settb=AVTB[c${i}]`,
    );
    curDur = off + dur;
  }
  cur = `c${i}`;
});
const total = curDur;
const shotAt = (ref) => {
  if (typeof ref === "number") return ref;
  const i = tl.shots.findIndex((s) => s.id === ref.shot);
  if (i < 0) throw new Error(`unknown shot ${ref.shot}`);
  return starts[i] + (ref.t ?? 0);
};

// ── Transmission layer: readouts + glitches ──
const events = [];
if (!clean) {
  const hudDir = join(TR, "hud");
  const px = Math.max(2, Math.round((Math.min(OW, OH) / 1080) * 4));
  const vertical = fmt === "v";
  const mx = Math.round(OW * (vertical ? 0.06 : 0.045));
  const topY = Math.round(OH * (vertical ? 0.11 : 0.05));
  const botY = (h) => Math.round(OH - OH * (vertical ? 0.22 : 0.065) - h);
  // text → { k, w, h, windows, corner }
  const overlays = new Map();
  const place = (text, color, corner, a, b) => {
    const key = `${corner}|${text}`;
    if (!overlays.has(key)) {
      const img = hudText(text, px, color, hudDir);
      const k = input("-i", img.file);
      overlays.set(key, { k, ...img, corner, windows: [] });
    }
    overlays.get(key).windows.push([a, b]);
  };
  tl.shots.forEach((s, i) => {
    const t0 = starts[i];
    const end = i + 1 < tl.shots.length ? starts[i + 1] : total;
    const steps = linkSteps(tl.tx ?? 0, s.link, s.seconds, i + 1);
    for (const st of steps) place(st.text, "#c4ffd0", "tr", t0 + st.t0, Math.min(end, t0 + st.t1));
    if (s.label) place(s.label, "#efebe0", "bl", t0 + 0.5, end);
    for (const g of shotGlitches(s, steps, i + 1 + (tl.tx ?? 0) * 17))
      events.push({ ...g, at: t0 + g.t });
  });
  let v = cur;
  let j = 0;
  for (const o of DBG.includes("nohud") ? [] : overlays.values()) {
    const x = o.corner.endsWith("r") ? OW - mx - o.w : mx;
    const y = o.corner.startsWith("t") ? topY : botY(o.h);
    const en = o.windows.map(([a, b]) => between(a, b)).join("+");
    vf.push(
      `[${v}][${o.k}:v]overlay=x=${x}:y=${y}:enable='${en}':eof_action=repeat:repeatlast=1[h${j}]`,
    );
    v = `h${j++}`;
  }
  events.sort((a, b) => a.at - b.at);
  const g = videoGlitches(DBG.includes("novg") ? [] : events, v, OW, OH, (tl.tx ?? 0) + 7);
  vf.push(...g.filters);
  cur = g.out;
}
vf.push(`[${cur}]fade=t=out:st=${(total - 1.2).toFixed(3)}:d=1.2[vout]`);

// ── Audio (own pass → WAV; one combined graph broke timestamps on T00) ──
const ainputs = [];
let aIn = 0;
const ainput = (...args) => {
  ainputs.push(...args);
  return aIn++;
};
const mix = [];
const drops = dropWindows(events);
for (const m of DBG.includes("nomusic") ? [] : (tl.music ?? [])) {
  const k = ainput("-i", join(MUSIC, `${m.song}.wav`));
  const at = shotAt(m.at);
  const len = (m.until !== undefined ? shotAt(m.until) : total) - at;
  const fo = m.fadeOut ?? 3;
  const duck = drops.map(([a, b]) => `,volume=0.12:enable='${between(a, b)}'`).join("");
  af.push(
    `[${k}:a]atrim=start=${m.from ?? 0}:duration=${len.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `afade=t=in:st=0:d=${m.fadeIn ?? 0.5},afade=t=out:st=${Math.max(0, len - fo).toFixed(3)}:d=${fo},` +
      `volume=${m.gain ?? 1},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)},aresample=48000,aformat=channel_layouts=stereo${duck}[a${k}]`,
  );
  mix.push(`[a${k}]`);
}
tl.shots.forEach((s, i) => {
  for (const q of DBG.includes("nosfx") ? [] : (s.sfx ?? [])) {
    const name = q.v ? `${q.name}-${q.v}` : q.name;
    const file = join(TR, "sfx", `${name}.wav`);
    if (!existsSync(file)) throw new Error(`missing sfx ${file}`);
    const k = ainput("-i", file);
    const at = Math.round((starts[i] + q.t) * 1000);
    af.push(
      `[${k}:a]volume=${q.gain ?? 0.6},adelay=${at}|${at},aresample=48000,aformat=channel_layouts=stereo[a${k}]`,
    );
    mix.push(`[a${k}]`);
  }
});
// Static bursts on the glitches: crushed, band-passed noise as long as the glitch.
for (const e of DBG.includes("noag") ? [] : events) {
  const d = Math.max(0.06, e.dur / FPS);
  const k = ainput(
    "-f",
    "lavfi",
    "-t",
    d.toFixed(3),
    "-i",
    `anoisesrc=c=white:a=${(0.08 + 0.22 * e.amp).toFixed(2)}:r=48000`,
  );
  const at = Math.round(e.at * 1000);
  af.push(
    `[${k}:a]acrusher=bits=6:mode=log:aa=1:samples=${e.kind === "drop" ? 12 : 6},highpass=f=700,lowpass=f=7000,` +
      `afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, d - 0.03).toFixed(3)}:d=0.03,adelay=${at}|${at},aformat=channel_layouts=stereo[a${k}]`,
  );
  mix.push(`[a${k}]`);
}
// A −90 dB noise floor: loudnorm turns long digital silence into NaN.
{
  const k = ainput(
    "-f",
    "lavfi",
    "-t",
    total.toFixed(3),
    "-i",
    "anoisesrc=c=pink:a=0.00003:r=48000",
  );
  af.push(`[${k}:a]aformat=channel_layouts=stereo[a${k}]`);
  mix.push(`[a${k}]`);
}
af.push(
  `${mix.join("")}amix=inputs=${mix.length}:normalize=0:duration=longest,asetpts=N/SR/TB,` +
    `atrim=duration=${total.toFixed(3)},${DBG.includes("nonorm") ? "anull" : "loudnorm=I=-14:TP=-1:LRA=11"}[aout]`,
);

mkdirSync(join(TR, "out"), { recursive: true });
const tag = `${preview ? "-preview" : ""}${clean ? "-clean" : ""}`;
const out = join(TR, "out", `unlabs-${trailer}-${fmt === "h" ? "16x9" : "9x16"}${tag}.mp4`);
const wav = join(TR, "out", `.audio-${trailer}-${fmt}.wav`);
{
  const ar = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      ...ainputs,
      "-filter_complex",
      af.join(";"),
      "-map",
      "[aout]",
      "-c:a",
      "pcm_f32le",
      "-ar",
      "48000",
      wav,
    ],
    { stdio: "inherit" },
  );
  if (ar.status !== 0) process.exit(ar.status ?? 1);
}
const args = [
  "-y",
  "-loglevel",
  "error",
  ...inputs,
  "-i",
  wav,
  "-filter_complex",
  vf.join(";"),
  "-map",
  "[vout]",
  "-map",
  `${nIn}:a`,
  "-c:v",
  "libx264",
  "-preset",
  preview ? "veryfast" : "slow",
  "-crf",
  preview ? "23" : "16",
  "-profile:v",
  "high",
  "-pix_fmt",
  "yuv420p",
  "-r",
  String(FPS),
  "-c:a",
  "aac",
  "-b:a",
  "320k",
  "-ar",
  "48000",
  "-movflags",
  "+faststart",
  out,
];
if (DBG.includes("dump")) console.log([...vf, ...af].join(";\n"));
const r = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`[trailer] ${out} (${total.toFixed(1)} s, ${events.length} glitches)`);
console.log(
  `[trailer] shot starts: ${tl.shots.map((s, i) => `${s.id} ${starts[i].toFixed(2)}`).join(" · ")}`,
);

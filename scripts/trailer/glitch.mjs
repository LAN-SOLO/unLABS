// The transmission layer (docs/TRANSMISSIONS.md): link readouts and signal
// glitches, derived deterministically from timeline.mjs. assemble.mjs turns
// the result into ffmpeg filters.
//
// Glitch kinds: "rgb" (channel split), "tear" (horizontal band slip),
// "noise" (static), "drop" (signal dropout: dark + static + the music ducks).
// Glitches are short (2–10 frames) and never full-frame flashes.

const FPS = 24;

/** Small seeded PRNG (mulberry32) so every render glitches the same way. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Link readout of one shot → [{ t0, t1, text, value }] in shot seconds.
 * `link` = [a, b] or { a, b, every, tail, steps: [[t, "NN%"], …] }.
 */
export function linkSteps(tx, link, seconds, seed) {
  if (!link) return [];
  const spec = Array.isArray(link) ? { a: link[0], b: link[1] } : link;
  const label = (v) => `TX${String(tx).padStart(2, "0")}  LINK ${v}`;
  let raw;
  if (spec.steps) {
    raw = spec.steps.map(([t, v]) => ({ t, v }));
  } else {
    const every = spec.every ?? 0.85;
    const r = rng(seed * 31 + tx);
    const n = Math.max(2, Math.floor((seconds - 0.6) / every));
    raw = [];
    for (let k = 0; k < n; k++) {
      let v = spec.a + ((spec.b - spec.a) * k) / (n - 1);
      if (k > 0 && k < n - 1) v += (r() - 0.5) * 8;
      raw.push({ t: 0.3 + k * every, v: Math.max(1, Math.min(100, Math.round(v))) });
    }
  }
  return raw.map((s, i) => {
    const value = typeof s.v === "number" ? s.v : parseInt(s.v, 10) || 0;
    const shown =
      i === raw.length - 1 && spec.tail ? spec.tail : `${String(value).padStart(3, " ")}%`;
    return { t0: s.t, t1: i + 1 < raw.length ? raw[i + 1].t : seconds, text: label(shown), value };
  });
}

/**
 * Glitches of one shot (shot seconds): the manual `glitch` cues plus, unless
 * `auto: false`, a density that follows the link — the weaker, the noisier.
 */
export function shotGlitches(shot, steps, seed) {
  const out = (shot.glitch ?? []).map((g) => ({ dur: 4, amp: 0.6, ...g }));
  if (shot.auto === false || steps.length === 0) return out;
  const avg = steps.reduce((s, x) => s + x.value, 0) / steps.length;
  const r = rng(seed * 97 + 13);
  const count = Math.round((100 - avg) / 15);
  const kinds = avg < 45 ? ["rgb", "tear", "tear", "noise", "drop"] : ["rgb", "tear", "noise"];
  for (let k = 0; k < count; k++) {
    const t = 0.5 + r() * Math.max(0.1, shot.seconds - 1.2);
    const kind = kinds[Math.floor(r() * kinds.length)];
    const dur = 2 + Math.floor(r() * (avg < 50 ? 7 : 4));
    out.push({ t, dur, kind, amp: Math.min(1, (100 - avg) / 70 + 0.15) });
  }
  // A weak link also slips on the cut in.
  if (avg < 70 && shot.in === "cut") out.push({ t: 0, dur: 3, kind: "tear", amp: 0.7 });
  return out;
}

const between = (a, b) => `between(t\\,${a.toFixed(3)}\\,${b.toFixed(3)})`;

/**
 * ffmpeg video filters for absolute glitch events [{ at, dur(frames), kind, amp }]
 * on stream `src` (W × H). Returns { filters: string[], out }.
 */
export function videoGlitches(events, src, W, H, seed) {
  const f = [];
  let cur = src;
  let n = 0;
  const r = rng(seed);
  const next = () => `g${n++}`;
  for (const e of events) {
    const a = e.at;
    const b = e.at + e.dur / FPS;
    const en = `enable='${between(a, b)}'`;
    const px = Math.max(2, Math.round((W / 1920) * 22 * e.amp));
    if (e.kind === "rgb") {
      const o = next();
      f.push(`[${cur}]rgbashift=rh=${px}:bh=${-px}:gv=${Math.round(px / 3)}:${en}[${o}]`);
      cur = o;
    } else if (e.kind === "noise" || e.kind === "drop") {
      const o = next();
      const dark =
        e.kind === "drop" ? `eq=brightness=${(-0.35 * e.amp - 0.15).toFixed(2)}:${en},` : "";
      f.push(`[${cur}]${dark}noise=alls=${Math.round(40 + 50 * e.amp)}:allf=t+u:${en}[${o}]`);
      cur = o;
    }
    if (e.kind === "tear" || e.kind === "drop") {
      // 2–3 bands slip sideways — one geq per event (runs only on its frames;
      // chained split/overlay pairs are pathologically slow in ffmpeg).
      const bands = 2 + Math.floor(r() * 2);
      const terms = [];
      for (let k = 0; k < bands; k++) {
        const a0 = r() * 0.9;
        const a1 = a0 + 0.02 + r() * 0.09;
        const dx = (r() < 0.5 ? -1 : 1) * (0.015 + r() * 0.06) * e.amp;
        terms.push(`(W*${dx.toFixed(4)})*between(Y/H\\,${a0.toFixed(4)}\\,${a1.toFixed(4)})`);
      }
      const o = next();
      f.push(`[${cur}]geq=lum='p(X-${terms.join("-")}\\,Y)':${en}[${o}]`);
      cur = o;
    }
  }
  return { filters: f, out: cur };
}

/** Windows (absolute seconds) in which the music ducks: the dropouts. */
export function dropWindows(events) {
  return events.filter((e) => e.kind === "drop").map((e) => [e.at, e.at + e.dur / FPS]);
}

export { between };

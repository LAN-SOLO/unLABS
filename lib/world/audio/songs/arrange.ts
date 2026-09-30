/**
 * Arranger — one bar of a song as synth events (pure).
 * ====================================================
 *
 * `songPlan(song, length)` flattens the form into bars; `renderBar(song, bar,
 * targets, { length })` writes that bar's notes into one `SynthTarget` per
 * part (lead, counter, bell, arp, pad, bass, drums). The player gives each
 * part its own mixer channel; tests use recording targets.
 *
 * Every pass through a section varies a little (seeded, reproducible):
 * the lead may switch to its alternate instrument or rise an octave, long
 * notes get grace notes, a counter voice harmonises in thirds once the
 * section has energy, arpeggios turn around, bells sparkle at phrase ends,
 * drums fill into the next section and crash into loud ones.
 *
 * Extended arrangement (setting `audio.songLength`): `long` and `epic` keep
 * the composed intro + body, then add generated variation passes built from
 * the body's own sections — breakdown (pad / arp / bells only), lift (lead an
 * octave up on its alternate voice), sparse, counter (the counter voice takes
 * the tune), drumless (drums drop out and crash back in), bridge reuse and a
 * key shift (up a fourth). After each full cycle of the seven kinds the
 * theme returns once as composed; the song closes with a reprise of the
 * body's last two sections and the composed outro. The pass order is seeded by the song id, so every
 * song has one fixed long form (deterministic, like the composed one).
 */
import { mulberry32, type SynthTarget } from "@/lib/world/audio/synth";
import { drumHits, drumPattern, fillHits, playDrum } from "@/lib/world/audio/songs/drums";
import { PAD_INSTRUMENTS, STRUCK_INSTRUMENTS, playNote } from "@/lib/world/audio/songs/instruments";
import {
  chordMidi,
  degreeMidi,
  nearest,
  parseChords,
  parseLine,
  voiceNear,
} from "@/lib/world/audio/songs/notation";
import type { SongLength } from "@/lib/world/audio/songs/styles";
import type {
  ArpStyle,
  BarChord,
  InstrumentId,
  Part,
  SectionDef,
  SongDef,
} from "@/lib/world/audio/songs/types";

/** Generated variation passes of the extended arrangement. */
export const VARY_KINDS = [
  "breakdown",
  "lift",
  "sparse",
  "counter",
  "drumless",
  "bridge",
  "shift",
] as const;
export type VaryKind = (typeof VARY_KINDS)[number];

export interface SlotVary {
  kind: VaryKind;
  /** Pass number (0 = first generated pass). */
  pass: number;
  /** 0 = first half of the pass, 1 = second half (drumless: drums come back). */
  half: 0 | 1;
}

export interface BarSlot {
  section: string;
  /** How often this section has played before (0 = first pass). */
  occ: number;
  /** Bar index within the section. */
  inSec: number;
  /** Set on bars of a generated variation pass (long / epic lengths). */
  vary?: SlotVary;
}

export interface SongPlan {
  bars: BarSlot[];
  barEighths: 8 | 6;
  /** Seconds per eighth. */
  eighth: number;
  barSeconds: number;
  totalSeconds: number;
  length: SongLength;
  /** The generated passes in order (empty for `standard`). */
  passes: { kind: VaryKind; firstBar: number; bars: number }[];
}

/**
 * Target length in seconds per setting. The planner adds passes until the
 * song (incl. reprise + outro) reaches the target, so a song ends up between
 * the target and target + one pass (≈ 0.5–1.5 min).
 */
export const LENGTH_TARGET: Readonly<Record<SongLength, number>> = {
  standard: 0,
  long: 580,
  epic: 1230,
};

/** A generated pass with two sections longer than this keeps only the first. */
const MAX_PASS_SECONDS = 60;

const plans = new Map<string, SongPlan>();

const isOutro = (name: string): boolean => /^(outro|coda|end)/i.test(name);

export function songPlan(song: SongDef, length: SongLength = "standard"): SongPlan {
  const cacheKey = `${song.id}|${length}`;
  const hit = plans.get(cacheKey);
  if (hit) return hit;
  const counts: Record<string, number> = {};
  const bars: BarSlot[] = [];
  const barEighths = song.meter ?? 8;
  const eighth = 60 / song.bpm / 2;
  const barSeconds = eighth * barEighths;
  const secOf = (name: string): SectionDef => {
    const sec = song.sections[name];
    if (!sec) throw new Error(`${song.id}: unknown section "${name}"`);
    return sec;
  };
  const push = (name: string, vary?: SlotVary): void => {
    const sec = secOf(name);
    const occ = counts[name] ?? 0;
    counts[name] = occ + 1;
    for (let i = 0; i < sec.bars; i++)
      bars.push(vary ? { section: name, occ, inSec: i, vary } : { section: name, occ, inSec: i });
  };
  const passes: SongPlan["passes"] = [];
  const form = song.form;
  const hasOutro = form.length > 1 && isOutro(form[form.length - 1]!);
  const bodyEnd = hasOutro ? form.length - 1 : form.length;
  const bodyStart = form[0] === "intro" ? 1 : 0;
  const body = form.slice(bodyStart, bodyEnd);
  const target = LENGTH_TARGET[length];
  if (!target || body.length === 0) {
    for (const name of form) push(name);
  } else {
    for (const name of form.slice(0, bodyEnd)) push(name);
    const uniq = [...new Set(body)];
    const freq = (n: string) => body.filter((b) => b === n).length;
    const main = [...uniq].sort((a, b) => freq(b) - freq(a))[0]!;
    const others = uniq.filter((n) => n !== main);
    // The rarest section (ties: the later one) is the song's bridge.
    const bridge = others.length
      ? [...others].reverse().sort((a, b) => freq(a) - freq(b))[0]!
      : main;
    const n = uniq.length;
    const at = (i: number) => uniq[((i % n) + n) % n]!;
    const template = (kind: VaryKind, c: number): string[] => {
      switch (kind) {
        case "breakdown":
          return secOf(at(c)).bars < 8 ? [at(c), at(c)] : [at(c)];
        case "lift":
          return [main, at(c + 1)];
        case "sparse":
          return [at(c + 2)];
        case "counter":
          return [at(c + 1), main];
        case "drumless":
          return [at(c), at(c)];
        case "bridge":
          return [bridge, at(c + 3)];
        case "shift":
          return secOf(main).bars < 8 ? [main, main] : [main];
      }
    };
    const secs = (names: readonly string[]) =>
      names.reduce((t, x) => t + secOf(x).bars, 0) * barSeconds;
    const reprise = body.slice(-2);
    const tail = secs(reprise) + (hasOutro ? secs([form[form.length - 1]!]) : 0);
    const rng = mulberry32(hash(song.id, "long-form"));
    let order: VaryKind[] = [];
    let last: VaryKind | null = null;
    let pass = 0;
    while (bars.length * barSeconds + tail < target && pass < 64) {
      if (!order.length) {
        if (pass > 0) {
          // After each full cycle the theme comes home once, as composed.
          for (const name of [main, at(pass + 1)]) push(name);
          if (bars.length * barSeconds + tail >= target) break;
        }
        // A fresh shuffled cycle of all kinds; never the same kind twice in a row.
        order = [...VARY_KINDS];
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [order[i], order[j]] = [order[j]!, order[i]!];
        }
        if (order[0] === last) order.push(order.shift()!);
        // Open with contrast, not with a key change.
        if (pass === 0 && order[0] === "shift") order.push(order.shift()!);
      }
      const kind = order.shift()!;
      last = kind;
      let names = template(kind, Math.floor(pass / VARY_KINDS.length) + pass);
      // Slow songs with long sections: one section per pass keeps the variety up.
      if (names.length > 1 && secs(names) > MAX_PASS_SECONDS) names = names.slice(0, 1);
      const firstBar = bars.length;
      for (const name of names) push(name, { kind, pass, half: 0 });
      // First / second half of the pass by bar (drumless: the drums return halfway).
      const n = bars.length - firstBar;
      for (let i = Math.ceil(n / 2); i < n; i++) {
        const v = bars[firstBar + i]!.vary;
        if (v) bars[firstBar + i] = { ...bars[firstBar + i]!, vary: { ...v, half: 1 } };
      }
      passes.push({ kind, firstBar, bars: n });
      pass++;
    }
    // Reprise of the body's ending as composed, then the outro.
    for (const name of reprise) push(name);
    if (hasOutro) push(form[form.length - 1]!);
  }
  const plan: SongPlan = {
    bars,
    barEighths,
    eighth,
    barSeconds,
    totalSeconds: barSeconds * bars.length,
    length,
    passes,
  };
  plans.set(cacheKey, plan);
  return plan;
}

export type PartTargets = Partial<Record<Part, SynthTarget>>;

function hash(...xs: (number | string)[]): number {
  let h = 0x811c9dc5;
  for (const x of xs) {
    const s = String(x);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2f;
  }
  return h >>> 0;
}

const PAN: Record<Part, number> = {
  lead: 0,
  counter: -0.35,
  bell: 0.42,
  arp: 0.28,
  pad: 0,
  bass: 0,
  drums: 0,
};

/** Sections whose chord changes: same chord as the last one? */
function sameChord(a: BarChord | undefined, b: BarChord | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.degree === b.degree &&
    a.flat === b.flat &&
    a.seventh === b.seventh &&
    a.sus === b.sus
  );
}

export interface RenderOptions {
  /** Session seed (0 = the canonical rendering). */
  seed?: number;
  /** Replace the lead instrument (studio). */
  lead?: InstrumentId;
  /** Arrangement length (default `standard` = the composed form). */
  length?: SongLength;
}

/** Chords of a bar slot. */
export function barChords(song: SongDef, slot: BarSlot): BarChord[] {
  const plan = songPlan(song);
  const sec = song.sections[slot.section]!;
  const list = parseChords(sec.chords, plan.barEighths);
  return list[slot.inSec % list.length]!;
}

/** Render bar `bar` of `song` into the part targets (times relative to the bar start). */
export function renderBar(
  song: SongDef,
  bar: number,
  allTargets: PartTargets,
  opts: RenderOptions = {},
): void {
  const plan = songPlan(song, opts.length ?? "standard");
  const slot = plan.bars[((bar % plan.bars.length) + plan.bars.length) % plan.bars.length]!;
  const composed: SectionDef = song.sections[slot.section]!;
  const passVary = slot.vary;
  const { sec, mute, energy, transpose, leadStyle } = applyVary(song, composed, passVary);
  const targets: PartTargets = {};
  for (const [p, t] of Object.entries(allTargets) as [Part, SynthTarget | undefined][])
    if (t && !mute.has(p)) targets[p] = t;
  const e = plan.eighth;
  const BE = plan.barEighths;
  const swing = song.swing ?? 0;
  const seed = opts.seed ?? 0;
  const rng = mulberry32(hash(song.id, bar, seed));
  const passRng = mulberry32(hash(song.id, slot.section, slot.occ, seed));
  const passRoll = passRng();
  const key = song.key + transpose;
  const mode = song.mode;
  /** Accompaniment register: the key's pitch class in octave 4 (C4…B4). */
  const acc = 60 + ((((key - 60) % 12) + 12) % 12);
  const chords = barChords(song, slot);
  const lastBarOfSec = slot.inSec === sec.bars - 1;
  const prevSlot = bar > 0 ? plan.bars[bar - 1] : undefined;
  const nextSlot = plan.bars[(bar + 1) % plan.bars.length];

  /** Eighth position → seconds, with swing on off-beat eighths. */
  const T = (pos: number): number => {
    const r = Math.round(pos);
    const off = Math.abs(pos - r) < 1e-6 && r % 2 === 1 ? swing * e : 0;
    return pos * e + off;
  };
  const human = () => (rng() - 0.5) * 0.01;
  const vary = () => 0.9 + rng() * 0.2;

  // ── Melodic lines ────────────────────────────────────────────────
  const line = (
    part: Part,
    src: string | undefined,
    inst: InstrumentId,
    vel: number,
    shift: number,
    harmony = 0,
    ornaments = false,
  ): void => {
    const t = targets[part];
    if (!t || !src) return;
    const parsed = parseLine(src);
    const L = parsed.length;
    if (L <= 0) return;
    const start = slot.inSec * BE;
    const end = start + BE;
    const struck = STRUCK_INSTRUMENTS.has(inst);
    const legato = struck ? 1 : 0.92;
    // Plucked / struck leads decay fast: lift them so the tune stays on top.
    const lift = part === "lead" && struck ? 1.3 : 1;
    for (let r = Math.floor(start / L); r * L < end; r++) {
      parsed.notes.forEach((n, idx) => {
        const abs = n.at + r * L;
        if (abs < start - 1e-9 || abs >= end - 1e-9) return;
        const pos = abs - start;
        let midi = degreeMidi(key, mode, n.degree + harmony, harmony ? 0 : n.acc) + shift;
        if (midi > 96) midi -= 12;
        const v = vel * lift * (n.accent ? 1.15 : 1) * vary();
        const at = Math.max(0, T(pos) + human());
        if (ornaments && n.len >= 3 && pos >= 0.5 && mulberry32(hash(idx, r, slot.occ))() < 0.3) {
          const g = degreeMidi(key, mode, n.degree + 1 + harmony) + shift;
          playNote(t, inst, {
            midi: g,
            at: at - e * 0.25,
            dur: e * 0.22,
            vel: v * 0.7,
            pan: PAN[part],
          });
        }
        playNote(t, inst, { midi, at, dur: n.len * e * legato, vel: v, pan: PAN[part] });
      });
    }
  };

  const altVoice = leadStyle === "alt" || leadStyle === "up";
  const leadInst =
    opts.lead ??
    ((altVoice || slot.occ % 2 === 1) && song.voices.leadAlt
      ? song.voices.leadAlt
      : song.voices.lead);
  const leadShift =
    leadStyle === "up" ? (key + 12 <= 84 ? 12 : 0) : slot.occ >= 2 && passRoll < 0.3 ? 12 : 0;
  const lv = 0.75 + energy * 0.35;
  const counterInst = song.voices.counter ?? song.voices.leadAlt ?? song.voices.lead;
  if (leadStyle === "swap") {
    // The counter voice takes the tune (an octave down when it sits high);
    // a written counter line moves up into the lead.
    if (sec.counter) line("lead", sec.counter, leadInst, lv * 0.9, 0);
    line("counter", sec.lead, counterInst, lv * 0.85, key >= 67 ? -12 : 0, 0, true);
  } else {
    if (leadStyle === "sparse") {
      // Every other bar: the tune breathes, the space is the point.
      if (slot.inSec % 2 === 0) line("lead", sec.lead, leadInst, lv * 0.85, leadShift);
    } else line("lead", sec.lead, leadInst, lv, leadShift, 0, slot.occ >= 1);
  }

  if (leadStyle === "swap") {
    /* the counter already plays the tune */
  } else if (sec.counter) line("counter", sec.counter, counterInst, lv * 0.7, 0);
  else if (sec.lead && song.voices.counter && slot.occ >= 1 && energy >= 0.55) {
    // Auto harmony: a diatonic third below the lead.
    line("counter", sec.lead, counterInst, lv * 0.42, leadShift, -2);
  }

  const bellInst = song.voices.bell ?? "celesta";
  if (sec.bell) line("bell", sec.bell, bellInst, 0.7, 0);
  else if (song.voices.bell && energy >= 0.3 && slot.inSec % 4 === 3 && targets.bell) {
    // Sparkle at the phrase end: three chord tones falling from above.
    const c = chords[chords.length - 1]!;
    const tones = voiceNear(chordMidi(acc, mode, c), acc + 14).reverse();
    tones.slice(0, 3).forEach((m, i) => {
      playNote(targets.bell!, bellInst, {
        midi: m,
        at: T(BE - 3 + i),
        dur: e,
        vel: 0.35 * vary(),
        pan: PAN.bell,
      });
    });
  }
  if (song.handshake && slot.inSec === 0 && slot.occ === 1 && targets.bell) {
    // The four handshake tones 3-6-4-8, quietly, as a quote.
    [2, 5, 3, 7].forEach((d, i) => {
      playNote(targets.bell!, bellInst, {
        midi: degreeMidi(key, mode, d) + (key < 66 ? 12 : 0),
        at: T(i * 2),
        dur: e * 1.6,
        vel: 0.45,
        pan: PAN.bell,
      });
    });
  }

  // ── Pad ──────────────────────────────────────────────────────────
  const padInst = song.voices.pad;
  const padStyle = sec.pad ?? (padInst ? "hold" : "none");
  if (padInst && padStyle !== "none" && targets.pad) {
    const t = targets.pad;
    const pv = (PAD_INSTRUMENTS.has(padInst) ? 0.6 : 0.45) * (0.7 + energy * 0.5);
    chords.forEach((c) => {
      const notes = voiceNear(chordMidi(acc, mode, c), acc - 5);
      const hits: [number, number][] =
        padStyle === "hold" || padStyle === "swell"
          ? [[c.at, c.len]]
          : padStyle === "pulse"
            ? range(c.at, c.at + c.len, 2).map((p) => [p, 1.6] as [number, number])
            : padStyle === "stab"
              ? [[c.at, 0.8], ...(c.len >= 4 ? [[c.at + 3, 0.8] as [number, number]] : [])]
              : range(c.at + 1, c.at + c.len, 2).map((p) => [p, 0.7] as [number, number]);
      for (const [p, len] of hits) {
        notes.forEach((m, i) => {
          playNote(t, padInst, {
            midi: m,
            at: T(p) + i * 0.004,
            dur: len * e,
            vel:
              pv *
              (padStyle === "swell" ? 0.8 + 0.4 * (slot.inSec / Math.max(1, sec.bars - 1)) : 1),
            pan: (i % 2 ? 0.18 : -0.18) * (notes.length > 2 ? 1 : 0),
          });
        });
      }
    });
  }

  // ── Bass ─────────────────────────────────────────────────────────
  const bassInst = song.voices.bass;
  const bassStyle = sec.bass ?? (bassInst ? "root" : "none");
  if (bassInst && bassStyle !== "none" && targets.bass) {
    const t = targets.bass;
    const bv = 0.65 + energy * 0.4;
    const nextChord = (i: number): BarChord | undefined =>
      chords[i + 1] ?? (nextSlot ? barChords(song, nextSlot)[0] : undefined);
    chords.forEach((c, ci) => {
      const tones = chordMidi(acc, mode, c);
      const root = clampBass(nearest(tones[0]!, acc - 24), acc);
      const fifth = root + ((tones[2]! - tones[0]! + 120) % 12);
      const third = root + ((tones[1]! - tones[0]! + 120) % 12);
      const b = (pos: number, len: number, midi: number, v = 1) =>
        playNote(t, bassInst, {
          midi,
          at: Math.max(0, T(pos) + human() * 0.5),
          dur: len * e * 0.92,
          vel: bv * v * vary(),
        });
      const A = c.at;
      const L = c.len;
      switch (bassStyle) {
        case "hold":
          b(A, L, root);
          break;
        case "root":
          b(A, L >= 4 ? L / 2 : L, root);
          if (L >= 4) b(A + L / 2, L / 2, sameChord(c, nextChord(ci)) ? fifth : root, 0.8);
          break;
        case "pulse":
          for (const p of range(A, A + L, 1)) b(p, 0.8, root, p === A ? 1 : 0.75);
          break;
        case "octave":
          for (const p of range(A, A + L, 1))
            b(p, 0.8, (p - A) % 2 ? root + 12 : root, (p - A) % 2 ? 0.7 : 1);
          break;
        case "walk": {
          const nx = nextChord(ci);
          const nextRoot = nx
            ? clampBass(nearest(chordMidi(acc, mode, nx)[0]!, acc - 24), acc)
            : root;
          const steps = [root, third, fifth, nextRoot + (nextRoot > root ? -1 : 1)];
          range(A, A + L, 2).forEach((p, i) => b(p, 1.9, steps[i % 4]!, i === 0 ? 1 : 0.8));
          break;
        }
        case "drive":
          for (const p of range(A, A + L, 1)) b(p, 0.7, root, p % 2 ? 0.65 : 1);
          if (L >= 8) b(A + L - 0.5, 0.5, fifth, 0.6);
          break;
        case "dub":
          b(A, 3, root);
          if (L >= 6) b(A + 5, 1.5, fifth, 0.8);
          break;
        case "arp":
          range(A, A + L, 1).forEach((p, i) =>
            b(p, 0.9, [root, fifth, root + 12, fifth][i % 4]!, i % 4 ? 0.75 : 1),
          );
          break;
        case "sync":
          b(A, 1.5, root);
          if (L >= 4) b(A + 3, 1, root, 0.8);
          if (L >= 8) b(A + 6, 1.5, fifth, 0.85);
          break;
        case "waltz":
          b(A, 2, root);
          if (L >= 6) b(A + 3, 1.5, fifth, 0.7);
          break;
      }
    });
  }

  // ── Arpeggio ─────────────────────────────────────────────────────
  const arpInst = song.voices.arp ?? "harp";
  const arpStyle = sec.arp ?? "none";
  if (arpStyle !== "none" && targets.arp) {
    const t = targets.arp;
    const av = 0.5 * (0.7 + energy * 0.45);
    const flip = slot.occ % 2 === 1;
    chords.forEach((c) => {
      const base = voiceNear(chordMidi(acc, mode, c), acc + 3);
      const tones = [...base, base[0]! + 12];
      const a = (pos: number, midi: number, len: number, v = 1) =>
        playNote(t, arpInst, {
          midi,
          at: Math.max(0, T(pos) + human() * 0.4),
          dur: len * e * 0.9,
          vel: av * v * vary(),
          pan: PAN.arp,
        });
      const A = c.at;
      const L = c.len;
      switch (arpStyle) {
        case "up":
        case "down": {
          const seq = (arpStyle === "down") !== flip ? [...tones].reverse() : tones;
          range(A, A + L, 1).forEach((p, i) => a(p, seq[i % seq.length]!, 1));
          break;
        }
        case "updown": {
          const seq = [...tones, ...tones.slice(1, -1).reverse()];
          range(A, A + L, 1).forEach((p, i) => a(p, seq[i % seq.length]!, 1));
          break;
        }
        case "broken": {
          const seq = [tones[0]!, tones[2]!, tones[1]!, tones[2]!];
          range(A, A + L, 1).forEach((p, i) => a(p, seq[i % 4]!, 1, i % 4 ? 0.8 : 1));
          break;
        }
        case "alberti": {
          const seq = [tones[0]!, tones[2]!, tones[1]!, tones[2]!];
          range(A, A + L, 0.5).forEach((p, i) => a(p, seq[i % 4]! - 12, 0.5, i % 2 ? 0.7 : 0.9));
          break;
        }
        case "harp": {
          const seq = flip
            ? [...tones, ...tones.map((x) => x + 12)].reverse()
            : [...tones, ...tones.map((x) => x + 12)];
          range(A, A + Math.min(L, 4), 0.5).forEach((p, i) =>
            a(p, seq[i % seq.length]!, 0.5, 0.85),
          );
          break;
        }
        case "cascade": {
          const seq = [...tones.map((x) => x + 12), ...tones].reverse();
          range(A, A + L, 0.5).forEach((p, i) =>
            a(p, seq[i % seq.length]!, 0.5, 1 - (i % seq.length) * 0.06),
          );
          break;
        }
        case "pulse":
          range(A, A + L, 1).forEach((p) => a(p, tones[tones.length - 2]!, 0.6, p % 2 ? 0.6 : 0.9));
          break;
        case "waltz":
          range(A + 2, A + L, 2).forEach((p) => base.forEach((m) => a(p, m, 1.4, 0.55)));
          break;
        case "sparse":
          range(A, A + L, 1).forEach((p) => {
            if (rng() < 0.33) a(p, tones[Math.floor(rng() * tones.length)]! + 12, 1.5, 0.8);
          });
          break;
      }
    });
  }

  // ── Drums ────────────────────────────────────────────────────────
  const drumStyle = sec.drums ?? "none";
  if (drumStyle !== "none" && targets.drums) {
    const t = targets.drums;
    const kit = song.voices.kit ?? "acoustic";
    const steps: 16 | 12 = BE === 8 ? 16 : 12;
    let hits = drumHits(drumPattern(drumStyle, steps), energy);
    const fillHere =
      (sec.fill ?? energy >= 0.6) && lastBarOfSec && nextSlot?.section !== slot.section;
    if (fillHere) {
      hits = hits.filter((h) => h.step < steps / 2 || h.piece === "kick");
      hits.push(...fillHits(steps));
    }
    const dv = 0.55 + energy * 0.5;
    for (const h of hits) {
      playDrum(t, kit, h.piece, Math.max(0, T(h.step / 2) + human() * 0.4), h.vel * dv * vary());
    }
    const entering = slot.inSec === 0 && prevSlot && prevSlot.section !== slot.section;
    const dropIn =
      passVary?.kind === "drumless" && prevSlot?.vary?.half === 0 && passVary.half === 1;
    if ((entering && energy >= 0.6) || dropIn) playDrum(t, kit, "crash", 0, 0.8 * dv);
  }
}

type LeadStyle = "plain" | "alt" | "up" | "swap" | "sparse";

/**
 * What a variation pass changes: the effective section (accompaniment styles),
 * muted parts, energy, transposition and how the lead behaves. Composed bars
 * (no `vary`) come back unchanged.
 */
export function applyVary(
  song: SongDef,
  composed: SectionDef,
  vary: SlotVary | undefined,
): {
  sec: SectionDef;
  mute: Set<Part>;
  energy: number;
  transpose: number;
  leadStyle: LeadStyle;
} {
  const base = composed.energy ?? 0.5;
  const mute = new Set<Part>();
  if (!vary) return { sec: composed, mute, energy: base, transpose: 0, leadStyle: "plain" };
  const sec: SectionDef = { ...composed };
  let energy = base;
  let transpose = 0;
  let leadStyle: LeadStyle = "plain";
  const hasArp = (composed.arp ?? "none") !== "none";
  const meterArp: ArpStyle = (song.meter ?? 8) === 6 ? "waltz" : "harp";
  switch (vary.kind) {
    case "breakdown":
      // Pad, arpeggio, bells and a held bass: the harmony without the tune.
      for (const p of ["lead", "counter", "drums"] as const) mute.add(p);
      sec.arp = hasArp ? composed.arp! : meterArp;
      sec.pad = song.voices.pad ? "swell" : (composed.pad ?? "none");
      sec.bass = song.voices.bass ? "hold" : "none";
      energy = Math.max(0.3, Math.min(base, 0.45));
      break;
    case "lift":
      leadStyle = "up";
      energy = Math.min(1, base + 0.12);
      break;
    case "sparse":
      mute.add("counter");
      leadStyle = "sparse";
      sec.arp = "sparse";
      sec.bass = song.voices.bass ? "hold" : "none";
      sec.drums = (composed.drums ?? "none") === "none" ? "none" : "tick";
      sec.fill = false;
      energy = Math.max(0.15, base * 0.7);
      break;
    case "counter":
      leadStyle = "swap";
      sec.arp = hasArp ? composed.arp! : "broken";
      break;
    case "drumless":
      if (vary.half === 0) {
        mute.add("drums");
        sec.bass = song.voices.bass ? "hold" : "none";
        energy = Math.max(0.2, base - 0.15);
      } else energy = Math.min(1, base + 0.08);
      leadStyle = vary.half === 0 ? "alt" : "plain";
      break;
    case "bridge":
      leadStyle = "alt";
      sec.arp = hasArp ? composed.arp! : "cascade";
      break;
    case "shift":
      // Up a fourth (down a fifth when the tune already sits high): IV → I
      // on the way back sounds like coming home.
      transpose = song.key <= 66 ? 5 : -7;
      leadStyle = "alt";
      energy = Math.min(1, base + 0.05);
      break;
  }
  return { sec, mute, energy, transpose, leadStyle };
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let p = from; p < to - 1e-9; p += step) out.push(p);
  return out;
}

/** Keep bass notes in a warm register below the key. */
function clampBass(m: number, key: number): number {
  let x = m;
  while (x > key - 13) x -= 12;
  while (x < key - 25) x += 12;
  return x;
}

/** Song length in seconds (default: the composed form). */
export function songSeconds(song: SongDef, length: SongLength = "standard"): number {
  return songPlan(song, length).totalSeconds;
}

/**
 * Extended song arrangements (setting `audio.songLength`) and the style
 * switch (setting `audio.musicSwitch`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LENGTH_TARGET,
  VARY_KINDS,
  applyVary,
  renderBar,
  songPlan,
} from "@/lib/world/audio/songs/arrange";
import { SONGS, SONG_BY_ID } from "@/lib/world/audio/songs/catalog";
import { levelStats, renderSong } from "@/lib/world/audio/songs/offline";
import { SongPlayer } from "@/lib/world/audio/songs/player";
import { MusicSystem } from "@/lib/world/audio/music";
import { RecordingTarget } from "@/lib/world/audio/synth";
import { PARTS, type Part } from "@/lib/world/audio/songs/types";

afterEach(() => {
  vi.useRealTimers();
});

describe("extended arrangement plan", () => {
  it("standard is exactly the composed form", () => {
    for (const s of SONGS) {
      const p = songPlan(s, "standard");
      const bars = s.form.reduce((n, name) => n + s.sections[name]!.bars, 0);
      expect(p.bars).toHaveLength(bars);
      expect(p.passes).toEqual([]);
      expect(p.bars.every((b) => !b.vary)).toBe(true);
      expect(songPlan(s)).toBe(p);
    }
  });

  it("long ≈ 9.5–12 min and epic ≈ 20–24 min for every song", () => {
    for (const s of SONGS) {
      const long = songPlan(s, "long").totalSeconds;
      const epic = songPlan(s, "epic").totalSeconds;
      expect(long, s.id).toBeGreaterThanOrEqual(LENGTH_TARGET.long);
      expect(long, s.id).toBeLessThanOrEqual(12 * 60);
      expect(epic, s.id).toBeGreaterThanOrEqual(LENGTH_TARGET.epic);
      expect(epic, s.id).toBeLessThanOrEqual(24 * 60);
    }
  });

  it("keeps the composed opening, uses every variation, never repeats a kind back to back, ends with reprise + outro", () => {
    for (const s of SONGS) {
      const std = songPlan(s, "standard");
      for (const len of ["long", "epic"] as const) {
        const p = songPlan(s, len);
        const hasOutro = s.form[s.form.length - 1] === "outro";
        const outroBars = hasOutro ? s.sections.outro!.bars : 0;
        // Intro + body exactly as composed.
        const body = std.bars.length - outroBars;
        expect(p.bars.slice(0, body).map((b) => [b.section, b.inSec])).toEqual(
          std.bars.slice(0, body).map((b) => [b.section, b.inSec]),
        );
        expect(p.bars.slice(0, body).every((b) => !b.vary)).toBe(true);
        // Every kind at least once; no kind twice in a row.
        const kinds = p.passes.map((x) => x.kind);
        // Epic runs through every kind; long through most of them (long passes fill it sooner).
        if (len === "epic") for (const k of VARY_KINDS) expect(kinds, `${s.id} ${k}`).toContain(k);
        else expect(new Set(kinds).size, `${s.id} long kinds`).toBeGreaterThanOrEqual(5);
        for (let i = 1; i < kinds.length; i++)
          expect(kinds[i], `${s.id} ${len} pass ${i}`).not.toBe(kinds[i - 1]);
        expect(kinds[0]).not.toBe("shift");
        // Ends on the composed outro, not in a variation.
        const last = p.bars[p.bars.length - 1]!;
        if (hasOutro) expect(last.section).toBe("outro");
        expect(last.vary).toBeUndefined();
        // Deterministic: the plan for a song is fixed.
        expect(JSON.stringify(songPlan({ ...s }, len).passes)).toBe(JSON.stringify(p.passes));
      }
    }
  });

  it("every bar of the long and epic forms renders audible, finite events", () => {
    for (const [i, s] of SONGS.entries()) {
      // Long for every song, epic (the same kinds, more passes) for a sample.
      for (const len of i % 12 === 0 ? (["long", "epic"] as const) : (["long"] as const)) {
        const p = songPlan(s, len);
        // Only the generated part (the composed part is covered by songs.test.ts).
        const from = p.passes[0]!.firstBar;
        for (let b = from; b < p.bars.length; b++) {
          const rec: Partial<Record<Part, RecordingTarget>> = {};
          for (const part of PARTS) rec[part] = new RecordingTarget(b + 1);
          renderBar(s, b, rec, { length: len });
          const events = Object.values(rec).flatMap((r) => r.events);
          expect(events.length, `${s.id} ${len} bar ${b} silent`).toBeGreaterThan(0);
          for (const e of events) {
            expect(Number.isFinite(e.gain) && e.gain >= 0 && e.gain < 0.5).toBe(true);
            expect(Number.isFinite(e.at ?? 0) && (e.at ?? 0) >= 0).toBe(true);
            if (e.kind === "tone") expect(Number.isFinite(e.freq) && e.freq > 15).toBe(true);
          }
        }
      }
    }
  }, 120_000);
});

describe("variation passes", () => {
  const song = SONG_BY_ID.get("classic_halo_overture")!;
  const plan = songPlan(song, "long");
  const barOf = (kind: string) => plan.bars.findIndex((b) => b.vary?.kind === kind);
  const render = (bar: number) => {
    const rec = {} as Record<Part, RecordingTarget>;
    for (const p of PARTS) rec[p] = new RecordingTarget(3);
    renderBar(song, bar, rec, { length: "long" });
    return rec;
  };

  it("breakdown keeps only pad, arpeggio, bells and a held bass", () => {
    const r = render(barOf("breakdown"));
    for (const p of ["lead", "counter", "drums"] as const) expect(r[p].events, p).toEqual([]);
    expect(r.bass.events.length).toBeLessThanOrEqual(4);
    expect(r.pad.events.length + r.arp.events.length).toBeGreaterThan(0);
  });

  it("key shift transposes the whole bar by a fourth", () => {
    const b = barOf("shift");
    const slot = plan.bars[b]!;
    const v = applyVary(song, song.sections[slot.section]!, slot.vary);
    expect([5, -7]).toContain(v.transpose);
  });

  it("drums drop out in the first half of a drumless pass and crash back in", () => {
    const first = plan.bars.findIndex((x) => x.vary?.kind === "drumless" && x.vary.half === 0);
    const back = plan.bars.findIndex((x) => x.vary?.kind === "drumless" && x.vary.half === 1);
    if (first < 0 || back < 0) return;
    expect(render(first).drums.events).toEqual([]);
    const sec = song.sections[plan.bars[back]!.section]!;
    if ((sec.drums ?? "none") !== "none")
      expect(render(back).drums.events.length).toBeGreaterThan(0);
  });

  it("renders offline with headroom and changing dynamics", () => {
    const s = SONG_BY_ID.get("electronic_boot_sequence")!;
    const p = songPlan(s, "long");
    // The generated passes (from the first pass on, 150 s).
    const from = p.passes[0]!.firstBar;
    const r = renderSong(s, {
      length: "long",
      sampleRate: 5000,
      hall: false,
      tail: 0,
      fromBar: from,
      maxSeconds: 150,
    });
    expect(r.seconds).toBeCloseTo(Math.min(150, p.totalSeconds - from * p.barSeconds), 0);
    const st = levelStats(r, 4);
    expect(st.peak).toBeLessThan(0.9);
    expect(st.clipped).toBe(0);
    // The long form breathes: its quietest and loudest 4-s windows differ clearly.
    const w = st.windows.filter((x) => x > 0);
    expect(Math.max(...w) / Math.min(...w)).toBeGreaterThan(1.5);
  }, 60_000);
});

// ── Web Audio fakes for the player / music system ──

function fakeParam(): Record<string, unknown> {
  const p: Record<string, unknown> = { value: 0 };
  for (const m of [
    "setValueAtTime",
    "linearRampToValueAtTime",
    "exponentialRampToValueAtTime",
    "setTargetAtTime",
    "cancelScheduledValues",
  ])
    p[m] = () => p;
  return p;
}

function fakeCtx(): { ctx: AudioContext; sources: () => number; advance: (s: number) => void } {
  let sources = 0;
  const node = (kind: string): Record<string, unknown> => {
    if (kind === "Oscillator" || kind === "BufferSource") sources++;
    const n: Record<string, unknown> = {
      connect: (to: unknown) => to,
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
      onended: null,
      type: "",
      buffer: null,
      loop: false,
    };
    for (const p of ["gain", "frequency", "detune", "Q", "pan", "delayTime"]) n[p] = fakeParam();
    return n;
  };
  const ctx: Record<string, unknown> = {
    state: "running",
    currentTime: 0,
    sampleRate: 8000,
    destination: node("destination"),
    createBuffer: (channels: number, len: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(len));
      return { duration: len / 8000, length: len, getChannelData: (c: number) => data[c]! };
    },
  };
  for (const kind of [
    "Gain",
    "Oscillator",
    "BiquadFilter",
    "BufferSource",
    "StereoPanner",
    "Delay",
  ])
    ctx[`create${kind}`] = () => node(kind);
  return {
    ctx: ctx as unknown as AudioContext,
    sources: () => sources,
    advance: (s) => {
      ctx.currentTime = (ctx.currentTime as number) + s;
    },
  };
}

describe("song player", () => {
  it("plays the long arrangement and reports position / pass", () => {
    const f = fakeCtx();
    const song = SONG_BY_ID.get("calm_lantern_hours")!;
    const noise = f.ctx.createBuffer(1, 800, 8000);
    const p = new SongPlayer(f.ctx, f.ctx.createGain(), song, { noise, length: "long" }, 0);
    expect(p.plan.totalSeconds).toBe(songPlan(song, "long").totalSeconds);
    const firstPass = p.plan.passes[0]!;
    f.advance(firstPass.firstBar * p.plan.barSeconds + 0.1);
    expect(p.position(f.ctx.currentTime).pass).toBe(firstPass.kind);
  });

  it("skips bars it fell behind on instead of bursting them", () => {
    const f = fakeCtx();
    const song = SONG_BY_ID.get("calm_lantern_hours")!;
    const noise = f.ctx.createBuffer(1, 800, 8000);
    const p = new SongPlayer(f.ctx, f.ctx.createGain(), song, { noise }, 0);
    p.tick(1);
    const before = f.sources();
    f.advance(60);
    p.tick(f.ctx.currentTime + 0.7);
    expect(p.skippedBars).toBeGreaterThan(10);
    // Only the bars inside the look-ahead were rendered (a bar or two).
    expect(f.sources() - before).toBeLessThan(200);
    expect(p.endTime).toBeGreaterThanOrEqual(f.ctx.currentTime);
  });
});

describe("style switch", () => {
  const state = (style: "calm" | "electronic" | "generative" | "adaptive") => ({
    floor: 0,
    progress: 0,
    tension: 0,
    scene: null,
    style,
  });

  function boot(switchMode: "now" | "afterSong") {
    vi.useFakeTimers();
    const f = fakeCtx();
    const m = new MusicSystem(f.ctx, f.ctx.createGain(), 7);
    m.setPrefs({ switchMode, length: "standard" });
    m.setState(state("calm"));
    m.start();
    const run = (seconds: number) => {
      for (let i = 0; i < seconds / 0.06; i++) {
        f.advance(0.06);
        vi.advanceTimersByTime(60);
      }
    };
    run(0.5);
    return { f, m, run };
  }

  it("now: a new style crossfades to a fitting song within ~1.5 s", () => {
    const { m, run } = boot("now");
    expect(m.nowPlaying()?.song.genre).toBe("calm");
    m.setState(state("electronic"));
    run(0.2);
    expect(m.nowPlaying()?.song.genre).toBe("electronic");
    expect(m.status().pending).toBeNull();
    m.dispose();
  });

  it("now: songs ↔ generative switch right away too", () => {
    const { m, run } = boot("now");
    m.setState(state("generative"));
    run(0.2);
    expect(m.songMode).toBe(false);
    expect(m.nowPlaying()).toBeNull();
    m.setState(state("classic" as "calm"));
    run(0.2);
    expect(m.songMode).toBe(true);
    expect(m.nowPlaying()?.song.genre).toBe("classic");
    m.dispose();
  });

  it("afterSong: the song plays to its end, then the new style takes over", () => {
    const { f, m, run } = boot("afterSong");
    const first = m.nowPlaying()!;
    m.setState(state("electronic"));
    run(1);
    expect(m.nowPlaying()?.song.id).toBe(first.song.id);
    expect(m.status().pending).toBe("electronic");
    expect(m.nowPlaying()?.pending).toBe("electronic");
    // Jump to just before the end of the song (the player skips ahead cleanly).
    f.advance(first.total - m.nowPlaying()!.seconds - 1);
    run(4);
    expect(m.nowPlaying()?.song.genre).toBe("electronic");
    expect(m.status().pending).toBeNull();
    m.dispose();
  });

  it("afterSong: changing back cancels the pending switch; switching mode to now applies it", () => {
    const { m, run } = boot("afterSong");
    m.setState(state("electronic"));
    run(0.2);
    m.setState(state("calm"));
    run(0.2);
    expect(m.status().pending).toBeNull();
    m.setState(state("electronic"));
    run(0.2);
    expect(m.status().pending).toBe("electronic");
    m.setPrefs({ switchMode: "now" });
    run(0.3);
    expect(m.nowPlaying()?.song.genre).toBe("electronic");
    m.dispose();
  });

  it("queueSong plays the next jukebox song after the current one", () => {
    const { f, m, run } = boot("now");
    m.playSong("classic_halo_overture", true);
    run(0.3);
    expect(m.queueSong("calm_lantern_hours", true)).toBe(true);
    expect(m.queuedSong).toBe("calm_lantern_hours");
    const np = m.nowPlaying()!;
    expect(np.song.id).toBe("classic_halo_overture");
    f.advance(np.total - np.seconds - 1);
    run(4);
    expect(m.nowPlaying()?.song.id).toBe("calm_lantern_hours");
    m.dispose();
  });

  it("new songs use the configured length", () => {
    const { m, run } = boot("now");
    m.setPrefs({ length: "epic" });
    m.setState(state("electronic"));
    run(0.2);
    const np = m.nowPlaying()!;
    expect(np.total).toBe(songPlan(np.song, "epic").totalSeconds);
    m.dispose();
  });
});

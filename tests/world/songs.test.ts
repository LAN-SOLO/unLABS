import { describe, expect, it } from "vitest";
import { SONGS, SONGS_BY_GENRE, SONG_BY_ID } from "@/lib/world/audio/songs/catalog";
import { renderBar, songPlan, songSeconds } from "@/lib/world/audio/songs/arrange";
import { INSTRUMENT_IDS } from "@/lib/world/audio/songs/instruments";
import {
  chordMidi,
  degreeMidi,
  lineBars,
  parseChords,
  parseLine,
} from "@/lib/world/audio/songs/notation";
import { levelStats, renderSong } from "@/lib/world/audio/songs/offline";
import { SONG_LOUDNESS } from "@/lib/world/audio/songs/loudness";
import { songGain } from "@/lib/world/audio/songs/level";
import { RecordingTarget } from "@/lib/world/audio/synth";
import {
  ARP_STYLES,
  BASS_STYLES,
  DRUM_STYLES,
  GENRES,
  PAD_STYLES,
  PARTS,
  type SongDef,
} from "@/lib/world/audio/songs/types";

/** Minimum songs per genre once the catalogue is complete. */
const MIN_PER_GENRE = Number(process.env.SONGS_MIN_PER_GENRE ?? 8);

describe("song notation", () => {
  it("parses notes, octaves, accidentals, rests, ties and accents", () => {
    const l = parseLine("1 3:2 5' | b7, -:2 _ #4:0.5 6!");
    expect(l.notes.map((n) => [n.at, n.len, n.degree, n.acc, n.accent])).toEqual([
      [0, 1, 0, 0, false],
      [1, 2, 2, 0, false],
      [3, 1, 11, 0, false],
      [4, 1, -1, -1, false],
      [8, 0.5, 3, 1, false],
      [8.5, 1, 5, 0, true],
    ]);
    expect(l.length).toBe(9.5);
    expect(() => parseLine("1 x 3")).toThrow();
  });

  it("extends notes with ties and checks bars", () => {
    const l = parseLine("5:2 _:2 3");
    expect(l.notes[0]!.len).toBe(4);
    expect(lineBars("1:4 2:4 | 3:8")).toEqual([8, 8]);
  });

  it("parses chords with splits, borrowed roots and extensions", () => {
    const bars = parseChords("1 4-57 b7 . 2s 69", 8);
    expect(bars).toHaveLength(6);
    expect(bars[1]!.map((c) => [c.at, c.len, c.degree, c.seventh])).toEqual([
      [0, 4, 3, false],
      [4, 4, 4, true],
    ]);
    expect(bars[2]![0]!.flat).toBe(true);
    expect(bars[3]![0]!.degree).toBe(bars[2]![0]!.degree);
    expect(bars[4]![0]!.sus).toBe(4);
    expect(bars[5]![0]!.ninth).toBe(true);
    // C major: I = C E G, bVII = Bb D F.
    expect(chordMidi(60, "ionian", bars[0]![0]!)).toEqual([60, 64, 67]);
    expect(chordMidi(60, "ionian", bars[2]![0]!)).toEqual([70, 74, 77]);
    expect(degreeMidi(60, "dorian", 2)).toBe(63);
    expect(degreeMidi(60, "ionian", -1)).toBe(59);
  });
});

function check(song: SongDef): void {
  const plan = songPlan(song);
  const BE = plan.barEighths;
  expect(song.id, "id prefix = genre").toMatch(new RegExp(`^${song.genre}_[a-z0-9_]+$`));
  expect(song.bpm).toBeGreaterThanOrEqual(40);
  expect(song.bpm).toBeLessThanOrEqual(180);
  expect(song.key).toBeGreaterThanOrEqual(55);
  expect(song.key).toBeLessThanOrEqual(79);
  for (const inst of Object.values(song.voices)) {
    if (typeof inst === "string" && !["acoustic", "electro", "chip", "lofi", "hand"].includes(inst))
      expect(INSTRUMENT_IDS, `${song.id}: instrument ${inst}`).toContain(inst);
  }
  const used = new Set(song.form);
  for (const name of Object.keys(song.sections))
    expect(used.has(name), `${song.id}: section ${name} unused`).toBe(true);
  for (const [name, sec] of Object.entries(song.sections)) {
    const where = `${song.id}.${name}`;
    const total = sec.bars * BE;
    const chords = parseChords(sec.chords, BE);
    expect(sec.bars % chords.length, `${where}: chords (${chords.length}) must divide bars`).toBe(
      0,
    );
    for (const k of ["lead", "counter", "bell"] as const) {
      const src = sec[k];
      if (!src) continue;
      const line = parseLine(src);
      // Bars first: a short bar is the usual reason a line does not divide the section.
      if (src.includes("|")) {
        for (const [i, b] of lineBars(src).entries())
          expect(b, `${where}.${k} bar ${i + 1} has ${b} eighths`).toBe(BE);
      }
      expect(total % line.length, `${where}.${k}: length ${line.length} must divide ${total}`).toBe(
        0,
      );
      for (const n of line.notes) {
        const m = degreeMidi(song.key, song.mode, n.degree, n.acc);
        expect(m, `${where}.${k}: note out of range`).toBeGreaterThanOrEqual(45);
        expect(m, `${where}.${k}: note out of range`).toBeLessThanOrEqual(96);
      }
    }
    if (sec.bass) expect(BASS_STYLES).toContain(sec.bass);
    if (sec.arp) expect(ARP_STYLES).toContain(sec.arp);
    if (sec.pad) expect(PAD_STYLES).toContain(sec.pad);
    if (sec.drums) expect(DRUM_STYLES).toContain(sec.drums);
    if (sec.energy !== undefined) {
      expect(sec.energy).toBeGreaterThanOrEqual(0);
      expect(sec.energy).toBeLessThanOrEqual(1);
    }
  }
  const secs = songSeconds(song);
  expect(secs, `${song.id}: ${secs.toFixed(0)} s`).toBeGreaterThanOrEqual(150);
  expect(secs, `${song.id}: ${secs.toFixed(0)} s`).toBeLessThanOrEqual(480);
  // Every bar renders finite, audible events on at least one part.
  for (let b = 0; b < plan.bars.length; b++) {
    const rec: Record<string, RecordingTarget> = {};
    for (const p of PARTS) rec[p] = new RecordingTarget(b + 1);
    renderBar(song, b, rec);
    const events = Object.values(rec).flatMap((r) => r.events);
    expect(events.length, `${song.id} bar ${b} is silent`).toBeGreaterThan(0);
    for (const e of events) {
      expect(Number.isFinite(e.gain) && e.gain >= 0 && e.gain < 0.5).toBe(true);
      expect(Number.isFinite(e.at ?? 0) && (e.at ?? 0) >= 0).toBe(true);
      if (e.kind === "tone") expect(Number.isFinite(e.freq) && e.freq > 15).toBe(true);
    }
  }
}

describe("song catalogue", () => {
  it("has unique ids and titles, and every genre", () => {
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
    expect(new Set(SONGS.map((s) => s.title)).size).toBe(SONGS.length);
    expect(SONG_BY_ID.size).toBe(SONGS.length);
    for (const g of GENRES) for (const s of SONGS_BY_GENRE[g]) expect(s.genre).toBe(g);
  });

  it(`has at least ${MIN_PER_GENRE} songs per genre`, () => {
    for (const g of GENRES)
      expect(SONGS_BY_GENRE[g].length, `genre ${g}`).toBeGreaterThanOrEqual(MIN_PER_GENRE);
  });

  for (const song of SONGS) {
    it(`${song.id} is well-formed`, () => check(song));
  }

  it("every song has a measured loudness (run scripts/audio/loudness.ts)", () => {
    for (const s of SONGS) {
      expect(SONG_LOUDNESS[s.id], `${s.id} missing in loudness.ts`).toBeGreaterThan(0);
      const g = songGain(s);
      expect(g).toBeGreaterThanOrEqual(0.5);
      expect(g).toBeLessThanOrEqual(2.2);
    }
  });

  it("every piece has its own melody (no copied lead lines)", () => {
    const seen = new Map<string, string>();
    for (const s of SONGS)
      for (const [name, sec] of Object.entries(s.sections)) {
        if (!sec.lead || parseLine(sec.lead).notes.length < 6) continue;
        const k = sec.lead.replace(/\s+/g, " ").trim();
        const other = seen.get(k);
        expect(other, `${s.id}.${name} copies ${other}`).toBeUndefined();
        seen.set(k, `${s.id}.${name}`);
      }
  });
});

describe("offline render", () => {
  it("renders the first seconds of a song with headroom and no silence", () => {
    const song = SONGS[0]!;
    const r = renderSong(song, { sampleRate: 8000, maxSeconds: 12, hall: false });
    const st = levelStats(r);
    expect(st.peak).toBeGreaterThan(0.02);
    expect(st.peak).toBeLessThan(0.9);
    expect(st.clipped).toBe(0);
  });
});

describe("adaptive playlist", () => {
  it("maps real room themes and never returns an empty genre list", async () => {
    const { THEME_GENRES, moodGenres, pickSong } = await import("@/lib/world/audio/songs/playlist");
    const { ROOMS } = await import("@/lib/world/content/map");
    for (const t of Object.keys(THEME_GENRES))
      expect(
        ROOMS.some((r) => r.theme === t),
        `theme ${t} used by a room`,
      ).toBe(true);
    for (const r of ROOMS) {
      const g = moodGenres({ floor: r.floor, theme: r.theme ?? null });
      expect(g.length, r.id).toBeGreaterThan(0);
      expect(
        pickSong(g, [], () => 0.5),
        r.id,
      ).toBeDefined();
    }
    expect(moodGenres({ floor: 0, theme: "workshop" })[0]).toBe("rhythmic");
    expect(moodGenres({ floor: 0, theme: "archive", focus: true })).toEqual(["calm", "ambient"]);
    expect(moodGenres({ floor: 3, theme: "forge", danger: 0.8 })).toEqual([
      "rhythmic",
      "electronic",
    ]);
  });

  it("does not repeat one of the last songs while others are left", async () => {
    const { pickSong } = await import("@/lib/world/audio/songs/playlist");
    const recent: string[] = [];
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 30; i++) {
      const s = pickSong(["calm"], recent, rand)!;
      expect(recent.slice(-5)).not.toContain(s.id);
      recent.push(s.id);
    }
  });
});

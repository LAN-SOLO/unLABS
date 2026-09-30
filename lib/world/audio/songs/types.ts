/**
 * Song system — types.
 * ====================
 *
 * A song is data: key, mode, tempo, a set of named sections (chords per
 * bar, melody lines in a compact notation, accompaniment styles) and a
 * form (the order the sections play in). `arrange.ts` turns one bar of a
 * song into synth events; `player.ts` schedules bars on Web Audio.
 * Notation: see `notation.ts`. Catalogue: `catalog/*`.
 */

export const GENRES = ["calm", "rhythmic", "electronic", "chill", "ambient", "classic"] as const;
export type Genre = (typeof GENRES)[number];

/** Mixer channels (the studio mixer shows one fader each). */
export const PARTS = ["lead", "counter", "bell", "arp", "pad", "bass", "drums"] as const;
export type Part = (typeof PARTS)[number];

export const INSTRUMENTS = [
  // melodic leads
  "ocarina",
  "flute",
  "chip",
  "synthlead",
  "brass",
  "strings",
  "choir",
  "whistle",
  // plucked / struck
  "harp",
  "celesta",
  "kalimba",
  "marimba",
  "vibes",
  "epiano",
  "piano",
  "guitar",
  "pluck",
  "musicbox",
  // pads
  "warmpad",
  "glass",
  "organ",
  "stringpad",
  "choirpad",
  "darkpad",
  // bass
  "subbass",
  "synthbass",
  "upright",
  "fmbass",
  "chipbass",
] as const;
export type InstrumentId = (typeof INSTRUMENTS)[number];

export const BASS_STYLES = [
  "none",
  "hold",
  "root",
  "pulse",
  "octave",
  "walk",
  "drive",
  "dub",
  "arp",
  "sync",
  "waltz",
] as const;
export type BassStyle = (typeof BASS_STYLES)[number];

export const ARP_STYLES = [
  "none",
  "up",
  "down",
  "updown",
  "broken",
  "alberti",
  "harp",
  "cascade",
  "pulse",
  "waltz",
  "sparse",
] as const;
export type ArpStyle = (typeof ARP_STYLES)[number];

export const PAD_STYLES = ["none", "hold", "swell", "pulse", "stab", "offbeat"] as const;
export type PadStyle = (typeof PAD_STYLES)[number];

export const DRUM_STYLES = [
  "none",
  "tick",
  "brush",
  "soft",
  "four",
  "break",
  "half",
  "shuffle",
  "march",
  "bossa",
  "waltz",
  "electro",
  "dnb",
  "lofi",
  "tribal",
  "gallop",
] as const;
export type DrumStyle = (typeof DRUM_STYLES)[number];

export const KITS = ["acoustic", "electro", "chip", "lofi", "hand"] as const;
export type Kit = (typeof KITS)[number];

export const MODE_NAMES = [
  "ionian",
  "dorian",
  "phrygian",
  "lydian",
  "mixolydian",
  "aeolian",
  "harmonic",
] as const;
export type ModeName = (typeof MODE_NAMES)[number];

export const SONG_MODES: Readonly<Record<ModeName, readonly number[]>> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};

export interface SectionDef {
  /** Length in bars. */
  bars: number;
  /**
   * One chord token per bar (the list loops to fill `bars`). Token: scale
   * degree 1–7, optional `b` prefix (borrowed major chord a semitone below
   * the degree), suffix `7` (seventh), `9` (add ninth), `s` (sus4), `2`
   * (sus2); `4-5` splits the bar in halves; `.` repeats the last chord.
   */
  chords: string;
  /** Melody lines (notation.ts). A line shorter than the section loops. */
  lead?: string;
  counter?: string;
  bell?: string;
  bass?: BassStyle;
  arp?: ArpStyle;
  pad?: PadStyle;
  drums?: DrumStyle;
  /** 0..1 — loudness, drum layers, auto-harmony. Default 0.5. */
  energy?: number;
  /** Drum fill in the last bar. */
  fill?: boolean;
}

export interface SongVoices {
  lead: InstrumentId;
  /** Lead instrument on every second pass of a section. */
  leadAlt?: InstrumentId;
  counter?: InstrumentId;
  bell?: InstrumentId;
  arp?: InstrumentId;
  pad?: InstrumentId;
  bass?: InstrumentId;
  kit?: Kit;
}

export interface SongDef {
  id: string;
  title: string;
  genre: Genre;
  /** One line about the piece (English, `tr`). */
  blurb: string;
  bpm: number;
  /** Tonic of the melody register (MIDI, 57–72). */
  key: number;
  mode: ModeName;
  /** Eighths per bar: 8 (4/4, default) or 6 (3/4, 6/8). */
  meter?: 8 | 6;
  /** 0..0.33: off-beat eighths are delayed by this fraction of an eighth. */
  swing?: number;
  voices: SongVoices;
  sections: Readonly<Record<string, SectionDef>>;
  form: readonly string[];
  /** Quotes the handshake 3-6-4-8 (lore). */
  handshake?: boolean;
}

/** A note of a parsed melody line (positions in eighths from the line start). */
export interface MelodyNote {
  at: number;
  len: number;
  /** 0-based scale degree relative to the song key (7 = octave up). */
  degree: number;
  /** Chromatic alteration in semitones (-1, 0, +1). */
  acc: number;
  accent: boolean;
}

export interface ParsedLine {
  notes: MelodyNote[];
  /** Total length in eighths. */
  length: number;
}

/** One chord of a bar: position/length in eighths within the bar. */
export interface BarChord {
  at: number;
  len: number;
  /** 0-based root degree. */
  degree: number;
  /** Borrowed major chord on the flattened degree. */
  flat: boolean;
  seventh: boolean;
  ninth: boolean;
  sus: 0 | 2 | 4;
}

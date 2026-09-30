/**
 * Player-visible names for genres, music styles, mixer parts and
 * instruments (settings, now-playing, studio). German: lib/i18n/de/studio.ts.
 */
import { tr } from "@/lib/i18n";
import type { MusicStyle } from "@/lib/world/audio/songs/styles";
import type { Genre, InstrumentId, Kit, Part } from "@/lib/world/audio/songs/types";

export const GENRE_LABEL: Readonly<Record<Genre, string>> = {
  calm: tr("genre::Calm"),
  rhythmic: tr("genre::Rhythmic"),
  electronic: tr("genre::Electronic"),
  chill: tr("genre::Chill"),
  ambient: tr("genre::Ambient"),
  classic: tr("genre::Classical"),
};

export const GENRE_BLURB: Readonly<Record<Genre, string>> = {
  calm: tr("Ocarina, harp and music box — lullabies for safe rooms."),
  rhythmic: tr("Marimba, brass and drums — the workshop's heartbeat."),
  electronic: tr("Chip leads, FM bass and arpeggios — the machines singing."),
  chill: tr("Electric piano, vibes and a lazy swing — kantine evenings."),
  ambient: tr("Glass pads and distant bells — the deep floors dreaming."),
  classic: tr("Piano, strings and choir — minuets, nocturnes, marches."),
};

export const STYLE_LABEL: Readonly<Record<MusicStyle, string>> = {
  adaptive: tr("style::Adaptive (follows the lab)"),
  calm: GENRE_LABEL.calm,
  rhythmic: GENRE_LABEL.rhythmic,
  electronic: GENRE_LABEL.electronic,
  chill: GENRE_LABEL.chill,
  ambient: GENRE_LABEL.ambient,
  classic: GENRE_LABEL.classic,
  generative: tr("style::Generative score (classic)"),
};

export const PART_LABEL: Readonly<Record<Part, string>> = {
  lead: tr("part::Lead"),
  counter: tr("part::Counter"),
  bell: tr("part::Bells"),
  arp: tr("part::Arpeggio"),
  pad: tr("part::Pad"),
  bass: tr("part::Bass"),
  drums: tr("part::Drums"),
};

export const INSTRUMENT_LABEL: Readonly<Record<InstrumentId, string>> = {
  ocarina: tr("inst::Ocarina"),
  flute: tr("inst::Flute"),
  chip: tr("inst::Chip lead"),
  synthlead: tr("inst::Synth lead"),
  brass: tr("inst::Brass"),
  strings: tr("inst::Strings"),
  choir: tr("inst::Choir"),
  whistle: tr("inst::Whistle"),
  harp: tr("inst::Harp"),
  celesta: tr("inst::Celesta"),
  kalimba: tr("inst::Kalimba"),
  marimba: tr("inst::Marimba"),
  vibes: tr("inst::Vibraphone"),
  epiano: tr("inst::Electric piano"),
  piano: tr("inst::Piano"),
  guitar: tr("inst::Nylon guitar"),
  pluck: tr("inst::Synth pluck"),
  musicbox: tr("inst::Music box"),
  warmpad: tr("inst::Warm pad"),
  glass: tr("inst::Glass pad"),
  organ: tr("inst::Organ"),
  stringpad: tr("inst::String pad"),
  choirpad: tr("inst::Choir pad"),
  darkpad: tr("inst::Dark pad"),
  subbass: tr("inst::Sub bass"),
  synthbass: tr("inst::Synth bass"),
  upright: tr("inst::Upright bass"),
  fmbass: tr("inst::FM bass"),
  chipbass: tr("inst::Chip bass"),
};

export const KIT_LABEL: Readonly<Record<Kit, string>> = {
  acoustic: tr("kit::Acoustic"),
  electro: tr("kit::Electro"),
  chip: tr("kit::Chip"),
  lofi: tr("kit::Lo-fi"),
  hand: tr("kit::Hand percussion"),
};

/** "3:07" */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

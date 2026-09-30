/**
 * Music + footstep preferences (settings `audio.musicStyle`, `audio.musicSwitch`,
 * `audio.songLength`, `audio.footsteps`) — dependency-free so settings.ts can
 * import them without pulling in the song catalogue or the synth recipes.
 */
import { GENRES } from "@/lib/world/audio/songs/types";

/** `adaptive` = genres follow the room; a genre = only that; `generative` = the endless ambient score. */
export const MUSIC_STYLES = ["adaptive", ...GENRES, "generative"] as const;
export type MusicStyle = (typeof MUSIC_STYLES)[number];

export function isMusicStyle(v: unknown): v is MusicStyle {
  return typeof v === "string" && (MUSIC_STYLES as readonly string[]).includes(v);
}

/**
 * What a style change does to the song that is playing: `now` crossfades to a
 * fitting song within ~1.5 s, `afterSong` lets the current piece end first.
 */
export const MUSIC_SWITCH_MODES = ["now", "afterSong"] as const;
export type MusicSwitchMode = (typeof MUSIC_SWITCH_MODES)[number];

/**
 * How long a song plays: `standard` = the composed form (≈ 3–5 min), `long` ≈
 * 9.5–11 min and `epic` ≈ 20.5–21.5 min (generated variation passes before the
 * outro, see arrange.ts `songPlan`).
 */
export const SONG_LENGTHS = ["standard", "long", "epic"] as const;
export type SongLength = (typeof SONG_LENGTHS)[number];

/**
 * Footwear sound sets. Mirrors `FOOTWEAR_SOUNDS` in lib/world/content/wardrobe.ts
 * (kept separate so the audio layer does not import the wardrobe content;
 * tests/world/footsteps-sets.test.ts checks they stay equal).
 */
export const FOOTWEAR_SETS = [
  "boot",
  "sneaker",
  "rubber",
  "magnetic",
  "slipper",
  "clog",
  "skate",
] as const;
export type Footwear = (typeof FOOTWEAR_SETS)[number];

/** Setting `audio.footsteps`: `auto` follows Jade's shoes, otherwise one fixed set. */
export const FOOTSTEP_MODES = ["auto", ...FOOTWEAR_SETS] as const;
export type FootstepMode = (typeof FOOTSTEP_MODES)[number];

/** Motion layers of worn pieces (mirrors `MOTION_LAYERS` in content/wardrobe.ts). */
export const MOTION_LAYER_KINDS = [
  "keys",
  "tools",
  "chime",
  "rustle",
  "clank",
  "squeak",
  "hum",
] as const;
export type MotionLayerKind = (typeof MOTION_LAYER_KINDS)[number];

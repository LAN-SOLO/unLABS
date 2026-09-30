/**
 * Adaptive playlist — which genres fit the moment, which song plays next (pure).
 * ==============================================================================
 *
 * The music style setting is `adaptive` (default: genres follow the room,
 * floor and situation), one fixed genre, or `generative` (the original
 * endless ambient score). In adaptive mode a song always plays to its end
 * unless the situation leaves its genre behind for a while (hysteresis in
 * MusicSystem), then the next song comes from the fitting genres, never
 * one of the last few.
 */
import { SONGS, SONGS_BY_GENRE } from "@/lib/world/audio/songs/catalog";
import type { MusicStyle } from "@/lib/world/audio/songs/styles";
import type { Genre, SongDef } from "@/lib/world/audio/songs/types";

export { MUSIC_STYLES, isMusicStyle, type MusicStyle } from "@/lib/world/audio/songs/styles";

export interface MoodInput {
  floor: number;
  /** Room theme of the player's room (RoomTheme). */
  theme?: string | null;
  safe?: boolean;
  focus?: boolean;
  tension?: number;
  danger?: number;
}

/**
 * Genres by room theme (RoomTheme, first = most typical). Hubs and corridors
 * are left to the floor so walking through them does not flip the music.
 */
export const THEME_GENRES: Readonly<Record<string, readonly Genre[]>> = {
  control: ["electronic", "classic", "chill"],
  workshop: ["rhythmic", "chill", "electronic"],
  factory: ["rhythmic", "electronic", "chill"],
  forge: ["rhythmic", "electronic"],
  hangar: ["rhythmic", "electronic", "ambient"],
  storage: ["chill", "rhythmic", "calm"],
  geothermal: ["rhythmic", "ambient"],
  botdepot: ["rhythmic", "electronic", "chill"],
  server: ["electronic", "ambient"],
  power: ["electronic", "rhythmic"],
  cooling: ["electronic", "ambient"],
  reactor: ["electronic", "ambient", "rhythmic"],
  archive: ["classic", "calm", "ambient"],
  observatory: ["classic", "ambient", "calm"],
  office: ["chill", "classic", "calm"],
  lab: ["classic", "electronic", "chill"],
  audio: ["chill", "electronic", "classic"],
  anomaly: ["ambient", "electronic"],
  containment: ["ambient", "electronic"],
  portal: ["ambient", "classic"],
  cryo: ["ambient", "calm"],
  vault: ["ambient", "classic"],
  airlock: ["electronic", "ambient"],
  quarters: ["calm", "chill", "classic"],
  greenhouse: ["calm", "ambient", "chill"],
};

/** Genres by floor when the room says nothing (0 = ground … 5 = deepest). */
export const FLOOR_GENRES: readonly (readonly Genre[])[] = [
  ["classic", "calm", "chill"],
  ["chill", "rhythmic", "classic"],
  ["electronic", "rhythmic", "ambient"],
  ["ambient", "electronic"],
  ["calm", "chill", "classic"],
  ["ambient", "classic"],
];

/** Fitting genres for the moment, most fitting first. */
export function moodGenres(m: MoodInput): Genre[] {
  if (m.focus) return ["calm", "ambient"];
  if ((m.danger ?? 0) > 0.3) return ["rhythmic", "electronic"];
  if (m.safe) return ["calm", "chill", "classic"];
  const byTheme = m.theme ? THEME_GENRES[m.theme] : undefined;
  const base = byTheme ?? FLOOR_GENRES[Math.max(0, Math.min(5, Math.round(m.floor)))]!;
  if ((m.tension ?? 0) > 0.55 && !base.includes("rhythmic")) return [...base, "rhythmic"];
  return [...base];
}

/** Genres a style allows in a mood (a fixed style ignores the mood). */
export function styleGenres(style: MusicStyle, m: MoodInput): Genre[] {
  if (style === "adaptive" || style === "generative") return moodGenres(m);
  return [style];
}

/**
 * Next song from `genres`, avoiding the `recent` ids (most recent last).
 * The first genre is favoured (weight 3/2/1 …); `rand` is 0..1.
 */
export function pickSong(
  genres: readonly Genre[],
  recent: readonly string[],
  rand: () => number,
): SongDef | undefined {
  const pool: { song: SongDef; w: number }[] = [];
  genres.forEach((g, i) => {
    const w = Math.max(1, genres.length - i + 1);
    for (const s of SONGS_BY_GENRE[g]) pool.push({ song: s, w });
  });
  if (!pool.length) return SONGS[0];
  const avoid = new Set(recent.slice(-Math.min(recent.length, Math.max(0, pool.length - 1), 10)));
  const fresh = pool.filter((p) => !avoid.has(p.song.id));
  const list = fresh.length ? fresh : pool;
  const total = list.reduce((n, p) => n + p.w, 0);
  let r = rand() * total;
  for (const p of list) {
    r -= p.w;
    if (r <= 0) return p.song;
  }
  return list[list.length - 1]!.song;
}

/**
 * The song catalogue: every piece of the Lab World soundtrack, by genre.
 * Composing guide: lib/world/audio/songs/COMPOSING.md.
 */
import { AMBIENT } from "@/lib/world/audio/songs/catalog/ambient";
import { CALM } from "@/lib/world/audio/songs/catalog/calm";
import { CHILL } from "@/lib/world/audio/songs/catalog/chill";
import { CLASSIC } from "@/lib/world/audio/songs/catalog/classic";
import { ELECTRONIC } from "@/lib/world/audio/songs/catalog/electronic";
import { RHYTHMIC } from "@/lib/world/audio/songs/catalog/rhythmic";
import type { Genre, SongDef } from "@/lib/world/audio/songs/types";

export const SONGS_BY_GENRE: Readonly<Record<Genre, readonly SongDef[]>> = {
  calm: CALM,
  rhythmic: RHYTHMIC,
  electronic: ELECTRONIC,
  chill: CHILL,
  ambient: AMBIENT,
  classic: CLASSIC,
};

export const SONGS: readonly SongDef[] = [
  ...CALM,
  ...RHYTHMIC,
  ...ELECTRONIC,
  ...CHILL,
  ...AMBIENT,
  ...CLASSIC,
];

export const SONG_BY_ID: ReadonlyMap<string, SongDef> = new Map(SONGS.map((s) => [s.id, s]));

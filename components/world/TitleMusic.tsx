"use client";

import { useEffect } from "react";
import { AudioSystem } from "@/lib/world/audio";
import { registerActiveAudio } from "@/lib/world/audio/active";
import { SONGS_BY_GENRE } from "@/lib/world/audio/songs/catalog";
import type { MusicStyle } from "@/lib/world/audio/songs/styles";
import { effectiveVolume, getSettings, subscribeSettings } from "@/lib/world/settings";

/** The title theme (adaptive style): the heroic overture of the classical set. */
export const TITLE_SONG = "classic_halo_overture";

/** Song the title screen plays for a style (null = the generative intro score). */
export function titleSongFor(style: MusicStyle): string | null {
  if (style === "generative") return null;
  if (style === "adaptive") return TITLE_SONG;
  return SONGS_BY_GENRE[style][0]?.id ?? TITLE_SONG;
}

/**
 * Music on the title screen. Browsers only start audio after a gesture, so
 * the theme begins with the first click / key press on the menu and fades
 * out when the game starts (the game has its own audio system).
 *
 * Style adaptive → the title theme (looped); a fixed genre → that genre's
 * first song; generative → the original intro score. Changing the style in
 * the settings takes effect live: right away (crossfade) or, with
 * "after this song", once the current piece has ended.
 */
export function TitleMusic() {
  useEffect(() => {
    const audio = new AudioSystem();
    const unregister = registerActiveAudio(audio);
    /** Style the title screen is playing (null before the first gesture). */
    let playing: MusicStyle | null = null;
    const apply = () => {
      if (!audio.running) return;
      const a = getSettings().audio;
      const style = a.musicStyle;
      if (style === playing) return;
      const first = playing === null;
      const from = playing;
      playing = style;
      const id = titleSongFor(style);
      const later = !first && a.musicSwitch === "afterSong";
      if (id === null) {
        // Songs → generative intro score.
        audio.setMusicState({ floor: 0, progress: 0, tension: 0.2, scene: "intro" });
        if (later) audio.queueSong(null);
        else audio.releaseJukebox(first ? undefined : 1.5);
        return;
      }
      if (later && from !== "generative") audio.queueSong(id, true);
      else audio.playSong(id, true, first ? 1.2 : 1.5);
    };
    const settingsChanged = () => {
      const a = getSettings().audio;
      const m = Math.max(0.001, a.master);
      audio.setVolumes({
        master: a.mute ? 0 : a.master,
        music: effectiveVolume(a, "music") / m,
        ui: effectiveVolume(a, "ui") / m,
      });
      audio.setMusicPrefs({ switchMode: a.musicSwitch, length: a.songLength });
      apply();
    };
    settingsChanged();
    const off = subscribeSettings(settingsChanged);
    const unbind = audio.bindPageLifecycle({
      onGesture: () => {
        if (playing !== null) return;
        void audio.resume().then(apply);
      },
    });
    return () => {
      off();
      unbind();
      unregister();
      audio.stopMusic(1.2);
      window.setTimeout(() => audio.dispose(), 1400);
    };
  }, []);
  return null;
}

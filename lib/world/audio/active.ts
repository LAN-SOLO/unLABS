/**
 * The audio system that is playing right now (title screen or game), so UI
 * outside the game tree — the settings panel's "now playing / switches after
 * this song" line — can read its music status without prop drilling.
 */
import type { AudioSystem } from "@/lib/world/audio/engine";

let active: AudioSystem | null = null;

/** Register `audio` as the active system; returns the unregister function. */
export function registerActiveAudio(audio: AudioSystem): () => void {
  active = audio;
  return () => {
    if (active === audio) active = null;
  };
}

export function activeAudio(): AudioSystem | null {
  return active;
}

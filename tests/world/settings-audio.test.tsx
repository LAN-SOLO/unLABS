import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/world/menu";
import { titleSongFor, TITLE_SONG } from "@/components/world/TitleMusic";
import { registerActiveAudio } from "@/lib/world/audio/active";
import type { AudioSystem } from "@/lib/world/audio/engine";
import type { MusicStatus } from "@/lib/world/audio/music";
import { SONG_BY_ID } from "@/lib/world/audio/songs/catalog";
import { FOOTSTEP_MODES, MUSIC_SWITCH_MODES, SONG_LENGTHS } from "@/lib/world/audio/songs/styles";
import {
  SETTINGS_KEY,
  _resetSettingsCache,
  defaultSettings,
  getSettings,
  loadSettings,
} from "@/lib/world/settings";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("audio settings", () => {
  it("defaults: switch now, long songs, footsteps by shoes", () => {
    const a = defaultSettings().audio;
    expect(a.musicSwitch).toBe("now");
    expect(a.songLength).toBe("long");
    expect(a.footsteps).toBe("auto");
    expect(MUSIC_SWITCH_MODES).toContain(a.musicSwitch);
    expect(SONG_LENGTHS).toContain(a.songLength);
    expect(FOOTSTEP_MODES).toContain(a.footsteps);
  });

  it("validates stored values against the allowed lists", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        audio: { musicSwitch: "afterSong", songLength: "forever", footsteps: "skate" },
      }),
    );
    const s = loadSettings();
    expect(s.audio.musicSwitch).toBe("afterSong");
    expect(s.audio.songLength).toBe("long");
    expect(s.audio.footsteps).toBe("skate");
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ audio: { musicSwitch: 3, footsteps: "hooves" } }),
    );
    const t = loadSettings();
    expect(t.audio.musicSwitch).toBe("now");
    expect(t.audio.footsteps).toBe("auto");
  });

  it("title music picks a song per style (generative = the intro score)", () => {
    expect(titleSongFor("adaptive")).toBe(TITLE_SONG);
    expect(titleSongFor("generative")).toBeNull();
    const calm = titleSongFor("calm");
    expect(calm && SONG_BY_ID.get(calm)?.genre).toBe("calm");
  });
});

describe("settings panel — audio tab", () => {
  it("offers style switch, song length and footstep sets with hints", () => {
    render(<SettingsPanel initialTab="audio" onClose={vi.fn()} />);
    const sw = screen.getByRole("radiogroup", { name: "Style change" });
    fireEvent.click(within(sw).getByRole("radio", { name: "After the song" }));
    expect(getSettings().audio.musicSwitch).toBe("afterSong");
    expect(screen.getByText(/the current piece always plays to its end/)).toBeInTheDocument();
    fireEvent.click(within(sw).getByRole("radio", { name: "Right away" }));
    expect(
      screen.getByText(/crossfades to a fitting song within about 1.5 seconds/),
    ).toBeInTheDocument();

    const len = screen.getByRole("radiogroup", { name: "Song length" });
    fireEvent.click(within(len).getByRole("radio", { name: "Epic (20+ min)" }));
    expect(getSettings().audio.songLength).toBe("epic");

    const steps = screen.getByRole("radiogroup", { name: "Footsteps" });
    fireEvent.click(within(steps).getByRole("radio", { name: "Clogs" }));
    expect(getSettings().audio.footsteps).toBe("clog");
  });

  it("shows what plays and which style waits for the song to end", () => {
    vi.useFakeTimers();
    const status: MusicStatus = {
      style: "calm",
      pending: "electronic",
      song: SONG_BY_ID.get("calm_lantern_hours")!,
      seconds: 60,
      total: 600,
      prefs: { switchMode: "afterSong", length: "long" },
    };
    const off = registerActiveAudio({
      musicStatus: () => ({ ...status }),
    } as unknown as AudioSystem);
    render(<SettingsPanel initialTab="audio" onClose={vi.fn()} />);
    expect(screen.getByText(/Now playing: Lantern Hours/)).toBeInTheDocument();
    expect(screen.getByText(/Switches after this song \(9:00 left\)/)).toBeInTheDocument();
    status.pending = null;
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByText(/Switches after this song/)).toBeNull();
    off();
  });
});

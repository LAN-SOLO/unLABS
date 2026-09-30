"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getLocale, tr } from "@/lib/i18n";
import {
  CrtButton,
  FilterChip,
  FOCUS_RING,
  INPUT_CLASS,
  Meter,
  Panel,
  SearchField,
  SectionTitle,
  UI,
} from "@/components/world/ui";
import type { AudioSystem } from "@/lib/world/audio/engine";
import type { NowPlaying } from "@/lib/world/audio/music";
import { SFX_NAMES, SURFACES, type SfxName } from "@/lib/world/audio/sfx";
import { FOOTWEAR_LABEL, SURFACE_LABEL, VARY_LABEL } from "@/lib/world/audio/audio-labels";
import { FOOTWEAR_SETS, type Footwear } from "@/lib/world/audio/songs/styles";
import { getSettings } from "@/lib/world/settings";
import { SONGS } from "@/lib/world/audio/songs/catalog";
import { songPlan } from "@/lib/world/audio/songs/arrange";
import type { DrumPiece } from "@/lib/world/audio/songs/drums";
import { INSTRUMENT_IDS } from "@/lib/world/audio/songs/instruments";
import {
  GENRE_BLURB,
  GENRE_LABEL,
  INSTRUMENT_LABEL,
  KIT_LABEL,
  PART_LABEL,
  mmss,
} from "@/lib/world/audio/songs/labels";
import { degreeMidi } from "@/lib/world/audio/songs/notation";
import {
  GENRES,
  KITS,
  PARTS,
  type Genre,
  type InstrumentId,
  type Kit,
  type ModeName,
  type Part,
  type SongDef,
} from "@/lib/world/audio/songs/types";

/**
 * Damien's Sound Studio (Level −2, content/studio.ts) — the mixing desk.
 *
 * - Jukebox: every song of the soundtrack by genre; play, loop, skip, or hand
 *   the music back to the lab (adaptive).
 * - Mixer: a fader and mute per part, swap the lead instrument.
 * - Keys: play any instrument on the computer keyboard; drum pads.
 * - Sequencer: 16 steps, four drum rows and four notes; saved per browser.
 * - Sounds: every effect of the lab, footsteps per floor.
 *
 * Everything plays through the game's audio system (music bus), so the room
 * reverb, volumes and mute apply.
 */

type Tab = "jukebox" | "mixer" | "keys" | "sequencer" | "sounds";

const TABS: readonly [Tab, string][] = [
  ["jukebox", tr("studio::Jukebox")],
  ["mixer", tr("studio::Mixer")],
  ["keys", tr("studio::Keys")],
  ["sequencer", tr("studio::Sequencer")],
  ["sounds", tr("studio::Sounds")],
];

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

const MODE_LABEL: Readonly<Record<ModeName, string>> = {
  ionian: tr("mode::major"),
  dorian: tr("mode::dorian"),
  phrygian: tr("mode::phrygian"),
  lydian: tr("mode::lydian"),
  mixolydian: tr("mode::mixolydian"),
  aeolian: tr("mode::minor"),
  harmonic: tr("mode::harmonic minor"),
};

function keyName(song: SongDef): string {
  return `${NOTE_NAMES[((song.key % 12) + 12) % 12]} ${MODE_LABEL[song.mode]}`;
}

const GENRE_COLOR: Readonly<Record<Genre, string>> = {
  calm: "#9CFFB0",
  rhythmic: "#FFB800",
  electronic: "#00FFFF",
  chill: "#E91E8C",
  ambient: "#8FA8FF",
  classic: "#F4E3B0",
};

export function StudioPanel({
  getAudio,
  onClose,
}: {
  getAudio: () => AudioSystem | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("jukebox");
  const [np, setNp] = useState<NowPlaying | null>(null);

  // Poll the now-playing state (cheap: a few numbers).
  useEffect(() => {
    const read = () => setNp(getAudio()?.nowPlaying() ?? null);
    read();
    const id = window.setInterval(read, 500);
    return () => window.clearInterval(id);
  }, [getAudio]);

  useEffect(() => {
    getAudio()?.play("studio_on", { gain: 0.8 });
  }, [getAudio]);

  return (
    <Panel
      title={tr("Damien's Sound Studio")}
      subtitle={
        np
          ? np.pass
            ? tr("♪ {title} · {genre} · {pos} / {total} · {pass}", {
                title: np.song.title,
                genre: GENRE_LABEL[np.song.genre],
                pos: mmss(np.seconds),
                total: mmss(np.total),
                pass: VARY_LABEL[np.pass],
              })
            : tr("♪ {title} · {genre} · {pos} / {total}", {
                title: np.song.title,
                genre: GENRE_LABEL[np.song.genre],
                pos: mmss(np.seconds),
                total: mmss(np.total),
              })
          : tr("The desk is warm. Nothing is playing.")
      }
      onClose={onClose}
      wide
      accent={UI.cyan}
    >
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label={tr("Studio sections")}>
        {TABS.map(([k, label]) => (
          <FilterChip key={k} active={tab === k} onClick={() => setTab(k)} accent={UI.cyan}>
            {label}
          </FilterChip>
        ))}
      </div>
      <div data-studio-tab={tab}>
        {tab === "jukebox" && <Jukebox getAudio={getAudio} np={np} />}
        {tab === "mixer" && <Mixer getAudio={getAudio} />}
        {tab === "keys" && <Keys getAudio={getAudio} />}
        {tab === "sequencer" && <Sequencer getAudio={getAudio} />}
        {tab === "sounds" && <Sounds getAudio={getAudio} />}
      </div>
    </Panel>
  );
}

// ── Jukebox ──────────────────────────────────────────────────────

function Jukebox({ getAudio, np }: { getAudio: () => AudioSystem | null; np: NowPlaying | null }) {
  const [genre, setGenre] = useState<Genre | "all">("all");
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SONGS.filter(
      (s) =>
        (genre === "all" || s.genre === genre) &&
        (!q || `${s.title} ${s.blurb} ${GENRE_LABEL[s.genre]}`.toLowerCase().includes(q)),
    );
  }, [genre, query]);
  const current = np?.song;
  const play = (id: string) => getAudio()?.playSong(id, np?.loop ?? false);

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <FilterChip
            active={genre === "all"}
            onClick={() => setGenre("all")}
            count={SONGS.length}
            role="button"
          >
            {tr("All")}
          </FilterChip>
          {GENRES.map((g) => (
            <FilterChip
              key={g}
              active={genre === g}
              onClick={() => setGenre(g)}
              accent={GENRE_COLOR[g]}
              count={SONGS.filter((s) => s.genre === g).length}
              role="button"
            >
              {GENRE_LABEL[g]}
            </FilterChip>
          ))}
          <SearchField
            value={query}
            onChange={setQuery}
            label={tr("Search songs")}
            className="ml-auto w-40"
          />
        </div>
        {genre !== "all" && <p className="mb-2 text-[11px] text-white/55">{GENRE_BLURB[genre]}</p>}
        <ul className="max-h-[46vh] space-y-1 overflow-y-auto pr-1" data-studio-songs>
          {list.map((s) => {
            const on = current?.id === s.id;
            const secs = songPlan(s, getSettings().audio.songLength).totalSeconds;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => play(s.id)}
                  aria-current={on ? "true" : undefined}
                  className={`flex w-full items-center gap-2 rounded-sm border px-2 py-1 text-left ${FOCUS_RING} ${
                    on ? "bg-[#00FFFF]/10" : "border-white/10 hover:border-white/30"
                  }`}
                  style={on ? { borderColor: UI.cyan } : undefined}
                >
                  <span
                    className="w-4 text-center"
                    style={{ color: GENRE_COLOR[s.genre] }}
                    aria-hidden
                  >
                    {on ? "▮▮" : "▶"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-[#E8F4FF]">{s.title}</span>
                    <span className="block truncate text-[10px] text-white/45">{s.blurb}</span>
                  </span>
                  <span className="shrink-0 text-right font-mono text-[10px] text-white/50">
                    {GENRE_LABEL[s.genre]}
                    <br />
                    {mmss(secs)} · {s.bpm} bpm
                  </span>
                </button>
              </li>
            );
          })}
          {!list.length && <li className="text-[11px] text-white/45">{tr("No song matches.")}</li>}
        </ul>
      </div>
      <NowPlayingCard getAudio={getAudio} np={np} />
    </div>
  );
}

function NowPlayingCard({
  getAudio,
  np,
}: {
  getAudio: () => AudioSystem | null;
  np: NowPlaying | null;
}) {
  const s = np?.song;
  return (
    <div
      className="rounded-sm border border-[#00FFFF]/30 bg-black/40 p-2 text-[11px]"
      data-studio-now
    >
      <SectionTitle accent={UI.cyan}>{tr("Now playing")}</SectionTitle>
      {s && np ? (
        <>
          <p className="text-[13px] text-[#E8F4FF]">{s.title}</p>
          <p className="mb-1 text-white/55">{s.blurb}</p>
          <Meter
            value={np.seconds}
            max={np.total}
            color={GENRE_COLOR[s.genre]}
            label={tr("Song progress")}
          />
          <p className="mt-0.5 flex justify-between font-mono text-[10px] text-white/50">
            <span>{mmss(np.seconds)}</span>
            <span>{mmss(np.total)}</span>
          </p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
            <dt className="text-white/40">{tr("Genre")}</dt>
            <dd style={{ color: GENRE_COLOR[s.genre] }}>{GENRE_LABEL[s.genre]}</dd>
            <dt className="text-white/40">{tr("Key")}</dt>
            <dd>{keyName(s)}</dd>
            <dt className="text-white/40">{tr("Tempo")}</dt>
            <dd>
              {s.bpm} bpm · {s.meter === 6 ? "3/4" : "4/4"}
            </dd>
            <dt className="text-white/40">{tr("Lead")}</dt>
            <dd>
              {INSTRUMENT_LABEL[s.voices.lead]}
              {s.voices.leadAlt ? ` / ${INSTRUMENT_LABEL[s.voices.leadAlt]}` : ""}
            </dd>
            <dt className="text-white/40">{tr("Form")}</dt>
            <dd className="font-mono">{s.form.join(" · ")}</dd>
          </dl>
          <p className="mt-1 text-[10px] text-white/45">
            {np.jukebox ? tr("Chosen at the desk.") : tr("Chosen by the lab (adaptive).")}
          </p>
        </>
      ) : (
        <p className="text-white/50">{tr("Silence. Pick a song, or let the lab choose.")}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <CrtButton onClick={() => getAudio()?.skipSong()} disabled={!s}>
          {tr("Next ⏭")}
        </CrtButton>
        <CrtButton
          tone={np?.loop ? "amber" : "green"}
          aria-pressed={!!np?.loop}
          onClick={() => getAudio()?.setSongLoop(!np?.loop)}
          disabled={!np?.jukebox}
        >
          {tr("Loop")}
        </CrtButton>
        <CrtButton onClick={() => getAudio()?.releaseJukebox()} disabled={!np?.jukebox}>
          {tr("Back to the lab")}
        </CrtButton>
      </div>
      <p className="mt-2 text-[10px] text-white/40">
        {tr(
          "A song picked here keeps playing when you leave the studio. “Back to the lab” lets the rooms choose again. The music style is also in the settings (Audio).",
        )}
      </p>
    </div>
  );
}

// ── Mixer ────────────────────────────────────────────────────────

const LEADS: readonly InstrumentId[] = [
  "ocarina",
  "flute",
  "whistle",
  "chip",
  "synthlead",
  "brass",
  "strings",
  "choir",
  "harp",
  "celesta",
  "musicbox",
  "kalimba",
  "marimba",
  "vibes",
  "epiano",
  "piano",
  "guitar",
  "pluck",
];

function Mixer({ getAudio }: { getAudio: () => AudioSystem | null }) {
  const [levels, setLevels] = useState<Record<Part, number>>(() => {
    const l = getAudio()?.partLevels();
    const out = {} as Record<Part, number>;
    for (const p of PARTS) out[p] = l?.[p] ?? 1;
    return out;
  });
  const [muted, setMuted] = useState<Partial<Record<Part, boolean>>>({});
  const [lead, setLead] = useState<InstrumentId | "">("");
  const apply = (p: Part, v: number, m = muted[p]) => getAudio()?.setPartLevel(p, m ? 0 : v);

  return (
    <div>
      <SectionTitle accent={UI.cyan} right={tr("1.0 = as composed")}>
        {tr("Channels")}
      </SectionTitle>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" data-studio-mixer>
        {PARTS.map((p) => (
          <div
            key={p}
            className="flex flex-col items-center gap-1 rounded-sm border border-white/10 bg-black/30 p-1.5"
          >
            <span className="text-[10px] tracking-wider text-[#00FFFF] uppercase">
              {PART_LABEL[p]}
            </span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={levels[p]}
              aria-label={tr("{part} level", { part: PART_LABEL[p] })}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLevels((l) => ({ ...l, [p]: v }));
                apply(p, v);
              }}
              className="h-24 w-4 accent-[#00FFFF] [direction:rtl] [writing-mode:vertical-lr]"
            />
            <span className="font-mono text-[10px] text-white/60">{levels[p].toFixed(2)}</span>
            <button
              type="button"
              aria-pressed={!!muted[p]}
              onClick={() => {
                const m = !muted[p];
                setMuted((x) => ({ ...x, [p]: m }));
                apply(p, levels[p], m);
                getAudio()?.play("switch_click", { gain: 0.6 });
              }}
              className={`rounded-sm border px-1.5 text-[10px] ${FOCUS_RING} ${
                muted[p] ? "border-[#FF3333] text-[#FF3333]" : "border-white/20 text-white/60"
              }`}
            >
              {tr("M")}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <label className="flex items-center gap-1">
          <span className="text-white/60">{tr("Lead instrument")}</span>
          <select
            value={lead}
            onChange={(e) => {
              const v = e.target.value as InstrumentId | "";
              setLead(v);
              getAudio()?.setLeadInstrument(v || undefined);
            }}
            className={INPUT_CLASS}
          >
            <option value="">{tr("as composed")}</option>
            {LEADS.map((i) => (
              <option key={i} value={i}>
                {INSTRUMENT_LABEL[i]}
              </option>
            ))}
          </select>
        </label>
        <CrtButton
          onClick={() => {
            const out = {} as Record<Part, number>;
            for (const p of PARTS) {
              out[p] = 1;
              getAudio()?.setPartLevel(p, 1);
            }
            setLevels(out);
            setMuted({});
            setLead("");
            getAudio()?.setLeadInstrument(undefined);
          }}
        >
          {tr("Reset")}
        </CrtButton>
      </div>
      <p className="mt-2 text-[10px] text-white/45">
        {tr(
          "The mix applies to every song until you reset it — in the studio and in the rest of the lab.",
        )}
      </p>
    </div>
  );
}

// ── Keys ─────────────────────────────────────────────────────────

/** Computer keys (physical codes, layout-independent) → semitone above C. */
const KEY_CODES: readonly [string, number][] = [
  ["KeyA", 0],
  ["KeyW", 1],
  ["KeyS", 2],
  ["KeyE", 3],
  ["KeyD", 4],
  ["KeyF", 5],
  ["KeyT", 6],
  ["KeyG", 7],
  ["KeyY", 8],
  ["KeyH", 9],
  ["KeyU", 10],
  ["KeyJ", 11],
  ["KeyK", 12],
  ["KeyO", 13],
  ["KeyL", 14],
  ["KeyP", 15],
];
/** Label of a physical key (German keyboards swap Y and Z). */
function keyLabel(code: string): string {
  const k = code.replace("Key", "").replace("Comma", ",");
  if (getLocale() !== "de") return k;
  return k === "Y" ? "Z" : k === "Z" ? "Y" : k;
}

const PAD_CODES: readonly [string, DrumPiece][] = [
  ["KeyZ", "kick"],
  ["KeyX", "snare"],
  ["KeyC", "hat"],
  ["KeyV", "ohat"],
  ["KeyB", "clap"],
  ["KeyN", "rim"],
  ["KeyM", "tomhi"],
  ["Comma", "tomlo"],
];
const PAD_LABEL: Readonly<Record<DrumPiece, string>> = {
  kick: tr("drum::Kick"),
  snare: tr("drum::Snare"),
  hat: tr("drum::Hi-hat"),
  ohat: tr("drum::Open hat"),
  clap: tr("drum::Clap"),
  rim: tr("drum::Rim"),
  shaker: tr("drum::Shaker"),
  tomhi: tr("drum::Tom high"),
  tomlo: tr("drum::Tom low"),
  brush: tr("drum::Brush"),
  ride: tr("drum::Ride"),
  crash: tr("drum::Crash"),
};

function Keys({ getAudio }: { getAudio: () => AudioSystem | null }) {
  const [inst, setInst] = useState<InstrumentId>("ocarina");
  const [octave, setOctave] = useState(5);
  const [kit, setKit] = useState<Kit>("acoustic");
  const [lit, setLit] = useState<number | null>(null);
  const base = octave * 12;

  const note = useCallback(
    (semi: number) => {
      getAudio()?.studioNote(inst, base + semi, { dur: 0.45, vel: 0.95 });
      setLit(semi);
      window.setTimeout(() => setLit((x) => (x === semi ? null : x)), 180);
    },
    [getAudio, inst, base],
  );
  const pad = useCallback((p: DrumPiece) => getAudio()?.studioDrum(kit, p), [getAudio, kit]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = KEY_CODES.find(([c]) => c === e.code);
    if (k) {
      e.preventDefault();
      e.stopPropagation();
      note(k[1]);
      return;
    }
    const p = PAD_CODES.find(([c]) => c === e.code);
    if (p) {
      e.preventDefault();
      e.stopPropagation();
      pad(p[1]);
      return;
    }
    if (e.code === "ArrowUp" || e.code === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setOctave((o) => Math.max(2, Math.min(7, o + (e.code === "ArrowUp" ? 1 : -1))));
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={onKey}
      className={`rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-[#00FFFF]`}
      aria-label={tr("Keyboard: play with the A–L row, drums with Z–comma, octave with arrow keys")}
      data-studio-keys
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <label className="flex items-center gap-1">
          <span className="text-white/60">{tr("Instrument")}</span>
          <select
            value={inst}
            onChange={(e) => setInst(e.target.value as InstrumentId)}
            className={INPUT_CLASS}
          >
            {INSTRUMENT_IDS.map((i) => (
              <option key={i} value={i}>
                {INSTRUMENT_LABEL[i]}
              </option>
            ))}
          </select>
        </label>
        <span className="flex items-center gap-1">
          <span className="text-white/60">{tr("Octave")}</span>
          <CrtButton onClick={() => setOctave((o) => Math.max(2, o - 1))}>−</CrtButton>
          <span className="w-4 text-center font-mono">{octave - 1}</span>
          <CrtButton onClick={() => setOctave((o) => Math.min(7, o + 1))}>+</CrtButton>
        </span>
      </div>
      <div className="relative flex h-28 select-none" role="group" aria-label={tr("Piano keys")}>
        {KEY_CODES.map(([code, semi]) => {
          const black = [1, 3, 6, 8, 10].includes(semi % 12);
          return (
            <button
              key={code}
              type="button"
              onPointerDown={() => note(semi)}
              aria-label={`${NOTE_NAMES[semi % 12]} (${keyLabel(code)})`}
              className={`flex flex-col items-center justify-end border text-[9px] ${
                black
                  ? "z-10 -mx-2.5 h-[62%] w-5 border-black bg-[#1a1a1a] text-white/60"
                  : "h-full w-8 border-black/60 bg-[#e8f4ff] text-black/60"
              }`}
              style={lit === semi ? { background: black ? UI.cyan : "#9FF7FF" } : undefined}
            >
              {keyLabel(code)}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-white/60">{tr("Drum kit")}</span>
        {KITS.map((k) => (
          <FilterChip
            key={k}
            active={kit === k}
            onClick={() => setKit(k)}
            role="button"
            accent={UI.amber}
          >
            {KIT_LABEL[k]}
          </FilterChip>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-8">
        {PAD_CODES.map(([code, p]) => (
          <button
            key={code}
            type="button"
            onPointerDown={() => pad(p)}
            className={`h-12 rounded-sm border border-[#FFB800]/40 bg-[#FFB800]/10 text-[10px] text-[#FFB800] active:bg-[#FFB800]/30 ${FOCUS_RING}`}
          >
            {PAD_LABEL[p]}
            <span className="block text-white/40">
              {code.replace("Key", "").replace("Comma", ",")}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/45">
        {tr(
          "Click here first, then play: the A–L row are keys, Z–comma the pads, arrow keys change the octave.",
        )}
      </p>
    </div>
  );
}

// ── Sequencer ────────────────────────────────────────────────────

const STEPS = 16;
const SEQ_DRUMS: readonly DrumPiece[] = ["kick", "snare", "hat", "clap"];
/** Melodic rows: scale degrees (0-based) from the top row down. */
const SEQ_DEGREES = [7, 4, 2, 0];
const STORE_KEY = "unlabs.studio.v1";

interface SeqState {
  bpm: number;
  kit: Kit;
  inst: InstrumentId;
  key: number;
  mode: ModeName;
  /** 8 rows × 16 steps: 4 drum rows, then 4 note rows. */
  grid: boolean[][];
}

const emptyGrid = () => Array.from({ length: 8 }, () => Array<boolean>(STEPS).fill(false));

/** The handshake 3-6-4-8 as a starting pattern (and a steady beat under it). */
function handshakePreset(): SeqState {
  const g = emptyGrid();
  for (const i of [0, 4, 8, 12]) g[0]![i] = true;
  for (const i of [4, 12]) g[1]![i] = true;
  for (let i = 0; i < STEPS; i += 2) g[2]![i] = true;
  // Degrees 3-6-4-8 on the rows 1,3 → we only have 8/5/3/1: an approximation.
  g[6]![0] = true;
  g[4]![4] = true;
  g[5]![8] = true;
  g[4]![12] = true;
  return { bpm: 104, kit: "electro", inst: "chip", key: 62, mode: "lydian", grid: g };
}

function loadSeq(): SeqState {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<SeqState>;
      if (
        Array.isArray(v.grid) &&
        v.grid.length === 8 &&
        v.grid.every((r) => Array.isArray(r) && r.length === STEPS) &&
        typeof v.bpm === "number"
      ) {
        return {
          bpm: Math.max(60, Math.min(180, v.bpm)),
          kit: KITS.includes(v.kit as Kit) ? (v.kit as Kit) : "acoustic",
          inst: INSTRUMENT_IDS.includes(v.inst as InstrumentId) ? (v.inst as InstrumentId) : "chip",
          key: typeof v.key === "number" ? Math.max(48, Math.min(76, v.key)) : 62,
          mode: (v.mode as ModeName) in MODE_LABEL ? (v.mode as ModeName) : "dorian",
          grid: v.grid.map((r) => r.map(Boolean)),
        };
      }
    }
  } catch {
    /* storage blocked: start fresh */
  }
  return handshakePreset();
}

function Sequencer({ getAudio }: { getAudio: () => AudioSystem | null }) {
  const [seq, setSeq] = useState<SeqState>(() => loadSeq());
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const seqRef = useRef(seq);
  seqRef.current = seq;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(seq));
    } catch {
      /* ignore */
    }
  }, [seq]);

  // Look-ahead scheduler: every 25 ms, queue the steps due in the next 120 ms.
  useEffect(() => {
    if (!playing) return;
    let next = performance.now() + 60;
    let i = 0;
    const timer = window.setInterval(() => {
      const audio = getAudio();
      const now = performance.now();
      while (next < now + 120) {
        const s = seqRef.current;
        const stepMs = 60000 / s.bpm / 4;
        const delay = Math.max(0, (next - now) / 1000);
        const col = i % STEPS;
        SEQ_DRUMS.forEach((p, r) => {
          if (s.grid[r]![col]) audio?.studioDrum(s.kit, p, { delay, vel: col % 4 === 0 ? 1 : 0.8 });
        });
        SEQ_DEGREES.forEach((d, r) => {
          if (s.grid[4 + r]![col])
            audio?.studioNote(s.inst, degreeMidi(s.key, s.mode, d), {
              delay,
              dur: (stepMs / 1000) * 1.8,
              vel: 0.85,
            });
        });
        const shown = col;
        window.setTimeout(() => setStep(shown), Math.max(0, next - now));
        next += stepMs;
        i++;
      }
    }, 25);
    return () => {
      window.clearInterval(timer);
      setStep(-1);
    };
  }, [playing, getAudio]);

  const toggle = (r: number, c: number) =>
    setSeq((s) => ({
      ...s,
      grid: s.grid.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? !x : x)) : row)),
    }));

  const rowLabel = (r: number) =>
    r < 4
      ? PAD_LABEL[SEQ_DRUMS[r]!]
      : `${NOTE_NAMES[degreeMidi(seq.key, seq.mode, SEQ_DEGREES[r - 4]!) % 12]}`;

  return (
    <div data-studio-sequencer>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <CrtButton
          tone={playing ? "amber" : "green"}
          onClick={() => {
            setPlaying((p) => !p);
            getAudio()?.play(playing ? "tape_stop" : "record_start", { gain: 0.6 });
          }}
        >
          {playing ? tr("Stop ■") : tr("Play ▶")}
        </CrtButton>
        <label className="flex items-center gap-1">
          <span className="text-white/60">{tr("Tempo")}</span>
          <input
            type="range"
            min={60}
            max={180}
            step={1}
            value={seq.bpm}
            onChange={(e) => setSeq((s) => ({ ...s, bpm: Number(e.target.value) }))}
            aria-label={tr("Tempo")}
            className="accent-[#00FFFF]"
          />
          <span className="w-14 font-mono">{seq.bpm} bpm</span>
        </label>
        <select
          value={seq.inst}
          onChange={(e) => setSeq((s) => ({ ...s, inst: e.target.value as InstrumentId }))}
          aria-label={tr("Instrument")}
          className={INPUT_CLASS}
        >
          {INSTRUMENT_IDS.map((i) => (
            <option key={i} value={i}>
              {INSTRUMENT_LABEL[i]}
            </option>
          ))}
        </select>
        <select
          value={seq.kit}
          onChange={(e) => setSeq((s) => ({ ...s, kit: e.target.value as Kit }))}
          aria-label={tr("Drum kit")}
          className={INPUT_CLASS}
        >
          {KITS.map((k) => (
            <option key={k} value={k}>
              {KIT_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          value={seq.mode}
          onChange={(e) => setSeq((s) => ({ ...s, mode: e.target.value as ModeName }))}
          aria-label={tr("Scale")}
          className={INPUT_CLASS}
        >
          {(Object.keys(MODE_LABEL) as ModeName[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
        <CrtButton onClick={() => setSeq((s) => ({ ...s, grid: emptyGrid() }))}>
          {tr("Clear")}
        </CrtButton>
        <CrtButton onClick={() => setSeq(handshakePreset())}>{tr("Handshake")}</CrtButton>
      </div>
      <div className="overflow-x-auto">
        <table
          className="border-separate border-spacing-0.5 text-[10px]"
          aria-label={tr("Step grid")}
        >
          <tbody>
            {seq.grid.map((row, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  className="pr-2 text-right font-normal whitespace-nowrap"
                  style={{ color: r < 4 ? UI.amber : UI.cyan }}
                >
                  {rowLabel(r)}
                </th>
                {row.map((on, c) => (
                  <td key={c}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={tr("{row}, step {n}", { row: rowLabel(r), n: c + 1 })}
                      onClick={() => toggle(r, c)}
                      className={`block h-5 w-5 rounded-[2px] border ${FOCUS_RING} ${
                        c % 4 === 0 ? "border-white/30" : "border-white/10"
                      }`}
                      style={{
                        background: on
                          ? r < 4
                            ? UI.amber
                            : UI.cyan
                          : step === c
                            ? "#ffffff22"
                            : "#000000",
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-white/45">
        {tr(
          "The pattern is saved on this computer. Four drum rows, four notes of the chosen scale.",
        )}
      </p>
    </div>
  );
}

// ── Sounds ───────────────────────────────────────────────────────

const SFX_GROUPS: readonly [string, readonly SfxName[]][] = [
  [
    tr("sfxgroup::Rewards & discovery"),
    [
      "pickup",
      "item_rare",
      "insight",
      "blueprint",
      "puzzle_solved",
      "secret",
      "achievement",
      "prototype",
    ],
  ],
  [
    tr("sfxgroup::Devices & power"),
    [
      "device_on",
      "device_off",
      "build_stage",
      "power_up_cascade",
      "brownout",
      "brownout_crackle",
      "hum_surge",
      "scan_sweep",
    ],
  ],
  [
    tr("sfxgroup::Doors & elevator"),
    [
      "door_open",
      "door_slide",
      "door_close",
      "door_hiss",
      "door_locked",
      "gate_rattle",
      "elevator_start",
      "elevator_stop",
      "elevator_cable",
    ],
  ],
  [
    tr("sfxgroup::Interface"),
    [
      "ui_click",
      "ui_hover",
      "ui_open",
      "ui_close",
      "toast",
      "hint_pop",
      "keypad_beep",
      "fail_buzz",
      "puzzle_open",
      "switch_click",
    ],
  ],
  [
    tr("sfxgroup::Lab life"),
    [
      "coffee_brew",
      "mug_clink",
      "typing",
      "page_turn",
      "sit",
      "chair_creak",
      "radio_tune",
      "tape_play",
      "steam_hiss",
      "drip",
      "lamp_buzz",
      "spark_crackle",
      "rumble",
      "pa_chime",
    ],
  ],
  [
    tr("sfxgroup::Anomalies & machines"),
    [
      "rift",
      "teleport",
      "anomaly_zap",
      "echo_whisper",
      "drone",
      "drone_fly",
      "alarm",
      "explosion",
      "handshake_tone",
      "combine",
    ],
  ],
  [tr("sfxgroup::Studio"), ["studio_on", "tape_stop", "record_start"]],
  [tr("sfxgroup::Replicator"), ["sew_rattle", "replicator_ping"]],
];

/** Footstep preview: a short walk (6 steps, a turn, a stop) with one footwear set. */
function previewWalk(
  a: AudioSystem | null,
  footwear: Footwear,
  surface: (typeof SURFACES)[number],
) {
  if (!a) return;
  const interval = 0.3;
  for (let i = 0; i < 6; i++) {
    window.setTimeout(
      () => {
        a.step({
          surface,
          footwear,
          foot: i % 2 === 0 ? 0 : 1,
          pace: i < 3 ? 1 : 1.35,
          kind: i === 4 ? "scuff" : "step",
          interval,
          index: i,
        });
        if (i === 4) a.step({ surface, footwear, foot: 0, pace: 1.35, interval, index: i });
      },
      i * interval * 1000,
    );
  }
  window.setTimeout(
    () => a.step({ surface, footwear, foot: 1, kind: "stop", interval, index: 6 }),
    6 * interval * 1000 + 120,
  );
}

function Sounds({ getAudio }: { getAudio: () => AudioSystem | null }) {
  const [footwear, setFootwear] = useState<Footwear>("boot");
  const listed = new Set(SFX_GROUPS.flatMap(([, n]) => n));
  const rest = SFX_NAMES.filter((n) => n !== "footstep" && !listed.has(n));
  const groups: [string, readonly SfxName[]][] = rest.length
    ? [...SFX_GROUPS, [tr("sfxgroup::More"), rest]]
    : [...SFX_GROUPS];
  return (
    <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1" data-studio-sounds>
      <div>
        <SectionTitle accent={UI.cyan}>{tr("sfxgroup::Footsteps")}</SectionTitle>
        <div
          className="mb-1 flex flex-wrap gap-1"
          role="group"
          aria-label={tr("Footwear")}
          data-studio-footwear
        >
          {FOOTWEAR_SETS.map((f) => (
            <FilterChip
              key={f}
              role="button"
              active={footwear === f}
              onClick={() => setFootwear(f)}
            >
              {FOOTWEAR_LABEL[f]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {SURFACES.map((s) => (
            <CrtButton key={s} onClick={() => previewWalk(getAudio(), footwear, s)}>
              {SURFACE_LABEL[s]}
            </CrtButton>
          ))}
        </div>
      </div>
      {groups.map(([label, names]) => (
        <div key={label}>
          <SectionTitle accent={UI.cyan}>{label}</SectionTitle>
          <div className="flex flex-wrap gap-1">
            {names.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => getAudio()?.play(n)}
                className={`rounded-sm border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/75 hover:border-[#00FFFF]/60 hover:text-[#00FFFF] ${FOCUS_RING}`}
              >
                ▶ {n}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

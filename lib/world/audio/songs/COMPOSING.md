# Composing for the Lab World soundtrack

The soundtrack is **data**: every piece is a `SongDef` in `catalog/<genre>.ts`.
The arranger (`arrange.ts`) plays it with synthesised instruments
(`instruments.ts`, `drums.ts`); the game and the studio schedule it bar by bar
(`player.ts`). Nothing is sampled — every note is written here.

Sound identity: **"Zelda, but technical."** Memorable, singable melodies over
modal harmony (ocarina, harp, celesta, music box, strings) meeting the lab's
machinery (chip squares, FM bass, filtered synth plucks, electro drums).

## A song

```ts
{
  id: "calm_lantern_hours",          // `<genre>_<snake_case>`, unique
  title: tr("song::Lantern Hours"),  // English, prefixed `song::`, unique
  genre: "calm",
  blurb: tr("An ocarina lullaby over a harp; the lab breathes out."),
  bpm: 76,
  key: 74,              // tonic of the MELODY register, MIDI 55–79 (60 = C4, 74 = D5)
  mode: "ionian",       // ionian dorian phrygian lydian mixolydian aeolian harmonic
  meter: 6,             // eighths per bar: 8 = 4/4 (default), 6 = 3/4 or 6/8
  swing: 0.2,           // optional, 0–0.33 (delays off-beat eighths)
  handshake: true,      // optional: quotes the lab's handshake 3-6-4-8 on a bell (lore)
  voices: { lead, leadAlt?, counter?, bell?, arp?, pad?, bass?, kit? },
  sections: { intro: {...}, A: {...}, B: {...}, ... },
  form: ["intro", "A", "A", "B", "A", "C", "B", "A", "outro"],
}
```

The accompaniment (pad, bass, arp, bell sparkles) always sits in a fixed
register derived from the key's pitch class. `key` only moves the melody, so
an ocarina can sing at D5 (`key: 74`) while the bass stays warm.

### Sections

```ts
A: {
  bars: 8,
  chords: "1 4 6 5 1 4 5 1",          // one token per bar, loops to fill `bars`
  lead: "5:2 3 5:3 | 6:2 5 4:3 | …",  // melody (see notation), loops if shorter
  counter: "…",                       // optional second melody (counter instrument)
  bell: "…",                          // optional bell line
  arp: "harp",       // none up down updown broken alberti harp cascade pulse waltz sparse
  pad: "hold",       // none hold swell pulse stab offbeat
  bass: "waltz",     // none hold root pulse octave walk drive dub arp sync waltz
  drums: "brush",    // none tick brush soft four break half shuffle march bossa waltz
                     // electro dnb lofi tribal gallop
  energy: 0.45,      // 0–1: loudness, drum layers, auto-harmony (≥ 0.55), crash (≥ 0.6)
  fill: true,        // drum fill in the last bar (default: when energy ≥ 0.6)
}
```

**Chord tokens:** scale degree `1`–`7` (diatonic triad of the mode), suffix `7`
(seventh), `9` (add nine), `s` (sus4), `2` (sus2); prefix `b` = a major chord a semitone
below that degree of the song's mode (in major: `b7` = ♭VII, `b6` = ♭VI, `b3` = ♭III, `b4` = V of vi;
in aeolian / harmonic: `b6` = V, `b2` = ♭II Neapolitan); `4-5` splits the bar;
`.` repeats the previous chord. The number of tokens must divide `bars`.

### Melody notation (eighth-note grid)

| token     | meaning                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------- |
| `5`       | scale degree 5, one eighth                                                                         |
| `5:3`     | three eighths (`:2` quarter, `:4` half, `:8` whole in 4/4, `:0.5` sixteenth, `:1.5` dotted eighth) |
| `5'` `5,` | octave up / down (`1''` two up)                                                                    |
| `#4` `b7` | chromatic alteration                                                                               |
| `5!`      | accent                                                                                             |
| `-` `-:4` | rest                                                                                               |
| `_` `_:2` | hold the previous note longer (after a rest it is just rest)                                       |
| `\|`      | bar line — optional but recommended; every bar must then add up to 8 (4/4) or 6 (3/4)              |

Degrees are relative to `key` (1 = tonic). Keep lead notes roughly between
`5,` and `3''`; the test rejects notes outside MIDI 45–96. A line's length must
divide the section (`bars × 8` or `bars × 6` eighths) — write whole phrases.

### What the arranger adds by itself (no need to write it)

- Second pass of a section: lead switches to `leadAlt` (if set); later passes
  sometimes rise an octave and long notes get grace notes.
- Sections with `energy ≥ 0.55` get an automatic counter voice a third below
  the lead on repeat passes (needs `voices.counter`) — unless you write `counter`.
- `voices.bell`: three falling chord tones at the end of every 4-bar phrase.
- Drum fills into the next section, crash cymbal entering loud sections, humanised timing/velocity.

## Long and epic arrangements (setting "Song length")

Players choose how long a song plays (`audio.songLength`): `standard` plays the
form exactly as written (3–5 min), `long` (default) runs about 9.5–11 min and
`epic` about 20.5–21.5 min. You still compose only the normal form — the
arranger (`songPlan(song, length)` in `arrange.ts`) builds the long form from it:

1. **Intro + body as composed** (everything up to the final `outro`).
2. **Variation passes** (table below), each one or two sections of the body, in
   a shuffled cycle seeded by the song id — every song has one fixed long form,
   the same in every session; no kind twice in a row, never opening with the
   key shift. After each full cycle of the seven kinds the main theme returns
   once as composed.
3. **Reprise** of the body's last two sections and the composed **outro**.

| pass        | what changes                                                                       |
| ----------- | ---------------------------------------------------------------------------------- |
| `breakdown` | lead, counter and drums rest; pad swells, arpeggio + bells + held bass carry it    |
| `lift`      | the lead an octave up on `leadAlt`, energy +0.12 (more drum layers, auto harmony)  |
| `sparse`    | the tune only every other bar, sparse arpeggio, held bass, drums reduced to a tick |
| `counter`   | the counter voice takes the tune (a written `counter` line moves up into the lead) |
| `drumless`  | first half without drums (held bass), the drums crash back in halfway              |
| `bridge`    | the song's rarest section (its bridge) + another one on `leadAlt`                  |
| `shift`     | key shift up a fourth (down a fifth for high tunes) — coming back feels like home  |

Passes use your sections, so a song with more distinct sections (A, B, C, D)
gets a richer long form. Two-section passes longer than 60 s are cut to one
section (slow songs keep their variety). The session seed only adds the usual
micro-variation. Measured over the catalogue: long = 6–14 passes, epic =
17–42; average level per pass vs. the composed body: breakdown ≈ 67 %, sparse ≈ 66 %,
drumless ≈ 90 %, counter ≈ 90 %, bridge ≈ 88 %, lift ≈ 106 %, key shift ≈ 108 %.

Loudness (`loudness.ts`), the studio and the dev-book previews measure the
standard form; the game and the studio show position / total of the length in use.

## Instruments

**Leads:** `ocarina` (the Zelda voice), `flute`, `whistle`, `chip` (square lead,
technical), `synthlead` (filtered saw), `brass`, `strings`, `choir`.
**Plucked / struck:** `harp`, `celesta`, `musicbox`, `kalimba`, `marimba`, `vibes`,
`epiano`, `piano`, `guitar` (nylon), `pluck` (synth pluck).
**Pads:** `warmpad`, `darkpad`, `glass`, `organ`, `stringpad`, `choirpad` (any plucked
instrument also works as a comping "pad" with `pad: "pulse" | "stab" | "offbeat"`).
**Bass:** `subbass`, `synthbass`, `upright`, `fmbass`, `chipbass`.
**Kits:** `acoustic`, `electro`, `chip`, `lofi`, `hand` (hand percussion / toms).

## Craft rules

1. **Melody first.** Every song needs a real, memorable main theme (the A
   section) and at least two further sections with their own melodies (B, C,
   bridge). Use motifs: state a 2-bar idea, answer it, develop it (sequence,
   inversion, rhythmic variation). Call and response between lead and counter.
2. **Contrast.** A and B differ in register, rhythm or harmony; a quieter
   breakdown (energy 0.2–0.35, drums off, arp sparse) before the last A.
3. **Length:** 200–360 seconds (test bounds: 150–480). At 76 bpm in 3/4 one bar
   is 2.4 s; at 120 bpm in 4/4 one bar is 2 s. Use intros/outros of 2–4 bars.
4. **No copy-paste:** every lead line in the catalogue must be unique (test).
5. **Harmony:** modal colour is welcome (lydian ♯4 shimmer, dorian ♮6, mixolydian ♭7,
   `b6`/`b7` borrowed chords, harmonic minor's leading tone). Match melody notes
   on strong beats to the chord.
6. **Titles** fit the world (an underground lab, `_unOS`, the MCP core, the Halo
   crystal, Damien's absence, Jade's quarters, the kantine, cerulean 490 nm,
   the handshake 3-6-4-8, 2019). English title `tr("song::…")` and blurb
   `tr("…")`; German in `lib/i18n/de/songs-<genre>.ts` (natural German, poetic
   titles may be translated freely; key = exact English string incl. `song::`).

## Checking your work

```bash
# structure, ranges, lengths, unique melodies (MIN 0 while the catalogue grows)
SONGS_MIN_PER_GENRE=0 pnpm vitest run tests/world/songs.test.ts
# German entries for every new string
pnpm vitest run tests/i18n/coverage.test.ts
# extended forms: plan lengths, variation passes, offline headroom
pnpm vitest run tests/world/music-long.test.ts
# render 60 s previews + level stats (peak < 0.6, clip 0 %); add `--length long|epic` for the long form
node_modules/.bin/vite-node --config scripts/audio/vite.config.mjs scripts/audio/render-songs.ts -- --out <dir> --mp3 --seconds 60 <genre-or-id>
# look at it: the lead should be a clear line on top, the low end not smeared
ffmpeg -y -loglevel error -i <dir>/<id>.mp3 -lavfi "showspectrumpic=s=1400x500:legend=1:scale=log:fscale=log" <dir>/<id>.png
```

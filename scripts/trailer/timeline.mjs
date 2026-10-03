// Trailer edits (docs/TRAILERS.md, docs/TRANSMISSIONS.md): shot order and
// lengths (must match blender/shots.py), transitions, music, sound-effect
// cues and the transmission layer (link readout, labels, glitches).
//
// Times: `music.at` = video second the song starts, or { shot, t } relative to
// a shot's start; `from` = song second it starts at; `until` (same forms)
// ends it. Shot cue `t` = seconds into that shot. Transition `in` applies at
// the start of a shot: "cut" | "dissolve" | "black" (fade through black),
// with `dur` seconds of overlap (xfade).
//
// Transmission layer per shot (glitch.mjs): `link` = [from %, to %] or
// { a, b, every, tail, steps }, `label` = bottom-left readout, `glitch` =
// manual cues { t, dur (frames), kind: rgb|tear|noise|drop, amp }, `auto:
// false` = no link-driven glitches. `src` = borrow frames from another
// trailer's shot: { trailer, shot, from (s) } plus `seconds`.

/** 124 BPM: one bar = 4 beats. */
const BAR_124 = (60 / 124) * 4;
/** 58 BPM waltz: one bar = 3 beats. */
const BAR_58 = (60 / 58) * 3;
/** 56 BPM: one bar = 4 beats. */
const BAR_56 = (60 / 56) * 4;

export const TIMELINES = {
  t0: {
    title: "_unLABS — Transmission 00: Signal",
    tx: 0,
    music: [
      {
        song: "electronic_handshake_3648",
        at: 5.0,
        from: 24,
        gain: 1.0,
        fadeIn: 0.2,
        fadeOut: 2.5,
      },
    ],
    shots: [
      {
        id: "s1_handshake",
        seconds: 6.5,
        in: "black",
        dur: 0.4,
        glitch: [
          { t: 0.3, dur: 4, kind: "tear", amp: 0.8 },
          { t: 2.2, dur: 6, kind: "drop", amp: 0.7 },
          { t: 3.9, dur: 6, kind: "drop", amp: 0.8 },
          { t: 4.1, dur: 3, kind: "rgb", amp: 0.9 },
          { t: 5.25, dur: 2, kind: "rgb", amp: 0.5 },
        ],
        sfx: [
          { t: 0.4, name: "typing", gain: 0.45 },
          { t: 1.6, name: "typing", gain: 0.45, v: 1 },
          { t: 2.25, name: "fail_buzz", gain: 0.35 },
          { t: 3.3, name: "typing", gain: 0.45, v: 2 },
          { t: 3.95, name: "fail_buzz", gain: 0.35, v: 1 },
          { t: 5.0, name: "handshake_tone", gain: 0.6 },
        ],
      },
      {
        id: "s2_mcp",
        src: { trailer: "t1", shot: "s3_mcp", from: 4.6 },
        seconds: 1.1,
        in: "cut",
        link: {
          steps: [
            [0, 4],
            [0.5, 38],
          ],
        },
        glitch: [
          { t: 0, dur: 4, kind: "tear", amp: 1 },
          { t: 0.6, dur: 3, kind: "rgb", amp: 0.8 },
        ],
        auto: false,
        sfx: [{ t: 0.0, name: "hum_surge", gain: 0.5 }],
      },
      {
        id: "s2_lab",
        src: { trailer: "t1", shot: "s8_reveal", from: 4.2 },
        seconds: 2.4,
        in: "cut",
        link: {
          steps: [
            [0, 61],
            [0.7, 88],
            [1.5, 100],
          ],
          tail: "STABLE",
        },
        glitch: [
          { t: 0, dur: 3, kind: "rgb", amp: 0.8 },
          { t: 0.65, dur: 4, kind: "tear", amp: 0.6 },
          { t: 2.25, dur: 4, kind: "drop", amp: 0.9 },
        ],
        auto: false,
        sfx: [{ t: 0.1, name: "power_up_cascade", gain: 0.5 }],
      },
      {
        id: "s3_title",
        seconds: 6.0,
        in: "cut",
        glitch: [{ t: 1.55, dur: 3, kind: "rgb", amp: 0.5 }],
        sfx: [
          { t: 0.2, name: "rumble", gain: 0.45 },
          { t: 1.6, name: "insight", gain: 0.45 },
        ],
      },
    ],
  },
  t1: {
    title: "_unLABS — Transmission 01: Still Running",
    tx: 1,
    music: [
      { song: "electronic_boot_sequence", at: 7.0, from: 0, gain: 1.0, fadeIn: 0.4, fadeOut: 3.5 },
    ],
    shots: [
      {
        id: "s1_boot",
        seconds: 7.0,
        in: "black",
        dur: 0.6,
        glitch: [
          { t: 0.45, dur: 4, kind: "tear", amp: 0.8 },
          { t: 1.75, dur: 3, kind: "rgb", amp: 0.7 },
          { t: 2.9, dur: 5, kind: "drop", amp: 0.6 },
          { t: 4.05, dur: 2, kind: "rgb", amp: 0.5 },
        ],
        sfx: [
          { t: 0.5, name: "typing", gain: 0.5 },
          { t: 1.8, name: "typing", gain: 0.5, v: 1 },
          { t: 3.0, name: "typing", gain: 0.5, v: 2 },
          { t: 4.1, name: "typing", gain: 0.5 },
          { t: 4.1, name: "handshake_tone", gain: 0.4 },
          { t: 6.4, name: "mcp_blip", gain: 0.6 },
        ],
      },
      {
        id: "s2_control",
        seconds: 7.74,
        in: "cut",
        link: [12, 27],
        sfx: [
          { t: 1.6, name: "lamp_buzz", gain: 0.5 },
          { t: 3.6, name: "lamp_buzz", gain: 0.4, v: 1 },
          { t: 5.0, name: "power_up_cascade", gain: 0.6 },
        ],
      },
      {
        id: "s3_mcp",
        seconds: 7.74,
        in: "cut",
        link: [31, 44],
        sfx: [
          { t: 0.2, name: "hum_surge", gain: 0.7 },
          { t: 3.5, name: "mcp_blip", gain: 0.5, v: 1 },
        ],
      },
      {
        id: "s4_build",
        seconds: 7.74,
        in: "dissolve",
        dur: 0.5,
        link: [47, 58],
        sfx: [
          { t: 0.6, name: "build_stage", gain: 0.6 },
          { t: 3.4, name: "build_stage", gain: 0.6, v: 1 },
          { t: 6.1, name: "device_on", gain: 0.8 },
        ],
      },
      {
        id: "s5_racks",
        seconds: 5.81,
        in: "cut",
        link: [60, 69],
        sfx: [{ t: 0.1, name: "hum_surge", gain: 0.4, v: 1 }],
      },
      {
        id: "s6_bot",
        seconds: 5.81,
        in: "cut",
        link: [71, 80],
        sfx: [
          { t: 3.0, name: "device_on", gain: 0.7, v: 1 },
          { t: 3.2, name: "handshake_tone", gain: 0.45 },
        ],
      },
      {
        id: "s7_signal",
        seconds: 5.81,
        in: "cut",
        link: [82, 91],
        sfx: [{ t: 1.2, name: "radio_tune", gain: 0.45 }],
      },
      {
        id: "s8_reveal",
        seconds: 7.74,
        in: "dissolve",
        dur: 0.4,
        link: { a: 93, b: 100, every: 1.3, tail: "STABLE" },
        auto: false,
        sfx: [{ t: 0.1, name: "power_up_cascade", gain: 0.7, v: 1 }],
      },
      {
        id: "s9_title",
        seconds: 9.68,
        in: "black",
        dur: 1.0,
        glitch: [
          { t: 0.42, dur: 2, kind: "rgb", amp: 0.4 },
          { t: 8.3, dur: 4, kind: "tear", amp: 0.5 },
        ],
        sfx: [
          { t: 0.4, name: "rumble", gain: 0.5 },
          { t: 3.0, name: "insight", gain: 0.5 },
        ],
      },
    ],
  },
  t2: {
    title: "_unLABS — Transmission 02: Where Is Damien?",
    tx: 2,
    music: [
      { song: "calm_letters_to_damien", at: 0.0, from: 0, gain: 1.0, fadeIn: 1.5, fadeOut: 4.0 },
    ],
    shots: [
      {
        id: "s1_search",
        seconds: BAR_58 * 2,
        in: "black",
        dur: 0.8,
        glitch: [{ t: 3.35, dur: 8, kind: "drop", amp: 0.7 }],
        sfx: [
          { t: 0.5, name: "typing", gain: 0.4 },
          { t: 3.4, name: "radio_tune", gain: 0.35 },
        ],
      },
      {
        id: "s2_doorway",
        seconds: BAR_58 * 3,
        in: "dissolve",
        dur: 0.8,
        link: { a: 100, b: 100, every: 99 },
        sfx: [{ t: 0.4, name: "door_hiss", gain: 0.25 }],
      },
      {
        id: "s3_quarters",
        seconds: BAR_58 * 3,
        in: "dissolve",
        dur: 0.8,
        sfx: [{ t: 2.0, name: "page_turn", gain: 0.3 }],
      },
      {
        id: "s4_telescope",
        seconds: BAR_58 * 3,
        in: "dissolve",
        dur: 0.8,
        sfx: [{ t: 1.0, name: "scan_sweep", gain: 0.25 }],
      },
      {
        id: "s5_morse",
        seconds: BAR_58 * 3,
        in: "dissolve",
        dur: 0.8,
        sfx: [{ t: 1.0, name: "radio_tune", gain: 0.25, v: 1 }],
      },
      {
        id: "s6_corkwall",
        seconds: BAR_58 * 2,
        in: "cut",
        sfx: [{ t: 0.6, name: "note_paper", gain: 0.35 }],
      },
      {
        id: "s7_cctv",
        seconds: BAR_58 * 2,
        in: "cut",
        glitch: [
          { t: 0, dur: 3, kind: "tear", amp: 0.6 },
          { t: 2.9, dur: 4, kind: "tear", amp: 0.8 },
          { t: 3.45, dur: 5, kind: "drop", amp: 0.6 },
        ],
        sfx: [
          { t: 0.0, name: "tape_play", gain: 0.35 },
          { t: 2.95, name: "brownout_crackle", gain: 0.35 },
        ],
      },
      {
        id: "s8_profile",
        seconds: BAR_58 * 2,
        in: "cut",
        glitch: [{ t: BAR_58 * 2 - 0.25, dur: 6, kind: "drop", amp: 0.9 }],
        sfx: [{ t: 1.2, name: "chair_creak", gain: 0.3 }],
      },
      {
        id: "s9_title",
        seconds: 9.31,
        in: "black",
        dur: 1.0,
        glitch: [{ t: 2.35, dur: 2, kind: "rgb", amp: 0.4 }],
        sfx: [
          { t: 0.4, name: "rumble", gain: 0.35 },
          { t: 2.4, name: "insight", gain: 0.45 },
        ],
      },
    ],
  },
  t3: {
    title: "_unLABS — Transmission 03: 847 Metres",
    tx: 3,
    music: [
      {
        song: "ambient_the_shaft_breathes",
        at: 0.0,
        from: 16,
        gain: 1.0,
        fadeIn: 1.0,
        fadeOut: 2.5,
        until: { shot: "s8_cave", t: 1.5 },
      },
      {
        song: "classic_halo_overture",
        at: { shot: "s8_cave", t: 0.0 },
        from: 8,
        gain: 0.95,
        fadeIn: 2.5,
        fadeOut: 4.0,
      },
    ],
    shots: [
      {
        id: "s1_top",
        seconds: BAR_56 * 1.5,
        in: "black",
        dur: 0.8,
        link: [98, 95],
        label: "L+1",
        sfx: [{ t: 0.5, name: "elevator_start", gain: 0.45 }],
      },
      {
        id: "s2_l0",
        seconds: BAR_56 * 1.5,
        in: "cut",
        link: [93, 88],
        label: "L0",
        sfx: [{ t: 0.0, name: "elevator_cable", gain: 0.35 }],
      },
      {
        id: "s3_l1",
        seconds: BAR_56 * 1.5,
        in: "cut",
        link: [86, 79],
        label: "L−1",
        sfx: [{ t: 0.1, name: "hum_surge", gain: 0.35 }],
      },
      {
        id: "s4_l2",
        seconds: BAR_56 * 1.5,
        in: "cut",
        link: [74, 61],
        label: "L−2",
        sfx: [
          { t: 0.3, name: "anomaly_zap", gain: 0.4 },
          { t: 2.5, name: "spark_crackle", gain: 0.3 },
        ],
      },
      {
        id: "s5_l3",
        seconds: BAR_56 * 1.5,
        in: "cut",
        link: [58, 50],
        label: "L−3",
        sfx: [
          { t: 0.2, name: "rumble", gain: 0.45 },
          { t: 2.0, name: "steam_hiss", gain: 0.25 },
        ],
      },
      {
        id: "s6_x9",
        seconds: BAR_56 * 1.5,
        in: "cut",
        link: [47, 40],
        label: "L−4",
        sfx: [{ t: 0.8, name: "echo_whisper", gain: 0.35 }],
      },
      {
        id: "s7_bore",
        seconds: BAR_56 * 1.5,
        in: "cut",
        link: [38, 31],
        label: "L−4",
        sfx: [
          { t: 0.4, name: "drip", gain: 0.4 },
          { t: 2.2, name: "rumble", gain: 0.4, v: 1 },
        ],
      },
      {
        id: "s8_cave",
        seconds: BAR_56 * 2,
        in: "black",
        dur: 0.6,
        // The cave boosts the signal: the link sinks, then jumps to 100 % as the wall wakes.
        link: {
          steps: [
            [0.3, 31],
            [2.6, 17],
            [4.2, 4],
            [5.0, 100],
          ],
        },
        label: "847 M",
        auto: false,
        glitch: [
          { t: 2.6, dur: 3, kind: "tear", amp: 0.6 },
          { t: 4.2, dur: 6, kind: "drop", amp: 0.8 },
          { t: 4.65, dur: 8, kind: "drop", amp: 1 },
        ],
        sfx: [
          { t: 0.5, name: "drip", gain: 0.35, v: 1 },
          { t: 4.9, name: "rift", gain: 0.5 },
          { t: 5.2, name: "insight", gain: 0.35 },
        ],
      },
      {
        id: "s9_title",
        seconds: 10.0,
        in: "black",
        dur: 1.0,
        glitch: [
          { t: 2.55, dur: 3, kind: "rgb", amp: 0.5 },
          { t: 8.6, dur: 5, kind: "tear", amp: 0.6 },
        ],
        sfx: [
          { t: 0.4, name: "rumble", gain: 0.45 },
          { t: 2.6, name: "insight", gain: 0.45 },
        ],
      },
    ],
  },
};

/** Intercepts: 9:16 cut-downs between transmissions (src = trailer frames). */
const card = (tx) => ({
  id: "s9_card",
  seconds: 4.5,
  in: "black",
  dur: 0.5,
  glitch: [{ t: 0.95, dur: 2, kind: "rgb", amp: 0.4 }],
  sfx: [{ t: 1.0, name: "insight", gain: 0.4 }],
  tx,
});
Object.assign(TIMELINES, {
  i1: {
    title: "_unLABS — Intercept 01",
    tx: 1,
    music: [
      { song: "electronic_boot_sequence", at: 0, from: 30, gain: 1.0, fadeIn: 0.3, fadeOut: 2.0 },
    ],
    shots: [
      {
        id: "bot",
        src: { trailer: "t1", shot: "s6_bot", from: 1.4 },
        seconds: 4.4,
        in: "black",
        dur: 0.3,
        link: [64, 77],
        sfx: [
          { t: 1.6, name: "device_on", gain: 0.7, v: 1 },
          { t: 1.8, name: "handshake_tone", gain: 0.45 },
        ],
      },
      {
        id: "synth",
        src: { trailer: "t1", shot: "s7_signal", from: 1.0 },
        seconds: 4.3,
        in: "cut",
        link: [82, 94],
        sfx: [{ t: 0.2, name: "radio_tune", gain: 0.4 }],
      },
      card(1),
    ],
  },
  i2: {
    title: "_unLABS — Intercept 02",
    tx: 2,
    music: [
      { song: "calm_letters_to_damien", at: 0, from: 21, gain: 1.0, fadeIn: 1.0, fadeOut: 2.5 },
    ],
    shots: [
      {
        id: "desk",
        src: { trailer: "t2", shot: "s3_quarters", from: 0.5 },
        seconds: 6.0,
        in: "black",
        dur: 0.6,
        sfx: [{ t: 1.5, name: "page_turn", gain: 0.3 }],
      },
      {
        id: "morse",
        src: { trailer: "t2", shot: "s5_morse", from: 1.0 },
        seconds: 5.0,
        in: "dissolve",
        dur: 0.6,
        glitch: [{ t: 4.7, dur: 4, kind: "drop", amp: 0.6 }],
      },
      card(2),
    ],
  },
  i3: {
    title: "_unLABS — Intercept 03",
    tx: 2,
    music: [
      { song: "ambient_damiens_echo", at: 0, from: 12, gain: 1.0, fadeIn: 0.5, fadeOut: 2.0 },
    ],
    shots: [
      {
        id: "cctv",
        src: { trailer: "t2", shot: "s7_cctv", from: 0 },
        seconds: 6.2,
        in: "black",
        dur: 0.3,
        glitch: [
          { t: 2.9, dur: 4, kind: "tear", amp: 0.8 },
          { t: 3.45, dur: 5, kind: "drop", amp: 0.6 },
          { t: 5.9, dur: 6, kind: "drop", amp: 0.9 },
        ],
        sfx: [
          { t: 0.0, name: "tape_play", gain: 0.35 },
          { t: 2.95, name: "brownout_crackle", gain: 0.35 },
        ],
      },
      card(2),
    ],
  },
  i4: {
    title: "_unLABS — Intercept 04",
    tx: 3,
    music: [
      { song: "ambient_the_shaft_breathes", at: 0, from: 40, gain: 1.0, fadeIn: 0.5, fadeOut: 2.5 },
    ],
    shots: [
      {
        id: "bore",
        src: { trailer: "t3", shot: "s7_bore", from: 1.5 },
        seconds: 4.0,
        in: "black",
        dur: 0.3,
        link: [36, 31],
        label: "L−4",
        sfx: [{ t: 0.4, name: "rumble", gain: 0.4, v: 1 }],
      },
      {
        id: "cave",
        src: { trailer: "t3", shot: "s8_cave", from: 0 },
        seconds: BAR_56 * 2,
        in: "cut",
        link: {
          steps: [
            [0.3, 31],
            [2.6, 17],
            [4.2, 4],
            [5.0, 100],
          ],
        },
        label: "847 M",
        auto: false,
        glitch: [
          { t: 2.6, dur: 3, kind: "tear", amp: 0.6 },
          { t: 4.2, dur: 6, kind: "drop", amp: 0.8 },
          { t: 4.65, dur: 8, kind: "drop", amp: 1 },
        ],
        sfx: [{ t: 4.9, name: "rift", gain: 0.5 }],
      },
      card(3),
    ],
  },
});

export { BAR_124, BAR_56, BAR_58 };

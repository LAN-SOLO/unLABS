import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMBIENCE_KINDS,
  AMBIENCE_LAYERS,
  HUM_CATEGORIES,
  SAFE_ROOM_THEMES,
  ambienceFor,
  humCategory,
  humFrequency,
  humVoice,
  selectHums,
} from "@/lib/world/audio/ambience";
import { AudioSystem } from "@/lib/world/audio/engine";
import { FootstepClock } from "@/lib/world/audio/footsteps";
import {
  HANDSHAKE_DEGREES,
  MUSIC_SCENES,
  chordNotes,
  layerLevels,
  phrasePlan,
  scaleNote,
  themeFor,
  voiceChord,
} from "@/lib/world/audio/music";
import { SFX, SFX_NAMES, SURFACES, surfaceForTheme } from "@/lib/world/audio/sfx";
import { RecordingTarget, spatialize } from "@/lib/world/audio/synth";
import {
  VOICES,
  VOICE_IDS,
  renderSpeech,
  speakerPitch,
  speechPlan,
  voiceFor,
} from "@/lib/world/audio/voice";
import { ROOMS } from "@/lib/world/content/map";

// ── A tiny fake Web Audio graph (enough to exercise our node code) ──

interface FakeCounters {
  created: Record<string, number>;
  started: number;
}

function fakeParam(): Record<string, unknown> {
  const p: Record<string, unknown> = { value: 0 };
  for (const m of [
    "setValueAtTime",
    "linearRampToValueAtTime",
    "exponentialRampToValueAtTime",
    "setTargetAtTime",
    "cancelScheduledValues",
  ]) {
    p[m] = () => p;
  }
  return p;
}

function fakeNode(kind: string, counters: FakeCounters): Record<string, unknown> {
  counters.created[kind] = (counters.created[kind] ?? 0) + 1;
  const node: Record<string, unknown> = {
    connect: (n: unknown) => n,
    disconnect: () => undefined,
    start: () => {
      counters.started++;
    },
    stop: () => undefined,
    onended: null,
    type: "",
    buffer: null,
    loop: false,
  };
  for (const p of [
    "gain",
    "frequency",
    "detune",
    "Q",
    "pan",
    "delayTime",
    "threshold",
    "knee",
    "ratio",
  ]) {
    node[p] = fakeParam();
  }
  return node;
}

function fakeContext(counters: FakeCounters): AudioContext {
  const ctx: Record<string, unknown> = {
    state: "suspended",
    currentTime: 0,
    sampleRate: 8000,
    destination: fakeNode("destination", counters),
    resume: async () => {
      ctx.state = "running";
    },
    suspend: async () => {
      ctx.state = "suspended";
    },
    close: async () => {
      ctx.state = "closed";
    },
    createBuffer: (_c: number, len: number) => {
      const data = new Float32Array(len);
      return { duration: len / 8000, getChannelData: () => data };
    },
  };
  for (const kind of [
    "Gain",
    "Oscillator",
    "BiquadFilter",
    "BufferSource",
    "StereoPanner",
    "Delay",
    "DynamicsCompressor",
  ]) {
    ctx[`create${kind}`] = () => fakeNode(kind, counters);
  }
  return ctx as unknown as AudioContext;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AudioSystem without Web Audio", () => {
  it("loads and every call is a silent no-op", async () => {
    // jsdom has no AudioContext.
    expect((globalThis as { AudioContext?: unknown }).AudioContext).toBeUndefined();
    const audio = new AudioSystem();
    expect(audio.available).toBe(false);
    await audio.resume();
    expect(audio.running).toBe(false);
    audio.setVolumes({ master: 0.3, music: 2, sfx: Number.NaN });
    expect(audio.getVolumes().master).toBe(0.3);
    expect(audio.getVolumes().music).toBe(1);
    audio.setListener([10, 10], 0.5);
    for (const name of SFX_NAMES) audio.play(name, { pos: [12, 10] });
    audio.setAmbience("server", true);
    audio.setDeviceHums([{ id: "UEC-001", x: 10, z: 10, powered: true }], [10, 10]);
    audio.setMusicState({ floor: 1, progress: 0.4, tension: 0.2, scene: null });
    // speak still reports a duration for subtitle timing.
    expect(audio.speak("Energy Core online.", "mcp")).toBeGreaterThan(0.3);
    expect(audio.speaking).toBe(false);
    audio.stopSpeech();
    audio.stopMusic();
    audio.dispose();
    audio.dispose();
  });

  it("stays silent when the context factory fails", async () => {
    const audio = new AudioSystem({
      createContext: () => {
        throw new Error("blocked");
      },
    });
    await expect(audio.resume().catch(() => "threw")).resolves.not.toBe("threw");
  });
});

describe("AudioSystem with a fake context", () => {
  it("builds buses on resume and applies deferred ambience + music", async () => {
    vi.useFakeTimers();
    const counters: FakeCounters = { created: {}, started: 0 };
    const audio = new AudioSystem({ createContext: () => fakeContext(counters) });
    audio.setAmbience("geothermal", true);
    audio.setMusicState({ floor: 1, progress: 0.2, tension: 0 });
    expect(counters.started).toBe(0);
    await audio.resume();
    expect(audio.running).toBe(true);
    expect(counters.created.Gain ?? 0).toBeGreaterThanOrEqual(6);
    const beforePlay = counters.started;
    for (const name of SFX_NAMES) audio.play(name);
    for (const surface of SURFACES) audio.play("footstep", { surface, pos: [3, 4], pitch: 1.1 });
    expect(counters.started).toBeGreaterThan(beforePlay);
    audio.speak("Kontakt hergestellt.", "halo");
    audio.setDeviceHums(
      [
        { id: "A", x: 0, z: 0, powered: true },
        { id: "B", x: 100, z: 100, powered: true },
      ],
      [0, 0],
    );
    audio.setAmbience("anomaly", false);
    vi.advanceTimersByTime(3000);
    audio.setMusicState({ floor: 3, progress: 1, tension: 0, scene: "ending_halo" });
    vi.advanceTimersByTime(500);
    audio.dispose();
  });

  it("caps simultaneous voices", async () => {
    const counters: FakeCounters = { created: {}, started: 0 };
    const audio = new AudioSystem({ createContext: () => fakeContext(counters), voiceLimit: 4 });
    await audio.resume();
    audio.stopMusic();
    const base = counters.started;
    for (let i = 0; i < 20; i++) audio.play("explosion");
    expect(counters.started - base).toBeLessThanOrEqual(4 + 2);
    audio.dispose();
  });
});

describe("sfx recipes", () => {
  it("every effect produces finite, audible, short events", () => {
    for (const name of SFX_NAMES) {
      const rec = new RecordingTarget(7);
      SFX[name](rec, { surface: "grate" });
      expect(rec.events.length, name).toBeGreaterThan(0);
      for (const e of rec.events) {
        expect(Number.isFinite(e.freq) && e.freq > 0, name).toBe(true);
        expect(e.gain > 0 && e.gain <= 1, name).toBe(true);
        expect(e.dur > 0, name).toBe(true);
      }
      expect(rec.duration(), name).toBeLessThan(4);
    }
  });

  it("footsteps differ by surface", () => {
    const sigs = SURFACES.map((surface) => {
      const rec = new RecordingTarget(1);
      SFX.footstep(rec, { surface });
      return JSON.stringify(rec.events.map((e) => [e.kind, Math.round(e.freq / 100)]));
    });
    expect(new Set(sigs).size).toBe(SURFACES.length);
  });

  it("maps every room theme to a surface and ambience", () => {
    for (const r of ROOMS) {
      expect(SURFACES).toContain(surfaceForTheme(r.theme));
      for (const powered of [true, false]) {
        const kinds = ambienceFor(r.theme, powered);
        expect(kinds.length, `${r.id} ${powered}`).toBeGreaterThan(0);
        for (const k of kinds) expect(AMBIENCE_KINDS).toContain(k);
      }
    }
    expect(ambienceFor("geothermal", false)).toContain("geothermal_rumble");
    expect(ambienceFor("server", true)).toContain("server_fans");
    expect(ambienceFor("reactor", true)).toContain("reactor_thrum");
    expect(ambienceFor("control", false)).toEqual(["room_tone"]);
    for (const k of AMBIENCE_KINDS) expect(AMBIENCE_LAYERS[k].length).toBeGreaterThan(0);
  });
});

describe("spatial audio", () => {
  it("attenuates with distance and pans by camera yaw", () => {
    const near = spatialize([1, 0], [0, 0], 0);
    const far = spatialize([30, 0], [0, 0], 0);
    const gone = spatialize([200, 0], [0, 0], 0);
    expect(near.gain).toBe(1);
    expect(far.gain).toBeGreaterThan(0);
    expect(far.gain).toBeLessThan(near.gain);
    expect(gone.gain).toBe(0);
    // yaw 0 → camera right is +x.
    expect(spatialize([10, 0], [0, 0], 0).pan).toBeGreaterThan(0);
    expect(spatialize([-10, 0], [0, 0], 0).pan).toBeLessThan(0);
  });

  it("selects at most six nearest powered device hums", () => {
    const devs = Array.from({ length: 10 }, (_, i) => ({
      id: `D${i}`,
      x: i * 2,
      z: 0,
      powered: i !== 0,
    }));
    const hums = selectHums(devs, [0, 0]);
    expect(hums.length).toBe(6);
    expect(hums.map((h) => h.id)).not.toContain("D0");
    expect(hums[0]!.gain).toBeGreaterThanOrEqual(hums[5]!.gain);
    expect(selectHums(devs, [0, 0], undefined, 4).length).toBe(4);
    expect(humFrequency("UEC-001")).toBe(humFrequency("UEC-001"));
  });
});

describe("voices", () => {
  it("plans deterministic bleeps with pauses at punctuation", () => {
    const a = speechPlan("Energy Core online. Glückwunsch.", "mcp");
    const b = speechPlan("Energy Core online. Glückwunsch.", "mcp");
    expect(a).toEqual(b);
    expect(a.bleeps.length).toBeGreaterThan(5);
    const plain = speechPlan("abcdef", "mcp").duration;
    const dotted = speechPlan("abc.def", "mcp").duration;
    expect(dotted).toBeGreaterThan(plain);
    // Stage directions are not voiced.
    expect(speechPlan("[SIGNAL STARK]", "damien").bleeps.length).toBe(0);
    for (const v of VOICE_IDS) expect(speechPlan("Hallo Jade", v).duration).toBeGreaterThan(0);
    expect(speechPlan("x".repeat(2000), "bot").bleeps.length).toBeLessThanOrEqual(90);
  });

  it("maps speakers to voices", () => {
    expect(voiceFor("mcp")).toBe("mcp");
    expect(voiceFor("unstables")).toBe("halo");
    expect(voiceFor("l0g1k")).toBe("bot");
  });
});

describe("music theory", () => {
  it("has a theme per floor and per scene, each ending distinct", () => {
    const ids = new Set<string>();
    for (const scene of MUSIC_SCENES)
      ids.add(themeFor({ floor: 0, progress: 0, tension: 0, scene }).id);
    expect(ids.size).toBe(MUSIC_SCENES.length);
    const floors = new Set(
      [0, 1, 2, 3].map((f) => themeFor({ floor: f, progress: 0, tension: 0 }).id),
    );
    expect(floors.size).toBe(4);
  });

  it("builds in-scale seventh chords", () => {
    const th = themeFor({ floor: 0, progress: 0, tension: 0 });
    const chord = chordNotes(th, 0);
    expect(chord).toHaveLength(4);
    expect(chord[0]).toBe(th.root);
    for (const n of chord) expect(th.mode).toContain((((n - th.root) % 12) + 12) % 12);
    expect(scaleNote(th, 7)).toBe(th.root + 12);
  });

  it("intensity layers follow progress and tension", () => {
    const calm = layerLevels({ floor: 1, progress: 0, tension: 0 });
    const late = layerLevels({ floor: 1, progress: 1, tension: 0 });
    const tense = layerLevels({ floor: 1, progress: 0, tension: 1 });
    expect(late.arp).toBeGreaterThan(calm.arp);
    expect(late.shimmer).toBeGreaterThan(calm.shimmer);
    expect(tense.bass).toBeGreaterThan(calm.bass);
    expect(tense.cutoff).toBeGreaterThan(calm.cutoff);
  });
});

describe("footstep clock", () => {
  it("lands alternating feet every stride", () => {
    const clock = new FootstepClock(1);
    const feet: number[] = [];
    for (let i = 0; i < 100; i++) {
      const f = clock.update(0.1);
      if (f !== null) feet.push(f);
    }
    expect(feet.length).toBeGreaterThanOrEqual(9);
    expect(feet.length).toBeLessThanOrEqual(11);
    expect(feet[0]).not.toBe(feet[1]);
    expect(clock.update(0)).toBeNull();
  });
});

// ── Round 4: sound design pass ──

const ROUND4_SFX = [
  "steam_hiss",
  "drip",
  "rumble",
  "hum_surge",
  "lamp_buzz",
  "spark_crackle",
  "pa_chime",
  "door_slide",
  "door_close",
  "elevator_start",
  "elevator_stop",
  "gate_rattle",
  "coffee_brew",
  "radio_tune",
  "page_turn",
  "sit",
  "buff_on",
  "achievement",
  "hint_pop",
  "typewriter_tick",
  "scan_sweep",
  "drone_fly",
] as const;

const NEW_THEMES = ["quarters", "greenhouse", "observatory", "shaft", "library", "kantine"];

function signature(rec: RecordingTarget): string {
  return JSON.stringify(
    rec.events.map((e) => [e.kind, Math.round(e.freq), Math.round((e.at ?? 0) * 100)]),
  );
}

describe("round 4 sfx", () => {
  it("every SFX name has a recipe, and the new names are registered", () => {
    for (const name of SFX_NAMES) expect(typeof SFX[name], name).toBe("function");
    for (const name of ROUND4_SFX) expect(SFX_NAMES).toContain(name);
    expect(new Set(SFX_NAMES).size).toBe(SFX_NAMES.length);
  });

  it("new effects vary between triggers (2-3 variations + jitter)", () => {
    for (const name of ROUND4_SFX) {
      const sigs = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const rec = new RecordingTarget(seed);
        SFX[name](rec, {});
        sigs.add(signature(rec));
      }
      expect(sigs.size, name).toBeGreaterThanOrEqual(2);
    }
  });

  it("typewriter ticks stay very quiet and short", () => {
    const rec = new RecordingTarget(3);
    SFX.typewriter_tick(rec, {});
    for (const e of rec.events) expect(e.gain).toBeLessThanOrEqual(0.05);
    expect(rec.duration()).toBeLessThan(0.1);
  });
});

describe("round 4 voices", () => {
  it("maps PA and per-bot voices", () => {
    expect(voiceFor("pa")).toBe("pa");
    expect(voiceFor("jade")).toBe("jade");
    expect(voiceFor("damien")).toBe("damien");
    expect(voiceFor("halo")).toBe("halo");
    expect(voiceFor("r3tr0")).toBe("bot_gruff");
    expect(voiceFor("b4c0n")).toBe("bot_chirpy");
    expect(voiceFor("f1ndr")).toBe("bot_slow");
    expect(voiceFor("x0r8t")).toBe("bot");
    for (const v of VOICE_IDS) expect(VOICES[v]).toBeDefined();
  });

  it("gives generic bots distinct, stable pitches", () => {
    expect(speakerPitch("mcp")).toBe(1);
    expect(speakerPitch("r3tr0")).toBe(1);
    const pitches = ["x0r8t", "l0g1k", "p1ndr0", "d3c4d3", "w2rek", "k2ldr", "c8br41n"].map(
      speakerPitch,
    );
    expect(new Set(pitches).size).toBeGreaterThan(2);
    for (const p of pitches) expect(p).toBeGreaterThan(0.7);
    expect(speakerPitch("x0r8t")).toBe(speakerPitch("x0r8t"));
  });

  it("renders each voice as a distinct character", () => {
    const line = "Achtung, Testlauf in Sektor drei beginnt.";
    const sigs = new Set<string>();
    for (const v of VOICE_IDS) {
      const plan = speechPlan(line, v);
      const rec = new RecordingTarget(5);
      renderSpeech(rec, plan.bleeps, v);
      expect(rec.events.length, v).toBeGreaterThan(0);
      for (const e of rec.events) {
        expect(Number.isFinite(e.freq) && e.freq > 0, v).toBe(true);
        expect(e.gain > 0 && e.gain <= 1, v).toBe(true);
      }
      sigs.add(
        JSON.stringify(
          rec.events.slice(0, 12).map((e) => [e.kind, e.kind === "tone" ? e.wave : e.filter]),
        ) + plan.bleeps.length,
      );
    }
    expect(sigs.size).toBe(VOICE_IDS.length);
  });

  it("leads PA lines with the chime and echoes them", () => {
    const pa = speechPlan("Durchsage.", "pa");
    const plain = speechPlan("Durchsage.", "bot");
    expect(pa.bleeps[0]!.at).toBeGreaterThanOrEqual(1);
    const rec = new RecordingTarget(1);
    renderSpeech(rec, pa.bleeps, "pa");
    const chime = new RecordingTarget(1);
    SFX.pa_chime(chime, {});
    expect(rec.events.length).toBeGreaterThan(chime.events.length + pa.bleeps.length);
    expect(pa.duration).toBeGreaterThan(plain.duration);
  });

  it("drops some of Damien's syllables (failing signal)", () => {
    const text = "Ich bin noch hier irgendwo zwischen den Frequenzen und warte";
    const damien = speechPlan(text, "damien").bleeps.length;
    const letters = text.replace(/\s/g, "").length;
    expect(damien).toBeLessThan(Math.ceil(letters / VOICES.damien.every));
  });
});

describe("round 4 ambience", () => {
  it("has beds for the new room themes, powered and unpowered", () => {
    expect(ambienceFor("quarters", true)).toEqual(
      expect.arrayContaining(["fridge_hum", "clock_tick"]),
    );
    expect(ambienceFor("quarters", false)).toContain("clock_tick");
    expect(ambienceFor("greenhouse", true)).toEqual(
      expect.arrayContaining(["water_trickle", "greenhouse_air"]),
    );
    expect(ambienceFor("observatory", true)).toEqual(
      expect.arrayContaining(["dome_wind", "dome_servo"]),
    );
    expect(ambienceFor("observatory", false)).not.toContain("dome_servo");
    expect(ambienceFor("shaft", false)).toEqual(
      expect.arrayContaining(["cave_drips", "rock_settle"]),
    );
    expect(ambienceFor("library", true)).toContain("library_tone");
    expect(ambienceFor("kantine", true)).toEqual(
      expect.arrayContaining(["coffee_idle", "fridge_hum"]),
    );
    expect(ambienceFor("somewhere-new", true)).toEqual(["room_tone"]);
    for (const th of NEW_THEMES) {
      for (const powered of [true, false]) {
        const kinds = ambienceFor(th, powered);
        expect(kinds.length, th).toBeGreaterThan(0);
        expect(new Set(kinds).size, th).toBe(kinds.length);
      }
    }
    expect(SAFE_ROOM_THEMES.has("quarters")).toBe(true);
    expect(SAFE_ROOM_THEMES.has("kantine")).toBe(true);
  });

  it("builds and tears down every bed on a fake graph", async () => {
    vi.useFakeTimers();
    const counters: FakeCounters = { created: {}, started: 0 };
    const audio = new AudioSystem({ createContext: () => fakeContext(counters) });
    await audio.resume();
    for (const th of NEW_THEMES) {
      for (const powered of [true, false]) {
        const before = counters.started;
        audio.setAmbience(th, powered);
        // Scheduled layers (ticks, drips, bursts) fire from timers.
        vi.advanceTimersByTime(30_000);
        expect(counters.started, `${th} ${powered}`).toBeGreaterThan(before);
      }
    }
    audio.dispose();
    vi.advanceTimersByTime(30_000);
  });

  it("gives device categories distinct hum timbres", () => {
    expect(humCategory("UEC-001")).toBe("reactor");
    expect(humCategory("MFR-001")).toBe("reactor");
    expect(humCategory("BAT-001")).toBe("generator");
    expect(humCategory("SCA-001")).toBe("server");
    expect(humCategory("QSM-001")).toBe("quantum");
    expect(humCategory("P3D-001")).toBe("machine");
    expect(humCategory("P3D-001", "server")).toBe("server");
    const sigs = HUM_CATEGORIES.map((c) => JSON.stringify(humVoice(c, 55)));
    expect(new Set(sigs).size).toBe(HUM_CATEGORIES.length);
    // Quantum shimmers high, reactors pulse low.
    const q = Math.max(...humVoice("quantum", 55).tones.map((t) => t.freq));
    const r = Math.max(...humVoice("reactor", 55).tones.map((t) => t.freq));
    expect(q).toBeGreaterThan(500);
    expect(r).toBeLessThan(60);
    expect(selectHums([{ id: "UEC-001", x: 0, z: 0, powered: true }], [0, 0])[0]!.category).toBe(
      "reactor",
    );
  });

  it("drives category hums on a fake graph", async () => {
    const counters: FakeCounters = { created: {}, started: 0 };
    const audio = new AudioSystem({ createContext: () => fakeContext(counters) });
    await audio.resume();
    audio.stopMusic();
    const before = counters.created.BufferSource ?? 0;
    audio.setDeviceHums(
      [
        { id: "UEC-001", x: 0, z: 0, powered: true },
        { id: "SCA-001", x: 1, z: 0, powered: true },
        { id: "QSM-001", x: 0, z: 1, powered: true },
        { id: "BAT-001", x: 1, z: 1, powered: true },
      ],
      [0, 0],
    );
    // Server fans use filtered noise.
    expect(counters.created.BufferSource ?? 0).toBeGreaterThan(before);
    audio.setDeviceHums([], [0, 0]);
    audio.dispose();
  });
});

describe("round 4 music", () => {
  it("has themes for every floor and a calm safe mode", () => {
    const ids = new Set(
      [0, 1, 2, 3, 4, 5].map((f) => themeFor({ floor: f, progress: 0, tension: 0 }).id),
    );
    expect(ids.size).toBe(6);
    const safe = themeFor({ floor: 1, progress: 0.5, tension: 1, safe: true });
    expect(safe.id.startsWith("safe")).toBe(true);
    const lv = layerLevels({ floor: 1, progress: 0.5, tension: 1, safe: true });
    const tense = layerLevels({ floor: 1, progress: 0.5, tension: 1 });
    expect(lv.bass).toBe(0);
    expect(lv.cutoff).toBeLessThan(tense.cutoff);
    // Scenes still win over safe mode.
    expect(themeFor({ floor: 0, progress: 0, tension: 0, safe: true, scene: "intro" }).id).toBe(
      "intro",
    );
  });

  it("alternate progressions match the main progression's length", () => {
    for (let f = 0; f <= 5; f++) {
      for (const safe of [false, true]) {
        const th = themeFor({ floor: f, progress: 0, tension: 0, safe });
        for (const alt of th.alternates ?? []) expect(alt.length).toBe(th.progression.length);
      }
    }
  });

  it("phrase plans are deterministic, start plain and vary over an hour", () => {
    const th = themeFor({ floor: 1, progress: 0, tension: 0 });
    expect(phrasePlan(th, 7, 42)).toEqual(phrasePlan(th, 7, 42));
    const first = phrasePlan(th, 0, 42);
    expect(first.progression).toEqual(th.progression);
    expect(first.arpMul).toBe(1);
    // ~32 s per phrase → 110 phrases ≈ one hour.
    const plans = Array.from({ length: 110 }, (_, i) => phrasePlan(th, i, 42));
    const shapes = new Set(
      plans.map((p) => JSON.stringify([p.progression, p.arpMul, p.voicing, p.bassPattern])),
    );
    expect(shapes.size).toBeGreaterThan(15);
    expect(new Set(plans.map((p) => p.progression.join())).size).toBeGreaterThan(2);
    expect(plans.some((p) => p.arpMul === 0)).toBe(true);
    // Different sessions phrase differently.
    const other = Array.from({ length: 20 }, (_, i) => phrasePlan(th, i, 7));
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(plans.slice(0, 20)));
  });

  it("quotes the handshake only once the player knows it, and only subtly", () => {
    const th = themeFor({ floor: 2, progress: 0, tension: 0 });
    const without = Array.from({ length: 60 }, (_, i) => phrasePlan(th, i, 9));
    const withM = Array.from({ length: 60 }, (_, i) => phrasePlan(th, i, 9, { motifs: true }));
    expect(without.some((p) => p.handshake)).toBe(false);
    const count = withM.filter((p) => p.handshake).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(30);
    expect(phrasePlan(th, 3, 9, { motifs: true, scene: "intro" }).handshake).toBe(false);
    expect(HANDSHAKE_DEGREES).toEqual([2, 5, 3, 7]);
  });

  it("revoices chords without losing notes", () => {
    const chord = [50, 53, 57, 60];
    expect(voiceChord(chord, 0)).toEqual(chord);
    expect(voiceChord(chord, 1)).toEqual([53, 57, 60, 62]);
    expect(voiceChord(chord, 2)).toEqual([50, 53, 57, 48]);
  });

  it("plays the music scheduler with motifs and safe mode on a fake graph", async () => {
    vi.useFakeTimers();
    const counters: FakeCounters = { created: {}, started: 0 };
    const audio = new AudioSystem({ createContext: () => fakeContext(counters) });
    await audio.resume();
    audio.setMusicState({ floor: 4, progress: 0.6, tension: 0.5, motifs: true });
    const before = counters.started;
    vi.advanceTimersByTime(2000);
    audio.setMusicState({ floor: 0, progress: 0.6, tension: 0, safe: true, motifs: true });
    vi.advanceTimersByTime(2000);
    expect(counters.started).toBeGreaterThanOrEqual(before);
    audio.dispose();
  });
});

describe("round 4 silent mode", () => {
  it("new features never throw without Web Audio", async () => {
    const audio = new AudioSystem();
    await audio.resume();
    for (const name of ROUND4_SFX) audio.play(name, { pos: [1, 1] });
    for (const th of NEW_THEMES) audio.setAmbience(th, true);
    audio.setDeviceHums([{ id: "QSM-001", x: 0, z: 0, powered: true, category: "quantum" }]);
    audio.setMusicState({ floor: 5, progress: 1, tension: 0, motifs: true, safe: true });
    expect(audio.speak("Achtung. Durchsage.", "pa")).toBeGreaterThan(1);
    expect(audio.speak("Hallo.", "b4c0n")).toBeGreaterThan(0);
    audio.dispose();
  });
});

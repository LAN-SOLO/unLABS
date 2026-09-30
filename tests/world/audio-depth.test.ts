import { afterEach, describe, expect, it, vi } from "vitest";
import { foleyCompanions } from "@/components/world/useLabDirector";
import {
  BROWNOUT_SAG_CENTS,
  HUM_CATEGORIES,
  MAX_DEVICE_HUMS,
  humCategory,
  humTargets,
  humVoice,
  selectHums,
  type DeviceEmitter,
} from "@/lib/world/audio/ambience";
import { deviceEmitters, deviceLoad, type EmitterPower } from "@/lib/world/audio/emitters";
import { AudioSystem } from "@/lib/world/audio/engine";
import {
  STING_KINDS,
  floorDarkness,
  layerLevels,
  masterCutoff,
  scaleNote,
  stingNotes,
  themeFor,
} from "@/lib/world/audio/music";
import { REVERB_SIZES, RoomReverb, impulseSamples, reverbFor } from "@/lib/world/audio/reverb";
import { FOOTSTEP_GAIN, SFX, SFX_NAMES, SURFACES, surfaceForTheme } from "@/lib/world/audio/sfx";
import { RecordingTarget } from "@/lib/world/audio/synth";
import { DEVICES } from "@/lib/world/content/devices";
import { ROOMS, ROOM_BY_ID } from "@/lib/world/content/map";

// ── Fake Web Audio that tracks node lifetimes ──

interface FakeNode {
  kind: string;
  live: boolean;
  stopped: boolean;
  onended: (() => void) | null;
  [k: string]: unknown;
}

interface Fake {
  ctx: AudioContext;
  nodes: FakeNode[];
  count: (kind: string) => number;
  /** Fire `onended` of every stopped source (what the browser does later). */
  endAll: () => void;
  advance: (seconds: number) => void;
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

function makeFake(opts: { convolver?: boolean } = {}): Fake {
  const nodes: FakeNode[] = [];
  const node = (kind: string): FakeNode => {
    const n: FakeNode = {
      kind,
      live: true,
      stopped: false,
      onended: null,
      type: "",
      buffer: null,
      loop: false,
      normalize: false,
      connect: (to: unknown) => to,
      disconnect: (to?: unknown) => {
        if (to === undefined) n.live = false;
      },
      start: () => undefined,
      stop: () => {
        n.stopped = true;
      },
    };
    for (const p of ["gain", "frequency", "detune", "Q", "pan", "delayTime"]) n[p] = fakeParam();
    for (const p of ["threshold", "knee", "ratio"]) n[p] = fakeParam();
    nodes.push(n);
    return n;
  };
  const ctx: Record<string, unknown> = {
    state: "suspended",
    currentTime: 0,
    sampleRate: 8000,
    destination: node("destination"),
    resume: async () => {
      ctx.state = "running";
    },
    suspend: async () => {
      ctx.state = "suspended";
    },
    close: async () => {
      ctx.state = "closed";
    },
    createBuffer: (channels: number, len: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(len));
      return { duration: len / 8000, length: len, getChannelData: (c: number) => data[c]! };
    },
  };
  const kinds = [
    "Gain",
    "Oscillator",
    "BiquadFilter",
    "BufferSource",
    "StereoPanner",
    "Delay",
    "DynamicsCompressor",
  ];
  if (opts.convolver) kinds.push("Convolver");
  for (const kind of kinds) ctx[`create${kind}`] = () => node(kind);
  return {
    ctx: ctx as unknown as AudioContext,
    nodes,
    count: (kind) => nodes.filter((n) => n.kind === kind).length,
    endAll: () => {
      for (const n of nodes) {
        if (n.stopped && n.onended) {
          const f = n.onended;
          n.onended = null;
          f();
        }
      }
    },
    advance: (seconds) => {
      ctx.currentTime = (ctx.currentTime as number) + seconds;
      vi.advanceTimersByTime(seconds * 1000);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

const POWER_NONE: EmitterPower = { generation: 0, demand: 0, online: new Set(), starved: [] };

// ── Positional device ambience ──

describe("device emitters", () => {
  it("derives an emitter per device with kind, floor, load and brownout", () => {
    const online = new Set(["UEC-001", "CDC-001", "VNT-001"]);
    const p: EmitterPower = {
      generation: 100,
      demand: 60,
      online,
      starved: [{ id: "QSM-001" }],
    };
    const all = deviceEmitters(p);
    expect(all.length).toBe(DEVICES.length);
    for (const e of all) {
      expect(HUM_CATEGORIES).toContain(e.category);
      expect(e.load).toBeGreaterThanOrEqual(0);
      expect(e.load).toBeLessThanOrEqual(1);
      expect(e.floor).toBe(ROOM_BY_ID.get(DEVICES.find((d) => d.id === e.id)!.room)!.floor);
    }
    const by = new Map(all.map((e) => [e.id, e]));
    expect(by.get("CDC-001")!.category).toBe("crystal");
    expect(by.get("VNT-001")!.category).toBe("fan");
    expect(by.get("QSM-001")!.category).toBe("quantum");
    expect(by.get("UEC-001")!.category).toBe("reactor");
    expect(by.get("QSM-001")!.brownout).toBe(true);
    expect(by.get("QSM-001")!.powered).toBe(false);
    expect(by.get("UEC-001")!.powered).toBe(true);
    const f0 = deviceEmitters(p, 0);
    expect(f0.length).toBeGreaterThan(0);
    expect(f0.every((e) => e.floor === 0)).toBe(true);
    // Every kind the brief asks for is used by at least one real device.
    const kinds = new Set(DEVICES.map((d) => humCategory(d.id)));
    for (const k of ["generator", "server", "fan", "crystal", "quantum", "reactor"]) {
      expect(kinds.has(k as (typeof HUM_CATEGORIES)[number]), k).toBe(true);
    }
  });

  it("loads follow the grid and the device's own draw", () => {
    const light: EmitterPower = { ...POWER_NONE, generation: 100, demand: 10 };
    const heavy: EmitterPower = { ...POWER_NONE, generation: 100, demand: 95 };
    expect(deviceLoad({ power: 10 }, heavy)).toBeGreaterThan(deviceLoad({ power: 10 }, light));
    expect(deviceLoad({ power: -50 }, heavy)).toBeGreaterThan(deviceLoad({ power: -50 }, light));
    expect(deviceLoad({ power: 40 }, light)).toBeGreaterThan(deviceLoad({ power: 2 }, light));
  });

  it("brownout devices stay audible, quieter, sagging and crackling", () => {
    const devs: DeviceEmitter[] = [
      { id: "A-1", x: 0, z: 0, powered: true, load: 0.5 },
      { id: "B-1", x: 0, z: 0, powered: false, brownout: true, load: 0.5 },
      { id: "C-1", x: 0, z: 0, powered: false },
    ];
    const sel = selectHums(devs, [0, 0]);
    expect(sel.map((s) => s.id).sort()).toEqual(["A-1", "B-1"]);
    const a = sel.find((s) => s.id === "A-1")!;
    const b = sel.find((s) => s.id === "B-1")!;
    expect(b.brownout).toBe(true);
    expect(b.gain).toBeLessThan(a.gain);
    const voice = humVoice("generator", 55);
    const ta = humTargets(a, voice, 1);
    const tb = humTargets(b, voice, 1);
    expect(tb.detune).toBe(BROWNOUT_SAG_CENTS);
    expect(BROWNOUT_SAG_CENTS).toBeLessThan(0);
    expect(ta.detune).toBe(0);
    expect(tb.filter).toBeLessThan(ta.filter);
    expect(tb.crackleEvery).not.toBeNull();
    expect(ta.crackleEvery).toBeNull();
    // More load → louder and faster throb.
    const hi = humTargets({ ...a, load: 1 }, voice, 1);
    const lo = humTargets({ ...a, load: 0 }, voice, 1);
    expect(hi.gain).toBeGreaterThan(lo.gain);
    expect(hi.lfoRate!).toBeGreaterThan(lo.lfoRate!);
  });

  it("gives crystals chimes and quantum devices a pitch warble", () => {
    expect(humVoice("crystal", 55).chimes?.freqs.length).toBeGreaterThan(1);
    expect(humVoice("quantum", 55).warble?.cents).toBeGreaterThan(0);
    expect(humVoice("fan", 55).noise.length).toBeGreaterThan(0);
    const sigs = HUM_CATEGORIES.map((c) => JSON.stringify(humVoice(c, 61.7)));
    expect(new Set(sigs).size).toBe(HUM_CATEGORIES.length);
  });

  it("caps voices at the nearest six on the listener's floor", async () => {
    vi.useFakeTimers();
    const fake = makeFake();
    const audio = new AudioSystem({ createContext: () => fake.ctx });
    await audio.resume();
    audio.stopMusic();
    const ems: DeviceEmitter[] = Array.from({ length: 12 }, (_, i) => ({
      id: `CDC-${i}`,
      x: i,
      z: 0,
      powered: true,
      floor: i < 10 ? 0 : 1,
    }));
    audio.setListenerAt(0, 0, 0, 0);
    audio.setEmitters(ems);
    expect(MAX_DEVICE_HUMS).toBe(6);
    expect(audio.activeEmitters().length).toBe(6);
    expect(audio.activeEmitters()).toContain("CDC-0");
    expect(audio.audibleEmitters().every((e) => e.floor === 0)).toBe(true);
    // Changing floor re-selects immediately.
    audio.setListenerAt(10, 0, 1, 0);
    expect(audio.activeEmitters().sort()).toEqual(["CDC-10", "CDC-11"]);
    audio.dispose();
  });

  it("crackles during brownout, chimes over time and leaks no nodes", async () => {
    vi.useFakeTimers();
    const fake = makeFake();
    const audio = new AudioSystem({ createContext: () => fake.ctx });
    await audio.resume();
    audio.stopMusic();
    audio.setListenerAt(0, 0, 0, 0);
    const baseNodes = fake.nodes.length;
    audio.setEmitters([
      { id: "CDC-001", x: 0, z: 0, powered: true, floor: 0, category: "crystal" },
      { id: "BAT-001", x: 1, z: 0, powered: false, brownout: true, floor: 0 },
    ]);
    const afterBuild = fake.count("BufferSource");
    const oscBuild = fake.count("Oscillator");
    fake.advance(6);
    // Crackle pops are filtered noise; chimes are oscillators.
    expect(fake.count("BufferSource")).toBeGreaterThan(afterBuild);
    expect(fake.count("Oscillator")).toBeGreaterThan(oscBuild);
    // Stop everything, let the browser fire onended: nothing stays connected.
    audio.setEmitters([]);
    expect(audio.activeEmitters()).toEqual([]);
    fake.advance(2);
    fake.endAll();
    const created = fake.nodes.slice(baseNodes);
    const leaked = created.filter((n) => n.live);
    expect(leaked.map((n) => n.kind)).toEqual([]);
    // Timers were cleared: no new nodes appear afterwards.
    const n = fake.nodes.length;
    fake.advance(20);
    expect(fake.nodes.length).toBe(n);
    audio.dispose();
  });
});

// ── Adaptive music ──

describe("adaptive music", () => {
  it("focus thins the score and adds a pulse; danger adds a heartbeat", () => {
    const base = { floor: 1, progress: 0.5, tension: 0.3 };
    const explore = layerLevels(base);
    const focus = layerLevels({ ...base, focus: true });
    const danger = layerLevels({ ...base, danger: 1 });
    expect(explore.pulse).toBe(0);
    expect(focus.pulse).toBeGreaterThan(0);
    expect(focus.arp).toBeLessThan(explore.arp);
    expect(focus.shimmer).toBeLessThanOrEqual(explore.shimmer);
    expect(focus.cutoff).toBeLessThan(explore.cutoff);
    expect(explore.heartbeat).toBe(0);
    expect(danger.heartbeat).toBeGreaterThan(0);
    expect(danger.bass).toBeGreaterThan(explore.bass);
    // Scenes (endings) are scripted: no adaptive layers.
    const ending = layerLevels({ ...base, danger: 1, focus: true, scene: "ending_halo" });
    expect(ending.pulse + ending.heartbeat + ending.darkness).toBe(0);
  });

  it("deep floors sound darker", () => {
    expect(floorDarkness(0)).toBe(0);
    expect(floorDarkness(2)).toBe(0);
    expect(floorDarkness(5)).toBe(1);
    const top = layerLevels({ floor: 0, progress: 0.5, tension: 0 });
    const deep = layerLevels({ floor: 5, progress: 0.5, tension: 0 });
    expect(masterCutoff(deep)).toBeLessThan(masterCutoff(top));
    expect(masterCutoff({ darkness: 0, pulse: 0.6 })).toBeLessThan(
      masterCutoff({ darkness: 0, pulse: 0 }),
    );
  });

  it("stings stay in the current key and differ by kind", () => {
    const theme = themeFor({ floor: 2, progress: 0, tension: 0 });
    const inKey = new Set<number>();
    for (let d = -14; d < 40; d++) inKey.add(((scaleNote(theme, d) % 12) + 12) % 12);
    const sigs = new Set<string>();
    for (const kind of STING_KINDS) {
      const notes = stingNotes(theme, kind);
      expect(notes.length, kind).toBeGreaterThan(0);
      sigs.add(JSON.stringify(notes.map((n) => [n.midi, n.at])));
      for (const n of notes) {
        expect(n.gain).toBeGreaterThan(0);
        expect(n.gain).toBeLessThanOrEqual(0.1);
        expect(n.at + n.dur).toBeLessThan(3);
        // The danger sting's minor second rub is deliberately out of key.
        if (kind !== "danger") expect(inKey.has(((n.midi % 12) + 12) % 12), kind).toBe(true);
      }
    }
    expect(sigs.size).toBe(STING_KINDS.length);
  });

  it("crossfades stems on theme changes and frees the old stem", async () => {
    vi.useFakeTimers();
    const fake = makeFake();
    const audio = new AudioSystem({ createContext: () => fake.ctx });
    await audio.resume();
    audio.setMusicState({ floor: 1, progress: 0.2, tension: 0 });
    fake.advance(2);
    audio.setMusicState({ floor: 1, progress: 0.2, tension: 0, focus: true, danger: 0.8 });
    fake.advance(2);
    audio.musicSting("discovery");
    audio.musicSting("danger");
    const gainsBefore = fake.count("Gain");
    audio.setMusicState({ floor: 5, progress: 0.2, tension: 0 });
    expect(fake.count("Gain")).toBeGreaterThan(gainsBefore);
    fake.advance(13);
    fake.endAll();
    audio.dispose();
    fake.advance(20);
  });
});

// ── Room reverb ──

describe("room reverb", () => {
  it("sizes rooms by area and theme", () => {
    for (const r of ROOMS) {
      const spec = reverbFor(r);
      expect(REVERB_SIZES).toContain(spec.size);
      expect(spec.wet).toBeGreaterThan(0);
      expect(spec.wet).toBeLessThan(0.5);
    }
    const idx = (s: string) => REVERB_SIZES.indexOf(s as (typeof REVERB_SIZES)[number]);
    // Shafts ring even though the elevator rooms are small.
    expect(idx(reverbFor(ROOM_BY_ID.get("aufzug0")!).size)).toBeGreaterThanOrEqual(idx("large"));
    // Soft rooms are drier than bare rooms of the same size.
    const quarters = reverbFor({ w: 28, d: 32, theme: "quarters" });
    const storage = reverbFor({ w: 28, d: 32, theme: "storage" });
    expect(quarters.wet).toBeLessThan(storage.wet);
    expect(quarters.decay).toBeLessThan(storage.decay);
    expect(reverbFor({ w: 48, d: 52, theme: "forge" }).size).toBe("huge");
    expect(reverbFor({ w: 12, d: 12, theme: "office" }).size).toBe("dry");
    // Wet and decay grow with size.
    const specs = REVERB_SIZES.map((_, i) =>
      reverbFor({ w: [10, 20, 28, 36, 48][i]!, d: [10, 20, 30, 40, 52][i]!, theme: "generic" }),
    );
    for (let i = 1; i < specs.length; i++) {
      expect(specs[i]!.decay).toBeGreaterThanOrEqual(specs[i - 1]!.decay);
    }
    expect(reverbFor(null).size).toBe("medium");
  });

  it("generates a deterministic decaying impulse response", () => {
    const a = impulseSamples(8000, 1, 3000, 5);
    const b = impulseSamples(8000, 1, 3000, 5);
    expect(a.length).toBe(8000);
    expect(Array.from(a.slice(0, 50))).toEqual(Array.from(b.slice(0, 50)));
    const energy = (x: Float32Array) => x.reduce((s, v) => s + v * v, 0);
    const head = energy(a.slice(0, 800));
    const tail = energy(a.slice(7200));
    expect(tail).toBeLessThan(head * 0.01);
    for (const v of a) expect(Number.isFinite(v)).toBe(true);
  });

  for (const convolver of [true, false]) {
    it(`crossfades room changes and frees old tails (${convolver ? "convolver" : "FDN"})`, () => {
      vi.useFakeTimers();
      const fake = makeFake({ convolver });
      const dest = fake.ctx.createGain();
      const rv = new RoomReverb(fake.ctx, dest);
      expect(rv.convolution).toBe(convolver);
      rv.set(reverbFor({ w: 12, d: 12, theme: "office" }));
      const n1 = fake.nodes.length;
      // Same size: only levels change, no new stage.
      rv.set(reverbFor({ w: 13, d: 12, theme: "office" }));
      expect(fake.nodes.length).toBe(n1);
      const firstStage = fake.nodes.slice(5, n1);
      rv.set(reverbFor({ w: 48, d: 52, theme: "forge" }));
      expect(fake.nodes.length).toBeGreaterThan(n1);
      expect(rv.current?.size).toBe("huge");
      fake.advance(5);
      expect(firstStage.filter((n) => n.live)).toEqual([]);
      if (convolver) expect(fake.count("Convolver")).toBe(2);
      rv.dispose();
      // Everything but the context destination and our own `dest` is freed.
      expect(fake.nodes.slice(2).filter((n) => n.live)).toEqual([]);
    });
  }

  it("AudioSystem routes sends into the reverb and applies room acoustics", async () => {
    const fake = makeFake({ convolver: true });
    const audio = new AudioSystem({ createContext: () => fake.ctx });
    audio.setRoomAcoustics(ROOM_BY_ID.get("forge"));
    expect(audio.reverb.size).toBe("huge");
    await audio.resume();
    // One room convolver + the music hall (songs).
    expect(fake.count("Convolver")).toBe(2);
    audio.setRoomAcoustics(ROOM_BY_ID.get("jadeq"));
    expect(fake.count("Convolver")).toBe(3);
    audio.dispose();
  });
});

// ── Footsteps + Foley ──

describe("footsteps and Foley", () => {
  it("adds wood floors and per-surface loudness", () => {
    expect(SURFACES).toContain("wood");
    expect(surfaceForTheme("archive")).toBe("wood");
    expect(surfaceForTheme("server")).toBe("grate");
    expect(surfaceForTheme("office")).toBe("carpet");
    expect(surfaceForTheme("lab")).toBe("tile");
    for (const s of SURFACES) expect(FOOTSTEP_GAIN[s]).toBeGreaterThan(0);
    expect(FOOTSTEP_GAIN.carpet).toBeLessThan(FOOTSTEP_GAIN.grate);
    const rec = new RecordingTarget(4);
    SFX.footstep(rec, { surface: "wood" });
    expect(rec.events.length).toBeGreaterThan(1);
  });

  const FOLEY = [
    "mug_clink",
    "chair_creak",
    "typing",
    "elevator_cable",
    "door_hiss",
    "brownout_crackle",
  ] as const;

  it("registers the new Foley effects additively, varied and short", () => {
    for (const name of ["footstep", "page_turn", "door_slide", "elevator_start"] as const) {
      expect(SFX_NAMES).toContain(name);
    }
    for (const name of FOLEY) {
      expect(SFX_NAMES).toContain(name);
      const sigs = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const rec = new RecordingTarget(seed);
        SFX[name](rec, {});
        expect(rec.events.length, name).toBeGreaterThan(0);
        for (const e of rec.events) {
          expect(Number.isFinite(e.freq) && e.freq > 0, name).toBe(true);
          expect(e.gain > 0 && e.gain <= 1, name).toBe(true);
        }
        expect(rec.duration(), name).toBeLessThan(3.5);
        sigs.add(JSON.stringify(rec.events.map((e) => [e.kind, Math.round(e.freq)])));
      }
      expect(sigs.size, name).toBeGreaterThanOrEqual(2);
    }
  });

  it("layers Foley companions onto existing effects", () => {
    expect(foleyCompanions("elevator_start", "elevator").map((c) => c.name)).toContain(
      "elevator_cable",
    );
    expect(foleyCompanions("coffee_brew", "quarters").map((c) => c.name)).toContain("mug_clink");
    expect(foleyCompanions("door_slide", "airlock").map((c) => c.name)).toContain("door_hiss");
    expect(foleyCompanions("door_slide", "office")).toEqual([]);
    expect(foleyCompanions("pickup", "lab")).toEqual([]);
    for (const name of SFX_NAMES) {
      for (const c of foleyCompanions(name, "airlock")) {
        expect(SFX_NAMES).toContain(c.name);
        expect(c.delay).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("plays footsteps on every surface through the engine", async () => {
    const fake = makeFake();
    const audio = new AudioSystem({ createContext: () => fake.ctx });
    await audio.resume();
    audio.stopMusic();
    const before = fake.count("BufferSource");
    for (const s of SURFACES) audio.footstep(s, { pos: [1, 1] });
    expect(fake.count("BufferSource")).toBeGreaterThan(before);
    audio.dispose();
  });
});

// ── Lifecycle ──

describe("visibility and unlock", () => {
  it("does not create a context before a gesture, mutes while hidden", async () => {
    const fake = makeFake();
    let created = 0;
    const audio = new AudioSystem({
      createContext: () => {
        created++;
        return fake.ctx;
      },
    });
    // Tab switches before any gesture never start audio.
    await audio.setHidden(true);
    await audio.setHidden(false);
    expect(created).toBe(0);
    expect(audio.isUnlocked).toBe(false);
    await audio.resume();
    expect(created).toBe(1);
    expect(audio.running).toBe(true);
    await audio.setHidden(true);
    expect(audio.running).toBe(false);
    // A gesture while hidden does not resume.
    await audio.resume();
    expect(audio.running).toBe(false);
    await audio.setHidden(false);
    expect(audio.running).toBe(true);
    expect(created).toBe(1);
    audio.dispose();
  });

  it("new APIs are silent no-ops without Web Audio", async () => {
    const audio = new AudioSystem();
    await audio.resume();
    audio.setListenerAt(1, 2, 3, 0.4);
    audio.setEmitters(deviceEmitters(POWER_NONE));
    audio.setRoomAcoustics(ROOMS[0]);
    audio.footstep("wood");
    audio.musicSting("insight");
    audio.setMusicState({ floor: 4, progress: 0.3, tension: 0.2, focus: true, danger: 0.5 });
    await audio.setHidden(true);
    await audio.setHidden(false);
    expect(audio.activeEmitters()).toEqual([]);
    audio.dispose();
  });
});

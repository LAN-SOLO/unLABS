"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { AudioSystem, SAFE_ROOM_THEMES, deviceEmitters, humCategory } from "@/lib/world/audio";
import type { HumCategory } from "@/lib/world/audio/ambience";
import type { StingKind } from "@/lib/world/audio/music";
import type { SfxName, Surface } from "@/lib/world/audio/sfx";
import { registerActiveAudio } from "@/lib/world/audio/active";
import type { Footwear, MotionLayerKind } from "@/lib/world/audio/footfall";
import { StepTracker } from "@/lib/world/audio/footsteps";
import { surfaceUnder } from "@/lib/world/audio/surfaces";
import { footwearOf, motionLayersOf } from "@/lib/world/wardrobe";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { ROOM_BY_ID } from "@/lib/world/content/map";
import { power, progress, stagesDone } from "@/lib/world/game";
import type { LabEngine } from "@/lib/world/render/engine";
import { BarkEngine, type Bark, type BarkContext } from "@/lib/world/barks";
import type { BarkTrigger } from "@/lib/world/content/barks";
import { nextEvents } from "@/lib/world/ambient-events";
import { INSIGHT_BY_ID } from "@/lib/world/content/story";
import {
  SceneRunner,
  sceneFor,
  sceneSeenFlag,
  type SceneScript,
  type SceneTrigger,
} from "@/lib/world/scenes";
import { effectiveVolume, getSettings, subscribeSettings } from "@/lib/world/settings";
import type { FloorId, WorldState } from "@/lib/world/types";

interface Snapshot {
  online: Set<string>;
  starved: Set<string>;
  stages: Record<string, number>;
  insights: Set<string>;
  discovered: Set<string>;
  endings: Set<string>;
  items: number;
  flags: Set<string>;
  prototypes: number;
}

function snapshot(s: WorldState): Snapshot {
  const p = power(s);
  return {
    online: new Set(p.online),
    starved: new Set(p.starved.map((x) => x.id)),
    stages: { ...s.built },
    insights: new Set(Object.keys(s.insights)),
    discovered: new Set(Object.keys(s.discovered).filter((k) => s.discovered[k])),
    endings: new Set(Object.keys(s.endings)),
    items: Object.values(s.inventory).reduce((a, b) => a + b, 0),
    flags: new Set(Object.keys(s.flags).filter((k) => s.flags[k])),
    prototypes: s.counters.combo_prototype ?? 0,
  };
}

export interface Subtitle {
  who: string;
  text: string;
  until: number;
}

interface DirectorWorld {
  get: () => WorldState;
  act: <T>(fn: (s: WorldState) => T) => T;
  onChange: (l: () => void) => () => void;
}

/** Rooms whose doors are pneumatic (a hiss layered on the slide). */
const PNEUMATIC_THEMES: ReadonlySet<string> = new Set([
  "airlock",
  "containment",
  "cryo",
  "portal",
  "reactor",
  "vault",
  "server",
  "lab",
]);

/** Power-up pitch per device family (quantum bright, reactors deep). */
const DEVICE_ON_PITCH: Record<HumCategory, number> = {
  generator: 0.85,
  server: 1.1,
  quantum: 1.26,
  reactor: 0.75,
  machine: 1,
  crystal: 1.5,
  fan: 0.94,
};

/** Puzzle focus gives up by itself after this long (closed without a result). */
const FOCUS_TIMEOUT_MS = 180_000;
/** Minimum gap between two danger stings. */
const DANGER_STING_GAP_MS = 20_000;

/**
 * Foley companions: extra layers played together with an effect (delay in
 * seconds, gain multiplier). Keeps LabWorld's single `sound(name)` calls
 * while adding cable groan to elevators, a mug clink after coffee, etc.
 */
export function foleyCompanions(
  name: SfxName,
  roomTheme: string | undefined,
): { name: SfxName; delay: number; gain: number }[] {
  switch (name) {
    case "elevator_start":
      return [{ name: "elevator_cable", delay: 0.35, gain: 0.8 }];
    case "elevator":
      return [{ name: "elevator_cable", delay: 0.1, gain: 0.6 }];
    case "coffee_brew":
      return [{ name: "mug_clink", delay: 1.9, gain: 0.9 }];
    case "sit":
      return [{ name: "chair_creak", delay: 0.18, gain: 0.7 }];
    case "door_slide":
    case "door_open":
      return PNEUMATIC_THEMES.has(roomTheme ?? "")
        ? [{ name: "door_hiss", delay: 0.02, gain: 0.8 }]
        : [];
    case "door_close":
      return PNEUMATIC_THEMES.has(roomTheme ?? "")
        ? [{ name: "door_hiss", delay: 0.25, gain: 0.5 }]
        : [];
    case "brownout":
      return [{ name: "brownout_crackle", delay: 0.15, gain: 0.8 }];
    default:
      return [];
  }
}

function devicePoint(id: string): THREE.Vector3 | null {
  const d = DEVICE_BY_ID.get(id);
  return d ? new THREE.Vector3(d.x + 0.5, 1.5, d.z + 0.5) : null;
}

/**
 * Sound, effects and cinematics for the lab world. Watches the state for
 * game events (device online, stage built, insight, blueprint, brownout,
 * ending), plays matching sounds/effects and queues scripted scenes.
 */
export function useLabDirector(
  world: DirectorWorld,
  engineRef: RefObject<LabEngine | null>,
  floor: FloorId,
  room: string | null,
) {
  const audioRef = useRef<AudioSystem | null>(null);
  const [subtitle, setSubtitle] = useState<Subtitle | null>(null);
  const [titleCard, setTitleCard] = useState<{
    title: string;
    sub?: string;
    seconds: number;
    key: number;
  } | null>(null);
  const [cinematic, setCinematic] = useState(false);
  /** The song that just started (now-playing toast), cleared after a few seconds. */
  const [nowPlaying, setNowPlaying] = useState<{
    id: string;
    title: string;
    genre: string;
    jukebox: boolean;
    key: number;
  } | null>(null);
  const queue = useRef<SceneScript[]>([]);
  const runner = useRef<SceneRunner | null>(null);
  const prev = useRef<Snapshot | null>(null);
  const floorRef = useRef(floor);
  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  const barks = useRef(new BarkEngine());
  const lastInputAt = useRef(0);
  /** Puzzle focus (music thins out); performance.now() when it started, 0 = off. */
  const focusSince = useRef(0);
  const lastDangerSting = useRef(-Infinity);
  /** Footfall bookkeeping: cadence, turns, stops, landings (pure, see audio/footsteps.ts). */
  const steps = useRef(new StepTracker());
  const lastStep = useRef<{
    surface: Surface;
    footwear: Footwear;
    layers: MotionLayerKind[];
  } | null>(null);
  useEffect(() => {
    // Arriving on another floor (ladder, elevator): the next step lands.
    if (floorRef.current !== floor) steps.current.landNext();
    floorRef.current = floor;
  }, [floor]);
  // `useWorld()` returns a new object on every render: loops and callbacks read it through a ref.
  const worldRef = useRef(world);
  useEffect(() => {
    worldRef.current = world;
  });

  // Audio lifecycle.
  useEffect(() => {
    const audio = new AudioSystem();
    audioRef.current = audio;
    const unregister = registerActiveAudio(audio);
    let npTimer = 0;
    const offSong = audio.onSong((song, jukebox) => {
      setNowPlaying({
        id: song.id,
        title: song.title,
        genre: song.genre,
        jukebox,
        key: performance.now(),
      });
      window.clearTimeout(npTimer);
      npTimer = window.setTimeout(() => setNowPlaying(null), 6000);
    });
    const volumes = () => {
      const a = getSettings().audio;
      audio.setVolumes({
        master: a.mute ? 0 : a.master,
        music: effectiveVolume(a, "music") / Math.max(0.001, a.master),
        sfx: effectiveVolume(a, "sfx") / Math.max(0.001, a.master),
        ambience: effectiveVolume(a, "ambience") / Math.max(0.001, a.master),
        ui: effectiveVolume(a, "ui") / Math.max(0.001, a.master),
        voice: effectiveVolume(a, "voice") / Math.max(0.001, a.master),
      });
      audio.setMusicPrefs({ switchMode: a.musicSwitch, length: a.songLength });
    };
    volumes();
    const off = subscribeSettings(volumes);
    // AudioContext may only start from a user gesture: every gesture (cheaply)
    // re-resumes, which also recovers Safari's "interrupted" state. Hidden tab,
    // bfcache, focus and a watchdog keep the context in step with the page.
    const unbind = audio.bindPageLifecycle({
      onGesture: () => {
        lastInputAt.current = performance.now();
      },
    });
    return () => {
      off();
      offSong();
      unbind();
      unregister();
      window.clearTimeout(npTimer);
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  /** Puzzle / minigame focus: the score thins to pad + pulse. */
  const setFocus = useCallback((on: boolean) => {
    focusSince.current = on ? performance.now() : 0;
  }, []);

  const sting = useCallback((kind: StingKind) => {
    if (kind === "danger") {
      const now = performance.now();
      if (now - lastDangerSting.current < DANGER_STING_GAP_MS) return;
      lastDangerSting.current = now;
    }
    audioRef.current?.musicSting(kind);
  }, []);

  const sound = useCallback(
    (name: SfxName, at?: [number, number], gain?: number, pitch?: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const opts: { pos?: [number, number]; gain?: number; pitch?: number } = {};
      if (at) opts.pos = at;
      if (gain !== undefined) opts.gain = gain;
      if (pitch !== undefined) opts.pitch = pitch;
      audio.play(name, opts);
      const theme = roomRef.current ? ROOM_BY_ID.get(roomRef.current)?.theme : undefined;
      for (const c of foleyCompanions(name, theme)) {
        audio.play(c.name, { ...opts, gain: (opts.gain ?? 1) * c.gain, delay: c.delay });
      }
      // Puzzle overlay lifecycle (LabWorld plays these): focus in / out.
      if (name === "puzzle_open") setFocus(true);
      if (name === "puzzle_solved") {
        setFocus(false);
        sting("solved");
      }
    },
    [setFocus, sting],
  );

  /**
   * A foot landed (engine callback). Refines the room's floor with decor
   * spots under the player (rugs, puddles, glass …), picks the footwear set
   * (Jade's shoes or the fixed setting) and the motion layers of what she
   * wears, and lets the step tracker add scuffs on turns and landings.
   */
  const footstep = useCallback((surface: Surface, at?: [number, number]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const [x, z] = at ?? [0, 0];
    const under = at ? surfaceUnder(floorRef.current, x, z, surface) : surface;
    const mode = getSettings().audio.footsteps;
    const look = worldRef.current.get().wardrobe?.look;
    let footwear: Footwear = "boot";
    let layers: MotionLayerKind[] = [];
    try {
      if (look) {
        footwear = footwearOf(look);
        layers = motionLayersOf(look);
      }
    } catch {
      /* wardrobe data mid-migration: plain boots */
    }
    if (mode !== "auto") footwear = mode;
    lastStep.current = { surface: under, footwear, layers };
    for (const ev of steps.current.step(performance.now() / 1000, x, z)) {
      audio.step({
        surface: under,
        footwear,
        foot: ev.foot,
        pace: ev.pace,
        kind: ev.kind,
        interval: ev.interval,
        index: ev.index,
        layers: ev.kind === "scuff" ? [] : layers,
        ...(at ? { pos: at } : {}),
      });
    }
  }, []);

  const speak = useCallback(
    (text: string, who: string) => audioRef.current?.speak(text, who) ?? 0,
    [],
  );

  const queueScene = useCallback(
    (t: SceneTrigger) => {
      const sc = sceneFor(t);
      if (!sc || world.get().flags[sceneSeenFlag(sc.id)]) return;
      if (!queue.current.some((q) => q.id === sc.id)) queue.current.push(sc);
    },
    [world],
  );

  /** Show an ambient line (subtitle + voice), unless a scene is running. */
  const showBark = useCallback((b: Bark) => {
    if (runner.current && !runner.current.done) return;
    setSubtitle({ who: b.who, text: b.text, until: performance.now() + b.seconds * 1000 });
    audioRef.current?.speak(b.text, b.who);
    if (b.sfx) audioRef.current?.play(b.sfx, { gain: 0.5 });
    window.setTimeout(
      () => setSubtitle((cur) => (cur && cur.text === b.text ? null : cur)),
      b.seconds * 1000 + 200,
    );
  }, []);

  const bark = useCallback(
    (trigger: BarkTrigger, ctx: BarkContext = {}) => {
      // LabWorld barks "puzzle_failed" when a puzzle closes without a result.
      if (trigger === "puzzle_failed") setFocus(false);
      if (runner.current && !runner.current.done) return;
      const s = world.get();
      const c: BarkContext = { ...ctx };
      if (roomRef.current && c.room === undefined) c.room = roomRef.current;
      const b = barks.current.event(trigger, c, s, s.playTime);
      if (b) showBark(b);
    },
    [world, showBark, setFocus],
  );

  // Game events from state diffs.
  useEffect(() => {
    prev.current = snapshot(world.get());
    return world.onChange(() => {
      const s = world.get();
      const before = prev.current;
      const now = snapshot(s);
      prev.current = now;
      if (!before) return;
      const engine = engineRef.current;
      for (const id of now.online) {
        if (before.online.has(id)) continue;
        const p = devicePoint(id);
        // Each device family powers up in its own register.
        sound("device_on", p ? [p.x, p.z] : undefined, undefined, DEVICE_ON_PITCH[humCategory(id)]);
        if (p && engine) engine.fx.emit("power_wave", p);
        const sc = sceneFor({ kind: "device_online", id });
        if (!sc || s.flags[sceneSeenFlag(sc.id)]) bark("device_online", { device: id });
        queueScene({ kind: "device_online", id });
      }
      const starvedWhy = new Map(power(s).starved.map((x) => [x.id, x.reason]));
      for (const id of before.online) {
        if (now.online.has(id)) continue;
        if (now.starved.has(id)) {
          sound("brownout");
          sting("danger");
          bark(starvedWhy.get(id) === "hitze" ? "overheat" : "brownout", { device: id });
          const r = DEVICE_BY_ID.get(id)?.room;
          if (r) engineRef.current?.flickerRoom(r, 1.2);
        } else {
          sound("device_off");
          bark("device_offline", { device: id });
        }
      }
      for (const [id, n] of Object.entries(now.stages)) {
        if ((before.stages[id] ?? 0) >= n) continue;
        const p = devicePoint(id);
        sound("build_stage", p ? [p.x, p.z] : undefined);
        // The engine plays the assembly drop + scan line; add only a spark burst.
        if (p && engine) engine.fx.emit("sparks", p);
        const trig = { kind: "stage_built", id, stage: stagesDone(s, id) } as const;
        const stageScene = sceneFor(trig);
        queueScene(trig);
        const total = DEVICE_BY_ID.get(id)?.stages.length ?? 3;
        if (!stageScene || s.flags[sceneSeenFlag(stageScene.id)])
          bark(n >= total ? "device_built" : "stage_built", { device: id });
      }
      let insight = false;
      for (const id of now.insights) {
        if (before.insights.has(id)) continue;
        insight = true;
        queueScene({ kind: "insight", id });
        const th = INSIGHT_BY_ID.get(id)?.thread;
        if (th) bark("insight", { thread: th });
      }
      if (insight) {
        sound("insight");
        sting("insight");
        if (engine) {
          const [x, , z] = engine.playerPosition();
          engine.fx.emit("insight_ring", new THREE.Vector3(x, 1.05, z));
        }
      }
      if ([...now.discovered].some((id) => !before.discovered.has(id))) {
        sound("blueprint");
        if (!insight) sting("discovery");
      }
      for (const id of now.endings) if (!before.endings.has(id)) queueScene({ kind: "ending", id });
      if (now.items > before.items) sound("pickup");
      for (const f of now.flags) {
        if (before.flags.has(f)) continue;
        const bot = /^bot_(.+)_awake$/.exec(f)?.[1];
        if (bot) {
          const botScene = sceneFor({ kind: "bot_awake", id: bot });
          queueScene({ kind: "bot_awake", id: bot });
          if (!botScene || s.flags[sceneSeenFlag(botScene.id)])
            bark("bot_awake", { bot: bot as BarkContext["bot"] });
        }
        if (f.startsWith("ach_") && !f.startsWith("ach_t_")) {
          sound("achievement");
          bark("achievement");
        }
        if (f === "explosion_seen") bark("combine_explosion");
      }
      if (now.prototypes > before.prototypes) bark("combine_prototype");
    });
  }, [world, engineRef, sound, queueScene, bark, sting]);

  // Ambience per room.
  useEffect(() => {
    const r = room ? ROOM_BY_ID.get(room) : undefined;
    const s = world.get();
    const p = power(s);
    const powered = p.generation >= 50 && (!r?.litBy || p.online.has(r.litBy));
    audioRef.current?.setAmbience(r?.theme ?? "generic", powered);
    // Room acoustics: small rooms dry, halls / caves / shafts wet.
    audioRef.current?.setRoomAcoustics(r);
  }, [room, world]);

  // Scene runner + listener/music updates. `useWorld()` returns a new object on
  // every render, so the loop reads it through `worldRef` — depending on `world`
  // restarted the loop (and its 0.25 s clock) on every render, and the music,
  // ambient events and barks it drives never got their turn.
  useEffect(() => {
    const world = {
      get: () => worldRef.current.get(),
      act: <T>(fn: (s: WorldState) => T) => worldRef.current.act(fn),
    };
    let raf = 0;
    let last = performance.now();
    let slow = 0;
    let ambClock = world.get().playTime;
    let barkTimer = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const engine = engineRef.current;
      const audio = audioRef.current;
      // Start the next queued scene on its floor.
      if (engine && (!runner.current || runner.current.done)) {
        const idx = queue.current.findIndex((q) => q.floor === floorRef.current);
        if (idx >= 0) {
          const sc = queue.current.splice(idx, 1)[0]!;
          setCinematic(true);
          engine.setInputEnabled(false);
          const r = new SceneRunner(sc, {
            begin: () => engine.director.begin(engine.cameraPose()),
            camera: (shots) => engine.director.enqueue(shots),
            say: (who, text, secs) => {
              setSubtitle({ who, text, until: performance.now() + secs * 1000 });
              audio?.speak(text, who);
            },
            sfx: (name, at, pitch, gain) => {
              const o: { pos?: [number, number]; pitch?: number; gain?: number } = {};
              if (at) o.pos = [at[0], at[1]];
              if (pitch !== undefined) o.pitch = pitch;
              if (gain !== undefined) o.gain = gain;
              audio?.play(name, o);
            },
            fx: (kind, at, o) => engine.fx.emit(kind, new THREE.Vector3(at[0], at[1], at[2]), o),
            music: (cue, tension) => {
              const s = world.get();
              audio?.setMusicState({
                floor: floorRef.current,
                progress: fraction(s),
                tension: tension ?? 0.3,
                scene: cue,
              });
            },
            shake: (x) => engine.shake.add(x),
            fade: (to, secs) => engine.director.fadeTo(to, secs),
            flag: (f) => world.act((s) => void (s.flags[f] = true)),
            title: (t, sub, secs) => {
              setTitleCard({
                title: t,
                ...(sub ? { sub } : {}),
                seconds: secs,
                key: performance.now(),
              });
              window.setTimeout(() => setTitleCard(null), secs * 1000);
            },
            pose: (p) => engine.setPlayerMode(p),
            end: (script) => {
              engine.setPlayerMode("idle");
              setTitleCard(null);
              engine.director.end(!!script.keepFade);
              if (script.keepFade) window.setTimeout(() => engine.director.fadeTo(0, 1.5), 400);
              engine.snapYaw();
              world.act((s) => void (s.flags[sceneSeenFlag(script.id)] = true));
              setSubtitle(null);
              setCinematic(false);
              engine.setInputEnabled(true);
            },
          });
          runner.current = r;
          r.start();
        }
      }
      runner.current?.update(dt);
      // The player stopped walking: the trailing foot settles (once).
      const settle = steps.current.poll(now / 1000);
      const ls = lastStep.current;
      if (settle && ls && audio) {
        audio.step({
          surface: ls.surface,
          footwear: ls.footwear,
          foot: settle.foot,
          pace: settle.pace,
          kind: "stop",
          interval: settle.interval,
          index: settle.index,
          layers: ls.layers,
          pos: settle.at,
        });
      }
      slow += dt;
      ambClock += dt;
      if (engine && audio && slow > 0.25) {
        const step = slow;
        slow = 0;
        const s = world.get();
        const cine = !!runner.current && !runner.current.done;
        if (!cine) {
          for (const ev of nextEvents(s, floorRef.current, roomRef.current, ambClock, step)) {
            const pos = ev.pos ?? [0, 0, 0];
            if (ev.fx && ev.near && ev.pos) {
              const o: { scale?: number; duration?: number } = { duration: ev.duration };
              if (ev.fxScale !== undefined) o.scale = ev.fxScale;
              engine.fx.emit(ev.fx, new THREE.Vector3(pos[0], pos[1], pos[2]), o);
            }
            if (ev.sfx) sound(ev.sfx, ev.pos ? [pos[0], pos[2]] : undefined, ev.gain);
            if (ev.shake) engine.shake.add(ev.shake);
            if (ev.kind === "lamp_flicker") engine.flickerRoom(ev.room, ev.duration);
          }
          barkTimer += step;
          if (barkTimer >= 1) {
            barkTimer = 0;
            const b = barks.current.tick(s, s.playTime, {
              room: roomRef.current,
              floor: floorRef.current,
              idleSeconds: (performance.now() - lastInputAt.current) / 1000,
            });
            if (b) showBark(b);
          }
        }
        const p = power(s);
        const [x, , z] = engine.playerPosition();
        // Positional device ambience: nearest six on this floor (hum / fan /
        // crystal chime / quantum warble; starved ones sag and crackle).
        audio.setListenerAt(x, z, floorRef.current, engine.cameraYaw());
        audio.setEmitters(deviceEmitters(p, floorRef.current));
        if (focusSince.current && performance.now() - focusSince.current > FOCUS_TIMEOUT_MS) {
          focusSince.current = 0;
        }
        if (!runner.current || runner.current.done) {
          const theme = room ? ROOM_BY_ID.get(room)?.theme : undefined;
          const tension = Math.min(
            1,
            (p.starved.length ? 0.6 : 0.1) +
              (theme === "anomaly" || theme === "containment" ? 0.3 : 0),
          );
          // Danger: starved devices on this floor (brownout / overheating).
          const here = p.starved.filter(
            (st) => ROOM_BY_ID.get(DEVICE_BY_ID.get(st.id)?.room ?? "")?.floor === floorRef.current,
          ).length;
          audio.setMusicState({
            floor: floorRef.current,
            progress: fraction(s),
            tension,
            scene: null,
            safe: SAFE_ROOM_THEMES.has(theme ?? ""),
            theme: theme ?? null,
            style: getSettings().audio.musicStyle,
            motifs: !!s.insights.vier_toene || !!s.insights.handshake,
            focus: focusSince.current > 0,
            danger: here ? Math.min(1, 0.4 + here * 0.2) : 0,
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engineRef, room, showBark, sound]);

  const skipScene = useCallback(() => runner.current?.skip(), []);

  /** Play the wake-up scene (after the intro text). */
  const playIntro = useCallback(() => queueScene({ kind: "start" }), [queueScene]);
  /** First arrival on a floor (after the elevator ride). */
  const floorReached = useCallback(
    (f: FloorId) => queueScene({ kind: "floor_reached", floor: f }),
    [queueScene],
  );

  /** The audio system (studio jukebox, mixer, instruments); null before mount. */
  const getAudio = useCallback(() => audioRef.current, []);

  return {
    sound,
    speak,
    footstep,
    nowPlaying,
    getAudio,
    subtitle,
    cinematic,
    skipScene,
    playIntro,
    floorReached,
    titleCard,
    bark,
    setFocus,
    sting,
  };
}

function fraction(s: WorldState): number {
  const p = progress(s);
  return (p.devices / Math.max(1, p.totalDevices)) * 0.7 + Math.min(1, p.endings / 4) * 0.3;
}

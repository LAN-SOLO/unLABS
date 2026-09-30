import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MUSIC_SCENES } from "@/lib/world/audio/music";
import { SFX_NAMES } from "@/lib/world/audio/sfx";
import { DEVICES } from "@/lib/world/content/devices";
import { FLOOR_SIZE, roomAt } from "@/lib/world/content/map";
import { BOT_QUESTS, ENDINGS } from "@/lib/world/content/story";
import {
  CameraDirector,
  EASE,
  ScreenShake,
  lerpAngle,
  type CameraShot,
} from "@/lib/world/render/cutscene";
import { FX_KINDS, FxSystem } from "@/lib/world/render/fx";
import {
  ENDING_IDS,
  ENDING_SIGNATURE,
  FLOOR_SCENE_IDS,
  MOMENT_MAX_SECONDS,
  MOMENT_SCENE_IDS,
  SCENES,
  SCENE_IDS,
  SceneRunner,
  endingAnchor,
  readTime,
  sceneDuration,
  sceneFor,
  sceneSeenFlag,
  type SceneCallbacks,
  type SceneScript,
  type SceneStep,
} from "@/lib/world/scenes";
import type { FloorId } from "@/lib/world/types";

function recorder(): { log: string[]; cb: SceneCallbacks } {
  const log: string[] = [];
  const cb: SceneCallbacks = {
    camera: (shots) => log.push(`camera:${shots.length}`),
    say: (who, text, seconds) => log.push(`say:${who}:${text}:${seconds}`),
    sfx: (name) => log.push(`sfx:${name}`),
    fx: (kind) => log.push(`fx:${kind}`),
    music: (cue) => log.push(`music:${cue}`),
    flag: (f) => log.push(`flag:${f}`),
    shake: (s) => log.push(`shake:${s}`),
    fade: (to) => log.push(`fade:${to}`),
    title: (t, sub, secs) => log.push(`title:${t}:${sub ?? ""}:${secs}`),
    pose: (p) => log.push(`pose:${p}`),
    begin: (s) => log.push(`begin:${s.id}`),
    end: (s, skipped) => log.push(`end:${s.id}:${skipped}`),
  };
  return { log, cb };
}

const TEST_SCRIPT: SceneScript = {
  id: "wake",
  title: "Test",
  floor: 0,
  skippable: true,
  steps: [
    { kind: "music", cue: "intro" },
    { kind: "sfx", name: "alarm" },
    { kind: "wait", seconds: 1 },
    { kind: "say", who: "mcp", text: "Hallo.", seconds: 2 },
    { kind: "camera", shots: [{ target: [0, 0, 0], zoom: 20, duration: 1.5 }], wait: true },
    { kind: "flag", flag: "a" },
    { kind: "music", cue: null },
    { kind: "flag", flag: "b" },
  ],
};

describe("SceneRunner", () => {
  it("runs steps in order with blocking durations", () => {
    const { log, cb } = recorder();
    const r = new SceneRunner(TEST_SCRIPT, cb);
    r.start();
    expect(log).toEqual(["begin:wake", "music:intro", "sfx:alarm"]);
    r.update(0.99);
    expect(log).toHaveLength(3);
    r.update(0.02); // wait done → say starts
    expect(log[3]).toBe("say:mcp:Hallo.:2");
    r.update(1.9);
    expect(log).toHaveLength(4);
    r.update(0.2); // say done → camera starts
    expect(log[4]).toBe("camera:1");
    r.update(1.3);
    expect(r.done).toBe(false);
    r.update(0.3);
    expect(log.slice(5)).toEqual(["flag:a", "music:null", "flag:b", "end:wake:false"]);
    expect(r.done).toBe(true);
    expect(r.skipped).toBe(false);
  });

  it("carries leftover time across steps in one big update", () => {
    const { log, cb } = recorder();
    const r = new SceneRunner(TEST_SCRIPT, cb);
    r.start();
    r.update(10);
    expect(r.done).toBe(true);
    expect(log.at(-1)).toBe("end:wake:false");
    expect(sceneDuration(TEST_SCRIPT)).toBeCloseTo(4.5);
  });

  it("skip keeps flags and the final music cue", () => {
    const { log, cb } = recorder();
    const r = new SceneRunner(TEST_SCRIPT, cb);
    r.start();
    r.update(1.5); // inside the say step
    log.length = 0;
    r.skip();
    expect(log).toEqual(["flag:a", "flag:b", "music:null", "end:wake:true"]);
    expect(r.done && r.skipped).toBe(true);
    r.update(5);
    r.skip();
    expect(log).toHaveLength(4);
  });

  it("title cards and poses reach their callbacks; async titles don't block", () => {
    const script: SceneScript = {
      id: "wake",
      title: "T",
      floor: 0,
      skippable: true,
      steps: [
        { kind: "pose", pose: "crouch" },
        { kind: "title", title: "A", sub: "b", seconds: 2 },
        { kind: "title", title: "C", seconds: 3, async: true },
        { kind: "wait", seconds: 1 },
      ],
    };
    expect(sceneDuration(script)).toBeCloseTo(3);
    const { log, cb } = recorder();
    const r = new SceneRunner(script, cb);
    r.start();
    expect(log).toEqual(["begin:wake", "pose:crouch", "title:A:b:2"]);
    r.update(2.01);
    expect(log.slice(3)).toEqual(["title:C::3"]);
    r.update(1);
    expect(r.done).toBe(true);
  });

  it("every authored scene runs to completion", () => {
    for (const id of SCENE_IDS) {
      const { log, cb } = recorder();
      const r = new SceneRunner(SCENES[id], cb);
      r.start();
      for (let i = 0; i < 4000 && !r.done; i++) r.update(1 / 30);
      expect(r.done, id).toBe(true);
      expect(log.at(-1)).toBe(`end:${id}:false`);
      expect(log).toContain(`flag:scene_${id}`);
    }
  });
});

describe("scene scripts", () => {
  const inFloor = (p: readonly number[], floor: FloorId) =>
    p[0]! >= 0 &&
    p[0]! <= FLOOR_SIZE.x &&
    p[2]! >= 0 &&
    p[2]! <= FLOOR_SIZE.z &&
    roomAt(floor, Math.floor(p[0]!), Math.floor(p[2]!)) !== undefined;

  function checkStep(s: SceneStep, script: SceneScript): void {
    const where = `${script.id}/${s.kind}`;
    switch (s.kind) {
      case "camera":
        for (const shot of s.shots) {
          expect(inFloor(shot.target, script.floor), where).toBe(true);
          expect(shot.zoom, where).toBeGreaterThanOrEqual(10);
          expect(shot.zoom, where).toBeLessThanOrEqual(140);
          expect(shot.duration, where).toBeGreaterThanOrEqual(0);
        }
        break;
      case "sfx":
        expect(SFX_NAMES, where).toContain(s.name);
        if (s.at) expect(inFloor([s.at[0], 0, s.at[1]], script.floor), where).toBe(true);
        break;
      case "fx":
        expect(FX_KINDS, where).toContain(s.fx);
        expect(inFloor(s.at, script.floor), where).toBe(true);
        break;
      case "music":
        if (s.cue !== null) expect(MUSIC_SCENES, where).toContain(s.cue);
        break;
      case "say":
        expect(s.text.trim().length, where).toBeGreaterThan(0);
        break;
      default:
        break;
    }
  }

  it("reference valid ids and positions on their own floor", () => {
    for (const id of SCENE_IDS) {
      const script = SCENES[id];
      expect(script.id).toBe(id);
      expect(script.steps.length).toBeGreaterThan(3);
      for (const s of script.steps) checkStep(s, script);
      expect(sceneDuration(script), id).toBeGreaterThan(5);
      expect(sceneDuration(script), id).toBeLessThan(120);
    }
  });

  it("per-device and per-bot variants reference valid positions", () => {
    const variants: SceneScript[] = [
      ...DEVICES.flatMap((d) => {
        const sc = sceneFor({ kind: "stage_built", id: d.id, stage: d.stages.length });
        return sc && sc.id === "first_device" ? [sc] : [];
      }),
      ...BOT_QUESTS.map((q) => sceneFor({ kind: "bot_awake", id: q.npc })!),
    ];
    expect(variants.length).toBe(DEVICES.length - 2 + BOT_QUESTS.length);
    for (const sc of variants) {
      for (const s of sc.steps) checkStep(s, sc);
      expect(sceneDuration(sc), sc.title).toBeLessThanOrEqual(MOMENT_MAX_SECONDS);
      expect(sc.steps.at(-1)).toEqual({ kind: "flag", flag: sceneSeenFlag(sc.id) });
    }
  });

  it("endings play at their anchor and quote every ending line", () => {
    for (const e of ENDINGS) {
      const script = sceneFor({ kind: "ending", id: e.id });
      expect(script, e.id).toBeDefined();
      expect(script!.floor).toBe(endingAnchor(e.id).floor);
      const said = script!.steps
        .filter((s) => s.kind === "say")
        .map((s) => s.kind === "say" && s.text);
      for (const l of e.lines) expect(said, e.id).toContain(l.text);
      expect(script!.keepFade).toBe(true);
    }
  });

  it("ending ids match story.ts", () => {
    expect([...ENDING_IDS].sort()).toEqual(ENDINGS.map((e) => e.id).sort());
  });

  it("endings speak every line exactly once and in story order", () => {
    for (const e of ENDINGS) {
      const script = sceneFor({ kind: "ending", id: e.id })!;
      const said = script.steps.flatMap((s) => (s.kind === "say" ? [s.text] : []));
      expect(said, e.id).toEqual(e.lines.map((l) => l.text));
      const whos = script.steps.flatMap((s) => (s.kind === "say" ? [s.who] : []));
      expect(whos, e.id).toEqual(e.lines.map((l) => l.who));
    }
  });

  it("endings open with a music cue, pause and close on a fade-to-black shot", () => {
    for (const id of ENDING_IDS) {
      const script = SCENES[`ending_${id}`];
      expect(script.steps[0]!.kind, id).toBe("music");
      expect(
        script.steps.some((s) => s.kind === "wait"),
        id,
      ).toBe(true);
      const cams = script.steps.filter((s) => s.kind === "camera");
      expect(cams.length, id).toBeGreaterThanOrEqual(3);
      const last = cams.at(-1)!;
      expect(last.kind === "camera" && last.shots.at(-1)!.fade, id).toBe(1);
      expect(last.kind === "camera" && last.wait, id).toBe(true);
      expect(sceneDuration(script), id).toBeGreaterThan(25);
      expect(script.steps.at(-1)).toEqual({ kind: "flag", flag: `scene_ending_${id}` });
    }
  });

  it("each ending has its own visual signature", () => {
    const fxOf = (id: (typeof ENDING_IDS)[number]) =>
      SCENES[`ending_${id}`].steps.flatMap((s) => (s.kind === "fx" ? [s] : []));
    const count = (id: (typeof ENDING_IDS)[number], kind: string, color?: number) =>
      fxOf(id).filter((f) => f.fx === kind && (color === undefined || f.opts?.color === color))
        .length;
    // frequenz: sound-wave rings
    expect(count("frequenz", "insight_ring", 0x00ffff)).toBeGreaterThanOrEqual(12);
    // substrat: green data rain + the core's face glowing
    expect(count("substrat", "sparks", 0x33ff33)).toBeGreaterThanOrEqual(20);
    expect(count("substrat", "pickup_glint")).toBeGreaterThanOrEqual(3);
    // rueckkehr: teleport beam + Damien materialising from the pad upwards
    expect(count("rueckkehr", "teleport")).toBeGreaterThanOrEqual(2);
    const body = fxOf("rueckkehr").filter((f) => f.fx === "pickup_glint" && f.opts?.scale === 0.8);
    expect(body.map((f) => f.at[1])).toEqual([...body.map((f) => f.at[1])].sort((a, b) => a - b));
    expect(body.length).toBeGreaterThanOrEqual(4);
    // halo: white-gold bloom
    expect(count("halo", "power_wave", ENDING_SIGNATURE.halo.color)).toBeGreaterThanOrEqual(1);
    expect(count("halo", "pickup_glint", ENDING_SIGNATURE.halo.color)).toBeGreaterThanOrEqual(8);
    // kristall: thirty orange slice glints (#0089 = unETH ID 89, orange),
    // twice: laid out, then whole (white-hot core)
    expect(ENDING_SIGNATURE.kristall.color).toBe(0xff6b00);
    expect(count("kristall", "pickup_glint", ENDING_SIGNATURE.kristall.color)).toBe(30);
    expect(count("kristall", "pickup_glint", 0xfff4c8)).toBe(30);
    expect(count("kristall", "power_wave", ENDING_SIGNATURE.kristall.color)).toBe(1);
    // the signature colours are distinct
    const colors = ENDING_IDS.map((id) => ENDING_SIGNATURE[id].color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("maps triggers to scenes", () => {
    expect(sceneFor({ kind: "start" })?.id).toBe("wake");
    expect(sceneFor({ kind: "device_online", id: "UEC-001" })?.id).toBe("first_power");
    expect(sceneFor({ kind: "device_online", id: "ECR-001" })?.id).toBe("damien_first_echo");
    expect(sceneFor({ kind: "device_online", id: "DIM-001" })?.id).toBe("rift_open");
    expect(sceneFor({ kind: "device_online", id: "CLK-001" })).toBeUndefined();
    expect(sceneFor({ kind: "stage_built", id: "MCP-000", stage: 2 })?.id).toBe("mcp_awake");
    expect(sceneFor({ kind: "stage_built", id: "MCP-000", stage: 1 })).toBeUndefined();
    expect(sceneFor({ kind: "insight", id: "handshake" })?.id).toBe("handshake");
    expect(sceneFor({ kind: "ending", id: "nope" })).toBeUndefined();
    // First fully built device (MCP and UEC have their own moments).
    expect(sceneFor({ kind: "stage_built", id: "BTK-001", stage: 3 })?.id).toBe("first_device");
    expect(sceneFor({ kind: "stage_built", id: "BTK-001", stage: 2 })).toBeUndefined();
    expect(sceneFor({ kind: "stage_built", id: "UEC-001", stage: 3 })).toBeUndefined();
    expect(sceneFor({ kind: "stage_built", id: "MCP-000", stage: 3 })?.id).toBe("mcp_awake");
    const lct = sceneFor({ kind: "stage_built", id: "LCT-001", stage: 3 })!;
    expect(lct.id).toBe("first_device");
    expect(lct.floor).toBe(1);
    expect(sceneFor({ kind: "stage_built", id: "LCT-001", stage: 3 })).toBe(lct);
    // Floors and bots.
    expect(sceneFor({ kind: "floor_reached", floor: 0 })).toBeUndefined();
    for (const f of [1, 2, 3, 4, 5] as const) {
      const sc = sceneFor({ kind: "floor_reached", floor: f })!;
      expect(sc.id).toBe(`floor_${f}`);
      expect(sc.floor).toBe(f);
    }
    const bot = sceneFor({ kind: "bot_awake", id: "f1ndr" })!;
    expect(bot.id).toBe("first_bot");
    expect(bot.floor).toBe(0);
    expect(sceneFor({ kind: "bot_awake", id: "damien" })).toBeUndefined();
  });

  it("the cold open runs 30–45 s: fade in, title card, control handed back", () => {
    const wake = SCENES.wake;
    const secs = sceneDuration(wake);
    expect(secs).toBeGreaterThanOrEqual(30);
    expect(secs).toBeLessThanOrEqual(45);
    expect(wake.steps[0]).toEqual({ kind: "fade", to: 1, seconds: 0 });
    expect(wake.steps.some((s) => s.kind === "fade" && s.to === 0)).toBe(true);
    expect(wake.steps.some((s) => s.kind === "title")).toBe(true);
    expect(wake.steps.filter((s) => s.kind === "say" && s.who === "mcp").length).toBeGreaterThan(2);
    expect(wake.steps.filter((s) => s.kind === "camera").length).toBeGreaterThanOrEqual(5);
    expect(wake.steps.some((s) => s.kind === "pose" && s.pose === "crouch")).toBe(true);
    const lastCam = wake.steps.filter((s) => s.kind === "camera").at(-1)!;
    expect(lastCam.kind === "camera" && lastCam.wait).toBe(true);
  });

  it("in-game moments stay short, every scene is skippable", () => {
    for (const id of MOMENT_SCENE_IDS) {
      expect(sceneDuration(SCENES[id]), id).toBeLessThanOrEqual(MOMENT_MAX_SECONDS);
      expect(sceneDuration(SCENES[id]), id).toBeGreaterThanOrEqual(6);
    }
    for (const id of SCENE_IDS) expect(SCENES[id].skippable, id).toBe(true);
    expect(FLOOR_SCENE_IDS.every((id) => SCENES[id].steps.some((s) => s.kind === "title"))).toBe(
      true,
    );
  });

  it("every line is readable in the time it gets", () => {
    for (const id of SCENE_IDS)
      for (const s of SCENES[id].steps)
        if (s.kind === "say" && !s.async) {
          const secs = s.seconds ?? readTime(s.text);
          // ~25 characters per second at most, never under 2 s.
          expect(secs, `${id}: ${s.text}`).toBeGreaterThanOrEqual(2);
          expect(s.text.length / secs, `${id}: ${s.text}`).toBeLessThanOrEqual(26);
        }
  });

  it("reading time is bounded", () => {
    expect(readTime("Ja.")).toBeGreaterThanOrEqual(2);
    expect(readTime("x".repeat(500))).toBeLessThanOrEqual(7.5);
  });
});

describe("CameraDirector", () => {
  const shots: CameraShot[] = [
    { target: [10, 0, 10], zoom: 20, yaw: 0, duration: 1, ease: "inOut" },
    { target: [30, 2, 10], zoom: 60, yaw: Math.PI / 2, duration: 2, ease: "out", hold: 0.5 },
  ];

  it("eases through shots, reaches targets and calls onDone once", () => {
    const d = new CameraDirector();
    let done = 0;
    d.play(shots, () => done++, { target: [0, 0, 0], zoom: 46, yaw: 0 });
    expect(d.isPlaying).toBe(true);
    const mid = d.update(0.5)!;
    expect(mid.controlsCamera).toBe(true);
    expect(mid.target[0]).toBeGreaterThan(0);
    expect(mid.target[0]).toBeLessThan(10);
    const f1 = d.update(0.5)!;
    expect(f1.target[0]).toBeCloseTo(10);
    expect(f1.zoom).toBeCloseTo(20);
    d.update(2);
    const held = d.update(0.25)!;
    expect(held.target[0]).toBeCloseTo(30);
    expect(held.zoom).toBeCloseTo(60);
    expect(held.yaw).toBeCloseTo(Math.PI / 2);
    expect(done).toBe(0);
    const last = d.update(0.3)!;
    expect(done).toBe(1);
    expect(d.isPlaying).toBe(false);
    expect(last.controlsCamera).toBe(false);
    // Letterbox eases out, then the director goes idle.
    let frames = 0;
    while (d.update(0.1) && frames < 100) frames++;
    expect(frames).toBeLessThan(20);
    expect(d.update(0.1)).toBeNull();
    expect(done).toBe(1);
  });

  it("letterbox rises while playing", () => {
    const d = new CameraDirector();
    d.play(shots);
    const a = d.update(0.1)!.letterbox;
    const b = d.update(0.5)!.letterbox;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("skip jumps to the final pose", () => {
    const d = new CameraDirector();
    let done = 0;
    d.play(shots, () => done++);
    d.update(0.2);
    d.skip();
    expect(done).toBe(1);
    const f = d.update(0.016)!;
    expect(f.target[0]).toBeCloseTo(30);
    expect(f.zoom).toBeCloseTo(60);
    expect(f.controlsCamera).toBe(false);
  });

  it("manual sessions hold the last shot until end()", () => {
    const d = new CameraDirector();
    d.begin({ target: [0, 0, 0], zoom: 40, yaw: 0 });
    d.enqueue([{ target: [5, 0, 5], zoom: 30, duration: 0.5 }]);
    d.update(2);
    const f = d.update(2)!;
    expect(d.isPlaying).toBe(true);
    expect(f.target[0]).toBeCloseTo(5);
    d.enqueue([{ target: [9, 0, 9], zoom: 30, duration: 0 }]);
    expect(d.update(0.016)!.target[0]).toBeCloseTo(9);
    d.end(true);
    expect(d.isPlaying).toBe(false);
  });

  it("shot fades and fadeTo", () => {
    const d = new CameraDirector();
    d.play([{ target: [0, 0, 0], zoom: 30, duration: 1, fade: 1, ease: "linear" }]);
    expect(d.update(0.5)!.fade).toBeCloseTo(0.5);
    const d2 = new CameraDirector();
    d2.fadeTo(1, 1);
    expect(d2.update(0.5)!.fade).toBeCloseTo(0.5);
    expect(d2.update(0.6)!.fade).toBeCloseTo(1);
  });

  it("easing curves and angle lerp", () => {
    for (const e of Object.values(EASE)) {
      expect(e(0)).toBeCloseTo(0);
      expect(e(1)).toBeCloseTo(1);
    }
    expect(lerpAngle(0.1, Math.PI * 2 - 0.1, 0.5)).toBeCloseTo(0);
  });

  it("screen shake decays to zero", () => {
    const s = new ScreenShake();
    s.add(0.8);
    const [x, y] = s.update(0.016);
    expect(Math.abs(x) + Math.abs(y)).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) s.update(0.05);
    expect(s.active).toBe(false);
    expect(s.update(0.016)).toEqual([0, 0]);
  });
});

describe("FxSystem", () => {
  it("emits every kind, updates and cleans up", () => {
    const scene = new THREE.Scene();
    const fx = new FxSystem(scene, { glowCapacity: 256, softCapacity: 64 });
    for (const k of FX_KINDS) fx.emit(k, new THREE.Vector3(10, 1, 10));
    expect(fx.particleCount).toBeGreaterThan(0);
    const h = fx.ambient({ x: 0, z: 0, w: 30, d: 30 }, "dust");
    for (let i = 0; i < 20; i++) fx.update(0.1);
    fx.clearAmbient(h);
    for (let i = 0; i < 200; i++) fx.update(0.1);
    expect(fx.particleCount).toBe(0);
    fx.setDensity(0);
    fx.emit("explosion", new THREE.Vector3(0, 1, 0));
    expect(fx.particleCount).toBe(0);
    fx.dispose();
    expect(scene.children).toHaveLength(0);
  });
});

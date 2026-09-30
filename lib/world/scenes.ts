/**
 * Cinematic scene scripts + a pure SceneRunner.
 * =============================================
 *
 * Scenes are plain data: camera shots, waits, spoken lines, sound cues,
 * effects, music cues, title cards, player poses and flags. `SceneRunner`
 * steps through a script with `update(dt)` and reports each step to
 * callbacks that the lead wires to CameraDirector / AudioSystem /
 * FxSystem / the subtitle + title-card UI / the player rig.
 *
 * Length budget: the cold open (`wake`) runs 30–45 s; every in-game
 * moment (first power, first device, first bot, a new floor, Damien's
 * echo, …) stays at or under `MOMENT_MAX_SECONDS`; endings are longer
 * and hand over to the EndingSequence on black. Every scene is skippable
 * — skipping still sets all flags (see `SceneRunner.skip`).
 *
 * No three, no DOM: positions come from the content files (read-only)
 * and are validated by tests/world/scenes.test.ts.
 */
import { tr } from "@/lib/i18n";
import type { SfxName } from "@/lib/world/audio/sfx";
import type { MusicScene } from "@/lib/world/audio/music";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import {
  ELEVATORS,
  FLOOR_BY_ID,
  PROPS,
  ROOM_BY_ID,
  SPAWN,
  roomAnchor,
} from "@/lib/world/content/map";
import { SLICE_TOTAL as SLICE_COUNT } from "@/lib/world/content/items";
import { BOT_QUESTS, ENDING_BY_ID, NPCS } from "@/lib/world/content/story";
import type { CharacterPoseKind } from "@/lib/world/models/rig";
import type { CameraShot } from "@/lib/world/render/cutscene";
import type { FxKind, FxOptions } from "@/lib/world/render/fx";
import type { DialogueLine, FloorId } from "@/lib/world/types";

export type Speaker = DialogueLine["who"];
export type Vec3Tuple = readonly [number, number, number];

export type SceneStep =
  /** Queue camera shots; `wait` blocks until they finished. */
  | { kind: "camera"; shots: readonly CameraShot[]; wait?: boolean }
  | { kind: "wait"; seconds: number }
  /** A spoken line (subtitle + voice bleeps). Blocks for `seconds` unless `async`. */
  | {
      kind: "say";
      who: Speaker;
      text: string;
      seconds?: number;
      async?: boolean;
    }
  | {
      kind: "sfx";
      name: SfxName;
      at?: readonly [number, number];
      pitch?: number;
      gain?: number;
    }
  | { kind: "fx"; fx: FxKind; at: Vec3Tuple; opts?: FxOptions }
  | { kind: "music"; cue: MusicScene | null; tension?: number }
  | { kind: "shake"; strength: number }
  /** Fade to black (1) or clear (0) over `seconds`. */
  | { kind: "fade"; to: number; seconds: number }
  /**
   * A title card (big centred text + subline) shown for `seconds`. Blocks
   * unless `async`. Unwired hosts simply wait — the camera keeps holding.
   */
  | {
      kind: "title";
      title: string;
      sub?: string;
      seconds: number;
      async?: boolean;
    }
  /** Lawrence's body language during the scene (engine `setPlayerMode`). */
  | { kind: "pose"; pose: CharacterPoseKind }
  /**
   * A figure materialising with its feet at `at`: built up from the feet over
   * `build` seconds, held for `hold`, gone at the latest when the scene ends.
   * Damien is veiled until he has been found (lib/world/damien.ts) — the
   * host decides, the script never reveals him. Non-blocking; hosts without
   * it skip the figure.
   */
  | { kind: "figure"; who: "damien"; at: Vec3Tuple; build: number; hold: number }
  | { kind: "flag"; flag: string };

/** Upper bound for in-game moments (everything but the cold open and the endings). */
export const MOMENT_MAX_SECONDS = 12;

export const FLOOR_SCENE_IDS = ["floor_1", "floor_2", "floor_3", "floor_4", "floor_5"] as const;
export type FloorSceneId = (typeof FLOOR_SCENE_IDS)[number];

export const SCENE_IDS = [
  "wake",
  "first_power",
  "first_device",
  "first_bot",
  "mcp_awake",
  "damien_first_echo",
  "handshake",
  "rift_open",
  ...FLOOR_SCENE_IDS,
  "ending_frequenz",
  "ending_substrat",
  "ending_rueckkehr",
  "ending_halo",
  "ending_kristall",
] as const;
export type SceneId = (typeof SCENE_IDS)[number];

/** The in-game moments (length ≤ `MOMENT_MAX_SECONDS`). */
export const MOMENT_SCENE_IDS: readonly SceneId[] = [
  "first_power",
  "first_device",
  "first_bot",
  "mcp_awake",
  "damien_first_echo",
  "handshake",
  "rift_open",
  ...FLOOR_SCENE_IDS,
];

export interface SceneScript {
  id: SceneId;
  title: string;
  /** The floor the scene must be viewed on. */
  floor: FloorId;
  /** Player may skip (Esc / click). */
  skippable: boolean;
  /** For endings: keep the screen black after the scene (epilogue follows). */
  keepFade?: boolean;
  steps: readonly SceneStep[];
}

export type SceneTrigger =
  | { kind: "start" }
  | { kind: "device_online"; id: string }
  | { kind: "stage_built"; id: string; stage: number }
  | { kind: "insight"; id: string }
  | { kind: "ending"; id: string }
  /** The player arrived on a floor (after the elevator / ladder ride). */
  | { kind: "floor_reached"; floor: FloorId }
  /** A bot's `bot_<id>_awake` flag was set. */
  | { kind: "bot_awake"; id: string };

// ── Positions from content ────────────────────────────────────────

/** Center of a device on its floor (voxel coords, +0.5 like the engine). */
export function devicePos(id: string, y = 2): Vec3Tuple {
  const d = DEVICE_BY_ID.get(id);
  if (!d) throw new Error(`scenes: unknown device ${id}`);
  return [d.x + 0.5, y, d.z + 0.5];
}

export function deviceFloor(id: string): FloorId {
  const d = DEVICE_BY_ID.get(id);
  const r = d ? ROOM_BY_ID.get(d.room) : undefined;
  if (!r) throw new Error(`scenes: unknown device ${id}`);
  return r.floor;
}

function propPos(id: string, y = 2): Vec3Tuple {
  const p = PROPS.find((x) => x.id === id);
  if (!p) throw new Error(`scenes: unknown prop ${id}`);
  return [p.x + 0.5, y, p.z + 0.5];
}

function npcPos(id: string, y = 2): Vec3Tuple {
  const n = NPCS.find((x) => x.id === id);
  if (!n) throw new Error(`scenes: unknown npc ${id}`);
  return [n.x + 0.5, y, n.z + 0.5];
}

function roomCenter(id: string, y = 1): Vec3Tuple {
  const a = roomAnchor(id);
  if (!a) throw new Error(`scenes: unknown room ${id}`);
  return [a.x, y, a.z];
}

function elevatorPos(floor: FloorId, y = 2): Vec3Tuple {
  const e = ELEVATORS.find((x) => x.floor === floor);
  if (!e) throw new Error(`scenes: no elevator on floor ${floor}`);
  return [e.x + 0.5, y, e.z + 0.5];
}

/** Where an ending plays out: its device, or the forge prop for "forge". */
export function endingAnchor(id: string): { pos: Vec3Tuple; floor: FloorId } {
  const e = ENDING_BY_ID.get(id);
  if (!e) throw new Error(`scenes: unknown ending ${id}`);
  if (DEVICE_BY_ID.has(e.device)) return { pos: devicePos(e.device), floor: deviceFloor(e.device) };
  const prop = PROPS.find((p) => p.kind === e.device || p.id === e.device);
  if (!prop) throw new Error(`scenes: ending ${id} has no anchor`);
  return { pos: [prop.x + 0.5, 2, prop.z + 0.5], floor: prop.floor };
}

const xz = (p: Vec3Tuple): readonly [number, number] => [p[0], p[2]];
const up = (p: Vec3Tuple, dy: number): Vec3Tuple => [p[0], p[1] + dy, p[2]];
const Q = Math.PI / 4;

// ── Step helpers ──────────────────────────────────────────────────

const cam = (shots: CameraShot[], wait = false): SceneStep => ({
  kind: "camera",
  shots,
  wait,
});
const wait = (seconds: number): SceneStep => ({ kind: "wait", seconds });
const say = (who: Speaker, text: string, seconds?: number): SceneStep =>
  seconds === undefined ? { kind: "say", who, text } : { kind: "say", who, text, seconds };
const sfx = (name: SfxName, at?: Vec3Tuple, pitch?: number, gain?: number): SceneStep => ({
  kind: "sfx",
  name,
  ...(at ? { at: xz(at) } : {}),
  ...(pitch ? { pitch } : {}),
  ...(gain !== undefined ? { gain } : {}),
});
const fx = (kind: FxKind, at: Vec3Tuple, opts?: FxOptions): SceneStep =>
  opts ? { kind: "fx", fx: kind, at, opts } : { kind: "fx", fx: kind, at };
const music = (cue: MusicScene | null, tension?: number): SceneStep =>
  tension === undefined ? { kind: "music", cue } : { kind: "music", cue, tension };
const flag = (f: string): SceneStep => ({ kind: "flag", flag: f });
const fade = (to: number, seconds: number): SceneStep => ({
  kind: "fade",
  to,
  seconds,
});
const shake = (strength: number): SceneStep => ({ kind: "shake", strength });
const pose = (p: CharacterPoseKind): SceneStep => ({ kind: "pose", pose: p });
const figure = (at: Vec3Tuple, build: number, hold: number): SceneStep => ({
  kind: "figure",
  who: "damien",
  at,
  build,
  hold,
});
/** Top of the teleport pad's disc above the device anchor (TLP-001, rows 0..6 at 0.25). */
const TLP_PAD_TOP = 0.75;
const title = (t: string, sub: string | undefined, seconds: number, async = false): SceneStep => ({
  kind: "title",
  title: t,
  ...(sub ? { sub } : {}),
  seconds,
  ...(async ? { async } : {}),
});

/** Reading time for a subtitle line. */
export function readTime(text: string): number {
  return Math.min(7.5, Math.max(2.2, 1.4 + text.length * 0.05));
}

/** Reading time for a line inside a short in-game moment (tighter, still readable). */
function momentTime(text: string, max = 4.2): number {
  return Math.min(max, Math.max(2.2, 1.1 + text.length * 0.042));
}

/** A line sized for an in-game moment. */
const line = (who: Speaker, text: string, max?: number): SceneStep =>
  say(who, text, momentTime(text, max));

const CYAN = 0x00ffff;
const AMBER = 0xffb800;
const GREEN = 0x33ff33;
const FROST = 0x9fe8ff;

// ── Cold open ─────────────────────────────────────────────────────
//
// 0 s   black; rumble, a buzzing lamp, the red emergency pulse fades in
//       on a close-up of Lawrence crouched on the floor tiles.
// 5 s   the MCP's first line. Frost hisses off her — the stasis field of
//       the control room collapses (steam, frost sparks, a jolt).
// 12 s  she stands up; push-in on the dead Hauptkonsole, which sparks.
// 19 s  the MCP's shrug; slow pull-back and quarter turn reveal the
//       whole control room in emergency red.
// 26 s  the way down: pan east to the elevator shaft with the ladder.
// 30 s  title card, then back to Lawrence — control handed over (~37 s).

function wake(): SceneScript {
  const spawn: Vec3Tuple = [SPAWN.pos[0] + 0.5, 1.2, SPAWN.pos[2] + 0.5];
  const konsole = propPos("hauptkonsole", 3);
  const room = roomCenter("kontroll", 2);
  const lift = elevatorPos(0, 2);
  const alarmA: Vec3Tuple = [room[0] - 12, 6, room[2] - 10];
  const alarmB: Vec3Tuple = [room[0] + 12, 6, room[2] + 10];
  return {
    id: "wake",
    title: tr("Cold Start"),
    floor: 0,
    skippable: true,
    steps: [
      fade(1, 0),
      pose("crouch"),
      music("intro", 0.25),
      cam([{ target: up(spawn, 0.6), zoom: 11, yaw: Q * 3, duration: 0 }]),
      sfx("rumble", undefined, undefined, 0.7),
      wait(0.8),
      fade(0, 3.2),
      sfx("lamp_buzz", konsole),
      fx("alarm", alarmA, { duration: 40 }),
      fx("alarm", alarmB, { duration: 40 }),
      // A slow push while the picture comes up.
      cam([
        {
          target: up(spawn, 0.4),
          zoom: 13,
          yaw: Q * 3.2,
          duration: 5,
          ease: "smooth",
        },
      ]),
      wait(1.6),
      sfx("alarm", undefined, undefined, 0.45),
      wait(1.2),
      say("mcp", tr("[EMERGENCY MODE] No operator detected for 2,561 days."), 3.4),
      // The stasis field lets go of her: frost, a hiss, a jolt.
      sfx("door_hiss", spawn),
      sfx("steam_hiss", spawn),
      fx("steam", spawn, { scale: 1.3, duration: 2.5, color: FROST }),
      fx("sparks", up(spawn, 1.2), { color: FROST, scale: 0.6 }),
      fx("insight_ring", spawn, { color: FROST, scale: 1.6 }),
      shake(0.18),
      say("mcp", tr("Control Room stasis field: collapsed. Life signs: one."), 3.2),
      pose("idle"),
      sfx("chair_creak", spawn, undefined, 0.6),
      say("jade", tr("…Cold. Dark. How long was I out?"), 2.8),
      // Push-in on the dead console.
      cam([
        {
          target: up(konsole, 0.5),
          zoom: 15,
          yaw: Q * 3,
          duration: 3,
          ease: "inOut",
        },
      ]),
      say("mcp", tr("Emergency start initiated. Please wait."), 2.6),
      sfx("spark_crackle", konsole),
      fx("sparks", konsole, { color: AMBER, scale: 0.7 }),
      shake(0.08),
      say("mcp", tr("…Or don't. I lack the authority to make you."), 3.2),
      // Reveal: pull back and swing a quarter turn over the red-lit room.
      pose("think"),
      cam([
        {
          target: up(room, -0.5),
          zoom: 30,
          yaw: Q * 2.2,
          duration: 3.2,
          ease: "in",
        },
        { target: room, zoom: 60, yaw: Q * 1.2, duration: 3.6, ease: "out" },
      ]),
      fx("dust", room, { scale: 2.5 }),
      say("jade", tr("Something is still humming down there."), 2.8),
      say("mcp", tr("The console has no power. The geothermal plant is one level down."), 3.6),
      // The way down: the elevator shaft with the emergency ladder.
      cam([
        {
          target: lift,
          zoom: 26,
          yaw: Q,
          duration: 2.6,
          ease: "inOut",
          hold: 0.4,
        },
      ]),
      fx("insight_ring", lift, { color: AMBER, scale: 1.4 }),
      sfx("gate_rattle", lift, undefined, 0.6),
      say(
        "mcp",
        tr("Elevator: dead. Emergency ladder: working. I would have preferred the reverse."),
        3.4,
      ),
      pose("idle"),
      cam([{ target: room, zoom: 70, yaw: Q, duration: 3.5, ease: "smooth" }]),
      title("UNSTABLE LABS", tr("Cold Start · Day 2,561"), 3.6),
      cam(
        [
          {
            target: up(spawn, 0),
            zoom: 40,
            yaw: Q,
            duration: 2.2,
            ease: "inOut",
          },
        ],
        true,
      ),
      music(null),
      flag("scene_wake"),
    ],
  };
}

// ── In-game moments (≤ 12 s each) ─────────────────────────────────

function firstPower(): SceneScript {
  const uec = devicePos("UEC-001");
  const mcpLine = DEVICE_BY_ID.get("UEC-001")!.mcp;
  const cascade = ["geo", "batterie", "kuehlung", "fertigung", "rechen", "lager", "versorgung"];
  return {
    id: "first_power",
    title: tr("First Power"),
    floor: deviceFloor("UEC-001"),
    skippable: true,
    steps: [
      music(null, 0.5),
      cam(
        [
          {
            target: up(uec, 1),
            zoom: 16,
            yaw: Q * 3,
            duration: 1,
            ease: "out",
          },
        ],
        true,
      ),
      sfx("hum_surge", uec),
      fx("heat_shimmer", up(uec, 1.5), { scale: 1.2 }),
      fx("sparks", up(uec, 2)),
      wait(0.5),
      sfx("device_on", uec),
      sfx("power_up_cascade", uec),
      fx("power_on", uec, { scale: 1.4 }),
      fx("power_wave", uec),
      shake(0.25),
      // Pull back: the floor lights up room by room.
      cam([
        {
          target: roomCenter("fertigung", 2),
          zoom: 92,
          yaw: Q * 3,
          duration: 2.4,
          ease: "inOut",
        },
      ]),
      ...cascade.flatMap((r) => [
        fx("power_on", roomCenter(r), { color: AMBER, scale: 1.2 }),
        fx("insight_ring", roomCenter(r), { color: AMBER, scale: 2 }),
        sfx("lamp_buzz", roomCenter(r), 1 + cascade.indexOf(r) * 0.04, 0.35),
        wait(0.25),
      ]),
      music(null, 0.2),
      line("mcp", mcpLine),
      line("mcp", tr("You now have enough power to fail at more interesting things."), 3.2),
      cam([{ target: up(uec, 1), zoom: 44, duration: 1.1 }], true),
      flag("scene_first_power"),
    ],
  };
}

/** Devices that already have their own moment when they come to life. */
const FIRST_DEVICE_EXCLUDED: ReadonlySet<string> = new Set(["MCP-000", "UEC-001"]);

/** The first fully built device (any but MCP / UEC): a close look and its MCP line. */
export function firstDeviceScene(id: string): SceneScript {
  const d = DEVICE_BY_ID.get(id);
  if (!d) throw new Error(`scenes: unknown device ${id}`);
  const at = devicePos(id);
  const room = roomCenter(d.room, 2);
  return {
    id: "first_device",
    title: tr("The First Device"),
    floor: deviceFloor(id),
    skippable: true,
    steps: [
      cam(
        [
          {
            target: up(at, 0.5),
            zoom: 14,
            yaw: Q * 5,
            duration: 1.2,
            ease: "out",
          },
        ],
        true,
      ),
      fx("build_sparkle", at, { color: AMBER, scale: 1.2 }),
      fx("power_on", at, { color: GREEN }),
      sfx("device_on", at),
      pose("celebrate"),
      wait(0.6),
      // Slow orbit while the MCP comments.
      cam([
        {
          target: up(at, 0.8),
          zoom: 18,
          yaw: Q * 7,
          duration: 5.5,
          ease: "smooth",
        },
      ]),
      sfx("mcp_blip", at),
      line("mcp", d.mcp),
      fx("pickup_glint", up(at, 1), { color: GREEN }),
      line("jade", tr("The first device in seven years. It hums."), 2.6),
      pose("idle"),
      cam([{ target: room, zoom: 44, yaw: Q * 7, duration: 1.2 }], true),
      flag("scene_first_device"),
    ],
  };
}

/** The first bot back online: a reboot in its colours and a word from the MCP. */
export function firstBotScene(id: string): SceneScript {
  const n = NPCS.find((x) => x.id === id);
  if (!n) throw new Error(`scenes: unknown bot ${id}`);
  const at = npcPos(id, 1.5);
  const sleeping = BOT_QUESTS.length - 1;
  return {
    id: "first_bot",
    title: tr("The First Bot"),
    floor: n.floor,
    skippable: true,
    steps: [
      cam(
        [
          {
            target: up(at, 0.5),
            zoom: 14,
            yaw: Q * 3,
            duration: 1.2,
            ease: "out",
          },
        ],
        true,
      ),
      sfx("spark_crackle", at),
      fx("sparks", up(at, 1), { color: CYAN, scale: 0.5 }),
      wait(0.5),
      sfx("device_on", at),
      fx("power_on", at, { color: CYAN, scale: 0.8 }),
      fx("insight_ring", at, { color: CYAN, scale: 1.2 }),
      wait(0.4),
      sfx("mcp_blip", at, 1.4),
      line(
        n.id,
        tr("REBOOT … OK. {name} reporting in. Operator pattern: known.", { name: n.name }),
        3.4,
      ),
      cam([
        {
          target: up(at, 0.5),
          zoom: 22,
          yaw: Q * 5,
          duration: 4,
          ease: "smooth",
        },
      ]),
      line(
        "mcp",
        tr(
          "One is awake. BNET still counts {sleeping} sleepers. Are you collecting machines now?",
          { sleeping },
        ),
        3.6,
      ),
      fx("pickup_glint", up(at, 1), { color: CYAN }),
      cam([{ target: at, zoom: 40, duration: 1.2 }], true),
      flag("scene_first_bot"),
    ],
  };
}

function mcpAwake(): SceneScript {
  const mcp = devicePos("MCP-000", 3);
  return {
    id: "mcp_awake",
    title: tr("Speech Module"),
    floor: deviceFloor("MCP-000"),
    skippable: true,
    steps: [
      cam([{ target: mcp, zoom: 16, yaw: Q * 7, duration: 1.2, ease: "out" }], true),
      fx("power_on", mcp, { color: GREEN }),
      fx("build_sparkle", mcp, { color: GREEN }),
      sfx("device_on", mcp),
      wait(0.4),
      sfx("mcp_blip", mcp),
      cam([{ target: mcp, zoom: 22, yaw: Q * 5, duration: 6, ease: "smooth" }]),
      say("mcp", DEVICE_BY_ID.get("MCP-000")!.mcp, 4.2),
      pose("wave"),
      line("jade", tr("Hello, MCP. Long time no see."), 2.3),
      pose("idle"),
      line("mcp", tr("Your absence has been logged. In detail."), 2.8),
      cam([{ target: mcp, zoom: 40, duration: 1 }], true),
      flag("scene_mcp_awake"),
    ],
  };
}

function damienFirstEcho(): SceneScript {
  const echo = npcPos("damien", 2);
  return {
    id: "damien_first_echo",
    title: tr("The Echo"),
    floor: 0,
    skippable: true,
    steps: [
      music(null, 0.4),
      cam(
        [
          {
            target: up(echo, 1),
            zoom: 20,
            yaw: Q * 5,
            duration: 1.4,
            ease: "inOut",
          },
        ],
        true,
      ),
      sfx("echo_whisper", echo),
      fx("wisps", echo, { color: CYAN, duration: 4 }),
      fx("heat_shimmer", echo, { color: CYAN, scale: 0.8 }),
      wait(0.6),
      cam([
        {
          target: up(echo, 0.8),
          zoom: 14,
          yaw: Q * 6,
          duration: 5,
          ease: "smooth",
        },
      ]),
      line("damien", tr("[SIGNAL WEAK] …Ja…de…?"), 2.6),
      sfx("anomaly_zap", echo),
      fx("insight_ring", echo, { color: CYAN }),
      fx("wisps", echo, { color: CYAN, duration: 3 }),
      line("damien", tr("…between … the … signals …"), 2.5),
      pose("listen"),
      line("jade", tr("Damien. I'll find you. I promise."), 2.6),
      pose("idle"),
      cam([{ target: echo, zoom: 42, duration: 1.2 }], true),
      music(null, 0.3),
      flag("scene_damien_first_echo"),
    ],
  };
}

function handshake(): SceneScript {
  const hms = devicePos("HMS-001", 2);
  // The four keys 3-6-4-8 as semitone steps over the base tone.
  const tones = [3, 6, 4, 8];
  return {
    id: "handshake",
    title: tr("Handshake"),
    floor: deviceFloor("HMS-001"),
    skippable: true,
    steps: [
      cam([{ target: up(hms, 1), zoom: 18, yaw: Q * 5, duration: 1.2 }], true),
      ...tones.flatMap((t) => [
        {
          kind: "sfx",
          name: "handshake_tone",
          at: xz(hms),
          pitch: Math.pow(2, t / 12),
        } as SceneStep,
        fx("insight_ring", hms, { color: CYAN, scale: 0.6 + t * 0.1 }),
        wait(0.6),
      ]),
      sfx("rift", hms),
      fx("rift_pulse", hms, { color: CYAN }),
      shake(0.2),
      wait(0.3),
      cam([
        {
          target: up(hms, 2),
          zoom: 34,
          yaw: Q * 3,
          duration: 5,
          ease: "inOut",
        },
      ]),
      line("halo", "Pattern-child, we hear you. The Halo remembers your frequency.", 3.6),
      fx("insight_ring", hms, { color: 0xe8f4ff, scale: 2.4 }),
      line("mcp", tr("Contact established. I have no protocol for this."), 2.8),
      cam([{ target: hms, zoom: 42, duration: 1 }], true),
      flag("scene_handshake"),
    ],
  };
}

function riftOpen(): SceneScript {
  const dim = devicePos("DIM-001", 2);
  const room = roomCenter("anomalie", 2);
  return {
    id: "rift_open",
    title: tr("The Rift"),
    floor: deviceFloor("DIM-001"),
    skippable: true,
    steps: [
      music(null, 0.8),
      cam([{ target: up(dim, 1), zoom: 22, yaw: Q * 7, duration: 1.2 }], true),
      sfx("device_on", dim),
      fx("power_on", dim, { color: 0x9d5cff }),
      wait(0.5),
      sfx("rift", dim),
      fx("rift_pulse", dim),
      shake(0.45),
      fx("wisps", room, { scale: 3, count: 2, duration: 4 }),
      wait(0.8),
      cam([{ target: room, zoom: 48, yaw: Q * 5, duration: 4, ease: "inOut" }]),
      fx("rift_pulse", dim, { scale: 1.5 }),
      sfx("anomaly_zap", dim),
      line("unstables", "We are what persists between your measurements.", 3.2),
      line("mcp", DEVICE_BY_ID.get("DIM-001")!.mcp, 3.4),
      music(null, 0.3),
      cam([{ target: dim, zoom: 42, duration: 1 }], true),
      flag("scene_rift_open"),
    ],
  };
}

// ── New floors ────────────────────────────────────────────────────

interface FloorBeat {
  landmark: string;
  mcp: string;
  jade: string;
  /** Effect played on the landmark while the camera looks at it. */
  fx: FxKind;
  color: number;
}

const FLOOR_BEATS: Readonly<Record<Exclude<FloorId, 0>, FloorBeat>> = {
  1: {
    landmark: "geo",
    mcp: tr("Level −1. Everything down here hums, eats power — or supplies it."),
    jade: tr("Back there, the geothermal shaft. That's where it starts."),
    fx: "steam",
    color: AMBER,
  },
  2: {
    landmark: "anomalie",
    mcp: tr("Level −2. The readings down here are … idiosyncratic."),
    jade: tr("Damien worked here. You can still hear it."),
    fx: "wisps",
    color: 0x9d5cff,
  },
  3: {
    landmark: "forge",
    mcp: tr("Deep Lab. The Infinity Forge. This is where February 14, 2019 ended."),
    jade: tr("This is where everything stopped. Or started."),
    fx: "rift_pulse",
    color: 0xe8f4ff,
  },
  4: {
    landmark: "observatorium",
    mcp: tr("Living Quarters. Your plants are alive. I watered them. With the sprinkler system."),
    jade: tr("My quarters. Everything just as we left it."),
    fx: "dust",
    color: GREEN,
  },
  5: {
    landmark: "hoehle",
    mcp: tr("The Shaft. This level is not in any blueprint. I would like that on the record."),
    jade: tr("Crystals. They glow on their own."),
    fx: "wisps",
    color: CYAN,
  },
};

function floorScene(floor: Exclude<FloorId, 0>): SceneScript {
  const beat = FLOOR_BEATS[floor];
  const lift = elevatorPos(floor, 2);
  const mark = roomCenter(beat.landmark, 2);
  const [name, sub] = FLOOR_BY_ID[floor].name.split(" · ");
  return {
    id: `floor_${floor}` as FloorSceneId,
    title: FLOOR_BY_ID[floor].name,
    floor,
    skippable: true,
    steps: [
      cam(
        [
          {
            target: up(lift, 0.5),
            zoom: 20,
            yaw: Q * 5,
            duration: 0.8,
            ease: "out",
          },
        ],
        true,
      ),
      sfx("elevator_stop", lift, undefined, 0.6),
      title(name ?? FLOOR_BY_ID[floor].name, sub, 3.4, true),
      // Pan across the floor to its landmark.
      cam([{ target: mark, zoom: 62, yaw: Q * 7, duration: 3.2, ease: "inOut" }]),
      wait(1.6),
      fx(beat.fx, mark, { color: beat.color, scale: 2, duration: 4 }),
      fx("insight_ring", mark, { color: beat.color, scale: 2.4 }),
      line("mcp", beat.mcp, 3.6),
      line("jade", beat.jade, 2.8),
      cam([{ target: up(lift, 0), zoom: 40, yaw: Q * 5, duration: 1.4 }], true),
      flag(`scene_floor_${floor}`),
    ],
  };
}
// ── Endings ───────────────────────────────────────────────────────
//
// Every ending speaks its lines from story.ts in order, interleaved with
// effect beats, and has its own visual signature (see ENDING_SIGNATURE):
//   frequenz  — sound-wave rings rolling out of the synthesizer
//   substrat  — the AI core's face screen glows, green data rain
//   rueckkehr — teleport beam, Damien materialises from the feet up
//   halo      — the forge blooms white-gold
//   kristall  — thirty slice glints laid out in a ring

export const ENDING_IDS = ["frequenz", "substrat", "rueckkehr", "halo", "kristall"] as const;
export type EndingId = (typeof ENDING_IDS)[number];

export function isEndingId(id: string): id is EndingId {
  return (ENDING_IDS as readonly string[]).includes(id);
}

export interface EndingSignature {
  /** Signature colour (0xRRGGBB) used by the scene and the epilogue afterglow. */
  color: number;
  /** Same colour as CSS. */
  css: string;
  /** Secondary tint for gradients. */
  accent: string;
  /** Short description of the visual motif. */
  motif: string;
}

export const ENDING_SIGNATURE: Readonly<Record<EndingId, EndingSignature>> = {
  frequenz: { color: 0x00ffff, css: "#00FFFF", accent: "#0A3A4A", motif: "Sound-wave rings" },
  substrat: { color: 0x33ff33, css: "#33FF33", accent: "#0A2A0A", motif: "Data rain" },
  rueckkehr: { color: 0xfff4e0, css: "#FFF4E0", accent: "#3A2A10", motif: "Teleport beam" },
  halo: { color: 0xffe7a0, css: "#FFE7A0", accent: "#FFFFFF", motif: "White gold" },
  // #0089 is orange (unETH archive ID 89) — neon #FF6B00.
  kristall: { color: 0xff6b00, css: "#FF6B00", accent: "#331400", motif: "Thirty facets" },
};

const WHITE_GOLD = 0xffe7a0;
const tone = (at: Vec3Tuple, semitones: number): SceneStep => ({
  kind: "sfx",
  name: "handshake_tone",
  at: xz(at),
  pitch: Math.pow(2, semitones / 12),
});

/** Points on a horizontal circle around `c`. */
function circle(c: Vec3Tuple, n: number, radius: number, phase = 0): Vec3Tuple[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [c[0] + Math.cos(a) * radius, c[1], c[2] + Math.sin(a) * radius] as const;
  });
}

/** Sound-wave rings: concentric rings of growing size, a beat apart. */
function waveRings(at: Vec3Tuple, n: number, color: number, gap = 0.3): SceneStep[] {
  return Array.from({ length: n }, (_, i) => [
    fx("insight_ring", at, { color, scale: 1 + i * 0.9 }),
    wait(gap),
  ]).flat();
}

/** Green data rain: sparks falling from the ceiling over a grid. */
function dataRain(c: Vec3Tuple, spread: number, rows: number, gap = 0.18): SceneStep[] {
  const out: SceneStep[] = [];
  for (let i = 0; i < rows; i++) {
    const dx = ((i * 7) % 5) - 2;
    const dz = ((i * 3) % 5) - 2;
    out.push(
      fx("sparks", [c[0] + dx * spread, 7, c[2] + dz * spread], {
        color: 0x33ff33,
        scale: 0.35,
        count: 0.6,
      }),
      wait(gap),
    );
  }
  return out;
}

/** The ending's name as a title card over the opening shot. */
function endingTitle(id: EndingId): SceneStep {
  return title(ENDING_BY_ID.get(id)!.title, tr("An Ending"), 3.5, true);
}

/**
 * Ending lines in story order; `beat(i)` returns the steps played before
 * line `i`. Every line is spoken exactly once.
 */
function endingLines(id: EndingId, beat: (i: number) => SceneStep[]): SceneStep[] {
  const e = ENDING_BY_ID.get(id)!;
  return e.lines.flatMap((l, i) => [...beat(i), say(l.who, l.text)]);
}

function endingFrequenz(): SceneScript {
  const { pos, floor } = endingAnchor("frequenz");
  const room = roomCenter("signal", 2);
  const echo = devicePos("ECR-001", 2);
  const osc = devicePos("OSC-001", 3);
  return {
    id: "ending_frequenz",
    title: tr("The Frequency"),
    floor,
    skippable: true,
    keepFade: true,
    steps: [
      music("ending_frequenz", 0.15),
      endingTitle("frequenz"),
      fx("power_on", pos, { color: CYAN }),
      cam(
        [{ target: up(pos, 1), zoom: 16, yaw: Q * 5, duration: 3, ease: "inOut", hold: 0.6 }],
        true,
      ),
      ...endingLines("frequenz", (i) => {
        if (i === 0)
          // Jade plays the four tones — each one a ring rolling outwards.
          return [
            ...[3, 6, 4, 8].flatMap((t, k) => [
              tone(pos, t),
              fx("insight_ring", pos, { color: 0x00ffff, scale: 1 + k * 0.6 }),
              wait(0.35),
              fx("insight_ring", pos, { color: 0x00ffff, scale: 1.6 + k * 0.6 }),
              wait(0.55),
            ]),
            wait(0.8),
          ];
        if (i === 1)
          return [
            cam([{ target: up(echo, 1), zoom: 20, yaw: Q * 3, duration: 3.5, ease: "inOut" }]),
            sfx("echo_whisper", echo),
            fx("wisps", echo, { color: 0x00ffff, duration: 6 }),
            wait(1.2),
            fx("insight_ring", echo, { color: 0x00ffff, scale: 1.4 }),
          ];
        if (i === 2)
          return [
            fx("wisps", echo, { color: 0x00ffff, scale: 1.5, duration: 6 }),
            ...waveRings(echo, 3, 0x00ffff, 0.4),
          ];
        if (i === 3)
          return [
            cam([{ target: up(osc, 0), zoom: 22, yaw: Q * 7, duration: 3, ease: "inOut" }]),
            sfx("mcp_blip", osc),
            fx("build_sparkle", osc, { color: 0x33ff33 }),
            wait(0.6),
          ];
        // The Halo answers: the whole room hums in rings.
        return [
          cam([{ target: room, zoom: 58, yaw: Q * 5, duration: 5, ease: "inOut" }]),
          sfx("rift", pos),
          shake(0.15),
          music("ending_frequenz", 0.4),
          ...waveRings(pos, 5, 0x00ffff, 0.28),
          fx("power_wave", pos, { color: 0x00ffff, scale: 0.8 }),
        ];
      }),
      wait(1.5),
      ...[pos, echo, osc].map((p) => fx("insight_ring", p, { color: 0xe8f4ff, scale: 3 })),
      tone(pos, 12),
      wait(1.2),
      cam(
        [{ target: up(room, 6), zoom: 96, yaw: Q * 3, duration: 6, ease: "inOut", fade: 1 }],
        true,
      ),
      wait(0.8),
      flag("scene_ending_frequenz"),
    ],
  };
}

function endingSubstrat(): SceneScript {
  const { pos, floor } = endingAnchor("substrat");
  const sca = devicePos("SCA-001");
  const room = roomCenter("rechenkern", 3);
  const face = up(pos, 2);
  return {
    id: "ending_substrat",
    title: tr("New Substrate"),
    floor,
    skippable: true,
    keepFade: true,
    steps: [
      music("ending_substrat", 0.2),
      endingTitle("substrat"),
      cam([{ target: up(sca, 1), zoom: 24, yaw: Q, duration: 3, ease: "inOut" }], true),
      sfx("power_up_cascade", sca),
      fx("build_sparkle", sca, { color: 0x33ff33, scale: 1.5 }),
      fx("power_wave", sca, { color: 0x33ff33, scale: 0.7 }),
      wait(1),
      cam([{ target: room, zoom: 50, yaw: Q * 3, duration: 5, ease: "inOut" }]),
      ...dataRain(room, 3, 10),
      ...endingLines("substrat", (i) => {
        if (i === 0)
          return [
            cam([{ target: face, zoom: 20, yaw: Q * 3, duration: 4, ease: "inOut" }]),
            sfx("mcp_blip", pos),
            fx("pickup_glint", face, { color: 0x33ff33 }),
          ];
        if (i === 1) return [...dataRain(pos, 2, 8, 0.15), sfx("mcp_blip", pos)];
        if (i === 2)
          // The face on the core's screen lights up — Damien's pattern is stable.
          return [
            sfx("prototype", pos),
            fx("build_sparkle", face, { color: 0x00ffff, count: 2 }),
            fx("pickup_glint", face, { color: 0x00ffff, scale: 1.6 }),
            fx("insight_ring", face, { color: 0x00ffff, scale: 1.2 }),
            shake(0.15),
            wait(1.2),
          ];
        return [
          fx("pickup_glint", face, { color: 0x00ffff, scale: 2 }),
          ...dataRain(pos, 2, 6, 0.2),
          cam([{ target: up(pos, 1), zoom: 28, yaw: Q * 5, duration: 5, ease: "inOut" }]),
        ];
      }),
      wait(1),
      fx("insight_ring", face, { color: 0x00ffff, scale: 3 }),
      ...dataRain(room, 4, 12, 0.14),
      cam([{ target: room, zoom: 76, yaw: Q * 7, duration: 6, ease: "inOut", fade: 1 }], true),
      wait(0.8),
      flag("scene_ending_substrat"),
    ],
  };
}

function endingRueckkehr(): SceneScript {
  const { pos, floor } = endingAnchor("rueckkehr");
  const room = roomCenter("teleport", 2);
  return {
    id: "ending_rueckkehr",
    title: tr("Return"),
    floor,
    skippable: true,
    keepFade: true,
    steps: [
      music("ending_rueckkehr", 0.5),
      endingTitle("rueckkehr"),
      cam([{ target: up(pos, 2), zoom: 32, yaw: Q * 7, duration: 3, ease: "inOut" }], true),
      sfx("device_on", pos),
      fx("build_sparkle", pos, { scale: 1.2 }),
      ...endingLines("rueckkehr", (i) => {
        if (i === 0)
          // σ-15 … σ-16 … σ-17: three amber rings, each one tighter and louder.
          return [
            ...[0, 1, 2].flatMap((k) => [
              tone(pos, 3 + k * 2),
              fx("insight_ring", pos, { color: 0xffb800, scale: 2.4 - k * 0.6 }),
              shake(0.1 + k * 0.1),
              wait(0.7),
            ]),
          ];
        if (i === 1)
          return [
            sfx("rift", pos),
            fx("rift_pulse", pos, { color: 0x00ffff }),
            fx("wisps", pos, { color: 0x00ffff, scale: 1.2, duration: 5 }),
            shake(0.3),
            cam([{ target: room, zoom: 44, yaw: Q * 5, duration: 4, ease: "inOut" }]),
          ];
        if (i === 2)
          // The beam — and Damien, built up from the pad: feet, chest, head.
          // He arrives veiled: a figure in the static, not yet a face.
          return [
            music("ending_rueckkehr", 0.9),
            sfx("teleport", pos),
            fx("teleport", pos),
            shake(0.5),
            wait(0.5),
            fx("teleport", pos, { color: 0xfff4e0, scale: 1.3 }),
            figure(up(pos, TLP_PAD_TOP), 1.6, 14),
            cam([{ target: up(pos, 1), zoom: 16, yaw: Q * 5, duration: 3, ease: "out" }]),
            ...[0.5, 1.5, 2.5, 3.5].flatMap((h) => [
              fx("pickup_glint", up(pos, h - 2), { color: 0xfff4e0, scale: 0.8 }),
              fx("build_sparkle", up(pos, h - 2), { color: 0x00ffff, scale: 0.5 }),
              wait(0.4),
            ]),
            fx("power_wave", pos, { color: 0xfff4e0, scale: 0.5 }),
            fx("heat_shimmer", up(pos, 1), { color: 0xfff4e0, scale: 1.4 }),
            music("ending_rueckkehr", 0.2),
            wait(1.4),
          ];
        if (i === 3) return [wait(0.6), fx("steam", up(pos, 0), { scale: 0.4, duration: 2 })];
        return [wait(0.4)];
      }),
      wait(1.5),
      fx("pickup_glint", up(pos, 1), { color: 0xfff4e0 }),
      cam(
        [{ target: up(pos, 1), zoom: 40, yaw: Q * 7, duration: 6, ease: "inOut", fade: 1 }],
        true,
      ),
      wait(0.8),
      flag("scene_ending_rueckkehr"),
    ],
  };
}

function endingHalo(): SceneScript {
  const { pos, floor } = endingAnchor("halo");
  const station = propPos("damien_station", 2);
  const glints = circle(up(pos, 2), 8, 5, Q / 2);
  return {
    id: "ending_halo",
    title: tr("Together in the Halo"),
    floor,
    skippable: true,
    keepFade: true,
    steps: [
      music("ending_halo", 0.2),
      endingTitle("halo"),
      cam([{ target: up(station, 1), zoom: 20, yaw: Q * 3, duration: 3, ease: "inOut" }], true),
      ...endingLines("halo", (i) => {
        if (i === 0)
          return [sfx("device_on", station), fx("build_sparkle", station, { color: 0xb060ff })];
        if (i === 1)
          return [
            sfx("alarm", pos),
            fx("alarm", up(pos, 4), { duration: 6 }),
            sfx("mcp_blip", station),
          ];
        if (i === 2)
          return [
            sfx("rift", pos),
            fx("rift_pulse", pos, { scale: 2, color: WHITE_GOLD }),
            shake(0.35),
            music("ending_halo", 0.6),
            cam([{ target: up(pos, 3), zoom: 42, yaw: Q * 5, duration: 7, ease: "inOut" }]),
          ];
        if (i === 3)
          return [
            sfx("echo_whisper", pos),
            fx("wisps", pos, { scale: 3, count: 3, duration: 6, color: WHITE_GOLD }),
          ];
        if (i === 4)
          // Constructive interference: two rings, one from each of them.
          return [
            fx("teleport", station, { color: WHITE_GOLD }),
            sfx("teleport", station),
            fx("insight_ring", station, { color: 0x00ffff, scale: 2 }),
            fx("insight_ring", pos, { color: 0xffb800, scale: 2 }),
            wait(0.6),
            fx("insight_ring", pos, { color: WHITE_GOLD, scale: 3.5 }),
          ];
        return [
          ...glints.flatMap((g) => [fx("pickup_glint", g, { color: WHITE_GOLD }), wait(0.12)]),
          music("ending_halo", 0.2),
        ];
      }),
      wait(1),
      // The white-gold bloom.
      fx("power_wave", pos, { color: WHITE_GOLD, scale: 1.6 }),
      fx("heat_shimmer", up(pos, 2), { color: WHITE_GOLD, scale: 2.5 }),
      fx("build_sparkle", up(pos, 3), { color: 0xffffff, scale: 2.5, count: 2 }),
      tone(pos, 12),
      wait(0.8),
      fx("power_wave", pos, { color: 0xffffff, scale: 2.4 }),
      fx("insight_ring", up(pos, 1), { color: WHITE_GOLD, scale: 5 }),
      cam(
        [{ target: up(pos, 8), zoom: 110, yaw: Q * 7, duration: 7, ease: "inOut", fade: 1 }],
        true,
      ),
      wait(0.8),
      flag("scene_ending_halo"),
    ],
  };
}

/** Crystal #0089 is orange: unETH archive ID 89, neon #FF6B00 (palette `orange_neon`). */
const SLICE_ORANGE = ENDING_SIGNATURE.kristall.color;
/** Hot core of an orange neon tube (palette `halo_glow`). */
const SLICE_CORE = 0xfff4c8;

/**
 * Secret ending: the 30 slices of Crystal #0089 laid side by side at the CDC.
 * The 30 slices are one 180° turn of the 2-fold symmetric crystal (6° per
 * slice), so slice 30 flows seamlessly back into slice 1.
 */
function endingKristall(): SceneScript {
  const { pos, floor } = endingAnchor("kristall");
  const room = roomCenter("archiv", 0);
  const ring = circle(up(pos, 1.2), SLICE_COUNT, 3);
  return {
    id: "ending_kristall",
    title: tr("Crystal #0089"),
    floor,
    skippable: true,
    keepFade: true,
    steps: [
      music("ending_halo", 0.1),
      endingTitle("kristall"),
      cam([{ target: up(pos, 1), zoom: 18, yaw: Q * 3, duration: 3, ease: "inOut" }], true),
      // Thirty slices, one orange glint each; every fifth a rising tone.
      ...ring.flatMap((p, i) => [
        fx("pickup_glint", p, { color: SLICE_ORANGE }),
        ...(i % 5 === 0 ? [tone(pos, (i / 5) * 2)] : []),
        wait(0.14),
      ]),
      wait(0.8),
      cam([{ target: room, zoom: 40, yaw: Q * 5, duration: 18, ease: "linear" }]),
      ...endingLines("kristall", (i) => {
        if (i === 1)
          return [fx("insight_ring", pos, { color: 0x9d5cff, scale: 1.6 }), tone(pos, 7)];
        if (i === 2)
          return [sfx("rift", pos), fx("rift_pulse", pos, { color: 0xe8f4ff }), shake(0.3)];
        if (i === 3)
          return [sfx("echo_whisper", pos), fx("wisps", pos, { color: 0x00ffff, duration: 6 })];
        if (i === 5)
          // Three voices braided: three rings in cyan, violet and white.
          return [0x00ffff, 0x9d5cff, 0xe8f4ff].flatMap((c, k) => [
            fx("insight_ring", pos, { color: c, scale: 1.4 + k * 0.7 }),
            wait(0.3),
          ]);
        return [fx("insight_ring", pos, { color: 0x9d5cff, scale: 1 + i * 0.2 })];
      }),
      wait(1),
      // All thirty at once, white-hot orange: the crystal is whole.
      ...ring.map((p) => fx("pickup_glint", p, { color: SLICE_CORE, scale: 0.8 })),
      tone(pos, 12),
      fx("power_wave", pos, { color: SLICE_ORANGE, scale: 1.2 }),
      wait(1.2),
      cam([{ target: up(room, 8), zoom: 110, duration: 6, ease: "inOut", fade: 1 }], true),
      wait(0.8),
      flag("scene_ending_kristall"),
    ],
  };
}

/** The bot shown in the canonical `first_bot` entry (the real scene follows the woken bot). */
const DEFAULT_FIRST_BOT = BOT_QUESTS[0]!.npc;
/** The device shown in the canonical `first_device` entry. */
const DEFAULT_FIRST_DEVICE = "BTK-001";

export const SCENES: Readonly<Record<SceneId, SceneScript>> = {
  wake: wake(),
  first_power: firstPower(),
  first_device: firstDeviceScene(DEFAULT_FIRST_DEVICE),
  first_bot: firstBotScene(DEFAULT_FIRST_BOT),
  mcp_awake: mcpAwake(),
  damien_first_echo: damienFirstEcho(),
  handshake: handshake(),
  rift_open: riftOpen(),
  floor_1: floorScene(1),
  floor_2: floorScene(2),
  floor_3: floorScene(3),
  floor_4: floorScene(4),
  floor_5: floorScene(5),
  ending_frequenz: endingFrequenz(),
  ending_substrat: endingSubstrat(),
  ending_rueckkehr: endingRueckkehr(),
  ending_halo: endingHalo(),
  ending_kristall: endingKristall(),
};

// Per-subject variants of the "first X" moments (same id → same seen flag,
// so only the first device / bot ever gets one).
const deviceVariants = new Map<string, SceneScript>();
const botVariants = new Map<string, SceneScript>();

function cached(
  map: Map<string, SceneScript>,
  id: string,
  make: (id: string) => SceneScript,
): SceneScript {
  let sc = map.get(id);
  if (!sc) {
    sc = make(id);
    map.set(id, sc);
  }
  return sc;
}

const BOT_IDS: ReadonlySet<string> = new Set(BOT_QUESTS.map((q) => q.npc));

/** Which scene (if any) a game event triggers. */
export function sceneFor(trigger: SceneTrigger): SceneScript | undefined {
  switch (trigger.kind) {
    case "start":
      return SCENES.wake;
    case "device_online":
      if (trigger.id === "UEC-001") return SCENES.first_power;
      if (trigger.id === "ECR-001") return SCENES.damien_first_echo;
      if (trigger.id === "DIM-001") return SCENES.rift_open;
      return undefined;
    case "stage_built": {
      // Stage 2 of the MCP = speech module.
      if (trigger.id === "MCP-000") return trigger.stage >= 2 ? SCENES.mcp_awake : undefined;
      const d = DEVICE_BY_ID.get(trigger.id);
      if (!d || FIRST_DEVICE_EXCLUDED.has(d.id) || trigger.stage < d.stages.length)
        return undefined;
      return cached(deviceVariants, d.id, firstDeviceScene);
    }
    case "insight":
      return trigger.id === "handshake" ? SCENES.handshake : undefined;
    case "ending": {
      const id = `ending_${trigger.id}`;
      return (SCENE_IDS as readonly string[]).includes(id) ? SCENES[id as SceneId] : undefined;
    }
    case "floor_reached":
      return trigger.floor === 0 ? undefined : SCENES[`floor_${trigger.floor}`];
    case "bot_awake":
      return BOT_IDS.has(trigger.id) ? cached(botVariants, trigger.id, firstBotScene) : undefined;
  }
}

/** Flag set at the end of a scene (use to play each scene once). */
export function sceneSeenFlag(id: SceneId): string {
  return `scene_${id}`;
}

// ── Runner ────────────────────────────────────────────────────────

export interface SceneCallbacks {
  camera(shots: readonly CameraShot[]): void;
  say(who: Speaker, text: string, seconds: number): void;
  sfx(name: SfxName, at?: readonly [number, number], pitch?: number, gain?: number): void;
  fx(kind: FxKind, at: Vec3Tuple, opts?: FxOptions): void;
  music(cue: MusicScene | null, tension?: number): void;
  flag(flag: string): void;
  shake?(strength: number): void;
  fade?(to: number, seconds: number): void;
  /** Title card; hosts without one just let the step's time pass. */
  title?(title: string, sub: string | undefined, seconds: number): void;
  /** Player body language (engine `setPlayerMode`); reset to "idle" in `end`. */
  pose?(pose: CharacterPoseKind): void;
  /** A materialising figure (engine `showFigure`); hosts clear it in `end`. */
  figure?(who: "damien", at: Vec3Tuple, build: number, hold: number): void;
  begin?(script: SceneScript): void;
  end?(script: SceneScript, skipped: boolean): void;
}

function totalShotTime(shots: readonly CameraShot[]): number {
  return shots.reduce((t, s) => t + Math.max(0, s.duration) + Math.max(0, s.hold ?? 0), 0);
}

/** How long a step blocks the script (0 = instant). */
export function stepDuration(step: SceneStep): number {
  switch (step.kind) {
    case "wait":
      return Math.max(0, step.seconds);
    case "say":
      return step.async ? 0 : (step.seconds ?? readTime(step.text));
    case "camera":
      return step.wait ? totalShotTime(step.shots) : 0;
    case "title":
      return step.async ? 0 : Math.max(0, step.seconds);
    default:
      return 0;
  }
}

/** Total scripted length in seconds (without skipping). */
export function sceneDuration(script: SceneScript): number {
  return script.steps.reduce((t, s) => t + stepDuration(s), 0);
}

export class SceneRunner {
  private idx = 0;
  private started = false;
  private remaining = 0;
  private running = false;
  private finished = false;
  private wasSkipped = false;
  private time = 0;

  constructor(
    readonly script: SceneScript,
    private readonly cb: SceneCallbacks,
  ) {}

  get done(): boolean {
    return this.finished;
  }

  get skipped(): boolean {
    return this.wasSkipped;
  }

  get stepIndex(): number {
    return this.idx;
  }

  get elapsed(): number {
    return this.time;
  }

  start(): void {
    if (this.running || this.finished) return;
    this.running = true;
    this.cb.begin?.(this.script);
    this.update(0);
  }

  update(dt: number): void {
    if (!this.running || this.finished) return;
    let left = Math.max(0, dt);
    this.time += left;
    const steps = this.script.steps;
    while (this.idx < steps.length) {
      const step = steps[this.idx]!;
      if (!this.started) {
        this.started = true;
        this.remaining = stepDuration(step);
        this.exec(step);
      }
      if (this.remaining > 0) {
        const used = Math.min(left, this.remaining);
        this.remaining -= used;
        left -= used;
        if (this.remaining > 1e-9) return;
      }
      this.idx++;
      this.started = false;
    }
    this.finish(false);
  }

  /**
   * Skip to the end. Flags are still set and the last music cue is
   * applied, so skipping never loses game state.
   */
  skip(): void {
    if (this.finished) return;
    if (!this.running) {
      this.running = true;
      this.cb.begin?.(this.script);
    }
    const steps = this.script.steps;
    let lastMusic: Extract<SceneStep, { kind: "music" }> | null = null;
    for (let i = this.started ? this.idx + 1 : this.idx; i < steps.length; i++) {
      const s = steps[i]!;
      if (s.kind === "flag") this.cb.flag(s.flag);
      if (s.kind === "music") lastMusic = s;
    }
    if (lastMusic) this.cb.music(lastMusic.cue, lastMusic.tension);
    this.idx = steps.length;
    this.wasSkipped = true;
    this.finish(true);
  }

  private finish(skipped: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.cb.end?.(this.script, skipped);
  }

  private exec(step: SceneStep): void {
    const cb = this.cb;
    switch (step.kind) {
      case "camera":
        cb.camera(step.shots);
        break;
      case "say":
        cb.say(step.who, step.text, step.seconds ?? readTime(step.text));
        break;
      case "sfx":
        cb.sfx(step.name, step.at, step.pitch, step.gain);
        break;
      case "fx":
        cb.fx(step.fx, step.at, step.opts);
        break;
      case "music":
        cb.music(step.cue, step.tension);
        break;
      case "flag":
        cb.flag(step.flag);
        break;
      case "shake":
        cb.shake?.(step.strength);
        break;
      case "fade":
        cb.fade?.(step.to, step.seconds);
        break;
      case "title":
        cb.title?.(step.title, step.sub, step.seconds);
        break;
      case "pose":
        cb.pose?.(step.pose);
        break;
      case "figure":
        cb.figure?.(step.who, step.at, step.build, step.hold);
        break;
      case "wait":
        break;
    }
  }
}

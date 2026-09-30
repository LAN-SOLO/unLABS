/**
 * The title-screen lab as a little aquarium (pure, deterministic).
 * ================================================================
 *
 * Jade works in a corner of the control room while the menu is open: she
 * repairs and services devices (wrench in hand), types at the MCP, runs an
 * experiment at the workbench, fetches coffee, drops into the swivel chair
 * and spins, thinks, stretches, celebrates, swears quietly. Devices glitch
 * and break (sparks, smoke) and get repaired — or not, the first time. Bots
 * come in through the door: B4C-0N brings coffee, P1N-DR0 holds the light
 * during a hard repair, F1N-DR scans the room, W2-REK rams the chair, K2-LDR
 * delivers an index card that gives Jade an idea. The MCP comments, dryly.
 *
 * Her mood comes from the emotion model (lib/world/emotion.ts): events are
 * appraised, needs drive the next task, and the resulting expression, pose,
 * gesture and speech bubbles are what `step()` hands the renderer
 * (lib/world/render/title-diorama.ts).
 *
 * Units: world units, floor centre = origin, x right, z towards the viewer;
 * walls on the −x and −z edges. Yaw 0 faces +z.
 */
import {
  appraise,
  dominant,
  expression,
  initialEmotions,
  stepEmotions,
  wants,
  type Activity,
  type EmotionState,
  type Expression,
  type LabEvent,
} from "@/lib/world/emotion";
import { BOT_LINES, JADE_LINES, MCP_LINES } from "@/lib/world/content/title-lines";
import type { Gesture } from "@/lib/world/models/gestures";
import type { CharacterPoseKind } from "@/lib/world/models/rig";

export type XZ = [number, number];

/** The room (world units). Walls stand at x = −W/2 and z = −D/2. */
export const LIFE_ROOM = { w: 34, d: 24 } as const;
/** Walkways run along this z line (clear of every machine). */
export const AISLE_Z = -0.2;
/** Door in the back wall (x of its centre), bots come and go through it. */
export const DOOR_X = 12.5;
export const DOOR_IN: XZ = [DOOR_X, -9.4];
export const DOOR_OUT: XZ = [DOOR_X, -14.5];

export type StationId = "mcp" | "drone" | "bench" | "desk" | "coffee" | "table";

export interface Station {
  id: StationId;
  /** Where the machine / furniture stands and how it is turned (renderer). */
  x: number;
  z: number;
  rot: number;
  /** Where Jade stands (or sits) to use it, and the yaw she faces. */
  spot: XZ;
  face: number;
  /** Where a helper bot waits beside her (clear of the machine). */
  helper: XZ;
  /** Can glitch / break. */
  breakable: boolean;
  /** Pose while working here. */
  pose: CharacterPoseKind;
}

const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);

export const STATIONS: Readonly<Record<StationId, Station>> = {
  mcp: {
    id: "mcp",
    x: -4,
    z: -9.3,
    rot: 0,
    spot: [-4, -4.8],
    face: Math.PI,
    helper: [-6.8, -4.2],
    breakable: true,
    pose: "typing",
  },
  drone: {
    id: "drone",
    x: 10.8,
    z: 5.8,
    rot: -Math.PI / 2,
    spot: [4.6, 5.8],
    face: Math.PI / 2,
    helper: [3.4, 3],
    breakable: true,
    pose: "work",
  },
  bench: {
    id: "bench",
    x: -13.8,
    z: 5,
    rot: Math.PI / 2,
    spot: [-9.4, 5],
    face: -Math.PI / 2,
    helper: [-8.4, 2.4],
    breakable: true,
    pose: "work",
  },
  desk: {
    id: "desk",
    x: -14.8,
    z: -5,
    rot: Math.PI / 2,
    spot: [-11.2, -5],
    face: -Math.PI / 2,
    helper: [-8.4, -2.6],
    breakable: false,
    pose: "sit",
  },
  coffee: {
    id: "coffee",
    x: 2.8,
    z: -10.6,
    rot: 0,
    spot: [2.8, -8.2],
    face: Math.PI,
    helper: [5.4, -7.4],
    breakable: true,
    pose: "drink",
  },
  table: {
    id: "table",
    x: -0.6,
    z: 7.5,
    rot: 0,
    spot: [-0.6, 4.4],
    face: 0,
    helper: [2.2, 3.2],
    breakable: false,
    pose: "work",
  },
};

/** The swivel chair in front of the desk (seat 1.25 high, feet on the star base). */
export const CHAIR: XZ = [-11.2, -5];
/** The crate stack W2-REK likes to ram (renderer wobbles it). */
export const CRATE: XZ = [-7.2, 10.3];

// ── Small helpers ────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function turnTo(cur: number, goal: number, dt: number, rate: number): number {
  const d = wrap(goal - cur);
  const step = rate * dt;
  return Math.abs(d) <= step ? goal : wrap(cur + Math.sign(d) * step);
}

/** Route over the aisle: leave the station straight to the aisle, walk along it, go in. */
export function route(from: XZ, to: XZ): XZ[] {
  const out: XZ[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) < 0.8;
  if (near(from[1], AISLE_Z) && near(to[1], AISLE_Z)) return [to];
  if (!near(from[1], AISLE_Z)) out.push([from[0], AISLE_Z]);
  if (!near(from[0], to[0])) out.push([to[0], AISLE_Z]);
  out.push(to);
  return out.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - out[i - 1]![0], p[1] - out[i - 1]![1]) > 0.05,
  );
}

// ── Frame handed to the renderer ────────────────────────────────

export type FxKind = "sparks" | "smoke" | "confetti" | "steam" | "bang" | "idea" | "hearts";

export interface FxEvent {
  kind: FxKind;
  x: number;
  y: number;
  z: number;
}

export type Speaker = "jade" | "mcp" | string;

export interface Bubble {
  id: number;
  who: Speaker;
  text: string;
  /** Seconds it stays up. */
  ttl: number;
}

export type DeviceHealth = "ok" | "glitch" | "broken";

export interface DeviceFrame {
  health: DeviceHealth;
  /** Seconds in the current health state. */
  t: number;
  /** Being repaired right now. */
  repairing: boolean;
}

export interface JadeFrame {
  x: number;
  z: number;
  yaw: number;
  pose: CharacterPoseKind;
  /** Increments whenever a new pose starts (the renderer switches its track). */
  poseSeq: number;
  moving: boolean;
  speed: number;
  /** Sitting in the swivel chair (root follows the chair). */
  seated: boolean;
  gesture: { g: Gesture; t: number } | null;
  expression: Expression;
  /** Strongest emotion right now (for debugging / docs). */
  mood: string;
}

export interface BotFrame {
  id: string;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  /** Distance travelled (wheels / legs). */
  travel: number;
  /** Happy hop 0..1. */
  hop: number;
  carry: "mug" | "card" | null;
}

export interface LifeFrame {
  time: number;
  jade: JadeFrame;
  bots: BotFrame[];
  devices: Record<StationId, DeviceFrame>;
  /** Door opening 0..1. */
  door: number;
  /** Swivel chair yaw (rad). */
  chairYaw: number;
  /** Crate wobble after a bump (0..1, decays). */
  crateWobble: number;
  /** New effects / bubbles since the last step. */
  fx: FxEvent[];
  bubbles: Bubble[];
}

// ── Jade's tasks ─────────────────────────────────────────────────

type TaskKind =
  | "repair"
  | "service"
  | "type"
  | "experiment"
  | "rest"
  | "coffee"
  | "think"
  | "celebrate"
  | "receive"
  | "react";

interface Task {
  kind: TaskKind;
  station?: StationId;
  /** Where to go first (null = act where she is). */
  goal: XZ | null;
  face?: number;
  pose: CharacterPoseKind;
  /** Seconds of acting. */
  dur: number;
  t: number;
  /** Repair: progress 0..1 and attempt count. */
  progress?: number;
  attempts?: number;
  /** Receive: the bot handing something over. */
  bot?: string;
  /** Rest: spin impulse applied. */
  spun?: boolean;
}

type Mission = "deliver" | "assist" | "patrol" | "mischief" | "paper";

interface Bot {
  id: string;
  mission: Mission;
  x: number;
  z: number;
  yaw: number;
  path: XZ[];
  speed: number;
  phase: "in" | "act" | "out";
  t: number;
  travel: number;
  hop: number;
  carry: "mug" | "card" | null;
  target?: StationId;
  patrol?: XZ[];
  done?: boolean;
  greeted?: boolean;
}

const BOT_FOR: Record<Mission, string> = {
  deliver: "b4c0n",
  assist: "p1ndr0",
  patrol: "f1ndr",
  mischief: "w2rek",
  paper: "k2ldr",
};

const WALK_SPEED = 6.2;
const BOT_SPEED = 4.6;

export class LabLife {
  time = 0;
  readonly emo: EmotionState = initialEmotions();
  private readonly rnd: () => number;
  private jx: number;
  private jz: number;
  private jyaw: number;
  private path: XZ[] = [];
  private moving = false;
  private task: Task | null = null;
  private pose: CharacterPoseKind = "idle";
  private poseSeq = 0;
  private gesture: { g: Gesture; t: number } | null = null;
  private seated = false;
  private chairYaw = Math.PI / 2;
  private chairVel = 0;
  private crateWobble = 0;
  private door = 0;
  private readonly bots: Bot[] = [];
  private readonly devices: Record<StationId, DeviceFrame>;
  private fx: FxEvent[] = [];
  private bubbles: Bubble[] = [];
  private bubbleId = 0;
  private sayCooldown = 0;
  private mcpCooldown = 18;
  private nextBreak: number;
  private nextBot = 9;
  private lastDelivery = -999;
  private lastCelebrate = -999;
  private readonly lastLine = new Map<readonly string[], string>();
  private idleT = 0;
  /** Everything that happened, for tests and the docs (kind → count). */
  readonly stats: Record<string, number> = {};

  constructor(seed = 89) {
    this.rnd = mulberry32(seed);
    const s = STATIONS.mcp.spot;
    this.jx = s[0];
    this.jz = s[1];
    this.jyaw = STATIONS.mcp.face;
    this.devices = Object.fromEntries(
      (Object.keys(STATIONS) as StationId[]).map((k) => [
        k,
        { health: "ok", t: 0, repairing: false },
      ]),
    ) as Record<StationId, DeviceFrame>;
    this.nextBreak = 20 + this.rnd() * 12;
    this.startTask(this.pickTask());
  }

  private count(k: string): void {
    this.stats[k] = (this.stats[k] ?? 0) + 1;
  }

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rnd() * list.length)]!;
  }

  private say(who: Speaker, lines: readonly string[], force = false, ttl = 3.2): void {
    if (!force && this.sayCooldown > 0) return;
    // Never the same line twice in a row.
    let text = this.pick(lines);
    if (lines.length > 1 && text === this.lastLine.get(lines))
      text = this.pick(lines.filter((l) => l !== text));
    this.lastLine.set(lines, text);
    this.bubbles.push({ id: ++this.bubbleId, who, text, ttl });
    if (who === "jade") this.sayCooldown = 4;
    this.count(`say_${who}`);
  }

  private feel(e: LabEvent, strength = 1): void {
    appraise(this.emo, e, strength);
    this.count(`ev_${e}`);
  }

  private doGesture(g: Gesture): void {
    this.gesture = { g, t: 0 };
    this.count(`gesture_${g}`);
  }

  private setPose(p: CharacterPoseKind): void {
    if (p === this.pose) return;
    this.pose = p;
    this.poseSeq++;
    this.count(`pose_${p}`);
  }

  private emit(kind: FxKind, x: number, z: number, y = 2): void {
    this.fx.push({ kind, x, y, z });
    this.count(`fx_${kind}`);
  }

  /** Effect at the working face of a machine (between its centre and Jade's spot), not inside it. */
  private emitAt(kind: FxKind, st: Station, y: number): void {
    const k = 0.55;
    this.emit(kind, st.x + (st.spot[0] - st.x) * k, st.z + (st.spot[1] - st.z) * k, y);
  }

  // ── Task choice ────────────────────────────────────────────────

  private brokenStation(): StationId | null {
    let best: StationId | null = null;
    for (const k of Object.keys(this.devices) as StationId[])
      if (this.devices[k].health === "broken" && (!best || k === "coffee")) best = k;
    return best;
  }

  private stationTask(kind: TaskKind, id: StationId, dur: number, pose?: CharacterPoseKind): Task {
    const st = STATIONS[id];
    return { kind, station: id, goal: st.spot, face: st.face, pose: pose ?? st.pose, dur, t: 0 };
  }

  private pickTask(): Task {
    const want = wants(this.emo);
    const broken = this.brokenStation();
    if (want === "drink" && this.devices.coffee.health === "ok")
      return this.stationTask("coffee", "coffee", 5.5, "drink");
    if (want === "rest" || (want === "break" && this.rnd() < 0.6))
      return {
        kind: "rest",
        goal: CHAIR,
        face: STATIONS.desk.face,
        pose: "sit",
        dur: 10 + this.rnd() * 8,
        t: 0,
      };
    if (want === "celebrate" && this.time - this.lastCelebrate > 40) {
      this.lastCelebrate = this.time;
      return { kind: "celebrate", goal: null, pose: "celebrate", dur: 3, t: 0 };
    }
    if (broken)
      return {
        ...this.stationTask(
          "repair",
          broken,
          99,
          broken === "coffee" || broken === "drone" ? "crouch" : "work",
        ),
        progress: 0,
        attempts: 0,
      };
    if (want === "play" && this.rnd() < 0.7)
      return {
        kind: "rest",
        goal: CHAIR,
        face: STATIONS.desk.face,
        pose: "sit",
        dur: 8 + this.rnd() * 6,
        t: 0,
      };
    const r = this.rnd();
    if (r < 0.28) return this.stationTask("type", "mcp", 9 + this.rnd() * 6, "typing");
    if (r < 0.5) return this.stationTask("service", "drone", 8 + this.rnd() * 5, "work");
    if (r < 0.68) return this.stationTask("experiment", "bench", 9 + this.rnd() * 5, "work");
    if (r < 0.82)
      return this.stationTask(
        "service",
        "table",
        7 + this.rnd() * 4,
        this.rnd() < 0.5 ? "read" : "work",
      );
    if (r < 0.92 && this.devices.coffee.health === "ok")
      return this.stationTask("coffee", "coffee", 5, "drink");
    return {
      kind: "think",
      goal: [(this.rnd() - 0.5) * 12, AISLE_Z + 2 + this.rnd() * 3],
      pose: "think",
      dur: 5 + this.rnd() * 3,
      t: 0,
    };
  }

  private startTask(t: Task): void {
    this.task = t;
    this.count(`task_${t.kind}`);
    if (this.seated && t.kind !== "rest") this.standUp();
    if (t.goal && Math.hypot(t.goal[0] - this.jx, t.goal[1] - this.jz) > 0.3) {
      this.path = route([this.jx, this.jz], t.goal);
      this.moving = true;
      this.setPose("walk");
    } else this.beginAct();
  }

  private beginAct(): void {
    const t = this.task!;
    this.moving = false;
    this.path = [];
    if (t.kind === "rest") {
      this.seated = true;
      this.chairYaw = t.face ?? this.chairYaw;
    }
    this.setPose(t.pose);
    if (t.station) this.devices[t.station].repairing = t.kind === "repair";
    if (t.kind === "repair") this.say("jade", JADE_LINES.repairStart);
    if (t.kind === "think") this.say("jade", JADE_LINES.think);
    if (t.kind === "celebrate") this.doGesture(this.rnd() < 0.5 ? "fistPump" : "clap");
  }

  private standUp(): void {
    this.seated = false;
    this.jx = CHAIR[0] + 1.6;
    this.jz = CHAIR[1] + 0.8;
  }

  private finishTask(): void {
    const t = this.task;
    if (t?.station) this.devices[t.station].repairing = false;
    if (t?.kind === "rest") this.standUp();
    if (t?.pose === "celebrate") {
      // The high settles after celebrating.
      this.emo.e.joy *= 0.6;
      this.emo.e.pride *= 0.6;
    }
    this.task = null;
    this.startTask(this.pickTask());
  }

  /** Interrupt whatever she does for a reaction in place. */
  private react(pose: CharacterPoseKind, dur: number): void {
    const t = this.task;
    if (t?.station) this.devices[t.station].repairing = false;
    if (this.seated) this.standUp();
    this.task = { kind: "react", goal: null, pose, dur, t: 0 };
    this.moving = false;
    this.path = [];
    this.setPose(pose);
  }

  // ── Acting ────────────────────────────────────────────────────

  private act(dt: number): void {
    const t = this.task!;
    t.t += dt;
    const st = t.station ? STATIONS[t.station] : null;
    switch (t.kind) {
      case "repair": {
        const dev = this.devices[t.station!];
        if (dev.health !== "broken") return this.finishTask();
        const helped = this.bots.some((b) => b.mission === "assist" && b.phase === "act");
        t.progress = (t.progress ?? 0) + dt * (helped ? 0.2 : 0.13);
        if (t.t % 3 < dt && this.rnd() < 0.5) this.emitAt("sparks", st!, 2.2);
        if (t.progress >= 1) {
          t.attempts = (t.attempts ?? 0) + 1;
          const chance =
            0.35 + 0.2 * (t.attempts - 1) + (helped ? 0.35 : 0) + this.emo.mood[0] * 0.1;
          if (this.rnd() < chance) {
            dev.health = "ok";
            dev.t = 0;
            this.feel("repair_success");
            this.count("repaired");
            this.emitAt("confetti", st!, 3);
            this.say("jade", JADE_LINES.repairSuccess, true);
            if (this.rnd() < 0.25) this.mcpSay(MCP_LINES.afterSuccess);
            this.react("celebrate", 2.6);
            this.doGesture(this.pick(["fistPump", "thumbsUp", "clap"] as const));
            for (const b of this.bots) if (b.mission === "assist") b.hop = 1;
          } else {
            t.progress = 0.15;
            this.feel("repair_fail");
            this.count("repairFailed");
            this.emitAt("sparks", st!, 2.5);
            this.emitAt("smoke", st!, 2.8);
            this.say("jade", JADE_LINES.repairFail, true);
            this.doGesture(this.pick(["facepalm", "headShake", "stomp", "sigh"] as const));
            if (this.rnd() < 0.3) this.mcpSay(MCP_LINES.afterFail);
            if (this.emo.e.frustration > 0.8 && this.rnd() < 0.5) {
              // Walk it off: a short break, then back at it.
              this.say("jade", JADE_LINES.tired);
              this.finishTask();
            }
          }
        } else if (t.t > 0.5 && t.t % 4 < dt) this.feel("repair_progress", 0.5);
        return;
      }
      case "type":
        if (t.t % 3 < dt) this.feel("typing_progress", 0.6);
        if (t.t > 2 && t.t % 5 < dt && this.rnd() < 0.3)
          this.doGesture(this.pick(["nod", "scratchHead"] as const));
        break;
      case "service":
        if (t.t % 3.5 < dt) this.feel("repair_progress", 0.4);
        if (t.t > t.dur - dt && this.rnd() < 0.35) {
          this.feel("idea");
          this.emit("idea", this.jx, this.jz, 6.4);
          this.say("jade", JADE_LINES.idea);
        }
        break;
      case "experiment":
        if (t.t > t.dur - dt) {
          const r = this.rnd();
          if (r < 0.4) {
            this.emitAt("bang", st!, 2.4);
            this.emitAt("smoke", st!, 3);
            this.feel("explosion");
            this.say("jade", JADE_LINES.explosion, true);
            this.react("startle", 1.2);
            this.count("explosion");
            return;
          }
          if (r < 0.8) {
            this.feel("repair_success", 0.7);
            this.emitAt("confetti", st!, 2.8);
            this.react("celebrate", 2.4);
            this.doGesture("fistPump");
            return;
          }
          this.feel("repair_fail", 0.5);
          this.doGesture("shrug");
        }
        break;
      case "rest":
        if (
          !t.spun &&
          t.t > 1.4 &&
          (this.emo.e.amusement > 0.3 || this.emo.e.boredom > 0.3 || this.rnd() < 0.5)
        ) {
          t.spun = true;
          this.chairVel = (this.rnd() < 0.5 ? -1 : 1) * (7 + this.rnd() * 5);
          this.feel("spin");
          this.say("jade", JADE_LINES.spin);
          if (this.rnd() < 0.3) this.mcpSay(MCP_LINES.spin);
          this.count("spin");
        }
        if (this.emo.needs.energy < 0.2 && t.t % 6 < dt) this.say("jade", JADE_LINES.tired);
        if (t.t > t.dur * 0.6 && !this.gesture && this.rnd() < dt * 0.2) this.doGesture("stretch");
        break;
      case "coffee":
        if (t.t > 1 && t.t - dt <= 1) {
          if (this.devices.coffee.health !== "ok") {
            this.say("jade", JADE_LINES.coffeeBroken, true);
            this.feel("repair_fail", 0.6);
            this.doGesture("stomp");
            this.emitAt("steam", STATIONS.coffee, 5.6);
            return this.finishTask();
          }
          this.emitAt("steam", STATIONS.coffee, 5.8);
        }
        if (t.t > 3 && t.t - dt <= 3) {
          this.feel("drink");
          this.say("jade", JADE_LINES.drink);
        }
        break;
      case "think":
        if (t.t > 1 && !this.gesture && this.rnd() < dt * 0.4)
          this.doGesture(this.pick(["scratchHead", "lookAround"] as const));
        break;
      case "receive": {
        const bot = this.bots.find((b) => b.id === t.bot);
        if (bot) this.jyaw = turnTo(this.jyaw, yawTo(bot.x - this.jx, bot.z - this.jz), dt, 4);
        break;
      }
      default:
        break;
    }
    if (t.t >= t.dur) this.finishTask();
  }

  private mcpSay(lines: readonly string[]): void {
    this.say("mcp", lines, true, 3.6);
    this.mcpCooldown = 35 + this.rnd() * 30;
  }

  // ── Devices ────────────────────────────────────────────────────

  private stepDevices(dt: number): void {
    for (const k of Object.keys(this.devices) as StationId[]) this.devices[k].t += dt;
    this.nextBreak -= dt;
    if (this.nextBreak <= 0) {
      this.nextBreak = 45 + this.rnd() * 50;
      const cands = (Object.keys(STATIONS) as StationId[]).filter(
        (k) => STATIONS[k].breakable && this.devices[k].health === "ok" && this.task?.station !== k,
      );
      if (cands.length) {
        const k = this.pick(cands);
        this.devices[k] = { health: "glitch", t: 0, repairing: false };
        this.count("glitch");
      }
    }
    for (const k of Object.keys(this.devices) as StationId[]) {
      const d = this.devices[k];
      const st = STATIONS[k];
      if (d.health === "glitch") {
        if (d.t % 1.1 < dt) this.emitAt("sparks", st!, 2.6);
        if (d.t > 3.5) {
          if (this.rnd() < 0.6) {
            this.devices[k] = { health: "broken", t: 0, repairing: false };
            this.count("broken");
            this.emitAt("bang", st!, 2.4);
            this.emitAt("smoke", st!, 3);
            this.feel("device_break");
            // Look at it, react, then (by task choice) go and fix it.
            this.react("startle", 1.1);
            this.say(
              "jade",
              k === "coffee" ? JADE_LINES.coffeeBroken : JADE_LINES.deviceBreak,
              true,
            );
            if (this.rnd() < 0.25) this.mcpSay(MCP_LINES.afterBreak);
          } else {
            d.health = "ok";
            d.t = 0;
            this.feel("device_glitch", 0.5);
          }
        }
      } else if (d.health === "broken") {
        if (d.t % 2.2 < dt) this.emitAt("smoke", st!, 3);
        if (d.t % 3.1 < dt && this.rnd() < 0.6) this.emitAt("sparks", st!, 2.4);
      }
    }
  }

  // ── Bots ───────────────────────────────────────────────────────

  private spawnBot(mission: Mission): void {
    const id = BOT_FOR[mission];
    if (this.bots.some((b) => b.id === id)) return;
    const b: Bot = {
      id,
      mission,
      x: DOOR_OUT[0],
      z: DOOR_OUT[1],
      yaw: 0,
      path: [DOOR_IN],
      speed: mission === "mischief" ? BOT_SPEED * 1.5 : BOT_SPEED,
      phase: "in",
      t: 0,
      travel: 0,
      hop: 0,
      carry: mission === "deliver" ? "mug" : mission === "paper" ? "card" : null,
    };
    if (mission === "assist") b.target = this.task?.station;
    if (mission === "patrol")
      b.patrol = [
        [3, 2],
        [-5, 3],
        [-8, -1.5],
        [0, -3],
      ];
    this.bots.push(b);
    this.count(`bot_${mission}`);
    this.say(id, BOT_LINES[id] ?? ["…"], true, 2.6);
  }

  private botGoal(b: Bot): XZ {
    switch (b.mission) {
      case "deliver":
      case "paper": {
        // Come in from the aisle side (never through a machine); on the aisle, from the door side.
        const dz = AISLE_Z - this.jz;
        const a = Math.abs(dz) > 1 ? yawTo(0, dz) : yawTo(DOOR_X - this.jx, -6 - this.jz);
        return [this.jx + Math.sin(a) * 2.6, this.jz + Math.cos(a) * 2.6];
      }
      case "assist": {
        return STATIONS[b.target ?? "drone"].helper;
      }
      case "mischief":
        return this.seated ? [CHAIR[0] + 1.3, CHAIR[1] + 1.2] : [CRATE[0], CRATE[1] - 2.9];
      case "patrol":
        return b.patrol![0]!;
    }
  }

  private scheduleBots(dt: number): void {
    this.nextBot -= dt;
    if (this.nextBot > 0 || this.bots.length >= 2) return;
    this.nextBot = 14 + this.rnd() * 18;
    const t = this.task;
    let m: Mission;
    if (t?.kind === "repair" && (t.attempts ?? 0) >= 1) m = "assist";
    else if (this.emo.needs.thirst > 0.45 && this.time - this.lastDelivery > 100) m = "deliver";
    else if (this.seated && this.rnd() < 0.5) m = "mischief";
    else {
      const coffeeDue = this.time - this.lastDelivery > 100;
      m = this.pick(
        coffeeDue
          ? (["patrol", "paper", "mischief", "deliver", "patrol"] as const)
          : (["patrol", "paper", "mischief", "patrol"] as const),
      );
    }
    if (m === "deliver") this.lastDelivery = this.time;
    this.spawnBot(m);
  }

  private stepBot(b: Bot, dt: number): void {
    b.t += dt;
    b.hop = Math.max(0, b.hop - dt * 1.2);
    // Walk the path.
    const next = b.path[0];
    if (next) {
      const dx = next[0] - b.x;
      const dz = next[1] - b.z;
      const d = Math.hypot(dx, dz);
      const step = b.speed * dt;
      if (d <= step) {
        b.x = next[0];
        b.z = next[1];
        b.path.shift();
      } else {
        b.x += (dx / d) * step;
        b.z += (dz / d) * step;
        b.yaw = turnTo(b.yaw, yawTo(dx, dz), dt, 6);
      }
      b.travel += Math.min(step, d);
      // The mission clock counts from arrival.
      b.t = 0;
      return;
    }
    if (b.phase === "in") {
      // Through the door: now over the aisle to where the mission is.
      b.path = route([b.x, b.z], this.botGoal(b));
      b.phase = "act";
      b.t = 0;
      return;
    }
    if (b.phase === "act") this.botAct(b, dt);
    else if (b.phase === "out") b.done = true;
  }

  private botLeave(b: Bot): void {
    b.phase = "out";
    b.path = [...route([b.x, b.z], [DOOR_X, AISLE_Z]), DOOR_IN, DOOR_OUT];
  }

  private botAct(b: Bot, dt: number): void {
    const faceJade = () => {
      b.yaw = turnTo(b.yaw, yawTo(this.jx - b.x, this.jz - b.z), dt, 5);
    };
    switch (b.mission) {
      case "deliver":
      case "paper": {
        // Follow Jade if she moved; hand over when close.
        const g = this.botGoal(b);
        if (Math.hypot(g[0] - b.x, g[1] - b.z) > 1.5 && !b.greeted) {
          b.path = route([b.x, b.z], g);
          return;
        }
        b.greeted = true;
        faceJade();
        if (b.carry && b.t > 0.6) {
          const gift = b.carry;
          b.carry = null;
          b.hop = 1;
          if (gift === "mug") {
            this.react("drink", 4.2);
            this.task!.kind = "receive";
            this.task!.bot = b.id;
            this.feel("gift");
            this.say("jade", JADE_LINES.thanksDrink, true);
            this.emit("hearts", this.jx, this.jz, 6);
          } else {
            this.react("read", 3.4);
            this.task!.kind = "receive";
            this.task!.bot = b.id;
            this.feel("idea");
            this.emit("idea", this.jx, this.jz, 6.4);
            this.say("jade", JADE_LINES.idea, true);
          }
          this.count(`gift_${gift}`);
        }
        if (!b.carry && b.t > 2.4) this.botLeave(b);
        return;
      }
      case "assist": {
        const dev = b.target ? this.devices[b.target] : undefined;
        faceJade();
        if (!b.greeted) {
          b.greeted = true;
          this.feel("bot_help");
          this.say("jade", JADE_LINES.thanksHelp);
        }
        if (!dev || dev.health === "ok" || b.t > 30) this.botLeave(b);
        return;
      }
      case "mischief": {
        if (!b.greeted) {
          b.greeted = true;
          if (this.seated) {
            this.chairVel = (this.rnd() < 0.5 ? -1 : 1) * 14;
            this.feel("bot_mischief");
            this.say("jade", JADE_LINES.mischief, true);
            this.doGesture("lookAround");
          } else {
            this.crateWobble = 1;
            this.feel("bot_mischief", 0.6);
            this.say("jade", JADE_LINES.careful, true);
          }
          this.count("mischief");
        }
        if (b.t > 0.9) this.botLeave(b);
        return;
      }
      case "patrol": {
        if (!b.greeted && this.task && this.task.kind !== "repair" && !this.seated) {
          b.greeted = true;
          this.feel("bot_greets");
          this.say("jade", JADE_LINES.greetBot);
          this.doGesture("nod");
        }
        const rest = b.patrol!.slice(1);
        if (rest.length) {
          b.patrol = rest;
          b.path = route([b.x, b.z], rest[0]!);
        } else this.botLeave(b);
        return;
      }
    }
  }

  // ── Step ───────────────────────────────────────────────────────

  step(dt: number): LifeFrame {
    this.time += dt;
    this.sayCooldown -= dt;
    this.mcpCooldown -= dt;
    this.fx = [];
    this.bubbles = [];

    this.stepDevices(dt);
    this.scheduleBots(dt);

    // Jade: walk or act.
    let activity: Activity = "idle";
    if (this.moving) {
      activity = "walk";
      const next = this.path[0];
      if (!next) this.beginAct();
      else {
        const dx = next[0] - this.jx;
        const dz = next[1] - this.jz;
        const d = Math.hypot(dx, dz);
        const step = WALK_SPEED * dt;
        if (d <= step) {
          this.jx = next[0];
          this.jz = next[1];
          this.path.shift();
          if (!this.path.length) this.beginAct();
        } else {
          this.jx += (dx / d) * step;
          this.jz += (dz / d) * step;
          this.jyaw = turnTo(this.jyaw, yawTo(dx, dz), dt, 7);
        }
      }
    } else if (this.task) {
      if (this.task.face !== undefined && !this.seated)
        this.jyaw = turnTo(this.jyaw, this.task.face, dt, 5);
      const k = this.task.kind;
      activity =
        k === "repair" || k === "service" || k === "experiment"
          ? "work"
          : k === "type"
            ? "type"
            : k === "rest"
              ? "rest"
              : k === "celebrate"
                ? "celebrate"
                : k === "coffee" || k === "receive"
                  ? "drink"
                  : "idle";
      this.act(dt);
    }

    // Chair spin (friction) — Jade turns with it.
    if (Math.abs(this.chairVel) > 0.01) {
      this.chairYaw = wrap(this.chairYaw + this.chairVel * dt);
      this.chairVel *= Math.exp(-dt * 0.9);
      if (Math.abs(this.chairVel) < 0.3) this.chairVel = 0;
    } else if (this.seated) this.chairYaw = turnTo(this.chairYaw, STATIONS.desk.face, dt, 1.2);
    if (this.seated) {
      this.jx = CHAIR[0];
      this.jz = CHAIR[1];
      this.jyaw = this.chairYaw;
    }
    this.crateWobble = Math.max(0, this.crateWobble - dt * 0.8);

    // Bots.
    for (const b of this.bots) this.stepBot(b, dt);
    for (let i = this.bots.length - 1; i >= 0; i--) if (this.bots[i]!.done) this.bots.splice(i, 1);

    // Door: open while a bot is near it.
    const near = this.bots.some((b) => Math.hypot(b.x - DOOR_X, b.z - (DOOR_IN[1] - 2)) < 4.5);
    this.door = Math.max(0, Math.min(1, this.door + (near ? dt : -dt) / 0.45));

    // Gesture clock.
    if (this.gesture) {
      this.gesture.t += dt;
      if (this.gesture.t > 3) this.gesture = null;
    }

    // Emotions and the occasional aside.
    stepEmotions(this.emo, dt, activity);
    this.idleT = activity === "idle" ? this.idleT + dt : 0;
    if (this.idleT > 12) {
      this.idleT = 0;
      this.say("jade", JADE_LINES.bored);
    }
    if (this.mcpCooldown <= 0) this.mcpSay(MCP_LINES.snark);

    const d = dominant(this.emo);
    return {
      time: this.time,
      jade: {
        x: this.jx,
        z: this.jz,
        yaw: this.jyaw,
        pose: this.pose,
        poseSeq: this.poseSeq,
        moving: this.moving,
        speed: this.moving ? WALK_SPEED : 0,
        seated: this.seated,
        gesture: this.gesture ? { ...this.gesture } : null,
        expression: expression(this.emo),
        mood: `${d.emotion} ${d.intensity.toFixed(2)}`,
      },
      bots: this.bots.map((b) => ({
        id: b.id,
        x: b.x,
        z: b.z,
        yaw: b.yaw,
        moving: b.path.length > 0,
        travel: b.travel,
        hop: b.hop,
        carry: b.carry,
      })),
      devices: Object.fromEntries(
        (Object.keys(this.devices) as StationId[]).map((k) => [k, { ...this.devices[k] }]),
      ) as Record<StationId, DeviceFrame>,
      door: this.door,
      chairYaw: this.chairYaw,
      crateWobble: this.crateWobble,
      fx: this.fx,
      bubbles: this.bubbles,
    };
  }
}

/**
 * NPC brain — pure behaviour for the lab's lore bots.
 * ===================================================
 *
 * No three.js import: the engine feeds a collision probe, the player and
 * the other NPCs, and applies the returned pose (position, yaw, activity
 * weights) to the bot's group. Behaviours:
 *
 * - `idle`  — pause at a spot, glance around now and then.
 * - `walk`  — steer to a goal: seek + separation from other characters +
 *             feeler-based wall avoidance on the floor collider; turn first,
 *             then accelerate (no snapping, no sliding sideways).
 * - `work`  — stand at a station (device, terminal, desk), face it and
 *             fidget (the engine adds lean / scan motions).
 * - `watch` — the player is close: stop and turn toward her.
 *
 * Everything is deterministic from the seed, so tests can drive it.
 */
import { angleDelta, turnToward, wrapAngle } from "@/lib/world/render/motion";

export type NpcMode = "idle" | "walk" | "work" | "watch";

/** Something a bot can work at: its centre and where to stand. */
export interface Station {
  /** Centre of the station (what the bot faces). */
  x: number;
  z: number;
  /** Stand point in front of it (free floor). */
  sx: number;
  sz: number;
}

export interface NpcBrainConfig {
  homeX: number;
  homeZ: number;
  /** Wander radius (0 = stays put). */
  wander: number;
  stations: readonly Station[];
  /** Body radius for collision probes (world units). */
  radius: number;
  /** Top walking speed (units/s). */
  speed: number;
}

export interface NpcWorld {
  /** True when the floor cell containing (x, z) is not walkable. */
  blocked(x: number, z: number): boolean;
  playerX: number;
  playerZ: number;
  /** Other characters (x, z pairs, flat) to keep distance from. */
  others: readonly number[];
}

export interface NpcBrain {
  x: number;
  z: number;
  yaw: number;
  mode: NpcMode;
  /** Mode before `watch` (resumed afterwards). */
  resume: NpcMode;
  goalX: number;
  goalZ: number;
  /** Seconds left in the current idle/work pause. */
  timer: number;
  station: Station | null;
  /** Smoothed forward speed (units/s). */
  speed: number;
  /** Idle glance target yaw. */
  glance: number;
  glanceIn: number;
  stuck: number;
  seed: number;
  /** 0..1 blend weights the engine uses for body language. */
  workW: number;
  watchW: number;
}

/** Distance at which a bot stops and looks at the player. */
export const NPC_WATCH_NEAR = 6;
const WATCH_FAR = NPC_WATCH_NEAR + 1.5;
/** Minimum distance kept to other characters (centre to centre). */
export const NPC_PERSONAL_SPACE = 2.6;

export function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0 || 1;
}

function rand(b: NpcBrain): number {
  b.seed = (Math.imul(b.seed, 1664525) + 1013904223) >>> 0;
  return b.seed / 4294967296;
}

export function createBrain(id: string, x: number, z: number, yaw = 0): NpcBrain {
  const b: NpcBrain = {
    x,
    z,
    yaw,
    mode: "idle",
    resume: "idle",
    goalX: x,
    goalZ: z,
    timer: 0,
    station: null,
    speed: 0,
    glance: yaw,
    glanceIn: 2,
    stuck: 0,
    seed: hashSeed(id),
    workW: 0,
    watchW: 0,
  };
  b.timer = 0.5 + rand(b) * 2;
  return b;
}

/** Body (radius r) at (x, z) overlaps no blocked cell. */
export function bodyFree(world: NpcWorld, x: number, z: number, r: number): boolean {
  return (
    !world.blocked(x, z) &&
    !world.blocked(x - r, z - r) &&
    !world.blocked(x + r, z - r) &&
    !world.blocked(x - r, z + r) &&
    !world.blocked(x + r, z + r)
  );
}

/** Straight walk from a to b stays free (sampled every 0.5 units). */
export function pathFree(
  world: NpcWorld,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  r: number,
): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(d / 0.5));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!bodyFree(world, ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
  }
  return true;
}

/**
 * First free stand point around (cx, cz) at distance `dist`, trying 8
 * directions starting from `prefer` (radians, 0 = +z). Points with more
 * blocked neighbours (next to walls, out of the walking lanes) win ties.
 */
export function findFreeSpot(
  blocked: (x: number, z: number) => boolean,
  cx: number,
  cz: number,
  dist: number,
  r: number,
  prefer = 0,
): { x: number; z: number } | null {
  const world: NpcWorld = { blocked, playerX: 0, playerZ: 0, others: [] };
  let best: { x: number; z: number; score: number } | null = null;
  for (let i = 0; i < 8; i++) {
    const a = prefer + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (Math.PI / 4);
    const x = cx + Math.sin(a) * dist;
    const z = cz + Math.cos(a) * dist;
    if (!bodyFree(world, x, z, r)) continue;
    let walls = 0;
    for (const [ox, oz] of RING) if (blocked(x + ox * (r + 1.5), z + oz * (r + 1.5))) walls++;
    const score = i * 0.1 - walls;
    if (!best || score < best.score) best = { x, z, score };
  }
  return best ? { x: best.x, z: best.z } : null;
}

const RING: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function pickPause(b: NpcBrain, min: number, span: number): number {
  return min + rand(b) * span;
}

function nearestStation(b: NpcBrain, cfg: NpcBrainConfig, reach: number): Station | null {
  let best: Station | null = null;
  let bd = reach;
  for (const s of cfg.stations) {
    const d = Math.hypot(s.sx - b.x, s.sz - b.z);
    if (d <= bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/**
 * Collision radius to use from the current spot: the full body radius, or a
 * thin one when the bot was placed snug against something (so it can still
 * walk out instead of freezing).
 */
export function effectiveRadius(b: NpcBrain, cfg: NpcBrainConfig, world: NpcWorld): number {
  return bodyFree(world, b.x, b.z, cfg.radius) ? cfg.radius : 0.2;
}

/** Choose what to do after a pause (wandering bots). */
function chooseNext(b: NpcBrain, cfg: NpcBrainConfig, world: NpcWorld): void {
  const reach = cfg.wander + 3;
  const r = effectiveRadius(b, cfg, world);
  const usable = cfg.stations.filter(
    (s) =>
      s !== b.station &&
      Math.hypot(s.sx - cfg.homeX, s.sz - cfg.homeZ) <= reach &&
      pathFree(world, b.x, b.z, s.sx, s.sz, r),
  );
  if (usable.length && rand(b) < 0.45) {
    const s = usable[Math.floor(rand(b) * usable.length)]!;
    b.station = s;
    b.goalX = s.sx;
    b.goalZ = s.sz;
    b.mode = "walk";
    b.stuck = 0;
    return;
  }
  for (let i = 0; i < 8; i++) {
    const a = rand(b) * Math.PI * 2;
    const d = cfg.wander * (0.35 + rand(b) * 0.65);
    const gx = cfg.homeX + Math.sin(a) * d;
    const gz = cfg.homeZ + Math.cos(a) * d;
    if (Math.hypot(gx - b.x, gz - b.z) < 1.2) continue;
    if (!pathFree(world, b.x, b.z, gx, gz, r)) continue;
    b.station = null;
    b.goalX = gx;
    b.goalZ = gz;
    b.mode = "walk";
    b.stuck = 0;
    return;
  }
  // Nowhere to go from here: rest a bit longer.
  b.mode = "idle";
  b.timer = pickPause(b, 1, 2);
}

function faceStation(b: NpcBrain): number {
  const s = b.station;
  return s ? Math.atan2(s.x - b.x, s.z - b.z) : b.yaw;
}

/**
 * Advance one bot by `dt` seconds. Mutates `b`; returns true while it moves.
 */
export function stepBrain(b: NpcBrain, cfg: NpcBrainConfig, world: NpcWorld, dt: number): boolean {
  const pdx = world.playerX - b.x;
  const pdz = world.playerZ - b.z;
  const pd = Math.hypot(pdx, pdz);

  // Player proximity → watch (with hysteresis).
  if (b.mode !== "watch" && pd < NPC_WATCH_NEAR) {
    b.resume = b.mode === "walk" ? "idle" : b.mode;
    b.mode = "watch";
  } else if (b.mode === "watch" && pd > WATCH_FAR) {
    b.mode = b.resume;
    b.timer = Math.max(b.timer, pickPause(b, 0.8, 1.2));
  }

  let desiredYaw = b.yaw;
  let targetSpeed = 0;
  let moveX = 0;
  let moveZ = 0;

  switch (b.mode) {
    case "watch":
      desiredYaw = Math.atan2(pdx, pdz);
      break;
    case "work":
      desiredYaw = faceStation(b);
      b.timer -= dt;
      if (b.timer <= 0 && cfg.wander > 0) chooseNext(b, cfg, world);
      else if (b.timer <= 0) b.timer = pickPause(b, 4, 6);
      break;
    case "idle": {
      b.timer -= dt;
      b.glanceIn -= dt;
      if (b.glanceIn <= 0) {
        b.glance = wrapAngle(b.yaw + (rand(b) - 0.5) * 1.8);
        b.glanceIn = pickPause(b, 1.8, 3);
      }
      desiredYaw = b.glance;
      if (b.timer <= 0) {
        if (cfg.wander > 0) chooseNext(b, cfg, world);
        else {
          // Stationary bots work at a station right beside them, if any.
          const s = nearestStation(b, cfg, 2.5);
          if (s) {
            b.station = s;
            b.mode = "work";
            b.timer = pickPause(b, 5, 6);
          } else b.timer = pickPause(b, 2, 3);
        }
      }
      break;
    }
    case "walk": {
      const gx = b.goalX - b.x;
      const gz = b.goalZ - b.z;
      const gd = Math.hypot(gx, gz);
      if (gd < 0.35) {
        b.speed = 0;
        if (b.station) {
          b.mode = "work";
          b.timer = pickPause(b, 4, 5);
        } else {
          b.mode = "idle";
          b.timer = pickPause(b, 1.5, 2.5);
          b.glance = b.yaw;
          b.glanceIn = pickPause(b, 0.6, 1);
        }
        break;
      }
      // Seek.
      let sx = gx / gd;
      let sz = gz / gd;
      // Separation from other characters (and the player).
      const sep = (ox: number, oz: number) => {
        const dx = b.x - ox;
        const dz = b.z - oz;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < NPC_PERSONAL_SPACE * 1.4) {
          const w = (NPC_PERSONAL_SPACE * 1.4 - d) / (NPC_PERSONAL_SPACE * 1.4);
          sx += (dx / d) * w * 1.6;
          sz += (dz / d) * w * 1.6;
        }
      };
      for (let i = 0; i + 1 < world.others.length; i += 2)
        sep(world.others[i]!, world.others[i + 1]!);
      sep(world.playerX, world.playerZ);
      // Wall feelers: ahead, ±40°. Steer away from blocked feelers.
      const heading = Math.atan2(sx, sz);
      const feel = cfg.radius + 1.3;
      for (const off of FEELERS) {
        const a = heading + off;
        if (world.blocked(b.x + Math.sin(a) * feel, b.z + Math.cos(a) * feel)) {
          const away = off === 0 ? (rand(b) < 0.5 ? 1 : -1) : -Math.sign(off);
          const ta = heading + away * 1.1;
          sx += Math.sin(ta) * 0.9;
          sz += Math.cos(ta) * 0.9;
        }
      }
      desiredYaw = Math.atan2(sx, sz);
      // Turn first, then walk: speed scales with how well we face the goal.
      const align = Math.max(0, Math.cos(angleDelta(b.yaw, desiredYaw)));
      targetSpeed = cfg.speed * align * align * Math.min(1, gd / 1.2 + 0.25);
      moveX = Math.sin(b.yaw);
      moveZ = Math.cos(b.yaw);
      break;
    }
  }

  // Smooth turn and acceleration.
  b.yaw = turnToward(b.yaw, desiredYaw, dt, b.mode === "watch" ? 4 : 5, 3.2);
  b.speed += (targetSpeed - b.speed) * (1 - Math.exp(-dt * 5));
  let moved = false;
  if (b.mode === "walk" && b.speed > 0.01) {
    const r = effectiveRadius(b, cfg, world);
    const step = b.speed * dt;
    const nx = b.x + moveX * step;
    const nz = b.z + moveZ * step;
    const leash = Math.hypot(nx - cfg.homeX, nz - cfg.homeZ) <= cfg.wander + 4;
    if (leash && bodyFree(world, nx, nz, r)) {
      b.x = nx;
      b.z = nz;
      moved = true;
      b.stuck = 0;
    } else if (leash && bodyFree(world, nx, b.z, r)) {
      b.x = nx; // slide along a wall
      moved = true;
    } else if (leash && bodyFree(world, b.x, nz, r)) {
      b.z = nz;
      moved = true;
    }
    if (!moved) {
      b.stuck += dt;
      b.speed *= 0.5;
    }
    if (b.stuck > 1.2) {
      b.mode = "idle";
      b.station = null;
      b.timer = pickPause(b, 0.6, 1);
      b.stuck = 0;
    }
  } else if (b.mode !== "walk") {
    b.speed = 0;
  }

  const k = 1 - Math.exp(-dt * 3);
  b.workW += ((b.mode === "work" ? 1 : 0) - b.workW) * k;
  b.watchW += ((b.mode === "watch" ? 1 : 0) - b.watchW) * k;
  return moved;
}

const FEELERS = [0, 0.7, -0.7] as const;

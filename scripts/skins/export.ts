/**
 * Skin export: every room's concept (lib/world/skins/rooms.ts) as fine
 * voxels for Blender — walls, floor and cornice, doors carved — plus the
 * channel brightness of each mood at render time (docs/SKINS.md).
 *
 *   pnpm skins:export               all rooms
 *   pnpm skins:export kontroll,mcp  only these rooms
 *
 * Writes .voxel/skins/ (gitignored):
 *   <room>/grid.uvox.json   game palette indices, unit 0.25 (skin_* = channels)
 *   <room>/skin.json        moods: resolved colours + per-frame channel levels
 *   index.json              rooms in render order
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VoxelGrid } from "@/lib/voxel/grid";
import { toUvox, type PaletteSource } from "@/lib/voxel/uvox";
import { __setLocaleForTests } from "@/lib/i18n";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const OUT = join(ROOT, ".voxel/skins");
const ONLY = process.argv
  .slice(2)
  .find((a) => !a.startsWith("--"))
  ?.split(",")
  .filter(Boolean);
const LOCALE = process.argv.includes("--de") ? "de" : "en";
/** Frames of the signature mood (one loop) for the animated strip. */
const FRAMES = 8;

async function main(): Promise<void> {
  // The locale must be set before the content modules evaluate their tr() calls.
  __setLocaleForTests(LOCALE);
  const { C, LAB_PALETTE, labMaterialOf } = await import("@/lib/world/content/palette");
  const { ROOMS } = await import("@/lib/world/content/map");
  const { ROOM_SKINS } = await import("@/lib/world/skins/rooms");
  const { presetFor, resolveSkin } = await import("@/lib/world/skins/state");
  const { hash2, skinCycleMix, skinLevel } = await import("@/lib/world/skins/modes");
  const { SKIN_CHANNELS, SKIN_FINE, skinRoomGrid } = await import("@/lib/world/skins/voxels");
  const { DOORS, floorGeomOf } = await import("@/lib/world/content/map");
  const { doorCells } = await import("@/lib/world/layout");
  type Resolved = ReturnType<typeof resolveSkin>;

  const NAME = new Map<number, string>(Object.entries(C).map(([n, i]) => [i, n]));
  const PALETTE: PaletteSource = {
    rgb: (i) => {
      const [r, g, b] = LAB_PALETTE.get(i);
      return [r, g, b];
    },
    mat: (i) => labMaterialOf(i),
    name: (i) => NAME.get(i) ?? `c${i}`,
  };
  const rgb = (hex: string): [number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a: string, b: string, k: number): [number, number, number] => {
    const x = rgb(a);
    const y = rgb(b);
    return [0, 1, 2].map((i) => Math.round(x[i]! + (y[i]! - x[i]!) * k)) as [
      number,
      number,
      number,
    ];
  };

  /** Loop length of a mood in seconds (frames cover exactly one loop). */
  const period = (r: Resolved): number => {
    const s = Math.max(0.05, r.speed);
    switch (r.mode) {
      case "breathe":
        return 4 / s;
      case "pulse":
      case "chase":
        return 2 / s;
      case "heartbeat":
        return 1.2 / s;
      case "scan":
        return 4 / s;
      case "ripple":
        return 2.5 / s;
      case "twinkle":
        return 1 / (0.3 * s);
      case "rain":
        return 1 / (0.35 * s);
      case "cycle":
        return 1 / (0.08 * s);
      case "alarm":
        return 1;
      default:
        return 2;
    }
  };
  /** Live input for reactive / meter / daylight moods (a plausible signal). */
  const inputAt = (k: number): number => 0.55 + 0.35 * Math.sin(k * Math.PI * 2);

  mkdirSync(OUT, { recursive: true });
  const index: { room: string; floor: number; title: string; variants: string[] }[] = [];
  for (const skin of ROOM_SKINS) {
    if (ONLY && !ONLY.includes(skin.room)) continue;
    const room = ROOMS.find((r) => r.id === skin.room)!;
    const g = skinRoomGrid(skin, room.floor);
    const grid = new VoxelGrid(g.sx, g.sy, g.sz, g.data);
    const dir = join(OUT, skin.room);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "grid.uvox.json"),
      JSON.stringify(
        toUvox(`skin:${skin.room}`, grid, PALETTE, {
          unit: 1 / SKIN_FINE,
          origin: [g.ox, 0, g.oz],
          meta: { room: skin.room, floor: room.floor },
        }),
      ),
    );

    const cut = skinRoomGrid(skin, room.floor, { cut: true });
    writeFileSync(
      join(dir, "cut.uvox.json"),
      JSON.stringify(
        toUvox(`skin:${skin.room}:cut`, new VoxelGrid(cut.sx, cut.sy, cut.sz, cut.data), PALETTE, {
          unit: 1 / SKIN_FINE,
          origin: [cut.ox, 0, cut.oz],
          meta: { room: skin.room, floor: room.floor, cut: true },
        }),
      ),
    );

    // Channel voxels in grid order, with their place for the mode functions.
    const cx = g.sx / 2;
    const cz = g.sz / 2;
    const chans: { u: number; y: number; r: number; h: number; hc: number }[] = [];
    for (let fz = 0; fz < g.sz; fz++)
      for (let fy = 0; fy < g.sy; fy++)
        for (let fx = 0; fx < g.sx; fx++) {
          const v = g.data[fx + fy * g.sx + fz * g.sx * g.sy]!;
          if (!SKIN_CHANNELS.has(v)) continue;
          const wx = g.ox + fx / SKIN_FINE;
          const wz = g.oz + fz / SKIN_FINE;
          const col = Math.floor(fx / 4) + Math.floor(fz / 4);
          chans.push({
            u: wx + wz,
            y: fy / SKIN_FINE,
            r: Math.hypot(fx - cx, fz - cz) / SKIN_FINE,
            h: hash2(col, Math.floor(fy / 6)),
            hc: hash2(col, 0),
          });
        }

    // Eye-level camera hint: the best straight wall run in any of the four directions
    // (long, few doors, deep room in front of it).
    const fg = floorGeomOf(room.floor);
    const rg = fg.byId.get(skin.room)!;
    const doorCellSet = new Set(
      DOORS.filter((d) => d.floor === room.floor).flatMap((d) =>
        doorCells(d).map((c) => c.x + c.z * fg.W),
      ),
    );
    const own = (x: number, z: number) => fg.owner[x + z * fg.W] === rg.index + 1;
    type Hint = {
      dir: "n" | "s" | "w" | "e";
      a0: number;
      a1: number;
      face: number;
      depth: number;
      score: number;
    };
    let best: Hint = { dir: "n", a0: 0, a1: 0, face: 0, depth: 0, score: -1 };
    for (const [dir, nx, nz] of [
      ["n", 0, 1],
      ["s", 0, -1],
      ["w", 1, 0],
      ["e", -1, 0],
    ] as const) {
      const alongX = nz !== 0;
      const ws = rg.walls
        .filter((w) => w.nx === nx && w.nz === nz)
        .sort((a, b) => (alongX ? a.z - b.z || a.x - b.x : a.x - b.x || a.z - b.z));
      for (let i = 0; i < ws.length; ) {
        let j = i;
        const line = (w: (typeof ws)[number]) => (alongX ? w.z : w.x);
        const pos = (w: (typeof ws)[number]) => (alongX ? w.x : w.z);
        while (
          j + 1 < ws.length &&
          line(ws[j + 1]!) === line(ws[i]!) &&
          pos(ws[j + 1]!) === pos(ws[j]!) + 1
        )
          j++;
        const run = ws.slice(i, j + 1);
        const doorsIn = run.filter((w) => doorCellSet.has(w.x + w.z * fg.W)).length;
        const mid = run[Math.floor(run.length / 2)]!;
        let depth = 0;
        while (own(mid.x + nx * (1 + depth), mid.z + nz * (1 + depth))) depth++;
        const score = Math.min(run.length, 40) - doorsIn * 2 + Math.min(depth, 14);
        if (score > best.score) {
          const F = SKIN_FINE;
          const a0 = alongX ? (run[0]!.x - g.ox) * F : (run[0]!.z - g.oz) * F;
          const a1 = alongX
            ? (run[run.length - 1]!.x - g.ox + 1) * F
            : (run[run.length - 1]!.z - g.oz + 1) * F;
          // Inner face plane (fine, along the normal axis).
          const face = alongX
            ? (mid.z - g.oz + (nz > 0 ? 1 : 0)) * F
            : (mid.x - g.ox + (nx > 0 ? 1 : 0)) * F;
          best = { dir, a0, a1, face, depth: depth * F, score };
        }
        i = j + 1;
      }
    }
    const eyeHint = best;

    const frames = (r: Resolved, n: number, t0: number) => {
      const T = period(r);
      const out: { t: number; line: [number, number, number]; levels: string }[] = [];
      for (let f = 0; f < n; f++) {
        const k = n === 1 ? 0 : f / n;
        const t = t0 + k * T;
        const input = r.source === "clock" || r.mode === "daylight" ? 0.85 : inputAt(k);
        const lv = new Uint8Array(chans.length);
        for (let i = 0; i < chans.length; i++) {
          const c = chans[i]!;
          const place = { u: c.u, y: c.y, r: c.r, h: r.mode === "meter" ? c.hc : c.h };
          lv[i] = Math.round(skinLevel(r.mode, t, place, r.speed, input) * 255);
        }
        out.push({
          t,
          line: mix(r.line, r.line2, skinCycleMix(r.mode, t, r.speed)),
          levels: Buffer.from(lv).toString("base64"),
        });
      }
      return out;
    };

    /** Start time with the most light on the channels (sampled over one loop). */
    const peak = (r: Resolved): number => {
      const T = period(r);
      let bestT = 0;
      let bestSum = -1;
      const step = Math.max(1, Math.floor(chans.length / 2000));
      for (let k = 0; k < 16; k++) {
        const t = (k / 16) * T;
        let sum = 0;
        for (let i = 0; i < chans.length; i += step) {
          const c = chans[i]!;
          sum += skinLevel(
            r.mode,
            t,
            { u: c.u, y: c.y, r: c.r, h: r.mode === "meter" ? c.hc : c.h },
            r.speed,
            0.85,
          );
        }
        if (sum > bestSum + 1e-6) {
          bestSum = sum;
          bestT = t;
        }
      }
      // Moving modes read best a little after the brightest instant (heads mid-wall).
      return r.mode === "chase" || r.mode === "scan" || r.mode === "rain" ? bestT + T * 0.1 : bestT;
    };

    const ids = [skin.signature.id, ...skin.alts.slice(0, 3)];
    const variants = ids.map((id, i) => {
      const r = resolveSkin(skin.room, { preset: id, speed: 1, intensity: 1, sync: "room" });
      const p = presetFor(id)!;
      return {
        id,
        name: p.name,
        signature: i === 0,
        mode: r.mode,
        speed: r.speed,
        source: r.source,
        line: rgb(r.line),
        node: rgb(r.node),
        field: rgb(r.field),
        fieldGlow: r.fieldGlow,
        intensity: r.intensity,
        // Stills at a moment that shows the motion (chase heads, scan bands mid-wall).
        // Frame 0 = the brightest moment of the loop (the still); the signature loops from there.
        frames: frames(r, i === 0 ? FRAMES : 1, peak(r)),
      };
    });
    writeFileSync(
      join(dir, "skin.json"),
      JSON.stringify({
        room: skin.room,
        floor: room.floor,
        name: room.name,
        title: skin.title,
        wall: skin.wall.family,
        floorFamily: skin.floor.family,
        channels: chans.length,
        eye: eyeHint,
        size: [g.sx, g.sy, g.sz],
        origin: [g.ox, 0, g.oz],
        variants,
      }),
    );
    index.push({ room: skin.room, floor: room.floor, title: skin.title, variants: ids });
    console.log(
      `[skins] ${skin.room.padEnd(14)} ${g.sx}×${g.sy}×${g.sz}  ${chans.length} channel voxels  ${ids.length} moods`,
    );
  }
  if (!ONLY) writeFileSync(join(OUT, "index.json"), JSON.stringify({ rooms: index }, null, 1));
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

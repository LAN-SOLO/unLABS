import { describe, expect, it } from "vitest";
import { C } from "@/lib/world/content/palette";
import { floorGeomOf, ROOMS, WALL_HEIGHT } from "@/lib/world/content/map";
import { SKIN_MODES, skinLevel } from "@/lib/world/skins/modes";
import { SKIN_PRESETS, skinPreset } from "@/lib/world/skins/presets";
import { ROOM_SKINS } from "@/lib/world/skins/rooms";
import {
  applySkin,
  initialSkins,
  presetsForRoom,
  resolveSkin,
  sanitizeSkins,
  skinWatts,
} from "@/lib/world/skins/state";
import { CAP_V0, PANEL_V0, SKIN_CHANNELS, SKIN_FINE, skinRoomGrid } from "@/lib/world/skins/voxels";

describe("skin concepts", () => {
  it("every room has exactly one concept", () => {
    const ids = ROOM_SKINS.map((s) => s.room);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ROOMS.map((r) => r.id).sort());
  });

  it("presets are unique and every recommendation exists", () => {
    const ids = SKIN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ROOM_SKINS) {
      expect(s.signature.id).toBe(`sig_${s.room}`);
      for (const a of s.alts) expect(skinPreset(a), `${s.room} → ${a}`).toBeDefined();
      expect(presetsForRoom(s.room)[0]!.id).toBe(s.signature.id);
    }
  });

  it("colours are hex and bands stay in the panel zone", () => {
    const hex = /^#[0-9a-f]{6}$/;
    for (const p of [...SKIN_PRESETS, ...ROOM_SKINS.map((s) => s.signature)]) {
      for (const c of [p.line, p.node, p.field, p.line2 ?? "#000000"]) expect(c, p.id).toMatch(hex);
      expect(p.fieldGlow).toBeGreaterThanOrEqual(0);
      expect(p.fieldGlow).toBeLessThanOrEqual(1);
    }
    for (const s of ROOM_SKINS)
      for (const b of s.wall.bands) {
        expect(b.v0, s.room).toBeGreaterThanOrEqual(PANEL_V0);
        expect(b.v1, s.room).toBeLessThan(CAP_V0);
        expect(b.v1).toBeGreaterThanOrEqual(b.v0);
      }
  });
});

describe("skin voxels", () => {
  it("keep the silhouette: wall line, floor slab and the cornice above head only", () => {
    for (const s of ROOM_SKINS) {
      const room = ROOMS.find((r) => r.id === s.room)!;
      const grid = skinRoomGrid(s, room.floor);
      const g = floorGeomOf(room.floor);
      const rg = g.byId.get(s.room)!;
      const walls = new Set(rg.walls.map((w) => w.x + w.z * g.W));
      const F = SKIN_FINE;
      let channels = 0;
      for (let fz = 0; fz < grid.sz; fz++)
        for (let fy = 0; fy < grid.sy; fy++)
          for (let fx = 0; fx < grid.sx; fx++) {
            const v = grid.data[fx + fy * grid.sx + fz * grid.sx * grid.sy]!;
            if (!v) continue;
            if (SKIN_CHANNELS.has(v)) channels++;
            const x = grid.ox + Math.floor(fx / F);
            const z = grid.oz + Math.floor(fz / F);
            const y = Math.floor(fy / F);
            if (y === 0 || walls.has(x + z * g.W)) continue;
            // Interior voxel above the slab: only the cornice, at y ≥ WALL_HEIGHT − 1.
            expect(y, `${s.room} @ ${x},${y},${z}`).toBeGreaterThanOrEqual(WALL_HEIGHT - 1);
          }
      expect(channels, s.room).toBeGreaterThan(0);
    }
  });

  it("are deterministic", () => {
    const s = ROOM_SKINS.find((r) => r.room === "kontroll")!;
    const a = skinRoomGrid(s, 0);
    const b = skinRoomGrid(s, 0);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    expect(a.data.includes(C.skin_field)).toBe(true);
  });
});

describe("skin state", () => {
  it("modes stay in 0 … 1", () => {
    for (const m of SKIN_MODES)
      for (let t = 0; t < 6; t += 0.37)
        for (const y of [0, 2, 5, 8]) {
          const l = skinLevel(m, t, { u: t * 3, y, r: y * 2, h: (t * 7) % 1 }, 1, 0.6);
          expect(l, m).toBeGreaterThanOrEqual(0);
          expect(l, m).toBeLessThanOrEqual(1);
        }
  });

  it("sanitises saves and syncs floors", () => {
    const s = sanitizeSkins({
      kontroll: { preset: "alarm", speed: 99, intensity: -1, line: "#ZZZ", sync: "floor" },
      nope: { preset: "work" },
    });
    expect(s.kontroll!.preset).toBe("sig_kontroll");
    expect(s.kontroll!.speed).toBe(4);
    expect(s.kontroll!.intensity).toBe(0);
    expect(s.kontroll!.line).toBeUndefined();
    expect(s.nope).toBeUndefined();
    const next = applySkin(initialSkins(), "kontroll", {
      preset: "grid_blue",
      speed: 1,
      intensity: 1,
      sync: "floor",
    });
    expect(next.mcp!.preset).toBe("grid_blue");
    expect(next.geo!.preset).toBe("sig_geo");
  });

  it("forced presets win and power follows the mood", () => {
    const calm = resolveSkin("kontroll", initialSkins().kontroll);
    const alarm = resolveSkin("kontroll", initialSkins().kontroll, "alarm");
    expect(alarm.mode).toBe("alarm");
    expect(
      skinWatts(
        "kontroll",
        resolveSkin("kontroll", { preset: "sodium", speed: 1, intensity: 1, sync: "room" }),
      ),
    ).toBeGreaterThan(skinWatts("kontroll", calm));
    expect(
      skinWatts(
        "kontroll",
        resolveSkin("kontroll", { preset: "off", speed: 1, intensity: 1, sync: "room" }),
      ),
    ).toBe(0);
  });
});

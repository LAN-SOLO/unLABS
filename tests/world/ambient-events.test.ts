import { describe, expect, it } from "vitest";
import {
  AMBIENT_EVENT_KINDS,
  SLOT,
  THEME_WEIGHTS,
  WINDOW,
  nextEvents,
  roomPowered,
  roomProfile,
  type AmbientEvent,
} from "@/lib/world/ambient-events";
import { SFX_NAMES } from "@/lib/world/audio/sfx";
import { DEVICE_BY_ID } from "@/lib/world/content/devices";
import { FLOORS, ROOMS, ROOM_BY_ID } from "@/lib/world/content/map";
import { initialState, power } from "@/lib/world/game";
import { FX_KINDS } from "@/lib/world/render/fx";
import type { FloorId, WorldState } from "@/lib/world/types";

const ELECTRIC = new Set(["lamp_flicker", "hum_surge", "monitor_glitch", "pa_crackle"]);

function build(s: WorldState, ...ids: string[]): void {
  for (const id of ids) {
    s.built[id] = DEVICE_BY_ID.get(id)!.stages.length;
    s.switchedOn[id] = true;
  }
}

function simulate(
  s: WorldState,
  floor: FloorId,
  room: string | null,
  seconds: number,
  dt = 0.25,
): AmbientEvent[] {
  const out: AmbientEvent[] = [];
  for (let t = dt; t <= seconds + 1e-9; t += dt) out.push(...nextEvents(s, floor, room, t, dt));
  return out;
}

describe("ambient events", () => {
  it("every theme has weights and every presentation is valid", () => {
    const fx = new Set<string>(FX_KINDS);
    const sfx = new Set<string>(SFX_NAMES);
    for (const r of ROOMS) expect(THEME_WEIGHTS[r.theme ?? "generic"]).toBeDefined();
    const s = initialState();
    build(s, "UEC-001", "VNT-001");
    for (const f of FLOORS) {
      for (const ev of simulate(s, f.id, null, 600, 1)) {
        expect(AMBIENT_EVENT_KINDS).toContain(ev.kind);
        if (ev.fx) expect(fx.has(ev.fx)).toBe(true);
        if (ev.sfx) expect(sfx.has(ev.sfx)).toBe(true);
        expect(ROOM_BY_ID.get(ev.room)!.floor).toBe(f.id);
        const r = ROOM_BY_ID.get(ev.room)!;
        const [x, , z] = ev.pos!;
        expect(x).toBeGreaterThanOrEqual(r.x);
        expect(x).toBeLessThanOrEqual(r.x + r.w);
        expect(z).toBeGreaterThanOrEqual(r.z);
        expect(z).toBeLessThanOrEqual(r.z + r.d);
      }
    }
  });

  it("keeps ≥ 4 s between events in a room", () => {
    expect(SLOT - WINDOW).toBeGreaterThanOrEqual(4);
    const s = initialState();
    build(s, "UEC-001", "P3D-001", "LCT-001", "TLP-001", "EXD-001");
    expect(power(s).starved.length).toBeGreaterThan(0);
    for (const f of FLOORS) {
      for (const r of ROOMS.filter((x) => x.floor === f.id)) {
        const evs = simulate(s, f.id, r.id, 1200, 0.5).filter((e) => e.room === r.id);
        for (let i = 1; i < evs.length; i++) {
          expect(evs[i]!.at - evs[i - 1]!.at).toBeGreaterThanOrEqual(4 - 1e-9);
        }
        expect(evs.length).toBeLessThanOrEqual(1200 / 4);
      }
    }
  });

  it("is deterministic and independent of the call step", () => {
    const s = initialState();
    build(s, "UEC-001");
    const key = (e: AmbientEvent) => `${e.room}|${e.kind}|${e.at.toFixed(4)}`;
    const a = simulate(s, 0, "kontroll", 900, 0.25).map(key);
    const b = simulate(s, 0, "kontroll", 900, 1).map(key);
    const c = simulate(s, 0, "kontroll", 900, 0.25).map(key);
    expect(a).toEqual(c);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(5);
  });

  it("has sane rates in the player's room", () => {
    const s = initialState();
    build(s, "UEC-001");
    const evs = simulate(s, 0, "kontroll", 3600, 1).filter((e) => e.room === "kontroll");
    // BASE_RATE 0.2 per 8 s slot → ~90 per hour; allow slack.
    expect(evs.length).toBeGreaterThan(40);
    expect(evs.length).toBeLessThan(160);
    expect(evs.every((e) => e.near)).toBe(true);
  });

  it("no electrical events in unpowered rooms", () => {
    const s = initialState(); // nothing generates power
    for (const f of FLOORS) {
      for (const ev of simulate(s, f.id, null, 1200, 1)) {
        expect(ELECTRIC.has(ev.kind), `${ev.room} ${ev.kind}`).toBe(false);
        expect(ev.kind).not.toBe("spark");
      }
    }
    const office = ROOM_BY_ID.get("sekundaer")!;
    expect(roomPowered(power(s), office)).toBe(false);
    const prof = roomProfile(s, office);
    expect(Object.values(prof.weights).filter((w) => (w ?? 0) > 0).length).toBe(0);
  });

  it("brownouts bring sparks and flickers; theme flavours show up", () => {
    const s = initialState();
    build(s, "UEC-001", "THM-001", "P3D-001", "LCT-001", "NXS-01", "EXD-001", "TLP-001");
    const p = power(s);
    const starved = p.starved.find((x) => x.reason === "strom");
    expect(starved).toBeDefined();
    const room = ROOM_BY_ID.get(DEVICE_BY_ID.get(starved!.id)!.room)!;
    const evs = simulate(s, room.floor, room.id, 1800, 1).filter((e) => e.room === room.id);
    expect(evs.filter((e) => e.kind === "spark").length).toBeGreaterThan(5);

    const geo = simulate(s, 1, "geo", 1800, 1).filter((e) => e.room === "geo");
    expect(geo.some((e) => e.kind === "distant_rumble" || e.kind === "steam_burst")).toBe(true);
    const shaft = simulate(s, 5, "stollen", 1800, 1).filter((e) => e.room === "stollen");
    expect(shaft.some((e) => e.kind === "drip")).toBe(true);
    const anomaly = simulate(s, 2, "anomalie", 1800, 1).filter((e) => e.room === "anomalie");
    expect(anomaly.some((e) => e.kind === "rift_shimmer")).toBe(true);
  });
});

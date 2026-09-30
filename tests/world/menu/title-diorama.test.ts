import { describe, expect, it } from "vitest";
import {
  DIORAMA_FLOOR,
  DIORAMA_LAYOUT,
  EMOTE_GLYPH,
  cameraYaw,
  dioramaFrustum,
  type DioramaPlacement,
} from "@/lib/world/render/title-diorama";
import { DECOR_BY_ID, decorSize } from "@/lib/world/models/decor";
import { DEVICE_VISUAL_IDS, deviceVisual } from "@/lib/world/models/devices";
import { MODEL_SCALE } from "@/lib/world/models/core";
import { AISLE_Z, CHAIR, DOOR_IN, STATIONS, route, type XZ } from "@/lib/world/title-life";

/** World-space footprint box (rotation rounded to the nearest quarter turn, plus the diagonal slack). */
function footprint(p: DioramaPlacement): { x0: number; x1: number; z0: number; z1: number } {
  let w: number;
  let d: number;
  if (p.kind === "device") {
    const v = deviceVisual(p.id);
    const s = v.scale ?? MODEL_SCALE;
    w = v.base.w * s;
    d = v.base.d * s;
  } else ({ w, d } = decorSize(p.id));
  const quarter = Math.round(p.rot / (Math.PI / 2)) % 2 !== 0;
  const [hw, hd] = quarter ? [d / 2, w / 2] : [w / 2, d / 2];
  return { x0: p.x - hw, x1: p.x + hw, z0: p.z - hd, z1: p.z + hd };
}

const WALKER_R = 1;
function blocked(pt: XZ, skipFlat = true): string | null {
  for (const p of DIORAMA_LAYOUT) {
    if (skipFlat && ["rug", "floor_cables", "wall_clock"].includes(p.id)) continue;
    const f = footprint(p);
    if (
      pt[0] > f.x0 - WALKER_R &&
      pt[0] < f.x1 + WALKER_R &&
      pt[1] > f.z0 - WALKER_R &&
      pt[1] < f.z1 + WALKER_R
    )
      return p.id;
  }
  return null;
}

describe("title diorama layout", () => {
  it("only uses real models and stays on the floor", () => {
    for (const p of DIORAMA_LAYOUT) {
      if (p.kind === "device") expect(DEVICE_VISUAL_IDS).toContain(p.id);
      else expect(DECOR_BY_ID.has(p.id)).toBe(true);
      expect(Math.abs(p.x)).toBeLessThan(DIORAMA_FLOOR.w / 2);
      expect(Math.abs(p.z)).toBeLessThan(DIORAMA_FLOOR.d / 2);
    }
    expect(DIORAMA_LAYOUT.some((p) => p.id === "MCP-000")).toBe(true);
    for (const id of Object.keys(STATIONS))
      expect(DIORAMA_LAYOUT.some((p) => p.station === id)).toBe(true);
  });

  it("keeps machines apart and every spot, helper spot and walkway free", () => {
    const solid = DIORAMA_LAYOUT.filter(
      (p) => !["rug", "floor_cables", "wall_clock"].includes(p.id),
    );
    for (let i = 0; i < solid.length; i++)
      for (let j = i + 1; j < solid.length; j++) {
        const a = footprint(solid[i]!);
        const b = footprint(solid[j]!);
        const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
        expect(overlap, `${solid[i]!.id} × ${solid[j]!.id}`).toBe(false);
      }
    for (const st of Object.values(STATIONS)) {
      if (st.id !== "desk") expect(blocked(st.spot), `${st.id} spot`).toBeNull();
      expect(blocked(st.helper), `${st.id} helper`).toBeNull();
      // Walk every leg of the route from the aisle into the station.
      const pts: XZ[] = [[st.spot[0], AISLE_Z], ...route([st.spot[0], AISLE_Z], st.spot)];
      for (let k = 1; k < pts.length; k++) {
        const [a, b] = [pts[k - 1]!, pts[k]!];
        for (let u = 0; u <= 1; u += 0.1) {
          const p: XZ = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
          if (Math.hypot(p[0] - CHAIR[0], p[1] - CHAIR[1]) < 2) continue;
          // The last metre is the machine she works at.
          if (Math.hypot(p[0] - st.spot[0], p[1] - st.spot[1]) < 0.5) continue;
          expect(blocked(p), `${st.id} route ${p.map((v) => v.toFixed(1))}`).toBeNull();
        }
      }
    }
    for (let x = -15; x <= 15; x += 0.5) expect(blocked([x, AISLE_Z]), `aisle ${x}`).toBeNull();
    for (let z = DOOR_IN[1]; z <= AISLE_Z; z += 0.5)
      expect(blocked([DOOR_IN[0], z]), `door lane ${z}`).toBeNull();
  });

  it("has a glyph for every emote icon", () => {
    for (const g of Object.values(EMOTE_GLYPH)) expect(g.glyph.length).toBeGreaterThan(0);
  });

  it("holds the camera still under reduceMotion and sways gently otherwise", () => {
    expect(cameraYaw(0, true)).toBe(cameraYaw(123, true));
    const samples = Array.from({ length: 200 }, (_, i) => cameraYaw(i * 3, false));
    const lo = Math.min(...samples);
    const hi = Math.max(...samples);
    expect(hi - lo).toBeGreaterThan(0.3);
    // Always inside the open quadrant (walls stand on -x / -z).
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeLessThan(Math.PI / 2);
  });

  it("shifts the scene right on wide screens only", () => {
    const wide = dioramaFrustum(1920, 1080);
    expect(wide.left + wide.right).toBeLessThan(0); // centre moves right on screen
    expect(wide.top - wide.bottom).toBeGreaterThanOrEqual(26);
    const tall = dioramaFrustum(400, 900);
    expect(tall.left + tall.right).toBeCloseTo(0);
    expect((tall.right - tall.left) / (tall.top - tall.bottom)).toBeCloseTo(400 / 900);
  });
});

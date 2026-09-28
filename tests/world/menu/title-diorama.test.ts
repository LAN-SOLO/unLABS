import { describe, expect, it } from "vitest";
import {
  DIORAMA_FLOOR,
  DIORAMA_JADE,
  DIORAMA_LAYOUT,
  cameraYaw,
  dioramaFrustum,
} from "@/lib/world/render/title-diorama";
import { DECOR_BY_ID } from "@/lib/world/models/decor";
import { DEVICE_VISUAL_IDS } from "@/lib/world/models/devices";

describe("title diorama layout", () => {
  it("only uses real models and stays on the floor", () => {
    for (const p of DIORAMA_LAYOUT) {
      if (p.kind === "device") expect(DEVICE_VISUAL_IDS).toContain(p.id);
      else expect(DECOR_BY_ID.has(p.id)).toBe(true);
      expect(Math.abs(p.x)).toBeLessThan(DIORAMA_FLOOR.w / 2);
      expect(Math.abs(p.z)).toBeLessThan(DIORAMA_FLOOR.d / 2);
    }
    expect(Math.abs(DIORAMA_JADE.x)).toBeLessThan(DIORAMA_FLOOR.w / 2);
    expect(DIORAMA_LAYOUT.some((p) => p.id === "MCP-000")).toBe(true);
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
    expect(wide.top - wide.bottom).toBeGreaterThanOrEqual(30);
    const tall = dioramaFrustum(400, 900);
    expect(tall.left + tall.right).toBeCloseTo(0);
    expect((tall.right - tall.left) / (tall.top - tall.bottom)).toBeCloseTo(400 / 900);
  });
});

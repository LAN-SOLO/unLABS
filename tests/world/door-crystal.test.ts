import { describe, expect, it } from "vitest";
import { DOORS } from "@/lib/world/content/map";
import { AIRLOCKS } from "@/lib/world/doors/airlock";
import { doorStyle } from "@/lib/world/doors/style";
import { doorPieces, mechParts } from "@/lib/world/models/door-styles";
import {
  DOOR_LIGHTS,
  airlockAssembly,
  allDoorGrids,
  doorAssembly,
} from "@/scripts/crystal/door-parts";

describe("door crystal export (scripts/crystal/door-parts.ts)", () => {
  const exported = new Set(allDoorGrids().map((p) => p.use));
  // Grids exported elsewhere in scripts/crystal/export.ts (uniform door set, secret doors).
  const legacy = (use: string): boolean =>
    use.startsWith("door-beacon-") || use === "door-frame-secret" || use.startsWith("door-secret-");

  it("exports every grid a styled door shows, in every light", () => {
    for (const d of DOORS)
      for (const l of DOOR_LIGHTS)
        for (const p of doorAssembly(d, l))
          expect(exported.has(p.use) || legacy(p.use), `${d.id}: ${p.use}`).toBe(true);
  });

  it("covers the engine's pieces and mechanism parts of each door", () => {
    for (const d of DOORS) {
      if (d.secret) continue;
      const s = doorStyle(d.id);
      const uses = doorAssembly(d).map((p) => p.use);
      expect(uses.filter((u) => /\/mech\d+$/.test(u))).toHaveLength(mechParts(s).length);
      expect(uses.filter((u) => u.startsWith(`door-style-${d.id}-`))).toHaveLength(
        doorPieces(s, "green").length,
      );
    }
  });

  it("places the airlock's inner door behind the outer one, inside the chamber hardware", () => {
    for (const a of AIRLOCKS) {
      const { parts } = airlockAssembly(a);
      expect(parts.every((p) => exported.has(p.use) || legacy(p.use))).toBe(true);
      const inner = parts.find((p) => p.use.includes(`door-style-${a.inner}`))!;
      const grate = parts.find((p) => p.use.includes("/grate"))!;
      // Same wall orientation → the inner door sits straight behind (local z), the grate between.
      expect(Math.abs(inner.at[0])).toBeLessThan(0.01);
      expect(Math.abs(inner.at[2])).toBeGreaterThan(3);
      expect(Math.sign(grate.at[2])).toBe(Math.sign(inner.at[2]));
      expect(Math.abs(grate.at[2])).toBeLessThan(Math.abs(inner.at[2]));
    }
  });
});

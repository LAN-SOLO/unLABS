import { describe, expect, it } from "vitest";
import { GUIDE_POINTS, jadeGroom } from "@/lib/world/hero/jade-groom";
import { HAIR_KNOT, headField } from "@/lib/world/hero/jade-sculpt";

describe("Jade's groom", () => {
  const g = jadeGroom(0.55);

  it("has every kind of strand, all finite, deterministic", () => {
    const kinds = new Set(g.guides.map((x) => x.kind));
    expect([...kinds].sort()).toEqual(["flyaway", "knot", "updo", "wisp"]);
    for (const x of g.guides) {
      expect(x.rest.length).toBe(GUIDE_POINTS * 3);
      for (const v of x.rest) expect(Number.isFinite(v)).toBe(true);
      for (const v of x.normals) expect(Number.isFinite(v)).toBe(true);
    }
    const again = jadeGroom(0.55);
    expect(again.guides.length).toBe(g.guides.length);
    expect(Array.from(again.guides[7]!.rest)).toEqual(Array.from(g.guides[7]!.rest));
  });

  it("grows from outside the skin, and the updo flows up into the knot", () => {
    for (const x of g.guides) {
      // Roots are not buried in the head.
      expect(headField(x.rest[0]!, x.rest[1]!, x.rest[2]!)).toBeGreaterThan(-0.15);
    }
    const updo = g.guides.filter((x) => x.kind === "updo");
    let ending = 0;
    for (const x of updo) {
      const t = (GUIDE_POINTS - 1) * 3;
      const d = Math.hypot(
        x.rest[t]! - HAIR_KNOT[0],
        x.rest[t + 1]! - HAIR_KNOT[1],
        x.rest[t + 2]! - HAIR_KNOT[2],
      );
      if (d < 2.2) ending++;
    }
    expect(ending / updo.length).toBeGreaterThan(0.9);
  });

  it("styled hair is stiff, loose curls swing", () => {
    for (const x of g.guides) {
      if (x.kind === "updo") expect(x.stiffRoot).toBeGreaterThan(0.8);
      if (x.kind === "wisp") expect(x.stiffTip).toBeLessThan(0.1);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  HUE_BAND_DEG,
  angleDiff,
  bandCenter,
  bandIndexAt,
  hueHit,
  normAngle,
  perRound,
  spectrumIndex,
} from "@/components/world/puzzles/engine/hue";

describe("hue wheel", () => {
  it("has nine 40° bands", () => {
    expect(HUE_BAND_DEG).toBe(40);
    expect(bandIndexAt(0)).toBe(0);
    expect(bandIndexAt(39.9)).toBe(0);
    expect(bandIndexAt(40)).toBe(1);
    expect(bandIndexAt(359.9)).toBe(8);
    expect(bandIndexAt(-10)).toBe(8);
    expect(bandIndexAt(725)).toBe(0);
    expect(bandCenter(3)).toBe(140);
  });

  it("normalises and diffs angles on the shortest way", () => {
    expect(normAngle(-30)).toBe(330);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
    expect(angleDiff(180, 0)).toBe(180);
  });

  it("maps spectrum names", () => {
    expect(spectrumIndex("gelb")).toBe(3);
    expect(spectrumIndex("GAMMA")).toBe(8);
    expect(spectrumIndex("magenta")).toBe(3);
  });

  it("hits within tolerance around the band centre only", () => {
    const g = spectrumIndex("gelb");
    expect(hueHit(140, g, 6)).toBe(true);
    expect(hueHit(146, g, 6)).toBe(true);
    expect(hueHit(147, g, 6)).toBe(false);
    expect(hueHit(125, g, 18)).toBe(true);
    expect(hueHit(121, g, 18)).toBe(false);
    // Wrap-around at the Infrarot/Gamma seam.
    expect(hueHit(355, 8, 18)).toBe(true);
    expect(hueHit(5, 0, 18)).toBe(true);
  });

  it("picks per-round values and repeats the last", () => {
    expect(perRound([18, 11, 6], 0, 9)).toBe(18);
    expect(perRound([18, 11, 6], 5, 9)).toBe(6);
    expect(perRound([], 1, 9)).toBe(9);
  });
});

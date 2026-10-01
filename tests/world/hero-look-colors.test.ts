import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK } from "@/lib/world/content/wardrobe";
import { heroColorsForLook, JADE_HEX } from "@/lib/world/hero/look-colors";

const HEX = /^#[0-9a-f]{6}$/;

describe("hero look colours", () => {
  it("dresses the first-day look: copper hair, white coat, belt and watch worn", () => {
    const { colors, worn } = heroColorsForLook(DEFAULT_LOOK);
    for (const v of Object.values(colors)) expect(v).toMatch(HEX);
    expect(worn).toEqual({ coat: true, belt: true, watch: true });
    expect(colors.hair).toBe("#e2561c");
    expect(colors.coat).toBe("#f2f2ee");
  });

  it("falls back to Jade's colours for empty slots", () => {
    const bare = { ...DEFAULT_LOOK, outer: null, belt: null, wrist: null, legs: null };
    const { colors, worn } = heroColorsForLook(bare);
    expect(worn).toEqual({ coat: false, belt: false, watch: false });
    expect(colors.trousers).toBe(JADE_HEX.trousers);
    expect(colors.skin).toBe(JADE_HEX.skin);
  });
});

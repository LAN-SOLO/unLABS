import { describe, expect, it } from "vitest";
import { initialState } from "@/lib/world/game";
import {
  HINT_SPACING,
  LEGEND_FADE_SECONDS,
  USED_FLAG,
  controlsLearned,
  hasUsed,
  markHintSeen,
  markUsed,
  nextHint,
  showControlLegend,
  type TutorialContext,
} from "@/lib/world/tutorial";
import type { WorldState } from "@/lib/world/types";

const ctx = (patch: Partial<TutorialContext> = {}): TutorialContext => ({
  floor: 0,
  room: "kontroll",
  overlay: null,
  focus: null,
  powerGeneration: 0,
  hintsEnabled: true,
  ...patch,
});

/** Every hint the poller would show, in order, over a long idle session. */
function drain(s: WorldState): string[] {
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    const h = nextHint(s, ctx(), s.playTime);
    if (!h) break;
    out.push(h.id);
    markHintSeen(s, h.id);
    s.playTime += HINT_SPACING;
  }
  return out;
}

describe("usage signals", () => {
  it("markUsed is idempotent and stored as world flags", () => {
    const s = initialState();
    expect(hasUsed(s, "camera")).toBe(false);
    expect(markUsed(s, "camera")).toBe(true);
    expect(markUsed(s, "camera")).toBe(false);
    expect(s.flags[USED_FLAG.camera]).toBe(true);
  });

  it("skips the camera/quicksave/codex hints once the action was used", () => {
    const fresh = initialState();
    fresh.playTime = 400;
    expect(drain(fresh)).toEqual(["camera", "quicksave", "codex"]);

    const s = initialState();
    s.playTime = 400;
    markUsed(s, "camera");
    markUsed(s, "codex");
    expect(drain(s)).toEqual(["quicksave"]);

    const all = initialState();
    all.playTime = 400;
    for (const a of ["camera", "quicksave", "codex"] as const) markUsed(all, a);
    expect(drain(all)).toEqual([]);
  });

  it("keeps play time as a secondary floor", () => {
    const s = initialState();
    s.playTime = 100;
    expect(drain(s)).not.toContain("camera");
  });

  it("skips the achievements hint once the panel was opened", () => {
    const s = initialState();
    s.flags.ach_first_steps = true;
    expect(nextHint(s, ctx(), 0)?.id).toBe("achievements");
    markUsed(s, "achievements");
    expect(nextHint(s, ctx(), 0)).toBeNull();
  });
});

describe("control legend (HUD)", () => {
  it("full always, minimal never", () => {
    const s = initialState();
    expect(showControlLegend("full", s)).toBe(true);
    s.playTime = 5000;
    expect(showControlLegend("full", s)).toBe(true);
    expect(showControlLegend("minimal", initialState())).toBe(false);
    expect(showControlLegend("minimal", initialState(), 100, 0)).toBe(false);
  });

  it("compact fades after move + interact + a panel", () => {
    const s = initialState();
    expect(showControlLegend("compact", s)).toBe(true);
    markUsed(s, "move");
    markUsed(s, "interact");
    expect(controlsLearned(s)).toBe(false);
    expect(showControlLegend("compact", s)).toBe(true);
    markUsed(s, "panel");
    expect(controlsLearned(s)).toBe(true);
    expect(showControlLegend("compact", s)).toBe(false);
  });

  it("compact fades after the time limit and comes back via help", () => {
    const s = initialState();
    s.playTime = LEGEND_FADE_SECONDS;
    expect(showControlLegend("compact", s)).toBe(false);
    expect(showControlLegend("compact", s, s.playTime + 30)).toBe(true);
    expect(showControlLegend("compact", s, s.playTime)).toBe(false);
  });
});

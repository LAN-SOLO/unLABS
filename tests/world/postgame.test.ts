import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EndingSequence } from "@/components/world/EndingSequence";
import { ACHIEVEMENTS, achievementFlag } from "@/lib/world/achievements";
import { SLICE_TOTAL } from "@/lib/world/content/items";
import { BOT_QUESTS, ENDINGS } from "@/lib/world/content/story";
import { initialState } from "@/lib/world/game";
import {
  NG_PLUS_FLAG,
  NG_PLUS_KEEPSAKES,
  aftermath,
  aftermathBase,
  endingStats,
  endingsFound,
  enterPostgame,
  isPostgame,
  legacyEndingFlag,
  newGamePlus,
  postgameObjectives,
} from "@/lib/world/postgame";
import { ENDING_IDS } from "@/lib/world/scenes";
import { _resetSettingsCache, getSettings, updateSettings } from "@/lib/world/settings";
import type { WorldState } from "@/lib/world/types";

function lateGame(): WorldState {
  const s = initialState();
  s.endings.frequenz = true;
  s.flags.ending_frequenz = true;
  s.playTime = 3 * 3600 + 25 * 60;
  s.counters.slices = 12;
  s.flags[BOT_QUESTS[0]!.flag] = true;
  s.flags[BOT_QUESTS[1]!.flag] = true;
  s.flags[achievementFlag(ACHIEVEMENTS[0]!.id)] = true;
  s.counters[`ach_t_${ACHIEVEMENTS[0]!.id}`] = 120;
  s.flags.seen_kaffeebohnen = true;
  s.flags.visited_kontroll = true;
  s.flags.met_x0r8t = true;
  s.flags.scene_wake = true;
  s.flags.geo_routed = true;
  s.recipesKnown["kaffeebohnen+thermoelement"] = "kaffee";
  s.inventory.schrott = 7;
  s.built["UEC-001"] = 3;
  s.insights.handshake = 1;
  s.puzzles.pz_x = true;
  s.doorsOpen.d1 = true;
  s.taken.p1 = 1;
  s.floor = 3;
  return s;
}

describe("aftermath", () => {
  it("has 3–5 authored paragraphs per ending and adds bot + open-ending lines", () => {
    for (const id of ENDING_IDS) {
      const base = aftermathBase(id);
      expect(base.length, id).toBeGreaterThanOrEqual(3);
      expect(base.length, id).toBeLessThanOrEqual(5);
      const s = lateGame();
      const out = aftermath(id, s);
      expect(out.length, id).toBeGreaterThan(base.length);
      expect(out.length, id).toBe(base.length + 2);
      expect(out[out.length - 1], id).toMatch(/still open|Every path has been taken/);
      expect(
        out.some((p) => p.includes("bots")),
        id,
      ).toBe(true);
    }
    expect(aftermath("nope", initialState())).toEqual([]);
  });

  it("mentions Jade, Damien, the MCP and the Halo across each ending", () => {
    for (const id of ENDING_IDS) {
      const text = aftermath(id, lateGame()).join(" ");
      for (const who of ["Jade", "Damien", "MCP"]) expect(text, `${id}/${who}`).toContain(who);
      expect(/Halo|_unstables|Kristall/.test(text), id).toBe(true);
    }
  });
});

describe("endingStats", () => {
  it("counts progress and masks unfound endings", () => {
    const st = endingStats(lateGame());
    expect(st.playTime).toBe(3 * 3600 + 25 * 60);
    expect(st.endingsFound).toBe(1);
    expect(st.endingsTotal).toBe(ENDINGS.length);
    expect(st.endings.filter((e) => e.title === "???")).toHaveLength(ENDINGS.length - 1);
    expect(st.endings.find((e) => e.id === "frequenz")!.title).toBe("The Frequency");
    expect(st.slices).toEqual({ current: 12, total: SLICE_TOTAL });
    expect(st.bots).toEqual({ current: 2, total: BOT_QUESTS.length });
    expect(st.achievements.current).toBeGreaterThanOrEqual(1);
  });

  it("counts endings from earlier NG+ runs", () => {
    const s = initialState();
    s.flags[legacyEndingFlag("halo")] = true;
    expect(endingsFound(s)).toEqual(new Set(["halo"]));
  });
});

describe("postgameObjectives", () => {
  it("lists remaining endings, slices, bots and achievements", () => {
    const s = lateGame();
    s.counters.slices = 5;
    const obj = postgameObjectives(s);
    const endings = obj.filter((o) => o.kind === "ending");
    expect(endings).toHaveLength(ENDINGS.length - 1);
    expect(endings.some((o) => o.id === "ending_frequenz")).toBe(false);
    // The secret ending stays masked until revealed.
    const secret = endings.find((o) => o.id === "ending_kristall")!;
    expect(secret.title).toBe("???");
    const sub = endings.find((o) => o.id === "ending_substrat")!;
    expect(sub.title).toBe("New Substrate");
    expect(sub.ready).toBe(false);
    expect(sub.hint).toContain("Missing:");
    const slices = obj.find((o) => o.kind === "slices")!;
    expect(slices.progress).toEqual({ current: 5, target: SLICE_TOTAL });
    expect(obj.filter((o) => o.kind === "bot")).toHaveLength(BOT_QUESTS.length - 2);
    const ach = obj.find((o) => o.kind === "achievements")!;
    expect(ach.progress!.target).toBe(ACHIEVEMENTS.length);
  });

  it("reveals the secret ending once ten slices are found", () => {
    const s = lateGame();
    s.counters.slices = 10;
    expect(postgameObjectives(s).find((o) => o.id === "ending_kristall")!.title).toBe(
      "Crystal #0089",
    );
  });

  it("is empty when everything is done", () => {
    const s = initialState();
    for (const e of ENDINGS) s.endings[e.id] = true;
    s.counters.slices = SLICE_TOTAL;
    for (const q of BOT_QUESTS) s.flags[q.flag] = true;
    for (const a of ACHIEVEMENTS) s.flags[achievementFlag(a.id)] = true;
    expect(postgameObjectives(s)).toEqual([]);
  });

  it("enterPostgame marks the save once", () => {
    const s = lateGame();
    expect(isPostgame(initialState())).toBe(false);
    const n = s.log.length;
    enterPostgame(s, "frequenz");
    enterPostgame(s, "frequenz");
    expect(isPostgame(s)).toBe(true);
    expect(s.flags.postgame_after_frequenz).toBe(true);
    expect(s.log.length).toBe(n + 1);
  });
});

describe("newGamePlus", () => {
  it("carries achievements, codex flags, recipes and one keepsake", () => {
    const prev = lateGame();
    const s = newGamePlus(prev);
    const achId = ACHIEVEMENTS[0]!.id;
    expect(s.flags[achievementFlag(achId)]).toBe(true);
    expect(s.counters[`ach_t_${achId}`]).toBe(120);
    expect(s.flags.seen_kaffeebohnen).toBe(true);
    expect(s.flags.visited_kontroll).toBe(true);
    expect(s.flags.met_x0r8t).toBe(true);
    expect(s.recipesKnown).toEqual(prev.recipesKnown);
    expect(s.recipesKnown).not.toBe(prev.recipesKnown);
    expect(s.inventory).toEqual({ [NG_PLUS_KEEPSAKES[0]]: 1 });
    expect(s.flags[NG_PLUS_FLAG]).toBe(true);
    expect(s.counters.ng_plus).toBe(1);
    expect(s.flags[legacyEndingFlag("frequenz")]).toBe(true);
  });

  it("resets everything else", () => {
    const prev = lateGame();
    const s = newGamePlus(prev, { keepsake: "kaffeebohnen" });
    const fresh = initialState();
    expect(s.endings).toEqual({});
    expect(s.built).toEqual(fresh.built);
    expect(s.insights).toEqual({});
    expect(s.puzzles).toEqual({});
    expect(s.doorsOpen).toEqual({});
    expect(s.taken).toEqual({});
    expect(s.discovered).toEqual(fresh.discovered);
    expect(s.floor).toBe(fresh.floor);
    expect(s.pos).toEqual(fresh.pos);
    expect(s.playTime).toBe(0);
    expect(s.counters.slices).toBeUndefined();
    expect(s.inventory).toEqual({ kaffeebohnen: 1 });
    for (const f of ["ending_frequenz", "scene_wake", "geo_routed", BOT_QUESTS[0]!.flag])
      expect(s.flags[f], f).toBeUndefined();
    const allowed = /^(ach_|seen_|held_|visited_|met_|legacy_ending_|ng_plus$)/;
    for (const k of Object.keys(s.flags)) expect(k).toMatch(allowed);
  });

  it("counts NG+ cycles and keeps legacy endings across runs", () => {
    const first = newGamePlus(lateGame());
    first.endings.halo = true;
    const second = newGamePlus(first);
    expect(second.counters.ng_plus).toBe(2);
    expect(second.flags[legacyEndingFlag("frequenz")]).toBe(true);
    expect(second.flags[legacyEndingFlag("halo")]).toBe(true);
    expect(endingStats(second).endingsFound).toBe(2);
  });
});

describe("EndingSequence", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetSettingsCache();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const dialog = () => screen.getByRole("dialog");
  const click = () =>
    act(() => {
      fireEvent.click(dialog());
    });

  it("walks through all pages (reduce motion: instant text)", () => {
    updateSettings({ accessibility: { reduceMotion: true } });
    expect(getSettings().accessibility.reduceMotion).toBe(true);
    const onContinue = vi.fn();
    const onMainMenu = vi.fn();
    const s = lateGame();
    render(
      createElement(EndingSequence, { endingId: "frequenz", state: s, onContinue, onMainMenu }),
    );
    const e = ENDINGS.find((x) => x.id === "frequenz")!;
    expect(dialog().dataset.page).toBe("epilogue");
    expect(screen.getByText(e.epilogue)).toBeTruthy();
    click();
    expect(dialog().dataset.page).toBe("aftermath");
    expect(screen.getByText("What happened next")).toBeTruthy();
    expect(screen.getByText(aftermath("frequenz", s)[0]!)).toBeTruthy();
    click();
    expect(dialog().dataset.page).toBe("stats");
    expect(screen.getByText("03:25")).toBeTruthy();
    expect(screen.getByText(`1 / ${ENDINGS.length}`)).toBeTruthy();
    expect(screen.getAllByText(/\?\?\?/)).toHaveLength(ENDINGS.length - 1);
    click();
    expect(dialog().dataset.page).toBe("credits");
    expect(screen.getByText("End of transmission")).toBeTruthy();
    click();
    expect(dialog().dataset.page).toBe("end");
    click(); // stays on the last page
    expect(dialog().dataset.page).toBe("end");
    fireEvent.click(screen.getByRole("button", { name: "Stay in the lab" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Main menu" }));
    expect(onMainMenu).toHaveBeenCalledTimes(1);
  });

  it("types the epilogue and completes it on Space, advances on Esc", () => {
    updateSettings({ accessibility: { reduceMotion: false } });
    vi.useFakeTimers();
    render(
      createElement(EndingSequence, {
        endingId: "kristall",
        state: lateGame(),
        onContinue: vi.fn(),
        onMainMenu: vi.fn(),
      }),
    );
    const e = ENDINGS.find((x) => x.id === "kristall")!;
    expect(screen.queryByText(e.epilogue)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByText(e.epilogue)).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { code: "Space", key: " " });
    });
    expect(screen.getByText(e.epilogue)).toBeTruthy();
    expect(dialog().dataset.page).toBe("epilogue");
    act(() => {
      fireEvent.keyDown(window, { code: "Escape", key: "Escape" });
    });
    expect(dialog().dataset.page).toBe("aftermath");
  });
});

describe("NG+ and the 3D Fabricator", () => {
  it("does not keep print patterns from the previous run", async () => {
    const { addItem, fabricable } = await import("@/lib/world/game");
    const { ITEMS } = await import("@/lib/world/content/items");
    const part = ITEMS.find((i) => i.kind === "bauteil")!;
    const prev = initialState();
    addItem(prev, part.id, 1);
    expect(fabricable(prev).map((d) => d.id)).toContain(part.id);
    const next = newGamePlus(prev);
    expect(next.flags[`seen_${part.id}`]).toBe(true);
    expect(fabricable(next).map((d) => d.id)).not.toContain(part.id);
  });
});

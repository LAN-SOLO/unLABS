import { beforeEach, describe, expect, it } from "vitest";
import { ENDINGS } from "@/lib/world/content/story";
import { initialState } from "@/lib/world/game";
import {
  ACTIVE_KEY,
  META_KEY,
  SAVE_KEY,
  deleteSlot,
  exportSave,
  formatPlayTime,
  getActiveSlot,
  hasAnySave,
  importSave,
  latestSlot,
  listSlots,
  loadSlot,
  loadWorld,
  newGame,
  resetWorld,
  saveToSlot,
  saveWorld,
  setActiveSlot,
  slotKey,
  slotOf,
} from "@/lib/world/save";

beforeEach(() => {
  localStorage.clear();
});

describe("legacy migration", () => {
  it("copies a legacy save into slot1 once and keeps the original", () => {
    const legacy = initialState();
    legacy.playTime = 4000;
    legacy.inventory = { abstractum: 3 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(legacy));

    const s = loadWorld();
    expect(getActiveSlot()).toBe("slot1");
    expect(s.playTime).toBe(4000);
    expect(s.inventory).toEqual({ abstractum: 3 });
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
    expect(listSlots().find((x) => x.id === "slot1")?.meta?.playTime).toBe(4000);

    // Deleting slot1 must not resurrect the legacy blob.
    deleteSlot("slot1");
    expect(loadSlot("slot1")).toBeNull();
    expect(loadWorld().playTime).toBe(0);
  });

  it("ignores a corrupt legacy blob", () => {
    localStorage.setItem(SAVE_KEY, "{broken");
    expect(loadWorld().playTime).toBe(0);
    expect(hasAnySave()).toBe(false);
  });
});

describe("active slot + legacy API", () => {
  it("saveWorld writes into the active slot with meta", () => {
    setActiveSlot("slot2");
    const s = loadWorld();
    s.playTime = 3725;
    saveWorld(s);
    expect(localStorage.getItem(slotKey("slot2"))).not.toBeNull();
    expect(localStorage.getItem(slotKey("slot1"))).toBeNull();
    const info = listSlots().find((x) => x.id === "slot2")!;
    expect(info.active).toBe(true);
    expect(info.empty).toBe(false);
    expect(info.meta?.playTime).toBe(3725);
    expect(info.meta?.totalEndings).toBe(ENDINGS.length);
    expect(info.meta?.devices).toBe(0);
    expect(info.meta?.totalDevices).toBeGreaterThan(30);
    expect(formatPlayTime(info.meta!.playTime)).toBe("01:02");
  });

  it("a stale state bound to another slot never overwrites the new active slot", () => {
    const a = newGame("slot1");
    a.playTime = 100;
    saveWorld(a);
    const b = newGame("slot2");
    b.playTime = 7;
    saveWorld(b);
    // Late flush of the old world after switching:
    a.playTime = 150;
    saveWorld(a);
    expect(loadSlot("slot2")!.playTime).toBe(7);
    expect(loadSlot("slot1")!.playTime).toBe(150);
    expect(getActiveSlot()).toBe("slot2");
  });

  it("newGame / import invalidate old states of the same slot", () => {
    const old = newGame("slot1");
    old.playTime = 500;
    saveWorld(old);
    const fresh = newGame("slot1");
    saveWorld(old); // stale — dropped
    expect(loadSlot("slot1")!.playTime).toBe(0);
    expect(slotOf(fresh)).toBe("slot1");
  });

  it("resetWorld clears the active slot", () => {
    const s = newGame("slot3");
    s.playTime = 99;
    saveWorld(s);
    const r = resetWorld();
    expect(r.playTime).toBe(0);
    expect(loadSlot("slot3")).toBeNull();
    saveWorld(r);
    expect(loadSlot("slot3")).not.toBeNull();
  });

  it("saveToSlot with activate rebinds the running state", () => {
    const s = newGame("slot1");
    s.playTime = 10;
    saveToSlot("slot3", s, { activate: true });
    expect(getActiveSlot()).toBe("slot3");
    s.playTime = 20;
    saveWorld(s);
    expect(loadSlot("slot3")!.playTime).toBe(20);
    expect(loadSlot("slot1")!.playTime).toBe(0);
  });

  it("stores the active slot id and falls back to slot1 on junk", () => {
    localStorage.setItem(ACTIVE_KEY, "slot9");
    expect(getActiveSlot()).toBe("slot1");
  });
});

describe("slots", () => {
  it("lists four slots, rebuilds missing meta and finds the latest", () => {
    expect(listSlots().map((x) => x.id)).toEqual(["slot1", "slot2", "slot3", "auto"]);
    expect(latestSlot()).toBeNull();
    const s = initialState();
    saveToSlot("slot2", s);
    saveToSlot("auto", s);
    localStorage.removeItem(META_KEY);
    const infos = listSlots();
    expect(infos.find((x) => x.id === "slot2")?.meta).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(META_KEY)!)).toHaveProperty("slot2");
    expect(hasAnySave()).toBe(true);
    saveToSlot("slot3", s);
    expect(latestSlot()).toBe("slot3");
  });

  it("export/import roundtrips a slot", () => {
    const s = newGame("slot1");
    s.playTime = 1234;
    s.inventory = { energiezelle: 2 };
    s.endings = { [ENDINGS[0]!.id]: true };
    s.log.push({ t: 1, text: "Ümlaute & ß überleben" });
    saveWorld(s);
    const code = exportSave("slot1");
    expect(code).toMatch(/^[A-Za-z0-9+/=]+$/);
    const r = importSave("slot2", code);
    expect(r.ok).toBe(true);
    const back = loadSlot("slot2")!;
    expect(back.playTime).toBe(1234);
    expect(back.inventory).toEqual({ energiezelle: 2 });
    expect(back.log.at(-1)?.text).toBe("Ümlaute & ß überleben");
    if (r.ok) expect(r.meta.endings).toBe(1);
  });

  it("imports raw JSON and rejects garbage", () => {
    const raw = JSON.stringify({ ...initialState(), playTime: 42 });
    expect(importSave("slot3", raw).ok).toBe(true);
    expect(loadSlot("slot3")!.playTime).toBe(42);
    expect(importSave("slot1", "").ok).toBe(false);
    expect(importSave("slot1", "!!!notbase64").ok).toBe(false);
    expect(importSave("slot1", btoa(JSON.stringify({ version: 2 }))).ok).toBe(false);
    expect(loadSlot("slot1")).toBeNull();
    expect(exportSave("slot1")).toBe("");
  });
});

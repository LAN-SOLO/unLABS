/**
 * Manual-slot backups (save.ts `backupSlot` / `backupMeta` / `restoreBackup`):
 * a beta-save link that overwrites a slot must leave the old save restorable.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { initialState } from "@/lib/world/game";
import {
  backupKey,
  backupMeta,
  backupSlot,
  importSave,
  loadSlot,
  restoreBackup,
  saveToSlot,
} from "@/lib/world/save";

beforeEach(() => {
  localStorage.clear();
});

function code(playTime: number): string {
  const s = initialState();
  s.playTime = playTime;
  return JSON.stringify({ format: "unlabs-world", version: 1, meta: { label: "beta" }, state: s });
}

describe("slot backups", () => {
  it("keeps an overwritten slot restorable and restore swaps back and forth", () => {
    const old = initialState();
    old.playTime = 111;
    saveToSlot("slot2", old);

    expect(backupSlot("slot2")).toBe(true);
    expect(importSave("slot2", code(999)).ok).toBe(true);
    expect(loadSlot("slot2")?.playTime).toBe(999);
    expect(backupMeta("slot2")?.playTime).toBe(111);

    expect(restoreBackup("slot2")).toBe(true);
    expect(loadSlot("slot2")?.playTime).toBe(111);
    // The imported save is now the backup — restoring again switches back.
    expect(backupMeta("slot2")?.playTime).toBe(999);
    expect(restoreBackup("slot2")).toBe(true);
    expect(loadSlot("slot2")?.playTime).toBe(999);
  });

  it("does nothing for empty slots, unreadable data and the autosave", () => {
    expect(backupSlot("slot1")).toBe(false);
    expect(backupMeta("slot1")).toBeNull();
    expect(restoreBackup("slot1")).toBe(false);

    localStorage.setItem(backupKey("slot3"), "{broken");
    expect(backupMeta("slot3")).toBeNull();
    expect(restoreBackup("slot3")).toBe(false);

    saveToSlot("auto", initialState());
    expect(backupSlot("auto")).toBe(false);
    expect(backupMeta("auto")).toBeNull();
  });

  it("restoring into an emptied slot drops the backup afterwards", () => {
    saveToSlot("slot1", initialState());
    backupSlot("slot1");
    localStorage.removeItem("unlabs.world.v1.slot1");
    expect(restoreBackup("slot1")).toBe(true);
    expect(loadSlot("slot1")).not.toBeNull();
    expect(backupMeta("slot1")).toBeNull();
  });
});

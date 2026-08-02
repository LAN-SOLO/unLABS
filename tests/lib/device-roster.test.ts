import { describe, it, expect } from "vitest";
import { buildPanelDeviceRoster, buildProductionDeviceRoster } from "@/lib/game/devices/roster";
import { STARTER_DEVICES } from "@/lib/game/devices/unlocks";

describe("buildPanelDeviceRoster", () => {
  it("marks every starter device as built regardless of flags", () => {
    const roster = buildPanelDeviceRoster({});
    for (const id of STARTER_DEVICES) {
      const entry = roster.find((d) => d.id === id);
      expect(entry?.built).toBe(true);
      expect(entry?.requiredFlag).toBeNull();
    }
  });

  it("gates a flag-mapped device on its required flag", () => {
    const locked = buildPanelDeviceRoster({});
    const cpuLocked = locked.find((d) => d.id === "CPU-001");
    expect(cpuLocked?.built).toBe(false);
    expect(cpuLocked?.requiredFlag).toBe("tutorial_graduated");

    const unlocked = buildPanelDeviceRoster({ tutorial_graduated: true });
    const cpuUnlocked = unlocked.find((d) => d.id === "CPU-001");
    expect(cpuUnlocked?.built).toBe(true);
  });

  it("starts with exactly 3 essential devices and gates basic subsystems on ep0_complete", () => {
    expect([...STARTER_DEVICES]).toEqual(["CLK-001", "VNT-001", "BTK-001"]);

    const fresh = buildPanelDeviceRoster({});
    expect(
      fresh
        .filter((d) => d.built)
        .map((d) => d.id)
        .sort(),
    ).toEqual(["BTK-001", "CLK-001", "VNT-001"]);

    for (const id of ["CDC-001", "BAT-001", "MEM-001", "NET-001", "PWB-001"]) {
      const entry = fresh.find((d) => d.id === id);
      expect(entry?.built).toBe(false);
      expect(entry?.requiredFlag).toBe("ep0_complete");
    }

    const afterEp0 = buildPanelDeviceRoster({ ep0_complete: true });
    expect(afterEp0.filter((d) => d.built)).toHaveLength(8);
  });

  it("covers all starter and flag-mapped devices with a display name", () => {
    const roster = buildPanelDeviceRoster({});
    expect(roster.length).toBeGreaterThan(30);
    for (const entry of roster) {
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });
});

describe("buildProductionDeviceRoster", () => {
  it("only includes device-category recipes", () => {
    const roster = buildProductionDeviceRoster({});
    expect(roster.length).toBeGreaterThan(0);
    expect(roster.some((r) => r.recipeId === "energy_cell")).toBe(false);
  });

  it("reflects built status via the recipe's own reward flag", () => {
    const notBuilt = buildProductionDeviceRoster({});
    expect(notBuilt.find((r) => r.recipeId === "smt_01_build")?.built).toBe(false);

    const built = buildProductionDeviceRoster({ smt_01_online: true });
    expect(built.find((r) => r.recipeId === "smt_01_build")?.built).toBe(true);
  });
});

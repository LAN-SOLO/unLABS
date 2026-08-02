import { describe, it, expect } from "vitest";
import { buildPanelSaveData } from "@/lib/panel/buildPanelSaveData";
import type { PanelSaveData } from "@/lib/panel/panelState";

describe("buildPanelSaveData", () => {
  it("applies the documented defaults when no snapshots are provided", () => {
    const data = buildPanelSaveData({});

    expect(data.version).toBe(1);
    expect(data.devices.bat).toEqual({
      isPowered: true,
      currentCharge: 5000,
      autoRegen: true,
      isExpanded: true,
    });
    expect(data.devices.hms.pulseValue).toBe(35);
    expect(data.devices.hms.waveformType).toBe("sine");
    expect(data.devices.vnt.cpuFanSpeed).toBe(65);
    expect(data.devices.vnt.fanMode).toBe("AUTO");
    expect(data.devices.spk).toEqual({
      isPowered: true,
      volume: 45,
      isMuted: false,
      filters: { bass: false, mid: true, high: false },
      isExpanded: true,
    });
    expect(data.devices.screwButtons).toBeUndefined();
  });

  it("passes real snapshot values through unchanged", () => {
    const data = buildPanelSaveData({
      bat: { isPowered: false, currentCharge: 1234, autoRegen: false, isExpanded: false },
      vnt: { isPowered: true, cpuFan: { speed: 80, mode: "HIGH" }, gpuFan: { speed: 30 } },
      spk: {
        isPowered: false,
        volume: 90,
        isMuted: true,
        filters: { bass: true, mid: false, high: true },
      },
    });

    expect(data.devices.bat).toEqual({
      isPowered: false,
      currentCharge: 1234,
      autoRegen: false,
      isExpanded: false,
    });
    expect(data.devices.vnt.cpuFanSpeed).toBe(80);
    expect(data.devices.vnt.gpuFanSpeed).toBe(30);
    expect(data.devices.vnt.fanMode).toBe("HIGH");
    expect(data.devices.spk?.volume).toBe(90);
    expect(data.devices.spk?.isMuted).toBe(true);
  });

  it("falls back to base for sections the caller cannot produce", () => {
    const base: PanelSaveData = {
      version: 1,
      timestamp: 1,
      filesystem: "fs-blob",
      users: "users-blob",
      themeIndex: 3,
      resources: { abstractum: { amount: 10, isUnlocked: true } },
      devices: { ...buildPanelSaveData({}).devices },
    };

    const data = buildPanelSaveData({}, {}, base);

    expect(data.filesystem).toBe("fs-blob");
    expect(data.users).toBe("users-blob");
    expect(data.themeIndex).toBe(3);
    expect(data.resources).toEqual(base.resources);
  });

  it("prefers explicit sections over base", () => {
    const base: PanelSaveData = {
      version: 1,
      timestamp: 1,
      filesystem: "old-fs",
      devices: { ...buildPanelSaveData({}).devices },
    };

    const data = buildPanelSaveData({}, { filesystem: "new-fs" }, base);

    expect(data.filesystem).toBe("new-fs");
  });

  it("strips extra fields from screw button states", () => {
    const data = buildPanelSaveData({
      screwButtons: {
        s1: { unlocked: true, active: false, totalActiveTime: 42 },
      },
    });

    expect(data.devices.screwButtons).toEqual({
      s1: { unlocked: true, active: false, totalActiveTime: 42 },
    });
  });
});

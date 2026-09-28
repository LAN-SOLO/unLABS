import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONTROLS,
  PRESET_GRAPHICS,
  SETTINGS_KEY,
  _resetSettingsCache,
  actionForCode,
  applyPreset,
  codesForAction,
  defaultSettings,
  detectPreset,
  effectiveVolume,
  findConflict,
  getSettings,
  labelForCode,
  loadSettings,
  mergeSettings,
  rebind,
  resetSettings,
  saveSettings,
  shadowMapSize,
  subscribeSettings,
  updateSettings,
} from "@/lib/world/settings";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
});

describe("settings merge", () => {
  it("returns defaults when nothing is stored or the blob is corrupt", () => {
    expect(loadSettings()).toEqual(defaultSettings());
    localStorage.setItem(SETTINGS_KEY, "{not json");
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it("merges a partial stored blob onto defaults, dropping junk", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        audio: { music: 0.2, bogus: 5 },
        graphics: { shadows: "mega", pixelRatio: 9, fpsLimit: 144 },
        camera: { edgePan: "yes" },
        extra: true,
      }),
    );
    const s = loadSettings();
    expect(s.audio.music).toBe(0.2);
    expect(s.audio.master).toBe(defaultSettings().audio.master);
    expect("bogus" in s.audio).toBe(false);
    expect("extra" in s).toBe(false);
    expect(s.graphics.shadows).toBe(defaultSettings().graphics.shadows); // invalid enum ignored
    expect(s.graphics.pixelRatio).toBe(2); // clamped
    expect(s.graphics.fpsLimit).toBe(defaultSettings().graphics.fpsLimit);
    expect("edgePan" in s.camera).toBe(false); // removed setting is dropped
  });

  it("clamps numbers and ignores NaN", () => {
    const s = mergeSettings(defaultSettings(), {
      accessibility: { uiScale: 5 },
      gameplay: { toastSeconds: Number.NaN },
      audio: { sfx: -1 },
    });
    expect(s.accessibility.uiScale).toBe(1.3);
    expect(s.gameplay.toastSeconds).toBe(5);
    expect(s.audio.sfx).toBe(0);
  });

  it("persists via saveSettings and notifies subscribers", () => {
    let calls = 0;
    const off = subscribeSettings(() => calls++);
    const next = updateSettings({ audio: { mute: true }, gameplay: { textSpeed: "sofort" } });
    expect(next.audio.mute).toBe(true);
    expect(calls).toBe(1);
    _resetSettingsCache();
    expect(getSettings().gameplay.textSpeed).toBe("sofort");
    off();
    resetSettings();
    expect(calls).toBe(1);
    expect(getSettings().audio.mute).toBe(false);
  });

  it("getSettings returns a stable reference until something changes", () => {
    const a = getSettings();
    expect(getSettings()).toBe(a);
    saveSettings({ ...a, camera: { ...a.camera, rotateSpeed: 2 } });
    expect(getSettings()).not.toBe(a);
  });
});

describe("presets", () => {
  it("applies a graphics bundle without touching other sections", () => {
    const base = updateSettings({ audio: { music: 0.1 } });
    const low = applyPreset(base, "niedrig");
    expect(low.graphics.preset).toBe("niedrig");
    expect(low.graphics.shadows).toBe("aus");
    expect(low.graphics.bloom).toBe(false);
    expect(low.audio.music).toBe(0.1);
    expect(shadowMapSize(low.graphics)).toBe(0);
    expect(shadowMapSize(applyPreset(base, "ultra").graphics)).toBe(2048);
  });

  it("detects presets and marks manual tweaks as eigen", () => {
    for (const p of ["niedrig", "mittel", "hoch", "ultra"] as const) {
      expect(detectPreset({ ...defaultSettings().graphics, ...PRESET_GRAPHICS[p] })).toBe(p);
    }
    const tweaked = updateSettings({ graphics: { bloomStrength: 1.1 } });
    expect(tweaked.graphics.preset).toBe("eigen");
  });

  it("computes effective volume with master and mute", () => {
    const a = { ...defaultSettings().audio, master: 0.5, sfx: 0.5 };
    expect(effectiveVolume(a, "sfx")).toBeCloseTo(0.25);
    expect(effectiveVolume({ ...a, mute: true }, "sfx")).toBe(0);
  });
});

describe("controls", () => {
  it("maps codes to actions including fixed secondaries", () => {
    const c = { ...DEFAULT_CONTROLS };
    expect(actionForCode("KeyW", c)).toBe("moveUp");
    expect(actionForCode("ArrowUp", c)).toBe("moveUp");
    expect(actionForCode("Space", c)).toBe("interact");
    expect(actionForCode("F5", c)).toBe("quicksave");
    expect(actionForCode("KeyX", c)).toBeNull();
  });

  it("swaps keys on conflict so nothing is left unbound", () => {
    const c = { ...DEFAULT_CONTROLS };
    expect(findConflict(c, "interact", "KeyQ")).toBe("rotateLeft");
    const r = rebind(c, "interact", "KeyQ");
    expect(r.ok).toBe(true);
    expect(r.swapped).toBe("rotateLeft");
    expect(r.controls.interact).toBe("KeyQ");
    expect(r.controls.rotateLeft).toBe("KeyE");
    const codes = Object.values(r.controls);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("binds a free key without swapping and rejects reserved keys", () => {
    const c = { ...DEFAULT_CONTROLS };
    const r = rebind(c, "journal", "KeyL");
    expect(r.swapped).toBeNull();
    expect(r.controls.journal).toBe("KeyL");
    expect(rebind(c, "journal", "F12").ok).toBe(false);
  });

  it("a primary binding wins over another action's secondary", () => {
    const c = rebind({ ...DEFAULT_CONTROLS }, "journal", "Space").controls;
    expect(actionForCode("Space", c)).toBe("journal");
    expect(codesForAction("interact", c)).not.toContain("Space");
    expect(codesForAction("interact", c)).toContain("Enter");
  });

  it("labels codes in English", () => {
    expect(labelForCode("KeyW")).toBe("W");
    expect(labelForCode("Space")).toBe("Space");
    expect(labelForCode("Escape")).toBe("Esc");
    expect(labelForCode("ShiftLeft")).toBe("Shift left");
    expect(labelForCode("Digit4")).toBe("4");
    expect(labelForCode("F9")).toBe("F9");
    expect(labelForCode("KeyZ")).toContain("Y");
  });
});

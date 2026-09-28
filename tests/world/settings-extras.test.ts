import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONTROLS,
  SETTINGS_KEY,
  _resetSettingsCache,
  applyDocumentSettings,
  colorblindFilter,
  colorblindFilterId,
  colorblindMatrix,
  controlIssues,
  controlsAreDefault,
  defaultSettings,
  loadSettings,
  mergeSettings,
  rebind,
  repairControls,
  type Controls,
} from "@/lib/world/settings";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
});

describe("new settings", () => {
  it("defaults the menu diorama on and clamps the subtitle scale", () => {
    const d = defaultSettings();
    expect(d.graphics.menuScene).toBe(true);
    expect(d.accessibility.subtitleScale).toBe(1);
    const s = mergeSettings(d, { accessibility: { subtitleScale: 9 } });
    expect(s.accessibility.subtitleScale).toBe(1.6);
  });

  it("drops removed settings from old saves", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ graphics: { ambientOcclusion: true }, camera: { edgePan: true } }),
    );
    const s = loadSettings();
    expect("ambientOcclusion" in s.graphics).toBe(false);
    expect("edgePan" in s.camera).toBe(false);
  });
});

describe("controls repair & conflicts", () => {
  it("repairs a double binding from storage back to the default key", () => {
    const bad: Controls = { ...DEFAULT_CONTROLS, journal: "KeyE" }; // clashes with interact
    const fixed = repairControls(bad);
    expect(fixed.interact).toBe("KeyE");
    expect(fixed.journal).toBe(DEFAULT_CONTROLS.journal);
    expect(controlIssues(fixed).filter((i) => i.kind === "doppelt")).toHaveLength(0);
    // Also applied when loading.
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ controls: { journal: "KeyE" } }));
    expect(loadSettings().controls.journal).toBe("KeyJ");
  });

  it("reports duplicates, stolen secondaries and menu keys", () => {
    expect(controlIssues(DEFAULT_CONTROLS)).toEqual([]);
    const dup = controlIssues({ ...DEFAULT_CONTROLS, journal: "KeyE" });
    expect(dup[0]).toEqual({ kind: "doppelt", code: "KeyE", actions: ["interact", "journal"] });
    const stolen = rebind(DEFAULT_CONTROLS, "journal", "Tab").controls; // Tab = inventory secondary
    expect(controlIssues(stolen)).toContainEqual({
      kind: "verdeckt",
      code: "Tab",
      action: "journal",
      loser: "inventory",
    });
    const menu = rebind(DEFAULT_CONTROLS, "power", "ArrowDown").controls;
    const kinds = controlIssues(menu).map((i) => i.kind);
    expect(kinds).toContain("menu");
    expect(kinds).toContain("verdeckt"); // ArrowDown is moveDown's secondary
  });

  it("knows when every key is back on its default", () => {
    expect(controlsAreDefault(DEFAULT_CONTROLS)).toBe(true);
    expect(controlsAreDefault(rebind(DEFAULT_CONTROLS, "help", "KeyK").controls)).toBe(false);
  });
});

describe("colour-blind correction", () => {
  it("is the identity when off and a real correction otherwise", () => {
    expect(colorblindMatrix("aus")).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(colorblindFilter("aus")).toBe("none");
    for (const m of ["protan", "deutan", "tritan"] as const) {
      const k = colorblindMatrix(m);
      expect(k).not.toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      expect(k.every(Number.isFinite)).toBe(true);
      expect(colorblindFilter(m)).toBe(`url(#${colorblindFilterId(m)})`);
    }
    // Greys stay grey-ish (rows of the correction keep white near white).
    const k = colorblindMatrix("deutan");
    const white = [0, 1, 2].map((r) => k[r * 3]! + k[r * 3 + 1]! + k[r * 3 + 2]!);
    white.forEach((v) => expect(v).toBeCloseTo(1, 1));
  });
});

describe("document effects", () => {
  it("writes CSS vars, data attributes, the focus style and the SVG filters", () => {
    const s = mergeSettings(defaultSettings(), {
      accessibility: {
        uiScale: 1.2,
        subtitleScale: 1.4,
        highContrastFocus: true,
        colorblindMode: "tritan",
      },
    });
    applyDocumentSettings(s, document);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--unlab-ui-scale")).toBe("1.2");
    expect(root.style.getPropertyValue("--unlab-subtitle-scale")).toBe("1.4");
    expect(root.dataset.unlabFocus).toBe("high");
    expect(root.dataset.unlabColorblind).toBe("tritan");
    expect(document.getElementById("unlab-settings-style")?.textContent).toContain(
      'data-unlab-focus="high"',
    );
    for (const m of ["protan", "deutan", "tritan"] as const)
      expect(document.getElementById(colorblindFilterId(m))).not.toBeNull();
    // Idempotent: a second call adds nothing.
    applyDocumentSettings(s, document);
    expect(document.querySelectorAll("#unlab-settings-style")).toHaveLength(1);
    applyDocumentSettings(defaultSettings(), document);
    expect(root.dataset.unlabFocus).toBe("normal");
  });
});

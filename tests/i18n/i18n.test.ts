import { afterEach, describe, expect, it } from "vitest";
import { fmtNum } from "@/components/world/format";
import { __setLocaleForTests, getLocale, interpolate, readStoredLocale, tr } from "@/lib/i18n";
import {
  _resetSettingsCache,
  getSettings,
  mergeSettings,
  defaultSettings,
} from "@/lib/world/settings";
import { jsxTexts, looksGerman, scanSource, trCalls } from "./scan";

afterEach(() => {
  __setLocaleForTests(null);
  localStorage.clear();
  _resetSettingsCache();
});

describe("tr", () => {
  it("defaults to English in tests", () => {
    expect(getLocale()).toBe("en");
    expect(tr("Settings")).toBe("Settings");
  });

  it("returns the German entry for locale de, falling back to English", () => {
    __setLocaleForTests("de");
    expect(tr("Settings")).toBe("Einstellungen");
    expect(tr("Some string nobody translated")).toBe("Some string nobody translated");
  });

  it("interpolates {placeholders} in both languages and keeps unknown tokens", () => {
    expect(tr("Saved: {slot}", { slot: "Slot 1" })).toBe("Saved: Slot 1");
    __setLocaleForTests("de");
    expect(tr("Saved: {slot}", { slot: "Slot 1" })).toBe("Gespeichert: Slot 1");
    expect(interpolate("{a} {key:journal} {b}", { a: 1 })).toBe("1 {key:journal} {b}");
  });

  it("strips a context prefix in English and uses it as the lookup key", () => {
    expect(tr("key::Space")).toBe("Space");
    __setLocaleForTests("de");
    expect(tr("key::Space")).toBe("Leertaste");
    expect(tr("nothing::Untranslated")).toBe("Untranslated");
  });
});

describe("locale settings", () => {
  it("settings default to English and sanitise the language", () => {
    expect(getSettings().language).toBe("en");
    expect(mergeSettings(defaultSettings(), { language: "de" }).language).toBe("de");
    expect(mergeSettings(defaultSettings(), { language: "fr" }).language).toBe("en");
  });

  it("reads the stored language from the settings blob", () => {
    expect(readStoredLocale()).toBeNull();
    localStorage.setItem("unlabs.settings.v1", JSON.stringify({ language: "de" }));
    expect(readStoredLocale()).toBe("de");
    localStorage.setItem("unlabs.settings.v1", "{broken");
    expect(readStoredLocale()).toBeNull();
  });
});

describe("fmtNum", () => {
  it("formats per locale", () => {
    expect(fmtNum(1000.5, 1)).toBe("1,000.5");
    __setLocaleForTests("de");
    expect(fmtNum(1000.5, 1)).toBe("1.000,5");
    expect(fmtNum(0.3, 2)).toBe("0,30");
  });
});

describe("i18n scanner", () => {
  it("finds tr literals and flags non-literal arguments", () => {
    const src = [
      'const a = tr("Hello {name}", { name });',
      "const b = tr(`Plain template`);",
      "const c = tr(`Bad ${x}`);",
      'const d = tr("a" + "b");',
      "const e = tr(label);",
      '// tr("in a comment")',
      'const f = tr("Escaped \\"quote\\"");',
    ].join("\n");
    const calls = trCalls(scanSource("x.ts", src));
    expect(calls.map((c) => c.key)).toEqual([
      "Hello {name}",
      "Plain template",
      null,
      null,
      null,
      'Escaped "quote"',
    ]);
  });

  it("detects German-looking text", () => {
    expect(looksGerman("Spielstand löschen?")).toBe(true);
    expect(looksGerman("Das ist nicht gut")).toBe(true);
    expect(looksGerman("Delete save?")).toBe(false);
    expect(looksGerman("grafik")).toBe(false);
    const jsx = jsxTexts(scanSource("x.tsx", "const x = <p>Überspringen</p>;"));
    expect(jsx.map((j) => j.text)).toEqual(["Überspringen"]);
  });
});

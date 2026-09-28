/**
 * Lab World i18n — English source strings, German dictionaries.
 * ==============================================================
 *
 * Code contains the ENGLISH text wrapped in `tr("…")`. The German lives in
 * `lib/i18n/de/<area>.ts`, keyed by the exact English source string. See
 * `lib/i18n/README.md` for the translator conventions.
 *
 * The locale is decided once per page load (content modules call `tr()` at
 * import time), so switching language reloads the page (`setLocale`).
 *
 * This module must not import `lib/world/settings.ts` (settings imports us);
 * it reads the `language` field of the stored settings blob directly.
 */

import { DE } from "@/lib/i18n/de";

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Same key as `SETTINGS_KEY` in lib/world/settings.ts (duplicated to avoid an import cycle). */
const SETTINGS_STORAGE_KEY = "unlabs.settings.v1";

/** Separator for an optional disambiguation context: `tr("door::Open")` shows "Open". */
export const CONTEXT_SEPARATOR = "::";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** The `language` stored in the settings blob, or null (no storage / not set / invalid). */
export function readStoredLocale(): Locale | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const text = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!text) return null;
    const blob: unknown = JSON.parse(text);
    if (typeof blob !== "object" || blob === null) return null;
    const lang = (blob as Record<string, unknown>).language;
    return isLocale(lang) ? lang : null;
  } catch {
    return null;
  }
}

let active: Locale | null = null;
let testOverride: Locale | null = null;

/**
 * The active locale — read once, then fixed until the page reloads.
 * Server/non-browser and tests: "en" (tests can switch with `__setLocaleForTests`).
 */
export function getLocale(): Locale {
  if (testOverride) return testOverride;
  if (active) return active;
  if (process.env.NODE_ENV === "test" || typeof window === "undefined") return DEFAULT_LOCALE;
  active = readStoredLocale() ?? DEFAULT_LOCALE;
  return active;
}

/**
 * Persist `locale` into the settings blob and reload the page so every
 * module re-evaluates its `tr()` calls. No-op outside the browser.
 */
export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    const text = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed: unknown = text ? JSON.parse(text) : {};
    const blob =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...blob, language: locale }));
  } catch {
    // Storage blocked — the reload falls back to the default language.
  }
  window.location.reload();
}

/** Tests only: force a locale (null = back to the default "en"). */
export function __setLocaleForTests(locale: Locale | null): void {
  testOverride = locale;
}

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Replace `{name}` placeholders with `vars[name]`; unknown placeholders stay untouched. */
export function interpolate(
  text: string,
  vars?: Readonly<Record<string, string | number>>,
): string {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : token,
  );
}

function stripContext(en: string): string {
  const i = en.indexOf(CONTEXT_SEPARATOR);
  return i < 0 ? en : en.slice(i + CONTEXT_SEPARATOR.length);
}

/**
 * Translate an English source string. The first argument must be a plain
 * string literal (no `${}`), so the coverage test can find it; dynamic parts
 * go through `{placeholders}` in `vars`.
 *
 * `tr("Saved: {slot}", { slot: name })` → "Saved: Slot 1" / "Gespeichert: Slot 1".
 */
export function tr(en: string, vars?: Readonly<Record<string, string | number>>): string {
  const text = getLocale() === "de" ? (DE.get(en) ?? stripContext(en)) : stripContext(en);
  return interpolate(text, vars);
}

let reverseDe: Map<string, string> | null = null;

/**
 * The English source (context stripped) of a German dictionary value, or
 * undefined when the text is not a known translation. Locale-independent —
 * used to migrate old German-keyed save data (e.g. `said_<npc>_<label>` flags).
 * When several English keys share one German value, the first one wins.
 */
export function englishOf(german: string): string | undefined {
  if (!reverseDe) {
    reverseDe = new Map();
    for (const [en, de] of DE) if (!reverseDe.has(de)) reverseDe.set(de, stripContext(en));
  }
  return reverseDe.get(german);
}

/**
 * The English source of a string that `tr()` produced in the active locale
 * (identity in English or when the text is unknown). Use it to build
 * locale-independent keys from translated labels.
 */
export function sourceOf(text: string): string {
  if (getLocale() !== "de") return text;
  return englishOf(text) ?? text;
}

/** BCP 47 tag for `Intl` formatters. */
export function intlLocale(locale: Locale = getLocale()): string {
  return locale === "de" ? "de-DE" : "en-US";
}

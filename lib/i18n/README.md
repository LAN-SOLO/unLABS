# Lab World i18n (English + German)

English is the main language. **Code contains English**; the German lives in
dictionaries keyed by the exact English string.

```ts
import { tr } from "@/lib/i18n";

tr("Settings"); // "Settings" / "Einstellungen"
tr("Saved: {slot}", { slot: SLOT_NAME[id] }); // placeholders work in both languages
tr("door::Open"); // optional context before "::" — shown as "Open" in English
```

## Rules

1. **Wrap every player-visible string** in `tr("…")`: JSX text, `aria-label`,
   `title`, `placeholder`, toasts, log lines, content fields (`name`, `title`,
   `text`, `blurb`, `description`, `lines`, `hint`, …).
2. **First argument = one plain string literal.** No `${…}`, no `+`, no
   variables (the coverage test rejects them). Dynamic parts go into
   `{placeholders}`: `tr("{n} days ago", { n: d })`.
3. **Never build sentences from pieces.** Word order differs; write whole
   sentences (one `tr` per variant, e.g. singular/plural as two strings).
4. **Content objects** (`lib/world/content/*`): wrap each user-visible field
   at definition, e.g. `{ id: "cryo", name: tr("Cryo bay"), text: tr("…") }`.
   **Never translate ids**, save keys, enum values, `flags`, sfx names or
   anything compared in code. If a stored id is German (e.g. `"niedrig"`),
   keep it and add a label map (see `PRESET_LABEL` in `lib/world/settings.ts`).
5. **German goes into `lib/i18n/de/<area>.ts`** as
   `"English source": "Deutsch"`. Areas: `ui menu puzzles story map devices
items codex barks decor terminals systems scenes` — use the file of your area
   only. The DE value is the **original German text, unchanged** (just move it).
   Placeholders must match (`{slot}` in both; `{key:journal}` tokens too).
6. **Same English, different German?** Add a context: `tr("door::Open")` /
   `tr("state::Open")`. A key may exist in two areas only with the same value.
7. **Numbers:** use `fmtNum(value, digits)` from `components/world/format.ts`
   (en `1,000.5`, de `1.000,5`). `deNum` is deprecated (always German).
   Quotes: English “…”, German »…« — put them inside the string.
8. **`{key:action}` tokens** (current key binding) stay as they are; they are
   resolved by `withKeys`/`useKeyText` after `tr`.
9. **Tone:** natural English with the same dry lab humour; the MCP stays formal
   ("Dr. Lawrence", "you" without familiarity). Keep names/codes as they are
   (F1N-DR, MCP-000, \_unOS, Halo).
10. **Name clash:** `tr` must not be shadowed (e.g. `const tr = proto.traits` in
    `lib/world/game.ts` — rename that local when you convert the file).

## Locale

- `getLocale()` → `"en" | "de"`, read once per page load from the settings
  blob (`unlabs.settings.v1`, field `language`, default `"en"`). Tests and the
  server always get `"en"`.
- Module-level `tr()` calls (content tables) are evaluated at import, so a
  language switch calls `setLocale(l)`, which saves and **reloads** the page.
- Tests: `__setLocaleForTests("de")` affects `tr()` calls made afterwards
  (not module constants that were already evaluated); reset with `null`.

## When you finish a file

1. Run `pnpm exec vitest run tests/i18n` — add the file/folder to
   `ENFORCED_PATHS` in `tests/i18n/coverage.test.ts`; the test then fails on
   missing German entries, non-literal `tr` args and leftover German literals
   (a deliberate exception: `// i18n-ignore` on that line).
2. Update tests that asserted the old German text to the English text.
3. `I18N_STRICT=1 pnpm exec vitest run tests/i18n` shows everything that is still open.

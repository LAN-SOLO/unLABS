# End-to-end tests

Playwright-driven smoke tests. Each run boots `pnpm dev` (or reuses a running server locally) and drives a real Chromium instance against `http://localhost:3000`.

## Commands

- `pnpm test:e2e` — headless run
- `pnpm test:e2e:ui` — interactive Playwright UI

## First-time setup

```sh
pnpm exec playwright install --with-deps chromium
```

## Adding a test

Create `<name>.spec.ts` in this directory. Keep smoke tests focused on "does the app render at all" — deeper flows belong in unit tests where possible.

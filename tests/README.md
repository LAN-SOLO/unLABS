# Tests

Unit + integration tests, run by Vitest.

## Commands

- `pnpm test` — run all unit tests once
- `pnpm test:watch` — watch mode

End-to-end tests live in `../e2e/` and use Playwright (`pnpm test:e2e`).

## Layout

- `terminal/` — guardrails for the terminal subsystem. `command-registration.test.ts` textually parses `lib/terminal/commands.ts` and fails the build if a command is declared but missing from the `commands[]` array at the bottom of the file.
- `lib/` — tests for shared library code (env schema, etc).

## Adding a test

Place the file under `tests/<area>/` with a `.test.ts` or `.test.tsx` extension. The Vitest config runs anything matching the default glob inside this directory.

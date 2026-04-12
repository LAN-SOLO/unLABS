# Development pipeline

Single source of truth for how code gets from your editor into `main`. If something here diverges from `package.json`, `.github/workflows/ci.yml`, or `lefthook.yml`, update this doc.

## Layers

```
edit → save → commit → push → PR → merge
        │        │        │      │
        │        │        │      └── GitHub Actions (ci.yml)
        │        │        └──────── Lefthook pre-push (pnpm test)
        │        └───────────────── Lefthook pre-commit (format/lint/typecheck)
        └────────────────────────── pnpm dev / pnpm test:watch
```

The local and CI layers run **the same commands**, so CI never fails on something a developer cannot reproduce locally.

## Scripts

See [`README.md`](../README.md#daily-commands) for the full command table. Grouping:

- **Dev loop** — `dev`, `test:watch`
- **Quality gates** — `lint`, `typecheck`, `format:check`, `test`, `build`, aggregated by `pnpm check`
- **E2E** — `test:e2e`, `test:e2e:ui`
- **Database** — `db:start`, `db:stop`, `db:reset`, `db:new`, `db:diff`, `db:types`
- **Desktop** — `electron:dev`, `electron:compile`, `build:mac`, `build:win`, `build:all`

## Lefthook hooks (`lefthook.yml`)

| Hook         | Runs                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| `pre-commit` | Prettier on staged files, ESLint `--fix` on staged files, `pnpm typecheck` if any TS changed |
| `pre-push`   | `pnpm test`                                                                                  |

Lefthook installs its git hooks automatically during `pnpm install` (via its postinstall). To reinstall manually: `pnpm exec lefthook install`.

To bypass a hook in an emergency: `LEFTHOOK=0 git commit …` — avoid unless genuinely stuck.

## GitHub Actions (`.github/workflows/ci.yml`)

Three jobs, all triggered on `push` to `main`/`develop` and every PR:

1. **`quality`** — installs via frozen lockfile, then runs `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm build`. Fails the PR on any red step.
2. **`migrations`** — spins up the Supabase CLI's bundled stack, runs `supabase db reset` to replay every SQL file in `supabase/migrations/` from an empty DB, then `supabase db lint`. Proves migrations never drift silently.
3. **`e2e`** — depends on `quality`. Installs Playwright's chromium browser, runs `pnpm test:e2e`, uploads the HTML report as an artifact on success or failure.

The e2e job reuses the same `NEXT_PUBLIC_*` env wiring as `quality`, sourced from the `CI_SUPABASE_*` repository secrets documented in [`CONTRIBUTING.md`](../CONTRIBUTING.md#ci-secrets).

## Guardrails worth calling out

- **Command registration guardrail.** `tests/terminal/command-registration.test.ts` parses `lib/terminal/commands.ts` textually and fails the build if a `xxxCommand: Command = { … }` declaration is missing from the `commands[]` array at the bottom of the file. CLAUDE.md flags this as the single most common bug in the terminal subsystem — this test closes that hole.
- **Env validation.** `lib/env.ts` (public) and `lib/env.server.ts` (server-only, gated by `server-only`) validate environment variables at module load via Zod. Missing/invalid envs fail fast with a readable message instead of surfacing as cryptic Supabase stack traces later.
- **`preinstall` npm blocker.** `package.json` runs `npx only-allow pnpm` on every install. Accidentally running `npm install` or `yarn install` is rejected before any writes happen.

## When things fail

- **`pnpm install` refuses to run** → you're using npm/yarn. Use `pnpm install`.
- **`pnpm typecheck` is clean but CI fails** → check that your branch is rebased on the latest `main`; `.next/types` may have changed.
- **Lefthook blocks your commit** → fix what it flagged. If lefthook itself is broken, reinstall with `pnpm exec lefthook install`.
- **Playwright fails locally but not in CI (or vice versa)** → download the HTML report artifact from the CI run and compare traces.

# Tutorial: UnstableLabs Development Pipeline

This guide walks you through every part of the development pipeline -- from first clone to merged PR. Follow it step by step the first time; use the quick-reference tables afterward.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Initial Setup](#2-initial-setup)
3. [Daily Development Workflow](#3-daily-development-workflow)
4. [Code Quality Tools](#4-code-quality-tools)
5. [Testing](#5-testing)
6. [Database Workflow](#6-database-workflow)
7. [Git Hooks (Lefthook)](#7-git-hooks-lefthook)
8. [CI/CD Pipeline](#8-cicd-pipeline)
9. [Creating a Pull Request](#9-creating-a-pull-request)
10. [Environment Variables](#10-environment-variables)
11. [Electron Desktop Builds](#11-electron-desktop-builds)
12. [Troubleshooting](#12-troubleshooting)
13. [Command Reference](#13-command-reference)

---

## 1. Prerequisites

Install the following before you begin:

| Tool         | Version | Install                                                              |
| ------------ | ------- | -------------------------------------------------------------------- |
| Node.js      | 20+     | [nodejs.org](https://nodejs.org)                                     |
| pnpm         | 9+      | `corepack enable && corepack prepare pnpm@9 --activate`              |
| Supabase CLI | latest  | [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli) |
| Docker       | latest  | [docker.com](https://docker.com) (required for local Supabase)       |
| Git          | 2.30+   | [git-scm.com](https://git-scm.com)                                   |

> **Important:** This repository enforces pnpm. Running `npm install` or `yarn install` will be rejected automatically by the `preinstall` hook.

---

## 2. Initial Setup

```sh
# 1. Clone the repository
git clone git@github.com:unstablelabs/_unLABS.git
cd _unLABS

# 2. Install dependencies (also installs git hooks via Lefthook)
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Open .env.local and fill in the required values (see Section 10)

# 4. Start the local Supabase stack (requires Docker running)
pnpm db:start

# 5. Apply all database migrations
pnpm db:reset

# 6. Start the dev server
pnpm dev
# Open http://localhost:3000 in your browser
```

After `pnpm db:start`, the CLI prints your local Supabase credentials (URL, anon key, service role key). Copy these into `.env.local`.

---

## 3. Daily Development Workflow

The typical cycle looks like this:

```
Edit code -> Save -> Auto-format on commit -> Push -> CI validates -> Merge
```

### Start your session

```sh
pnpm dev              # Start the Next.js dev server (hot reload)
pnpm test:watch       # (optional) Run tests in watch mode in another terminal
```

### While coding

- Save your files normally. Prettier and ESLint run automatically on staged files when you commit.
- TypeScript checks run in your editor if configured, and also on every commit via Lefthook.

### When you are ready to commit

```sh
git add <files>
git commit -m "Add quantum flux calibration to DGN device"
```

Lefthook automatically runs on commit:

- **Prettier** formats your staged files
- **ESLint** fixes auto-fixable issues in staged files
- **TypeScript** type-checks the project

If any check fails, the commit is blocked. Fix the issue and try again.

### Before pushing

```sh
git push
```

Lefthook runs `pnpm test` on push. If tests fail, the push is blocked.

### Full pre-push sanity check (optional but recommended)

```sh
pnpm check
```

This runs the entire quality pipeline in sequence: lint, typecheck, format:check, test, build. It mirrors exactly what CI runs -- if this passes locally, CI will pass too.

---

## 4. Code Quality Tools

### ESLint (Linting)

Catches bugs, enforces code patterns, and flags unused variables.

```sh
pnpm lint             # Check for issues (warnings + errors)
pnpm lint:fix         # Auto-fix what can be fixed
```

The ESLint config (`eslint.config.mjs`) extends `eslint-config-next` with TypeScript and Core Web Vitals rules, plus `eslint-config-prettier` to avoid style conflicts.

### Prettier (Formatting)

Enforces consistent code style (semicolons, quotes, indentation, Tailwind class ordering).

```sh
pnpm format           # Format all files in-place
pnpm format:check     # Check without modifying (used in CI)
```

Config is in `.prettierrc.json`. Files excluded from formatting are listed in `.prettierignore`.

### TypeScript (Type Checking)

```sh
pnpm typecheck        # Run tsc --noEmit
```

Strict mode is enabled in `tsconfig.json`. No `any` types allowed -- use `unknown` and narrow with type guards.

---

## 5. Testing

### Unit / Integration Tests (Vitest)

```sh
pnpm test             # Run all tests once
pnpm test:watch       # Watch mode -- re-runs on file changes
```

Tests live in `tests/`:

- `tests/terminal/command-registration.test.ts` -- **Guardrail test.** Automatically verifies every terminal command declaration has a matching entry in the `commands[]` array. This catches the most common bug in the codebase.
- `tests/lib/env.test.ts` -- Validates the environment variable schema.

**Adding a test:** Create a `.test.ts` or `.test.tsx` file under `tests/<area>/`. Vitest picks it up automatically.

### End-to-End Tests (Playwright)

```sh
# First time only: install the browser
pnpm exec playwright install --with-deps chromium

# Run E2E tests
pnpm test:e2e         # Headless run
pnpm test:e2e:ui      # Interactive UI mode (great for debugging)
```

E2E tests live in `e2e/`. They boot the dev server automatically and drive a real Chromium browser.

---

## 6. Database Workflow

All database work goes through the Supabase CLI. **Never edit schema directly in Supabase Studio without capturing it as a migration.**

### Starting and stopping

```sh
pnpm db:start         # Start local Supabase (Postgres, Auth, Storage, Studio)
pnpm db:stop          # Stop the local stack
```

### Creating a new migration

```sh
# 1. Create the migration file
pnpm db:new add_missions_table
# This creates: supabase/migrations/<timestamp>_add_missions_table.sql

# 2. Edit the generated SQL file with your schema changes

# 3. Verify it applies cleanly
pnpm db:reset
# This wipes the local DB and replays every migration from scratch
```

### Capturing Studio edits (avoid when possible)

```sh
pnpm db:diff -f capture_studio_edits
pnpm db:reset         # Verify it replays cleanly
```

### Regenerating TypeScript types

```sh
pnpm db:types         # Overwrites types/database.ts from local schema
```

Run this after any migration that changes table or column shapes. The generated file is committed to git.

---

## 7. Git Hooks (Lefthook)

Lefthook runs quality checks automatically. It installs during `pnpm install` -- no extra setup needed.

| Hook         | When               | What runs                                                                |
| ------------ | ------------------ | ------------------------------------------------------------------------ |
| `pre-commit` | Every `git commit` | Prettier on staged files, ESLint --fix on staged files, `pnpm typecheck` |
| `pre-push`   | Every `git push`   | `pnpm test`                                                              |

### Reinstalling hooks

If hooks stop working (e.g., after a branch switch):

```sh
pnpm exec lefthook install
```

### Emergency bypass

If you are genuinely stuck and need to skip hooks temporarily:

```sh
LEFTHOOK=0 git commit -m "emergency fix"
LEFTHOOK=0 git push
```

Use this sparingly -- CI will still catch issues.

---

## 8. CI/CD Pipeline

GitHub Actions runs on every push to `main`/`develop` and on every pull request. The workflow (`.github/workflows/ci.yml`) has three jobs:

### Job 1: `quality`

Runs: `pnpm lint` -> `pnpm typecheck` -> `pnpm format:check` -> `pnpm test` -> `pnpm build`

This is identical to running `pnpm check` locally. If it passes on your machine, it passes in CI.

### Job 2: `migrations`

Starts a fresh Supabase instance, runs `supabase db reset` to replay every migration from an empty database, then `supabase db lint`. Proves migrations never silently drift.

### Job 3: `e2e` (depends on `quality`)

Installs Playwright's Chromium, runs `pnpm test:e2e`, and uploads the HTML report as a downloadable artifact (even on failure).

### CI Secrets Required

Add these to your GitHub repository settings (Settings > Secrets and variables > Actions):

| Secret                         | Value                                                       |
| ------------------------------ | ----------------------------------------------------------- |
| `CI_SUPABASE_ANON_KEY`         | Your Supabase anon key (local default or throwaway project) |
| `CI_SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key                              |

These do **not** need to be production credentials.

---

## 9. Creating a Pull Request

### Workflow

```sh
# 1. Create a feature branch
git checkout -b feat/quantum-calibration

# 2. Make your changes, commit as you go
#    (Lefthook validates each commit)

# 3. Run the full check before pushing
pnpm check

# 4. If you touched the database
pnpm db:reset

# 5. If you touched UI or routing
pnpm test:e2e

# 6. Push and create the PR
git push -u origin feat/quantum-calibration
gh pr create
```

### PR Checklist

The PR template prompts you to confirm:

- [ ] `pnpm check` passes locally
- [ ] Migrations (if any) apply on a fresh `pnpm db:reset`
- [ ] `pnpm test:e2e` passes if UI or routing changed
- [ ] Screenshots attached for UI changes

### Branch naming

- `feat/<short-name>` for features
- `fix/<short-name>` for bug fixes
- Never force-push `main` or `develop`

---

## 10. Environment Variables

Environment variables are validated at startup by `lib/env.ts` (public) and `lib/env.server.ts` (server-only). Missing or malformed variables fail fast with a clear error.

### Required in `.env.local`

| Variable                        | Where           | Description                                                      |
| ------------------------------- | --------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Client + Server | Your Supabase project URL (e.g., `http://localhost:54321`)       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous/public key                                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only     | Supabase service role key (admin access)                         |
| `NEXT_PUBLIC_APP_URL`           | Client + Server | App URL (e.g., `http://localhost:3000`). Optional, has fallback. |

### Getting local values

After running `pnpm db:start`, the Supabase CLI prints the local credentials. Copy them into `.env.local`.

---

## 11. Electron Desktop Builds

The Electron pipeline is separate from the web pipeline and remains fully functional.

```sh
pnpm electron:dev     # Dev mode: Next.js + Electron side by side
pnpm electron:compile # Compile TypeScript for Electron
pnpm build:mac        # Build macOS desktop app
pnpm build:win        # Build Windows desktop app
pnpm build:all        # Build for all platforms
```

Desktop builds are output to `.INSTALL/` (gitignored).

---

## 12. Troubleshooting

### `pnpm install` refuses to run

You are using npm or yarn. This repo is pnpm-only. Use `pnpm install`.

### `pnpm typecheck` passes locally but CI fails

Rebase your branch on the latest `main`. Next.js generates type files in `.next/types/` that may have changed.

### Lefthook blocks my commit

Read the error message -- it tells you which check failed. Fix the issue and re-commit. If Lefthook itself is broken:

```sh
pnpm exec lefthook install
```

### Prettier and ESLint disagree

This should not happen -- `eslint-config-prettier` disables conflicting rules. If it does, check that `prettier` is the last entry in `eslint.config.mjs`.

### E2E test fails locally but passes in CI (or vice versa)

Download the Playwright HTML report artifact from the CI run and compare traces. Common causes: different viewport sizes, network timing, missing env vars.

### "Invalid environment variables" error on startup

Check `.env.local`. The error message from `lib/env.ts` lists exactly which variables are missing or malformed.

### Database migration fails on `pnpm db:reset`

Check the SQL in your migration file. `db:reset` replays every migration from scratch on an empty database, so the error is in whichever migration file it stops at.

---

## 13. Command Reference

| Command                 | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm dev`              | Start Next.js dev server (port 3000)                             |
| `pnpm build`            | Production build                                                 |
| `pnpm start`            | Serve the production build                                       |
| `pnpm lint`             | Run ESLint                                                       |
| `pnpm lint:fix`         | Run ESLint with auto-fix                                         |
| `pnpm typecheck`        | Run `tsc --noEmit`                                               |
| `pnpm format`           | Format all files with Prettier                                   |
| `pnpm format:check`     | Check formatting (CI mode)                                       |
| `pnpm test`             | Run unit tests (Vitest)                                          |
| `pnpm test:watch`       | Run tests in watch mode                                          |
| `pnpm test:e2e`         | Run E2E tests (Playwright)                                       |
| `pnpm test:e2e:ui`      | Run E2E tests with interactive UI                                |
| `pnpm check`            | Full quality pipeline (lint + typecheck + format + test + build) |
| `pnpm db:start`         | Start local Supabase                                             |
| `pnpm db:stop`          | Stop local Supabase                                              |
| `pnpm db:reset`         | Reset DB, replay all migrations                                  |
| `pnpm db:new <name>`    | Create a new migration file                                      |
| `pnpm db:diff`          | Diff Studio changes into a migration                             |
| `pnpm db:types`         | Regenerate `types/database.ts`                                   |
| `pnpm electron:dev`     | Dev mode with Electron                                           |
| `pnpm electron:compile` | Compile Electron TypeScript                                      |
| `pnpm build:mac`        | Build macOS desktop app                                          |
| `pnpm build:win`        | Build Windows desktop app                                        |
| `pnpm build:all`        | Build all desktop platforms                                      |

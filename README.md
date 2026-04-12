# UnstableLabs (`unlabs`)

Next.js 16 / React 19 game simulating a Linux-like OS (`_unOS`) with an in-game terminal, hardware panel, and ~37 simulated devices. Runs in the browser and ships as an Electron desktop build.

## Prerequisites

- Node.js **20+**
- pnpm **9+** (`corepack enable && corepack prepare pnpm@9 --activate`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker (for the local database stack)

> The repo is **pnpm-only**. A `preinstall` hook blocks `npm install` and `yarn install`.

## First-time setup

```sh
git clone <repo>
cd unlabs
pnpm install
cp .env.example .env.local           # fill in Supabase keys
pnpm db:start                         # boots local Supabase (Docker)
pnpm db:reset                         # applies every migration from scratch
pnpm dev                              # http://localhost:3000
```

## Daily commands

| Command              | What it does                                                     |
| -------------------- | ---------------------------------------------------------------- |
| `pnpm dev`           | Next.js dev server on port 3000                                  |
| `pnpm build`         | Production build                                                 |
| `pnpm start`         | Run the production build                                         |
| `pnpm lint`          | ESLint (`eslint-config-next` + Prettier)                         |
| `pnpm typecheck`     | `tsc --noEmit`                                                   |
| `pnpm format`        | Prettier write                                                   |
| `pnpm format:check`  | Prettier check (CI)                                              |
| `pnpm test`          | Vitest unit/integration tests                                    |
| `pnpm test:watch`    | Vitest watch mode                                                |
| `pnpm test:e2e`      | Playwright smoke tests                                           |
| `pnpm check`         | lint + typecheck + format:check + test + build (pre-push sanity) |
| `pnpm db:start`      | Start local Supabase stack                                       |
| `pnpm db:stop`       | Stop local Supabase stack                                        |
| `pnpm db:reset`      | Reset local DB — replays every migration                         |
| `pnpm db:new <name>` | Create a new migration file                                      |
| `pnpm db:diff`       | Diff Studio changes into a new migration                         |
| `pnpm db:types`      | Regenerate `types/database.ts` from the local stack              |

Desktop / Electron scripts (`electron:dev`, `build:mac`, `build:win`, `build:all`) remain available — see `electron/` and `scripts/`.

## Quality gates

A local commit runs Prettier, ESLint, and `tsc` on staged files via [Lefthook](https://lefthook.dev/). A push runs the full unit test suite. GitHub Actions re-runs the same commands plus Playwright smoke tests and a clean Supabase migration replay on every PR. The local and CI commands are identical — if it passes locally, it passes in CI.

## Further reading

- [`CLAUDE.md`](./CLAUDE.md) — architecture overview and non-negotiable project standards
- [`docs/PIPELINE.md`](./docs/PIPELINE.md) — full breakdown of scripts, hooks, and CI jobs
- [`docs/SUPABASE.md`](./docs/SUPABASE.md) — database workflow
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — branching, commit style, PR checklist
- [`devices/README.md`](./devices/README.md) — device catalogue

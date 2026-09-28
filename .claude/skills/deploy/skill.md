---
description: Guide a release of UnstableLabs (web + desktop). Activates when the user asks to deploy, release, ship, or cut a version.
user_invocable: true
---

# Release Skill

## Pre-release checks (all must pass — never release with failures)

1. Working directory clean, on `main`
2. `pnpm check` passes (lint + typecheck + format + test + build)
3. Review commits since the last `release:` commit and summarize what ships

## Release steps

1. Bump `version` in `package.json` (beta scheme: `0.1.X-beta`)
2. Commit as `release: <version> — <summary>` and push
3. Watch CI: `gh run watch` (`.github/workflows/ci.yml`)
4. Desktop builds if requested: `pnpm build:mac` / `build:win` / `build:all` → output in `.INSTALL/` (note the dot)

## Rollback

Revert the release commit and push; rebuild desktop artifacts from the previous version if they were distributed.

Confirm each check before proceeding. If any check fails, stop and report.

---
description: Create well-formatted git commits following the team's conventions. Activates when the user asks to commit, save changes, or create a commit message.
user_invocable: true
---

# Commit Skill

## Format

```
<type>(<scope>): <short summary>

<body — explain WHY, not what>

<footer>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore` (build/CI/deps), `perf`, `style` (formatting only). Releases use `release: <version> — <summary>`.

## Rules

- Summary: imperative, lowercase, no period, ≤50 chars; scope = affected module (e.g. `terminal`, `panel`, `unos`, `missions`)
- Body: wrap at 72 chars, explain motivation
- Footer: `Closes #123` or breaking-change notes

## Process

1. `git status` + `git diff --staged` to understand all changes
2. One commit per logical change; stage only related files (no blanket `git add .`)

## Example

```
fix(missions): unblock claim buttons; keep claimed missions reviewable

Claim state was derived from stale save data, disabling the button
after reload even for unclaimed missions.

Closes #891
```

---
description: Review pull requests using the team's checklist. Activates when the user asks to review a PR, check code changes, or provide feedback on a diff.
user_invocable: true
---

# PR Review Skill

Read the full diff and the PR description (does it explain the why?) before commenting, then check each file against:

- **Correctness** — logic + edge cases; no off-by-one/null/race risks; error handling present; no regressions
- **Security** — no secrets in code; input validated; no SQL injection/XSS/command injection; auth checks where needed
- **Quality** — follows project patterns; no dead code or ticket-less TODOs; focused functions; clear naming
- **Testing** — new code has tests; edge cases covered; existing tests pass
- **Performance** — no N+1 queries; no blocking ops in hot paths; large data paginated/streamed

## Output

```
## Summary
[1–2 sentences]

## Verdict: APPROVE | REQUEST_CHANGES | COMMENT

## Issues
### Critical (must fix)
### Suggestions (nice to have)

## What Looks Good
```

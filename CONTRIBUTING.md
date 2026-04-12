# Contributing

## Branching

- `main` is protected — never force-push.
- `develop` is the integration branch for larger efforts when needed.
- Feature work happens on `feat/<short-name>` or `fix/<short-name>` branches off `main`.

## Commit style

- Imperative subject, ≤72 characters (`Add fwupdate --rollback flag`).
- Body explains **why**, not what.
- If a commit touches the database, reference the migration filename in the body.

## Before opening a PR

Run:

```sh
pnpm check          # lint + typecheck + format:check + test + build
pnpm test:e2e       # if UI or routing changed
pnpm db:reset       # if you added a migration
```

Lefthook runs format/lint/typecheck on every commit automatically, but `pnpm check` is the authoritative gate.

## PR checklist

The PR template prompts for:

- `pnpm check` passing locally
- Migrations (if any) applying on a fresh `pnpm db:reset`
- Screenshots for any UI change

## CI secrets

CI needs two repository secrets to build against a dummy Supabase config:

- `CI_SUPABASE_ANON_KEY`
- `CI_SUPABASE_SERVICE_ROLE_KEY`

These can point at a throwaway Supabase project or reuse the default local keys printed by `supabase start`. They do **not** need to be production credentials.

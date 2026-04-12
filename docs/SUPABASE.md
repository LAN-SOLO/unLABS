# Supabase workflow

All database work goes through the Supabase CLI and versioned migrations under `supabase/migrations/`. **Never edit schema in Studio without capturing it into a migration.**

## Start / stop the local stack

```sh
pnpm db:start     # boots Postgres, Studio, Auth, Storage in Docker
pnpm db:stop
```

The stack's credentials and port numbers are printed after `db:start`. Use them in `.env.local`.

## Creating a migration

```sh
pnpm db:new add_missions_table        # creates supabase/migrations/<ts>_add_missions_table.sql
# edit the generated file
pnpm db:reset                         # wipes local DB, replays every migration from scratch
```

`db:reset` is the fast way to verify your migration applies cleanly on an empty database — CI does the same thing in the `migrations` job.

## Capturing Studio edits

If you made a schema change directly in Studio (avoid this when possible):

```sh
pnpm db:diff -f capture_studio_edits  # writes the diff as a new migration
pnpm db:reset                         # verify it replays cleanly
```

## Regenerating TypeScript types

```sh
pnpm db:types        # overwrites types/database.ts from the current local schema
```

Run this whenever you apply a migration that changes table or column shapes. The generated file is tracked in git.

## Rules

- Schema changes live in `supabase/migrations/` — nowhere else.
- Never run `DROP`, `TRUNCATE`, or any other destructive SQL against a non-local database without explicit confirmation from the user.
- `types/database.ts` is generated — regenerate it, don't hand-edit it.

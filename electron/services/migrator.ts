import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Runs all SQL migrations against the local PostgreSQL instance.
 * Also creates the Supabase-compatible roles that PostgREST needs.
 *
 * Idempotency strategy:
 *   - A `public._unlabs_migrations(name text primary key, ...)` table tracks
 *     which SQL files have already been applied. Subsequent runs skip them.
 *   - On first encounter (table empty, but the legacy first-run sentinel
 *     exists), seed the table by marking every migration whose filename
 *     timestamp is older than the sentinel as already-applied. This unblocks
 *     existing installs from re-running migrations that already ran in a
 *     prior build.
 *   - After applying any new migrations, NOTIFY pgrst 'reload schema' so
 *     PostgREST picks up new columns/tables without a restart.
 */
/**
 * Cutoff timestamp for orphan-recovery seeding. Migrations whose filename
 * timestamp prefix is less than or equal to this are presumed already
 * applied when we encounter an orphan state (existing pgdata, no sentinel,
 * empty tracking table). Any migration newer than this cutoff is re-run
 * even on orphan recovery — that's how new releases reach users whose
 * data dir survived an uninstall/reinstall.
 *
 * Bump policy: set this to the timestamp prefix of the LAST migration
 * that shipped in the PREVIOUS build (i.e. the build users may be
 * upgrading FROM). Any migrations added in the CURRENT build must be
 * strictly greater than this value so they actually run on upgrade.
 *
 * Current value (0.1.10-beta): last 0.1.9-alpha migration was
 * 20260429000001_tutorial_difficulty. The 20260521xxx migration adding the
 * balances UPDATE RLS policy is new in this release and must run.
 *
 * Backstop: the self-heal pass below detects tracked migrations whose
 * declared tables/columns don't actually exist and untracks them, so
 * even a wrong cutoff can be recovered from on a subsequent boot.
 */
const ORPHAN_RECOVERY_CUTOFF = "20260412999999";

/**
 * @param runSqlFiles If false, only creates schemas and roles. If true, runs SQL migration files.
 * @param sentinelPath Optional path to the legacy first-run sentinel — used to seed the
 *                     migration tracking table for users upgrading from a build that
 *                     predated tracking.
 * @param isOrphanRecovery When true, the data directory has prior-build content but the
 *                         sentinel file is gone. Seed all migrations <= the recovery
 *                         cutoff as applied so we don't re-run them against existing data.
 */
export async function runMigrations(
  pgPort: number,
  migrationsDir: string,
  runSqlFiles: boolean = true,
  sentinelPath?: string,
  isOrphanRecovery: boolean = false,
): Promise<void> {
  // Dynamic import for pg (CommonJS compat)
  const { Client } = await import("pg");

  const client = new Client({
    host: "127.0.0.1",
    port: pgPort,
    user: "postgres",
    database: "unlabs",
  });

  await client.connect();

  try {
    // Create the auth schema that GoTrue will populate with its migrations
    await executeIgnoringErrors(client, `CREATE SCHEMA IF NOT EXISTS auth`);
    await executeIgnoringErrors(client, `CREATE SCHEMA IF NOT EXISTS extensions`);
    // Grant full auth schema ownership to postgres so GoTrue can create tables
    await executeIgnoringErrors(client, `GRANT ALL ON SCHEMA auth TO postgres`);
    await executeIgnoringErrors(
      client,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO postgres`,
    );
    await executeIgnoringErrors(
      client,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres`,
    );
    await executeIgnoringErrors(
      client,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres`,
    );
    console.log("[migrator] auth + extensions schemas created");

    // Create Supabase-compatible roles
    await executeIgnoringErrors(client, `CREATE ROLE anon NOLOGIN`);
    await executeIgnoringErrors(client, `CREATE ROLE authenticated NOLOGIN`);
    await executeIgnoringErrors(client, `CREATE ROLE service_role NOLOGIN BYPASSRLS`);
    await executeIgnoringErrors(
      client,
      `CREATE ROLE authenticator LOGIN PASSWORD 'postgres' NOINHERIT`,
    );
    await executeIgnoringErrors(client, `GRANT anon TO authenticator`);
    await executeIgnoringErrors(client, `GRANT authenticated TO authenticator`);
    await executeIgnoringErrors(client, `GRANT service_role TO authenticator`);
    await executeIgnoringErrors(client, `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Grant schema usage
    await executeIgnoringErrors(
      client,
      `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`,
    );
    await executeIgnoringErrors(
      client,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role`,
    );
    await executeIgnoringErrors(
      client,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role`,
    );
    await executeIgnoringErrors(
      client,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role`,
    );

    console.log("[migrator] Roles created");

    if (!runSqlFiles) {
      // Load the complete auth schema from the bundled SQL file
      // (exported from the Supabase Docker DB which has the full schema).
      // The .sql file lives in electron/auth/ in source. tsc only emits .js
      // into dist-electron, so the SQL stays at electron/auth/ in both dev
      // and the packaged app (electron-builder copies it into Resources/app/
      // via the `files` glob).
      const { app } = require("electron") as typeof import("electron");
      const authSchemaPath = app.isPackaged
        ? join(app.getAppPath(), "electron", "auth", "init-auth-schema.sql")
        : join(__dirname, "..", "..", "electron", "auth", "init-auth-schema.sql");
      const authSchemaSql = readFileSync(authSchemaPath, "utf-8");
      await client.query(authSchemaSql);
      console.log("[migrator] Complete auth schema loaded from SQL dump");

      // Ensure auth.uid() and auth.role() exist (the SQL dump may not include them
      // if they were created by a different mechanism in the Docker setup)
      await executeIgnoringErrors(
        client,
        `
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
        AS $$ SELECT COALESCE(current_setting('request.jwt.claim.sub', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'sub'))::uuid $$
      `,
      );
      await executeIgnoringErrors(
        client,
        `
        CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
        AS $$ SELECT COALESCE(current_setting('request.jwt.claim.role', true), (current_setting('request.jwt.claims', true)::jsonb ->> 'role'))::text $$
      `,
      );
      // Grant auth schema to roles
      await executeIgnoringErrors(
        client,
        `GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role`,
      );
      await executeIgnoringErrors(
        client,
        `GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role`,
      );
      await executeIgnoringErrors(
        client,
        `GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role`,
      );
      console.log("[migrator] auth functions created");
      return;
    }

    // Tracking table for applied migrations. Created here (not as a migration)
    // so it exists before we try to query it.
    await client.query(`
      create table if not exists public._unlabs_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    // Read and execute migration files in order
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Already-applied set (reading from the tracking table).
    const appliedRes = await client.query("select name from public._unlabs_migrations");
    const applied = new Set<string>(appliedRes.rows.map((r: { name: string }) => r.name));

    // Orphan recovery: pgdata is populated from a previous install but the
    // sentinel is gone. Mark every migration up to the build's recovery
    // cutoff as already applied — running them against existing data would
    // throw on duplicate tables/columns. Anything newer than the cutoff is
    // genuinely new in this build and runs normally.
    //
    // Caveat: a *partial* prior install (postgres initialized, then crashed
    // before any app migrations ran) also looks like orphan recovery. In
    // that case the public schema is empty and seeding pre-cutoff
    // migrations as "applied" causes later migrations to fail against
    // missing tables. Detect this by counting non-internal public tables;
    // if there are none, treat as a clean slate and run all migrations.
    if (applied.size === 0 && isOrphanRecovery) {
      const tableCountRes = await client.query<{ count: string }>(
        `select count(*)::text as count from pg_tables
         where schemaname = 'public' and tablename <> '_unlabs_migrations'`,
      );
      const publicTableCount = Number(tableCountRes.rows[0]?.count ?? "0");
      if (publicTableCount === 0) {
        console.log(
          "[migrator] Orphan recovery: public schema is empty (prior install crashed before migrating); running all migrations from scratch",
        );
      } else {
        const cutoffPrefix = ORPHAN_RECOVERY_CUTOFF;
        for (const file of files) {
          const prefix = file.match(/^\d+/)?.[0];
          if (prefix && prefix <= cutoffPrefix) {
            await client.query(
              `insert into public._unlabs_migrations (name) values ($1)
               on conflict (name) do nothing`,
              [file],
            );
            applied.add(file);
          }
        }
        console.log(
          `[migrator] Orphan recovery: seeded tracking table with ${applied.size} pre-cutoff migrations`,
        );
      }
    }

    // Upgrade-from-untracked: if the table is empty but a sentinel from a
    // prior build exists, the user already has every migration up to that
    // sentinel time applied — seed the table so we don't re-run them.
    if (applied.size === 0 && sentinelPath && existsSync(sentinelPath)) {
      let sentinelMs: number | null = null;
      try {
        const text = readFileSync(sentinelPath, "utf-8").trim();
        const parsed = Date.parse(text);
        if (!Number.isNaN(parsed)) sentinelMs = parsed;
      } catch {
        /* fall through to mtime */
      }
      if (sentinelMs === null) {
        try {
          sentinelMs = statSync(sentinelPath).mtimeMs;
        } catch {
          sentinelMs = null;
        }
      }
      if (sentinelMs !== null) {
        for (const file of files) {
          const fileMs = parseMigrationDate(file);
          if (fileMs !== null && fileMs <= sentinelMs) {
            await client.query(
              `insert into public._unlabs_migrations (name) values ($1)
               on conflict (name) do nothing`,
              [file],
            );
            applied.add(file);
          }
        }
        console.log(
          `[migrator] Seeded tracking table with ${applied.size} pre-existing migrations`,
        );
      }
    }

    // Self-heal: detect tracked migrations whose declared schema isn't
    // actually present. This catches the case where a prior boot's
    // orphan-recovery or sentinel-based seeding marked migrations as
    // applied that hadn't truly run (e.g. the cutoff was set wrong in an
    // earlier release, or the user upgraded from a build that didn't
    // include them).
    //
    // The probe parses each migration for `create table public.X` and
    // `alter table public.X add column Y` declarations and checks if those
    // exist. Migrations that declare only functions / policies / indexes
    // are left alone (no table or column to probe).
    if (applied.size > 0) {
      const selfHealed: Array<{ file: string; missing: string[] }> = [];
      for (const file of files) {
        if (!applied.has(file)) continue;
        const sql = readFileSync(join(migrationsDir, file), "utf-8");
        const missing = await detectMissingArtifacts(client, sql);
        if (missing.length > 0) {
          await client.query(`delete from public._unlabs_migrations where name = $1`, [file]);
          applied.delete(file);
          selfHealed.push({ file, missing });
        }
      }
      if (selfHealed.length > 0) {
        console.log(
          `[migrator] Self-heal: untracked ${selfHealed.length} migration(s) with missing schema:`,
        );
        for (const { file, missing } of selfHealed) {
          console.log(`  - ${file} → missing: ${missing.join(", ")}`);
        }
      }
    }

    let appliedThisRun = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          `insert into public._unlabs_migrations (name) values ($1)
           on conflict (name) do nothing`,
          [file],
        );
        await client.query("COMMIT");
        console.log(`[migrator] Applied: ${file}`);
        appliedThisRun++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrator] Failed: ${file}`, err);
        throw err;
      }
    }

    // Grant permissions on all existing tables to roles
    await executeIgnoringErrors(
      client,
      `
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        LOOP
          EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', r.tablename);
        END LOOP;
      END $$;
    `,
    );

    // Always nudge PostgREST. Even on a no-op run, a prior boot's NOTIFY
    // might never have landed (PostgREST not yet listening, mismatched
    // channel name in an older build, partial migration apply, etc.).
    // The reload is cheap and idempotent — sending it every boot avoids
    // sticky "schema cache" errors with no functional downside.
    await executeIgnoringErrors(client, `NOTIFY pgrst, 'reload schema'`);
    if (appliedThisRun > 0) {
      console.log(`[migrator] Applied ${appliedThisRun} new migration(s); PostgREST notified`);
    } else {
      console.log("[migrator] All migrations already applied; PostgREST notified");
    }
  } finally {
    await client.end();
  }
}

/**
 * Parses the leading `YYYYMMDDhhmmss` timestamp from a migration filename
 * into a Unix-ms epoch. Returns null if the filename doesn't match.
 */
function parseMigrationDate(filename: string): number | null {
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const ms = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return Number.isNaN(ms) ? null : ms;
}

async function executeIgnoringErrors(
  client: InstanceType<typeof import("pg").Client>,
  sql: string,
): Promise<void> {
  try {
    await client.query(sql);
  } catch {
    // Ignore errors (role already exists, etc.)
  }
}

/**
 * Heuristic schema probe for the self-heal pass. Parses a migration's SQL
 * for `create table public.X` and `alter table public.X add column Y`
 * declarations and checks whether each declared artifact actually exists
 * in the live schema. Returns the list of missing artifacts; an empty
 * array means either everything is in place or the migration declares
 * only objects we don't track here (functions, policies, indexes, RLS,
 * grants, comments, data-only).
 *
 * Comments are stripped before scanning so prose like "Tables: foo, bar"
 * inside a doc block doesn't produce false positives.
 */
async function detectMissingArtifacts(
  client: InstanceType<typeof import("pg").Client>,
  sql: string,
): Promise<string[]> {
  const code = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--.*$/gm, "");
  const missing: string[] = [];

  // create table [if not exists] public.<name>
  const tableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;
  const tables = new Set<string>();
  for (const m of code.matchAll(tableRe)) tables.add(m[1].toLowerCase());
  for (const t of tables) {
    const r = await client.query(
      `select 1 from pg_tables where schemaname = 'public' and tablename = $1`,
      [t],
    );
    if (r.rowCount === 0) missing.push(`table ${t}`);
  }

  // alter table [only] public.<table> ... add column [if not exists] <col>
  // ALTER TABLE statements terminate at the next semicolon; multiple
  // ADD COLUMN clauses inside one statement are matched independently.
  const alterRe = /alter\s+table\s+(?:only\s+)?public\.([a-z_][a-z0-9_]*)([\s\S]*?);/gi;
  for (const m of code.matchAll(alterRe)) {
    const table = m[1].toLowerCase();
    const body = m[2];
    const colRe = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi;
    for (const cm of body.matchAll(colRe)) {
      const col = cm[1].toLowerCase();
      const r = await client.query(
        `select 1 from information_schema.columns
         where table_schema = 'public' and table_name = $1 and column_name = $2`,
        [table, col],
      );
      if (r.rowCount === 0) missing.push(`column ${table}.${col}`);
    }
  }

  return missing;
}

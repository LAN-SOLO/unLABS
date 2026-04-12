import { readdirSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Runs all SQL migrations against the local PostgreSQL instance.
 * Also creates the Supabase-compatible roles that PostgREST needs.
 */
/**
 * @param runSqlFiles If false, only creates schemas and roles. If true, runs SQL migration files.
 */
export async function runMigrations(
  pgPort: number,
  migrationsDir: string,
  runSqlFiles: boolean = true,
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
      // (exported from the Supabase Docker DB which has the full schema)
      const authSchemaPath = join(__dirname, "..", "auth", "init-auth-schema.sql");
      let authSchemaSql: string;
      try {
        authSchemaSql = readFileSync(authSchemaPath, "utf-8");
      } catch {
        // In packaged app, try resources path
        const { app } = require("electron") as typeof import("electron");
        const altPath = join(app.getAppPath(), "dist-electron", "auth", "init-auth-schema.sql");
        authSchemaSql = readFileSync(altPath, "utf-8");
      }
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

    // Read and execute migration files in order
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
        console.log(`[migrator] Applied: ${file}`);
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

    console.log("[migrator] All migrations applied");
  } finally {
    await client.end();
  }
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

import { execFileSync, spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let pgProcess: ChildProcess | null = null;

function pgBin(binDir: string, name: string): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return join(binDir, "postgres", "bin", `${name}${ext}`);
}

export async function startPostgres(
  binDir: string,
  dataDir: string,
  port: number,
  isFirstRun: boolean,
  password: string,
): Promise<void> {
  const initdbPath = pgBin(binDir, "initdb");
  const pgCtlPath = pgBin(binDir, "pg_ctl");
  const createdbPath = pgBin(binDir, "createdb");

  // Initialize data directory only when there's no PG_VERSION marker. This
  // keeps initdb from blowing up when the user has a leftover, populated
  // pgdata from a prior install (e.g. they deleted the .initialized
  // sentinel but pgdata stayed) — in that case the cluster is already
  // initialized and we should reuse it. The `isFirstRun` flag in main.ts
  // tracks the *app-level* first run (no sentinel), which is independent
  // of whether postgres itself has been initialized.
  const pgInitialized = existsSync(join(dataDir, "PG_VERSION"));
  if (!pgInitialized) {
    // Remove any leftover partial data dir from a previous failed init
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true, force: true });
    }
    mkdirSync(dataDir, { recursive: true });

    // Password auth from the very first start: the superuser password comes
    // from a throw-away 0600 file (never on the command line).
    const pwDir = mkdtempSync(join(tmpdir(), "unlabs-pg-"));
    const pwFile = join(pwDir, "pw");
    writeFileSync(pwFile, password, { encoding: "utf-8", mode: 0o600 });

    // Set PGTZ and use --locale=C to avoid locale issues on macOS
    const libDir = join(binDir, "postgres", "lib");
    const shareDir = join(binDir, "postgres", "share");
    try {
      execFileSync(
        initdbPath,
        [
          "-D",
          dataDir,
          "-U",
          "postgres",
          "--auth=scram-sha-256",
          `--pwfile=${pwFile}`,
          "--encoding=UTF8",
          "--locale=C",
        ],
        {
          stdio: "pipe",
          env: {
            ...childEnv(),
            LD_LIBRARY_PATH: libDir,
            DYLD_LIBRARY_PATH: libDir,
            PGDATA: dataDir,
            PGSHAREDIR: shareDir,
          },
        },
      );
    } finally {
      rmSync(pwDir, { recursive: true, force: true });
    }
  }
  // Suppress unused-param lint without changing the public signature.
  void isFirstRun;

  // Start PostgreSQL
  const libDir = join(binDir, "postgres", "lib");
  return new Promise<void>((resolve, reject) => {
    pgProcess = spawn(
      pgCtlPath,
      [
        "start",
        "-D",
        dataDir,
        "-l",
        join(dataDir, "postgres.log"),
        "-o",
        `-p ${port} -h 127.0.0.1`,
        "-w", // wait until started
      ],
      {
        stdio: "pipe",
        env: {
          ...childEnv(),
          LD_LIBRARY_PATH: libDir,
          DYLD_LIBRARY_PATH: libDir,
        },
      },
    );

    pgProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_ctl start exited with code ${code}`));
      }
    });

    pgProcess.on("error", reject);
  });
}

export async function createDatabase(port: number, password: string): Promise<void> {
  // Use pg client to create the database (more reliable than createdb binary)
  const { Client } = await import("pg");
  const client = new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres", // connect to default db first
  });
  await client.connect();
  try {
    await client.query("CREATE DATABASE unlabs");
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    // 42P04 = database already exists
    if (pgErr.code !== "42P04") throw err;
  } finally {
    await client.end();
  }
}

export async function stopPostgres(binDir: string, dataDir: string): Promise<void> {
  const pgCtlPath = pgBin(binDir, "pg_ctl");
  try {
    execFileSync(pgCtlPath, ["stop", "-D", dataDir, "-m", "fast"], {
      stdio: "pipe",
      timeout: 10000,
    });
  } catch {
    // Already stopped or doesn't exist
  }
  pgProcess = null;
}

/**
 * Lock the cluster down to password authentication on every boot.
 *
 * Builds up to 0.3.0 ran initdb with `--auth=trust` and gave the
 * `authenticator` role the fixed password 'postgres', so any local process
 * (or other OS user) could connect as superuser. This sets per-install
 * SCRAM passwords for `postgres` and `authenticator`, rewrites pg_hba.conf
 * (loopback + local socket only, no trust) and reloads the config. It is
 * idempotent: on an already hardened cluster it just re-applies the same.
 */
export async function hardenPostgresAuth(
  port: number,
  dataDir: string,
  password: string,
): Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(password)) throw new Error("invalid database password");
  const { Client } = await import("pg");
  const client = new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "postgres",
  });
  await client.connect();
  try {
    await client.query(`SET password_encryption = 'scram-sha-256'`);
    // Hex-only secret (checked above) — safe as a literal; ALTER ROLE takes no bind params.
    await client.query(`ALTER ROLE postgres WITH PASSWORD '${password}'`);
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
          ALTER ROLE authenticator WITH PASSWORD '${password}';
        END IF;
      END $$`);
    const lines = [
      "# Managed by UnstableLabs — password (SCRAM) auth only, loopback only.",
      ...(process.platform === "win32" ? [] : ["local   all  all                 scram-sha-256"]),
      "host    all  all  127.0.0.1/32    scram-sha-256",
      "host    all  all  ::1/128         scram-sha-256",
      "",
    ];
    writeFileSync(join(dataDir, "pg_hba.conf"), lines.join("\n"), {
      encoding: "utf-8",
      mode: 0o600,
    });
    await client.query("SELECT pg_reload_conf()");
  } finally {
    await client.end();
  }
}

/**
 * Environment for bundled child processes: the user's environment minus
 * variables that inject code or libraries into them.
 */
export function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      key === "NODE_OPTIONS" ||
      key === "ELECTRON_RUN_AS_NODE" ||
      key.startsWith("DYLD_") ||
      key.startsWith("LD_")
    ) {
      delete env[key];
    }
  }
  return env;
}

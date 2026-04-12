import { execFileSync, spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync } from "fs";
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
): Promise<void> {
  const initdbPath = pgBin(binDir, "initdb");
  const pgCtlPath = pgBin(binDir, "pg_ctl");
  const createdbPath = pgBin(binDir, "createdb");

  // Initialize data directory on first run
  if (isFirstRun || !existsSync(join(dataDir, "PG_VERSION"))) {
    // Remove any leftover partial data dir from a previous failed init
    if (existsSync(dataDir) && !existsSync(join(dataDir, "PG_VERSION"))) {
      const { rmSync } = require("fs") as typeof import("fs");
      rmSync(dataDir, { recursive: true, force: true });
    }
    mkdirSync(dataDir, { recursive: true });

    // Set PGTZ and use --locale=C to avoid locale issues on macOS
    const libDir = join(binDir, "postgres", "lib");
    const shareDir = join(binDir, "postgres", "share");
    execFileSync(
      initdbPath,
      ["-D", dataDir, "-U", "postgres", "--auth=trust", "--encoding=UTF8", "--locale=C"],
      {
        stdio: "pipe",
        env: {
          ...process.env,
          LD_LIBRARY_PATH: libDir,
          DYLD_LIBRARY_PATH: libDir,
          PGDATA: dataDir,
          PGSHAREDIR: shareDir,
        },
      },
    );
  }

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
          ...process.env,
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

export async function createDatabase(port: number): Promise<void> {
  // Use pg client to create the database (more reliable than createdb binary)
  const { Client } = await import("pg");
  const client = new Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
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

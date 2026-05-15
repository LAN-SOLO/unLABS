import { spawn, type ChildProcess } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

let postgrestProcess: ChildProcess | null = null;

function postGrestBin(binDir: string): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return join(binDir, `postgrest${ext}`);
}

async function waitForReady(port: number, timeoutMs: number = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok || res.status === 200) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`PostgREST health check timed out after ${timeoutMs}ms`);
}

export async function startPostgREST(
  binDir: string,
  userDataDir: string,
  port: number,
  pgPort: number,
  jwtSecret: string,
): Promise<void> {
  const binary = postGrestBin(binDir);

  // Generate config file
  const configPath = join(userDataDir, "postgrest.conf");
  const config = [
    `db-uri = "postgres://authenticator:postgres@127.0.0.1:${pgPort}/unlabs"`,
    `db-schemas = "public,storage"`,
    `db-anon-role = "anon"`,
    `jwt-secret = "${jwtSecret}"`,
    `server-host = "127.0.0.1"`,
    `server-port = ${port}`,
    `db-extra-search-path = "public,extensions"`,
  ].join("\n");
  writeFileSync(configPath, config, "utf-8");

  postgrestProcess = spawn(binary, [configPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  postgrestProcess.on("error", (err) => {
    console.error("[postgrest] Process error:", err);
  });

  postgrestProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error("[postgrest]", msg);
  });

  await waitForReady(port);
}

export function stopPostgREST(): void {
  if (postgrestProcess) {
    postgrestProcess.kill("SIGTERM");
    postgrestProcess = null;
  }
}

async function sendNotifyReload(pgPort: number): Promise<void> {
  const { Client } = await import("pg");
  const client = new Client({
    host: "127.0.0.1",
    port: pgPort,
    user: "postgres",
    database: "unlabs",
  });
  await client.connect();
  try {
    await client.query(`NOTIFY pgrst, 'reload schema'`);
  } finally {
    await client.end();
  }
}

/**
 * Block until PostgREST's schema cache resolves the canary column. The
 * migrator's boot-time NOTIFY (sent before startPostgREST) lands in an
 * empty channel, and PostgREST's initial introspect can race with the
 * just-applied migrations, leaving the cache out of date. Empirically
 * a single post-start NOTIFY isn't enough to win every race.
 *
 * Strategy: probe PostgREST for `profiles.tutorial_state` (the canary
 * column added by the newest migration). If absent, send another NOTIFY
 * and back off. Repeat until visible or the timeout expires.
 *
 * On timeout we log loudly but let boot continue — the app may still
 * work for non-tutorial flows, and the renderer can retry on user
 * interaction.
 *
 * Update the canary if a future migration adds a column users will hit
 * earlier than tutorial_state.
 */
export async function ensurePostgrestSchemaReady(
  pgPort: number,
  postgrestPort: number,
  timeoutMs: number = 10_000,
): Promise<void> {
  const probeUrl = `http://127.0.0.1:${postgrestPort}/profiles?select=tutorial_state&limit=0`;
  const start = Date.now();
  let attempts = 0;
  let lastDetail = "";

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(probeUrl);
      if (res.ok) {
        if (attempts > 0) {
          console.log(
            `[postgrest] Schema cache ready after ${attempts} NOTIFY retry(s) in ${Date.now() - start}ms`,
          );
        }
        return;
      }
      lastDetail = `${res.status} ${(await res.text()).slice(0, 200)}`;
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : String(err);
    }

    try {
      await sendNotifyReload(pgPort);
      attempts++;
    } catch (err) {
      console.warn(
        "[postgrest] NOTIFY pgrst failed during cache-readiness probe:",
        err instanceof Error ? err.message : err,
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.error(
    `[postgrest] Schema cache not ready after ${timeoutMs}ms (sent ${attempts} NOTIFY); last response: ${lastDetail}`,
  );
}

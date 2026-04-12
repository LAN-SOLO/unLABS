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

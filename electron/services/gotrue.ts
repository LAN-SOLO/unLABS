import { spawn, type ChildProcess } from "child_process";
import { join } from "path";

let gotrueProcess: ChildProcess | null = null;

function goTrueBin(binDir: string): string {
  const ext = process.platform === "win32" ? ".exe" : "";
  return join(binDir, `gotrue${ext}`);
}

async function waitForHealth(port: number, timeoutMs: number = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`GoTrue health check timed out after ${timeoutMs}ms`);
}

export async function startGoTrue(
  binDir: string,
  port: number,
  pgPort: number,
  jwtSecret: string,
): Promise<void> {
  const binary = goTrueBin(binDir);

  const gotrueEnv = {
    ...process.env,
    GOTRUE_DB_DRIVER: "postgres",
    GOTRUE_DB_DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${pgPort}/unlabs?sslmode=disable&search_path=auth`,
    GOTRUE_API_HOST: "127.0.0.1",
    GOTRUE_API_PORT: String(port),
    GOTRUE_JWT_SECRET: jwtSecret,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_SITE_URL: "http://127.0.0.1:3000",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
    GOTRUE_DISABLE_SIGNUP: "false",
    GOTRUE_LOG_LEVEL: "warn",
    API_EXTERNAL_URL: `http://127.0.0.1:${port}`,
    GOTRUE_API_EXTERNAL_URL: `http://127.0.0.1:${port}`,
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${pgPort}/unlabs?sslmode=disable&search_path=auth`,
    GOTRUE_RATE_LIMIT_HEADER: "X-Forwarded-For",
    GOTRUE_DB_NAMESPACE: "auth",
  };

  // Skip GoTrue's migrate — we pre-create all auth tables in the migrator.
  // GoTrue's migrate can reset the schema and cause conflicts.
  console.log("[gotrue] Skipping GoTrue migrate (auth tables pre-created)");

  gotrueProcess = spawn(binary, ["serve"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: gotrueEnv,
  });

  gotrueProcess.on("error", (err) => {
    console.error("[gotrue] Process error:", err);
  });

  gotrueProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error("[gotrue]", msg);
  });

  await waitForHealth(port);
}

export function stopGoTrue(): void {
  if (gotrueProcess) {
    gotrueProcess.kill("SIGTERM");
    gotrueProcess = null;
  }
}

import { app, ipcMain } from "electron";
import { join } from "path";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { createMainWindow, getMainWindow } from "./window";
import { getAppVersion } from "./version";
import { startPostgres, stopPostgres, createDatabase } from "./services/postgres";
import { startGoTrue, stopGoTrue } from "./services/gotrue";
import { startPostgREST, stopPostgREST } from "./services/postgrest";
import { startGateway, stopGateway } from "./services/gateway";
import { startNextServer, stopNextServer } from "./services/nextServer";
import { runMigrations } from "./services/migrator";
import { generateJwtSecret, generateAnonKey, generateServiceRoleKey } from "./config/jwt";
// localUser module kept for reference but login now handled via setup page

// ── State ─────────────────────────────────────────────────────────────

interface ServicePorts {
  postgres: number;
  gotrue: number;
  postgrest: number;
  gateway: number;
  next: number;
}

let ports: ServicePorts;
let jwtSecret: string;
let anonKey: string;
let serviceRoleKey: string;

// ── Paths ─────────────────────────────────────────────────────────────

function getUserDataPath(): string {
  return app.getPath("userData");
}

function getDataDir(): string {
  return join(getUserDataPath(), "pgdata");
}

function getBinDir(): string {
  // In packaged app, binaries are in resources/bin
  // In dev, they're in bin/{platform}-{arch}/
  if (app.isPackaged) {
    return join(process.resourcesPath, "bin");
  }
  return join(__dirname, "..", "bin", `${process.platform}-${process.arch}`);
}

function getMigrationsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "migrations");
  }
  return join(__dirname, "..", "supabase", "migrations");
}

function getSentinelPath(): string {
  return join(getUserDataPath(), ".initialized");
}

function getJwtSecretPath(): string {
  return join(getUserDataPath(), "jwt-secret");
}

// ── Port allocation ───────────────────────────────────────────────────

async function allocatePorts(): Promise<ServicePorts> {
  // Dynamic import for ESM package
  const { default: getPort } = await import("get-port");
  return {
    postgres: await getPort({ port: 54322 }),
    gotrue: await getPort({ port: 9999 }),
    postgrest: await getPort({ port: 3001 }),
    gateway: await getPort({ port: 54321 }),
    next: await getPort({ port: 3000 }),
  };
}

// ── JWT setup ─────────────────────────────────────────────────────────

function setupJwt(): void {
  const secretPath = getJwtSecretPath();
  if (existsSync(secretPath)) {
    jwtSecret = readFileSync(secretPath, "utf-8").trim();
  } else {
    jwtSecret = generateJwtSecret();
    mkdirSync(getUserDataPath(), { recursive: true });
    writeFileSync(secretPath, jwtSecret, "utf-8");
  }
  anonKey = generateAnonKey(jwtSecret);
  serviceRoleKey = generateServiceRoleKey(jwtSecret);
}

// ── IPC handlers ──────────────────────────────────────────────────────

function setupIpc(): void {
  ipcMain.on("get-version", (event) => {
    event.returnValue = getAppVersion();
  });
  ipcMain.on("get-supabase-url", (event) => {
    event.returnValue = `http://127.0.0.1:${ports.gateway}`;
  });
  ipcMain.on("get-supabase-anon-key", (event) => {
    event.returnValue = anonKey;
  });
  ipcMain.on("resize-window", (_event, width: number, height: number) => {
    const w = getMainWindow();
    if (!w) return;
    w.setSize(Math.round(width), Math.round(height));
    w.center();
  });
}

// ── Startup sequence ──────────────────────────────────────────────────

async function startup(): Promise<void> {
  const isFirstRun = !existsSync(getSentinelPath());

  console.log(`[electron] UnstableLabs v${getAppVersion()} starting...`);
  console.log(`[electron] Data dir: ${getUserDataPath()}`);
  console.log(`[electron] First run: ${isFirstRun}`);

  // 1. Allocate ports
  ports = await allocatePorts();
  console.log("[electron] Ports:", ports);

  // 2. Setup JWT
  setupJwt();
  console.log("[electron] JWT secret ready");

  // 3. Setup IPC handlers
  setupIpc();

  // 4. Start PostgreSQL
  const binDir = getBinDir();
  const dataDir = getDataDir();
  await startPostgres(binDir, dataDir, ports.postgres, isFirstRun);
  console.log(`[electron] PostgreSQL running on port ${ports.postgres}`);

  // 4b. Create database on first run (must happen before GoTrue connects)
  if (isFirstRun) {
    await createDatabase(ports.postgres);
    console.log('[electron] Database "unlabs" created');

    // 4c. Create auth schema + roles (GoTrue expects the schema to exist)
    const migrationsDir = getMigrationsDir();
    await runMigrations(ports.postgres, migrationsDir, false); // schemas + roles only
    console.log("[electron] Schemas and roles created");
  }

  // 5. Start GoTrue (runs its own migrations to populate auth.users etc.)
  await startGoTrue(binDir, ports.gotrue, ports.postgres, jwtSecret);
  console.log(`[electron] GoTrue running on port ${ports.gotrue}`);

  // 6. Run app migrations on first run (auth.users now exists)
  if (isFirstRun) {
    const migrationsDir = getMigrationsDir();
    await runMigrations(ports.postgres, migrationsDir, true); // SQL files
    writeFileSync(getSentinelPath(), new Date().toISOString(), "utf-8");
    console.log("[electron] Migrations complete");
  }

  // 7. Start PostgREST
  await startPostgREST(binDir, getUserDataPath(), ports.postgrest, ports.postgres, jwtSecret);
  console.log(`[electron] PostgREST running on port ${ports.postgrest}`);

  // 8. Start API Gateway
  await startGateway(ports.gateway, ports.gotrue, ports.postgrest);
  console.log(`[electron] Gateway running on port ${ports.gateway}`);

  // 9. Set environment for Next.js
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${ports.gateway}`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${ports.next}`;
  process.env.ELECTRON_RUN = "true";

  // 10. Start Next.js
  await startNextServer(ports.next);
  console.log(`[electron] Next.js running on port ${ports.next}`);

  // 11. Always show setup page — it handles both existing and new users
  const win = createMainWindow(ports.next, "/setup");

  console.log("[electron] Ready! (setup mode)");
}

// ── Shutdown ──────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  console.log("[electron] Shutting down...");
  stopNextServer();
  stopGateway();
  stopPostgREST();
  stopGoTrue();
  await stopPostgres(getBinDir(), getDataDir());
  console.log("[electron] Shutdown complete");
}

// ── App lifecycle ─────────────────────────────────────────────────────

app
  .whenReady()
  .then(startup)
  .catch((err) => {
    console.error("[electron] Startup failed:", err);
    app.quit();
  });

app.on("window-all-closed", () => {
  shutdown().finally(() => app.quit());
});

app.on("before-quit", () => {
  shutdown().catch(console.error);
});

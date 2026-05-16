import { app, ipcMain } from "electron";
import { join } from "path";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { createMainWindow, getMainWindow } from "./window";
import { getAppVersion } from "./version";
import { startPostgres, stopPostgres, createDatabase } from "./services/postgres";
import { startGoTrue, stopGoTrue } from "./services/gotrue";
import { ensurePostgrestSchemaReady, startPostgREST, stopPostgREST } from "./services/postgrest";
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

/**
 * The bundled gateway port (54321) is hard-pinned: the Next.js production
 * build inlines `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` from
 * .env.local, and that value is frozen into the server JS bundle —
 * `process.env` overrides at runtime have no effect. If the gateway runs
 * on any other port (because 54321 was taken by Docker-Supabase, the
 * Supabase CLI, or a leftover app instance), Next.js silently hits the
 * wrong stack and you get baffling schema-cache errors against a
 * different database.
 *
 * Fail loudly here instead of falling back to a random port. The remaining
 * services (postgres / gotrue / postgrest / next) can still dynamic-port
 * because they're only addressed internally by the bundled processes.
 */
async function allocatePorts(): Promise<ServicePorts> {
  const { default: getPort } = await import("get-port");

  // Verify 54321 is actually free. getPort would silently allocate
  // something else, which would land us in the broken-by-config trap.
  const { createServer } = await import("net");
  const gatewayPort = 54321;
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      probe.close();
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${gatewayPort} is already in use.\n\n` +
              "UnstableLabs needs this port for its bundled Supabase gateway. " +
              "Likely culprits:\n" +
              "  • Docker-Supabase (run: `supabase stop`)\n" +
              "  • Another UnstableLabs instance still running\n" +
              "  • A standalone Postgres/Kong on this port\n\n" +
              "Free port 54321 and relaunch the app.",
          ),
        );
      } else {
        reject(err);
      }
    });
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(gatewayPort, "127.0.0.1");
  });

  return {
    postgres: await getPort({ port: 54322 }),
    gotrue: await getPort({ port: 9999 }),
    postgrest: await getPort({ port: 3001 }),
    gateway: gatewayPort,
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
  const sentinelExists = existsSync(getSentinelPath());
  // If pgdata is already a valid Postgres cluster but the .initialized
  // sentinel is gone, we're in an orphan-recovery state: a prior install's
  // data is still there, but the app-level "first run done" marker has
  // been wiped (uninstall/reinstall, manual edit, or a crash before
  // sentinel was written). We must NOT re-run first-run setup — initdb
  // refuses to write into a populated dir, and createDatabase/role
  // creation against an existing cluster is mostly idempotent but
  // unnecessary. Treat this as "not first run" so the code path matches.
  const dataDirInitialized = existsSync(join(getDataDir(), "PG_VERSION"));
  const isFirstRun = !sentinelExists && !dataDirInitialized;
  const isOrphanRecovery = !sentinelExists && dataDirInitialized;

  console.log(`[electron] UnstableLabs v${getAppVersion()} starting...`);
  console.log(`[electron] Data dir: ${getUserDataPath()}`);
  console.log(`[electron] First run: ${isFirstRun}`);
  if (isOrphanRecovery) {
    console.log("[electron] Orphan recovery: existing pgdata, missing sentinel");
  }

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

  // 4b. Create database on first run OR orphan recovery (idempotent — the
  // helper swallows "database already exists"). Roles + auth schema are
  // also re-applied here through executeIgnoringErrors-wrapped statements,
  // so re-running them on an already-initialized cluster is safe.
  if (isFirstRun || isOrphanRecovery) {
    await createDatabase(ports.postgres);
    console.log('[electron] Database "unlabs" ready');

    const migrationsDir = getMigrationsDir();
    await runMigrations(ports.postgres, migrationsDir, false); // schemas + roles only
    console.log("[electron] Schemas and roles ready");
  }

  // 5. Start GoTrue (runs its own migrations to populate auth.users etc.)
  await startGoTrue(binDir, ports.gotrue, ports.postgres, jwtSecret);
  console.log(`[electron] GoTrue running on port ${ports.gotrue}`);

  // 6. Run app migrations on every launch. The migrator tracks which files
  // have already been applied via `public._unlabs_migrations`, so this is
  // safe to call repeatedly. New migrations bundled with each build are
  // picked up automatically — no more "first run only" gap that left old
  // installs missing newly-added columns.
  {
    const migrationsDir = getMigrationsDir();
    const sentinelPath = getSentinelPath();
    await runMigrations(ports.postgres, migrationsDir, true, sentinelPath, isOrphanRecovery);
    // Write the sentinel after first run AND after orphan recovery — both
    // states are now considered "initialized" so the next launch takes the
    // fast non-first-run path.
    if (isFirstRun || isOrphanRecovery) {
      writeFileSync(sentinelPath, new Date().toISOString(), "utf-8");
    }
    console.log("[electron] Migrations complete");
  }

  // 7. Start PostgREST
  await startPostgREST(binDir, getUserDataPath(), ports.postgrest, ports.postgres, jwtSecret);
  console.log(`[electron] PostgREST running on port ${ports.postgrest}`);
  // Block until PostgREST resolves the canary column (profiles.tutorial_state).
  // A single fire-and-forget NOTIFY isn't enough to win the race against
  // the initial-introspect — the renderer can launch a query before the
  // reload lands. Probe + retry NOTIFY until verified.
  await ensurePostgrestSchemaReady(ports.postgres, ports.postgrest);

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
  .catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[electron] Startup failed:", message);
    // Surface the failure to the user — `app.quit()` alone leaves them
    // staring at a dock icon that quietly disappears. The dialog
    // includes the full message so the port-in-use guidance from
    // allocatePorts() is visible.
    try {
      const { dialog } = await import("electron");
      await dialog.showMessageBox({
        type: "error",
        title: "UnstableLabs could not start",
        message: "Startup failed",
        detail: message,
        buttons: ["Quit"],
      });
    } catch {
      // dialog unavailable (headless? early-fail before app.ready?) —
      // we already logged to console, nothing more to do.
    }
    app.quit();
  });

app.on("window-all-closed", () => {
  shutdown().finally(() => app.quit());
});

app.on("before-quit", () => {
  shutdown().catch(console.error);
});

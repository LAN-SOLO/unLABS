import { app, ipcMain, screen, type IpcMainEvent } from "electron";
import { join } from "path";
import { existsSync, writeFileSync } from "fs";
import { createMainWindow, getMainWindow } from "./window";
import { getAppVersion } from "./version";
import {
  startPostgres,
  stopPostgres,
  createDatabase,
  hardenPostgresAuth,
} from "./services/postgres";
import { startGoTrue, stopGoTrue } from "./services/gotrue";
import { ensurePostgrestSchemaReady, startPostgREST, stopPostgREST } from "./services/postgrest";
import { startGateway, stopGateway } from "./services/gateway";
import { startNextServer, stopNextServer } from "./services/nextServer";
import { runMigrations } from "./services/migrator";
import { generateAnonKey, generateServiceRoleKey } from "./config/jwt";
import { loadOrCreateSecret } from "./config/secrets";
import { gpuSwitches } from "./gpu-switches";

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
let dbPassword: string;
let operatorSecret: string;

// GPU: the fast GPU and hardware WebGL2 for the game (before app "ready").
for (const [name, value] of gpuSwitches(process.platform, process.env)) {
  if (value === undefined) app.commandLine.appendSwitch(name);
  else app.commandLine.appendSwitch(name, value);
}

// Test hook: run against a throw-away profile (e.g. smoke tests) without
// touching the player's real data.
if (process.env.UNLABS_USER_DATA_DIR) {
  app.setPath("userData", process.env.UNLABS_USER_DATA_DIR);
}

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

function setupSecrets(): void {
  jwtSecret = loadOrCreateSecret(getJwtSecretPath());
  dbPassword = loadOrCreateSecret(join(getUserDataPath(), "db-secret"));
  operatorSecret = loadOrCreateSecret(join(getUserDataPath(), "operator-secret"));
  anonKey = generateAnonKey(jwtSecret);
  serviceRoleKey = generateServiceRoleKey(jwtSecret);
}

// ── IPC handlers ──────────────────────────────────────────────────────

/** IPC is only answered for the main window's top frame showing the game server. */
function fromGame(event: IpcMainEvent): boolean {
  const w = getMainWindow();
  const frame = event.senderFrame;
  if (!w || event.sender !== w.webContents || !frame || frame.parent !== null) return false;
  try {
    return new URL(frame.url).origin === `http://127.0.0.1:${ports.next}`;
  } catch {
    return false;
  }
}

function setupIpc(): void {
  ipcMain.on("get-version", (event) => {
    event.returnValue = fromGame(event) ? getAppVersion() : null;
  });
  ipcMain.on("get-supabase-url", (event) => {
    event.returnValue = fromGame(event) ? `http://127.0.0.1:${ports.gateway}` : null;
  });
  ipcMain.on("get-supabase-anon-key", (event) => {
    event.returnValue = fromGame(event) ? anonKey : null;
  });
  ipcMain.on("resize-window", (event, width: unknown, height: unknown) => {
    const w = getMainWindow();
    if (!w || !fromGame(event)) return;
    if (typeof width !== "number" || typeof height !== "number") return;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    const area = screen.getDisplayMatching(w.getBounds()).workAreaSize;
    const clamp = (v: number, min: number, max: number) =>
      Math.round(Math.min(Math.max(v, min), Math.max(min, max)));
    w.setSize(clamp(width, 1024, area.width), clamp(height, 720, area.height));
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

  // 2. Per-install secrets (JWT, database password, operator logins)
  setupSecrets();
  console.log("[electron] Secrets ready");

  // 3. Setup IPC handlers
  setupIpc();

  // 4. Start PostgreSQL
  const binDir = getBinDir();
  const dataDir = getDataDir();
  await startPostgres(binDir, dataDir, ports.postgres, isFirstRun, dbPassword);
  console.log(`[electron] PostgreSQL running on port ${ports.postgres}`);

  // 4b. Create database on first run OR orphan recovery (idempotent — the
  // helper swallows "database already exists"). Roles + auth schema are
  // also re-applied here through executeIgnoringErrors-wrapped statements,
  // so re-running them on an already-initialized cluster is safe.
  if (isFirstRun || isOrphanRecovery) {
    await createDatabase(ports.postgres, dbPassword);
    console.log('[electron] Database "unlabs" ready');

    const migrationsDir = getMigrationsDir();
    await runMigrations(ports.postgres, dbPassword, migrationsDir, false); // schemas + roles only
    console.log("[electron] Schemas and roles ready");
  }

  // 4c. Password auth only — also migrates clusters created with --auth=trust.
  await hardenPostgresAuth(ports.postgres, dataDir, dbPassword);
  console.log("[electron] PostgreSQL auth hardened");

  // 5. Start GoTrue (runs its own migrations to populate auth.users etc.)
  await startGoTrue(
    binDir,
    ports.gotrue,
    ports.postgres,
    jwtSecret,
    dbPassword,
    `http://127.0.0.1:${ports.next}`,
  );
  console.log(`[electron] GoTrue running on port ${ports.gotrue}`);

  // 6. Run app migrations on every launch. The migrator tracks which files
  // have already been applied via `public._unlabs_migrations`, so this is
  // safe to call repeatedly. New migrations bundled with each build are
  // picked up automatically — no more "first run only" gap that left old
  // installs missing newly-added columns.
  {
    const migrationsDir = getMigrationsDir();
    const sentinelPath = getSentinelPath();
    await runMigrations(
      ports.postgres,
      dbPassword,
      migrationsDir,
      true,
      sentinelPath,
      isOrphanRecovery,
    );
    // Write the sentinel after first run AND after orphan recovery — both
    // states are now considered "initialized" so the next launch takes the
    // fast non-first-run path.
    if (isFirstRun || isOrphanRecovery) {
      writeFileSync(sentinelPath, new Date().toISOString(), "utf-8");
    }
    console.log("[electron] Migrations complete");
  }

  // 7. Start PostgREST
  await startPostgREST(
    binDir,
    getUserDataPath(),
    ports.postgrest,
    ports.postgres,
    jwtSecret,
    dbPassword,
  );
  console.log(`[electron] PostgREST running on port ${ports.postgrest}`);
  // Block until PostgREST resolves the canary column (profiles.tutorial_state).
  // A single fire-and-forget NOTIFY isn't enough to win the race against
  // the initial-introspect — the renderer can launch a query before the
  // reload lands. Probe + retry NOTIFY until verified.
  await ensurePostgrestSchemaReady(ports.postgres, dbPassword, ports.postgrest);

  // 8. Start API Gateway
  await startGateway(ports.gateway, ports.gotrue, ports.postgrest, [
    `http://127.0.0.1:${ports.next}`,
  ]);
  console.log(`[electron] Gateway running on port ${ports.gateway}`);

  // 9. Set environment for Next.js
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${ports.gateway}`;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${ports.next}`;
  process.env.ELECTRON_RUN = "true";
  process.env.LOCAL_OPERATOR_SECRET = operatorSecret;

  // 10. Start Next.js
  await startNextServer(ports.next);
  console.log(`[electron] Next.js running on port ${ports.next}`);

  // 11. Always show setup page — it handles both existing and new users
  createMainWindow(ports.next, "/setup");

  console.log("[electron] Ready! (setup mode)");
}

// ── Shutdown ──────────────────────────────────────────────────────────

let shutdownPromise: Promise<void> | null = null;

/** Stops every bundled service exactly once, however many quit events fire. */
function shutdown(): Promise<void> {
  shutdownPromise ??= stopServices();
  return shutdownPromise;
}

async function stopServices(): Promise<void> {
  console.log("[electron] Shutting down...");
  stopNextServer();
  stopGateway();
  stopPostgREST();
  stopGoTrue();
  await stopPostgres(getBinDir(), getDataDir());
  console.log("[electron] Shutdown complete");
}

// ── App lifecycle ─────────────────────────────────────────────────────

// One instance only: a second launch would collide on the pinned gateway
// port and the Postgres data directory — focus the running game instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.on("second-instance", () => {
  const w = getMainWindow();
  if (!w) return;
  if (w.isMinimized()) w.restore();
  w.focus();
});

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

let servicesStopped = false;
app.on("before-quit", (event) => {
  if (servicesStopped) return;
  // Keep the process alive until Postgres has shut down cleanly.
  event.preventDefault();
  shutdown()
    .catch(console.error)
    .finally(() => {
      servicesStopped = true;
      app.quit();
    });
});

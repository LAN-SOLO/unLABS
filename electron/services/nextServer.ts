import { spawn, type ChildProcess } from "child_process";
import { join } from "path";
import { app } from "electron";

let nextProcess: ChildProcess | null = null;

async function waitForReady(port: number, timeoutMs: number = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok || res.status === 307 || res.status === 302 || res.status === 200) return;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Next.js health check timed out after ${timeoutMs}ms`);
}

export async function startNextServer(port: number): Promise<void> {
  // In packaged app, node_modules is inside the asar. We need to use
  // the Node.js binary from Electron and require next/dist/bin/next-start
  const appDir = app.isPackaged ? join(app.getAppPath()) : join(__dirname, "..");

  // Use process.execPath (the Electron/Node binary) to run next start
  const nextBin = join(appDir, "node_modules", "next", "dist", "bin", "next");

  nextProcess = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      ELECTRON_RUN_AS_NODE: "1", // Makes Electron act as plain Node.js
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  nextProcess.on("error", (err) => {
    console.error("[next] Process error:", err);
  });

  nextProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error("[next]", msg);
  });

  await waitForReady(port);
}

export function stopNextServer(): void {
  if (nextProcess) {
    nextProcess.kill("SIGTERM");
    nextProcess = null;
  }
}

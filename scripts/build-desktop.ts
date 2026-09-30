/**
 * Full desktop build pipeline.
 *
 * Usage: npx ts-node scripts/build-desktop.ts [--mac] [--win] [--all]
 *
 * Steps:
 * 0. Verify the bundled migrations carry all game content of the local
 *    Supabase Docker DB (scripts/check-desktop-db.sh; skipped without Docker)
 * 1. Download platform binaries
 * 2. Build Next.js production bundle
 * 3. Compile Electron TypeScript
 * 4. Run electron-builder
 */

import { execSync } from "child_process";
import { join } from "path";

const ROOT = join(__dirname, "..");

function run(cmd: string, label: string, env: NodeJS.ProcessEnv = {}): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(60)}\n`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const buildMac = args.includes("--mac") || args.includes("--all");
  const buildWin = args.includes("--win") || args.includes("--all");

  if (!buildMac && !buildWin) {
    console.log("Usage: npx ts-node scripts/build-desktop.ts [--mac] [--win] [--all]");
    console.log("  --mac   Build macOS DMG");
    console.log("  --win   Build Windows installer");
    console.log("  --all   Build both");
    process.exit(1);
  }

  // 0. Every content table in Docker must be reproduced by the bundled migrations
  run("bash scripts/check-desktop-db.sh", "Step 0: Verify database content is bundled");

  // 1. Download binaries
  if (buildMac)
    run(
      "npx ts-node scripts/download-binaries.ts --platform=darwin-arm64",
      "Step 1a: Binaries (macOS)",
    );
  if (buildWin)
    run(
      "npx ts-node scripts/download-binaries.ts --platform=win32-x64",
      "Step 1b: Binaries (Windows)",
    );

  // 2. Build Next.js
  // UNLABS_DESKTOP_BUILD lets the CSP allow the bundled gateway (next.config.mjs).
  run("pnpm build", "Step 2: Build Next.js production bundle", { UNLABS_DESKTOP_BUILD: "1" });

  // 3. Compile Electron TypeScript
  run("npx tsc -p electron/tsconfig.json", "Step 3: Compile Electron main process");

  // 4. Run electron-builder
  const targets: string[] = [];
  if (buildMac) targets.push("--mac");
  if (buildWin) targets.push("--win");

  run(
    `npx electron-builder ${targets.join(" ")} --config electron-builder.config.ts`,
    `Step 4: Package (${targets.join(", ")})`,
  );

  console.log("\n\nBuild complete! Check the .INSTALL/ directory.");
}

main().catch((err) => {
  console.error("\nBuild failed:", err);
  process.exit(1);
});

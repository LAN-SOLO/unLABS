/**
 * Full desktop build pipeline.
 *
 * Usage: npx ts-node scripts/build-desktop.ts [--mac] [--win] [--all]
 *
 * Steps:
 * 1. Download platform binaries
 * 2. Build Next.js production bundle
 * 3. Compile Electron TypeScript
 * 4. Run electron-builder
 */

import { execSync } from "child_process";
import { join } from "path";

const ROOT = join(__dirname, "..");

function run(cmd: string, label: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(60)}\n`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
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

  // 1. Download binaries
  run("npx ts-node scripts/download-binaries.ts", "Step 1: Download platform binaries");

  // 2. Build Next.js
  run("pnpm build", "Step 2: Build Next.js production bundle");

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

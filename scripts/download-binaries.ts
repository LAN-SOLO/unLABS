/**
 * Download platform-specific binaries for PostgreSQL, PostgREST, and GoTrue.
 *
 * Usage: npx ts-node scripts/download-binaries.ts [--platform darwin-arm64|darwin-x64|win32-x64]
 *
 * Downloads are placed in bin/{platform}/.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, chmodSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

// ── Versions ──────────────────────────────────────────────────────────

const POSTGRES_VERSION = "17.2.0";
const POSTGREST_VERSION = "12.2.8";
const GOTRUE_VERSION = "2.188.1"; // Supabase Auth

// ── Platform detection ────────────────────────────────────────────────

type Platform = "darwin-arm64" | "darwin-x64" | "win32-x64";

function detectPlatform(): Platform {
  const arg = process.argv.find((a) => a.startsWith("--platform="));
  if (arg) return arg.split("=")[1] as Platform;

  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "win32" && arch === "x64") return "win32-x64";

  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

// ── Download helpers ──────────────────────────────────────────────────

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function download(url: string, dest: string): void {
  console.log(`  Downloading: ${url}`);
  execSync(`curl -fSL -o "${dest}" "${url}"`, { stdio: "inherit" });
}

function extract(archive: string, dest: string): void {
  if (archive.endsWith(".tar.gz") || archive.endsWith(".tgz")) {
    execSync(`tar -xzf "${archive}" -C "${dest}"`, { stdio: "inherit" });
  } else if (archive.endsWith(".zip")) {
    execSync(`unzip -o -q "${archive}" -d "${dest}"`, { stdio: "inherit" });
  }
}

// ── PostgreSQL ────────────────────────────────────────────────────────

function downloadPostgres(platform: Platform, binDir: string): void {
  const pgDir = join(binDir, "postgres");
  if (existsSync(join(pgDir, "bin"))) {
    console.log("  PostgreSQL already downloaded, skipping");
    return;
  }

  ensureDir(pgDir);
  const tmpDir = join(binDir, "_pg_tmp");
  ensureDir(tmpDir);

  // Use embedded-postgres-binaries from zonky.io
  const os = platform.startsWith("darwin") ? "darwin" : "windows";
  const mavenArch = platform.includes("arm64") ? "arm64v8" : "amd64";
  // Inner archive uses different naming: arm_64 not arm64v8, x86_64 not amd64
  const innerArch = platform.includes("arm64") ? "arm_64" : "x86_64";

  const url = `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-${os}-${mavenArch}/${POSTGRES_VERSION}/embedded-postgres-binaries-${os}-${mavenArch}-${POSTGRES_VERSION}.jar`;

  const jarPath = join(tmpDir, "pg.jar");
  download(url, jarPath);

  // JAR is a zip containing postgres-{os}-{innerArch}.txz
  execSync(`unzip -o -q "${jarPath}" -d "${tmpDir}"`, { stdio: "inherit" });

  // Find the txz inside (naming: postgres-darwin-arm_64.txz)
  const innerName = `postgres-${os}-${innerArch}.txz`;
  const innerArchive = join(tmpDir, innerName);
  if (existsSync(innerArchive)) {
    execSync(`tar -xf "${innerArchive}" -C "${pgDir}"`, { stdio: "inherit" });
  } else {
    // Fallback: try to find any txz/zip in the extracted dir
    const files = readdirSync(tmpDir).filter(
      (f: string) => f.endsWith(".txz") || f.endsWith(".zip"),
    );
    if (files.length > 0) {
      const fallback = join(tmpDir, files[0]);
      if (files[0].endsWith(".txz")) {
        execSync(`tar -xf "${fallback}" -C "${pgDir}"`, { stdio: "inherit" });
      } else {
        extract(fallback, pgDir);
      }
    }
  }

  // Cleanup
  execSync(`rm -rf "${tmpDir}"`, { stdio: "pipe" });

  // Make binaries executable
  if (os !== "windows") {
    const pgBinDir = join(pgDir, "bin");
    if (existsSync(pgBinDir)) {
      for (const bin of ["postgres", "pg_ctl", "initdb", "createdb", "psql"]) {
        const binPath = join(pgBinDir, bin);
        if (existsSync(binPath)) chmodSync(binPath, 0o755);
      }
    }
  }

  console.log("  PostgreSQL downloaded");
}

// ── PostgREST ─────────────────────────────────────────────────────────

function downloadPostgREST(platform: Platform, binDir: string): void {
  const ext = platform.startsWith("win") ? ".exe" : "";
  const binPath = join(binDir, `postgrest${ext}`);
  if (existsSync(binPath)) {
    console.log("  PostgREST already downloaded, skipping");
    return;
  }

  let os: string;
  let arch: string;
  let fileExt: string;

  if (platform === "darwin-arm64") {
    os = "macos";
    arch = "aarch64";
    fileExt = "tar.xz";
  } else if (platform === "darwin-x64") {
    os = "macos";
    arch = "x86-64";
    fileExt = "tar.xz";
  } else {
    os = "windows";
    arch = "x86-64";
    fileExt = "zip";
  }

  const url = `https://github.com/PostgREST/postgrest/releases/download/v${POSTGREST_VERSION}/postgrest-v${POSTGREST_VERSION}-${os}-${arch}.${fileExt}`;
  const tmpDir = join(binDir, "_pr_tmp");
  ensureDir(tmpDir);

  const archivePath = join(tmpDir, `postgrest.${fileExt}`);
  download(url, archivePath);

  if (fileExt === "tar.xz") {
    execSync(`tar -xf "${archivePath}" -C "${tmpDir}"`, { stdio: "inherit" });
  } else {
    extract(archivePath, tmpDir);
  }

  // Move binary
  const srcBin = join(tmpDir, `postgrest${ext}`);
  if (existsSync(srcBin)) {
    execSync(`mv "${srcBin}" "${binPath}"`, { stdio: "pipe" });
    if (!platform.startsWith("win")) chmodSync(binPath, 0o755);
  }

  execSync(`rm -rf "${tmpDir}"`, { stdio: "pipe" });
  console.log("  PostgREST downloaded");
}

// ── GoTrue (Supabase Auth) ────────────────────────────────────────────

function downloadGoTrue(platform: Platform, binDir: string): void {
  const ext = platform.startsWith("win") ? ".exe" : "";
  const binPath = join(binDir, `gotrue${ext}`);
  if (existsSync(binPath)) {
    console.log("  GoTrue already downloaded, skipping");
    return;
  }

  let os: string;
  let arch: string;

  if (platform === "darwin-arm64") {
    os = "darwin";
    arch = "arm64";
  } else if (platform === "darwin-x64") {
    os = "darwin";
    arch = "amd64";
  } else {
    os = "windows";
    arch = "amd64";
  }

  const fileExt = platform.startsWith("win") ? "tar.gz" : "tar.gz";
  const url = `https://github.com/supabase/auth/releases/download/v${GOTRUE_VERSION}/auth-v${GOTRUE_VERSION}-${os}-${arch}.tar.gz`;

  const tmpDir = join(binDir, "_gt_tmp");
  ensureDir(tmpDir);

  const archivePath = join(tmpDir, "gotrue.tar.gz");
  download(url, archivePath);
  execSync(`tar -xzf "${archivePath}" -C "${tmpDir}"`, { stdio: "inherit" });

  // The binary may be named 'auth' or 'gotrue'
  for (const name of [`auth${ext}`, `gotrue${ext}`]) {
    const srcBin = join(tmpDir, name);
    if (existsSync(srcBin)) {
      execSync(`mv "${srcBin}" "${binPath}"`, { stdio: "pipe" });
      if (!platform.startsWith("win")) chmodSync(binPath, 0o755);
      break;
    }
  }

  execSync(`rm -rf "${tmpDir}"`, { stdio: "pipe" });
  console.log("  GoTrue downloaded");
}

// ── Main ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const platform = detectPlatform();
  const binDir = join(ROOT, "bin", platform);
  ensureDir(binDir);

  console.log(`\nDownloading binaries for ${platform}...\n`);

  console.log("[PostgreSQL]");
  downloadPostgres(platform, binDir);

  console.log("[PostgREST]");
  downloadPostgREST(platform, binDir);

  console.log("[GoTrue/Auth]");
  downloadGoTrue(platform, binDir);

  console.log("\nAll binaries downloaded to:", binDir);
}

main().catch((err) => {
  console.error("Download failed:", err);
  process.exit(1);
});

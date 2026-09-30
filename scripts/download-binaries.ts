/**
 * Download platform-specific binaries for PostgreSQL, PostgREST, and GoTrue.
 *
 * Usage: npx ts-node scripts/download-binaries.ts [--platform darwin-arm64|darwin-x64|win32-x64]
 *
 * Downloads are placed in bin/{platform}/.
 */

import { execFileSync, execSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, chmodSync, readdirSync, readFileSync } from "fs";
import { basename, join } from "path";

const ROOT = join(__dirname, "..");

// ── Versions ──────────────────────────────────────────────────────────

const POSTGRES_VERSION = "17.2.0";
const POSTGREST_VERSION = "12.2.8";
const GOTRUE_VERSION = "2.188.1"; // Supabase Auth

// ── Pinned checksums ──────────────────────────────────────────────────
//
// SHA-256 of every archive we ship, verified before extraction. The
// Postgres JARs were cross-checked against Maven Central's .sha1 files
// (2026-09-30). A mismatch aborts the build: a tampered mirror, a TLS
// interceptor or a re-tagged release must never reach players.

const SHA256: Record<string, string> = {
  [`embedded-postgres-binaries-darwin-arm64v8-${POSTGRES_VERSION}.jar`]:
    "9b96314f5c352c71e238a22c0d5fe48e7fecd83fb27e3765f848d6afd5f4318d",
  [`embedded-postgres-binaries-darwin-amd64-${POSTGRES_VERSION}.jar`]:
    "8064415ff98fd1bed7a585cfeff3b1895ecbaa470d6e17389644dadcdd399907",
  [`embedded-postgres-binaries-windows-amd64-${POSTGRES_VERSION}.jar`]:
    "41a2c287c4ca14691e9af4e6bdd719aca231983fcac8a43d01c99e1bca613859",
  [`postgrest-v${POSTGREST_VERSION}-macos-aarch64.tar.xz`]:
    "249515871678560c615be6ee7c64c54cfe944b4916141ce71445b92b289aedaf",
  [`postgrest-v${POSTGREST_VERSION}-windows-x86-64.zip`]:
    "077349a572279a4cf99ff306032f665ccba018e78cc4386d13237960094d7b8d",
  [`auth-v${GOTRUE_VERSION}-darwin-arm64.tar.gz`]:
    "aeadc0226ceab5f5d525311887667521047589dc7d1a407488c7ae08fa060892",
};

// ── Platform detection ────────────────────────────────────────────────

type Platform = "darwin-arm64" | "darwin-x64" | "win32-x64";
const PLATFORMS: readonly Platform[] = ["darwin-arm64", "darwin-x64", "win32-x64"];

function detectPlatform(): Platform {
  const arg = process.argv.find((a) => a.startsWith("--platform="));
  if (arg) {
    const value = arg.split("=")[1];
    const match = PLATFORMS.find((p) => p === value);
    if (!match) throw new Error(`Unknown --platform=${value} (use ${PLATFORMS.join(", ")})`);
    return match;
  }

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

/** HTTPS-only download (also for redirects), verified against SHA256 before use. */
function download(url: string, dest: string): void {
  console.log(`  Downloading: ${url}`);
  execFileSync(
    "curl",
    ["--proto", "=https", "--proto-redir", "=https", "--tlsv1.2", "-fSL", "-o", dest, url],
    {
      stdio: "inherit",
    },
  );
  const name = basename(new URL(url).pathname);
  const expected = SHA256[name];
  if (!expected)
    throw new Error(`No pinned SHA-256 for ${name} — add it after verifying the release.`);
  const actual = createHash("sha256").update(readFileSync(dest)).digest("hex");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${name}\n  expected ${expected}\n  got      ${actual}`);
  }
  console.log(`  SHA-256 ok (${name})`);
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
  } else {
    // supabase/auth publishes no Windows or Intel-Mac release binaries
    // (only linux x86/arm64 and darwin-arm64). Build it from the tagged
    // source with Go and place it here:
    //   git clone --depth 1 -b v<GOTRUE_VERSION> https://github.com/supabase/auth
    //   cd auth && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o gotrue.exe .
    throw new Error(
      `No official GoTrue v${GOTRUE_VERSION} binary for ${platform}. ` +
        `Build it from source (see scripts/download-binaries.ts) into ${binPath}.`,
    );
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

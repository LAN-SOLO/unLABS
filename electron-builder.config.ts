import type { Configuration } from "electron-builder";

const config: Configuration = {
  appId: "com.unstablelabs.game",
  productName: "UnstableLabs",
  // Main entry point for Electron (kept here instead of package.json
  // because the "main" field in package.json conflicts with Turbopack)
  extends: null,
  extraMetadata: {
    main: "dist-electron/main.js",
  },
  npmRebuild: false,
  asar: false,
  directories: {
    output: ".INSTALL",
  },
  files: [
    "dist-electron/**/*",
    "electron/auth/init-auth-schema.sql",
    ".next/**/*",
    "!.next/dev/**",
    "!.next/cache/**",
    "public/**/*",
    "node_modules/**/*",
    "!node_modules/.cache/**",
    "supabase/migrations/**/*.sql",
    "package.json",
    "next.config.mjs",
  ],
  extraResources: [
    {
      from: "supabase/migrations",
      to: "migrations",
      filter: ["*.sql"],
    },
  ],
  afterPack: async (context) => {
    // Copy next's nested node_modules that electron-builder skips.
    // The packaged resources dir is platform-specific: mac nests it
    // inside the .app bundle; win/linux put it directly in appOutDir.
    // The old mac-only path silently produced Windows builds without
    // next's node_modules (broken since 0.1.2-alpha).
    const fs = await import("fs");
    const path = await import("path");
    const resourcesApp =
      context.electronPlatformName === "darwin"
        ? path.join(
            context.appOutDir,
            context.packager.appInfo.productFilename + ".app",
            "Contents",
            "Resources",
            "app",
          )
        : path.join(context.appOutDir, "resources", "app");
    const nextNested = path.join(
      context.packager.projectDir,
      "node_modules",
      "next",
      "node_modules",
    );
    const destNested = path.join(resourcesApp, "node_modules", "next", "node_modules");
    if (fs.existsSync(nextNested)) {
      fs.cpSync(nextNested, destNested, { recursive: true, force: true });
    }
  },
  mac: {
    target: [
      {
        target: "dmg",
        arch: ["arm64"],
      },
    ],
    icon: "public/icon.icns",
    category: "public.app-category.games",
    artifactName: "UnstableLabs-${version}.dmg",
    extraResources: [{ from: "bin/darwin-arm64", to: "bin", filter: ["**/*"] }],
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
    backgroundColor: "#141618",
    title: "UnstableLabs ${version}",
  },
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
    icon: "public/icon.ico",
    artifactName: "UnstableLabs-Setup-${version}.exe",
    extraResources: [{ from: "bin/win32-x64", to: "bin", filter: ["**/*"] }],
  },
  linux: {
    // Flatpak is the primary Linux package (sandboxed, distro-independent,
    // Flathub-ready); the AppImage is a no-install fallback for testers.
    target: [
      { target: "flatpak", arch: ["x64"] },
      { target: "AppImage", arch: ["x64"] },
    ],
    icon: "public/icon-1024.png",
    category: "Game",
    executableName: "unstablelabs",
    artifactName: "UnstableLabs-${version}-${arch}.${ext}",
    synopsis: "A lab that sharpens from pixels to crystal clear",
    description:
      "UnstableLabs — an isometric lab game: wake up in a pixel world and invent it clear.",
    extraResources: [{ from: "bin/linux-x64", to: "bin", filter: ["**/*"] }],
  },
  flatpak: {
    // electron-builder's defaults (20.08) are end-of-life; 24.08 is the
    // current freedesktop runtime and Electron BaseApp branch.
    runtime: "org.freedesktop.Platform",
    runtimeVersion: "24.08",
    sdk: "org.freedesktop.Sdk",
    base: "org.electronjs.Electron2.BaseApp",
    baseVersion: "24.08",
    branch: "stable",
    useWaylandFlags: false,
    finishArgs: [
      // Window: Wayland first, X11 only where no Wayland session exists.
      "--socket=wayland",
      "--socket=fallback-x11",
      "--share=ipc",
      // GPU (WebGL2 via Mesa / vendor drivers).
      "--device=dri",
      // Game audio (Web Audio).
      "--socket=pulseaudio",
      // The game is a local stack: Next, Postgres, PostgREST and GoTrue talk
      // over 127.0.0.1. Flatpak has no loopback-only permission, so the
      // network share is required; the gateway/Next still accept loopback
      // hosts only (lib/auth/loopback.ts, docs/AUDIT.md).
      "--share=network",
      // No home-directory access: saves and the database live in the
      // sandbox's own ~/.var/app/<id>/ data dir (Electron userData).
      "--talk-name=org.freedesktop.Notifications",
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "UnstableLabs",
    installerIcon: "public/icon.ico",
    uninstallerIcon: "public/icon.ico",
    // Per-user install (no admin prompt); the game's data (pgdata, secrets)
    // lives in %APPDATA%\UnstableLabs and survives updates/uninstall.
    perMachine: false,
    deleteAppDataOnUninstall: false,
    license: undefined,
  },
};

export default config;

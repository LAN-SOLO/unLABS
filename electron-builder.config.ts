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
    // Copy next's nested node_modules that electron-builder skips
    const fs = await import("fs");
    const path = await import("path");
    const src = path.join(
      context.appOutDir,
      context.packager.appInfo.productFilename + ".app",
      "Contents",
      "Resources",
      "app",
    );
    const nextNested = path.join(
      context.packager.projectDir,
      "node_modules",
      "next",
      "node_modules",
    );
    const destNested = path.join(src, "node_modules", "next", "node_modules");
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
    // icon: 'public/icon.icns', // TODO: add custom icon
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
    // icon: 'public/icon.ico', // TODO: add custom icon
    artifactName: "UnstableLabs-Setup-${version}.exe",
    extraResources: [{ from: "bin/win32-x64", to: "bin", filter: ["**/*"] }],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "UnstableLabs",
    // installerIcon: 'public/icon.ico', // TODO: add custom icon
    // uninstallerIcon: 'public/icon.ico',
    license: undefined,
  },
};

export default config;

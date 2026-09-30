/**
 * One game version everywhere: package.json → NEXT_PUBLIC_APP_VERSION →
 * lib/version.ts (web, desktop, title/pause menu, terminal `about`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("game version", () => {
  it("package.json carries a semver (beta) version", () => {
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-beta(\.\d+)?)?$/);
  });

  it("next.config injects package.json's version", () => {
    expect(read("next.config.mjs")).toMatch(/NEXT_PUBLIC_APP_VERSION:\s*pkg\.version/);
  });

  it("no screen hard-codes a version or reads the env var directly", () => {
    for (const f of [
      "lib/terminal/commands.ts",
      "app/page-client.tsx",
      "app/setup/page.tsx",
      "app/(game)/terminal/terminal-frame.tsx",
      "components/world/menu/TitleScreen.tsx",
      "components/world/menu/PauseMenu.tsx",
    ]) {
      const src = read(f);
      expect(src, f).not.toMatch(/VERSION:\s*\d+\.\d+\.\d+/);
      expect(src, f).not.toContain("process.env.NEXT_PUBLIC_APP_VERSION");
    }
  });

  it("falls back to a dev label without the build-time variable", async () => {
    const { APP_VERSION, VERSION_LABEL } = await import("@/lib/version");
    expect(VERSION_LABEL).toBe(`v${APP_VERSION}`);
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});

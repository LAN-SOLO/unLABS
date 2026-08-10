import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Logged-in browser state produced by the `setup` project
// (e2e/fixtures/auth.ts). Gitignored — never check it in.
const STORAGE_STATE = path.join(__dirname, "e2e", ".auth", "user.json");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html"], ["github"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Provisions a fresh test user (Supabase admin API) + UI login, then
    // saves storageState for the authed project.
    {
      name: "setup",
      testMatch: /fixtures[\\/]auth\.ts/,
      timeout: 180_000,
      use: { ...devices["Desktop Chrome"] },
    },
    // Unauthenticated suites (routes/smoke) — unchanged behavior.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /authed\.spec\.ts/,
    },
    // Authenticated flows — inherit the logged-in storage state.
    {
      name: "chromium-authed",
      testMatch: /authed\.spec\.ts/,
      dependencies: ["setup"],
      timeout: 90_000,
      expect: { timeout: 15_000 },
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});

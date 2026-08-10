/**
 * Authenticated flows (first authed E2E suite, 0.1.30)
 * ====================================================
 *
 * Runs in the `chromium-authed` project: the `setup` project
 * (e2e/fixtures/auth.ts) provisions a FRESH user per run (timestamped
 * email) and stores a logged-in storageState, so every run starts with:
 *   - tutorial difficulty unchosen  → DifficultyPicker on first /terminal
 *   - quest spine at EP0 "ep0.wake" → `dmesg` command trigger pending
 *   - balance exactly 120 _unSC     → cold-start bonus
 *
 * Tests share that per-run user and run sequentially in one worker (no
 * fullyParallel), but each is written to work standalone: a helper picks
 * the difficulty if the picker is still up, and the picker-specific test
 * skips itself with a reason when another test already answered it.
 *
 * No hard sleeps — everything polls via expect/waitFor. The in-game BIOS
 * boot animation is skipped by pre-seeding the same sessionStorage flag
 * the app itself sets after the first boot (`unlabs_booted`), which keeps
 * runs fast without touching app code.
 */

import { test, expect, type Page } from "@playwright/test";

/** The (game) shell renders one terminal input: components/terminal/TerminalInput.tsx */
const terminalInput = (page: Page) => page.locator("[data-terminal-input]");
/** Quest narrative panel: components/quest/QuestOverlay.tsx */
const questOverlay = (page: Page) => page.locator("[data-quest-overlay]");
/** First-launch difficulty modal: components/onboarding/DifficultyPicker.tsx */
const difficultyPicker = (page: Page) =>
  page.getByRole("dialog", { name: "Choose guidance level" });
/** Easy-mode walkthrough card: components/onboarding/TutorialOverlay.tsx */
const tutorialCard = (page: Page) => page.getByRole("dialog", { name: "Tutorial step" });

/** Open /terminal with the BIOS boot pre-acknowledged; dismiss welcome-back if shown. */
async function gotoTerminal(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("unlabs_booted", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto("/terminal", { timeout: 120_000 });
  // Confirm we were not bounced to /login (storage state must be valid).
  await expect(page).toHaveURL(/\/terminal/, { timeout: 30_000 });
  // WelcomeBackModal (offline catch-up) can appear on revisits; Escape dismisses.
  const welcomeBack = page.locator('aside[aria-label="Welcome back"]');
  if (await welcomeBack.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await expect(welcomeBack).toBeHidden({ timeout: 10_000 });
  }
}

/**
 * If the DifficultyPicker is still gating the screen, choose EASY (guided).
 * Returns true when this call made the choice, false when it was already done.
 */
async function ensureDifficultyChosen(page: Page): Promise<boolean> {
  // Hydration gate: the terminal input renders once the client app is up.
  // The picker mounts from the same SSR-provided tutorial state, so after
  // this point a short grace window is enough to know whether it is due.
  await expect(terminalInput(page)).toBeVisible({ timeout: 60_000 });
  const picker = difficultyPicker(page);
  const appeared = await picker
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return false;
  await picker.getByRole("button").filter({ hasText: "EASY" }).click();
  await expect(picker).toBeHidden({ timeout: 20_000 });
  return true;
}

/** Wait until the terminal accepts input, then run one command. */
async function runCommand(page: Page, command: string): Promise<void> {
  const input = terminalInput(page);
  await expect(input).toBeVisible({ timeout: 60_000 });
  await expect(input).toBeEnabled({ timeout: 60_000 });
  await input.click();
  await input.fill(command);
  await input.press("Enter");
}

test("tutorial first load: DifficultyPicker appears, choosing EASY starts the overlay", async ({
  page,
}) => {
  await gotoTerminal(page);

  const picker = difficultyPicker(page);
  const pickerShown = await picker
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(
    !pickerShown,
    "Difficulty was already chosen for this run's user (another authed test ran first) — picker cannot re-appear.",
  );

  await expect(picker.getByText("Choose Guidance Level")).toBeVisible();
  // Both modes offered.
  await expect(picker.getByRole("button").filter({ hasText: "EASY" })).toBeVisible();
  await expect(picker.getByRole("button").filter({ hasText: "HARD" })).toBeVisible();

  // Choose guided mode → picker closes, overlay step 1 (welcome card) shows.
  await picker.getByRole("button").filter({ hasText: "EASY" }).click();
  await expect(picker).toBeHidden({ timeout: 20_000 });

  const card = tutorialCard(page);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText("Welcome to _unOS")).toBeVisible();
  await expect(card.getByText(/STEP\s+1\s*\//i)).toBeVisible();
});

test("terminal basics: `dmesg` advances the EP0 quest via the cmd:* bridge", async ({ page }) => {
  await gotoTerminal(page);
  await ensureDifficultyChosen(page);

  const overlay = questOverlay(page);
  await expect(overlay).toBeVisible({ timeout: 30_000 });
  // EP0 "ep0.wake" is command-gated: no CONTINUE button, an awaiting hint instead.
  await expect(overlay.getByText("Read the boot log")).toBeVisible({ timeout: 30_000 });
  await expect(overlay.getByText(/awaiting:\s*dmesg/)).toBeVisible();

  await runCommand(page, "dmesg");

  // Terminal bridge sets `cmd:dmesg`, server cascade advances to ep0.survey.
  await expect(overlay.getByText("Survey the wreckage")).toBeVisible({ timeout: 30_000 });
  // The next step is a narrative beat again — CONTINUE returns.
  await expect(overlay.getByRole("button", { name: /CONTINUE/ })).toBeVisible({ timeout: 15_000 });
});

test("balance: `balance` shows the _unSC box with the 120 cold-start bonus", async ({ page }) => {
  await gotoTerminal(page);
  await ensureDifficultyChosen(page);

  await runCommand(page, "balance");

  await expect(page.getByText("_unSC BALANCE").first()).toBeVisible({ timeout: 30_000 });
  // Fresh user per run → exactly the 120 _unSC starter bonus, nothing spent.
  await expect(page.getByText(/AVAILABLE\s*:\s*120\.00\s*_unSC/).first()).toBeVisible();
  await expect(page.getByText(/TOTAL\s*:\s*120\.00\s*_unSC/).first()).toBeVisible();
});

test("daily board: `daily` renders the contract board with a streak line", async ({ page }) => {
  await gotoTerminal(page);
  await ensureDifficultyChosen(page);

  await runCommand(page, "daily");

  await expect(page.getByText("DAILY CONTRACTS").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/STREAK:\s*\d+\s*days?/).first()).toBeVisible();
  // MARKET line only renders when today's volatility modifier is non-zero —
  // assert its shape only if present (tolerant by design).
  const market = page.getByText(/MARKET: burn prices/).first();
  if (await market.isVisible().catch(() => false)) {
    await expect(market).toContainText(/today/);
  }
  // Footer hint always prints regardless of board contents.
  await expect(page.getByText(/daily claim <n>/).first()).toBeVisible();
});

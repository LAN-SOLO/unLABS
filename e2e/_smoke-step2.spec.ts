/**
 * Step-2 browser smoke probe.
 *
 * Goal: confirm the new systems push didn't break SSR or trigger console
 * errors on the public routes. Auth-protected interactive flows are NOT
 * covered here (tutorial overlay, achievement toasts, tech graph, etc.)
 * — those need a human driver.
 *
 * This file is intentionally prefixed with `_` so it can be deleted (or
 * renamed in Step 3 when proper coverage lands).
 */

import { test, expect, type ConsoleMessage } from "@playwright/test";

const publicRoutes = ["/", "/login", "/register", "/setup"] as const;
const authedRoutes = ["/panel", "/terminal", "/lab", "/dev"] as const;

function attachConsoleCapture(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

for (const path of publicRoutes) {
  test(`public route ${path} renders without console errors`, async ({ page }) => {
    const errors = attachConsoleCapture(page);
    const response = await page.goto(path);
    expect(response, `no response for ${path}`).not.toBeNull();
    expect(response!.status(), `${path} returned ${response!.status()}`).toBe(200);
    await expect(page).toHaveTitle(/_unLABS/i);
    await expect(page.locator("body")).not.toBeEmpty();
    // Filter known-benign noise (favicon 404 etc.) — adjust if it gets chatty.
    const fatal = errors.filter((e) => !/favicon|404/i.test(e));
    expect(fatal, `console errors on ${path}:\n  ${fatal.join("\n  ")}`).toEqual([]);
  });
}

for (const path of authedRoutes) {
  test(`auth-protected route ${path} redirects to /login`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response, `no response for ${path}`).not.toBeNull();
    // Middleware redirects unauthenticated users to /login.
    await expect(page).toHaveURL(/\/login/);
  });
}

test("login page exposes the expected interactive elements", async ({ page }) => {
  const errors = attachConsoleCapture(page);
  await page.goto("/login");
  // Email + password inputs and a submit button must be present.
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  // The ">" literal fix from commit f6e7243 — make sure the entity isn't
  // re-introduced.
  const buttonText = await page.locator('button[type="submit"]').first().textContent();
  expect(buttonText ?? "", "button label should contain a literal '>'").toContain(">");
  expect(buttonText ?? "", "button label should NOT contain HTML entity").not.toContain("&gt;");
  const fatal = errors.filter((e) => !/favicon|404/i.test(e));
  expect(fatal, `console errors on /login:\n  ${fatal.join("\n  ")}`).toEqual([]);
});

test("register page exposes the expected interactive elements", async ({ page }) => {
  const errors = attachConsoleCapture(page);
  await page.goto("/register");
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  const buttonText = await page.locator('button[type="submit"]').first().textContent();
  expect(buttonText ?? "").toContain(">");
  expect(buttonText ?? "").not.toContain("&gt;");
  const fatal = errors.filter((e) => !/favicon|404/i.test(e));
  expect(fatal, `console errors on /register:\n  ${fatal.join("\n  ")}`).toEqual([]);
});

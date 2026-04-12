import { test, expect } from "@playwright/test";

test("home page loads without crashing", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  // The game's root should render *something* — fail hard on a blank page.
  await expect(page.locator("body")).not.toBeEmpty();
});

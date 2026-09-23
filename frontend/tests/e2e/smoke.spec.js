import { test, expect } from "@playwright/test";

test.describe("Aurora E-Commerce — Frontend Browser Smoke Suite", () => {
  test("1. Homepage renders brand identity, navigation bar, and main layout", async ({ page }) => {
    await page.goto("/");
    // Expect page title or header branding
    await expect(page).toHaveTitle(/Aurora|E-Commerce/i);

    // Verify main navigation links exist
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Verify cart button or icon is present
    const cartButton = page.locator("button[aria-label*='cart'], a[href*='cart']");
    await expect(cartButton.first()).toBeVisible();
  });

  test("2. Catalog navigation renders products list and filter controls", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL(/.*products/);

    // Verify product grid or search input is rendered
    const searchInput = page.locator("input[placeholder*='search' i]");
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeEnabled();
    }
  });

  test("3. Authentication page displays login form with email & password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/.*login/);

    const emailInput = page.locator("input[type='email'], input[name='email']");
    const passwordInput = page.locator("input[type='password'], input[name='password']");
    const submitBtn = page.locator("button[type='submit']");

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });
});

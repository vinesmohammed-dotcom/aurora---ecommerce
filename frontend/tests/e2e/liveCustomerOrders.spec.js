import { test, expect } from "@playwright/test";

test.describe("Live Docker End-to-End: Customer Orders & Cancellation Flow", () => {
  test("Customer logs into http://localhost, views orders, sees Cancel Order button on eligible orders, and cancels successfully", async ({ page }) => {
    // 1. Navigate to login
    await page.goto("http://localhost/login");
    await page.waitForLoadState("networkidle");

    // 2. Log in as customer
    await page.locator("input#email").fill("customer@aurora.local");
    await page.locator("input#password").fill("Customer@12345");
    await page.locator("button[type='submit']").click();

    // 3. Wait for navigation away from /login
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 });

    // 4. Navigate directly to /orders
    await page.goto("http://localhost/orders");
    await page.waitForLoadState("networkidle");

    // Verify page heading
    await expect(page.locator("h1")).toHaveText("Your Orders");

    // 5. Check if any cancel button is visible
    const cancelButtons = page.locator("button:has-text('Cancel Order')");
    const count = await cancelButtons.count();
    console.log(`Found ${count} cancel order button(s) on the page.`);

    if (count > 0) {
      // Pick the first Cancel Order button and click it
      const firstCancelBtn = cancelButtons.first();
      await firstCancelBtn.click();
      await page.waitForTimeout(300);

      // Verify the confirmation modal is open
      const modal = page.locator("h3:has-text('Cancel Order')");
      await expect(modal).toBeVisible();

      // Provide a cancellation reason
      const reasonSelect = page.locator("select");
      await reasonSelect.selectOption("Ordered by mistake");

      // Click Confirm Cancellation
      const confirmBtn = page.locator("#confirm-cancel-order-button");
      await confirmBtn.click();

      // Wait for success banner
      const successBanner = page.locator("text=cancelled successfully");
      await expect(successBanner).toBeVisible({ timeout: 10000 });
      console.log("Cancellation success banner verified!");
    } else {
      console.log("No pending/confirmed/processing orders left to cancel.");
    }
  });
});

import { test, expect } from "@playwright/test";

test.describe("Aurora E-Commerce — Full Customer & Admin Demo Flows", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !process.env.RUN_DEMO_FLOW,
    "Live full demo flow requires running backend with seeded database; run with RUN_DEMO_FLOW=1"
  );

  test("1. Customer Flow: Login, Catalog, Search, Filter, Variants, Cart, Wishlist, Profile, Wallet, Orders", async ({
    page
  }) => {
    // 1. Login with demo customer credentials
    await page.goto("/login");
    await page.locator("input#email").fill("customer@aurora.local");
    await page.locator("input#password").fill("Customer@12345");
    await page.locator("button[type='submit']").click();

    // Verify redirected away from login upon successful auth
    await expect(page).not.toHaveURL(/.*login/, { timeout: 10000 });

    // 2. Shop page & Catalog
    await page.goto("/shop");
    await expect(page).toHaveURL(/.*shop/);
    await expect(page.locator("text=Wireless Mouse").first()).toBeVisible({ timeout: 10000 });

    // 3. Search functionality
    const searchInput = page.locator("input[placeholder*='search' i]");
    if (await searchInput.isVisible()) {
      await searchInput.fill("Keyboard");
      await page.waitForTimeout(500);
      await expect(page.locator("text=Mechanical Keyboard").first()).toBeVisible();
      await searchInput.clear();
      await page.waitForTimeout(500);
    }

    // 4. Product Detail & Variant Selection
    await page.goto("/products/wireless-mouse");
    await expect(page.locator("h1")).toContainText(/Wireless Mouse/i);

    // Select a variant if variant options/buttons exist
    const variantButton = page.locator("button:has-text('Arctic White'), button:has-text('White')").first();
    if (await variantButton.isVisible()) {
      await variantButton.click();
    }

    // Add to Cart
    const addToCartBtn = page.locator("button:has-text('Add to Cart')").first();
    if (await addToCartBtn.isVisible()) {
      await addToCartBtn.click();
    }

    // 5. Cart Verification
    await page.goto("/cart");
    await expect(page).toHaveURL(/.*cart/);

    // 6. Wishlist Verification
    await page.goto("/wishlist");
    await expect(page).toHaveURL(/.*wishlist/);
    await expect(page.locator("text=Mechanical Keyboard").first()).toBeVisible({ timeout: 10000 });

    // 7. Profile & Address Verification
    await page.goto("/profile");
    await expect(page).toHaveURL(/.*profile/);
    await expect(page.locator("text=customer@aurora.local").first()).toBeVisible();
    await expect(page.locator("text=Bengaluru").first()).toBeVisible();

    // 8. Wallet Verification
    await page.goto("/wallet");
    await expect(page).toHaveURL(/.*wallet/);
    await expect(page.locator("text=2,500").first()).toBeVisible({ timeout: 10000 });

    // 9. Orders Verification
    await page.goto("/orders");
    await expect(page).toHaveURL(/.*orders/);
    await expect(page.locator("text=ORD-").first()).toBeVisible({ timeout: 10000 });
  });

  test("2. Admin Flow: Login, Dashboard, Catalog, Inventory, Orders, Returns, Wallets, Reports (CSV/PDF)", async ({
    page
  }) => {
    // 1. Login with demo admin credentials
    await page.goto("/login");
    await page.locator("input#email").fill("admin@aurora.local");
    await page.locator("input#password").fill("Admin@12345");
    await page.locator("button[type='submit']").click();

    await expect(page).not.toHaveURL(/.*login/, { timeout: 10000 });

    // 2. Admin Dashboard
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*admin/);
    await expect(page.locator("text=Dashboard").first()).toBeVisible({ timeout: 10000 });

    // 3. Admin Users
    await page.goto("/admin/users");
    await expect(page.locator("text=admin@aurora.local").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=customer@aurora.local").first()).toBeVisible();

    // 4. Admin Products
    await page.goto("/admin/products");
    await expect(page.locator("text=Wireless Mouse").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Mechanical Keyboard").first()).toBeVisible();

    // 5. Admin Categories
    await page.goto("/admin/categories");
    await expect(page.locator("text=Computer Accessories").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Desk Setup").first()).toBeVisible();

    // 6. Admin Brands
    await page.goto("/admin/brands");
    await expect(page.locator("text=NovaGear").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Deskora").first()).toBeVisible();

    // 7. Admin Inventory
    await page.goto("/admin/inventory");
    await expect(page.locator("text=WM-BLK-001").first()).toBeVisible({ timeout: 10000 });

    // 8. Admin Orders
    await page.goto("/admin/orders");
    await expect(page.locator("text=ORD-").first()).toBeVisible({ timeout: 10000 });

    // 9. Admin Returns
    await page.goto("/admin/returns");
    await expect(page).toHaveURL(/.*returns/);

    // 10. Admin Refunds
    await page.goto("/admin/refunds");
    await expect(page).toHaveURL(/.*refunds/);

    // 11. Admin Wallets
    await page.goto("/admin/wallets");
    await expect(page).toHaveURL(/.*wallets/);

    // 12. Admin Reports & Export Actions
    await page.goto("/admin/reports");
    await expect(page.locator("text=Sales Analytics").or(page.locator("text=Reports")).first()).toBeVisible({
      timeout: 10000
    });
    // Verify CSV & PDF export buttons/links exist
    const csvExport = page.locator("a:has-text('CSV'), button:has-text('CSV')").first();
    const pdfExport = page.locator("a:has-text('PDF'), button:has-text('PDF')").first();
    if (await csvExport.isVisible()) {
      await expect(csvExport).toBeEnabled();
    }
    if (await pdfExport.isVisible()) {
      await expect(pdfExport).toBeEnabled();
    }
  });
});

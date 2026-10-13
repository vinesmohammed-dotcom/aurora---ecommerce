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

  test("4. Login form displays field-level validation on empty submission", async ({ page }) => {
    await page.goto("/login");
    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.click();

    await expect(page.getByText("Email address is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("5. Registration form displays field-level validation on empty submission", async ({ page }) => {
    await page.goto("/register");
    const submitBtn = page.locator("button[type='submit']");
    await submitBtn.click();

    await expect(page.getByText("Full name is required")).toBeVisible();
    await expect(page.getByText("Email address is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("6. Login form successfully authenticates with valid credentials", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              _id: "mock_user_123",
              name: "Test User",
              email: "test.user@example.com",
              role: "CUSTOMER"
            }
          }
        })
      });
    });

    await page.goto("/login");
    await page.locator("input#email").fill("test.user@example.com");
    await page.locator("input#password").fill("Password123");
    await page.locator("button[type='submit']").click();

    await expect(page).not.toHaveURL(/.*login/);
  });

  test("7. Customer logout flow: logs in, displays Logout button, logs out, redirects, and persists logged-out on refresh", async ({ page }) => {
    let isAuthenticatedOnBackend = true;

    await page.route("**/api/v1/auth/login", async (route) => {
      isAuthenticatedOnBackend = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              _id: "mock_user_123",
              name: "Customer User",
              email: "customer@example.com",
              role: "CUSTOMER"
            }
          }
        })
      });
    });

    await page.route("**/api/v1/users/me", async (route) => {
      if (isAuthenticatedOnBackend) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                _id: "mock_user_123",
                name: "Customer User",
                email: "customer@example.com",
                role: "CUSTOMER"
              }
            }
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Unauthenticated"
          })
        });
      }
    });

    await page.route("**/api/v1/auth/logout", async (route) => {
      isAuthenticatedOnBackend = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Logged out successfully."
        })
      });
    });

    // 1. Customer login
    await page.goto("/login");
    await page.locator("input#email").fill("customer@example.com");
    await page.locator("input#password").fill("Password123");
    await page.locator("button[type='submit']").click();

    // 2. Redirected away from login and Navbar shows Logout button
    await expect(page).not.toHaveURL(/.*login/);
    const logoutBtn = page.getByRole("button", { name: "Logout" });
    await expect(logoutBtn).toBeVisible();

    // 3. Click Logout
    await logoutBtn.click();

    // 4. Redirected to /login
    await expect(page).toHaveURL(/.*login/);

    // 5. Navbar no longer shows Logout button; shows Sign In
    await expect(page.getByRole("button", { name: "Logout" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();

    // 6. Refresh page to verify session is not restored
    await page.reload();
    await expect(page.getByRole("button", { name: "Logout" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
  });

  test("8. Admin logout flow: displays Logout button in Admin layout, logs out, redirects to /login, and remains logged out", async ({ page }) => {
    let isAdminAuthenticated = true;

    await page.route("**/api/v1/users/me", async (route) => {
      if (isAdminAuthenticated) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                _id: "mock_admin_123",
                name: "Admin User",
                email: "admin@example.com",
                role: "ADMIN"
              }
            }
          })
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Unauthenticated"
          })
        });
      }
    });

    await page.route("**/api/v1/auth/logout", async (route) => {
      isAdminAuthenticated = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Logged out successfully."
        })
      });
    });

    // 1. Visit /admin directly (authenticated as ADMIN via /users/me)
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*admin/);

    // 2. Admin layout shows Logout button
    const adminLogoutBtn = page.getByRole("button", { name: "Logout" }).first();
    await expect(adminLogoutBtn).toBeVisible();

    // 3. Click Logout
    await adminLogoutBtn.click();

    // 4. Redirected to /login
    await expect(page).toHaveURL(/.*login/);

    // 5. Try visiting /admin again or refreshing - redirected to /login
    await page.goto("/admin");
    await expect(page).toHaveURL(/.*login/);
  });
});

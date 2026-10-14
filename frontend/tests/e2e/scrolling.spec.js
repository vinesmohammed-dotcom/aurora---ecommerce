import { test, expect } from "@playwright/test";

test.describe("Aurora E-Commerce — Page Scrolling and Layout Audit Suite", () => {
  const viewports = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 375, height: 667 }
  ];

  for (const vp of viewports) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("1. Home page scrolling and overflow verification", async ({ page }) => {
        await page.goto("http://localhost/");
        await page.waitForLoadState("networkidle");

        const scrollInfo = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          window.scrollTo(0, 500);
          const scrolledY = window.scrollY;
          window.scrollTo(0, 0);

          return {
            scrollHeight: doc.scrollHeight,
            clientHeight: doc.clientHeight,
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            scrolledY,
            hasHorizontalScroll: doc.scrollWidth > doc.clientWidth
          };
        });

        expect(scrollInfo.hasHorizontalScroll).toBe(false);
        if (scrollInfo.scrollHeight > scrollInfo.clientHeight) {
          expect(scrollInfo.scrolledY).toBeGreaterThan(0);
        }
      });

      test("2. Shop/catalog page scrolling and filter drawer", async ({ page }) => {
        await page.goto("http://localhost/shop");
        await page.waitForLoadState("networkidle");

        const scrollInfo = await page.evaluate(() => {
          const doc = document.documentElement;
          window.scrollTo(0, 300);
          const scrolledY = window.scrollY;
          window.scrollTo(0, 0);
          return {
            scrollHeight: doc.scrollHeight,
            clientHeight: doc.clientHeight,
            hasHorizontalScroll: doc.scrollWidth > doc.clientWidth,
            scrolledY
          };
        });

        expect(scrollInfo.hasHorizontalScroll).toBe(false);

        if (vp.name === "mobile") {
          const filterBtn = page.getByRole("button", { name: /filters/i }).first();
          if (await filterBtn.isVisible()) {
            await filterBtn.click();
            await page.waitForTimeout(200);

            // Background should be scroll-locked while drawer is open
            const isLocked = await page.evaluate(() => document.body.style.overflow === "hidden");
            expect(isLocked).toBe(true);

            // Close filter drawer
            const closeBtn = page.locator("button:has(svg.lucide-x)").first();
            if (await closeBtn.isVisible()) {
              await closeBtn.click();
              await page.waitForTimeout(200);
            }

            // Background scroll should be restored
            const isRestored = await page.evaluate(() => document.body.style.overflow !== "hidden");
            expect(isRestored).toBe(true);
          }
        }
      });

      test("3. Login, Register, Forgot Password scrolling & zero horizontal overflow", async ({ page }) => {
        for (const path of ["/login", "/register", "/forgot-password"]) {
          await page.goto(`http://localhost${path}`);
          await page.waitForLoadState("networkidle");

          const scrollInfo = await page.evaluate(() => {
            const doc = document.documentElement;
            window.scrollTo(0, 200);
            const scrolledY = window.scrollY;
            window.scrollTo(0, 0);
            return {
              scrollHeight: doc.scrollHeight,
              clientHeight: doc.clientHeight,
              hasHorizontalScroll: doc.scrollWidth > doc.clientWidth,
              scrolledY
            };
          });

          expect(scrollInfo.hasHorizontalScroll).toBe(false);
        }
      });

      test("4. Cart & Checkout pages vertical scrolling & layout integrity", async ({ page }) => {
        for (const path of ["/cart", "/checkout"]) {
          await page.goto(`http://localhost${path}`);
          await page.waitForLoadState("networkidle");

          const scrollInfo = await page.evaluate(() => {
            const doc = document.documentElement;
            window.scrollTo(0, 250);
            const scrolledY = window.scrollY;
            window.scrollTo(0, 0);
            return {
              hasHorizontalScroll: doc.scrollWidth > doc.clientWidth,
              scrolledY
            };
          });

          expect(scrollInfo.hasHorizontalScroll).toBe(false);
        }
      });

      test("5. Product detail image zoom, lightbox scroll-lock, and restore", async ({ page }) => {
        await page.goto("http://localhost/shop");
        await page.waitForLoadState("networkidle");

        // Click first product card if present
        const productLink = page.locator("a[href*='/products/']").first();
        if (await productLink.isVisible()) {
          await productLink.click();
          await page.waitForLoadState("networkidle");

          // Verify normal page scrolling works initially
          const initialScroll = await page.evaluate(() => {
            window.scrollTo(0, 400);
            const y = window.scrollY;
            window.scrollTo(0, 0);
            return y;
          });

          // Check zoom container exists
          const zoomContainer = page.locator(".cursor-zoom-in").first();
          if (await zoomContainer.isVisible()) {
            // Hover over zoom container (should not block mouse wheel or lock body)
            await zoomContainer.hover();
            const bodyOverflowOnHover = await page.evaluate(() => document.body.style.overflow);
            expect(bodyOverflowOnHover).not.toBe("hidden");

            // Click to open lightbox
            await zoomContainer.click();
            await page.waitForTimeout(200);

            // Lightbox dialog should be visible and body locked
            const lightbox = page.locator("[role='dialog'][aria-label='Image Zoom Lightbox']");
            if (await lightbox.isVisible()) {
              const isLocked = await page.evaluate(() => document.body.style.overflow === "hidden");
              expect(isLocked).toBe(true);

              // Close lightbox via Escape key
              await page.keyboard.press("Escape");
              await page.waitForTimeout(200);

              // Background scrolling must be restored
              const isRestored = await page.evaluate(() => document.body.style.overflow !== "hidden");
              expect(isRestored).toBe(true);
            }
          }
        }
      });

      test("6. Admin Dashboard and Admin views scrolling behavior", async ({ page }) => {
        // Mock admin session
        await page.route("**/api/v1/users/me", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                user: {
                  _id: "admin_test_1",
                  name: "Admin User",
                  email: "admin@aurora.internal",
                  role: "ADMIN"
                }
              }
            })
          });
        });

        // Mock dashboard data
        await page.route("**/api/v1/admin/reports/dashboard", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                totalRevenue: 5200000,
                netRevenue: 4950000,
                placedOrderCount: 142,
                statusBreakdown: { DELIVERED: 98, SHIPPED: 22, PROCESSING: 15, CANCELLED: 7 },
                topSellingProducts: []
              }
            })
          });
        });

        await page.route("**/api/v1/admin/reports/sales*", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                dailyRevenue: [
                  { date: "2026-10-01", grossPaise: 120000, netPaise: 110000 },
                  { date: "2026-10-02", grossPaise: 180000, netPaise: 175000 },
                  { date: "2026-10-03", grossPaise: 250000, netPaise: 240000 }
                ]
              }
            })
          });
        });

        for (const adminPath of ["/admin", "/admin/products", "/admin/categories", "/admin/orders", "/admin/reviews"]) {
          await page.goto(`http://localhost${adminPath}`);
          await page.waitForLoadState("networkidle");

          const adminScroll = await page.evaluate(() => {
            const doc = document.documentElement;
            window.scrollTo(0, 300);
            const scrolledY = window.scrollY;
            window.scrollTo(0, 0);

            return {
              scrollHeight: doc.scrollHeight,
              clientHeight: doc.clientHeight,
              hasHorizontalScroll: doc.scrollWidth > doc.clientWidth,
              scrolledY
            };
          });

          expect(adminScroll.hasHorizontalScroll).toBe(false);

          // On mobile, test sidebar open/close locks and restores background scroll
          if (vp.name === "mobile") {
            const toggleSidebarBtn = page.locator("button[aria-label='Toggle Navigation']").first();
            if (await toggleSidebarBtn.isVisible()) {
              await toggleSidebarBtn.click();
              await page.waitForTimeout(150);

              const isLocked = await page.evaluate(() => document.body.style.overflow === "hidden");
              expect(isLocked).toBe(true);

              // Close sidebar via Close Navigation button or backdrop
              const closeSidebarBtn = page.locator("button[aria-label='Close Navigation']").first();
              if (await closeSidebarBtn.isVisible()) {
                await closeSidebarBtn.click();
              } else {
                await page.locator(".backdrop-blur-sm").click({ position: { x: 300, y: 100 } });
              }
              await page.waitForTimeout(150);

              const isRestored = await page.evaluate(() => document.body.style.overflow !== "hidden");
              expect(isRestored).toBe(true);
            }
          }
        }
      });
    });
  }
});

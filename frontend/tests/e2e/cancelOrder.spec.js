import { test, expect } from "@playwright/test";

test.describe("Aurora E-Commerce — Customer Cancel Order Option & Flow", () => {
  const viewports = [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 375, height: 667 }
  ];

  for (const vp of viewports) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("1. Displays Cancel Order button beside details action for eligible orders (PENDING, CONFIRMED, PROCESSING)", async ({ page }) => {
        // Mock customer authentication
        await page.route("**/api/v1/users/me", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: {
                user: {
                  _id: "user_test_cancel_1",
                  name: "Test Customer",
                  email: "customer@aurora.internal",
                  role: "USER"
                }
              }
            })
          });
        });

        // Mock orders list with various statuses
        let currentOrders = [
          {
            _id: "order_pending_1",
            orderNumber: "ORD-PENDING-001",
            orderStatus: "PENDING",
            paymentMethod: "ONLINE_RAZORPAY",
            paymentStatus: "PENDING",
            createdAt: new Date().toISOString(),
            shippingAddress: { fullName: "Test Customer" },
            priceSummary: { grandTotal: 2500 },
            items: [{ _id: "item_1", name: "Aurora Chrono", quantity: 1, unitPrice: 2500, itemTotal: 2500 }],
            statusHistory: [{ status: "PENDING", changedAt: new Date().toISOString(), note: "Awaiting payment" }]
          },
          {
            _id: "order_confirmed_1",
            orderNumber: "ORD-CONFIRMED-002",
            orderStatus: "CONFIRMED",
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            createdAt: new Date().toISOString(),
            shippingAddress: { fullName: "Test Customer" },
            priceSummary: { grandTotal: 3400 },
            items: [{ _id: "item_2", name: "Nordic Minimalist Watch", quantity: 1, unitPrice: 3400, itemTotal: 3400 }],
            statusHistory: [{ status: "CONFIRMED", changedAt: new Date().toISOString(), note: "Order placed via COD" }]
          },
          {
            _id: "order_shipped_1",
            orderNumber: "ORD-SHIPPED-003",
            orderStatus: "SHIPPED",
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            createdAt: new Date().toISOString(),
            shippingAddress: { fullName: "Test Customer" },
            priceSummary: { grandTotal: 1200 },
            items: [{ _id: "item_3", name: "Leather Strap", quantity: 1, unitPrice: 1200, itemTotal: 1200 }],
            statusHistory: [{ status: "SHIPPED", changedAt: new Date().toISOString(), note: "In transit" }]
          },
          {
            _id: "order_delivered_1",
            orderNumber: "ORD-DELIVERED-004",
            orderStatus: "DELIVERED",
            paymentMethod: "COD",
            paymentStatus: "COMPLETED",
            createdAt: new Date().toISOString(),
            shippingAddress: { fullName: "Test Customer" },
            priceSummary: { grandTotal: 4900 },
            items: [{ _id: "item_4", name: "Sapphire Classic", quantity: 1, unitPrice: 4900, itemTotal: 4900 }],
            statusHistory: [{ status: "DELIVERED", changedAt: new Date().toISOString(), note: "Package delivered" }]
          },
          {
            _id: "order_cancelled_1",
            orderNumber: "ORD-CANCELLED-005",
            orderStatus: "CANCELLED",
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            createdAt: new Date().toISOString(),
            shippingAddress: { fullName: "Test Customer" },
            priceSummary: { grandTotal: 1800 },
            items: [{ _id: "item_5", name: "Travel Case", quantity: 1, unitPrice: 1800, itemTotal: 1800 }],
            statusHistory: [{ status: "CANCELLED", changedAt: new Date().toISOString(), note: "Customer cancelled" }]
          }
        ];

        await page.route("**/api/v1/orders*", async (route) => {
          if (route.request().method() === "GET") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                success: true,
                data: {
                  orders: currentOrders,
                  pagination: { page: 1, limit: 10, total: currentOrders.length, totalPages: 1 }
                }
              })
            });
          } else {
            await route.continue();
          }
        });

        // Mock cancel endpoint
        await page.route("**/api/v1/orders/*/cancel", async (route) => {
          const url = route.request().url();
          const orderId = url.split("/orders/")[1].split("/cancel")[0];
          const postData = route.request().postDataJSON();

          // Update mocked order status to CANCELLED
          currentOrders = currentOrders.map((o) => {
            if (o._id === orderId) {
              return {
                ...o,
                orderStatus: "CANCELLED",
                cancellationReason: postData.reason,
                statusHistory: [
                  ...o.statusHistory,
                  { status: "CANCELLED", changedAt: new Date().toISOString(), note: postData.reason }
                ]
              };
            }
            return o;
          });

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "Order cancelled successfully.",
              data: {
                order: currentOrders.find((o) => o._id === orderId)
              }
            })
          });
        });

        await page.goto("http://localhost/orders");
        await page.waitForLoadState("networkidle");

        // Verify Cancel button is VISIBLE for PENDING order
        const pendingCancelBtn = page.locator("#cancel-order-order_pending_1");
        await expect(pendingCancelBtn).toBeVisible();
        await expect(pendingCancelBtn).toHaveText(/Cancel Order/i);

        // Verify Cancel button is VISIBLE for CONFIRMED order
        const confirmedCancelBtn = page.locator("#cancel-order-order_confirmed_1");
        await expect(confirmedCancelBtn).toBeVisible();

        // Verify Cancel button is NOT visible for SHIPPED, DELIVERED, or CANCELLED orders
        await expect(page.locator("#cancel-order-order_shipped_1")).toHaveCount(0);
        await expect(page.locator("#cancel-order-order_delivered_1")).toHaveCount(0);
        await expect(page.locator("#cancel-order-order_cancelled_1")).toHaveCount(0);

        // Click Cancel Order on the PENDING order
        await pendingCancelBtn.click();
        await page.waitForTimeout(200);

        // Confirmation modal must be visible
        const modal = page.locator("h3:has-text('Cancel Order #ORD-PENDING-001')");
        await expect(modal).toBeVisible();

        // Select 'Other' and enter a custom reason
        const reasonSelect = page.locator("select");
        await reasonSelect.selectOption("Other");
        const specificInput = page.locator("input[placeholder*='why you are cancelling']");
        await expect(specificInput).toBeVisible();
        await specificInput.fill("Found an exclusive bundle deal elsewhere");

        // Click Confirm Cancellation
        const confirmBtn = page.locator("#confirm-cancel-order-button");
        await confirmBtn.click();

        // Verify success banner appears
        const successBanner = page.locator("text=Order #ORD-PENDING-001 has been cancelled successfully");
        await expect(successBanner).toBeVisible();

        // Verify order badge now reflects Cancelled
        await expect(page.locator("#cancel-order-order_pending_1")).toHaveCount(0);
      });

      test("2. Allows cancellation directly from inside the Order Details & Timeline modal", async ({ page }) => {
        let currentOrders = [
          {
            _id: "order_confirmed_modal_test",
            orderNumber: "ORD-MODAL-999",
            orderStatus: "CONFIRMED",
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            createdAt: new Date().toISOString(),
            shippingAddress: { fullName: "Test Customer", phone: "+91 9000000000", addressLine1: "123 High St", city: "Bengaluru", state: "KA", postalCode: "560001", country: "India" },
            priceSummary: { grossSubtotal: 3000, offerDiscountTotal: 0, couponDiscount: 0, shippingFee: 0, grandTotal: 3000 },
            items: [{ _id: "item_m1", name: "Aurora Minimalist Gold", quantity: 1, unitPrice: 3000, itemTotal: 3000 }],
            statusHistory: [{ status: "CONFIRMED", changedAt: new Date().toISOString(), note: "Placed" }]
          }
        ];

        await page.route("**/api/v1/users/me", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              data: { user: { _id: "u_modal", name: "Modal Tester", email: "modal@aurora.internal", role: "USER" } }
            })
          });
        });

        await page.route("**/api/v1/orders*", async (route) => {
          if (route.request().method() === "GET") {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                success: true,
                data: { orders: currentOrders, pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }
              })
            });
          } else {
            await route.continue();
          }
        });

        await page.route("**/api/v1/orders/*/cancel", async (route) => {
          currentOrders[0].orderStatus = "CANCELLED";
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "Order cancelled successfully.",
              data: { order: currentOrders[0] }
            })
          });
        });

        await page.goto("http://localhost/orders");
        await page.waitForLoadState("networkidle");

        // Open details modal
        await page.locator("#view-details-order_confirmed_modal_test").click();
        await page.waitForTimeout(200);

        // Cancel button inside modal footer must be visible
        const modalCancelBtn = page.locator("#modal-cancel-order-order_confirmed_modal_test");
        await expect(modalCancelBtn).toBeVisible();

        // Click cancel from inside modal
        await modalCancelBtn.click();
        await page.waitForTimeout(200);

        // Details modal closes, cancellation confirmation modal opens
        await expect(page.locator("h3:has-text('Cancel Order #ORD-MODAL-999')")).toBeVisible();

        // Confirm cancellation
        await page.locator("#confirm-cancel-order-button").click();

        // Success banner appears
        await expect(page.locator("text=Order #ORD-MODAL-999 has been cancelled successfully")).toBeVisible();
      });
    });
  }
});

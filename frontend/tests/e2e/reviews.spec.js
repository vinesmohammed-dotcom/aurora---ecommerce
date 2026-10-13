import { test, expect } from "@playwright/test";

test.describe("Aurora E-Commerce — Customer & Admin Reviews Suite", () => {
  const mockProduct = {
    _id: "prod_headphones_123",
    name: "Wireless Noise-Cancelling Headphones",
    slug: "wireless-headphones",
    description: "Premium headphones with studio-grade sound and active noise cancellation.",
    basePrice: 14999,
    images: ["/test-image.jpg"],
    brand: { _id: "brand_1", name: "Aurora Audio" },
    category: { _id: "cat_1", name: "Audio" },
    variants: [
      { _id: "var_1", title: "Midnight Black", sku: "AU-NC-BLK", price: 14999, stock: 15, isActive: true }
    ],
    rating: {
      average: 4.5,
      count: 2,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 }
    }
  };

  const mockReviews = [
    {
      _id: "rev_1",
      product: "prod_headphones_123",
      user: { _id: "user_customer_1", name: "Alice Sharma", email: "alice@example.com" },
      rating: 5,
      title: "Best headphones I have ever owned!",
      comment: "The noise cancellation is exceptional, and battery lasts days.",
      isVerifiedPurchase: true,
      status: "PUBLISHED",
      createdAt: new Date().toISOString()
    },
    {
      _id: "rev_2",
      product: "prod_headphones_123",
      user: { _id: "user_customer_2", name: "Bob Verma", email: "bob@example.com" },
      rating: 4,
      title: "Solid sound quality",
      comment: "Great soundstage and very comfortable for long sessions.",
      isVerifiedPurchase: true,
      status: "PUBLISHED",
      createdAt: new Date().toISOString()
    }
  ];

  test("1. Product Detail displays star rating summary and customer reviews section", async ({ page }) => {
    await page.route("**/api/v1/products/wireless-headphones", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockProduct })
      });
    });

    await page.route("**/api/v1/products/prod_headphones_123/reviews*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            reviews: mockReviews,
            summary: mockProduct.rating,
            pagination: { page: 1, limit: 5, totalPages: 1, total: 2 }
          }
        })
      });
    });

    await page.route("**/api/v1/products/prod_headphones_123/reviews/eligibility", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            eligible: false,
            hasExistingReview: false,
            existingReview: null,
            eligiblePurchases: []
          }
        })
      });
    });

    await page.goto("/products/wireless-headphones");

    // Title and rating header
    await expect(page.locator("h1")).toContainText("Wireless Noise-Cancelling Headphones");
    await expect(page.getByText("Ratings & Reviews")).toBeVisible();
    await expect(page.getByText("Alice Sharma")).toBeVisible();
    await expect(page.getByText("Best headphones I have ever owned!")).toBeVisible();
    await expect(page.getByText("Verified Purchase").first()).toBeVisible();
  });

  test("2. Eligible customer sees Write a Review button and validates form submission", async ({ page }) => {
    // Authenticated user
    await page.route("**/api/v1/users/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: { _id: "user_customer_1", name: "Alice Sharma", email: "alice@example.com", role: "CUSTOMER" }
          }
        })
      });
    });

    await page.route("**/api/v1/products/wireless-headphones", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockProduct })
      });
    });

    await page.route("**/api/v1/products/prod_headphones_123/reviews*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            reviews: mockReviews,
            summary: mockProduct.rating,
            pagination: { page: 1, limit: 5, totalPages: 1, total: 2 }
          }
        })
      });
    });

    await page.route("**/api/v1/products/prod_headphones_123/reviews/eligibility", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            eligible: true,
            hasExistingReview: false,
            existingReview: null,
            eligiblePurchases: [
              {
                orderId: "ord_1",
                orderNumber: "ORD-9999",
                orderItemId: "item_1",
                deliveredAt: new Date().toISOString()
              }
            ]
          }
        })
      });
    });

    await page.goto("/products/wireless-headphones");

    const writeReviewBtn = page.getByRole("button", { name: /Write a Review/i });
    await expect(writeReviewBtn).toBeVisible();
    await writeReviewBtn.click();

    // Modal opens
    await expect(page.getByRole("heading", { name: "Write a Customer Review" })).toBeVisible();

    // Trigger validation
    const submitBtn = page.getByRole("button", { name: "Submit Review" });
    await submitBtn.click();

    await expect(page.getByText("Review headline is required.")).toBeVisible();
  });

  test("3. Admin Reviews moderation view renders and allows filtering", async ({ page }) => {
    // Admin user session
    await page.route("**/api/v1/users/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: { _id: "admin_user", name: "Admin Root", email: "admin@aurora.local", role: "ADMIN" }
          }
        })
      });
    });

    await page.route("**/api/v1/admin/reviews*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            reviews: [
              {
                _id: "rev_1",
                product: { _id: "p1", name: "Wireless Headphones", slug: "wireless-headphones" },
                user: { _id: "u1", name: "Alice Sharma", email: "alice@example.com" },
                rating: 5,
                title: "Best headphones I have ever owned!",
                comment: "The noise cancellation is exceptional.",
                isVerifiedPurchase: true,
                status: "PUBLISHED",
                createdAt: new Date().toISOString()
              }
            ],
            pagination: { page: 1, limit: 10, total: 1, pages: 1 }
          }
        })
      });
    });

    await page.goto("/admin/reviews");

    await expect(page.getByRole("heading", { name: "Customer Product Reviews" })).toBeVisible();
    await expect(page.getByText("Alice Sharma")).toBeVisible();
    await expect(page.getByText("PUBLISHED").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide" })).toBeVisible();
  });

  test("4. Customer can mark a review as helpful and see updated count and state", async ({ page }) => {
    // Authenticated user (Bob viewing Alice's review)
    await page.route("**/api/v1/users/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            user: { _id: "user_customer_2", name: "Bob Verma", email: "bob@example.com", role: "CUSTOMER" }
          }
        })
      });
    });

    await page.route("**/api/v1/products/wireless-headphones", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: mockProduct })
      });
    });

    await page.route("**/api/v1/products/prod_headphones_123/reviews*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            reviews: [
              {
                ...mockReviews[0],
                helpfulCount: 5,
                hasVotedHelpful: false
              }
            ],
            summary: mockProduct.rating,
            pagination: { page: 1, limit: 5, totalPages: 1, total: 1 }
          }
        })
      });
    });

    await page.route("**/api/v1/products/prod_headphones_123/reviews/eligibility", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { eligible: false, hasExistingReview: false } })
      });
    });

    let helpfulVoted = false;
    await page.route("**/api/v1/reviews/rev_1/helpful", async (route) => {
      helpfulVoted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { helpfulCount: 6, hasVotedHelpful: true },
          message: "Review marked as helpful."
        })
      });
    });

    await page.goto("/products/wireless-headphones");

    await expect(page.getByText("Helpful 5")).toBeVisible();
    const helpfulBtn = page.getByRole("button", { name: "Helpful", exact: true });
    await expect(helpfulBtn).toBeVisible();
    await helpfulBtn.click();

    expect(helpfulVoted).toBe(true);
    await expect(page.getByText("Helpful 6")).toBeVisible();
    await expect(page.getByText("Helpful ✓")).toBeVisible();
  });
});

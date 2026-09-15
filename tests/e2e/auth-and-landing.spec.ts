import { expect, test } from "@playwright/test";
import {
  createApiContext,
  e2eUserId,
  hasDatabase,
  signInE2eUser,
} from "./support/database";

test.describe("public landing and authentication", () => {
  test("shows the public landing page before authentication", async ({
    page,
    playwright,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /train with intention/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start planning" })).toHaveAttribute(
      "href",
      "/signup",
    );

    const api = await playwright.request.newContext({
      baseURL: "http://localhost:3000/api",
    });
    try {
      const response = await api.get("/profile");
      expect(response.status()).toBe(401);
    } finally {
      await api.dispose();
    }

    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test.describe("authenticated browser flow", () => {
    test.skip(!hasDatabase, "DATABASE_URL is required for database-backed E2E runs");

    test("logs in through fake auth and reaches the protected Today page", async ({
      page,
      playwright,
    }) => {
      await signInE2eUser(page);
      await expect(page).toHaveURL(/\/today$/);

      const api = await createApiContext(playwright);
      try {
        const response = await api.get("/profile");
        expect(response.ok()).toBeTruthy();
        expect((await response.json()).data).toMatchObject({
          primaryGoal: "FAT_LOSS",
        });
      } finally {
        await api.dispose();
      }

      expect(e2eUserId).toBeTruthy();
    });
  });
});

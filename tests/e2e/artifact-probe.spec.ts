import { expect, test } from "@playwright/test";

// Temporary deliberate failure to qualify the real CI artifact upload.
test("temporary browser failure evidence qualification", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Intentional artifact retention probe" })
  ).toBeVisible({ timeout: 1000 });
});

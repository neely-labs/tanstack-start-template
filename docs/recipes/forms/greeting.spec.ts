// The forms recipe's browser test, docs/recipes/forms.md. Copy it into
// tests/e2e/ and change "/greeting" to the route that renders the form.
import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";

// Holds every script so the test types into server HTML, as a visitor on a
// slow connection does, then releases them and lets React hydrate.
test("keeps a name typed and submitted before hydration", async ({ page }) => {
  let holding = true;
  const held: Route[] = [];
  await page.route("**/*.js", async (route) => {
    if (holding) {
      held.push(route);
    } else {
      await route.continue();
    }
  });
  await page.goto("/greeting", { waitUntil: "commit" });
  const field = page.getByRole("textbox", { name: "Name" });
  await field.fill("Ada");
  await field.press("Enter");
  // Still server HTML: React has not hydrated the field.
  await expect(page.getByText("0 characters")).toBeVisible();

  holding = false;
  await Promise.all(
    held.map(async (route) => {
      await route.continue();
    })
  );
  await expect(page.getByRole("status")).toHaveText("Hello, Ada.");
  await expect(page.getByText("3 characters")).toBeVisible();
  await expect(field).toHaveValue("Ada");
  expect(new URL(page.url()).search).toBe("");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("keeps the name out of the URL", async ({ page }) => {
    await page.goto("/greeting");
    const field = page.getByRole("textbox", { name: "Name" });
    await field.fill("Ada");
    await field.press("Enter");
    await page.waitForLoadState();
    expect(new URL(page.url()).search).toBe("");
  });
});

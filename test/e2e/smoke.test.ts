import { expect, test } from "@playwright/test";

import { checkPageHtml } from "../../scripts/verify-seo-output.ts";
import { publicPaths } from "../../src/lib/public-routes.ts";
import { securityHeaders } from "../../src/lib/security-headers.ts";
import { pageTitle, recoveryTitles } from "../../src/lib/seo.ts";
import { siteConfig } from "../../src/lib/site-config.ts";
import { generatedSiteFiles } from "../../src/lib/site-files.ts";

// Exercise the built server: files on disk alone do not prove Nitro serves them.
test("serves prerendered pages, identity files, and secured API responses", async ({
  request,
}) => {
  await Promise.all(
    publicPaths.map(async (routePath) => {
      const response = await request.get(routePath);
      expect(response.status()).toBe(200);

      for (const [name, value] of Object.entries(securityHeaders)) {
        expect(response.headers()[name.toLowerCase()]).toBe(value);
      }

      const html = await response.text();
      // The served page must pass the same checks as the built file.
      checkPageHtml(html, routePath);
      // The skip link's target: the one main landmark, which the root renders.
      const mains = html.match(/<main\b[^>]*>/gu) ?? [];
      expect(mains).toHaveLength(1);
      expect(mains[0]).toContain('id="main-content"');
      expect(mains[0]).toContain('tabindex="-1"');
    })
  );

  await Promise.all(
    Object.entries(generatedSiteFiles).map(async ([fileName, file]) => {
      const response = await request.get(`/${fileName}`);
      expect(response.status()).toBe(200);
      expect(await response.text()).toBe(file.source);
    })
  );

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok" });
  expect(health.headers()).toMatchObject({
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  const healthHead = await request.head("/api/health");
  expect(healthHead.status()).toBe(200);
  expect(healthHead.headers()["content-type"]).toBe("application/json");
  expect(await healthHead.body()).toHaveLength(0);
  await Promise.all(
    ["post", "put", "delete"].map(async (method) => {
      const refused = await request.fetch("/api/health", { method });
      expect(refused.status()).toBe(405);
      expect(refused.headers().allow).toBe("GET, HEAD");
    })
  );

  const missing = await request.get("/missing-smoke-route");
  expect(missing.status()).toBe(404);

  for (const [name, value] of Object.entries(securityHeaders)) {
    expect(missing.headers()[name.toLowerCase()]).toBe(value);
  }

  // Nitro answers a URL it cannot decode itself, without the app's headers.
  const malformed = await request.get("/%E0%A4%A");
  expect(malformed.status()).toBe(400);
  expect(malformed.headers()["content-type"]).toContain("application/json");

  for (const name of Object.keys(securityHeaders)) {
    expect(malformed.headers()[name.toLowerCase()]).toBeUndefined();
  }

  const image = await request.get(siteConfig.socialImage.path);
  expect(image.status()).toBe(200);
  const { etag } = image.headers();
  expect(etag).toBeDefined();

  const conditional = await request.get(siteConfig.socialImage.path, {
    headers: { "if-none-match": etag ?? "" },
  });

  expect(conditional.status()).toBe(304);
  const head = await request.head(siteConfig.socialImage.path);
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
});

test("hydrates and preserves a keyboard-selected theme across reloads", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (failure) => browserErrors.push(failure.message));
  await page.goto("/");
  const themeToggle = page.getByRole("button", { name: "Dark theme" });
  await expect(themeToggle).toHaveAttribute(
    "aria-pressed",
    /^(?:true|false)$/u
  );
  const startedDark = await themeToggle.getAttribute("aria-pressed");
  const nextDark = startedDark === "false";
  await themeToggle.focus();
  await page.keyboard.press("Space");
  await expect(themeToggle).toHaveAttribute("aria-pressed", `${nextDark}`);
  await page.reload();
  await expect(themeToggle).toHaveAttribute("aria-pressed", `${nextDark}`);
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    )
  ).toBe(nextDark);
  expect(browserErrors).toStrictEqual([]);
});

test("supports keyboard skip, navigation, and not-found recovery", async ({
  page,
  baseURL,
}) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  // Shown over the page, so focusing it does not push the layout down.
  await expect(skip).toHaveCSS("position", "fixed");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");

  const home = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Home", exact: true });

  await expect(home).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${baseURL}/`);

  const missing = await page.goto("/missing-smoke-route");
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
  await expect(page).toHaveTitle(pageTitle(recoveryTitles.notFound));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex"
  );
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Return home", exact: true })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${baseURL}/`);
});

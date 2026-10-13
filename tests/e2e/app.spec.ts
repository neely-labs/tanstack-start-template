import { expect, test } from "@playwright/test";

import { publicPaths } from "../../src/lib/public-routes.ts";
import { securityHeaders } from "../../src/lib/security-headers.ts";
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
      expect(html).toContain("<h1");
      expect(html).toContain(`href="${siteConfig.origin}${routePath}"`);
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
  const malformed = await request.get("/%E0%A4%A");
  expect(malformed.status()).toBe(400);

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

test("hydrates, navigates, validates server functions, and recovers", async ({
  page,
  request,
  baseURL,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (failure) => browserErrors.push(failure.message));
  await page.goto("/");
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await navigation.getByRole("link", { exact: true, name: "About" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Infrastructure first. Product assumptions last."
  );
  await page.goBack();
  await expect(page).toHaveURL(`${baseURL}/`);
  await page.goForward();
  await expect(page).toHaveURL(`${baseURL}/about`);
  await navigation.getByRole("link", { exact: true, name: "Runtime" }).click();
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  await expect(page.getByText(/^server · Node/u)).toBeVisible();
  await expect(page.getByText("Waiting for hydration")).toHaveCount(0);

  const input = page.getByRole("textbox", { name: "Text to analyze" });
  const submit = page.getByRole("button", { name: "Analyze on the server" });
  await input.fill("   ");
  await submit.click();
  await expect(page.getByText("Enter some text to analyze.")).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");

  const submittedText = "TanStack stable upgrade works.";
  await input.fill(submittedText);
  const serverRequest = page.waitForRequest(
    (candidate) =>
      candidate.method() === "POST" && candidate.url().includes("/_serverFn/")
  );
  await submit.click();
  const rpcRequest = await serverRequest;
  await expect(page.locator("dd").nth(0)).toHaveText("4");
  await expect(page.locator("dd").nth(1)).toHaveText(`${submittedText.length}`);
  await expect(input).toHaveValue(submittedText);
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByText("Enter some text to analyze.")).toHaveCount(0);

  await input.fill("Works again");
  await submit.click();
  await expect(page.locator("dd").nth(0)).toHaveText("2");
  await expect(input).toHaveValue("Works again");

  const requestBody = rpcRequest.postData();
  if (requestBody === null) {
    throw new Error("The server-function request must include its input.");
  }
  expect(requestBody).toContain(submittedText);
  const headers = new Headers(await rpcRequest.allHeaders());
  headers.delete("content-length");
  const oversized = await request.post(rpcRequest.url(), {
    data: requestBody.replace(submittedText, "a".repeat(2001)),
    headers: Object.fromEntries(headers),
  });
  // Start returns RPC validation failures in a serialized error envelope.
  expect(oversized.status()).toBe(200);
  const oversizedBody = await oversized.text();
  expect(oversizedBody).toContain('"error"');
  expect(oversizedBody).toContain("Enter at most 2000 characters.");
  expect(oversizedBody).not.toContain('"computedAt"');

  headers.set("origin", "https://attacker.example");
  headers.set("sec-fetch-site", "cross-site");
  const crossSite = await request.post(rpcRequest.url(), {
    data: requestBody,
    headers: Object.fromEntries(headers),
  });
  expect(crossSite.status()).toBe(403);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy();
  const missing = await page.goto("/missing-upgrade-route");
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Return home" }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  expect(browserErrors).toStrictEqual([]);
});

import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";

import {
  analyzerFailure,
  maxTextLength,
  textInputErrors,
} from "../../src/lib/text-stats.ts";

// Remove this file with the optional /setup and /runtime example pages.
test("navigates the examples and validates real server functions", async ({
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
  await navigation.getByRole("link", { exact: true, name: "Setup" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make it yours."
  );
  await expect(
    navigation.getByRole("link", { exact: true, name: "Setup" })
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(`${baseURL}/`);
  await page.goForward();
  await expect(page).toHaveURL(`${baseURL}/setup`);

  await navigation.getByRole("link", { exact: true, name: "Runtime" }).click();
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  await expect(page.getByText(/^server · Node/u)).toBeVisible();
  await expect(page.getByText("Waiting for hydration")).toHaveCount(0);

  const input = page.getByRole("textbox", { name: "Text to analyze" });
  const submit = page.getByRole("button", { name: "Analyze on the server" });
  await input.fill("   ");
  await submit.click();
  await expect(page.getByText(textInputErrors.blank)).toBeVisible();
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
  await expect(page.getByText(textInputErrors.blank)).toHaveCount(0);

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
    data: requestBody.replace(submittedText, "a".repeat(maxTextLength + 1)),
    headers: Object.fromEntries(headers),
  });
  // Start returns RPC validation failures in a serialized error envelope.
  expect(oversized.status()).toBe(200);
  const oversizedBody = await oversized.text();
  expect(oversizedBody).toContain('"error"');
  expect(oversizedBody).toContain(textInputErrors.tooLong);
  expect(oversizedBody).not.toContain('"computedAt"');

  // A caller that skips the page can send any shape; the schema rejects it.
  const fieldWithoutText = requestBody.replace(
    `"k":["text"],"v":[{"t":1,"s":"${submittedText}"}]`,
    '"k":[],"v":[]'
  );
  expect(fieldWithoutText).not.toBe(requestBody);
  const malformed = await request.post(rpcRequest.url(), {
    data: fieldWithoutText,
    headers: Object.fromEntries(headers),
  });
  const malformedBody = await malformed.text();
  expect(malformedBody).toContain('"error"');
  expect(malformedBody).toContain("invalid_type");
  expect(malformedBody).not.toContain("Cannot read properties");
  expect(malformedBody).not.toContain('"computedAt"');

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
  expect(browserErrors).toStrictEqual([]);
});

test("submits and corrects the example form with the keyboard", async ({
  page,
}) => {
  await page.goto("/runtime");
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  const input = page.getByRole("textbox", { name: "Text to analyze" });
  const submit = page.getByRole("button", { name: "Analyze on the server" });
  await input.focus();
  await page.keyboard.type("   ");
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute("aria-describedby", "analyzer-error");
  await expect(page.getByText(textInputErrors.blank)).toBeVisible();

  await input.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Keyboard submission works");
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("dd").first()).toHaveText("3");
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await expect(input).toHaveValue("Keyboard submission works");
});

test("recovers from a loader failure by retrying the real server", async ({
  page,
}) => {
  let failLoader = true;
  let failedRequests = 0;
  let retriedRequests = 0;
  // Fault injection stays in this browser. Retry reaches the built server.
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
    } else if (failLoader) {
      failedRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "Temporary loader failure",
      });
    } else {
      retriedRequests += 1;
      await route.continue();
    }
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Dark theme" })
  ).toHaveAttribute("aria-pressed", /^(?:true|false)$/u);
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Runtime", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "This page couldn't finish loading." })
  ).toBeVisible();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByText("Technical details")).toHaveCount(0);
  expect(failedRequests).toBeGreaterThan(0);

  failLoader = false;
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Code that knows where it runs." })
  ).toBeVisible();
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  expect(retriedRequests).toBeGreaterThan(0);
});

test("hides a failed request's server text and recovers on retry", async ({
  page,
}) => {
  const serverText = "connection to db at 10.0.0.5 failed";
  let failAnalysis = true;
  // Fault injection stays in this browser. The retry reaches the built server.
  await page.route("**/_serverFn/**", async (route) => {
    await (failAnalysis && route.request().method() === "POST"
      ? route.fulfill({
          body: serverText,
          contentType: "text/plain",
          status: 500,
        })
      : route.continue());
  });
  await page.goto("/runtime");
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  const input = page.getByRole("textbox", { name: "Text to analyze" });
  const submit = page.getByRole("button", { name: "Analyze on the server" });
  const submittedText = "Retry after a failure";
  await input.fill(submittedText);
  await submit.click();
  await expect(page.getByText(analyzerFailure)).toBeVisible();
  await expect(page.getByText(serverText)).toHaveCount(0);
  await expect(input).toHaveValue(submittedText);
  await expect(input).toHaveAttribute("aria-invalid", "false");

  failAnalysis = false;
  await submit.click();
  await expect(page.locator("dd").first()).toHaveText("4");
  await expect(page.getByText(analyzerFailure)).toHaveCount(0);
});

test("keeps the submitted text read-only while the analysis is pending", async ({
  page,
}) => {
  // A route left unanswered holds its request until the test continues it.
  const heldRequests: Route[] = [];
  await page.route("**/_serverFn/**", async (route) => {
    if (route.request().method() === "POST") {
      heldRequests.push(route);
    } else {
      await route.continue();
    }
  });
  await page.goto("/runtime");
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  const input = page.getByRole("textbox", { name: "Text to analyze" });
  const submittedText = "Held while pending";
  await input.fill(submittedText);
  await page.getByRole("button", { name: "Analyze on the server" }).click();
  await expect(page.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  await expect(input).not.toBeEditable();
  await input.focus();
  await page.keyboard.type(" and more");
  await expect(input).toHaveValue(submittedText);

  await expect.poll(() => heldRequests.length).toBe(1);
  await heldRequests[0]?.continue();
  await expect(page.locator("dd").first()).toHaveText("3");
  await expect(input).toHaveValue(submittedText);
  await expect(input).toBeEditable();
});

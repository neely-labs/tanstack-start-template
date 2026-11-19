import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

import {
  analyzerFailure,
  maxTextLength,
  textInputErrors,
} from "../../src/lib/text-stats.ts";

// Remove this file with the optional /setup and /runtime example pages.

/** An analyzer measure's value, found by its label rather than its position. */
function measure(page: Page, label: string) {
  return page
    .locator("dl > div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .getByRole("definition");
}

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
  // The server knows nothing of the browser, so its HTML holds the placeholder.
  const serverHtml = await request.get("/runtime");
  expect(await serverHtml.text()).toContain("Waiting for hydration");
  const health = page.getByRole("link", { name: /Open \/api\/health/u });
  await expect(health).toHaveAccessibleName(
    "Open /api/health (opens in a new tab)"
  );
  await expect(health).toHaveAttribute("target", "_blank");

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
  await expect(measure(page, "Words")).toHaveText("4");
  await expect(measure(page, "Characters")).toHaveText(
    `${submittedText.length}`
  );
  await expect(input).toHaveValue(submittedText);
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByText(textInputErrors.blank)).toHaveCount(0);

  await input.fill("Works again");
  await submit.click();
  await expect(measure(page, "Words")).toHaveText("2");
  await expect(input).toHaveValue("Works again");

  // A paste over the limit stays whole, so the server's message explains it.
  const oversizedText = "a".repeat(maxTextLength + 1);
  await input.clear();
  await page.keyboard.insertText(oversizedText);
  await submit.click();
  await expect(page.getByText(textInputErrors.tooLong)).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveValue(oversizedText);

  const requestBody = rpcRequest.postData();

  if (requestBody === null) {
    throw new Error("The server-function request must include its input.");
  }

  expect(requestBody).toContain(submittedText);
  const headers = new Headers(await rpcRequest.allHeaders());
  headers.delete("content-length");

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
  await expect(measure(page, "Words")).toHaveText("3");
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
  await expect(
    page.getByRole("link", { name: "Return home", exact: true })
  ).toHaveAttribute("href", "/");
  expect(failedRequests).toBeGreaterThan(0);
  const noindex = page.locator('head meta[name="robots"][content="noindex"]');
  await expect(noindex).toHaveCount(1);

  failLoader = false;
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Code that knows where it runs." })
  ).toBeVisible();
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  expect(retriedRequests).toBeGreaterThan(0);
  await expect(noindex).toHaveCount(0);
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
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(analyzerFailure)).toBeVisible();
  await expect(page.getByText(serverText)).toHaveCount(0);
  await expect(input).toHaveValue(submittedText);
  await expect(input).toHaveAttribute("aria-invalid", "false");

  failAnalysis = false;
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(measure(page, "Words")).toHaveText("4");
  await expect(page.getByText(analyzerFailure)).toHaveCount(0);
});

test("keeps the submitted text read-only while the analysis is pending", async ({
  page,
}) => {
  // A route left unanswered holds its request until the test continues it.
  let holdAnalysis = false;
  let release: ((route: Route) => void) | undefined;

  // A deferred: Promise.withResolvers is ES2024, above the ES2023 lib that
  // tsconfig.json sets for the browser floor.
  // oxlint-disable-next-line promise/avoid-new
  const held = new Promise<Route>((resolve) => {
    release = resolve;
  });

  await page.route("**/_serverFn/**", async (route) => {
    if (holdAnalysis && route.request().method() === "POST") {
      release?.(route);
    } else {
      await route.continue();
    }
  });
  await page.goto("/runtime");
  await expect(page.getByText(/^client ·/u)).toBeVisible();
  const input = page.getByRole("textbox", { name: "Text to analyze" });
  const submit = page.getByRole("button", { name: "Analyze on the server" });
  await input.fill("   ");
  await submit.click();
  await expect(page.getByText(textInputErrors.blank)).toBeVisible();

  holdAnalysis = true;
  const submittedText = "Held while pending";
  await input.fill(submittedText);
  await submit.click();
  await expect(page.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  await expect(page.getByText(textInputErrors.blank)).toHaveCount(0);
  await expect(input).not.toBeEditable();
  await input.focus();
  await page.keyboard.type(" and more");
  await expect(input).toHaveValue(submittedText);

  const heldRequest = await held;
  await heldRequest.continue();
  await expect(measure(page, "Words")).toHaveText("3");
  await expect(input).toHaveValue(submittedText);
  await expect(input).toBeEditable();
});

test("copies the home page command through the real clipboard", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");

  await page.getByRole("button", { name: "Copy pnpm validate" }).click();

  await expect(page.getByText("Copied to clipboard")).toBeAttached();
  // The announcement follows the finished write, so the text is there now.
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe("pnpm validate");
});

test("announces a manual fallback when the clipboard refuses", async ({
  page,
}) => {
  // A Permissions-Policy that disallows clipboard writes makes the write
  // reject in any browser state, so the test does not rely on defaults.
  await page.route("/", async (route) => {
    const response = await route.fetch();

    await route.fulfill({
      headers: {
        ...response.headers(),
        "permissions-policy": "clipboard-write=()",
      },
      response,
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Copy pnpm validate" }).click();

  await expect(
    page.getByText("Could not copy. Select the command to copy it manually.")
  ).toBeAttached();
});

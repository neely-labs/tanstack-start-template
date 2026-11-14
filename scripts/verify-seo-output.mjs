// Checks the production build for `pnpm seo:verify`: each public page's
// metadata and structured data through `checkPageHtml`, which the fixtures in
// `verify-seo-output.test.ts` and the browser smoke test also call, then the
// sitemap, robots.txt, manifest and social image.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { z } from "zod";

import { publicPaths } from "../src/lib/public-routes.ts";
import { webPageTypes } from "../src/lib/seo.ts";
import { siteConfig } from "../src/lib/site-config.ts";
import { generatedSiteFiles } from "../src/lib/site-files.ts";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// The card types X documents; any other value renders no card.
const twitterCards = new Set([
  "app",
  "player",
  "summary",
  "summary_large_image",
]);
const ldJsonSelector = 'script[type="application/ld+json"]';
const twitterCardSelector = 'meta[name="twitter:card"]';
// What `createGraph` emits; page nodes are then picked out by their `@type`.
const graphSchema = z.object({
  "@graph": z.array(
    z.looseObject({
      "@id": z.unknown(),
      "@type": z.unknown(),
      url: z.unknown(),
    })
  ),
});

/**
 * @param {string} routePath Public route path.
 * @param {string} tag Selector naming the element at fault.
 * @param {string} problem What is wrong with it.
 * @returns {never} Never returns; always throws.
 */
function fail(routePath, tag, problem) {
  throw new Error(`${routePath}: ${tag} ${problem}`);
}

/**
 * @param {Document} document Parsed page.
 * @param {string} routePath Public route path.
 * @param {string} selector Selector that must match exactly one element.
 */
function exactlyOne(document, routePath, selector) {
  const found = document.querySelectorAll(selector);
  if (found.length !== 1) {
    fail(routePath, selector, `appears ${found.length} times, expected 1`);
  }
  return found[0];
}

/**
 * @param {Document} document Parsed page.
 * @param {string} routePath Public route path.
 * @param {string} selector Selector that must match exactly one element.
 * @param {string} attribute Attribute read from that element.
 * @returns {string} The attribute's value, which must not be empty.
 */
function attributeOf(document, routePath, selector, attribute) {
  const value = exactlyOne(document, routePath, selector).getAttribute(
    attribute
  );
  if (value === null || value.trim() === "") {
    fail(routePath, selector, `has no ${attribute}`);
  }
  return value;
}

/**
 * @param {Document} document Parsed page.
 * @param {string} routePath Public route path.
 * @param {string} selector Selector that must match exactly one element.
 * @param {string} attribute Attribute read from that element.
 * @param {string} expected Value the attribute must hold.
 */
function expectAttribute(document, routePath, selector, attribute, expected) {
  const value = attributeOf(document, routePath, selector, attribute);
  if (value !== expected) {
    fail(
      routePath,
      selector,
      `${attribute} is "${value}", expected "${expected}"`
    );
  }
}

/**
 * @param {Document} document Parsed page.
 * @param {string} routePath Public route path.
 * @param {string} pageUrl Absolute URL the page node must carry.
 */
function checkStructuredData(document, routePath, pageUrl) {
  const text =
    exactlyOne(document, routePath, ldJsonSelector).textContent ?? "";
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(routePath, ldJsonSelector, "is not valid JSON");
  }
  const parsed = graphSchema.safeParse(data);
  if (!parsed.success) {
    fail(routePath, ldJsonSelector, "has no @graph array of nodes");
  }
  const pages = parsed.data["@graph"].filter((node) =>
    webPageTypes.some((pageType) => pageType === node["@type"])
  );
  if (pages.length !== 1) {
    fail(
      routePath,
      ldJsonSelector,
      `has ${pages.length} page nodes (${webPageTypes.join(", ")}), expected 1`
    );
  }
  const [page] = pages;
  for (const [key, expected] of [
    ["url", pageUrl],
    ["@id", `${pageUrl}#webpage`],
  ]) {
    if (page?.[key] !== expected) {
      fail(
        routePath,
        ldJsonSelector,
        `page ${key} is ${JSON.stringify(page?.[key])}, expected "${expected}"`
      );
    }
  }
}

/**
 * Checks one prerendered public page: every tag `createSeoHead` emits is
 * present once and carries this page's values, not another page's. Throws an
 * Error naming the route and the tag at fault.
 *
 * @param {string} html The page's HTML.
 * @param {string} routePath Public route path the HTML was rendered for.
 * @returns {{ description: string, title: string }} Text for uniqueness checks.
 */
export function checkPageHtml(html, routePath) {
  const { document } = new JSDOM(html).window;
  // Built by concatenation rather than `absoluteUrl`, so a bug in the helper
  // under test cannot also shape what it is checked against.
  const pageUrl = `${siteConfig.origin}${routePath}`;
  const imageUrl = `${siteConfig.origin}${siteConfig.socialImage.path}`;

  const title =
    exactlyOne(document, routePath, "title").textContent?.trim() ?? "";
  if (title === "") {
    fail(routePath, "title", "is empty");
  }
  const description = attributeOf(
    document,
    routePath,
    'meta[name="description"]',
    "content"
  );
  if (document.querySelector("h1") === null) {
    fail(routePath, "h1", "is missing from the server-rendered HTML");
  }

  const { height, type, width } = siteConfig.socialImage;
  for (const [selector, attribute, expected] of [
    ['link[rel="canonical"]', "href", pageUrl],
    ['meta[property="og:url"]', "content", pageUrl],
    ['meta[property="og:title"]', "content", title],
    ['meta[property="og:image"]', "content", imageUrl],
    ['meta[property="og:image:type"]', "content", type],
    ['meta[property="og:image:width"]', "content", String(width)],
    ['meta[property="og:image:height"]', "content", String(height)],
    ['meta[name="twitter:image"]', "content", imageUrl],
  ]) {
    expectAttribute(document, routePath, selector, attribute, expected);
  }
  const card = attributeOf(document, routePath, twitterCardSelector, "content");
  if (!twitterCards.has(card)) {
    fail(
      routePath,
      twitterCardSelector,
      `content "${card}" is not a card type`
    );
  }
  checkStructuredData(document, routePath, pageUrl);

  return { description, title };
}

/** @param {string} routePath Public route path. */
function htmlOutputPath(routePath) {
  return path.resolve(
    ".output/public",
    routePath === "/" ? "index.html" : `${routePath.slice(1)}/index.html`
  );
}

function verifyBuildOutput() {
  const pageTitles = new Set();
  const pageDescriptions = new Set();
  for (const routePath of publicPaths) {
    const page = checkPageHtml(
      readFileSync(htmlOutputPath(routePath), "utf-8"),
      routePath
    );
    pageTitles.add(page.title);
    pageDescriptions.add(page.description);
  }
  assert.equal(
    pageTitles.size,
    publicPaths.length,
    "Page titles must be unique"
  );
  assert.equal(
    pageDescriptions.size,
    publicPaths.length,
    "Page descriptions must be unique"
  );

  const sitemap = readFileSync(".output/public/sitemap.xml", "utf-8");
  assert.equal(sitemap.match(/<loc>/gu)?.length ?? 0, publicPaths.length);
  for (const routePath of publicPaths) {
    assert.ok(sitemap.includes(`<loc>${siteConfig.origin}${routePath}</loc>`));
  }

  const robots = readFileSync(".output/public/robots.txt", "utf-8");
  assert.ok(robots.includes(`Sitemap: ${siteConfig.origin}/sitemap.xml`));

  // The manifest, robots.txt, and sitemap are generated from site identity and
  // public route visibility at build time. Compare the emitted bytes with what
  // the config produces now, so a stale or missing emission fails here rather
  // than reaching production.
  for (const [fileName, file] of Object.entries(generatedSiteFiles)) {
    assert.equal(
      readFileSync(path.resolve(".output/public", fileName), "utf-8"),
      file.source,
      `${fileName} must match site-config.ts`
    );
  }

  const socialImage = readFileSync(
    path.resolve(".output/public", siteConfig.socialImage.path.slice(1))
  );
  assert.ok(
    socialImage.subarray(0, pngSignature.length).equals(pngSignature),
    "Social image must be a PNG"
  );
  assert.equal(
    socialImage.readUInt32BE(16),
    siteConfig.socialImage.width,
    "Social image width"
  );
  assert.equal(
    socialImage.readUInt32BE(20),
    siteConfig.socialImage.height,
    "Social image height"
  );

  console.log(`Verified SEO output for ${publicPaths.length} public pages.`);
}

if (import.meta.main) {
  verifyBuildOutput();
}

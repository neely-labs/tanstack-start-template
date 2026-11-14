import { describe, expect, it } from "vitest";

import { siteConfig } from "../src/lib/site-config.ts";
import { checkPageHtml } from "./verify-seo-output.mjs";

const { origin, socialImage } = siteConfig;
const pageUrl = `${origin}/runtime`;
const imageUrl = `${origin}${socialImage.path}`;

// The shape `createSeoHead` and React emit for `/runtime`, cut to the tags
// `checkPageHtml` reads.
const valid = `<!DOCTYPE html><html lang="en-US"><head>
<title>Runtime | Example</title>
<meta content="How the runtime works." name="description"/>
<meta content="Runtime | Example" property="og:title"/>
<meta content="${pageUrl}" property="og:url"/>
<meta content="${imageUrl}" property="og:image"/>
<meta content="${socialImage.type}" property="og:image:type"/>
<meta content="${socialImage.width}" property="og:image:width"/>
<meta content="${socialImage.height}" property="og:image:height"/>
<meta content="summary_large_image" name="twitter:card"/>
<meta content="${imageUrl}" name="twitter:image"/>
<link href="${pageUrl}" rel="canonical"/>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@id": `${origin}/#website`, "@type": "WebSite", url: `${origin}/` },
    { "@id": `${pageUrl}#webpage`, "@type": "WebPage", url: pageUrl },
  ],
})}</script>
</head><body><h1>Runtime</h1></body></html>`;

/** Applies one edit to the valid page, failing if the edit matched nothing. */
function broken(find: string | RegExp, replace: string) {
  const html = valid.replace(find, replace);
  expect(html).not.toBe(valid);
  return html;
}

describe(checkPageHtml, () => {
  it("accepts a page whose tags carry its own URL and the social image", () => {
    expect(checkPageHtml(valid, "/runtime")).toStrictEqual({
      description: "How the runtime works.",
      title: "Runtime | Example",
    });
  });

  it.each([
    {
      failure: "a canonical link on another origin",
      html: () =>
        broken(
          `<link href="${pageUrl}" rel="canonical"/>`,
          `<link href="https://elsewhere.example/runtime" rel="canonical"/><link href="${pageUrl}" rel="alternate"/>`
        ),
      tag: 'link[rel="canonical"]',
    },
    {
      failure: "a canonical link for another page",
      html: () => broken(`href="${pageUrl}"`, `href="${origin}/setup"`),
      tag: 'link[rel="canonical"]',
    },
    {
      failure: "an og:url for another page",
      html: () =>
        broken(
          `content="${pageUrl}" property="og:url"`,
          `content="${origin}/setup" property="og:url"`
        ),
      tag: 'meta[property="og:url"]',
    },
    {
      failure: "a missing og:image",
      html: () =>
        broken(`<meta content="${imageUrl}" property="og:image"/>`, ""),
      tag: 'meta[property="og:image"]',
    },
    {
      failure: "image dimensions only in unrelated tags",
      html: () =>
        broken(
          `<meta content="${socialImage.width}" property="og:image:width"/>`,
          `<meta content="1" property="og:image:width"/><meta content="${socialImage.width}" name="unrelated"/>`
        ),
      tag: 'meta[property="og:image:width"]',
    },
    {
      failure: "a missing og:image:height",
      html: () =>
        broken(
          `<meta content="${socialImage.height}" property="og:image:height"/>`,
          ""
        ),
      tag: 'meta[property="og:image:height"]',
    },
    {
      failure: "an og:title that differs from the title",
      html: () =>
        broken(
          'content="Runtime | Example" property',
          'content="Setup | Example" property'
        ),
      tag: 'meta[property="og:title"]',
    },
    {
      failure: "an invalid Twitter card value",
      html: () =>
        broken('content="summary_large_image"', 'content="huge_card"'),
      tag: 'meta[name="twitter:card"]',
    },
    {
      failure: "an empty JSON-LD object",
      html: () => broken(/(?<=ld\+json">).*?(?=<\/script>)/su, "{}"),
      tag: 'script[type="application/ld+json"]',
    },
    {
      failure: "JSON-LD that does not parse",
      html: () => broken(/(?<=ld\+json">).*?(?=<\/script>)/su, "{"),
      tag: 'script[type="application/ld+json"]',
    },
    {
      failure: "a JSON-LD page node for another page",
      html: () => broken(`"url":"${pageUrl}"`, `"url":"${origin}/setup"`),
      tag: 'script[type="application/ld+json"]',
    },
    {
      failure: "a duplicated description",
      html: () =>
        broken(
          "</head>",
          '<meta content="Another." name="description"/></head>'
        ),
      tag: 'meta[name="description"]',
    },
    {
      failure: "no server-rendered heading",
      html: () => broken("<h1>Runtime</h1>", ""),
      tag: "h1",
    },
  ])("rejects $failure, naming the route and the tag", ({ html, tag }) => {
    const page = html();
    expect(() => checkPageHtml(page, "/runtime")).toThrow(`/runtime: ${tag} `);
  });
});

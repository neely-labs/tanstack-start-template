import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  createGraph,
  createSeoHead,
  createWebPageSchema,
  createWebsiteSchema,
  pageTitle,
} from "./seo.ts";
import { siteConfig } from "./site-config.ts";

describe(pageTitle, () => {
  it("suffixes a page name with the configured site name", () => {
    expect(pageTitle("About")).toBe(`About | ${siteConfig.name}`);
  });

  it("returns the site name alone when no page name is given", () => {
    expect(pageTitle()).toBe(siteConfig.name);
  });
});

describe("SEO helpers", () => {
  it("builds canonical URLs from the configured public origin", () => {
    expect(absoluteUrl("/about")).toBe(`${siteConfig.origin}/about`);
  });

  it("keeps visible and social metadata aligned", () => {
    const head = createSeoHead({
      canonicalPath: "/about",
      description: "Template decisions and replacement points.",
      title: pageTitle("About"),
    });

    expect(head.links).toContainEqual({
      href: `${siteConfig.origin}/about`,
      rel: "canonical",
    });
    expect(head.meta).toContainEqual({
      content: pageTitle("About"),
      property: "og:title",
    });
    expect(head.meta).toContainEqual({
      content: `${siteConfig.origin}${siteConfig.socialImage.path}`,
      property: "og:image",
    });
    expect(head.meta).toContainEqual({
      content: `${siteConfig.socialImage.width}`,
      property: "og:image:width",
    });
  });

  it("connects a page to its website graph", () => {
    const graph = createGraph([
      createWebsiteSchema(),
      createWebPageSchema({
        description: "Template decisions.",
        name: "About",
        path: "/about",
        type: "AboutPage",
      }),
    ]);

    expect(graph["@graph"]).toHaveLength(2);
  });
});

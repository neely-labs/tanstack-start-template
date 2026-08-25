import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  createGraph,
  createSeoHead,
  createWebPageSchema,
  createWebsiteSchema,
  pageTitle,
} from "./seo.ts";

describe(pageTitle, () => {
  it("suffixes a page name with the configured site name", () => {
    expect(pageTitle("About")).toBe("About | TanStack Start Template");
  });

  it("returns the site name alone when no page name is given", () => {
    expect(pageTitle()).toBe("TanStack Start Template");
  });
});

describe("SEO helpers", () => {
  it("builds canonical URLs from the configured public origin", () => {
    expect(absoluteUrl("/about")).toBe("https://example.com/about");
  });

  it("keeps visible and social metadata aligned", () => {
    const head = createSeoHead({
      canonicalPath: "/about",
      description: "Template decisions and replacement points.",
      title: pageTitle("About"),
    });

    expect(head.links).toContainEqual({
      href: "https://example.com/about",
      rel: "canonical",
    });
    expect(head.meta).toContainEqual({
      content: pageTitle("About"),
      property: "og:title",
    });
    expect(head.meta).toContainEqual({
      content: "https://example.com/social-card.png",
      property: "og:image",
    });
    expect(head.meta).toContainEqual({
      content: "1200",
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

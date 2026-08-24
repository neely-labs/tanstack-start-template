import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  createGraph,
  createSeoHead,
  createWebPageSchema,
  createWebsiteSchema,
} from "./seo.ts";

describe("SEO helpers", () => {
  it("builds canonical URLs from the configured public origin", () => {
    expect(absoluteUrl("/about")).toBe("https://example.com/about");
  });

  it("keeps visible and social metadata aligned", () => {
    const head = createSeoHead({
      canonicalPath: "/about",
      description: "Template decisions and replacement points.",
      title: "About | TanStack Start Template",
    });

    expect(head.links).toContainEqual({
      href: "https://example.com/about",
      rel: "canonical",
    });
    expect(head.meta).toContainEqual({
      content: "About | TanStack Start Template",
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

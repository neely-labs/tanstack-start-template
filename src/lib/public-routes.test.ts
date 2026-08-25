import { describe, expect, it } from "vitest";

import { publicPaths } from "./public-routes.ts";

describe("public route inventory", () => {
  it("uses paths that join onto the canonical origin without rewriting", () => {
    // The sitemap and `scripts/verify-seo-output.mjs` build canonical URLs by
    // concatenating `siteConfig.origin` with these paths, so a missing leading
    // slash or a trailing slash yields URLs that never match rendered output.
    for (const routePath of publicPaths) {
      expect(routePath.startsWith("/")).toBeTruthy();
      expect(routePath !== "/" && routePath.endsWith("/")).toBeFalsy();
    }
  });
});

import { describe, expect, it } from "vitest";

import { publicPaths } from "./public-routes.ts";
import { siteConfig } from "./site-config.ts";
import { generatedSiteFiles } from "./site-files.ts";

describe("generated site files", () => {
  it("emits exactly the public route inventory in the sitemap", () => {
    const sitemap = generatedSiteFiles["sitemap.xml"];

    expect(sitemap.contentType).toBe("application/xml; charset=utf-8");
    expect(sitemap.source).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    );
    expect(sitemap.source.match(/<loc>/gu)).toHaveLength(publicPaths.length);
    for (const routePath of publicPaths) {
      expect(sitemap.source).toContain(
        `<loc>${siteConfig.origin}${routePath}</loc>`
      );
    }
    expect(sitemap.source).not.toContain("/api/health");
  });

  it("keeps robots and the manifest aligned with site identity", () => {
    expect(generatedSiteFiles["robots.txt"].source).toContain(
      `Sitemap: ${siteConfig.origin}/sitemap.xml`
    );
    expect(
      JSON.parse(generatedSiteFiles["manifest.json"].source)
    ).toMatchObject({
      description: siteConfig.description,
      name: siteConfig.name,
      short_name: siteConfig.shortName,
    });
  });
});

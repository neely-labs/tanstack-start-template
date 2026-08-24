import { describe, expect, it } from "vitest";

import { siteConfig } from "./site-config.ts";

describe("site config", () => {
  it("uses an absolute canonical origin without a trailing slash", () => {
    expect(new URL(siteConfig.origin).protocol).toBe("https:");
    expect(siteConfig.origin.endsWith("/")).toBeFalsy();
  });

  it("describes a standard raster social image", () => {
    expect(siteConfig.socialImage).toMatchObject({
      height: 630,
      path: "/social-card.png",
      type: "image/png",
      width: 1200,
    });
  });
});

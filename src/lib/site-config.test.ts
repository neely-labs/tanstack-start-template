import { describe, expect, it } from "vitest";

import { siteConfig } from "./site-config.ts";

describe("site config", () => {
  it("uses an absolute canonical origin without a trailing slash", () => {
    expect(new URL(siteConfig.origin).protocol).toBe("https:");
    expect(siteConfig.origin.endsWith("/")).toBeFalsy();
  });

  it("describes a standard raster social image", () => {
    const { height, path, type, width } = siteConfig.socialImage;
    expect([height, width].every(Number.isInteger)).toBeTruthy();
    expect(height).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(0);
    expect(path).toMatch(/^\/(?!\/).+\.png$/u);
    expect(type).toBe("image/png");
  });
});

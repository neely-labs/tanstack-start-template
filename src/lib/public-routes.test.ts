import { describe, expect, it } from "vitest";

import { publicPaths } from "./public-routes.ts";

describe("public route inventory", () => {
  it("contains each prerendered route once", () => {
    expect(new Set(publicPaths).size).toBe(publicPaths.length);
  });
});

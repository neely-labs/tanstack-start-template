import { describe, expect, it } from "vitest";

import { buttonVariants } from "./button.tsx";

describe(buttonVariants, () => {
  // A link styled with these classes gets no other merge, so a variant that
  // overrides the base, as outline does its border, must win here.
  it("lets a variant's classes replace the base's", () => {
    const classes = buttonVariants({ variant: "outline" }).split(" ");
    expect(classes).toContain("border-border");
    expect(classes).not.toContain("border-transparent");
  });
});

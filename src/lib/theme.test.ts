import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { themeScript } from "./theme.ts";

/** Runs the shipped pre-paint script against a minimal browser stand-in. */
function resolveTheme({
  prefersDark,
  readStored,
}: {
  prefersDark: boolean;
  readStored: () => string | null;
}) {
  const classes = new Set<string>();
  runInNewContext(themeScript, {
    document: {
      documentElement: {
        classList: {
          toggle: (name: string, force: boolean) => {
            if (force) {
              classes.add(name);
            } else {
              classes.delete(name);
            }
          },
        },
      },
    },
    localStorage: { getItem: readStored },
    matchMedia: () => ({ matches: prefersDark }),
  });
  return classes.has("dark");
}

describe("theme script", () => {
  it("prefers a stored choice over the system preference", () => {
    expect(
      resolveTheme({ prefersDark: true, readStored: () => "light" })
    ).toBeFalsy();
  });

  it("falls back to the system preference when storage is blocked", () => {
    expect(
      resolveTheme({
        prefersDark: true,
        readStored: () => {
          throw new Error("blocked");
        },
      })
    ).toBeTruthy();
  });
});

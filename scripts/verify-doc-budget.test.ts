import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { check } from "./verify-doc-budget.ts";

const temporary: string[] = [];

/** A directory holding the given files, keyed by relative path. */
function tree(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(tmpdir(), "doc-budget-"));
  temporary.push(root);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

describe(check, () => {
  afterEach(() => {
    for (const dir of temporary.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  it("passes a set within both caps and reports each file's bytes", () => {
    const root = tree({ "A.md": "aaaa", "docs/b.md": "bb" });
    const result = check(
      { docs: ["A.md", "docs/*.md"], fileBytes: 10, totalBytes: 10 },
      root
    );
    expect(result.problems).toStrictEqual([]);
    expect([...result.sizes]).toStrictEqual([
      ["A.md", 4],
      ["docs/b.md", 2],
    ]);
  });

  it("fails one oversized file even when the total is within its cap", () => {
    const root = tree({ "big.md": "x".repeat(11), "small.md": "y" });
    const { problems } = check(
      { docs: ["big.md", "small.md"], fileBytes: 10, totalBytes: 100 },
      root
    );
    expect(problems).toStrictEqual(["big.md: 11 bytes, file cap 10"]);
  });

  it("fails a total over its cap even when every file is within", () => {
    const root = tree({ "a.md": "x".repeat(6), "b.md": "y".repeat(6) });
    const { problems } = check(
      { docs: ["*.md"], fileBytes: 10, totalBytes: 10 },
      root
    );
    expect(problems).toStrictEqual(["total: 12 bytes, total cap 10"]);
  });

  it("counts only the named sections, summed under their file", () => {
    const product = [
      "# Product",
      "## Users",
      "skip me",
      "## Purpose",
      "keep",
      "### Detail",
      "kept too",
      "## Invariants",
      "",
      "## Positioning",
      "skip me too",
    ].join("\n");
    const root = tree({ "PRODUCT.md": product });
    const { problems, sizes } = check(
      {
        docs: ["PRODUCT.md#Purpose", "PRODUCT.md#Invariants"],
        fileBytes: 100,
        totalBytes: 100,
      },
      root
    );
    expect(problems).toStrictEqual([]);
    // "## Purpose\nkeep\n### Detail\nkept too\n" + "## Invariants\n\n"
    expect([...sizes]).toStrictEqual([["PRODUCT.md", 36 + 15]]);
  });

  it("keeps counting past heading-like lines inside a code fence", () => {
    const text = "## Purpose\n```sh\n# a comment\n```\nkept\n## Next\nskip\n";
    const root = tree({ "P.md": text });
    const { sizes } = check(
      { docs: ["P.md#Purpose"], fileBytes: 100, totalBytes: 100 },
      root
    );
    // Everything before "## Next": 11 + 6 + 12 + 4 + 5 bytes.
    expect([...sizes]).toStrictEqual([["P.md", 38]]);
  });

  it("closes a fence only with a matching marker at least as long", () => {
    const text = [
      "## Purpose",
      "````md",
      "```",
      "## Inside",
      "~~~~",
      "````",
      "kept",
      "## Next",
      "skip",
    ].join("\n");
    const root = tree({ "P.md": text });
    const { sizes } = check(
      { docs: ["P.md#Purpose"], fileBytes: 100, totalBytes: 100 },
      root
    );
    // Everything before "## Next": 11 + 7 + 4 + 10 + 5 + 5 + 5 bytes.
    expect([...sizes]).toStrictEqual([["P.md", 47]]);
  });

  it("fails an entry that matches no file or no section", () => {
    const root = tree({ "PRODUCT.md": "# Product\n## Users\n" });
    const { problems } = check(
      {
        docs: ["AGENTS.md", "docs/agents/*.md", "PRODUCT.md#Purpose"],
        fileBytes: 100,
        totalBytes: 100,
      },
      root
    );
    expect(problems).toStrictEqual([
      "AGENTS.md matches no file",
      "docs/agents/*.md matches no file",
      'PRODUCT.md has no "## Purpose" section',
    ]);
  });
});

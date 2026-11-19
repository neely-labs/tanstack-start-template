import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { fixtureEnv } from "./git.test-utils.ts";
import { changedRanges, listComments } from "./list-comments.ts";

const base = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), "list-comments-"))
);

const env = fixtureEnv(base);

function write(dir: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
}

function repositoryOnFeatureBranch(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(base, "repository-"));

  const run = (...args: string[]) =>
    execFileSync("git", ["-C", dir, ...args], { env, stdio: "pipe" });

  run("init", "-q", "-b", "main");
  write(dir, files);
  run("add", ".");
  run("commit", "-q", "-m", "base");
  run("switch", "-q", "-c", "feature");

  return { dir, run };
}

describe(changedRanges, () => {
  it("reads new-side ranges and skips deletions and removed files", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,0 +2,3 @@",
      "@@ -9 +12 @@",
      "@@ -20,2 +22,0 @@",
      "diff --git a/gone.ts b/gone.ts",
      "--- a/gone.ts",
      "+++ /dev/null",
      "@@ -1,4 +0,0 @@",
    ].join("\n");

    expect([...changedRanges(diff)]).toStrictEqual([
      [
        "a.ts",
        [
          { end: 4, start: 2 },
          { end: 12, start: 12 },
        ],
      ],
    ]);
  });
});

describe(listComments, () => {
  afterAll(() => {
    fs.rmSync(base, { force: true, recursive: true });
  });

  it("lists comments on changed lines, untracked files included, and not older ones", () => {
    const { dir, run } = repositoryOnFeatureBranch({
      "src/a.ts": "// An older note.\nexport const a = 1;\n",
    });

    write(dir, {
      "src/a.ts":
        "// An older note.\nexport const a = 1;\n\n// Adds one to a.\nexport const b = a + 1;\n",
    });
    run("commit", "-q", "-am", "add b");
    write(dir, { "src/c.ts": "/**\n * Narrates c.\n */\nconst c = 3;\n" });

    expect(listComments({ cwd: dir, env })).toStrictEqual([
      { file: "src/a.ts", line: 4, text: "// Adds one to a." },
      { file: "src/c.ts", line: 1, text: "/**\n * Narrates c.\n */" },
    ]);
  });

  it("lists nothing when the changed lines hold no comment", () => {
    const { dir, run } = repositoryOnFeatureBranch({
      "src/a.ts": "// An older note.\nexport const a = 1;\n",
    });

    write(dir, { "src/a.ts": "// An older note.\nexport const a = 2;\n" });
    run("commit", "-q", "-am", "change a");

    expect(listComments({ cwd: dir, env })).toStrictEqual([]);
  });

  it("measures from the given base instead of main", () => {
    const { dir, run } = repositoryOnFeatureBranch({
      "src/a.ts": "export const a = 1;\n",
    });

    write(dir, { "src/a.ts": "// First.\nexport const a = 1;\n" });
    run("commit", "-q", "-am", "first");
    run("tag", "first");
    write(dir, { "src/b.ts": "// Second.\nexport const b = 2;\n" });
    run("add", ".");
    run("commit", "-q", "-m", "second");

    expect(
      listComments({ cwd: dir, env }).map((comment) => comment.text)
    ).toStrictEqual(["// First.", "// Second."]);
    expect(
      listComments({ base: "first", cwd: dir, env }).map(
        (comment) => comment.text
      )
    ).toStrictEqual(["// Second."]);
  });

  it("fails on a base that does not exist", () => {
    const { dir } = repositoryOnFeatureBranch({
      "src/a.ts": "export const a = 1;\n",
    });

    expect(() => listComments({ base: "missing", cwd: dir, env })).toThrow(
      /merge-base/u
    );
  });
});

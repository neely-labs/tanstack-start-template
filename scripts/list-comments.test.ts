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
  it("reads new-side ranges per section and skips pure deletions", () => {
    const patch = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,0 +2,3 @@",
      "+++ an added line that looks like a header",
      "@@ -9 +12 @@",
      "@@ -20,2 +22,0 @@",
      'diff --git "a/caf\\303\\251 b.ts" "b/caf\\303\\251 b.ts"',
      '+++ "b/caf\\303\\251 b.ts"',
      "@@ -0,0 +1 @@",
    ].join("\n");

    expect([...changedRanges(patch, ["a.ts", "café b.ts"])]).toStrictEqual([
      [
        "a.ts",
        [
          { end: 4, start: 2 },
          { end: 12, start: 12 },
        ],
      ],
      ["café b.ts", [{ end: 1, start: 1 }]],
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
    write(dir, {
      "src/c.ts": "/**\n * Narrates c.\n */\nconst c = 3;\n",
      "src/d.cts": "// In a CommonJS module.\nexport const d = 4;\n",
    });

    expect(listComments({ cwd: dir, env })).toStrictEqual([
      { file: "src/a.ts", line: 4, text: "// Adds one to a." },
      { file: "src/c.ts", line: 1, text: "/**\n * Narrates c.\n */" },
      { file: "src/d.cts", line: 1, text: "// In a CommonJS module." },
    ]);
  });

  it("lists every comment kind, joins // runs, and keeps text after non-ASCII", () => {
    const { dir, run } = repositoryOnFeatureBranch({
      "src/accents.ts": "export const a = 1;\n",
    });

    write(dir, {
      "src/accents.ts":
        'export const a = "ééé日本語";\n// One thought\n// over two lines.\nexport const b = 2;\n',
      "src/café b.ts":
        "/** Exported doc. */\nexport const c = 3;\n// WARNING: a footgun.\nexport const d = 4;\n",
    });
    run("add", ".");
    run("commit", "-q", "-m", "comments");

    expect(listComments({ cwd: dir, env })).toStrictEqual([
      {
        file: "src/accents.ts",
        line: 2,
        text: "// One thought\n// over two lines.",
      },
      { file: "src/café b.ts", line: 1, text: "/** Exported doc. */" },
      { file: "src/café b.ts", line: 3, text: "// WARNING: a footgun." },
    ]);
  });

  it("prints the comments and exits 0 when run as a script", () => {
    const { dir, run } = repositoryOnFeatureBranch({
      "src/a.ts": "export const a = 1;\n",
    });

    const script = (...args: string[]) =>
      execFileSync(
        process.execPath,
        [path.join(import.meta.dirname, "list-comments.ts"), ...args],
        { cwd: dir, encoding: "utf-8", env }
      );

    expect(script()).toBe("No comments on changed lines.\n");

    write(dir, { "src/a.ts": "// Narrates a.\nexport const a = 1;\n" });
    run("commit", "-q", "-am", "comment");

    expect(script()).toMatch(
      /^src\/a\.ts:1\n {2}\/\/ Narrates a\.\n1 comment/u
    );
  });

  it("skips an unchanged comment between two edits, whatever Git's hunk settings", () => {
    const { dir, run } = repositoryOnFeatureBranch({
      "src/a.ts": "export const a = 1;\n// Between.\nexport const b = 2;\n",
    });

    run("config", "diff.interHunkContext", "10");
    write(dir, {
      "src/a.ts": "export const a = 10;\n// Between.\nexport const b = 20;\n",
    });

    expect(listComments({ cwd: dir, env })).toStrictEqual([]);
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

  it("fails on a file oxlint cannot parse", () => {
    const { dir } = repositoryOnFeatureBranch({
      "src/a.ts": "export const a = 1;\n",
    });

    write(dir, { "src/bad.mts": "const = ;\n// Lost.\n" });

    expect(() => listComments({ cwd: dir, env })).toThrow(
      /could not parse .*bad\.mts/u
    );
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

// `agent-tooling.ts` feeds the Oxlint and Oxfmt ignore lists, but TypeScript
// and Lefthook cannot import it, so `tsconfig.json` and `lefthook.yml` restate
// it. This test fails when a pattern reaches `agent-tooling.ts` only.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";

import {
  agentToolingIgnorePatterns,
  vendoredToolingIgnorePatterns,
} from "../agent-tooling.ts";

const root = path.join(import.meta.dirname, "..");
const patterns = [
  ...agentToolingIgnorePatterns,
  ...vendoredToolingIgnorePatterns,
];

/**
 * A file two levels inside the folder `pattern` names, such as
 * `.agents/sample/file.ts` for `**\/.agents`. Lefthook's default matcher needs
 * a file below the first level to match `<folder>/**\/*`.
 */
function sampleFile(pattern: string) {
  const folder = pattern.replace(/^\*\*\//u, "").replace(/\/\*\*$/u, "");
  if (/[*?[\]{}]/u.test(folder)) {
    throw new Error(`${pattern} does not name one folder; extend sampleFile`);
  }
  return `${folder}/sample/file.ts`;
}

/** Whether a pattern matches `file` or a folder above it, as TypeScript and Oxlint read excludes. */
function excludesFolder(excluded: string[], file: string) {
  const parts = file.split("/");
  const paths = parts.map((_, index) => parts.slice(0, index + 1).join("/"));
  return excluded.some((pattern) =>
    paths.some((candidate) => path.matchesGlob(candidate, pattern))
  );
}

/** The `exclude` list TypeScript resolves, comments and `extends` included. */
function tsconfigExclude() {
  const require = createRequire(import.meta.url);
  const tsc = path.join(
    path.dirname(require.resolve("typescript/package.json")),
    "bin/tsc"
  );
  const shown = execFileSync(process.execPath, [tsc, "--showConfig"], {
    cwd: root,
    encoding: "utf-8",
  });
  return z
    .object({ exclude: z.array(z.string()) })
    .parse(JSON.parse(shown))
    .exclude.map((pattern) => pattern.replace(/^\.\//u, ""));
}

const lefthookSchema = z.object({
  "pre-commit": z.object({
    jobs: z.array(
      z.object({
        exclude: z.union([z.string(), z.array(z.string())]).optional(),
        glob: z.string().optional(),
        name: z.string(),
      })
    ),
  }),
});

/** Each pre-commit job that runs on staged files, with its excludes. */
function lefthookJobs() {
  const config = lefthookSchema.parse(
    parse(fs.readFileSync(path.join(root, "lefthook.yml"), "utf-8"))
  );
  return config["pre-commit"].jobs
    .filter((job) => job.glob !== undefined)
    .map((job) => ({ exclude: [job.exclude ?? []].flat(), name: job.name }));
}

describe("agent tooling ignore patterns", () => {
  it.each(patterns)("%s is ignored where it applies", (pattern) => {
    expect(excludesFolder([pattern], sampleFile(pattern))).toBeTruthy();
  });

  it.each(patterns)("%s is excluded by tsconfig.json", (pattern) => {
    expect(excludesFolder(tsconfigExclude(), sampleFile(pattern))).toBeTruthy();
  });

  // Lefthook matches each staged file's own path, never a folder above it.
  it.each(patterns)("%s is excluded by each lefthook.yml job", (pattern) => {
    const file = sampleFile(pattern);
    const jobs = lefthookJobs();
    expect(jobs.length).toBeGreaterThan(0);
    const missing = jobs
      .filter(
        (job) => !job.exclude.some((glob) => path.matchesGlob(file, glob))
      )
      .map((job) => job.name);
    expect(missing).toStrictEqual([]);
  });
});

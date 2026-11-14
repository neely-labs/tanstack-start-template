// `agent-tooling.ts` feeds the Oxlint and Oxfmt ignore lists, but TypeScript
// and Lefthook cannot import it, so `tsconfig.json` and `lefthook.yml` restate
// it. This test asks each tool's own matcher whether it skips files in the
// folder each pattern names at the repository root, one and two levels down,
// and fails when a pattern reaches `agent-tooling.ts` only. TypeScript's
// wildcards skip dot-folders on their own, so only Lefthook needs those.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { z } from "zod";

import {
  agentToolingIgnorePatterns,
  vendoredToolingIgnorePatterns,
} from "../agent-tooling.ts";
import { fixtureEnv } from "./git-fixtures.ts";

const root = path.join(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const patterns = [
  ...agentToolingIgnorePatterns,
  ...vendoredToolingIgnorePatterns,
];
/** A file no pattern names, which every tool must still see. */
const control = "src/control.ts";

/** Files one and two levels inside the folder `pattern` names. */
function samples(pattern: string) {
  const folder = pattern.replace(/^\*\*\//u, "").replace(/\/\*\*$/u, "");
  if (/[*?[\]{}]/u.test(folder)) {
    throw new Error(`${pattern} does not name one folder; extend samples`);
  }
  return [`${folder}/file.ts`, `${folder}/sample/file.ts`];
}

const sampled = patterns.flatMap(samples);

const fixtures: string[] = [];

/** A fresh directory holding `files`, removed after the tests. */
function fixture(files: string[]) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "ignore-"))
  );
  fixtures.push(dir);
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), "export {};\n");
  }
  return dir;
}

/** The files TypeScript includes with a copy of `tsconfig.json` beside them. */
function typescriptFiles(files: string[]) {
  const dir = fixture(files);
  fs.copyFileSync(
    path.join(root, "tsconfig.json"),
    path.join(dir, "tsconfig.json")
  );
  const tsc = path.join(
    path.dirname(require.resolve("typescript/package.json")),
    "bin/tsc"
  );
  const shown = execFileSync(process.execPath, [tsc, "--showConfig"], {
    cwd: dir,
    encoding: "utf-8",
  });
  return z
    .object({ files: z.array(z.string()) })
    .parse(JSON.parse(shown))
    .files.map((file) => file.replace(/^\.\//u, ""));
}

const lefthookSchema = z.object({
  "pre-commit": z.object({
    jobs: z.array(
      z.looseObject({
        exclude: z.union([z.string(), z.array(z.string())]).optional(),
        glob: z.string().optional(),
        name: z.string(),
      })
    ),
  }),
});

/**
 * The staged files each pre-commit job in `lefthook.yml` would receive. Each
 * job keeps its `glob` and `exclude` but only prints its files.
 */
function lefthookFiles(files: string[]) {
  const { jobs } = lefthookSchema.parse(
    parse(fs.readFileSync(path.join(root, "lefthook.yml"), "utf-8"))
  )["pre-commit"];
  const echoes = jobs.map(({ exclude, glob }, index) => ({
    exclude,
    glob,
    run: `echo "job${index}: {staged_files}"`,
  }));
  const dir = fixture([]);
  const env = fixtureEnv(dir);
  execFileSync("git", ["init", "--quiet"], { cwd: dir, env });
  fs.writeFileSync(
    path.join(dir, "lefthook.yml"),
    stringify({ "pre-commit": { jobs: echoes } })
  );
  const lefthook = path.join(
    path.dirname(require.resolve("lefthook/package.json")),
    "bin/index.js"
  );
  const options = ["--no-auto-install", "--no-tty", "--colors", "off"];
  const named = files.flatMap((file) => ["--file", file]);
  const args = [lefthook, "run", "pre-commit", ...options, ...named];
  const output = execFileSync(process.execPath, args, {
    cwd: dir,
    encoding: "utf-8",
    env,
  });
  return jobs.map(({ name }, index) => ({
    files:
      new RegExp(`^job${index}: (.*)$`, "mu").exec(output)?.[1]?.split(" ") ??
      [],
    name,
  }));
}

describe("agent tooling ignore patterns", () => {
  afterAll(() => {
    for (const dir of fixtures.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  it("are skipped by tsconfig.json", () => {
    const included = typescriptFiles([control, ...sampled]);
    expect(included).toContain(control);
    expect(sampled.filter((file) => included.includes(file))).toStrictEqual([]);
  });

  it("are skipped by each lefthook.yml pre-commit job", () => {
    const jobs = lefthookFiles([control, ...sampled]);
    expect(jobs.length).toBeGreaterThan(0);
    const blind = jobs.filter(({ files }) => !files.includes(control));
    expect(blind.map(({ name }) => name)).toStrictEqual([]);
    const leaks = jobs.flatMap(({ files, name }) =>
      sampled
        .filter((file) => files.includes(file))
        .map((file) => `${name}: ${file}`)
    );
    expect(leaks).toStrictEqual([]);
  });
});

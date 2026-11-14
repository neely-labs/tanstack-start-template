// The vendored anti-slop rules in tools/oxlint/anti-slop run only through
// `oxlint.config.ts`. An Oxlint or `@oxlint/plugins` upgrade, or a config edit,
// could stop them matching without any other check failing, so this test lints
// one known violation per configured rule with the real config. The samples live
// in a temporary directory outside the repository, so no ignore pattern or
// file override applies to them.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";

import config from "../oxlint.config.ts";

const root = path.join(import.meta.dirname, "..");

/** One violation of each anti-slop rule, keyed by rule name. */
const samples = {
  "no-chained-type-assertions":
    'export const value = ("x" as unknown) as number;',
  "no-conditional-empty-object-spread":
    "export const build = (flag: boolean) => ({ ...(flag ? { a: 1 } : {}) });",
  "no-known-value-widening": 'export const label: unknown = "x";',
  "no-module-mocking": 'import { vi } from "vitest";\nvi.mock("./other.ts");',
  "no-object-parameters":
    "export const keys = (target: object) => Object.keys(target);",
  "no-reflect-apply":
    "export const call = (fn: () => number) => Reflect.apply(fn, undefined, []);",
  "no-reflect-get":
    'export const read = (target: Map<string, string>) => Reflect.get(target, "size");',
  "no-runtime-typeof":
    'export const isText = (value: string | number) => typeof value === "string";',
  "no-shape-in-symbol-names": "export const shapeless = 1;",
  "no-unknown-parameters":
    "export const echo = (input: unknown) => String(input);",
  "no-unknown-returns":
    "export function parse(text: string): unknown {\n  return JSON.parse(text);\n}",
  "no-unknown-type-aliases": "export type Payload = unknown;",
  "no-unsafe-dictionary-type":
    "export const table: Record<string, unknown> = {};",
  "no-widen-then-assert":
    'const wide: unknown = "x";\nexport const narrow = wide as string;',
  "require-safety-comment-for-type-assertion":
    "export const count = (1 as number) + 1;",
};

const reportSchema = z.object({
  diagnostics: z.array(z.object({ code: z.string(), filename: z.string() })),
});

/** Lints `files` with the repository's Oxlint config. */
function lint(files: string[]) {
  const require = createRequire(import.meta.url);
  const bin = path.join(
    path.dirname(require.resolve("oxlint/package.json")),
    "bin/oxlint"
  );
  const args = [bin, "-c", "oxlint.config.ts", "--format", "json", ...files];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf-8",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  return reportSchema.parse(JSON.parse(result.stdout)).diagnostics;
}

describe("anti-slop rules", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "anti-slop-"));

  afterAll(() => {
    fs.rmSync(dir, { force: true, recursive: true });
  });

  it("each have a sample", () => {
    const configured = Object.keys(config.rules ?? {})
      .filter((rule) => rule.startsWith("anti-slop/"))
      .map((rule) => rule.slice("anti-slop/".length));
    expect(configured.toSorted()).toStrictEqual(
      Object.keys(samples).toSorted()
    );
  });

  it("report each sample's violation", () => {
    const files = Object.entries(samples).map(([rule, source]) => {
      const file = path.join(dir, `${rule}.ts`);
      fs.writeFileSync(file, `${source}\n`);
      return file;
    });

    const reported = new Map<string, Set<string>>();
    for (const { code, filename } of lint(files)) {
      const rule = path.basename(filename, ".ts");
      reported.set(rule, (reported.get(rule) ?? new Set()).add(code));
    }
    const silent = Object.keys(samples).filter(
      (rule) => reported.get(rule)?.has(`anti-slop(${rule})`) !== true
    );
    expect(silent).toStrictEqual([]);
  });
});

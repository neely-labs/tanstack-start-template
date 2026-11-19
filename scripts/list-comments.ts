/**
 * Lists the comments a branch adds or changes, for the comment check in
 * docs/agents/delivery.md. Landmines' `no-comments` finds them: the script
 * turns the rule on for this oxlint run alone, through `LIST_COMMENTS`, and
 * keeps the comments that touch a line changed since the merge base, including
 * uncommitted and untracked files. Findings never fail the run; a bad base
 * does.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { z } from "zod";

import { gitEnv } from "./local.ts";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const LINT_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const RULE = "landmines-style(no-comments)";
const WHOLE_FILE = [{ end: Number.POSITIVE_INFINITY, start: 1 }];

interface LineRange {
  end: number;
  start: number;
}

export interface FlaggedComment {
  file: string;
  line: number;
  text: string;
}

const reportSchema = z.object({
  diagnostics: z.array(
    z.object({
      code: z.string(),
      filename: z.string(),
      labels: z.array(
        z.object({
          span: z.object({
            length: z.number(),
            line: z.number(),
            offset: z.number(),
          }),
        })
      ),
    })
  ),
});

/** The new-side line ranges of each file in `git diff -U0` output. */
export function changedRanges(diff: string) {
  const ranges = new Map<string, LineRange[]>();
  let current: LineRange[] | undefined;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4);

      current = target.startsWith("b/") ? [] : undefined;

      if (current) {
        ranges.set(target.slice(2), current);
      }

      continue;
    }

    const hunk = /^@@ -\S+ \+(?<start>\d+)(?:,(?<count>\d+))? @@/u.exec(line);

    if (current && hunk) {
      const start = Number(hunk.groups?.start);
      const count = Number(hunk.groups?.count ?? 1);

      if (count > 0) {
        current.push({ end: start + count - 1, start });
      }
    }
  }

  return ranges;
}

function git(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf-8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function changedLines(root: string, base: string, env: NodeJS.ProcessEnv) {
  const mergeBase = git(root, env, "merge-base", "HEAD", base).trim();

  const diff = git(
    root,
    env,
    "diff",
    "-U0",
    "--no-color",
    "--no-ext-diff",
    "--diff-filter=d",
    mergeBase
  );

  const ranges = changedRanges(diff);

  const untracked = git(
    root,
    env,
    "ls-files",
    "--others",
    "--exclude-standard"
  );

  for (const file of untracked.split("\n").filter(Boolean)) {
    ranges.set(file, WHOLE_FILE);
  }

  return ranges;
}

function lintComments(root: string, files: string[]) {
  const result = spawnSync(
    path.join(PROJECT_ROOT, "node_modules", ".bin", "oxlint"),
    [
      "--format",
      "json",
      "--no-error-on-unmatched-pattern",
      ...files.map((file) => path.join(root, file)),
    ],
    {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      env: { ...process.env, LIST_COMMENTS: "1" },
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  const report = reportSchema.parse(JSON.parse(result.stdout));
  const comments: FlaggedComment[] = [];

  for (const diagnostic of report.diagnostics) {
    if (diagnostic.code !== RULE) {
      continue;
    }

    const absolute = path.resolve(PROJECT_ROOT, diagnostic.filename);
    const source = fs.readFileSync(absolute, "utf-8");

    for (const { span } of diagnostic.labels) {
      comments.push({
        file: path.relative(root, absolute),
        line: span.line,
        text: source.slice(span.offset, span.offset + span.length),
      });
    }
  }

  return comments;
}

const touches = (comment: FlaggedComment, ranges: LineRange[]) => {
  const last = comment.line + comment.text.split("\n").length - 1;

  return ranges.some(
    (range) => comment.line <= range.end && last >= range.start
  );
};

/** The flagged comments on lines changed since the merge base with `base`. */
export function listComments(options: {
  base?: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
}) {
  const env = options.env ?? gitEnv;
  const root = git(options.cwd, env, "rev-parse", "--show-toplevel").trim();
  const ranges = changedLines(root, options.base ?? "main", env);

  const files = [...ranges.keys()].filter((file) =>
    LINT_EXTENSIONS.has(path.extname(file))
  );

  if (files.length === 0) {
    return [];
  }

  return lintComments(root, files)
    .filter((comment) => touches(comment, ranges.get(comment.file) ?? []))
    .toSorted((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function main(base: string | undefined) {
  let comments: FlaggedComment[];

  try {
    comments = listComments({ base, cwd: process.cwd() });
  } catch (error) {
    const stderr = z
      .object({ stderr: z.string().trim().min(1) })
      .safeParse(error).data?.stderr;

    console.error(stderr ?? String(error));
    process.exitCode = 1;

    return;
  }

  for (const comment of comments) {
    console.log(`${comment.file}:${comment.line}`);
    console.log(comment.text.replaceAll(/^/gmu, "  "));
  }

  console.log(
    comments.length === 0
      ? "No comments on changed lines."
      : `${comments.length} comment(s) on changed lines. Review each one as docs/agents/delivery.md#comment-check says.`
  );
}

if (import.meta.main) {
  main(process.argv[2]);
}

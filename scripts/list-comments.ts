/**
 * Lists the comments a branch adds or changes, for the comment check in
 * docs/agents/delivery.md. Landmines' `no-comments` finds them: `LIST_COMMENTS`
 * turns the rule on for this oxlint run alone, with no allowed prefixes and no
 * public-API exemption, so only functional directives are left out. A comment
 * is listed when it touches a line changed since the merge base, including
 * uncommitted and untracked files, and consecutive `//` lines are one comment.
 * Findings never fail the run; a bad base or a failed lint does.
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

/**
 * The new-side line ranges in a `git diff -U0` patch, keyed by `files`: the
 * same diff's `--name-only -z` list, which names the patch's sections in order
 * without Git's path quoting.
 */
export function changedRanges(patch: string, files: string[]) {
  const ranges = new Map<string, LineRange[]>();
  let current: LineRange[] | undefined;
  let section = -1;

  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      section += 1;
      current = [];
      ranges.set(files[section] ?? `#${section}`, current);

      continue;
    }

    const hunk = /^@@ -\S+ \+(?<start>\d+)(?:,(?<count>\d+))? @@/u.exec(line);
    const count = Number(hunk?.groups?.count ?? 1);

    if (current && hunk && count > 0) {
      const start = Number(hunk.groups?.start);

      current.push({ end: start + count - 1, start });
    }
  }

  return ranges;
}

function git(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf-8",
    env,
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const nulSeparated = (output: string) => output.split("\0").filter(Boolean);

function changedLines(root: string, base: string, env: NodeJS.ProcessEnv) {
  const mergeBase = git(root, env, "merge-base", "HEAD", base).trim();
  const diff = ["diff", "--no-color", "--no-ext-diff", "--diff-filter=d"];

  const files = nulSeparated(
    git(root, env, ...diff, "--name-only", "-z", mergeBase)
  );

  const ranges = changedRanges(
    git(root, env, ...diff, "-U0", mergeBase),
    files
  );

  const untracked = git(
    root,
    env,
    "ls-files",
    "-z",
    "--others",
    "--exclude-standard"
  );

  for (const file of nulSeparated(untracked)) {
    ranges.set(file, [{ end: Number.POSITIVE_INFINITY, start: 1 }]);
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
      maxBuffer: 256 * 1024 * 1024,
    }
  );

  if (result.error) {
    throw result.error;
  }

  let output: unknown;

  try {
    output = JSON.parse(result.stdout);
  } catch {
    throw new Error(`oxlint failed: ${result.stderr.trim()}`);
  }

  const report = reportSchema.parse(output);

  const comments: FlaggedComment[] = [];

  for (const diagnostic of report.diagnostics) {
    if (diagnostic.code !== RULE) {
      continue;
    }

    const absolute = path.resolve(PROJECT_ROOT, diagnostic.filename);
    const source = fs.readFileSync(absolute);

    for (const { span } of diagnostic.labels) {
      comments.push({
        file: path.relative(root, absolute),
        line: span.line,
        text: source
          .subarray(span.offset, span.offset + span.length)
          .toString(),
      });
    }
  }

  return comments;
}

const lastLine = (comment: FlaggedComment) =>
  comment.line + comment.text.split("\n").length - 1;

function joinLineComments(comments: FlaggedComment[]) {
  const joined: FlaggedComment[] = [];

  for (const comment of comments) {
    const previous = joined.at(-1);

    if (
      previous?.file === comment.file &&
      previous.text.startsWith("//") &&
      comment.text.startsWith("//") &&
      comment.line === lastLine(previous) + 1
    ) {
      previous.text += `\n${comment.text}`;
    } else {
      joined.push({ ...comment });
    }
  }

  return joined;
}

const touches = (comment: FlaggedComment, ranges: LineRange[]) =>
  ranges.some(
    (range) => comment.line <= range.end && lastLine(comment) >= range.start
  );

/** The comments on lines changed since the merge base with `base`. */
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

  const sorted = lintComments(root, files).toSorted(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line
  );

  return joinLineComments(sorted).filter((comment) =>
    touches(comment, ranges.get(comment.file) ?? [])
  );
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

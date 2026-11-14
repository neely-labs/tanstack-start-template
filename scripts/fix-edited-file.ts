#!/usr/bin/env node

/**
 * Formats and lints only the file an agent just edited.
 *
 * Wired to Claude Code's `PostToolUse` hook and Cursor's `afterFileEdit` hook,
 * both of which deliver a JSON payload on stdin.
 *
 * The lint run includes type-aware rules, because `oxlint.config.ts` enables
 * them for every oxlint run. It skips the type check and other files, so the
 * full gate still runs via `pnpm validate` on pre-push and in CI.
 *
 * Ignored paths (agent tooling, generated files) are handled by the shared
 * oxlint and oxfmt configs, so they are skipped even when passed explicitly.
 * Once dependencies are installed this script always exits 0: a formatting
 * failure must not block the agent.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { z } from "zod";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");

const FORMAT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".scss",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const LINT_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

// A field that is missing, empty or not a string counts as absent, so the
// next place a path can be is still read.
const pathField = z.string().min(1).optional().catch(undefined);

// Claude Code nests the path under `tool_input`; Cursor sends it at the root.
const hookPayloadSchema = z.object({
  file_path: pathField,
  tool_input: z
    .object({ file_path: pathField, notebook_path: pathField })
    .optional()
    .catch(undefined),
});

/** The edited file named by a hook payload, or undefined when it names none. */
export function editedFilePath(raw: string): string | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // An empty or malformed payload names no file.
  }
  const payload = hookPayloadSchema.safeParse(value);
  if (!payload.success) {
    return undefined;
  }
  const { file_path: rootPath, tool_input: toolInput } = payload.data;
  return rootPath ?? toolInput?.file_path ?? toolInput?.notebook_path;
}

/** Runs a locally installed binary against a single file. */
function runTool(binary: string, args: string[]) {
  spawnSync(path.join(PROJECT_ROOT, "node_modules", ".bin", binary), args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });
}

/** The payload the editor pipes in, or "" when run by hand or unreadable. */
function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function main() {
  const candidate = editedFilePath(readStdin());
  if (candidate === undefined) {
    return;
  }

  const absolutePath = path.resolve(PROJECT_ROOT, candidate);
  const relativePath = path.relative(PROJECT_ROOT, absolutePath);
  const isOutsideProject =
    relativePath.startsWith("..") || path.isAbsolute(relativePath);

  if (isOutsideProject) {
    return;
  }

  const extension = path.extname(absolutePath);
  const toolArgs = ["--no-error-on-unmatched-pattern", relativePath];

  if (FORMAT_EXTENSIONS.has(extension)) {
    runTool("oxfmt", ["--write", ...toolArgs]);
  }

  if (LINT_EXTENSIONS.has(extension)) {
    runTool("oxlint", ["--fix", ...toolArgs]);
  }
}

if (import.meta.main) {
  main();
}

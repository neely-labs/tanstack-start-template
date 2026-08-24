#!/usr/bin/env node

/**
 * Formats and lints only the file an agent just edited.
 *
 * Wired to Claude Code's `PostToolUse` hook and Cursor's `afterFileEdit` hook,
 * both of which deliver a JSON payload on stdin. Those hooks previously ran
 * `pnpm run fix`, which re-checked the entire repository after every single
 * edit; this narrows the work to the one file that changed.
 *
 * Type-aware linting is deliberately skipped here because it has to build the
 * whole TypeScript program regardless of how few files are being checked. The
 * full gate still runs via `pnpm validate` on pre-push and in CI.
 *
 * Ignored paths (agent tooling, generated files) are handled by the shared
 * oxlint and oxfmt configs, so they are skipped even when passed explicitly.
 * This script always exits 0: a formatting failure must not block the agent.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

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

/**
 * Narrows an unknown value to an indexable object.
 *
 * @param {unknown} value Any parsed JSON value.
 * @returns {value is Record<string, unknown>} True when the value has keys.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null;
}

/**
 * Reads a non-empty string property from an untrusted object.
 *
 * @param {unknown} source Candidate object from the hook payload.
 * @param {string} key Property name to read.
 * @returns {string | null} The string value, or null when absent or empty.
 */
function stringField(source, key) {
  if (!isRecord(source)) {
    return null;
  }

  const value = source[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reads the hook payload the editor pipes in on stdin.
 *
 * @returns {unknown} The parsed payload, or null when absent or malformed.
 */
function readHookPayload() {
  if (process.stdin.isTTY) {
    return null;
  }

  try {
    const raw = readFileSync(0, "utf-8").trim();

    if (raw.length === 0) {
      return null;
    }

    /** @type {unknown} */
    const payload = JSON.parse(raw);

    return payload;
  } catch {
    return null;
  }
}

/**
 * Claude Code nests the path under `tool_input`; Cursor sends it at the root.
 *
 * @param {unknown} payload Raw hook payload.
 * @returns {string | null} The edited file path, or null when not present.
 */
function editedFilePath(payload) {
  if (!isRecord(payload)) {
    return null;
  }

  const toolInput = payload.tool_input;

  return (
    stringField(payload, "file_path") ??
    stringField(toolInput, "file_path") ??
    stringField(toolInput, "notebook_path")
  );
}

/**
 * Runs a locally installed binary against a single file.
 *
 * @param {string} binary Executable name inside node_modules/.bin.
 * @param {string[]} args Arguments to pass through.
 * @returns {void}
 */
function runTool(binary, args) {
  spawnSync(path.join(PROJECT_ROOT, "node_modules", ".bin", binary), args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });
}

function main() {
  const candidate = editedFilePath(readHookPayload());

  if (candidate === null) {
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

main();

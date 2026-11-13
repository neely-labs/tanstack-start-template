// Runs the real `Detect documentation-only changes` step from the CI workflow
// with a fake `gh`, so a change that needs the full gate cannot take the
// documentation-only path. Needs `bash` and `jq`, which stands in for gh's --jq.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

const workflowPath = path.join(
  import.meta.dirname,
  "../.github/workflows/ci.yml"
);

interface Step {
  env: Record<string, string>;
  run: string;
  shell?: string;
}

interface Key {
  nested: string[];
  value: string;
}

const indentOf = (line: string) => line.length - line.trimStart().length;

/** The step with `id` as its keys, each with the lines nested under it. */
function stepKeys(yaml: string, id: string): Map<string, Key> {
  const lines = yaml.split("\n");
  const idLine = lines.findIndex((line) => line.trim() === `id: ${id}`);
  let start = idLine;
  while (start > 0 && !lines[start].trimStart().startsWith("- ")) {
    start -= 1;
  }
  if (idLine === -1 || !lines[start].trimStart().startsWith("- ")) {
    throw new Error(`No step with id ${id} in ${workflowPath}`);
  }
  const keyIndent = indentOf(lines[start]) + 2;
  const keys = new Map<string, Key>();
  let current: Key | undefined;
  for (const [offset, raw] of lines.slice(start).entries()) {
    // The first key shares its line with the step's `- `.
    const line =
      offset === 0 ? " ".repeat(keyIndent) + raw.trimStart().slice(2) : raw;
    if (current && (line.trim() === "" || indentOf(line) > keyIndent)) {
      current.nested.push(line);
      continue;
    }
    const match = /^(?<key>[\w-]+):\s*(?<value>.*)$/u.exec(line.trim());
    if (indentOf(line) !== keyIndent || !match?.groups) {
      break;
    }
    current = { nested: [], value: match.groups.value };
    keys.set(match.groups.key, current);
  }
  return keys;
}

/** The workflow step with `id`, read by indentation. Throws if its shape changes. */
function readStep(yaml: string, id: string): Step {
  const keys = stepKeys(yaml, id);
  const run = keys.get("run");
  if (run?.value !== "|") {
    throw new Error(`The step with id ${id} needs a \`run: |\` block`);
  }
  const contentIndent = Math.min(
    ...run.nested.filter((line) => line.trim()).map(indentOf)
  );
  const env = (keys.get("env")?.nested ?? []).flatMap((line) => {
    const pair = /^(?<name>\w+):\s*(?<expr>.*)$/u.exec(line.trim());
    return pair?.groups ? [[pair.groups.name, pair.groups.expr] as const] : [];
  });
  return {
    env: Object.fromEntries(env),
    run: `${run.nested.map((line) => line.slice(contentIndent)).join("\n")}\n`,
    shell: keys.get("shell")?.value,
  };
}

/** Replaces each `${{ name }}` from `context`, as Actions does: an unset name is empty. */
function expand(
  text: string,
  context: Partial<Record<string, string>>
): string {
  return text.replaceAll(/\$\{\{(?<expr>.*?)\}\}/gu, (_, expr: string) => {
    const name = expr.trim();
    if (!/^[\w.-]+$/u.test(name)) {
      throw new Error(`Unsupported expression in the scope step: ${name}`);
    }
    return context[name] ?? "";
  });
}

// Logs each endpoint, then answers with the case's response through jq -r,
// which prints what `gh api --jq` prints. No response is a failed request.
const fakeGh = String.raw`#!/usr/bin/env bash
[ "$1" = api ] || { echo "fake gh: only api is faked" >&2; exit 2; }
shift
filter=.
while [ $# -gt 0 ]; do
  case $1 in
    --jq) filter=$2; shift 2 ;;
    --paginate) shift ;;
    -*) echo "fake gh: unexpected flag $1" >&2; exit 2 ;;
    *) printf '%s\n' "$1" >>"$FAKE_GH_LOG"; shift ;;
  esac
done
[ -f "$FAKE_GH_RESPONSE" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
jq -r "$filter" "$FAKE_GH_RESPONSE"
`;

const temporary = fs.mkdtempSync(path.join(tmpdir(), "ci-docs-scope-"));
const fakeBin = path.join(temporary, "bin");
fs.mkdirSync(fakeBin);
fs.writeFileSync(path.join(fakeBin, "gh"), fakeGh, { mode: 0o755 });

const before = "a".repeat(40);
const sha = "b".repeat(40);
const firstPush = "0".repeat(40);

interface ChangedFile {
  filename: string;
  previous_filename?: string;
  status: string;
}

/** The pull request files list, or a compare with or without its `files`. */
type Response = ChangedFile[] | { files?: ChangedFile[]; status?: string };

interface Case {
  event: string;
  before?: string;
  changedFiles?: number;
  response?: Response;
}

let runCount = 0;

/** Runs the step for one event and returns what it wrote and which endpoints it called. */
function runScope(input: Case) {
  runCount += 1;
  const dir = path.join(temporary, String(runCount));
  fs.mkdirSync(dir);
  const output = path.join(dir, "output");
  const log = path.join(dir, "gh.log");
  const responseFile = path.join(dir, "response.json");
  fs.writeFileSync(output, "");
  fs.writeFileSync(log, "");
  if (input.response !== undefined) {
    fs.writeFileSync(responseFile, JSON.stringify(input.response));
  }
  const pullRequestContext =
    input.event === "pull_request"
      ? {
          "github.event.pull_request.changed_files": String(input.changedFiles),
          "github.event.pull_request.number": "7",
        }
      : {};
  const context = {
    "github.event.before": input.before ?? before,
    "github.event_name": input.event,
    "github.repository": "owner/repo",
    "github.sha": sha,
    "github.token": "fake-token",
    ...pullRequestContext,
  };
  const step = readStep(fs.readFileSync(workflowPath, "utf-8"), "scope");
  const script = path.join(dir, "step.sh");
  fs.writeFileSync(script, expand(step.run, context));
  if (step.shell !== undefined && step.shell !== "bash") {
    throw new Error(`Unsupported shell in the scope step: ${step.shell}`);
  }
  // The shells GitHub runs for `shell: bash` and for a step with no shell.
  const shellArgs =
    step.shell === "bash"
      ? ["--noprofile", "--norc", "-eo", "pipefail", script]
      : ["-e", script];
  const env = Object.fromEntries(
    Object.entries(step.env).map(([name, value]) => [
      name,
      expand(value, context),
    ])
  );
  const result = spawnSync("bash", shellArgs, {
    encoding: "utf-8",
    env: {
      ...env,
      FAKE_GH_LOG: log,
      FAKE_GH_RESPONSE: responseFile,
      GITHUB_OUTPUT: output,
      HOME: dir,
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
    },
  });
  return {
    calls: fs.readFileSync(log, "utf-8").split("\n").filter(Boolean),
    output: fs.readFileSync(output, "utf-8"),
    status: result.status,
    stderr: result.stderr,
  };
}

const modified = (filename: string): ChangedFile => ({
  filename,
  status: "modified",
});
const renamed = (filename: string, previous: string): ChangedFile => ({
  filename,
  previous_filename: previous,
  status: "renamed",
});
const pullRequest = (
  files: ChangedFile[],
  changedFiles = files.length
): Case => ({
  changedFiles,
  event: "pull_request",
  response: files,
});
const push = (response?: Response): Case => ({ event: "push", response });

const pullFiles = "repos/owner/repo/pulls/7/files";
const compare = `repos/owner/repo/compare/${before}...${sha}`;

const cases: [string, Case, boolean, string[]][] = [
  [
    "a Markdown-only pull request",
    pullRequest([
      modified("README.md"),
      modified("docs/guide.md"),
      modified("docs/agents/delivery.md"),
    ]),
    true,
    [pullFiles],
  ],
  [
    "a rename between docs",
    pullRequest([renamed("docs/new.md", "docs/old.md")]),
    true,
    [pullFiles],
  ],
  [
    "a Markdown-only push",
    push({ files: [modified("docs/guide.md")] }),
    true,
    [compare],
  ],
  [
    "a rename from source into docs",
    pullRequest([renamed("docs/notes.md", "src/notes.ts")]),
    false,
    [pullFiles],
  ],
  [
    "a deleted source file",
    pullRequest([{ filename: "src/old.ts", status: "removed" }]),
    false,
    [pullFiles],
  ],
  [
    "a pull request list shorter than its file count",
    pullRequest([modified("docs/guide.md")], 3001),
    false,
    [pullFiles],
  ],
  [
    "a filename with a newline",
    pullRequest([modified("README.md\ndocs/app.ts")]),
    false,
    [pullFiles],
  ],
  [
    "a compare at its 300-file limit",
    push({
      files: Array.from({ length: 300 }, (_, n) => modified(`docs/${n}.md`)),
    }),
    false,
    [compare],
  ],
  [
    "a compare with no files key",
    push({ status: "identical" }),
    false,
    [compare],
  ],
  ["a failed request", push(), false, [compare]],
  ["an empty file list", pullRequest([]), false, [pullFiles]],
  ["a branch's first push", { before: firstPush, event: "push" }, false, []],
  ["a manual dispatch", { event: "workflow_dispatch" }, false, []],
  [
    "a non-Markdown file under docs/",
    pullRequest([modified("docs/guide.md"), modified("docs/diagram.svg")]),
    false,
    [pullFiles],
  ],
  [
    "Markdown outside docs/ and the root",
    pullRequest([modified("src/README.md")]),
    false,
    [pullFiles],
  ],
];

describe("documentation-only CI detection", () => {
  afterAll(() => {
    fs.rmSync(temporary, { force: true, recursive: true });
  });

  it.each(
    cases.map(([name, input, docsOnly, calls]) => ({
      calls,
      docsOnly,
      input,
      name,
    }))
  )("$name: docs-only=$docsOnly", ({ input, docsOnly, calls }) => {
    const result = runScope(input);
    expect(result.stderr).not.toMatch(/fake gh: /u);
    expect(result.status).toBe(0);
    expect(result.output).toBe(`docs-only=${docsOnly}\n`);
    expect(result.calls.map((call) => call.split("?")[0])).toStrictEqual(calls);
  });
});

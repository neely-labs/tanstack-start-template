// Removes the state labels from a closed issue, keeping `wontfix`: state labels
// describe open issues (docs/agents/triage-labels.md). Every other label stays.
// .github/workflows/closed-issue-labels.yml runs it when an issue closes, for
// any reason. Every GitHub call goes through `gh api`, which the tests replace
// with a fake.
//
// It reads the issue live rather than trusting the close event, so an issue
// reopened before the run keeps its labels. It then removes each label by name,
// which leaves labels anyone adds meanwhile untouched. An issue reopened
// between that read and a removal still loses the label; whoever reopens an
// issue sets its state anyway. The workflow shares the qualification
// workflow's concurrency group, so a merge that moves this issue to
// awaiting-qualification finishes before this run reads it. A re-run is safe:
// a label already gone counts as removed. Run:
// `node scripts/clear-closed-labels.ts` with REPO (owner/name) and NUMBER (the
// issue) set.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { STATE_LABELS } from "./state-labels.ts";

/** The one state label a closed issue keeps, because it explains the close. */
export const KEPT_ON_CLOSE = "wontfix" satisfies (typeof STATE_LABELS)[number];

const CLEARED: ReadonlySet<string> = new Set(
  STATE_LABELS.filter((label) => label !== KEPT_ON_CLOSE)
);

/** The labels in `labels` that closing an issue removes. */
export const clearedOnClose = (labels: readonly string[]) =>
  labels.filter((label) => CLEARED.has(label));

/** What the script reads from the issues endpoint. */
export interface ClosedIssue {
  state: "open" | "closed";
  labels: string[];
}

/** The issues endpoint's JSON as a ClosedIssue; throws when it has no state. */
export function decodeIssue(json: string) {
  const data: unknown = JSON.parse(json);

  if (!(data instanceof Object) || !("state" in data)) {
    throw new Error("the issues endpoint returned no issue");
  }

  const list: unknown[] =
    "labels" in data && Array.isArray(data.labels) ? data.labels : [];

  const labels = list.flatMap((label) =>
    label instanceof Object && "name" in label ? String(label.name) : []
  );

  return {
    labels,
    state: data.state === "closed" ? "closed" : "open",
  } satisfies ClosedIssue;
}

class ApiError extends Error {
  override readonly name = "ApiError";
  readonly status: number | undefined;

  constructor(message: string, status: number | undefined) {
    super(message);
    this.status = status;
  }
}

/** One line for the log, and whether the run fails. */
export interface Result {
  failed: boolean;
  message: string;
}

/** Runs `gh api`; a failed request throws an ApiError with its HTTP status. */
function api(endpoint: string, method = "GET") {
  try {
    return execFileSync("gh", ["api", endpoint, "--method", method], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? String(error.stderr).trim()
        : String(error);

    const status = /\(HTTP (?<code>\d{3})\)/u.exec(stderr)?.groups?.code;
    throw new ApiError(
      `${method} ${endpoint} failed: ${stderr}`,
      status === undefined ? undefined : Number(status)
    );
  }
}

const listed = (names: string[]) =>
  names.map((label) => `\`${label}\``).join(", ");

/** Removes the cleared labels from closed issue `number`, and returns one line for the log. */
export function clear(repo: string, number: number) {
  const endpoint = `repos/${repo}/issues/${number}`;
  const before = decodeIssue(api(endpoint));

  if (before.state === "open") {
    return {
      failed: false,
      message: `#${number} is open again, so its labels stay.`,
    } satisfies Result;
  }

  const labels = clearedOnClose(before.labels);

  if (labels.length === 0) {
    return {
      failed: false,
      message: `#${number} has no label to remove.`,
    } satisfies Result;
  }

  for (const label of labels) {
    try {
      api(`${endpoint}/labels/${encodeURIComponent(label)}`, "DELETE");
    } catch (error) {
      // Not Found: someone removed the label first.
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  const after = decodeIssue(api(endpoint));
  const left = after.state === "closed" ? clearedOnClose(after.labels) : [];

  return (
    left.length === 0
      ? { failed: false, message: `#${number}: removed ${listed(labels)}.` }
      : {
          failed: true,
          message: `#${number}: still carries ${listed(left)} after removing it.`,
        }
  ) satisfies Result;
}

if (import.meta.main) {
  const repo = process.env.REPO ?? "";
  const number = Number(process.env.NUMBER);

  if (
    !/^[\w.-]+\/[\w.-]+$/u.test(repo) ||
    !Number.isInteger(number) ||
    number <= 0
  ) {
    console.error(
      "Usage: REPO=owner/name NUMBER=<issue> node scripts/clear-closed-labels.ts"
    );
    process.exit(2);
  }

  let result: Result;

  try {
    result = clear(repo, number);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    result = { failed: true, message: `#${number}: ${reason}` };
  }

  const report = `Closed issue labels: ${result.message}`;
  console.log(report);
  const summary = process.env.GITHUB_STEP_SUMMARY;

  if (summary !== undefined && summary !== "") {
    fs.appendFileSync(summary, `${report}\n`);
  }

  process.exitCode = result.failed ? 1 : 0;
}

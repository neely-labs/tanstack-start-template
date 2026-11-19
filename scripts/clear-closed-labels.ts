// Removes the state labels from a closed issue, keeping `wontfix`, as
// docs/agents/triage-labels.md says. Every other label stays.
// .github/workflows/closed-issue-labels.yml runs it when an issue closes.
//
// It reads the issue live rather than trusting the close event, so an issue
// reopened before the run keeps its labels. It then removes each label by name,
// which leaves labels anyone adds meanwhile untouched. An issue reopened
// during the removals still loses them, and the run then fails so someone
// checks its state. A pull request number is refused. A re-run is safe: a label
// already gone counts as removed. Run:
// `node scripts/clear-closed-labels.ts` with REPO (owner/name) and NUMBER (the
// issue) set.
import fs from "node:fs";

import { ApiError, api } from "./gh-api.ts";
import { STATE_LABELS } from "./state-labels.ts";

/** The one state label a closed issue keeps, because it explains the close. */
export const KEPT_ON_CLOSE = "wontfix" satisfies (typeof STATE_LABELS)[number];

const CLEARED: ReadonlySet<string> = new Set(
  STATE_LABELS.filter((label) => label !== KEPT_ON_CLOSE)
);

export const clearedOnClose = (labels: readonly string[]) =>
  labels.filter((label) => CLEARED.has(label));

export interface IssueLabels {
  state: "open" | "closed";
  labels: string[];
  isPullRequest: boolean;
}

/** The issues endpoint's JSON as IssueLabels; throws when it has no state. */
export function decodeIssueLabels(json: string) {
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
    isPullRequest:
      "pull_request" in data && (data.pull_request ?? null) !== null,
    labels,
    state: data.state === "closed" ? "closed" : "open",
  } satisfies IssueLabels;
}

export interface Result {
  failed: boolean;
  message: string;
}

const listed = (names: string[]) =>
  names.map((label) => `\`${label}\``).join(", ");

/** Removes the cleared labels from closed issue `number`, and returns one line for the log. */
export function clear(repo: string, number: number) {
  const endpoint = `repos/${repo}/issues/${number}`;
  const before = decodeIssueLabels(api(endpoint));

  if (before.isPullRequest) {
    return {
      failed: true,
      message: `#${number} is a pull request, so nothing was removed.`,
    } satisfies Result;
  }

  if (before.state === "open") {
    return {
      failed: false,
      message: `#${number} is open, so its labels stay.`,
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
      api(`${endpoint}/labels/${encodeURIComponent(label)}`, {
        method: "DELETE",
      });
    } catch (error) {
      // Not Found: someone removed the label first.
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  const after = decodeIssueLabels(api(endpoint));

  if (after.state === "open") {
    return {
      failed: true,
      message: `#${number} reopened during the run, after it removed ${listed(labels)}; check that it has the state label it needs.`,
    } satisfies Result;
  }

  const left = clearedOnClose(after.labels);

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

// Applies a merged pull request's Qualification section: each declared open
// issue gets a Current acceptance holding the declared checks, the
// awaiting-qualification label in place of its state label, and no assignees.
// .github/workflows/qualification.yml runs it on merge with the description in
// a file; the parser is the one scripts/verify-pr-description.ts checks it with.
// Every GitHub call goes through `gh api`, which the tests replace with a fake.
//
// A re-run is safe. The marker `<!-- qualification: pr=N -->` records that
// pull request N wrote the issue's Current acceptance, and a comment marked
// `<!-- qualification:moved pr=N -->` records the finished move, after which the
// issue is never touched again. Run: `node scripts/apply-qualification.ts
// <body-file>` with REPO (owner/name) and NUMBER (the pull request) set.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import type { Declaration } from "./qualification.ts";
import {
  TEMPLATE_PATH,
  headingTexts,
  readQualification,
} from "./verify-pr-description.ts";

/** The labels of which an open issue carries exactly one: docs/agents/triage-labels.md. */
export const STATE_LABELS = [
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "awaiting-qualification",
  "wontfix",
] as const;
export const TARGET_LABEL = "awaiting-qualification";

const LABELS_DOC = "docs/tooling.md#create-the-labels";
const CURRENT_ACCEPTANCE = "Current acceptance";
const BODY_MARKER = /<!--\s*qualification:\s*pr=(?<pr>\d+)\s*-->/gu;

export interface Issue {
  number: number;
  state: "open" | "closed";
  body: string;
  labels: string[];
  assignees: string[];
  isPullRequest: boolean;
}

/** One issue update; a field left out stays as it is. */
export interface Update {
  body?: string;
  labels?: string[];
  assignees: string[];
}

/** What the apply step knows about one declared issue before changing it. */
export interface Situation {
  pr: number;
  declaration: Declaration;
  issue: Issue;
  /** The bodies of the issue's comments. */
  comments: string[];
  labelExists: boolean;
}

export interface Plan {
  outcome:
    | "moved"
    | "unchanged"
    | "closed"
    | "conflict"
    | "pull-request"
    | "missing-label";
  failed: boolean;
  message: string;
  update?: Update;
  /** A comment to post, absent when the issue already has it. */
  comment?: string;
}

const STATES: ReadonlySet<string> = new Set(STATE_LABELS);
const isState = (label: string) => STATES.has(label);

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const checklist = (checks: string[]) =>
  checks.map((text) => `- [ ] ${text}`).join("\n");

const commentMarker = (kind: string, pr: number) =>
  `<!-- qualification:${kind} pr=${pr} -->`;

/** Whether an earlier run posted the comment of `kind` for pull request `pr`. */
const posted = (comments: string[], kind: string, pr: number) =>
  comments.some((body) => body.includes(commentMarker(kind, pr)));

/** The comment of `kind`, or undefined when an earlier run already posted it. */
function once(comments: string[], kind: string, pr: number, text: string) {
  return posted(comments, kind, pr)
    ? undefined
    : `${commentMarker(kind, pr)}\n${text}`;
}

function currentAcceptance(pr: number, checks: string[]) {
  return [
    `## ${CURRENT_ACCEPTANCE}`,
    `Status: delivered in #${pr}; open for ${plural(checks.length, "later check")}.`,
    `<!-- qualification: pr=${pr} -->`,
    checklist(checks),
  ].join("\n\n");
}

/** What to do with one declared issue. Pure, so every path is testable. */
export function plan(situation: Situation): Plan {
  const { comments, declaration, issue, labelExists, pr } = situation;
  const { checks } = declaration;
  const name = `#${issue.number}`;
  const writers = [...issue.body.matchAll(BODY_MARKER)].map((match) =>
    Number(match.groups?.pr)
  );
  const ours = writers.includes(pr);
  const unchanged: Plan = {
    failed: false,
    message: `${name}: already applied by #${pr}; left unchanged`,
    outcome: "unchanged",
  };
  if (issue.isPullRequest) {
    return {
      failed: true,
      message: `${name} is a pull request, not an issue; declare only issues under Qualification`,
      outcome: "pull-request",
    };
  }
  if (issue.state === "closed") {
    return ours
      ? unchanged
      : {
          comment: once(
            comments,
            "closed",
            pr,
            `#${pr} merged with qualification checks for this issue, but the issue is closed, so the qualification workflow left it closed. If the checks still matter, reopen it and add them to its Current acceptance:\n\n${checklist(checks)}`
          ),
          failed: false,
          message: `${name}: closed, so left closed and commented with its checks`,
          outcome: "closed",
        };
  }
  if (ours && posted(comments, "moved", pr)) {
    return unchanged;
  }
  const hasAcceptance = headingTexts(issue.body).some(
    (heading) => heading.toLowerCase() === CURRENT_ACCEPTANCE.toLowerCase()
  );
  if (!ours && hasAcceptance) {
    return {
      comment: once(
        comments,
        "conflict",
        pr,
        `#${pr} merged with qualification checks for this issue, but the issue already has a Current acceptance that #${pr} did not write, so the qualification workflow left the issue unchanged. Reconcile these checks into it by hand, then move the issue to \`${TARGET_LABEL}\`:\n\n${checklist(checks)}`
      ),
      failed: true,
      message: `${name}: already has a Current acceptance from another delivery or an edit; left unchanged and commented with the checks to reconcile`,
      outcome: "conflict",
    };
  }
  // A marker without the moved comment means an earlier run wrote the body but
  // did not finish, so only the labels and assignees remain.
  const body = ours
    ? undefined
    : [issue.body.trimEnd(), currentAcceptance(pr, checks)]
        .filter(Boolean)
        .join("\n\n");
  const update: Update = { assignees: [] };
  if (body !== undefined) {
    update.body = body;
  }
  if (labelExists) {
    update.labels = [
      ...issue.labels.filter((label) => !isState(label)),
      TARGET_LABEL,
    ];
  }
  if (!labelExists) {
    return {
      failed: true,
      message: `${name}: wrote its Current acceptance and cleared assignees, but the \`${TARGET_LABEL}\` label does not exist, so its labels are unchanged. Create the labels as ${LABELS_DOC} says, then re-run this job`,
      outcome: "missing-label",
      update,
    };
  }
  return {
    comment: once(
      comments,
      "moved",
      pr,
      `Moved to \`${TARGET_LABEL}\` by #${pr}; its Current acceptance lists ${plural(checks.length, "check")}.`
    ),
    failed: false,
    message: `${name}: moved to ${TARGET_LABEL} with ${plural(checks.length, "check")}`,
    outcome: "moved",
    update,
  };
}

const byName = (left: string, right: string) => left.localeCompare(right);

const quoted = (names: string[]) =>
  names.length === 0 ? "none" : names.map((item) => `"${item}"`).join(", ");

/**
 * How the issue read back after `update` differs from it. `before` holds the
 * issue's state labels before the update, which stay when it sets no labels.
 */
export function verify(update: Update, read: Issue, before: string[]) {
  const problems: string[] = [];
  if (
    update.body !== undefined &&
    read.body.trimEnd() !== update.body.trimEnd()
  ) {
    problems.push("the body does not hold the Current acceptance it wrote");
  }
  const states = read.labels.filter(isState).toSorted(byName);
  const expected = (update.labels ?? before).filter(isState).toSorted(byName);
  if (states.join("\n") !== expected.join("\n")) {
    problems.push(
      `the state labels are ${quoted(states)}, not ${quoted(expected)}`
    );
  }
  if (read.assignees.length > 0) {
    problems.push(`the assignees are ${quoted(read.assignees)}, not none`);
  }
  return problems;
}

class ApiError extends Error {
  override readonly name = "ApiError";
  readonly status: number | undefined;

  constructor(message: string, status: number | undefined) {
    super(message);
    this.status = status;
  }
}

/** Runs `gh api` and returns its output; a failed request throws an ApiError with its HTTP status. */
function api(
  endpoint: string,
  options: {
    method?: string;
    input?: Update | { body: string };
    paginate?: boolean;
  } = {}
) {
  const args = ["api", endpoint];
  if (options.method !== undefined) {
    args.push("--method", options.method);
  }
  if (options.input !== undefined) {
    args.push("--input", "-");
  }
  if (options.paginate === true) {
    args.push("--paginate", "--slurp");
  }
  try {
    return execFileSync("gh", args, {
      encoding: "utf-8",
      input: options.input === undefined ? "" : JSON.stringify(options.input),
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? String(error.stderr).trim()
        : String(error);
    const status = /\(HTTP (?<code>\d{3})\)/u.exec(stderr)?.groups?.code;
    throw new ApiError(
      `${options.method ?? "GET"} ${endpoint} failed: ${stderr}`,
      status === undefined ? undefined : Number(status)
    );
  }
}

/** Each `key` field, as text, of the objects in a parsed JSON list. */
function fieldOf(list: unknown[], key: string) {
  const values: string[] = [];
  for (const item of list) {
    if (item instanceof Object && key in item) {
      values.push(
        String(Object.entries(item).find(([name]) => name === key)?.[1] ?? "")
      );
    }
  }
  return values;
}

/** The issues endpoint's JSON as an Issue; throws when it has no number or state. */
export function decodeIssue(json: string): Issue {
  const data: unknown = JSON.parse(json);
  if (!(data instanceof Object) || !("number" in data) || !("state" in data)) {
    throw new Error("the issues endpoint returned no issue");
  }
  const labels =
    "labels" in data && Array.isArray(data.labels) ? data.labels : [];
  const assignees =
    "assignees" in data && Array.isArray(data.assignees) ? data.assignees : [];
  return {
    assignees: fieldOf(assignees, "login"),
    body: fieldOf([data], "body")[0] ?? "",
    isPullRequest:
      "pull_request" in data && (data.pull_request ?? null) !== null,
    labels: fieldOf(labels, "name"),
    number: Number(data.number),
    state: data.state === "closed" ? "closed" : "open",
  };
}

/** The bodies of a comment list read with `--paginate --slurp`, which nests each page in one array. */
export function decodeComments(json: string): string[] {
  const pages: unknown = JSON.parse(json);
  if (!Array.isArray(pages)) {
    throw new TypeError("the comments endpoint returned no list");
  }
  return fieldOf(pages.flat(), "body");
}

/** Applies one declaration; returns its plan and any problem from carrying it out. */
function applyOne(
  repo: string,
  pr: number,
  declaration: Declaration,
  labelExists: () => boolean
) {
  const endpoint = `repos/${repo}/issues/${declaration.issue}`;
  const issue = decodeIssue(api(endpoint));
  if (issue.isPullRequest) {
    return plan({ comments: [], declaration, issue, labelExists: true, pr });
  }
  const comments = decodeComments(
    api(`${endpoint}/comments?per_page=100`, { paginate: true })
  );
  const result = plan({
    comments,
    declaration,
    issue,
    labelExists: labelExists(),
    pr,
  });
  const post = () => {
    if (result.comment !== undefined) {
      api(`${endpoint}/comments`, {
        input: { body: result.comment },
        method: "POST",
      });
    }
  };
  if (result.update === undefined) {
    post();
    return result;
  }
  api(endpoint, { input: result.update, method: "PATCH" });
  const problems = verify(
    result.update,
    decodeIssue(api(endpoint)),
    issue.labels
  );
  if (problems.length > 0) {
    return {
      ...result,
      failed: true,
      message: `#${declaration.issue}: read back wrong after the update: ${problems.join("; ")}`,
    };
  }
  post();
  return result;
}

/** Applies every declaration, continuing past failures; returns one line per issue. */
export function apply(repo: string, pr: number, declarations: Declaration[]) {
  let exists: boolean | undefined;
  const labelExists = () => {
    if (exists === undefined) {
      try {
        api(`repos/${repo}/labels/${encodeURIComponent(TARGET_LABEL)}`);
        exists = true;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }
        exists = false;
      }
    }
    return exists;
  };
  return declarations.map((declaration) => {
    try {
      const { failed, message } = applyOne(repo, pr, declaration, labelExists);
      return { failed, message };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { failed: true, message: `#${declaration.issue}: ${reason}` };
    }
  });
}

if (import.meta.main) {
  const source = process.argv.at(2);
  const repo = process.env.REPO ?? "";
  const pr = Number(process.env.NUMBER);
  if (
    source === undefined ||
    !/^[\w.-]+\/[\w.-]+$/u.test(repo) ||
    !Number.isInteger(pr) ||
    pr <= 0
  ) {
    console.error(
      "Usage: REPO=owner/name NUMBER=<pull request> node scripts/apply-qualification.ts <body-file>"
    );
    process.exit(2);
  }
  const body = fs.readFileSync(source, "utf-8");
  const { declarations, present, problems } = readQualification(
    body,
    fs.readFileSync(TEMPLATE_PATH, "utf-8")
  );
  let lines = [
    {
      failed: false,
      message: `#${pr} has no Qualification section; nothing to apply.`,
    },
  ];
  if (present && problems.length > 0) {
    lines = problems.map((problem) => ({
      failed: true,
      message: `The Qualification section cannot be applied, so no issue changed: ${problem}`,
    }));
  } else if (present) {
    lines = apply(repo, pr, declarations);
  }
  const failed = lines.filter((line) => line.failed).length;
  const report = [
    `Qualification for #${pr}: ${failed === 0 ? "applied" : plural(failed, "failure")}`,
    ...lines.map(
      (line) => `- ${line.failed ? "Failed" : "OK"}: ${line.message}`
    ),
    ...(failed === 0
      ? []
      : [
          "",
          "Fix each cause, then re-run this job, or move the rest by hand as docs/tooling.md#qualification-workflow says. A re-run leaves issues already moved unchanged.",
        ]),
  ].join("\n");
  console.log(report);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary !== undefined && summary !== "") {
    fs.appendFileSync(summary, `## ${report}\n`);
  }
  process.exitCode = failed === 0 ? 0 : 1;
}

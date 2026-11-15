// Applies a merged pull request's Qualification section: each declared open
// issue gets a Current acceptance holding the declared checks, the
// awaiting-qualification label in place of its state label, and no assignees.
// .github/workflows/qualification.yml runs it on merge with the description
// from the merge event, so it applies the text the pr-description check passed,
// never a later edit; the parser is the one that check uses. Every GitHub call
// goes through `gh api`, which the tests replace with a fake.
//
// A re-run is safe. A comment marked `<!-- qualification:moved pr=N -->`
// records the finished move, after which the issue is never touched again. The
// marker `<!-- qualification: pr=N -->` in the body records that pull request N
// wrote its Current acceptance, so a re-run after a failed run only finishes the
// labels and assignees. Each marker counts only as its own line outside code
// fences: a comment's only from the workflow's token (github-actions[bot]), and
// the body's only under a Current acceptance heading.
//
// GitHub has no conditional issue update, so the script reads the issue again
// just before writing and re-plans once if it changed. A write that lands
// between that read and the update is still lost; the workflow's shared
// concurrency group keeps its own runs from being that write. Run:
// `node scripts/apply-qualification.ts <body-file>` with REPO (owner/name) and
// NUMBER (the pull request) set.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { anyHeadingOf, headingTexts, lines, split } from "./markdown-lines.ts";
import type { MarkdownLine } from "./markdown-lines.ts";
import type { Declaration } from "./qualification.ts";
import { TEMPLATE_PATH, readQualification } from "./verify-pr-description.ts";

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
/** A body marker's comment text. */
const BODY_MARKER = /^qualification:\s*pr=(?<pr>\d+)$/u;
/** The identity of the workflow's GITHUB_TOKEN, which writes its comments. */
const WORKFLOW_AUTHOR = "github-actions[bot]";

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

export interface Comment {
  author: string;
  /** Written by a bot account, such as the workflow's token. */
  bot: boolean;
  body: string;
}

/** What the apply step knows about one declared issue before changing it. */
export interface Situation {
  pr: number;
  declaration: Declaration;
  issue: Issue;
  comments: Comment[];
  labelExists: boolean;
}

export interface Plan {
  outcome:
    | "moved"
    | "unchanged"
    | "closed"
    | "conflict"
    | "unclosed"
    | "pull-request"
    | "missing-label";
  failed: boolean;
  message: string;
  update?: Update;
  /** A comment to post, absent when the issue already has it. */
  comment?: string;
}

/** The comments the apply step posts, each at most once per pull request. */
type CommentKind = "moved" | "closed" | "conflict" | "unclosed";

const STATES: ReadonlySet<string> = new Set(STATE_LABELS);
const isState = (label: string) => STATES.has(label);

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const checklist = (checks: string[]) =>
  checks.map((text) => `- [ ] ${text}`).join("\n");

/** A comment marker's text; the marker is this inside `<!-- -->`. */
const markerText = (kind: CommentKind, pr: number) =>
  `qualification:${kind} pr=${pr}`;
const commentMarker = (kind: CommentKind, pr: number) =>
  `<!-- ${markerText(kind, pr)} -->`;

/**
 * The text of the HTML comment that fills `line`, or undefined. The splitter
 * decides what is a comment, so one in a code fence or code span, or inside
 * an earlier open comment, never counts. The script writes every marker as a
 * whole line at column 0, so any leading character, such as an indent that
 * makes it code, a list continuation or a quote, rules it out too.
 */
function asMarker(line: MarkdownLine) {
  const [comment] = line.comments;
  const alone =
    line.comments.length === 1 &&
    comment?.end === line.number - 1 &&
    line.text.trim() === "" &&
    line.raw.startsWith("<!--");
  return alone ? comment.text : undefined;
}

/** Whether an earlier run posted the comment of `kind` for pull request `pr`. */
const posted = (comments: Comment[], kind: CommentKind, pr: number) =>
  comments.some(
    (comment) =>
      comment.bot &&
      comment.author === WORKFLOW_AUTHOR &&
      lines(comment.body).some(
        (line) => asMarker(line) === markerText(kind, pr)
      )
  );

/** Whether pull request `pr` wrote a Current acceptance into `body`: its marker line under that heading. */
function wroteBody(body: string, pr: number) {
  let heading: string | undefined;
  return lines(body).some((line) => {
    heading = anyHeadingOf(line) ?? heading;
    return (
      heading?.toLowerCase() === CURRENT_ACCEPTANCE.toLowerCase() &&
      Number(BODY_MARKER.exec(asMarker(line) ?? "")?.groups?.pr) === pr
    );
  });
}

/** The marked comment of `kind` to post, or undefined when an earlier run posted it. */
function commentToPost(
  comments: Comment[],
  kind: CommentKind,
  pr: number,
  text: string
) {
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

/** Why a new Current acceptance cannot go into `body`, or undefined when it can. */
function blocker(body: string, pr: number) {
  const { unclosed } = split(body);
  if (unclosed !== undefined) {
    return {
      kind: "unclosed" as const,
      reason: `the issue body ends inside an unclosed ${unclosed}, which would hide an appended Current acceptance`,
    };
  }
  const exists = headingTexts(body).some(
    (heading) => heading.toLowerCase() === CURRENT_ACCEPTANCE.toLowerCase()
  );
  return exists
    ? {
        kind: "conflict" as const,
        reason: `the issue already has a Current acceptance that #${pr} did not write`,
      }
    : undefined;
}

/** The plan for an open issue this pull request has not finished moving. */
function move(situation: Situation, ours: boolean): Plan {
  const { comments, declaration, issue, labelExists, pr } = situation;
  const { checks } = declaration;
  const name = `#${issue.number}`;
  const update: Update = { assignees: [] };
  // Our marker without the moved comment: an earlier run wrote the body but did
  // not finish, so only the labels and assignees remain.
  if (!ours) {
    update.body = [issue.body.trimEnd(), currentAcceptance(pr, checks)]
      .filter(Boolean)
      .join("\n\n");
  }
  if (!labelExists) {
    return {
      failed: true,
      message: `${name}: wrote its Current acceptance and cleared assignees, but the \`${TARGET_LABEL}\` label does not exist, so its labels are unchanged. Create the labels as ${LABELS_DOC} says, then re-run this job`,
      outcome: "missing-label",
      update,
    };
  }
  update.labels = [
    ...issue.labels.filter((label) => !isState(label)),
    TARGET_LABEL,
  ];
  return {
    comment: commentToPost(
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

/** What to do with one declared issue. Pure, so every path is testable. */
export function plan(situation: Situation): Plan {
  const { comments, declaration, issue, pr } = situation;
  const { checks } = declaration;
  const name = `#${issue.number}`;
  const ours = wroteBody(issue.body, pr);
  const opening = `#${pr} merged with qualification checks for this issue, but`;
  if (issue.isPullRequest) {
    return {
      failed: true,
      message: `${name} is a pull request, not an issue; declare only issues under Qualification`,
      outcome: "pull-request",
    };
  }
  // The moved comment, not the body marker, records success: a person may
  // have edited the marker away since.
  if (posted(comments, "moved", pr) || (ours && issue.state === "closed")) {
    return {
      failed: false,
      message: `${name}: already applied by #${pr}; left unchanged`,
      outcome: "unchanged",
    };
  }
  if (issue.state === "closed") {
    return {
      comment: commentToPost(
        comments,
        "closed",
        pr,
        `${opening} the issue is closed, so the qualification workflow left it closed. If the checks still matter, reopen it and add them to its Current acceptance:\n\n${checklist(checks)}`
      ),
      failed: false,
      message: `${name}: closed, so left closed and commented with its checks`,
      outcome: "closed",
    };
  }
  const blocked = ours ? undefined : blocker(issue.body, pr);
  if (blocked !== undefined) {
    return {
      comment: commentToPost(
        comments,
        blocked.kind,
        pr,
        `${opening} ${blocked.reason}, so the qualification workflow left the issue unchanged. Add these checks to it by hand, then move the issue to \`${TARGET_LABEL}\`:\n\n${checklist(checks)}`
      ),
      failed: true,
      message: `${name}: left unchanged because ${blocked.reason}; commented with the checks to add by hand`,
      outcome: blocked.kind,
    };
  }
  return move(situation, ours);
}

const byName = (left: string, right: string) => left.localeCompare(right);

const quoted = (names: string[]) =>
  names.length === 0 ? "none" : names.map((item) => `"${item}"`).join(", ");

/**
 * Each way the issue read back after `update` differs from it. `before` holds
 * the issue's labels before the update, which stay when it sets none.
 */
export function readBackProblems(
  update: Update,
  read: Issue,
  before: string[]
) {
  const problems: string[] = [];
  if (
    update.body !== undefined &&
    read.body.trimEnd() !== update.body.trimEnd()
  ) {
    problems.push("the body does not hold the Current acceptance it wrote");
  }
  const labels = read.labels.toSorted(byName);
  const expected = (update.labels ?? before).toSorted(byName);
  if (labels.join("\n") !== expected.join("\n")) {
    problems.push(`the labels are ${quoted(labels)}, not ${quoted(expected)}`);
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

/** A comment list read with `--paginate --slurp`, which nests each page in one array. */
export function decodeComments(json: string): Comment[] {
  const pages: unknown = JSON.parse(json);
  if (!Array.isArray(pages)) {
    throw new TypeError("the comments endpoint returned no list");
  }
  const comments: Comment[] = [];
  const items: unknown[] = pages.flat();
  for (const item of items) {
    if (item instanceof Object) {
      const user =
        "user" in item && item.user instanceof Object ? [item.user] : [];
      comments.push({
        author: fieldOf(user, "login")[0] ?? "",
        body: fieldOf([item], "body")[0] ?? "",
        bot: fieldOf(user, "type")[0] === "Bot",
      });
    }
  }
  return comments;
}

/** Whether two reads of an issue agree on everything a plan depends on. */
function sameIssue(left: Issue, right: Issue) {
  const key = (read: Issue) =>
    JSON.stringify([
      read.state,
      read.body,
      read.labels.toSorted(byName),
      read.assignees.toSorted(byName),
    ]);
  return key(left) === key(right);
}

/** Applies one declaration; returns its plan and any problem from carrying it out. */
function applyOne(
  repo: string,
  pr: number,
  declaration: Declaration,
  labelExists: () => boolean
) {
  const endpoint = `repos/${repo}/issues/${declaration.issue}`;
  const first = decodeIssue(api(endpoint));
  if (first.isPullRequest) {
    return plan({
      comments: [],
      declaration,
      issue: first,
      labelExists: true,
      pr,
    });
  }
  const planFrom = (read: Issue) =>
    plan({
      comments: decodeComments(
        api(`${endpoint}/comments?per_page=100`, { paginate: true })
      ),
      declaration,
      issue: read,
      labelExists: labelExists(),
      pr,
    });
  let issue = first;
  let result = planFrom(issue);
  // Read again just before writing, so a change since the plan is not
  // overwritten: re-plan once from it, and give up if it changes again.
  for (let attempt = 0; result.update !== undefined; attempt += 1) {
    const fresh = decodeIssue(api(endpoint));
    if (sameIssue(fresh, issue)) {
      break;
    }
    if (attempt > 0) {
      return {
        ...result,
        failed: true,
        message: `#${declaration.issue}: changed again while it was being applied, so it was left as it is; re-run this job`,
      };
    }
    issue = fresh;
    result = planFrom(issue);
  }
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
  const problems = readBackProblems(
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
  let results = [
    {
      failed: false,
      message: `#${pr} has no Qualification section; nothing to apply.`,
    },
  ];
  if (present && problems.length > 0) {
    results = problems.map((problem) => ({
      failed: true,
      message: `The Qualification section cannot be applied, so no issue changed: ${problem}`,
    }));
  } else if (present) {
    results = apply(repo, pr, declarations);
  }
  const failed = results.filter((line) => line.failed).length;
  const report = [
    `Qualification for #${pr}: ${failed === 0 ? "applied" : plural(failed, "failure")}`,
    ...results.map(
      (line) => `- ${line.failed ? "Failed" : "OK"}: ${line.message}`
    ),
    ...(failed === 0
      ? []
      : [
          "",
          "Re-run this job once a transient or setup cause, such as a missing label, is fixed; a re-run applies the description as merged and leaves issues already moved unchanged. Otherwise move the issue by hand as docs/tooling.md#qualification-workflow says.",
        ]),
  ].join("\n");
  console.log(report);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary !== undefined && summary !== "") {
    fs.appendFileSync(summary, `## ${report}\n`);
  }
  process.exitCode = failed === 0 ? 0 : 1;
}

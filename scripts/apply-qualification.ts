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
// labels and assignees. A comment's marker counts only as its own line outside
// code fences, and only from the workflow's token (github-actions[bot]); the
// body's counts only as a top-level HTML block under the Current acceptance
// heading, as a GFM parse of the body reads it.
//
// GitHub has no conditional issue update, so the script reads the issue again
// just before writing and re-plans once if it changed. A write that lands
// between that read and the update is still lost; the workflow's shared
// concurrency group keeps its own runs from being that write. Run:
// `node scripts/apply-qualification.ts <body-file>` with REPO (owner/name) and
// NUMBER (the pull request) set.
import fs from "node:fs";

import type { Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { toString } from "mdast-util-to-string";
import { gfm } from "micromark-extension-gfm";

import { ApiError, api } from "./gh-api.ts";
import { headingTexts, lines, split } from "./markdown-lines.ts";
import type { MarkdownLine } from "./markdown-lines.ts";
import type { Declaration } from "./qualification.ts";
import { STATE_LABELS } from "./state-labels.ts";
import { TEMPLATE_PATH, readQualification } from "./verify-pr-description.ts";

export const TARGET_LABEL = "awaiting-qualification";

const LABELS_DOC = "docs/tooling.md#create-the-labels";
const CURRENT_ACCEPTANCE = "Current acceptance";

const isCurrentAcceptance = (text: string) =>
  text.toLowerCase() === CURRENT_ACCEPTANCE.toLowerCase();

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

/** `markdown` parsed as GitHub reads it: CommonMark with its GFM extensions. */
const parse = (markdown: string) =>
  fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

/** Every node of `tree`, in document order. */
function nodesOf(tree: Nodes) {
  const found: Nodes[] = [];
  const stack: Nodes[] = [tree];

  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    found.push(node);

    if ("children" in node) {
      stack.push(...node.children.toReversed());
    }
  }

  return found;
}

/** A node's rendered text with runs of whitespace as one space. */
const titleOf = (node: Nodes) => toString(node).replaceAll(/\s+/gu, " ").trim();

const isSection = (node: Nodes) =>
  node.type === "heading" && isCurrentAcceptance(titleOf(node));

/** A Current acceptance marker as a whole HTML block, and the pull request it names. */
const MARKER_BLOCK = /^<!--\s*qualification:\s*pr=(?<pr>\d+)\s*-->$/u;

/**
 * Whether pull request `pr` wrote its block into `body`: its marker stands
 * alone as a top-level HTML block whose nearest heading above is the Current
 * acceptance, as the parse shows it, so a marker under a later heading of any
 * kind, or in a quote, list or code, is not its own.
 */
function wroteBody(body: string, pr: number) {
  let section = false;

  return parse(body).children.some((node) => {
    if (node.type === "heading") {
      section = isSection(node);
    }

    return (
      section &&
      node.type === "html" &&
      // As the workflow writes it: one line, with no indent.
      node.value.startsWith("<!--") &&
      !node.value.trimEnd().includes("\n") &&
      Number(MARKER_BLOCK.exec(node.value.trimEnd())?.groups?.pr) === pr
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

/** The status line, marker and checks pull request `pr` writes under Current acceptance. */
const statusLine = (pr: number, checks: string[]) =>
  `Status: delivered in #${pr}; open for ${plural(checks.length, "later check")}.`;

const markerLine = (pr: number) => `<!-- qualification: pr=${pr} -->`;

function qualificationBlock(pr: number, checks: string[]) {
  return [statusLine(pr, checks), markerLine(pr), checklist(checks)].join(
    "\n\n"
  );
}

/**
 * A status line a delivery wrote, by the workflow or by hand, on any rendered
 * line of a paragraph, so formatting such as `**Status:**` or text before it on
 * an earlier line does not hide it.
 */
const STATUS_LINE = /^\s*Status:\s*delivered\s+in\s+#\d+/imu;

/** A node's rendered text, with each soft or hard line break as a newline. */
const linesOf = (node: Nodes) =>
  nodesOf(node)
    .map((part) => {
      if (part.type === "break") {
        return "\n";
      }

      return "value" in part && !("children" in part) ? part.value : "";
    })
    .join("");

/**
 * HTML around a triage-written Current acceptance that rules out appending:
 * any at all, but the appended block's own `marker`. Raw HTML is where the
 * parser and GitHub may read a body differently, and a comment could be or
 * hide another delivery's marker.
 */
const unsafeHtml = (nodes: Nodes[], marker?: Nodes) =>
  nodes.some((node) => node.type === "html" && node !== marker);

/**
 * Whether `body`, with pull request `pr`'s block appended, reads as GitHub
 * would show it: the body's one Current acceptance is its last heading, at the
 * top level, and the status line, marker and checks follow it there, with no
 * other HTML anywhere. The splitter must also find the marker under that
 * heading, so a re-run knows its own block and never adds it twice.
 */
function holdsBlock(body: string, pr: number, checks: string[]) {
  const tree = parse(body);
  const nodes = nodesOf(tree);
  const headingNodes = nodes.filter((node) => node.type === "heading");
  const section = headingNodes.at(-1);
  const [status, marker, list] = tree.children.slice(-3);

  return (
    section !== undefined &&
    isSection(section) &&
    headingNodes.filter(isSection).length === 1 &&
    tree.children.includes(section) &&
    tree.children.indexOf(section) < tree.children.length - 3 &&
    status?.type === "paragraph" &&
    titleOf(status) === statusLine(pr, checks) &&
    marker?.type === "html" &&
    marker.value === markerLine(pr) &&
    !unsafeHtml(nodes, marker) &&
    list?.type === "list" &&
    list.children.length === checks.length &&
    wroteBody(body, pr)
  );
}

/** Where the qualification block goes in an issue's body, or why it cannot. */
type Placement =
  | { kind: "write"; body: string }
  | {
      kind: "blocked";
      blocked: { kind: "conflict" | "unclosed"; reason: string };
    };

/** A placement that refuses with a conflict comment giving `reason`. */
const conflict = (reason: string) =>
  ({
    blocked: { kind: "conflict", reason },
    kind: "blocked",
  }) satisfies Placement;

/**
 * The body pull request `pr` writes, or why it writes none. With no Current
 * acceptance, the block goes under a new heading at the end. With one that
 * triage wrote, it goes at the end of the body, only when that section is the
 * last and the parsed result shows the block inside it; a section that already
 * records a delivery, or HTML anywhere, refuses. Refusing only leaves the
 * checks for a person to add.
 */
function placement(body: string, pr: number, checks: string[]) {
  const { unclosed } = split(body);

  if (unclosed !== undefined) {
    return {
      blocked: {
        kind: "unclosed",
        reason: `the issue body ends inside an unclosed ${unclosed}, which would hide an appended Current acceptance`,
      },
      kind: "blocked",
    } satisfies Placement;
  }

  // Only ASCII whitespace goes: `trimEnd` would also drop a trailing
  // nonbreaking space, which can turn a paragraph above `---` into a heading.
  const kept = body.replace(/[ \t\r\n]+$/u, "");
  const block = qualificationBlock(pr, checks);
  const nodes = nodesOf(parse(body));
  const sections = nodes.filter(isSection);

  if (sections.length === 0 && !headingTexts(body).some(isCurrentAcceptance)) {
    return {
      body: [kept, `## ${CURRENT_ACCEPTANCE}`, block]
        .filter(Boolean)
        .join("\n\n"),
      kind: "write",
    } satisfies Placement;
  }

  if (sections.length !== 1) {
    return conflict(
      `the issue has ${sections.length === 0 ? "text that may read as a" : sections.length} Current acceptance heading${sections.length > 1 ? "s" : ""}, so #${pr} cannot tell where to add its checks`
    );
  }

  // Two places the parser and GitHub's are known to read differently.
  if (
    /(?![\t\n\r])\p{Cc}/u.test(body) ||
    nodes.some(
      (node) => node.type === "definition" || node.type === "footnoteDefinition"
    )
  ) {
    return conflict(
      "the issue holds a link or footnote definition, or a control character, which GitHub may read differently from the workflow's parser"
    );
  }

  if (unsafeHtml(nodes)) {
    return conflict(
      "the issue holds HTML, such as a comment or another delivery's marker, which could record another delivery or hide checks added at the end"
    );
  }

  const after = nodes.slice(nodes.indexOf(sections[0]) + 1);

  if (
    after.some(
      (node) => node.type === "paragraph" && STATUS_LINE.test(linesOf(node))
    )
  ) {
    return conflict(
      "the issue's Current acceptance already holds a delivery's status line"
    );
  }

  const appended = `${body}\n\n${block}`;

  return holdsBlock(appended, pr, checks)
    ? ({ body: appended, kind: "write" } satisfies Placement)
    : conflict(
        `#${pr} could not confirm that checks added at the end would sit under the issue's Current acceptance, which must be its last heading, written with #`
      );
}

/**
 * The plan for an open issue this pull request has not finished moving.
 * `body` is the body to write, or undefined when an earlier run already wrote
 * its block, so only the labels and assignees remain.
 */
const move: (situation: Situation, body: string | undefined) => Plan = (
  situation,
  body
) => {
  const { comments, declaration, issue, labelExists, pr } = situation;
  const { checks } = declaration;
  const name = `#${issue.number}`;
  const update: Update = { assignees: [] };

  if (body !== undefined) {
    update.body = body;
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
};

/** What to do with one declared issue. Pure, so every path is testable. */
export const plan: (situation: Situation) => Plan = (situation) => {
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

  const placed = ours ? undefined : placement(issue.body, pr, checks);

  if (placed?.kind === "blocked") {
    const { blocked } = placed;

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

  return move(situation, placed?.body);
};

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
export function decodeIssue(json: string) {
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
  } satisfies Issue;
}

/** A comment list read with `--paginate --slurp`, which nests each page in one array. */
export function decodeComments(json: string) {
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

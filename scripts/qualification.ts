// Reads the optional `## Qualification` section of a pull request description:
// one `For #N:` line per issue, each followed by the unticked checks that stay
// open once the pull request merges. The one parser for both sides of the
// handoff: scripts/verify-pr-description.ts rejects a malformed declaration
// before merge, and scripts/apply-qualification.ts applies it on merge.

import type { MarkdownLine } from "./markdown-lines.ts";

export const QUALIFICATION_SECTION = "Qualification";

/** One issue the pull request moves to awaiting-qualification, and its checks. */
export interface Declaration {
  issue: number;
  /** The line of its `For #N:`. */
  line: number;
  checks: string[];
}

const FOR_LINE = /^\s*For\s+(?<ref>.*?):?\s*$/u;
const ISSUE_REF = /^#(?<issue>[1-9]\d*)$/u;

/** A reference that names a repository: `owner/repo#N` or an issue URL. */
const OTHER_REPO = /^(?:[\w.-]+\/[\w.-]+#\d+|https?:\/\/\S+\/issues\/\d+)$/u;
const OTHER_CONTENT = `"## ${QUALIFICATION_SECTION}" holds only "For #N:" lines and unticked checks, outside comments and code`;
const CHECK = /^\s*[-*+]\s+\[(?<mark>[ xX])\](?:\s+(?<text>.*?))?\s*$/u;

/** A `For` line's problem, or null once it opened a new declaration. */
function readFor(line: MarkdownLine, ref: string, declarations: Declaration[]) {
  const issue = Number(ISSUE_REF.exec(ref)?.groups?.issue ?? Number.NaN);

  if (OTHER_REPO.test(ref)) {
    return `"For ${ref}:" names another repository; declare issues in this one as "For #N:"`;
  }

  if (Number.isNaN(issue) || !line.text.trim().endsWith(":")) {
    return `write it as "For #N:", with the issue's number`;
  }

  if (declarations.some((found) => found.issue === issue)) {
    return `#${issue} is declared again; give each issue one "For #N:" line`;
  }

  declarations.push({ checks: [], issue, line: line.number });

  return null;
}

/** A check line's problem, or null once it joined the open declaration. */
function readCheck(
  line: MarkdownLine,
  mark: string,
  group: Declaration | undefined,
  afterFor: boolean
) {
  // The raw line keeps `<` in code spans, which `text` escapes.
  const text = CHECK.exec(line.raw.trim())?.groups?.text ?? "";

  if (group === undefined) {
    // After a malformed `For` line, which already has its own problem.
    return afterFor ? null : `a check comes before the first "For #N:" line`;
  }

  if (mark !== " ") {
    return "a check is ticked; declare only checks still to run, as - [ ]";
  }

  if (text === "") {
    return "a check has no text; name the check, who runs it, and when";
  }

  // Even in a code span: the issue gets the text as written, and a comment
  // there could forge the marker that records which pull request applied it.
  if (text.includes("<!--")) {
    return 'a check may not contain "<!--", even in code';
  }

  group.checks.push(text);

  return null;
}

/** One non-blank line's problem, if any; a valid line joins `declarations`. */
function readLine(
  line: MarkdownLine,
  declarations: Declaration[],
  afterFor: boolean
) {
  const text = line.text.trim();
  const ref = FOR_LINE.exec(text)?.groups?.ref;
  const mark = CHECK.exec(text)?.groups?.mark;

  if (line.fenced) {
    return OTHER_CONTENT;
  }

  if (line.commented) {
    return `keep comments on their own lines in "## ${QUALIFICATION_SECTION}"`;
  }

  if (ref !== undefined) {
    return readFor(line, ref, declarations);
  }

  if (mark !== undefined) {
    return readCheck(line, mark, declarations.at(-1), afterFor);
  }

  return OTHER_CONTENT;
}

/** The declarations in the section's lines, and each way they break the format. */
export function parseQualification(body: MarkdownLine[]) {
  const declarations: Declaration[] = [];
  const problems: string[] = [];

  const firstFor = body.findIndex(
    (line) => !line.fenced && FOR_LINE.test(line.text.trim())
  );

  for (const [at, line] of body.entries()) {
    const problem =
      line.fenced || line.text.trim() !== ""
        ? readLine(line, declarations, firstFor !== -1 && at > firstFor)
        : null;

    if (problem !== null) {
      problems.push(`line ${line.number}: ${problem}`);
    }
  }

  if (declarations.length === 0 && problems.length === 0) {
    problems.push(
      `"## ${QUALIFICATION_SECTION}" has no "For #N:" line; declare an issue or delete the section`
    );
  }

  for (const group of declarations.filter(
    (found) => found.checks.length === 0
  )) {
    problems.push(
      `line ${group.line}: "For #${group.issue}:" has no check; add one as - [ ] or remove the line`
    );
  }

  return { declarations, problems };
}

/** Code spans, whose text names a keyword without using it. */
const CODE = /`[^`\n]*`/gu;

/**
 * Each declared issue must be named `Refs #N` in Summary, and must follow no
 * closing keyword anywhere in the description, comments and code included,
 * since a merge that closes the issue would leave nothing to move.
 */
export function checkReferences(
  declarations: Declaration[],
  summary: MarkdownLine[],
  description: string
) {
  const problems: string[] = [];

  const prose = summary
    .flatMap((line) => (line.fenced ? [] : [line.text.replaceAll(CODE, "")]))
    .join("\n");

  for (const { issue, line } of declarations) {
    if (!new RegExp(`\\brefs\\s+#${issue}(?!\\d)`, "iu").test(prose)) {
      problems.push(
        `line ${line}: #${issue} is declared under "## ${QUALIFICATION_SECTION}" but "## Summary" has no "Refs #${issue}"`
      );
    }

    const closing = new RegExp(
      `\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\b:?\\s+(?:[\\w.-]+\\/[\\w.-]+#|https?:\\/\\/\\S+\\/issues\\/|#)${issue}(?!\\d)`,
      "iu"
    );

    if (closing.test(description)) {
      problems.push(
        `line ${line}: #${issue} follows a closing keyword in the description, so merging would close it; use "Refs #${issue}" only`
      );
    }
  }

  return problems;
}

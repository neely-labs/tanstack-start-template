// Checks a pull request description against the sections, order, filled
// placeholders and length limits of .github/pull_request_template.md, which
// stays the one place that names the sections and states the limits. CI runs it
// on every description edit and push (.github/workflows/pr-description.yml),
// passing the head commit; run it locally on a saved body with
// `pnpm pr:verify <file> [--head <sha>]`, or `-` to read standard input.
import fs from "node:fs";
import path from "node:path";

import { headingOf, lines } from "./markdown-lines.ts";
import type { MarkdownLine as Line } from "./markdown-lines.ts";
import {
  QUALIFICATION_SECTION,
  checkReferences,
  parseQualification,
} from "./qualification.ts";

export const TEMPLATE_PATH = path.join(
  import.meta.dirname,
  "../.github/pull_request_template.md"
);

/**
 * Sections a description may delete, each kept directly after the template
 * section before it that the description has. Every other section is required.
 */
const OPTIONAL_SECTIONS = new Set([QUALIFICATION_SECTION, "UI evidence"]);

/** Sections that must keep the template's `<details>` block and the labels inside it. */
const COLLAPSED_SECTIONS = new Set(["Verification"]);

/** The section whose `- **Field:** value` lines are checked, and its optional fields. */
const FIELDS_SECTION = "Merge danger";
const OPTIONAL_FIELDS = new Set(["Rollback"]);

/** The section that holds the evidence publisher's markers. */
const MARKER_SECTION = "UI evidence";
const MARKER = /^ui-evidence:(?<kind>start|end)$/u;

/**
 * The limits the template's comments state, so a description stays readable at
 * a glance; a test keeps the two in step. Words are whitespace-separated.
 */
export const LIMITS = {
  /** Summary prose, outside its sketch, table, comments and issue lines. */
  summaryWords: 100,
  /** Blast radius and Rollback. */
  fieldWords: 12,
  /** Decisions bullets outside the collapsed block. */
  decisionsVisible: 8,
  /** One visible choice, its wrapped and nested lines included. */
  choiceWords: 25,
  /** One visible Owner decision or Needs your eye item. */
  askWords: 50,
  /** The Verification `<summary>` line. */
  outcomeWords: 25,
};

/** Merge danger values with a fixed form, each as the template's comment lists it. */
const FIELD_FORMS = new Map([
  [
    "Door",
    {
      matches: (value: string) =>
        ["clean two-way", "two-way", "one-way", "uncertain"].includes(
          value.toLowerCase()
        ),
      rule: "must be one of clean two-way, two-way, one-way or uncertain; put any reason under Decisions",
    },
  ],
  [
    "Risk tier",
    {
      matches: (value: string) => /^[012]$/u.test(value),
      rule: "must be one of 0, 1 or 2; put any reason under Decisions",
    },
  ],
  [
    "Rounds used",
    {
      matches: (value: string) => /^\d+ of \d+$/u.test(value),
      rule: 'must read "N of M"; put the reason under Decisions',
    },
  ],
]);

/** Merge danger values that are free phrases, held to `LIMITS.fieldWords`. */
const PHRASE_FIELDS = new Set(["Blast radius", "Rollback"]);

/** A visible Decisions item addressed to the owner, allowed `LIMITS.askWords`. */
const ASK = /^\*\*(?:Owner decision|Needs your eye):\*\*/u;

const ISSUE_LINE =
  /^\s*(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs)\s+#\d+\s*$/iu;

/** A list item's marker, bulleted or numbered. */
const BULLET = /^(?<indent>\s*)(?:[-*+]|\d+[.)])\s+/u;

/** Sections and the Verification label the limit checks read, beyond those named above. */
const SUMMARY_SECTION = "Summary";
const VERIFICATION_SECTION = "Verification";
const DECISIONS_SECTION = "Decisions";
const CHECKS_LABEL = "Checks";
const COMMIT = /^[0-9a-f]{7,40}$/iu;

interface Section {
  heading: string;
  /** `#` or `##`, as written. */
  marker: string;
  line: number;
  body: Line[];
}

/** Level 1 and 2 headings and the lines under each; lines before the first are dropped. */
function sections(all: Line[]) {
  const found: Section[] = [];

  for (const line of all) {
    const match = headingOf(line);

    if (match === undefined) {
      found.at(-1)?.body.push(line);
    } else {
      found.push({
        body: [],
        heading: match.heading,
        line: line.number,
        marker: match.marker,
      });
    }
  }

  return found;
}

/** Each line paired with whether it sits inside a `<details>` block. */
function collapsed(body: Line[]) {
  let depth = 0;

  const inside = body.map((line) => {
    const opens = line.text.match(/<details[\s>]/giu)?.length ?? 0;
    const closes = line.text.match(/<\/details>/giu)?.length ?? 0;
    const within = depth > 0 || opens > 0;
    depth = Math.max(0, depth + opens - closes);

    return within;
  });

  return { inside, unclosed: depth > 0 };
}

const BOLD_LABEL = /^\s*\*\*(?<label>[^*]+)\*\*\s*$/u;
const FIELD = /^\s*[-*+]\s+\*\*(?<label>[^*]+?):\*\*(?<value>.*)$/u;

/** What the template defines: its sections in order, and the parts each one keeps. */
function expectations(template: string) {
  const all = lines(template);
  const found = sections(all);
  const headings = found.map((section) => section.heading);

  for (const name of [
    ...OPTIONAL_SECTIONS,
    ...COLLAPSED_SECTIONS,
    FIELDS_SECTION,
    MARKER_SECTION,
    SUMMARY_SECTION,
    VERIFICATION_SECTION,
    DECISIONS_SECTION,
  ]) {
    if (!headings.includes(name)) {
      throw new Error(
        `The template has no "## ${name}" section, which scripts/verify-pr-description.ts names. Update the script to match.`
      );
    }
  }

  const labels = new Map(
    found.map((section) => {
      const { inside } = collapsed(section.body);

      const names = section.body
        .filter((_, at) => inside[at])
        .flatMap((line) => BOLD_LABEL.exec(line.text)?.groups?.label ?? []);

      return [section.heading, names];
    })
  );

  if (labels.get(VERIFICATION_SECTION)?.includes(CHECKS_LABEL) !== true) {
    throw new Error(
      `The template's "## ${VERIFICATION_SECTION}" has no "**${CHECKS_LABEL}**" label, which scripts/verify-pr-description.ts names. Update the script to match.`
    );
  }

  const fields =
    found
      .find((section) => section.heading === FIELDS_SECTION)
      ?.body.flatMap((line) => FIELD.exec(line.text)?.groups?.label ?? []) ??
    [];

  for (const field of OPTIONAL_FIELDS) {
    if (!fields.includes(field)) {
      throw new Error(
        `The template's "## ${FIELDS_SECTION}" has no "**${field}:**" line, which scripts/verify-pr-description.ts names. Update the script to match.`
      );
    }
  }

  const comments = new Set(
    all.flatMap((line) => line.comments.map((comment) => comment.text))
  );

  return { comments, fields, headings, labels };
}

/** The ui-evidence markers on a line. */
function markersOn(line: Line) {
  return line.comments.flatMap(
    (comment) => MARKER.exec(comment.text)?.groups?.kind ?? []
  );
}

/** Whether `close` ends the bot block `open` starts, in the closing styles bots use. */
function endsBlock(open: string, close: string) {
  const endOf = "end of ";

  return (
    close === `/${open}` ||
    (open.includes("start") && close === open.replace("start", "end")) ||
    (close.startsWith(endOf) && open.endsWith(close.slice(endOf.length)))
  );
}

/**
 * Drops what bots appended after the template's last heading: each block from a
 * comment the template lacks to its closing comment, such as
 * `<!-- codesmith:footer -->` to `<!-- /codesmith:footer -->`. Anything outside
 * such a pair is checked, including a footer that does not open with a comment.
 */
function withoutBotBlocks(
  all: Line[],
  headings: string[],
  templateComments: Set<string>
) {
  const last = all.findIndex(
    (line) => headingOf(line)?.heading === headings.at(-1)
  );

  const opened = all.flatMap((line, at) =>
    last !== -1 && at > last
      ? line.comments.map((comment) => ({ ...comment, at }))
      : []
  );

  const dropped = new Set<number>();

  for (const [index, open] of opened.entries()) {
    const close = opened
      .slice(index + 1)
      .find((candidate) => endsBlock(open.text, candidate.text));

    const isBot =
      !dropped.has(open.at) &&
      !templateComments.has(open.text) &&
      !MARKER.test(open.text);

    if (isBot && close !== undefined) {
      for (let { at } = open; at <= close.end; at += 1) {
        dropped.add(at);
      }
    }
  }

  return all.filter((_, at) => !dropped.has(at));
}

type Expected = ReturnType<typeof expectations>;

/** The template's sections, in its order, none added or repeated. */
function checkHeadings(found: Section[], expected: Expected) {
  const problems: string[] = [];
  const seen = new Map<string, Section>();
  let furthest: Section | undefined;

  for (const section of found) {
    const at = expected.headings.indexOf(section.heading);
    const name = `${section.marker} ${section.heading}`;
    const first = seen.get(section.heading);

    if (at === -1 || section.marker !== "##") {
      problems.push(
        `line ${section.line}: "${name}" is not a template section; use the template's sections only`
      );
    } else if (first === undefined) {
      seen.set(section.heading, section);

      if (
        furthest !== undefined &&
        at < expected.headings.indexOf(furthest.heading)
      ) {
        problems.push(
          `line ${section.line}: "${name}" is out of order; the template puts it before "## ${furthest.heading}"`
        );
      } else {
        furthest = section;
      }
    } else {
      problems.push(
        `line ${section.line}: "${name}" repeats the section at line ${first.line}`
      );
    }
  }

  for (const heading of expected.headings) {
    if (!seen.has(heading) && !OPTIONAL_SECTIONS.has(heading)) {
      problems.push(`missing section "## ${heading}"`);
    }
  }

  return { problems, seen };
}

/** Each optional section directly after the nearest template section before it that the description has. */
function checkPlacement(
  found: Section[],
  seen: Map<string, Section>,
  expected: Expected
) {
  const problems: string[] = [];

  for (const name of OPTIONAL_SECTIONS) {
    const section = seen.get(name);

    const before = expected.headings
      .slice(0, expected.headings.indexOf(name))
      .findLast((heading) => seen.has(heading));

    if (
      section !== undefined &&
      before !== undefined &&
      found[found.indexOf(section) - 1]?.heading !== before
    ) {
      problems.push(
        `line ${section.line}: "## ${name}" must come directly after "## ${before}"`
      );
    }
  }

  return problems;
}

/** The ui-evidence markers inside UI evidence, in order. */
function checkEvidence(all: Line[], seen: Map<string, Section>) {
  const problems: string[] = [];
  const evidence = seen.get(MARKER_SECTION);

  const markers = all.flatMap((line) =>
    markersOn(line).map((kind) => ({ kind, line: line.number }))
  );

  const inEvidence = new Set(evidence?.body.map((line) => line.number));

  for (const marker of markers) {
    if (!inEvidence.has(marker.line)) {
      problems.push(
        `line ${marker.line}: the ui-evidence:${marker.kind} marker sits outside "## ${MARKER_SECTION}"`
      );
    }
  }

  const order = markers.map((marker) => marker.kind).join(",");

  if (markers.length > 0 && order !== "start,end") {
    problems.push(
      `"## ${MARKER_SECTION}" needs one ui-evidence:start marker then one ui-evidence:end marker, found ${order}`
    );
  }

  return problems;
}

/** Collapsed blocks kept where required, closed, and holding the template's labels. */
function checkCollapsed(section: Section, expected: Expected) {
  const problems: string[] = [];
  const { inside, unclosed } = collapsed(section.body);

  if (COLLAPSED_SECTIONS.has(section.heading) && !inside.some(Boolean)) {
    problems.push(
      `"## ${section.heading}" (line ${section.line}) lost its <details> block`
    );
  }

  if (unclosed) {
    problems.push(
      `"## ${section.heading}" (line ${section.line}) has a <details> block with no </details>`
    );
  }

  const labels = expected.labels.get(section.heading) ?? [];

  if (COLLAPSED_SECTIONS.has(section.heading) && inside.some(Boolean)) {
    const kept = new Set(
      section.body.flatMap((line, at) =>
        inside[at] ? (BOLD_LABEL.exec(line.text)?.groups?.label ?? []) : []
      )
    );

    for (const label of labels.filter((name) => !kept.has(name))) {
      problems.push(
        `"## ${section.heading}" (line ${section.line}) lost "**${label}**" from its <details> block`
      );
    }
  }

  for (const [at, line] of section.body.entries()) {
    const label = BOLD_LABEL.exec(line.text)?.groups?.label;

    if (label !== undefined && labels.includes(label) && !inside[at]) {
      problems.push(
        `line ${line.number}: "**${label}**" under "## ${section.heading}" belongs inside its collapsed <details> block`
      );
    }
  }

  return problems;
}

/** Every required Merge danger field present, and none left empty. */
function checkFields(section: Section | undefined, expected: Expected) {
  if (section === undefined) {
    return [];
  }

  const problems: string[] = [];

  const values = new Map(
    section.body.flatMap((line) => {
      const groups = FIELD.exec(line.text)?.groups;

      return groups === undefined
        ? []
        : [[groups.label, { line, value: groups.value }]];
    })
  );

  for (const field of expected.fields) {
    const entry = values.get(field);
    const optional = OPTIONAL_FIELDS.has(field);

    if (entry === undefined && !optional) {
      problems.push(`"## ${FIELDS_SECTION}" is missing "**${field}:**"`);
    } else if (entry !== undefined && entry.value.trim() === "") {
      problems.push(
        `line ${entry.line.number}: "**${field}:**" has no value; fill it${optional ? " or delete the line" : ""}`
      );
    }
  }

  return problems;
}

/** Unfilled placeholders on one line: an issue reference, a table row, a list item. */
function checkPlaceholders(line: Line) {
  const problems: string[] = [];
  const prose = line.text.replaceAll(/`[^`]*`/gu, "");

  if (
    /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|refs)\s+#(?!\d)/iu.test(prose)
  ) {
    problems.push(`line ${line.number}: an issue reference has no number`);
  }

  const row = /^\s*\|(?<cells>.*)\|\s*$/u.exec(line.text)?.groups?.cells;

  if (row?.split("|").every((cell) => cell.trim() === "") === true) {
    problems.push(`line ${line.number}: a table row is empty`);
  }

  if (/^\s*[-*+]\s*$/u.test(line.text)) {
    problems.push(`line ${line.number}: a list item is empty`);
  }

  return problems;
}

/** Words a reader sees in `text`: tags and bullet markers dropped. */
function wordCount(text: string) {
  return text
    .replace(BULLET, "")
    .replaceAll(/<\/?[a-z][^>]*>/giu, " ")
    .split(/\s+/u)
    .filter((word) => word !== "").length;
}

/** A table's delimiter row, with or without outer pipes, such as `--- | :---:`. */
function isTableRule(text: string) {
  return text.includes("|") && text.includes("-") && /^[\s|:-]+$/u.test(text);
}

/** A table row's trimmed cells, outer pipes optional. */
function cellsOf(text: string) {
  return text
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Each table in `body` outside code fences, as GitHub reads one with or
 * without outer pipes: its header row's index and its data rows' indexes.
 */
function tablesIn(body: Line[]) {
  const found: { header: number; rows: number[] }[] = [];

  for (const [at, line] of body.entries()) {
    const header = body[at - 1];
    const current = found.at(-1);

    if (line.fenced) {
      continue;
    }

    // A row right after a table's last line extends it, whatever it holds.
    if (
      current !== undefined &&
      line.text.includes("|") &&
      (current.rows.at(-1) ?? current.header + 1) === at - 1
    ) {
      current.rows.push(at);
    } else if (
      header !== undefined &&
      !header.fenced &&
      header.text.includes("|") &&
      isTableRule(line.text)
    ) {
      found.push({ header: at - 1, rows: [] });
    }
  }

  return found;
}

/** How many fenced code blocks `body` holds, each closed only by its own delimiter. */
function fencesIn(body: Line[]) {
  const DELIMITER = /^ {0,3}(?<mark>`{3,}|~{3,})/u;
  let count = 0;
  let open = "";

  for (const line of body) {
    const mark = DELIMITER.exec(line.raw)?.groups?.mark ?? "";

    if (!line.fenced) {
      open = "";
    } else if (open === "") {
      count += 1;
      open = mark;
    } else if (
      mark.startsWith(open[0] ?? "") &&
      mark.length >= open.length &&
      line.raw.trim() === mark
    ) {
      open = "";
    }
  }

  return count;
}

/** Summary prose within its limit; one sketch and one table at most, where a table may be the sketch. */
function checkSummary(section: Section | undefined) {
  if (section === undefined) {
    return [];
  }

  const problems: string[] = [];
  const name = `"## ${section.heading}"`;
  const tables = tablesIn(section.body);

  const tableLines = new Set(
    tables.flatMap((table) => [table.header, table.header + 1, ...table.rows])
  );

  const prose = section.body.filter(
    (line, at) =>
      !line.fenced && !tableLines.has(at) && !ISSUE_LINE.test(line.text)
  );

  const count = prose.reduce((sum, line) => sum + wordCount(line.text), 0);

  if (count > LIMITS.summaryWords) {
    problems.push(
      `line ${section.line}: ${name} has ${count} words of prose; keep it within ${LIMITS.summaryWords}, with proof under Verification and choices under Decisions`
    );
  }

  const sketches = fencesIn(section.body);

  if (sketches > 1) {
    problems.push(
      `line ${section.line}: ${name} has ${sketches} code sketches; keep at most one`
    );
  } else if (sketches + tables.length > 2) {
    problems.push(
      `line ${section.line}: ${name} has ${sketches + tables.length} sketches and tables; keep at most one sketch and one before/after table`
    );
  }

  return problems;
}

/** Each Merge danger field's label and whole value, wrapped lines joined. */
function fieldValues(section: Section | undefined) {
  const found: { label: string; line: Line; value: string }[] = [];

  for (const line of section?.body ?? []) {
    const groups = FIELD.exec(line.text)?.groups;
    const last = found.at(-1);

    if (groups !== undefined) {
      found.push({ label: groups.label, line, value: groups.value.trim() });
    } else if (
      last !== undefined &&
      line.text.trim() !== "" &&
      !BULLET.test(line.text)
    ) {
      last.value = `${last.value} ${line.text.trim()}`.trim();
    }
  }

  return found;
}

/** Merge danger values in their fixed form, or a short phrase. */
function checkFieldForms(section: Section | undefined) {
  const problems: string[] = [];

  for (const { label, line, value } of fieldValues(section)) {
    if (value === "") {
      continue;
    }

    const form = FIELD_FORMS.get(label);
    const count = wordCount(value);

    if (form !== undefined && !form.matches(value)) {
      problems.push(`line ${line.number}: "**${label}:**" ${form.rule}`);
    } else if (PHRASE_FIELDS.has(label) && count > LIMITS.fieldWords) {
      problems.push(
        `line ${line.number}: "**${label}:**" has ${count} words; keep it a phrase within ${LIMITS.fieldWords}, with reasons under Decisions`
      );
    }
  }

  return problems;
}

/** The visible Decisions list: few enough items, each short. */
function checkDecisions(section: Section | undefined) {
  if (section === undefined) {
    return [];
  }

  const { inside } = collapsed(section.body);

  const visibleLines = section.body.filter(
    (line, at) => !inside[at] && !line.fenced
  );

  // The list's own indent: its first bullet's. Deeper by two or more is nested.
  const root =
    visibleLines
      .map((line) => BULLET.exec(line.text)?.groups?.indent.length)
      .find((length) => length !== undefined) ?? 0;

  const items: { line: Line; words: number; ask: boolean }[] = [];
  // Whether the line before continues an item, so a flush-left line joins it.
  let open = false;

  for (const line of visibleLines) {
    const indent = BULLET.exec(line.text)?.groups?.indent;
    const item = items.at(-1);

    if (line.text.trim() === "") {
      open = false;
    } else if (indent !== undefined && indent.length < root + 2) {
      items.push({
        ask: ASK.test(line.text.replace(BULLET, "")),
        line,
        words: wordCount(line.text),
      });
      open = true;
    } else if (item !== undefined && (open || /^\s/u.test(line.text))) {
      item.words += wordCount(line.text);
      open = true;
    }
  }

  const problems: string[] = [];

  if (items.length > LIMITS.decisionsVisible) {
    problems.push(
      `line ${section.line}: "## ${section.heading}" shows ${items.length} bullets; keep at most ${LIMITS.decisionsVisible} visible and move the rest into the collapsed block`
    );
  }

  for (const item of items) {
    const limit = item.ask ? LIMITS.askWords : LIMITS.choiceWords;

    if (item.words > limit) {
      problems.push(
        `line ${item.line.number}: a Decisions ${item.ask ? "item for the owner" : "choice"} has ${item.words} words; keep it within ${limit}, with its reason in the collapsed block`
      );
    }
  }

  return problems;
}

/** Whether `text` names `head` by a SHA prefix of at least 7 characters. */
function namesHead(text: string, head: string) {
  return text
    .split(/[^0-9a-z]+/iu)
    .some(
      (token) =>
        COMMIT.test(token) && head.toLowerCase().startsWith(token.toLowerCase())
    );
}

/** The Verification outcome line within its limit and, given `head`, naming it. */
function checkOutcome(section: Section, head?: string) {
  const at = section.body.findIndex((line) => /<summary>/iu.test(line.text));
  const outcome = section.body[at];

  if (outcome === undefined) {
    const { inside } = collapsed(section.body);

    return inside.some(Boolean)
      ? [
          `"## ${section.heading}" (line ${section.line}) has no <summary> outcome line naming the head commit`,
        ]
      : [];
  }

  const problems: string[] = [];

  const end = section.body.findIndex(
    (line, index) => index >= at && /<\/summary>/iu.test(line.text)
  );

  const joined = section.body
    .slice(at, end === -1 ? at + 1 : end + 1)
    .map((line) => line.text)
    .join(" ");

  const text =
    /<summary>(?<text>.*?)(?:<\/summary>|$)/isu.exec(joined)?.groups?.text ??
    "";

  const visibleText = text.replaceAll(/<\/?[a-z][^>]*>/giu, " ");
  const count = wordCount(visibleText);

  if (count > LIMITS.outcomeWords) {
    problems.push(
      `line ${outcome.number}: the Verification outcome line has ${count} words; keep it within ${LIMITS.outcomeWords}`
    );
  }

  if (head !== undefined && !namesHead(visibleText, head)) {
    problems.push(
      `line ${outcome.number}: the Verification outcome line does not name the head commit ${head.slice(0, 7)}; rewrite Verification for the final head`
    );
  }

  return problems;
}

/** The Commit cell of each data row in every table between the Checks label and the next label. */
function checkRows(section: Section) {
  const labelAt = (from: number, test: (label: string) => boolean) =>
    section.body.findIndex((line, at) => {
      const label = BOLD_LABEL.exec(line.text)?.groups?.label;

      return at > from && label !== undefined && test(label);
    });

  const start = labelAt(-1, (label) => label === CHECKS_LABEL);
  const next = labelAt(start, () => true);

  if (start === -1) {
    return [];
  }

  return tablesIn(section.body)
    .filter(({ header }) => header > start && (next === -1 || header < next))
    .flatMap(({ rows }) => rows)
    .flatMap((at) => {
      const line = section.body[at];
      const cells = cellsOf(line?.text ?? "");

      // A row of empty cells is the placeholder check's to report.
      return line === undefined || cells.every((cell) => cell === "")
        ? []
        : [{ commit: cells[0] ?? "", line }];
    });
}

/**
 * The Verification outcome line within its limit, and, given the head commit,
 * the outcome line and every Checks row naming it.
 */
function checkVerification(section: Section | undefined, head?: string) {
  if (section === undefined) {
    return [];
  }

  const problems = checkOutcome(section, head);

  if (head !== undefined) {
    for (const row of checkRows(section)) {
      if (!namesHead(row.commit, head)) {
        problems.push(
          `line ${row.line.number}: this Checks row names another commit, not the head ${head.slice(0, 7)}; replace it with a run at the head, and name a guard's failing run in the guards line instead`
        );
      }
    }
  }

  return problems;
}

/** The declarations under Qualification, and each way they break its rules. */
function checkQualification(seen: Map<string, Section>, body: string) {
  const section = seen.get(QUALIFICATION_SECTION);

  if (section === undefined) {
    return { declarations: [], present: false, problems: [] };
  }

  const { declarations, problems } = parseQualification(section.body);
  const summary = seen.get("Summary")?.body ?? [];

  return {
    declarations,
    present: true,
    problems: [...problems, ...checkReferences(declarations, summary, body)],
  };
}

function parse(body: string, template: string) {
  const expected = expectations(template);

  const all = withoutBotBlocks(
    lines(body),
    expected.headings,
    expected.comments
  );

  const found = sections(all);

  return { all, expected, found, ...checkHeadings(found, expected) };
}

/**
 * The issues `body` declares under Qualification, or the problems that keep
 * it from being applied. scripts/apply-qualification.ts reads it on merge.
 */
export function readQualification(body: string, template: string) {
  return checkQualification(parse(body, template).seen, body);
}

/**
 * Every way `body` drifts from `template`, each naming its heading or line.
 * Given `head`, the pull request's head commit, Verification must name it.
 */
export function check(
  body: string,
  template: string,
  { head }: { head?: string } = {}
) {
  const { all, expected, found, problems, seen } = parse(body, template);

  return [
    ...problems,
    ...checkPlacement(found, seen, expected),
    ...checkEvidence(all, seen),
    ...checkQualification(seen, body).problems,
    ...[...seen.values()].flatMap((section) =>
      checkCollapsed(section, expected)
    ),
    ...checkFields(seen.get(FIELDS_SECTION), expected),
    ...checkSummary(seen.get(SUMMARY_SECTION)),
    ...checkFieldForms(seen.get(FIELDS_SECTION)),
    ...checkVerification(seen.get(VERIFICATION_SECTION), head),
    ...checkDecisions(seen.get(DECISIONS_SECTION)),
    ...all.filter((line) => !line.fenced).flatMap(checkPlaceholders),
  ];
}

if (import.meta.main) {
  const [source, flag, head, ...rest] = process.argv.slice(2);

  if (
    source === undefined ||
    rest.length > 0 ||
    (flag !== undefined && (flag !== "--head" || !COMMIT.test(head ?? "")))
  ) {
    console.error("Usage: pnpm pr:verify <body-file | -> [--head <sha>]");
    process.exit(2);
  }

  const body = fs.readFileSync(source === "-" ? 0 : source, "utf-8");

  const problems = check(body, fs.readFileSync(TEMPLATE_PATH, "utf-8"), {
    head,
  });

  if (problems.length === 0) {
    console.log("The description matches .github/pull_request_template.md.");
  } else {
    console.error(
      `The description drifts from .github/pull_request_template.md:\n- ${problems.join("\n- ")}\n\nEdit the description to fix each line; this check reruns on every edit.`
    );
    process.exitCode = 1;
  }
}

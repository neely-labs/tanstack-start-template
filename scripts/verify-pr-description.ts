// Checks a pull request description against the sections, order and filled
// placeholders of .github/pull_request_template.md, which stays the one place
// that names the sections. CI runs it on every description edit and push
// (.github/workflows/pr-description.yml); run it locally on a saved body with
// `pnpm pr:verify <file>`, or `-` to read standard input.
import fs from "node:fs";
import path from "node:path";

/** Sections a description may delete. Every other template section is required. */
const OPTIONAL_SECTIONS = new Set(["UI evidence"]);
/** Sections that must keep the template's `<details>` block. */
const COLLAPSED_SECTIONS = new Set(["Verification"]);
/** The section whose `- **Field:** value` lines are checked, and its optional fields. */
const FIELDS_SECTION = "Merge danger";
const OPTIONAL_FIELDS = new Set(["Rollback"]);
/** The section that holds the evidence publisher's markers. */
const MARKER_SECTION = "UI evidence";
const MARKER = /<!--\s*ui-evidence:(?<kind>start|end)\s*-->/gu;

interface Line {
  /** 1-based line number in the description. */
  number: number;
  raw: string;
  /** The line with HTML comments removed; empty inside a code fence. */
  text: string;
  /** Inside a fenced code block, delimiters included. */
  fenced: boolean;
  /** Starts a comment that is not inside another one. */
  opensComment: boolean;
}

interface Section {
  heading: string;
  /** `#` or `##`, as written. */
  marker: string;
  line: number;
  body: Line[];
}

function lines(markdown: string): Line[] {
  let fence = "";
  let inComment = false;
  return markdown.split(/\r?\n/u).map((raw, at) => {
    const delimiter = /^ {0,3}(?<m>`{3,}|~{3,})/u.exec(raw)?.groups?.m ?? "";
    if (!inComment && fence === "" && delimiter !== "") {
      fence = delimiter;
      return {
        fenced: true,
        number: at + 1,
        opensComment: false,
        raw,
        text: "",
      };
    }
    if (fence !== "") {
      if (delimiter.startsWith(fence) && raw.trim() === delimiter) {
        fence = "";
      }
      return {
        fenced: true,
        number: at + 1,
        opensComment: false,
        raw,
        text: "",
      };
    }
    const opensComment = !inComment && raw.trimStart().startsWith("<!--");
    let text = "";
    let rest = raw;
    while (rest !== "") {
      if (inComment) {
        const close = rest.indexOf("-->");
        if (close === -1) {
          rest = "";
        } else {
          inComment = false;
          rest = rest.slice(close + 3);
        }
      } else {
        const open = rest.indexOf("<!--");
        if (open === -1) {
          text += rest;
          rest = "";
        } else {
          text += rest.slice(0, open);
          inComment = true;
          rest = rest.slice(open + 4);
        }
      }
    }
    return { fenced: false, number: at + 1, opensComment, raw, text };
  });
}

/** A level 1 or 2 heading's marker and text. */
function headingOf(line: Line) {
  return /^ {0,3}(?<marker>##?)[ \t]+(?<heading>.*?)(?:[ \t]+#+)?[ \t]*$/u.exec(
    line.text
  )?.groups;
}

/** Level 1 and 2 headings and the lines under each; lines before the first are dropped. */
function sections(all: Line[]): Section[] {
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
  const fields =
    found
      .find((section) => section.heading === FIELDS_SECTION)
      ?.body.flatMap((line) => FIELD.exec(line.text)?.groups?.label ?? []) ??
    [];
  const comments = new Set(
    all.filter((line) => line.opensComment).map((line) => line.raw.trim())
  );
  return { comments, fields, headings, labels };
}

/**
 * Drops what bots appended after the template's last heading. A bot block starts
 * at a comment the template does not contain, such as `<!-- codesmith:footer -->`,
 * and runs until a template heading or a ui-evidence marker, so evidence or a
 * section appended after a bot footer is still checked.
 */
function withoutBotBlocks(
  all: Line[],
  headings: string[],
  comments: Set<string>
) {
  const last = headings.at(-1);
  const start = all.find((line) => headingOf(line)?.heading === last);
  if (start === undefined) {
    return all;
  }
  let inBlock = false;
  return all.filter((line) => {
    if (line.number <= start.number) {
      return true;
    }
    const heading = headingOf(line);
    if (
      line.raw.match(MARKER) !== null ||
      (heading?.marker === "##" && headings.includes(heading.heading))
    ) {
      inBlock = false;
    } else if (line.opensComment && !comments.has(line.raw.trim())) {
      inBlock = true;
    }
    return !inBlock;
  });
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

/** UI evidence directly after its template neighbor, with its markers inside it. */
function checkEvidence(
  all: Line[],
  found: Section[],
  seen: Map<string, Section>,
  expected: Expected
) {
  const problems: string[] = [];
  const evidence = seen.get(MARKER_SECTION);
  const index = expected.headings.indexOf(MARKER_SECTION);
  const before = index > 0 ? expected.headings[index - 1] : undefined;
  if (
    evidence !== undefined &&
    before !== undefined &&
    found[found.indexOf(evidence) - 1]?.heading !== before
  ) {
    problems.push(
      `line ${evidence.line}: "## ${MARKER_SECTION}" must come directly after "## ${before}"`
    );
  }
  const markers = all
    .filter((line) => !line.fenced)
    .flatMap((line) =>
      [...line.raw.matchAll(MARKER)].map((match) => ({
        kind: match.groups?.kind ?? "",
        line: line.number,
      }))
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

/** Every way `body` drifts from `template`, each naming its heading or line. */
export function check(body: string, template: string): string[] {
  const expected = expectations(template);
  const all = withoutBotBlocks(
    lines(body),
    expected.headings,
    expected.comments
  );
  const found = sections(all);
  const { problems, seen } = checkHeadings(found, expected);
  return [
    ...problems,
    ...checkEvidence(all, found, seen, expected),
    ...[...seen.values()].flatMap((section) =>
      checkCollapsed(section, expected)
    ),
    ...checkFields(seen.get(FIELDS_SECTION), expected),
    ...all.filter((line) => !line.fenced).flatMap(checkPlaceholders),
  ];
}

if (import.meta.main) {
  const source = process.argv.at(2);
  if (source === undefined) {
    console.error("Usage: pnpm pr:verify <body-file | ->");
    process.exit(2);
  }
  const templatePath = path.join(
    import.meta.dirname,
    "../.github/pull_request_template.md"
  );
  const body = fs.readFileSync(source === "-" ? 0 : source, "utf-8");
  const problems = check(body, fs.readFileSync(templatePath, "utf-8"));
  if (problems.length === 0) {
    console.log("The description matches .github/pull_request_template.md.");
  } else {
    console.error(
      `The description drifts from .github/pull_request_template.md:\n- ${problems.join("\n- ")}\n\nEdit the description to fix each line; this check reruns on every edit.`
    );
    process.exitCode = 1;
  }
}

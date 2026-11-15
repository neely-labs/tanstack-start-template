// Splits Markdown into lines the way GitHub reads them: which lines sit in a
// code fence or an HTML comment, and each line's text outside comments. Shared by
// scripts/verify-pr-description.ts and scripts/apply-qualification.ts.

export interface MarkdownLine {
  /** 1-based line number. */
  number: number;
  raw: string;
  /** The line without HTML comments, with `<` in code spans escaped; empty inside a code fence. */
  text: string;
  /** Inside a fenced code block, delimiters included. */
  fenced: boolean;
  /** Some part of the line sits inside an HTML comment. */
  commented: boolean;
  /** Each HTML comment that opens on this line: its trimmed text and the index of its last line. */
  comments: { text: string; end: number }[];
}

/**
 * A code span: a backtick run, then text up to the same run, within one
 * paragraph. HTML inside one is text, so it is escaped before parsing.
 */
const CODE_SPAN =
  /(?<!`)(?<run>`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])+?(?<!`)\k<run>(?!`)/gu;

/** Where an HTML comment ends: `-->`, or `--!>` as HTML also allows. */
const COMMENT_END = /--!?>/u;

function escapeCode(text: string) {
  return text.replaceAll(CODE_SPAN, (span) => span.replaceAll("<", "&lt;"));
}

/**
 * Which lines sit in a code fence, delimiters included, and whether a fence is
 * still open after the last line; a fence cannot open inside a comment.
 */
function fencedLines(raws: string[]) {
  let fence = "";
  let inComment = false;
  // Prose since the last fence, scanned whole: a code span can cross lines.
  let prose: string[] = [];
  const fenced = raws.map((raw) => {
    const delimiter = /^ {0,3}(?<m>`{3,}|~{3,})/u.exec(raw)?.groups?.m ?? "";
    if (!inComment && fence === "" && delimiter !== "") {
      fence = delimiter;
      prose = [];
      return true;
    }
    if (fence !== "") {
      if (delimiter.startsWith(fence) && raw.trim() === delimiter) {
        fence = "";
      }
      return true;
    }
    prose.push(raw);
    inComment = false;
    for (const [token] of escapeCode(prose.join("\n")).matchAll(
      /<!--|--!?>/gu
    )) {
      inComment = token === "<!--";
    }
    return false;
  });
  return { fenced, open: fence !== "" };
}

/** Each line with code-span HTML escaped; spans never cross a fence or a blank line. */
function escapedLines(raws: string[], fenced: boolean[]) {
  const escaped = [...raws];
  let start = 0;
  for (let at = 0; at <= raws.length; at += 1) {
    if ((at === raws.length || fenced[at]) && at > start) {
      const run = escapeCode(raws.slice(start, at).join("\n")).split("\n");
      escaped.splice(start, run.length, ...run);
    }
    if (fenced[at]) {
      start = at + 1;
    }
  }
  return escaped;
}

/** Splits `markdown` into lines, and names the block it ends inside, if any. */
export function split(markdown: string) {
  let open: { text: string; end: number } | undefined;
  const raws = markdown.split(/\r?\n/u);
  const { fenced, open: fenceOpen } = fencedLines(raws);
  const escaped = escapedLines(raws, fenced);
  const all = raws.map((raw, at) => {
    const line: MarkdownLine = {
      commented: false,
      comments: [],
      fenced: true,
      number: at + 1,
      raw,
      text: "",
    };
    if (fenced[at]) {
      return line;
    }
    line.fenced = false;
    let rest = escaped[at] ?? "";
    line.commented = open !== undefined;
    while (rest !== "") {
      if (open === undefined) {
        const start = rest.indexOf("<!--");
        line.text += start === -1 ? rest : rest.slice(0, start);
        rest = start === -1 ? "" : rest.slice(start + 4);
        if (start !== -1) {
          line.commented = true;
          open = { end: at, text: "" };
          line.comments.push(open);
        }
      } else {
        const close = COMMENT_END.exec(rest);
        open.end = at;
        open.text = `${open.text}\n${close === null ? rest : rest.slice(0, close.index)}`;
        rest = close === null ? "" : rest.slice(close.index + close[0].length);
        if (close !== null) {
          open.text = open.text.trim();
          open = undefined;
        }
      }
    }
    return line;
  });
  let unclosed: "code fence" | "HTML comment" | undefined;
  if (fenceOpen) {
    unclosed = "code fence";
  } else if (open !== undefined) {
    unclosed = "HTML comment";
  }
  return { lines: all, unclosed };
}

/** Each line of `markdown`, with comments and code fences marked. */
export function lines(markdown: string): MarkdownLine[] {
  return split(markdown).lines;
}

/** A level 1 or 2 heading's marker and text. */
export function headingOf(line: MarkdownLine) {
  return /^ {0,3}(?<marker>##?)[ \t]+(?<heading>.*?)(?:[ \t]+#+)?[ \t]*$/u.exec(
    line.text
  )?.groups;
}

/** A heading's text at any level, or undefined for another line. */
export function anyHeadingOf(line: MarkdownLine) {
  return /^ {0,3}#{1,6}[ \t]+(?<heading>.*?)(?:[ \t]+#+)?[ \t]*$/u.exec(
    line.text
  )?.groups?.heading;
}

/**
 * The text of each heading in `markdown`, at any level, outside code fences and
 * comments. A line of text above a `===` or `---` underline counts too; taking
 * a paragraph for a heading there only makes a caller more cautious.
 */
export function headingTexts(markdown: string) {
  const all = lines(markdown);
  return all.flatMap((line, index) => {
    const underlined =
      !line.fenced &&
      line.text.trim() !== "" &&
      /^ {0,3}(?:=+|-+)[ \t]*$/u.test(all[index + 1]?.text ?? "");
    return anyHeadingOf(line) ?? (underlined ? line.text.trim() : []);
  });
}

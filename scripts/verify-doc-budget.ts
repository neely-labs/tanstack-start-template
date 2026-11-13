// Agents read these docs on every task, so prose regrows unless a check caps it;
// a total cap alone lets one file balloon. Run by `pnpm validate` and docs-only CI.
import fs from "node:fs";
import path from "node:path";

/**
 * Limits in UTF-8 bytes and the always-read set, as paths or globs from the root;
 * `file#Heading` counts only that `## Heading` section. Edit here to change either.
 */
export const BUDGET = {
  docs: [
    "AGENTS.md",
    "PRODUCT.md#Product Purpose",
    "PRODUCT.md#Cross-cutting invariants",
    "docs/development.md",
    "docs/agents/*.md",
  ],
  fileBytes: 12_000,
  totalBytes: 32_000,
};

const advice = `Move detail out of the always-read set rather than raising a limit:
- How an area works: the owning module's header comment.
- Steps only some tasks need: a guide linked from the "Read when" table in AGENTS.md.
- A rule another doc owns: a link to that doc.
- Dated history and measurements: the pull request or issue.
Raise a limit in BUDGET, scripts/verify-doc-budget.ts, only for deliberate growth.`;

/** A `## heading` section, up to the next level 1 or 2 heading outside a code fence. */
function section(text: string, heading: string): string | null {
  let fence = "";
  const lines = text.split(/(?<=\n)/u);
  const isHeading = lines.map((line) => {
    const marker = /^ {0,3}(?<m>`{3,}|~{3,})/u.exec(line)?.groups?.m ?? "";
    if (marker !== "" && fence === "") {
      fence = marker;
    } else if (marker.startsWith(fence) && line.trim() === marker) {
      fence = "";
    }
    return fence === "" && /^#{1,2} /u.test(line);
  });
  const start = lines.findIndex(
    (line, at) => isHeading[at] && line.trimEnd() === `## ${heading}`
  );
  if (start === -1) {
    return null;
  }
  const end = isHeading.findIndex((flag, at) => flag && at > start);
  return lines.slice(start, end === -1 ? undefined : end).join("");
}

/** Each file's bytes in the set, and every way the set breaks the budget. */
export function check(budget: typeof BUDGET, root: string) {
  const sizes = new Map<string, number>();
  const problems: string[] = [];
  for (const entry of budget.docs) {
    const [pattern, heading] = entry.split("#", 2);
    // oxlint-disable-next-line no-array-sort -- sorts a copy; the ES2022 lib lacks toSorted.
    const files = [...fs.globSync(pattern, { cwd: root })].sort();
    if (files.length === 0) {
      problems.push(`${pattern} matches no file`);
    }
    for (const file of files) {
      const text = fs.readFileSync(path.join(root, file), "utf-8");
      const part = heading === undefined ? text : section(text, heading);
      if (part === null) {
        problems.push(`${file} has no "## ${heading}" section`);
      }
      sizes.set(file, (sizes.get(file) ?? 0) + Buffer.byteLength(part ?? ""));
    }
  }
  for (const [file, bytes] of sizes) {
    if (bytes > budget.fileBytes) {
      problems.push(`${file}: ${bytes} bytes, file cap ${budget.fileBytes}`);
    }
  }
  const total = [...sizes.values()].reduce((sum, bytes) => sum + bytes, 0);
  if (total > budget.totalBytes) {
    problems.push(`total: ${total} bytes, total cap ${budget.totalBytes}`);
  }
  return { problems, sizes, total };
}

if (import.meta.main) {
  const root = path.join(import.meta.dirname, "..");
  const { problems, sizes, total } = check(BUDGET, root);
  for (const [file, bytes] of sizes) {
    console.log(`${String(bytes).padStart(7)}  ${file}`);
  }
  console.log(
    `${String(total).padStart(7)}  total (caps: ${BUDGET.fileBytes} per file, ${BUDGET.totalBytes} in all)`
  );
  if (problems.length > 0) {
    console.error(
      `\nDoc budget exceeded:\n- ${problems.join("\n- ")}\n\n${advice}`
    );
    process.exitCode = 1;
  }
}

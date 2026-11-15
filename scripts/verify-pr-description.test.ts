import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { TEMPLATE_PATH, check } from "./verify-pr-description.ts";

const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

const summary = `## Summary

The example page now names its input limit.

\`\`\`diff
 ## UI evidence
+<!-- ui-evidence:start -->
+## Not a heading
\`\`\`

Closes #1`;

const evidence = `## UI evidence

<!-- ui-evidence:start -->
![After](https://example.com/after.png)

<details><summary>Before, at main</summary>

![Before](https://example.com/before.png)

</details>
<!-- ui-evidence:end -->`;

const mergeDanger = `## Merge danger

- **Door:** clean two-way
- **Risk tier:** 1
- **Rounds used:** 1 of 3
- **Blast radius:** one page`;

const verification = `## Verification

<details>
<summary>All checks green at abc1234; review approved abc1234</summary>

**Checks**

| Commit | Command | Result | Limits |
| ------ | ------- | ------ | ------ |
| abc1234 | \`pnpm validate\` | 150 passed, 0 skipped | local |

**Reviews**

| Round | Reviewer | Head | Outcome |
| ----- | -------- | ---- | ------- |
| 1 | Fresh agent | abc1234 | No findings |

</details>`;

const decisions = `## Decisions

- Treated this as tier 1

<details>
<summary>Reasons, declined findings and walk notes</summary>

**Reasons**

- Tier 1: it changes what people see.

</details>`;

const parts = {
  Summary: summary,
  "UI evidence": evidence,
  "Merge danger": mergeDanger,
  Verification: verification,
  Decisions: decisions,
};

/** A description in the template's shape; `overrides` replace sections by heading, and null drops one. */
function describeWith(
  overrides: Partial<Record<keyof typeof parts, string | null>> = {}
) {
  return Object.entries({ ...parts, ...overrides })
    .flatMap(([, part]) => part ?? [])
    .join("\n\n");
}

describe(check, () => {
  it("passes a description in the template's shape", () => {
    expect(check(describeWith(), template)).toStrictEqual([]);
  });

  it("passes without the optional UI evidence section and Rollback line", () => {
    const body = describeWith({ "UI evidence": null });
    expect(body).not.toContain("Rollback");
    expect(check(body, template)).toStrictEqual([]);
  });

  it("passes a filled Rollback line", () => {
    const body = describeWith({
      "Merge danger": `${mergeDanger}\n- **Rollback:** revert, then clear the cache`,
    });
    expect(check(body, template)).toStrictEqual([]);
  });

  it("fails UI evidence at the bottom, naming where it belongs", () => {
    const body = `${describeWith({ "UI evidence": null })}\n\n${evidence}`;
    const problems = check(body, template);
    expect(problems).toContainEqual(
      expect.stringMatching(
        /"## UI evidence" must come directly after "## Summary"/u
      )
    );
    expect(problems).toContainEqual(
      expect.stringMatching(/"## UI evidence" is out of order/u)
    );
  });

  it("fails markers that wrap the heading instead of sitting inside it", () => {
    const wrapped = evidence
      .replace("<!-- ui-evidence:start -->\n", "")
      .replace("## UI evidence", "<!-- ui-evidence:start -->\n## UI evidence");
    const problems = check(describeWith({ "UI evidence": wrapped }), template);
    expect(problems).toStrictEqual([
      expect.stringMatching(
        /ui-evidence:start marker sits outside "## UI evidence"/u
      ),
    ]);
  });

  it("passes when UI evidence is deleted, markers included", () => {
    expect(
      check(describeWith({ "UI evidence": null }), template)
    ).toStrictEqual([]);
  });

  it("fails markers left behind when UI evidence is deleted", () => {
    const body = describeWith({
      "UI evidence": "<!-- ui-evidence:start -->\n<!-- ui-evidence:end -->",
    });
    const problems = check(body, template);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/ui-evidence:start marker sits outside/u);
    expect(problems[1]).toMatch(/ui-evidence:end marker sits outside/u);
  });

  it("fails a lone marker", () => {
    const body = describeWith({
      "UI evidence": evidence.replace("<!-- ui-evidence:end -->", ""),
    });
    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(/one ui-evidence:start marker then one/u),
    ]);
  });

  it("fails a missing section", () => {
    expect(check(describeWith({ Verification: null }), template)).toStrictEqual(
      ['missing section "## Verification"']
    );
  });

  it("fails an added top-level section, at either heading level", () => {
    const body = describeWith({
      Decisions: `${decisions}\n\n## Notes\n\nMore.\n\n# Appendix\n\nEven more.`,
    });
    const problems = check(body, template);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/"## Notes" is not a template section/u);
    expect(problems[1]).toMatch(/"# Appendix" is not a template section/u);
  });

  it("fails a repeated section", () => {
    const body = `${describeWith()}\n\n${mergeDanger}`;
    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(/"## Merge danger" repeats the section at line/u),
    ]);
  });

  it("fails reordered sections", () => {
    const body = [summary, evidence, verification, mergeDanger, decisions].join(
      "\n\n"
    );
    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(
        /"## Merge danger" is out of order; the template puts it before "## Verification"/u
      ),
    ]);
  });

  it("fails Verification without its <details> block", () => {
    const flat = verification
      .replace(/<details>\n<summary>.*<\/summary>\n/u, "")
      .replace("</details>", "");
    const problems = check(describeWith({ Verification: flat }), template);
    expect(problems[0]).toMatch(
      /"## Verification" .* lost its <details> block/u
    );
    expect(problems).toContainEqual(
      expect.stringMatching(
        /"\*\*Checks\*\*" under "## Verification" belongs inside/u
      )
    );
  });

  it("fails Verification whose <details> block lost its tables", () => {
    const emptied =
      "## Verification\n\n<details>\n<summary>All green at abc1234</summary>\n\n</details>";
    expect(
      check(describeWith({ Verification: emptied }), template)
    ).toStrictEqual([
      expect.stringMatching(/"## Verification" .* lost "\*\*Checks\*\*"/u),
      expect.stringMatching(/"## Verification" .* lost "\*\*Reviews\*\*"/u),
    ]);
  });

  it("ignores a marker written as inline code", () => {
    const body = describeWith({
      Decisions: `${decisions}\n\nThe publisher writes after \`<!-- ui-evidence:start -->\`.`,
    });
    expect(check(body, template)).toStrictEqual([]);
  });

  it("fails Decisions reasons spilled out of their collapsed block", () => {
    const spilled =
      "## Decisions\n\n- Treated this as tier 1\n\n**Reasons**\n\n- It changes what people see.";
    expect(check(describeWith({ Decisions: spilled }), template)).toStrictEqual(
      [
        expect.stringMatching(
          /"\*\*Reasons\*\*" under "## Decisions" belongs inside/u
        ),
      ]
    );
  });

  it("passes Decisions without a collapsed block when it has nothing to collapse", () => {
    const body = describeWith({
      Decisions: "## Decisions\n\n- Treated this as tier 1",
    });
    expect(check(body, template)).toStrictEqual([]);
  });

  it("fails a <details> block left open", () => {
    const open = decisions.replace("</details>", "");
    expect(check(describeWith({ Decisions: open }), template)).toStrictEqual([
      expect.stringMatching(
        /"## Decisions" .* has a <details> block with no <\/details>/u
      ),
    ]);
  });

  it("fails each unfilled placeholder, naming its line", () => {
    const body = describeWith({
      Decisions:
        '## Decisions\n\n- <!-- One choice, such as "Kept the old route" -->',
      "Merge danger": `${mergeDanger.replace("clean two-way", "<!-- clean two-way, two-way, one-way -->")}\n- **Rollback:** <!-- Only when the door is not clean two-way -->`,
      Summary: summary.replace("Closes #1", "Closes #"),
      Verification: verification.replace(
        "| 1 | Fresh agent | abc1234 | No findings |",
        "|       |          |      |         |"
      ),
    });
    const problems = check(body, template);
    expect(problems).toHaveLength(5);
    expect(problems).toStrictEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^line \d+: "\*\*Door:\*\*" has no value; fill it$/u
        ),
        expect.stringMatching(
          /^line \d+: "\*\*Rollback:\*\*" has no value; fill it or delete the line$/u
        ),
        expect.stringMatching(/^line \d+: an issue reference has no number$/u),
        expect.stringMatching(/^line \d+: a table row is empty$/u),
        expect.stringMatching(/^line \d+: a list item is empty$/u),
      ])
    );
  });

  it("ignores placeholders written as code or inside a code fence", () => {
    const body = describeWith({
      Summary: `${summary}\n\nThe template's \`Closes #N\` line.\n\n\`\`\`md\nCloses #\n|   |   |\n\`\`\``,
    });
    expect(check(body, template)).toStrictEqual([]);
  });

  it("fails a missing Merge danger field", () => {
    const body = describeWith({
      "Merge danger": mergeDanger.replace("- **Door:** clean two-way\n", ""),
    });
    expect(check(body, template)).toStrictEqual([
      '"## Merge danger" is missing "**Door:**"',
    ]);
  });

  it("ignores a bot footer after Decisions, even one with headings and empty rows", () => {
    const footer = [
      "<!-- codesmith:footer -->",
      "---",
      "## Summary by a bot",
      "|  |  |",
      "- ",
      "Closes #",
      "<!-- /codesmith:footer -->",
    ].join("\n");
    expect(check(`${describeWith()}\n\n${footer}\n`, template)).toStrictEqual(
      []
    );
  });

  it("treats a comment before the last section as the author's, not a bot's", () => {
    const body = describeWith({
      Summary: summary.replace(
        "Closes #1",
        "<!-- note to self -->\n\nCloses #"
      ),
    });
    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(/an issue reference has no number/u),
    ]);
  });

  it("checks what follows a bot footer's closing comment", () => {
    const footer =
      "<!-- codesmith:footer -->\n---\nOpen in codesmith\n<!-- /codesmith:footer -->";
    const body = `${describeWith()}\n\n${footer}\n\n## Follow-ups\n\n|  |  |`;
    const problems = check(body, template);
    expect(problems).toHaveLength(2);
    expect(problems).toStrictEqual(
      expect.arrayContaining([
        expect.stringMatching(/"## Follow-ups" is not a template section/u),
        expect.stringMatching(/a table row is empty/u),
      ])
    );
  });

  it("checks what follows an author's comment after the last section", () => {
    const body = `${describeWith()}\n\n<!-- my note -->\n\n## Notes\n\n- `;
    const problems = check(body, template);
    expect(problems).toHaveLength(2);
    expect(problems).toStrictEqual(
      expect.arrayContaining([
        expect.stringMatching(/"## Notes" is not a template section/u),
        expect.stringMatching(/a list item is empty/u),
      ])
    );
  });

  it("still checks UI evidence appended after a bot footer", () => {
    const footer =
      "<!-- codesmith:footer -->\n---\nOpen in codesmith\n<!-- /codesmith:footer -->";
    const body = `${describeWith({ "UI evidence": null })}\n\n${footer}\n\n${evidence}`;
    const problems = check(body, template);
    expect(problems).toContainEqual(
      expect.stringMatching(
        /"## UI evidence" must come directly after "## Summary"/u
      )
    );
  });

  it("still checks Decisions when the author kept a template comment in it", () => {
    const body = describeWith({
      Decisions: `## Decisions\n\n<!-- Choices you made on the owner's behalf: one short line each, stating the choice only. The collapsed block holds each choice's reason, each review or walk finding you declined with why, and any walk notes. Delete whatever stays empty, the whole block included. -->\n\n- \n\n## Notes`,
    });
    const problems = check(body, template);
    expect(problems).toHaveLength(2);
  });

  it("takes the sections from the template, so a template change needs no script edit", () => {
    const extended = template.replace(
      "## Decisions",
      "## Risks\n\n<!-- What could go wrong. -->\n\n## Decisions"
    );
    expect(check(describeWith(), extended)).toStrictEqual([
      'missing section "## Risks"',
    ]);
    const body = describeWith({
      Decisions: `## Risks\n\nNone known.\n\n${decisions}`,
    });
    expect(check(body, extended)).toStrictEqual([]);
  });

  it("throws when the template drops a section the script names", () => {
    expect(() =>
      check(describeWith(), template.replace("## Merge danger", "## Danger"))
    ).toThrow(/no "## Merge danger" section/u);
  });

  it("reads CRLF line endings, as GitHub stores edited descriptions", () => {
    expect(
      check(describeWith().replaceAll("\n", "\r\n"), template)
    ).toStrictEqual([]);
  });
});

import fs from "node:fs";

import { describe, expect, it } from "vitest";

import {
  TEMPLATE_PATH,
  check,
  readQualification,
} from "./verify-pr-description.ts";

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
  Qualification: null,
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

  it("reads HTML inside inline code as text", () => {
    const body = describeWith({
      Summary: `${summary}\n\nRecognizes the \`<!--\` delimiter and \`<details>\` blocks.`,
    });
    expect(check(body, template)).toStrictEqual([]);
    const coded = verification
      .replace("<details>", "`<details>`")
      .replace("</details>", "`</details>`");
    expect(
      check(describeWith({ Verification: coded }), template)
    ).toContainEqual(
      expect.stringMatching(/"## Verification" .* lost its <details> block/u)
    );
  });

  it("reads HTML inside a code span that crosses a line break as text", () => {
    const body = describeWith({
      Summary: `${summary}\n\nRecognizes the \`<!--\ndelimiter\` in prose.`,
    });
    expect(check(body, template)).toStrictEqual([]);
    const coded = verification
      .replace("<details>", "`<details>\n`")
      .replace("</details>", "`</details>\n`");
    expect(
      check(describeWith({ Verification: coded }), template)
    ).toContainEqual(
      expect.stringMatching(/"## Verification" .* lost its <details> block/u)
    );
  });

  it("still finds a code fence after a multiline code span holding a comment opener", () => {
    const body = describeWith({
      Summary: `${summary}\n\nRecognizes the \`<!--\ndelimiter\` in prose.\n\n\`\`\`md\n## Example heading\n\`\`\``,
    });
    expect(check(body, template)).toStrictEqual([]);
  });

  it("never lets a backtick inside a code fence open a code span outside it", () => {
    const body = describeWith({
      "UI evidence":
        '## UI evidence\n\n~~~js\nconst delimiter = "`";\n~~~\n<!-- ui-evidence:start -->\nScreenshot of the `input` control.\n<!-- ui-evidence:end -->',
    });
    expect(check(body, template)).toStrictEqual([]);
  });

  it("ends a comment at --!> as HTML does", () => {
    const body = describeWith({
      Summary: summary.replace("Closes #1", "<!-- note --!>\n\nCloses #"),
    });
    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(/an issue reference has no number/u),
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

  it("ends a bot block at its own closing comment, not a later one", () => {
    const footer =
      "<!-- codesmith:footer -->\n---\nOpen in codesmith\n<!-- /codesmith:footer -->";
    const body = `${describeWith()}\n\n${footer}\n\n## Follow-ups\n\nCloses #\n\n<!-- Explain this follow-up -->`;
    expect(check(body, template)).toHaveLength(2);
  });

  it("ignores template headings inside a bot block, in each closing style", () => {
    const blocks = [
      "<!-- codesmith:footer -->\n## Summary\nBot text\n<!-- /codesmith:footer -->",
      "<!-- This is an auto-generated comment: release notes by coderabbit.ai -->\n## Summary by CodeRabbit\n<!-- end of auto-generated comment: release notes by coderabbit.ai -->",
      "<!-- Generated by sourcery-ai[bot]: start summary -->\n## Decisions\n<!-- Generated by sourcery-ai[bot]: end summary -->",
    ];
    expect(
      blocks.map((block) => check(`${describeWith()}\n\n${block}`, template))
    ).toStrictEqual([[], [], []]);
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
    const [comment] =
      /(?<=## Decisions\n\n)<!--[\s\S]*?-->/u.exec(template) ?? [];
    expect(comment).toBeDefined();
    const body = describeWith({
      Decisions: `## Decisions\n\n${comment}\n\n- \n\n## Notes`,
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

const declaring = `## Summary

The digest job is delivered; its first production send is still to come.

Refs #12
Refs #14`;

const qualification = `## Qualification

<!-- Remaining checks for each issue. -->

For #12:

- [ ] Owner confirms the weekly digest sends on 2026-12-01.
- [ ] An agent reads the send log after the first run.

For #14:

- [ ] A fresh agent repeats the setup rehearsal.`;

/** A description that declares `section` as its Qualification, with a Summary that names #12 and #14. */
function declare(
  section: string,
  overrides: Partial<Record<keyof typeof parts, string | null>> = {}
) {
  return describeWith({
    Qualification: section,
    Summary: declaring,
    ...overrides,
  });
}

describe("the Qualification section", () => {
  it("passes a well-formed section directly after Summary", () => {
    expect(check(declare(qualification), template)).toStrictEqual([]);
    expect(
      check(declare(qualification, { "UI evidence": null }), template)
    ).toStrictEqual([]);
  });

  it("reads each issue and its checks, as the apply step sees them", () => {
    expect(readQualification(declare(qualification), template)).toStrictEqual({
      declarations: [
        {
          checks: [
            "Owner confirms the weekly digest sends on 2026-12-01.",
            "An agent reads the send log after the first run.",
          ],
          issue: 12,
          line: 12,
        },
        {
          checks: ["A fresh agent repeats the setup rehearsal."],
          issue: 14,
          line: 17,
        },
      ],
      present: true,
      problems: [],
    });
  });

  it("is absent from a description without it, which changes nothing", () => {
    expect(readQualification(describeWith(), template)).toStrictEqual({
      declarations: [],
      present: false,
      problems: [],
    });
    const partial = describeWith({
      Summary: summary.replace("Closes #1", "Refs #1"),
    });
    expect(check(partial, template)).toStrictEqual([]);
    expect(readQualification(partial, template).declarations).toStrictEqual([]);
  });

  it("must come directly after Summary", () => {
    const body = [
      declaring,
      evidence,
      qualification,
      mergeDanger,
      verification,
      decisions,
    ].join("\n\n");
    expect(check(body, template)).toStrictEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /"## Qualification" must come directly after "## Summary"/u
        ),
        expect.stringMatching(/"## Qualification" is out of order/u),
      ])
    );
  });

  it.each([
    [
      "no For group",
      "## Qualification\n\n<!-- none -->",
      /has no "For #N:" line/u,
    ],
    [
      "a group with no check",
      qualification.replace(
        "- [ ] A fresh agent repeats the setup rehearsal.",
        ""
      ),
      /"For #14:" has no check/u,
    ],
    [
      "a ticked check",
      qualification.replace("- [ ] An agent", "- [x] An agent"),
      /check is ticked/u,
    ],
    [
      "a check before the first For line",
      qualification.replace("For #12:\n", "- [ ] Too early.\n\nFor #12:\n"),
      /check comes before the first "For #N:" line/u,
    ],
    [
      "a duplicate issue",
      qualification.replace("For #14:", "For #12:"),
      /#12 is declared again/u,
    ],
    [
      "a cross-repository reference",
      qualification.replace("For #14:", "For other/repo#14:"),
      /another repository/u,
    ],
    [
      "an issue URL",
      qualification.replace(
        "For #14:",
        "For https://github.com/other/repo/issues/14:"
      ),
      /another repository/u,
    ],
    [
      "prose outside comments",
      qualification.replace("For #14:", "These need the owner.\n\nFor #14:"),
      /only "For #N:" lines and unticked checks/u,
    ],
    [
      "a code fence",
      `${qualification}\n\n\`\`\`\n- [ ] fenced\n\`\`\``,
      /only "For #N:" lines and unticked checks/u,
    ],
    [
      "a For line with no number, as the template leaves it",
      "## Qualification\n\nFor #\n\n- [ ] ",
      /write it as "For #N:"/u,
    ],
    [
      "an empty check",
      qualification.replace(
        "- [ ] A fresh agent repeats the setup rehearsal.",
        "- [ ] "
      ),
      /check has no text/u,
    ],
    [
      "a comment on a check line",
      qualification.replace("rehearsal.", "rehearsal. <!-- soon -->"),
      /keep comments on their own lines/u,
    ],
  ])("rejects %s", (_, section, message) => {
    expect(check(declare(section), template)).toContainEqual(
      expect.stringMatching(message)
    );
  });

  it("rejects a declared issue that Summary does not name with Refs", () => {
    const body = declare(qualification, {
      Summary: declaring.replace("Refs #14", ""),
    });
    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(
        /#14 is declared under "## Qualification" but "## Summary" has no "Refs #14"/u
      ),
    ]);
    const decoy = declare(qualification, {
      Summary: declaring.replace("Refs #14", "Refs #140 and `Refs #14`"),
    });
    expect(check(decoy, template)).toContainEqual(
      expect.stringMatching(/has no "Refs #14"/u)
    );
  });

  it.each([
    "Closes #12",
    "fixed: #12",
    "Resolves other/repo#12",
    "closes https://github.com/owner/repo/issues/12",
  ])(
    "rejects a declared issue after a closing keyword anywhere: %s",
    (keyword) => {
      const body = declare(qualification, {
        Decisions: `${decisions}\n\n${keyword} once the checks pass.`,
      });
      expect(check(body, template)).toContainEqual(
        expect.stringMatching(/#12 follows a closing keyword/u)
      );
    }
  );

  it("ignores a closing keyword for another issue", () => {
    const body = declare(qualification, {
      Summary: `${declaring}\nCloses #120`,
    });
    expect(check(body, template)).toStrictEqual([]);
  });

  it("reports problems to the apply step instead of declarations", () => {
    const result = readQualification(
      declare(qualification.replace("- [ ] An agent", "- [x] An agent")),
      template
    );
    expect(result.present).toBeTruthy();
    expect(result.problems).toHaveLength(1);
  });

  it("is in the template, directly after Summary, and its placeholder fails", () => {
    const headings = [...template.matchAll(/^## (?<name>.+)$/gmu)].map(
      (match) => match.groups?.name
    );
    expect(headings.slice(0, 3)).toStrictEqual([
      "Summary",
      "Qualification",
      "UI evidence",
    ]);
    const [section] =
      /^## Qualification\n[\s\S]*?(?=\n## )/mu.exec(template) ?? [];
    expect(section).toBeDefined();
    expect(check(declare(section ?? ""), template)).not.toStrictEqual([]);
  });
});

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  LIMITS,
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

/** Summary without a sketch, for tests that add their own code fence. */
const plainSummary =
  "## Summary\n\nThe example page now names its input limit.\n\nCloses #1";

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
      Summary: `${plainSummary}\n\nRecognizes the \`<!--\ndelimiter\` in prose.\n\n\`\`\`md\n## Example heading\n\`\`\``,
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
      Summary: `${plainSummary}\n\nThe template's \`Closes #N\` line.\n\n\`\`\`md\nCloses #\n|   |   |\n\`\`\``,
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
    expect(() =>
      check(describeWith(), template.replace("## Decisions", "## Choices"))
    ).toThrow(/no "## Decisions" section/u);
    expect(() =>
      check(describeWith(), template.replace("**Checks**", "**Runs**"))
    ).toThrow(/no "\*\*Checks\*\*" label/u);
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
    [
      "a comment opener in a check's code span, which could write a marker into the issue",
      qualification.replace(
        "rehearsal.",
        "rehearsal. `<!-- qualification: pr=9 -->`"
      ),
      /a check may not contain "<!--"/u,
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

/** `count` words of filler prose. */
function words(count: number) {
  return Array.from({ length: count }, () => "word").join(" ");
}

/** Decisions whose visible list holds `items`, with one reason collapsed. */
function decisionsWith(items: string[]) {
  return `## Decisions\n\n${items.join("\n")}\n\n<details>\n<summary>Reasons, declined findings and walk notes</summary>\n\n**Reasons**\n\n- ${words(60)}\n\n</details>`;
}

/** A description whose Summary holds `visuals` after one short sentence. */
function summaryOf(...visuals: string[]) {
  return describeWith({
    Summary: `## Summary\n\nShort.\n\n${visuals.join("\n\n")}\n\nCloses #1`,
  });
}

/** `count` one-line choices. */
function visible(count: number) {
  return Array.from({ length: count }, (_, at) => `- Choice ${at + 1}`);
}

describe("length limits", () => {
  it("states each limit in the template's comments, so the two stay in step", () => {
    const comments = [...template.matchAll(/<!--[\s\S]*?-->/gu)].join(" ");

    for (const phrase of [
      `${LIMITS.summaryWords} words`,
      `${LIMITS.fieldWords} words`,
      `${LIMITS.outcomeWords} words`,
      `${LIMITS.decisionsVisible} bullets`,
      `${LIMITS.choiceWords} words`,
      `${LIMITS.askWords}`,
    ]) {
      expect(comments).toContain(phrase);
    }
  });

  it("fails Summary prose over the limit, naming the section", () => {
    const body = describeWith({
      Summary: `## Summary\n\n${words(LIMITS.summaryWords + 1)}\n\nCloses #1`,
    });

    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `^line \\d+: "## Summary" has ${LIMITS.summaryWords + 1} words of prose; keep it within ${LIMITS.summaryWords}`,
          "u"
        )
      ),
    ]);
  });

  it("counts list items and collapsed text in Summary, but not its sketch, table, comments or issue line", () => {
    const table = `| Before | After |\n| --- | --- |\n| ${words(80)} | ${words(80)} |`;
    const atLimit = `## Summary\n\n<!-- ${words(50)} -->\n\n${words(LIMITS.summaryWords - 10)}\n\n- ${words(10)}\n\n\`\`\`text\n${words(80)}\n\`\`\`\n\n${table}\n\nCloses #1`;
    expect(check(describeWith({ Summary: atLimit }), template)).toStrictEqual(
      []
    );

    const hidden = atLimit.replace(
      "Closes #1",
      "<details><summary>More</summary>\n\nextra\n\n</details>\n\nCloses #1"
    );

    expect(check(describeWith({ Summary: hidden }), template)).toHaveLength(1);
  });

  it("allows one sketch and one table in Summary, where a table may be the sketch", () => {
    const sketch = "```text\na\n```";
    const table = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    expect(check(summaryOf(sketch, table), template)).toStrictEqual([]);
    expect(check(summaryOf(table, table), template)).toStrictEqual([]);
    expect(check(summaryOf(sketch, sketch), template)).toStrictEqual([
      expect.stringMatching(
        /"## Summary" has 2 code sketches; keep at most one$/u
      ),
    ]);
    expect(check(summaryOf(sketch, table, table), template)).toStrictEqual([
      expect.stringMatching(
        /"## Summary" has 3 sketches and tables; keep at most one sketch and one before\/after table$/u
      ),
    ]);
  });

  it("fails Merge danger values outside their format, naming each line", () => {
    const body = describeWith({
      "Merge danger": `## Merge danger

- **Door:** mostly two-way
- **Risk tier:** 2, it stores state
- **Rounds used:** 6 of 5, the sixth requested by the owner
- **Blast radius:** ${words(LIMITS.fieldWords + 1)}
- **Rollback:** ${words(LIMITS.fieldWords + 1)}`,
    });

    const problems = check(body, template);
    expect(problems).toStrictEqual([
      expect.stringMatching(
        /^line \d+: "\*\*Door:\*\*" must be one of clean two-way, two-way, one-way or uncertain; put any reason under Decisions$/u
      ),
      expect.stringMatching(
        /^line \d+: "\*\*Risk tier:\*\*" must be one of 0, 1 or 2; put any reason under Decisions$/u
      ),
      expect.stringMatching(
        /^line \d+: "\*\*Rounds used:\*\*" must read "N of M"; put the reason under Decisions$/u
      ),
      expect.stringMatching(
        new RegExp(
          `^line \\d+: "\\*\\*Blast radius:\\*\\*" has ${LIMITS.fieldWords + 1} words; keep it a phrase within ${LIMITS.fieldWords}`,
          "u"
        )
      ),
      expect.stringMatching(/"\*\*Rollback:\*\*" has \d+ words/u),
    ]);
  });

  it("passes rounds past the budget and a Door in any letter case", () => {
    const body = describeWith({
      "Merge danger": mergeDanger
        .replace("clean two-way", "Two-way")
        .replace("1 of 3", "7 of 5"),
    });

    expect(check(body, template)).toStrictEqual([]);
  });

  it("fails more visible Decisions bullets than the limit, ignoring collapsed ones", () => {
    expect(
      check(
        describeWith({
          Decisions: decisionsWith(visible(LIMITS.decisionsVisible)),
        }),
        template
      )
    ).toStrictEqual([]);
    expect(
      check(
        describeWith({
          Decisions: decisionsWith(visible(LIMITS.decisionsVisible + 1)),
        }),
        template
      )
    ).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `"## Decisions" shows ${LIMITS.decisionsVisible + 1} bullets; keep at most ${LIMITS.decisionsVisible} visible`,
          "u"
        )
      ),
    ]);
  });

  it("fails a long choice, counting its wrapped and nested lines, but allows a longer owner item", () => {
    const long = `- ${words(LIMITS.choiceWords - 5)}\n  ${words(3)}\n  - ${words(3)}`;
    expect(
      check(describeWith({ Decisions: decisionsWith([long]) }), template)
    ).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `^line \\d+: a Decisions choice has ${LIMITS.choiceWords + 1} words; keep it within ${LIMITS.choiceWords}`,
          "u"
        )
      ),
    ]);
    const ask = (count: number) => `- **Needs your eye:** ${words(count - 3)}`;
    expect(
      check(
        describeWith({ Decisions: decisionsWith([ask(LIMITS.askWords)]) }),
        template
      )
    ).toStrictEqual([]);
    expect(
      check(
        describeWith({
          Decisions: decisionsWith([ask(LIMITS.askWords + 1)]),
        }),
        template
      )
    ).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `a Decisions item for the owner has ${LIMITS.askWords + 1} words; keep it within ${LIMITS.askWords}`,
          "u"
        )
      ),
    ]);
  });

  it("counts a flush-left continuation line and numbered items toward Decisions", () => {
    const lazy = `- ${words(LIMITS.choiceWords - 3)}\n${words(4)}`;
    expect(
      check(describeWith({ Decisions: decisionsWith([lazy]) }), template)
    ).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `a Decisions choice has ${LIMITS.choiceWords + 1} words`,
          "u"
        )
      ),
    ]);

    const numbered = Array.from(
      { length: LIMITS.decisionsVisible + 1 },
      (_, at) => `${at + 1}. Choice`
    );

    expect(
      check(describeWith({ Decisions: decisionsWith(numbered) }), template)
    ).toHaveLength(1);
  });

  it("finds Decisions bullets indented under the heading, and their nested items", () => {
    const indented = visible(LIMITS.decisionsVisible + 1).map(
      (item) => `  ${item}`
    );

    expect(
      check(describeWith({ Decisions: decisionsWith(indented) }), template)
    ).toHaveLength(1);
    const long = `  - ${words(LIMITS.choiceWords - 3)}\n    - ${words(4)}`;
    expect(
      check(describeWith({ Decisions: decisionsWith([long]) }), template)
    ).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `a Decisions choice has ${LIMITS.choiceWords + 1} words`,
          "u"
        )
      ),
    ]);
  });

  it("reads a Merge danger value that wraps onto the next line", () => {
    const body = describeWith({
      "Merge danger": mergeDanger
        .replace("clean two-way", "two-way\n  mostly")
        .replace("one page", `one page\n  ${words(LIMITS.fieldWords)}`),
    });

    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(/"\*\*Door:\*\*" must be one of/u),
      expect.stringMatching(/"\*\*Blast radius:\*\*" has \d+ words/u),
    ]);
  });

  it("fails Verification whose collapsed block has no outcome line", () => {
    const body = describeWith({
      Verification: verification.replace(
        "<summary>All checks green at abc1234; review approved abc1234</summary>\n",
        ""
      ),
    });

    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(
        /"## Verification" .* has no <summary> outcome line/u
      ),
    ]);
  });

  it("counts two code sketches even with no blank line between them", () => {
    expect(
      check(summaryOf("```text\na\n```\n```text\nb\n```"), template)
    ).toStrictEqual([
      expect.stringMatching(/"## Summary" has 2 code sketches/u),
    ]);
  });

  it("counts one sketch for a longer fence that holds a shorter one", () => {
    expect(
      check(summaryOf("````md\n```ts\ncode\n```\n````"), template)
    ).toStrictEqual([]);
    expect(
      check(summaryOf("~~~md\n```ts\ncode\n```\n~~~"), template)
    ).toStrictEqual([]);
  });

  it("reads a data row of dashes as part of its table, not a new one", () => {
    const table =
      "| Before | After |\n| --- | --- |\n| --- | --- |\n| Missing | Present |";

    expect(check(summaryOf("```text\na\n```", table), template)).toStrictEqual(
      []
    );
  });

  it("counts tables written without outer pipes", () => {
    const bare = "A | B\n--- | ---\n1 | 2";
    expect(
      check(summaryOf("```text\na\n```", bare, bare), template)
    ).toStrictEqual([
      expect.stringMatching(/"## Summary" has 3 sketches and tables/u),
    ]);
  });

  it("reads a Verification outcome line that wraps", () => {
    const head = "abc1234def5678";

    const body = describeWith({
      Verification: verification.replace(
        "<summary>All checks green at abc1234; review approved abc1234</summary>",
        "<summary>\nAll checks green at abc1234\n</summary>"
      ),
    });

    expect(check(body, template, { head })).toStrictEqual([]);
  });

  it("fails a Verification outcome line over the limit", () => {
    const body = describeWith({
      Verification: verification.replace(
        "All checks green at abc1234; review approved abc1234",
        `abc1234 ${words(LIMITS.outcomeWords)}`
      ),
    });

    expect(check(body, template)).toStrictEqual([
      expect.stringMatching(
        new RegExp(
          `^line \\d+: the Verification outcome line has ${LIMITS.outcomeWords + 1} words; keep it within ${LIMITS.outcomeWords}`,
          "u"
        )
      ),
    ]);
  });
});

describe("the head commit", () => {
  const head = "abc1234def5678abc1234def5678abc1234def56";

  it("passes when the outcome line and every Checks row name the head, dirty or not", () => {
    const body = describeWith({
      Verification: verification.replace(
        "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |",
        "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |\n| abc1234def dirty | `pnpm test` | 9 passed, 0 skipped | local |"
      ),
    });

    expect(check(body, template, { head })).toStrictEqual([]);
  });

  it("fails a Checks row for another commit and an outcome line that misses the head", () => {
    const body = describeWith({
      Verification: verification
        .replace(
          "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |",
          "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |\n| 789ddf0 (before the squash) | `pnpm test` | 9 passed, 0 skipped | local |"
        )
        .replace(
          "All checks green at abc1234; review approved abc1234",
          "All checks green at 789ddf0"
        ),
    });

    expect(check(body, template, { head })).toStrictEqual([
      expect.stringMatching(
        /^line \d+: the Verification outcome line does not name the head commit abc1234; rewrite Verification for the final head$/u
      ),
      expect.stringMatching(
        /^line \d+: this Checks row names another commit, not the head abc1234; replace it with a run at the head, and name a guard's failing run in the guards line instead$/u
      ),
    ]);
  });

  it("fails a Checks row with no commit, but leaves an empty row to the placeholder check", () => {
    const body = describeWith({
      Verification: verification.replace(
        "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |",
        "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |\n|  | `pnpm test` | 9 passed, 0 skipped | local |\n|  |  |  |  |"
      ),
    });

    expect(check(body, template, { head })).toStrictEqual([
      expect.stringMatching(/this Checks row names another commit/u),
      expect.stringMatching(/a table row is empty/u),
    ]);
  });

  it("reads only the outcome line's visible text, not a link's target", () => {
    const body = describeWith({
      Verification: verification.replace(
        "All checks green at abc1234; review approved abc1234",
        '<a href="https://example.com/commit/abc1234">789ddf0</a> green'
      ),
    });

    expect(check(body, template, { head })).toStrictEqual([
      expect.stringMatching(/outcome line does not name the head commit/u),
    ]);
  });

  it("checks every table under Checks, up to the Reviews label", () => {
    const body = describeWith({
      Verification: verification.replace(
        "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |",
        "| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |\n\n| Commit | Command | Result | Limits |\n| --- | --- | --- | --- |\n| 789ddf0 | `pnpm test:e2e` | 9 passed, 0 skipped | preview |"
      ),
    });

    expect(check(body, template, { head })).toStrictEqual([
      expect.stringMatching(/this Checks row names another commit/u),
    ]);
  });

  it("checks a Checks table written without outer pipes", () => {
    const body = describeWith({
      Verification: verification.replace(
        "| Commit | Command | Result | Limits |\n| ------ | ------- | ------ | ------ |\n| abc1234 | `pnpm validate` | 150 passed, 0 skipped | local |",
        "Commit | Command | Result | Limits\n--- | --- | --- | ---\n789ddf0 | `pnpm validate` | 150 passed, 0 skipped | local"
      ),
    });

    expect(body).toContain("789ddf0 | `pnpm validate`");
    expect(check(body, template, { head })).toStrictEqual([
      expect.stringMatching(/this Checks row names another commit/u),
    ]);
  });

  it("checks no commits when the head is not given", () => {
    const body = describeWith({
      Verification: verification.replaceAll("abc1234", "789ddf0"),
    });

    expect(check(body, template)).toStrictEqual([]);
    expect(check(body, template, { head })).toHaveLength(2);
  });
});

describe("pnpm pr:verify", () => {
  const script = path.join(import.meta.dirname, "verify-pr-description.ts");

  const run = (...args: string[]) => {
    const dir = fs.mkdtempSync(path.join(tmpdir(), "pr-verify-"));
    const file = path.join(dir, "body.md");
    fs.writeFileSync(file, describeWith());

    const result = spawnSync(process.execPath, [script, file, ...args], {
      encoding: "utf-8",
    });

    fs.rmSync(dir, { force: true, recursive: true });

    return result;
  };

  it("checks the head that --head names, as CI passes it", () => {
    expect(run("--head", "abc1234ffff").status).toBe(0);
    const stale = run("--head", "def5678ffff");
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain("not the head def5678");
  });

  it("refuses a malformed --head instead of skipping the check", () => {
    expect(run("--head").status).toBe(2);
    expect(run("--head", "main").status).toBe(2);
    expect(run("--sha", "abc1234").status).toBe(2);
  });
});

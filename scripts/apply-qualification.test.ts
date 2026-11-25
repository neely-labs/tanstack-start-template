import { describe, expect, it } from "vitest";

import { TARGET_LABEL, plan, readBackProblems } from "./apply-qualification.ts";
import type { Issue, Situation } from "./apply-qualification.ts";
import { STATE_LABELS } from "./state-labels.ts";

/** A comment the workflow's own token wrote. */
const byWorkflow = (body: string) => ({
  author: "github-actions[bot]",
  body,
  bot: true,
});

const byPerson = (body: string) => ({ author: "someone", body, bot: false });

const original = `Ship the weekly digest.

## Acceptance criteria

- [ ] The digest job runs weekly.`;

const checks = [
  "Owner confirms the weekly digest sends on 2026-12-01.",
  "An agent reads the send log after the first run.",
];

function issue(overrides: Partial<Issue> = {}) {
  return {
    assignees: ["octo-agent"],
    body: original,
    isPullRequest: false,
    labels: ["ready-for-agent", "bug"],
    number: 12,
    state: "open",
    ...overrides,
  } satisfies Issue;
}

function situation(overrides: Partial<Situation> = {}) {
  return {
    comments: [],
    declaration: { checks, issue: 12, line: 9 },
    issue: issue(),
    labelExists: true,
    pr: 57,
    ...overrides,
  } satisfies Situation;
}

/** The block #57 writes for `checks`, under a Current acceptance heading. */
const block = `Status: delivered in #57; open for 2 later checks.

<!-- qualification: pr=57 -->

- [ ] Owner confirms the weekly digest sends on 2026-12-01.
- [ ] An agent reads the send log after the first run.`;

/** A Current acceptance that triage wrote, with no delivery in it yet. */
const triaged = `${original}

## Current acceptance

Supersedes the criteria above. Triage narrowed the digest to weekdays.

- [x] The digest job runs on weekdays.`;

const applied = `${original}

## Current acceptance

Status: delivered in #57; open for 2 later checks.

<!-- qualification: pr=57 -->

- [ ] Owner confirms the weekly digest sends on 2026-12-01.
- [ ] An agent reads the send log after the first run.`;

describe(plan, () => {
  it("appends a Current acceptance, swaps the state label and clears assignees in one update", () => {
    const result = plan(situation());
    expect(result).toMatchObject({ failed: false, outcome: "moved" });
    expect(result.update).toStrictEqual({
      assignees: [],
      body: applied,
      labels: ["bug", TARGET_LABEL],
    });
    expect(result.comment).toMatch(
      /^<!-- qualification:moved pr=57 -->\nMoved to `awaiting-qualification` by #57; its Current acceptance lists 2 checks\.$/u
    );
  });

  it("keeps the rest of the issue, headings and fences included", () => {
    const body = `${original}\n\n\`\`\`md\n## Current acceptance\n\`\`\`\n\n## Notes\n\nKeep me.\r\n`;
    const result = plan(situation({ issue: issue({ body }) }));
    expect(result.outcome).toBe("moved");
    expect(result.update?.body?.startsWith(body.trimEnd())).toBeTruthy();
    expect(result.update?.body).toContain(
      "Status: delivered in #57; open for 2 later checks."
    );
  });

  it("writes a section into an empty body, with singular wording for one check", () => {
    const result = plan(
      situation({
        declaration: { checks: ["One check."], issue: 12, line: 9 },
        issue: issue({ body: "" }),
      })
    );

    expect(result.update?.body).toBe(
      "## Current acceptance\n\nStatus: delivered in #57; open for 1 later check.\n\n<!-- qualification: pr=57 -->\n\n- [ ] One check."
    );
    expect(result.comment).toMatch(/lists 1 check\.$/u);
  });

  it.each([
    [[], [TARGET_LABEL]],
    [["needs-triage"], [TARGET_LABEL]],
    [
      ["needs-info", "flaky", "ready-for-agent", "wontfix", "area: docs"],
      ["flaky", "area: docs", TARGET_LABEL],
    ],
    [
      [TARGET_LABEL, "bug"],
      ["bug", TARGET_LABEL],
    ],
  ])("replaces every state label in %j with the target", (labels, expected) => {
    const result = plan(situation({ issue: issue({ labels }) }));
    expect(result.update?.labels).toStrictEqual(expected);
  });

  it("changes nothing on a re-run, even with boxes ticked, a new assignee and a new state since", () => {
    const later = applied.replace("- [ ] Owner", "- [x] Owner");

    const result = plan(
      situation({
        comments: [
          byPerson("Looks good"),
          byWorkflow(
            "<!-- qualification:moved pr=57 -->\nMoved to `awaiting-qualification` by #57."
          ),
        ],
        issue: issue({
          assignees: ["someone"],
          body: later,
          labels: ["ready-for-human"],
        }),
      })
    );

    expect(result).toStrictEqual({
      failed: false,
      message: result.message,
      outcome: "unchanged",
    });
    expect(result.message).toMatch(/already applied by #57/u);
  });

  it("finishes the move without rewriting the body when an earlier run wrote it but never confirmed it", () => {
    const result = plan(
      situation({
        issue: issue({ body: applied, labels: ["ready-for-agent"] }),
      })
    );

    expect(result.outcome).toBe("moved");
    expect(result.update).toStrictEqual({
      assignees: [],
      labels: [TARGET_LABEL],
    });
  });

  it.each([
    ["another delivery", applied.replaceAll("pr=57", "pr=40")],
    [
      "a manual edit",
      `${original}\n\n## Current Acceptance\n\nStatus: delivered in #40.\n\n- [ ] Owner checks.`,
    ],
  ])(
    "leaves a Current acceptance from %s and comments the checks once",
    (_, body) => {
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result).toMatchObject({ failed: true, outcome: "conflict" });
      expect(result.update).toBeUndefined();
      expect(result.comment).toMatch(
        /^<!-- qualification:conflict pr=57 -->\n/u
      );

      for (const text of checks) {
        expect(result.comment).toContain(`- [ ] ${text}`);
      }

      const again = plan(
        situation({
          comments: [byWorkflow(result.comment ?? "")],
          issue: issue({ body }),
        })
      );

      expect(again).toMatchObject({ failed: true, outcome: "conflict" });
      expect(again.comment).toBeUndefined();
    }
  );

  it("changes nothing on a re-run after success even when a person deleted the body marker", () => {
    const result = plan(
      situation({
        comments: [byWorkflow("<!-- qualification:moved pr=57 -->\nMoved.")],
        issue: issue({
          body: applied.replace("<!-- qualification: pr=57 -->\n\n", ""),
        }),
      })
    );

    expect(result.outcome).toBe("unchanged");
    expect(result.update).toBeUndefined();
    expect(result.comment).toBeUndefined();
  });

  it.each(["===", "---"])(
    "adds to a Current acceptance heading underlined with %s, as GitHub reads it",
    (underline) => {
      const body = `${original}\n\nCurrent acceptance\n${underline}\n\n- [ ] Owner checks.`;
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result.outcome).toBe("moved");
      expect(result.update?.body).toBe(`${body}\n\n${block}`);
    }
  );

  it.each([
    [
      "a code fence",
      `${original}\n\n\`\`\`ts\nconst open = true;`,
      /code fence/u,
    ],
    ["a comment", `${original}\n\n<!-- a note left open`, /HTML comment/u],
  ])(
    "does not append to a body that ends inside %s, and comments the checks once",
    (_, body, reason) => {
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result).toMatchObject({ failed: true, outcome: "unclosed" });
      expect(result.update).toBeUndefined();
      expect(result.message).toMatch(reason);
      expect(result.comment).toContain(`- [ ] ${checks[0]}`);
      expect(
        plan(
          situation({
            comments: [byWorkflow(result.comment ?? "")],
            issue: issue({ body }),
          })
        ).comment
      ).toBeUndefined();
    }
  );

  it.each([
    ["a person", [byPerson("<!-- qualification:moved pr=57 -->\nMoved.")]],
    [
      "the workflow, quoting it",
      [byWorkflow("> <!-- qualification:moved pr=57 -->")],
    ],
    [
      "the workflow, inside a code fence",
      [byWorkflow("```\n<!-- qualification:moved pr=57 -->\n```")],
    ],
    [
      "the workflow, as an indented code block",
      [byWorkflow("    <!-- qualification:moved pr=57 -->")],
    ],
    [
      "the workflow, indented with a tab",
      [byWorkflow("\t<!-- qualification:moved pr=57 -->")],
    ],
    [
      "the workflow, in a list item",
      [byWorkflow("- item\n  <!-- qualification:moved pr=57 -->")],
    ],
  ])("ignores a moved marker written by %s", (_, comments) => {
    const result = plan(situation({ comments }));
    expect(result.outcome).toBe("moved");
    expect(result.update?.body).toBe(applied);
    expect(result.comment).toBeDefined();
  });

  it.each([
    [
      "a fenced example",
      `${original}\n\n\`\`\`md\n## Current acceptance\n\n<!-- qualification: pr=57 -->\n\`\`\``,
    ],
    [
      "a section that is not Current acceptance",
      `${original}\n\n## Notes\n\n<!-- qualification: pr=57 -->`,
    ],
    [
      "quoted text",
      `${original}\n\nSee \`<!-- qualification: pr=57 -->\` for the marker.`,
    ],
  ])("does not take a body marker in %s as its own", (_, body) => {
    const result = plan(situation({ issue: issue({ body }) }));
    expect(result.outcome).toBe("moved");
    expect(
      result.update?.body?.startsWith(`${body}\n\n## Current acceptance`)
    ).toBeTruthy();
  });

  it.each([
    ["four spaces, as code", "    ", "moved"],
    ["a tab, as code", "\t", "moved"],
    ["a blockquote, as HTML", "> ", "conflict"],
  ])(
    "does not take a Current acceptance marker indented by %s as its own",
    (_, prefix, outcome) => {
      const body = `## Current acceptance\n\n${prefix}<!-- qualification: pr=57 -->`;
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result.outcome).toBe(outcome);
      expect(result.update?.body).toBe(
        outcome === "moved" ? `${body}\n\n${block}` : undefined
      );
    }
  );

  it("still knows its own marker with trailing whitespace or a carriage return", () => {
    const body = applied.replace("pr=57 -->", "pr=57 -->  \r");
    const result = plan(situation({ issue: issue({ body }) }));
    expect(result.update?.body).toBeUndefined();
  });

  /** Each place `<!-- M -->` is text, not an HTML comment; M stands for the marker's inner text. */
  const literal: [string, string][] = [
    ["a backtick fence", "```\n<!-- M -->\n```"],
    ["a tilde fence", "~~~\n<!-- M -->\n~~~"],
    ["code indented by spaces", "    <!-- M -->"],
    ["code indented by a tab", "\t<!-- M -->"],
    ["a one-line code span", "`<!-- M -->`"],
    ["a one-line double-backtick span", "``<!-- M -->``"],
    ["a multi-line code span", "`example\n<!-- M -->\nend`"],
    ["a multi-line double-backtick span", "``example\n<!-- M -->\nend``"],
    ["an HTML comment already open", "<!-- note\n<!-- M -->"],
    ["a blockquote", "> <!-- M -->"],
    ["a list continuation", "- item\n  <!-- M -->"],
  ];

  it.each(literal)(
    "ignores a workflow comment's moved marker in %s",
    (_, context) => {
      const comment = byWorkflow(
        context.replace("M", "qualification:moved pr=57")
      );

      expect(plan(situation({ comments: [comment] })).outcome).toBe("moved");
    }
  );

  /**
   * How GitHub reads each place in `literal` under Current acceptance. An HTML
   * block can interrupt a paragraph, so no code span spans the marker line and
   * the marker stands alone, as its own: the body is not written again. In a
   * quote, a list or an open comment it is HTML that is not a top-level marker.
   */
  const readAs = new Map<string, "code" | "own" | "html">([
    ["a backtick fence", "code"],
    ["a blockquote", "html"],
    ["a list continuation", "html"],
    ["a multi-line code span", "own"],
    ["a multi-line double-backtick span", "own"],
    ["a one-line code span", "code"],
    ["a one-line double-backtick span", "code"],
    ["a tilde fence", "code"],
    ["an HTML comment already open", "html"],
    ["code indented by a tab", "code"],
    ["code indented by spaces", "code"],
  ]);

  it.each(literal)(
    "reads a Current acceptance body marker in %s as GitHub does",
    (name, context) => {
      const body = `## Current acceptance\n\n${context.replace("M", "qualification: pr=57")}`;
      const result = plan(situation({ issue: issue({ body }) }));

      const expected = {
        code: { body: `${body}\n\n${block}`, outcome: "moved" },
        html: { body: undefined, outcome: "conflict" },
        own: { body: undefined, outcome: "moved" },
      }[readAs.get(name) ?? "html"];

      expect([result.outcome, result.update?.body]).toStrictEqual([
        expected.outcome,
        expected.body,
      ]);
    }
  );

  it("does not take its marker under a later underlined heading as its own", () => {
    const body = `## Current acceptance\n\nNotes\n---\n\n<!-- qualification: pr=57 -->`;
    const result = plan(situation({ issue: issue({ body }) }));
    expect(result).toMatchObject({ failed: true, outcome: "conflict" });
    expect(result.update).toBeUndefined();
  });

  it("never reopens a closed issue: comments once and reports it", () => {
    const closed = issue({ state: "closed" });
    const result = plan(situation({ issue: closed }));
    expect(result).toMatchObject({ failed: false, outcome: "closed" });
    expect(result.update).toBeUndefined();
    expect(result.comment).toMatch(/^<!-- qualification:closed pr=57 -->\n/u);
    expect(result.comment).toContain(`- [ ] ${checks[0]}`);

    const again = plan(
      situation({ comments: [byWorkflow(result.comment ?? "")], issue: closed })
    );

    expect(again.comment).toBeUndefined();
  });

  it("leaves a closed issue it already moved alone", () => {
    const result = plan(
      situation({ issue: issue({ body: applied, state: "closed" }) })
    );

    expect(result).toStrictEqual({
      failed: false,
      message: result.message,
      outcome: "unchanged",
    });
    expect(result.message).toMatch(/already applied by #57/u);
  });

  it("fails a number that names a pull request", () => {
    const result = plan(situation({ issue: issue({ isPullRequest: true }) }));
    expect(result).toStrictEqual({
      failed: true,
      message: result.message,
      outcome: "pull-request",
    });
    expect(result.message).toMatch(/#12 is a pull request/u);
  });

  it("writes the Current acceptance and clears assignees but keeps labels when the target label is missing", () => {
    const result = plan(situation({ labelExists: false }));
    expect(result).toMatchObject({ failed: true, outcome: "missing-label" });
    expect(result.update).toStrictEqual({ assignees: [], body: applied });
    expect(result.comment).toBeUndefined();
    expect(result.message).toContain("docs/tooling.md#create-the-labels");
  });
});

describe("a Current acceptance that triage wrote", () => {
  it("gets the checks at its end, and the issue moves", () => {
    const result = plan(situation({ issue: issue({ body: triaged }) }));
    expect(result).toMatchObject({ failed: false, outcome: "moved" });
    expect(result.update).toStrictEqual({
      assignees: [],
      body: `${triaged}\n\n${block}`,
      labels: ["bug", TARGET_LABEL],
    });
    expect(result.comment).toMatch(/^<!-- qualification:moved pr=57 -->\n/u);
  });

  it("never gets the checks twice on a re-run after a failed first run", () => {
    const first = plan(
      situation({ issue: issue({ body: triaged }), labelExists: false })
    );

    expect(first).toMatchObject({ failed: true, outcome: "missing-label" });

    const body = first.update?.body ?? "";
    const again = plan(situation({ issue: issue({ body }) }));

    expect(again).toMatchObject({ failed: false, outcome: "moved" });
    expect(again.update?.body).toBeUndefined();
    expect(
      plan(
        situation({
          comments: [byWorkflow(again.comment ?? "")],
          issue: issue({ body }),
        })
      )
    ).toStrictEqual({
      failed: false,
      message: "#12: already applied by #57; left unchanged",
      outcome: "unchanged",
    });
  });

  /** Bodies whose Current acceptance gets the checks, as GitHub would show them. */
  const accepted: [string, string][] = [
    [
      "a # heading",
      `${original}\n\n# Current acceptance\n\n- [ ] Owner checks.`,
    ],
    ["a ###### heading", `${original}\n\n###### Current acceptance\n\nText.`],
    ["a closed heading", `${original}\n\n## Current Acceptance ##\n\nText.`],
    ["trailing blank lines and spaces", `${triaged}  \n\n`],
    ["an autolink", `${triaged}\n\n<https://example.org/notes>`],
    ["a less-than sign in prose", `${triaged}\n\nKeep runs < 5 minutes.`],
    [
      "HTML in code spans",
      `${triaged}\n\nRender \`<Button>\` and \`\`<head>\`\`.`,
    ],
    ["a closed code fence", `${triaged}\n\n\`\`\`ts\nconst a = "<b>";\n\`\`\``],
    ["a rule after a checklist", `${triaged}\n---`],
    ["a nonbreaking space under a paragraph", `${triaged}\n\nNotes.\n--- `],
    ["CRLF line endings", triaged.replaceAll("\n", "\r\n")],
    [
      "an underlined Current acceptance",
      `${original}\n\nCurrent acceptance\n---\n\nText.`,
    ],
    ["a final code line with trailing spaces", `${triaged}\n\n    code  `],
  ];

  it.each(accepted)("gets the checks after %s", (_, body) => {
    const result = plan(situation({ issue: issue({ body }) }));
    expect(result.outcome).toBe("moved");
    expect(result.update?.body).toBe(`${body}\n\n${block}`);
  });

  /** Bodies left unchanged with a conflict comment, and the reason it gives. */
  const refused: [string, string, RegExp][] = [
    [
      "another delivery's marker",
      `${triaged}\n\n<!-- qualification: pr=40 -->`,
      /holds HTML/u,
    ],
    [
      "a bold status line",
      `${triaged}\n\n**Status: delivered in #40; open for 1 later check.**`,
      /status line/u,
    ],
    [
      "a status line with a bold label",
      `${triaged}\n\nNote.\\\n**Status:** delivered in [#40](https://example.org/40).`,
      /status line/u,
    ],
    [
      "a status line continuing a paragraph",
      `${triaged}\n\nTriage note.  \nStatus: delivered in #40.`,
      /status line/u,
    ],
    [
      "a status line continuing a list item",
      `${triaged}\n\n- Note.\n  Status: delivered in #40.`,
      /status line/u,
    ],
    [
      "a status line written by hand",
      `${triaged}\n\nStatus: delivered in #40.`,
      /status line/u,
    ],
    [
      "a second Current acceptance",
      `${triaged}\n\n## Current acceptance\n\nMore.`,
      /2 Current acceptance headings/u,
    ],
    [
      "a quoted Current acceptance before it",
      `> ## Current acceptance\n\n${triaged}`,
      /2 Current acceptance/u,
    ],
    [
      "a bold Current acceptance before it",
      `## **Current acceptance**\n\n${triaged}`,
      /2 Current acceptance/u,
    ],
    [
      "a split-formatted Current acceptance before it",
      `## Current **acceptance**\n\n${triaged}`,
      /2 Current acceptance/u,
    ],
    [
      "an entity in a Current acceptance before it",
      `## Current&#32;acceptance\n\n${triaged}`,
      /2 Current acceptance/u,
    ],
    [
      "a heading after it",
      `${triaged}\n\n### Notes\n\nKeep me.`,
      /could not confirm/u,
    ],
    ["an empty heading after it", `${triaged}\n\n##`, /could not confirm/u],
    [
      "a setext heading after it",
      `${triaged}\n\nOther\n2. still its heading\n---`,
      /could not confirm/u,
    ],
    [
      "a quoted heading after it",
      `${triaged}\n\n> ## Notes`,
      /could not confirm/u,
    ],
    [
      "a heading in a list item after it",
      `${triaged}\n\n- ## Notes`,
      /could not confirm/u,
    ],
    [
      "an inline HTML heading after it",
      `${triaged}\n\nNotes <h2>Notes</h2>`,
      /holds HTML/u,
    ],
    [
      "a details block after it",
      `${triaged}\n\n<details>\n\nHidden.`,
      /holds HTML/u,
    ],
    ["a pre block before it", `<pre>\n${triaged}`, /cannot tell where/u],
    [
      "a backtick in a link before HTML",
      `${triaged}\n\n[N](https://e.org/\`x) <h2>N</h2> \``,
      /holds HTML/u,
    ],
    [
      "a comment opened between backticks before it",
      `Use \`a\n<!-- note\n\` here.\n\n${triaged}`,
      /cannot tell where/u,
    ],
    [
      "a fence whose info string holds a backtick",
      `${triaged}\n\n\`\`\`a\`b\n\n## Notes\n\n\`\`\``,
      /could not confirm/u,
    ],
    [
      "a list item's fence ended by a heading",
      `${triaged}\n\n- Example:\n  ~~~\n  example\n## Notes\n~~~`,
      /could not confirm/u,
    ],
    [
      "bare carriage returns",
      `${triaged}\n\nNotes.\r## Notes\r~~~`,
      /could not confirm/u,
    ],
    [
      "a link definition before two rules",
      `${triaged}\n\n[x]: /\n---\n---`,
      /definition/u,
    ],
    [
      "a form feed in an HTML tag",
      `${triaged}\n\n<pre\f>`,
      /control character/u,
    ],
    ["a footnote definition", `${triaged}\n\n[^1]: Note.`, /definition/u],
    [
      "a Current acceptance inside a list item",
      `1. Item\n\n   ## Current acceptance\n\n   Text.`,
      /could not confirm/u,
    ],
  ];

  it.each(refused)(
    "leaves a body with %s unchanged and comments the checks once",
    (_, body, reason) => {
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result).toMatchObject({ failed: true, outcome: "conflict" });
      expect(result.message).toMatch(reason);
      expect(result.comment).toMatch(
        /^<!-- qualification:conflict pr=57 -->\n/u
      );
      expect([
        result.update,
        plan(
          situation({
            comments: [byWorkflow(result.comment ?? "")],
            issue: issue({ body }),
          })
        ).comment,
      ]).toStrictEqual([undefined, undefined]);
    }
  );

  it("reports a closing fence with a nonbreaking space as unclosed", () => {
    const body = `${triaged}\n\n\`\`\`\ncode\n\`\`\` \n\nMore.`;
    expect(plan(situation({ issue: issue({ body }) })).outcome).toBe(
      "unclosed"
    );
  });
});

describe(readBackProblems, () => {
  const intent = {
    assignees: [],
    body: applied,
    labels: ["bug", TARGET_LABEL],
  };

  it("passes an issue that matches the update", () => {
    expect(
      readBackProblems(
        intent,
        issue({
          assignees: [],
          body: `${applied}\n`,
          labels: [TARGET_LABEL, "bug"],
        }),
        ["ready-for-agent"]
      )
    ).toStrictEqual([]);
  });

  it("names each part that differs", () => {
    expect(
      readBackProblems(
        intent,
        issue({ body: original, labels: ["bug", "ready-for-agent"] }),
        []
      )
    ).toStrictEqual([
      "the body does not hold the Current acceptance it wrote",
      'the labels are "bug", "ready-for-agent", not "awaiting-qualification", "bug"',
      'the assignees are "octo-agent", not none',
    ]);
  });

  it("compares every label, not only the state ones", () => {
    expect(
      readBackProblems(
        intent,
        issue({ assignees: [], body: applied, labels: [TARGET_LABEL] }),
        []
      )
    ).toStrictEqual([
      'the labels are "awaiting-qualification", not "awaiting-qualification", "bug"',
    ]);
    expect(
      readBackProblems(
        { assignees: [], body: applied },
        issue({ assignees: [], body: applied, labels: ["ready-for-agent"] }),
        ["ready-for-agent", "bug"]
      )
    ).toStrictEqual([
      'the labels are "ready-for-agent", not "bug", "ready-for-agent"',
    ]);
  });

  it("expects the labels unchanged when the update leaves them out", () => {
    const withoutLabels = { assignees: [], body: applied };
    const read = issue({ assignees: [], body: applied });
    expect(
      readBackProblems(withoutLabels, read, ["ready-for-agent", "bug"])
    ).toStrictEqual([]);
    expect(readBackProblems(withoutLabels, read, [])).toHaveLength(1);
  });
});

describe(TARGET_LABEL, () => {
  it("is a state label", () => {
    expect([...STATE_LABELS]).toContain(TARGET_LABEL);
  });
});

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  STATE_LABELS,
  TARGET_LABEL,
  plan,
  readBackProblems,
} from "./apply-qualification.ts";
import type { Issue, Situation } from "./apply-qualification.ts";

const byName = (left: string, right: string) => left.localeCompare(right);

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

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    assignees: ["octo-agent"],
    body: original,
    isPullRequest: false,
    labels: ["ready-for-agent", "bug"],
    number: 12,
    state: "open",
    ...overrides,
  };
}

function situation(overrides: Partial<Situation> = {}): Situation {
  return {
    comments: [],
    declaration: { checks, issue: 12, line: 9 },
    issue: issue(),
    labelExists: true,
    pr: 57,
    ...overrides,
  };
}

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

  it.each(["#", "###", "######"])(
    "sees a %s Current acceptance heading as existing",
    (marker) => {
      const body = `${original}\n\n${marker} Current acceptance\n\n- [ ] Owner checks.`;
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result).toMatchObject({ failed: true, outcome: "conflict" });
      expect(result.update).toBeUndefined();
    }
  );

  it.each(["===", "---"])(
    "sees a Current acceptance heading underlined with %s as existing",
    (underline) => {
      const body = `${original}\n\nCurrent acceptance\n${underline}\n\n- [ ] Owner checks.`;
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result).toMatchObject({ failed: true, outcome: "conflict" });
      expect(result.update).toBeUndefined();
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
    ["four spaces", "    "],
    ["a tab", "\t"],
    ["a blockquote", "> "],
  ])(
    "treats a Current acceptance whose marker is indented by %s as someone else's",
    (_, prefix) => {
      const body = `## Current acceptance\n\n${prefix}<!-- qualification: pr=57 -->`;
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result).toMatchObject({ failed: true, outcome: "conflict" });
      expect(result.update).toBeUndefined();
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

  it.each(literal)(
    "treats a Current acceptance whose body marker sits in %s as someone else's",
    (_, context) => {
      const body = `## Current acceptance\n\n${context.replace("M", "qualification: pr=57")}`;
      const result = plan(situation({ issue: issue({ body }) }));
      expect(result.outcome).toBe("conflict");
      expect(result.update).toBeUndefined();
    }
  );

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

describe("the state-label list", () => {
  const docs = path.join(import.meta.dirname, "../docs");

  /** The first or second column of each row in a `## heading` table of triage-labels.md. */
  function tableColumn(heading: string, column: number) {
    const text = fs.readFileSync(
      path.join(docs, "agents/triage-labels.md"),
      "utf-8"
    );
    const section = text.split(`## ${heading}\n`)[1]?.split("\n## ")[0] ?? "";
    return section
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .flatMap(
        (line) =>
          /`(?<name>[^`]+)`/u.exec(line.split("|")[column] ?? "")?.groups
            ?.name ?? []
      );
  }

  it("equals the state labels docs/tooling.md creates, which the triage guide lists", () => {
    const tooling = fs.readFileSync(path.join(docs, "tooling.md"), "utf-8");
    const created = [
      ...tooling.matchAll(/^gh label create (?<name>\S+)/gmu),
    ].map((match) => match.groups?.name);
    const categories = new Set(tableColumn("Category labels", 1));
    expect(categories).toStrictEqual(new Set(["bug", "flaky"]));
    const states = created.flatMap((name) =>
      name === undefined || categories.has(name) ? [] : name
    );
    expect(states.toSorted(byName)).toStrictEqual(
      [...STATE_LABELS].toSorted(byName)
    );
    expect(tableColumn("State labels", 2).toSorted(byName)).toStrictEqual(
      [...STATE_LABELS].toSorted(byName)
    );
    expect([...STATE_LABELS]).toContain(TARGET_LABEL);
  });
});

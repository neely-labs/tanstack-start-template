import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  STATE_LABELS,
  TARGET_LABEL,
  plan,
  verify,
} from "./apply-qualification.ts";
import type { Issue, Situation } from "./apply-qualification.ts";

const byName = (left: string, right: string) => left.localeCompare(right);

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
          "Looks good",
          "<!-- qualification:moved pr=57 -->\nMoved to `awaiting-qualification` by #57.",
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
      `${original}\n\n## Current acceptance\n\nStatus: delivered in #40.\n\n- [ ] Owner checks.`,
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
        situation({ comments: [result.comment ?? ""], issue: issue({ body }) })
      );
      expect(again).toMatchObject({ failed: true, outcome: "conflict" });
      expect(again.comment).toBeUndefined();
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
      situation({ comments: [result.comment ?? ""], issue: closed })
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

describe(verify, () => {
  const intent = {
    assignees: [],
    body: applied,
    labels: ["bug", TARGET_LABEL],
  };

  it("passes an issue that matches the update", () => {
    expect(
      verify(
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
      verify(
        intent,
        issue({ body: original, labels: ["bug", "ready-for-agent"] }),
        []
      )
    ).toStrictEqual([
      "the body does not hold the Current acceptance it wrote",
      'the state labels are "ready-for-agent", not "awaiting-qualification"',
      'the assignees are "octo-agent", not none',
    ]);
  });

  it("expects the state labels unchanged when the update leaves labels out", () => {
    const withoutLabels = { assignees: [], body: applied };
    const read = issue({ assignees: [], body: applied });
    expect(verify(withoutLabels, read, ["ready-for-agent"])).toStrictEqual([]);
    expect(verify(withoutLabels, read, [])).toHaveLength(1);
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

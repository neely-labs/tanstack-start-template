// Pins the shape of .github/workflows/qualification.yml, then runs its real
// apply step with a fake `gh` that keeps issues, labels and comments in a JSON
// file the way GitHub's REST API does, so each run can be read back. Needs
// `bash` and `jq`, which the step uses to read the event payload.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";

import { STATE_LABELS } from "./state-labels.ts";

const root = path.join(import.meta.dirname, "..");
const workflowPath = path.join(root, ".github/workflows/qualification.yml");
const readWorkflow = () => fs.readFileSync(workflowPath, "utf-8");

const stepSchema = z.looseObject({
  env: z.record(z.string(), z.string()).optional(),
  id: z.string().optional(),
  run: z.string().optional(),
  shell: z.string().optional(),
  uses: z.string().optional(),
  with: z.record(z.string(), z.unknown()).optional(),
});

const workflowSchema = z.looseObject({
  concurrency: z.looseObject({
    "cancel-in-progress": z.boolean(),
    group: z.string(),
    queue: z.string().optional(),
  }),
  jobs: z.record(
    z.string(),
    z.looseObject({
      if: z.string(),
      permissions: z.unknown().optional(),
      steps: z.array(stepSchema),
    })
  ),
  on: z.unknown(),
  permissions: z.record(z.string(), z.string()),
});

function workflow() {
  return workflowSchema.parse(parse(readWorkflow()));
}

function onlyJob() {
  const jobs = Object.values(workflow().jobs);
  expect(jobs).toHaveLength(1);
  const [job] = jobs;

  if (job === undefined) {
    throw new Error("qualification.yml has no job");
  }

  return job;
}

describe("the qualification workflow's shape", () => {
  it("runs only when a pull request closes", () => {
    expect(workflow().on).toStrictEqual({
      pull_request_target: { types: ["closed"] },
    });
  });

  it("runs its job only for a pull request merged into the default branch", () => {
    const condition = onlyJob().if.replaceAll(/\s+/gu, " ");
    expect(condition).toContain("github.event.pull_request.merged == true");
    expect(condition).toContain(
      "github.event.pull_request.base.ref == github.event.repository.default_branch"
    );
    expect(condition).not.toMatch(/\|\|/u);
  });

  it("has exactly the permissions it needs, and no job overrides them", () => {
    expect(workflow().permissions).toStrictEqual({
      contents: "read",
      issues: "write",
      "pull-requests": "read",
    });
    expect(onlyJob().permissions).toBeUndefined();
  });

  it("runs one at a time across pull requests, queueing the rest instead of cancelling any", () => {
    const { concurrency } = workflow();
    // One group for every run, named as it was when it was `${{ github.workflow }}`.
    expect(concurrency.group).toBe("Qualification");
    expect(concurrency.queue).toBe("max");
    expect(concurrency["cancel-in-progress"]).toBeFalsy();
  });

  it("checks out the default branch only, without keeping the token", () => {
    const checkouts = onlyJob().steps.filter(
      (step) => step.uses?.startsWith("actions/checkout@") === true
    );

    expect(checkouts).toHaveLength(1);
    expect(checkouts[0]?.with).toStrictEqual({ "persist-credentials": false });
  });

  it("pins each action to the commit the other workflows use", () => {
    const other = fs.readFileSync(
      path.join(root, ".github/workflows/pr-description.yml"),
      "utf-8"
    );

    const uses = onlyJob().steps.flatMap((step) => step.uses ?? []);
    expect(uses).toHaveLength(2);
    expect(
      uses.filter(
        (action) =>
          !/@[0-9a-f]{40}$/u.test(action) || !other.includes(`uses: ${action}`)
      )
    ).toStrictEqual([]);
  });

  it("never reads pull request text or code into an expression or script", () => {
    const text = readWorkflow();

    for (const banned of [
      "github.event.pull_request.body",
      "github.event.pull_request.title",
      "github.event.pull_request.head",
      "github.head_ref",
    ]) {
      expect(text).not.toContain(banned);
    }

    for (const step of onlyJob().steps) {
      expect(step.run ?? "").not.toContain("${{");
    }
  });

  it("reads the description from the merge event's payload, not the live pull request", () => {
    const scripts = onlyJob()
      .steps.map((step) => step.run ?? "")
      .join("\n");

    expect(scripts).toContain('"$GITHUB_EVENT_PATH"');
    expect(scripts).not.toMatch(/pulls\//u);
  });
});

// A stand-in for `gh api` over a JSON file holding pulls, issues, comments and
// labels. Like GitHub, a PATCH that names a missing label creates it.
const fakeGh = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GH_STATE, "utf-8"));
const save = () => fs.writeFileSync(process.env.FAKE_GH_STATE, JSON.stringify(state));
const fail = (message, code) => { process.stderr.write(message + "\n"); process.exit(code); };
const args = process.argv.slice(2);
if (args.shift() !== "api") fail("fake gh: only api is faked", 2);
let method = "GET", jq, input = false, endpoint;
while (args.length > 0) {
  const arg = args.shift();
  if (arg === "--method") method = args.shift();
  else if (arg === "--jq") jq = args.shift();
  else if (arg === "--input") { if (args.shift() !== "-") fail("fake gh: --input - only", 2); input = true; }
  else if (arg === "--paginate" || arg === "--slurp") {}
  else if (arg.startsWith("-")) fail("fake gh: unexpected flag " + arg, 2);
  else endpoint = arg;
}
state.calls.push(method + " " + endpoint);
save();
const sent = input ? JSON.parse(fs.readFileSync(0, "utf-8")) : undefined;
const notFound = () => fail("gh: Not Found (HTTP 404)", 1);
const print = (value) => process.stdout.write(JSON.stringify(value) + "\n");
const path = endpoint.replace(/\?.*$/, "").replace(/^repos\/owner\/repo\//, "");
let match;
if ((match = /^pulls\/(\d+)$/.exec(path)) && method === "GET") {
  const pull = state.pulls[match[1]];
  if (!pull) notFound();
  if (jq !== undefined && jq !== '.body // ""') fail("fake gh: unexpected --jq " + jq, 2);
  process.stdout.write(jq === undefined ? JSON.stringify(pull) + "\n" : (pull.body ?? "") + "\n");
} else if ((match = /^labels\/(.+)$/.exec(path)) && method === "GET") {
  const name = decodeURIComponent(match[1]);
  if (!state.labels.includes(name)) notFound();
  print({ name });
} else if ((match = /^issues\/(\d+)\/comments$/.exec(path))) {
  const list = (state.comments[match[1]] ??= []);
  if (state.racer?.issue === Number(match[1])) state.racer.armed = true;
  if (method === "POST") {
    const comment = { body: sent.body, user: { login: "github-actions[bot]", type: "Bot" } };
    list.push(comment); save(); print(comment);
  } else { save(); print([list.slice(0, 2), list.slice(2)]); }
} else if ((match = /^issues\/(\d+)$/.exec(path))) {
  const issue = state.issues[match[1]];
  if (!issue) notFound();
  // Another writer lands on each issue request after the comments were read.
  const racer = state.racer;
  if (racer?.issue === issue.number && racer.armed && racer.writes.length > 0) {
    const write = racer.writes.shift();
    if (write.body !== undefined) issue.body = write.body;
    if (write.assignees !== undefined) issue.assignees = write.assignees.map((login) => ({ login }));
    save();
  }
  if (method === "PATCH") {
    if (!state.ignorePatch?.includes(issue.number)) {
      if (sent.body !== undefined) issue.body = sent.body;
      if (sent.assignees !== undefined) issue.assignees = sent.assignees.map((login) => ({ login }));
      if (sent.labels !== undefined) {
        for (const name of sent.labels) if (!state.labels.includes(name)) state.labels.push(name);
        issue.labels = sent.labels.map((name) => ({ name }));
      }
      if (sent.state !== undefined) issue.state = sent.state;
    }
    state.patches.push({ issue: issue.number, sent });
    save();
  }
  print(issue);
} else fail("fake gh: no route for " + method + " " + endpoint, 2);
`;

const temporary = fs.mkdtempSync(path.join(tmpdir(), "qualification-"));
const fakeBin = path.join(temporary, "bin");

fs.mkdirSync(fakeBin);

fs.writeFileSync(path.join(fakeBin, "gh"), fakeGh, { mode: 0o755 });

interface FakeIssue {
  number: number;
  state: "open" | "closed";
  body: string | null;
  labels: { name: string }[];
  assignees: { login: string }[];
  pull_request?: { url: string };
}

interface FakeState {
  pulls: Record<string, { body: string | null }>;
  /** The description in the merge event's payload; the live one is in `pulls`. */
  merged?: string | null;
  issues: Record<string, FakeIssue>;
  comments: Record<
    string,
    { body: string; user: { login: string; type: string } }[]
  >;
  /** A second writer that changes the issue on each request after its comments were read. */
  racer?: {
    issue: number;
    armed: boolean;
    writes: { body?: string; assignees?: string[] }[];
  };
  labels: string[];
  calls: string[];
  patches: {
    issue: number;
    sent: { body?: string; labels?: string[]; assignees?: string[] };
  }[];
  ignorePatch?: number[];
}

const ALL_LABELS = [...STATE_LABELS, "bug", "flaky"];

function openIssue(number: number, overrides: Partial<FakeIssue> = {}) {
  return {
    assignees: [{ login: "octo-agent" }],
    body: `Issue ${number}.\r\n\r\n## Acceptance criteria\r\n\r\n- [x] Built.`,
    labels: [{ name: "ready-for-agent" }, { name: "flaky" }],
    number,
    state: "open" as const,
    ...overrides,
  };
}

const template = fs.readFileSync(
  path.join(root, ".github/pull_request_template.md"),
  "utf-8"
);

/** A filled description; `qualification` replaces the template's section, or drops it when null. */
function description(qualification: string | null, refs: number[]) {
  const [summaryAndRest = ""] = template.split("\n## UI evidence");

  const summary = summaryAndRest
    .split("\n## Qualification")[0]
    ?.replace(/^Closes #$/mu, refs.map((n) => `Refs #${n}`).join("\n"));

  return [
    summary,
    qualification,
    "## Merge danger\n\n- **Door:** clean two-way\n- **Risk tier:** 0\n- **Rounds used:** 1 of 1\n- **Blast radius:** docs only",
    "## Verification\n\n<details>\n<summary>Green at abc1234</summary>\n\n**Checks**\n\n| Commit | Command | Result | Limits |\n| - | - | - | - |\n| abc1234 | `pnpm test` | 1 passed | local |\n\n**Reviews**\n\n| Round | Reviewer | Head | Outcome |\n| - | - | - | - |\n| 1 | Author | abc1234 | No findings |\n\n</details>",
    "## Decisions\n\n- Kept it small",
  ]
    .filter((part) => part !== null)
    .join("\n\n");
}

const declared = `## Qualification

For #12:

- [ ] Owner confirms the digest sends on 2026-12-01.
- [ ] ::error::An agent reads the send log.

For #14:

- [ ] Owner checks the closed one.

For #15:

- [ ] A pull request is not an issue.

For #16:

- [ ] Conflicts with an earlier delivery.

For #17:

- [ ] Names no issue at all.`;

const foreign = `Issue 16.\n\n## Current acceptance\n\nStatus: delivered in #40; open for 1 later check.\n\n<!-- qualification: pr=40 -->\n\n- [ ] Earlier check.`;

function baseState(body: string | null) {
  const state: FakeState = {
    calls: [],
    comments: {
      "12": ["First.", "Second.", "Third."].map((text) => ({
        body: text,
        user: { login: "octo-person", type: "User" },
      })),
    },
    issues: {
      "12": openIssue(12),
      "14": openIssue(14, { state: "closed" }),
      "15": openIssue(15, { pull_request: { url: "https://example.com/15" } }),
      "16": openIssue(16, { body: foreign }),
    },
    labels: [...ALL_LABELS],
    patches: [],
    pulls: { "57": { body } },
  };

  return state;
}

let runCount = 0;

/** Runs the workflow's apply step against `state`, which the fake updates in place. */
function runApply(state: FakeState) {
  runCount += 1;
  const dir = path.join(temporary, String(runCount));
  fs.mkdirSync(dir);
  const stateFile = path.join(dir, "state.json");
  const summary = path.join(dir, "summary.md");
  fs.writeFileSync(stateFile, JSON.stringify(state));
  const steps = onlyJob().steps.filter((step) => step.id === "apply");
  const [step] = steps.length === 1 ? steps : [];

  if (step?.run === undefined || step.shell !== "bash") {
    throw new Error("qualification.yml has no bash apply step with a script");
  }

  const context = new Map([
    ["github.event.pull_request.number", "57"],
    ["github.repository", "owner/repo"],
    ["github.token", "fake-token"],
  ]);

  const env = Object.fromEntries(
    Object.entries(step.env ?? {}).map(([name, value]) => [
      name,
      value.replaceAll(/\$\{\{(?<expr>.*?)\}\}/gu, (_, expr: string) => {
        const expanded = context.get(expr.trim());

        if (expanded === undefined) {
          throw new Error(`Unexpected expression in the apply step: ${expr}`);
        }

        return expanded;
      }),
    ])
  );

  const script = path.join(dir, "step.sh");
  fs.writeFileSync(script, step.run);
  const event = path.join(dir, "event.json");
  fs.writeFileSync(
    event,
    JSON.stringify({
      pull_request: {
        body:
          state.merged === undefined ? state.pulls["57"]?.body : state.merged,
        number: 57,
      },
    })
  );

  const result = spawnSync(
    "bash",
    ["--noprofile", "--norc", "-eo", "pipefail", script],
    {
      cwd: root,
      encoding: "utf-8",
      env: {
        ...env,
        FAKE_GH_STATE: stateFile,
        GITHUB_EVENT_PATH: event,
        GITHUB_STEP_SUMMARY: summary,
        HOME: dir,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
        RUNNER_TEMP: dir,
      },
    }
  );

  const after: unknown = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  Object.assign(state, after);

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
    summary: fs.existsSync(summary) ? fs.readFileSync(summary, "utf-8") : "",
  };
}

const labelsOf = (issue: FakeIssue | undefined) =>
  issue?.labels.map((label) => label.name);

const marked = (state: FakeState, issue: string, kind: string) =>
  (state.comments[issue] ?? []).filter((comment) =>
    comment.body.includes(`<!-- qualification:${kind} pr=57 -->`)
  );

describe("the qualification workflow's apply step", () => {
  afterAll(() => {
    fs.rmSync(temporary, { force: true, recursive: true });
  });

  it("moves each open issue, reports the others, and fails at the end", () => {
    const state = baseState(description(declared, [12, 14, 15, 16, 17]));
    const before = structuredClone(state.issues);
    const run = runApply(state);
    expect(run.stderr).not.toMatch(/fake gh: /u);
    expect({
      closedComments: marked(state, "14", "closed").length,
      conflict: marked(state, "16", "conflict")[0]?.body.includes(
        "- [ ] Conflicts with an earlier delivery."
      ),
      moved: {
        assignees: state.issues["12"]?.assignees,
        body: state.issues["12"]?.body,
        comments: marked(state, "12", "moved").length,
        labels: labelsOf(state.issues["12"]),
      },
      patched: state.patches.map((patch) => patch.issue),
      prComments: state.comments["15"] ?? [],
      status: run.status,
      untouched: [state.issues["14"], state.issues["15"], state.issues["16"]],
    }).toStrictEqual({
      closedComments: 1,
      conflict: true,
      moved: {
        assignees: [],
        body: `${before["12"]?.body}\n\n## Current acceptance\n\nStatus: delivered in #57; open for 2 later checks.\n\n<!-- qualification: pr=57 -->\n\n- [ ] Owner confirms the digest sends on 2026-12-01.\n- [ ] ::error::An agent reads the send log.`,
        comments: 1,
        labels: ["flaky", "awaiting-qualification"],
      },
      patched: [12],
      prComments: [],
      status: 1,
      untouched: [before["14"], before["15"], before["16"]],
    });
  });

  it("reports each issue in the log and the step summary", () => {
    const run = runApply(
      baseState(description(declared, [12, 14, 15, 16, 17]))
    );

    const expected = [
      /OK: #12: moved to awaiting-qualification with 2 checks/u,
      /OK: #14: closed/u,
      /Failed: #15 is a pull request/u,
      /Failed: #16: left unchanged because the issue already has a Current acceptance/u,
      /Failed: #17: GET repos\/owner\/repo\/issues\/17 failed: .*HTTP 404/u,
    ];

    expect(expected.filter((line) => !line.test(run.stdout))).toStrictEqual([]);
    expect(expected.filter((line) => !line.test(run.summary))).toStrictEqual(
      []
    );
    expect(run.summary).toMatch(/^## Qualification for #57: 3 failures/u);
  });

  it("prints the run between stop-commands markers, so its text runs no workflow command", () => {
    const state = baseState(description(declared, [12, 14, 15, 16, 17]));
    const { stdout } = runApply(state);

    const token = /^::stop-commands::(?<token>[0-9a-f]{32})$/mu.exec(stdout)
      ?.groups?.token;

    expect(token).toBeDefined();

    const [, inside = "", after = ""] = stdout.split(
      new RegExp(`^::(?:stop-commands::${token}|${token}::)$`, "mu")
    );

    expect(inside).toContain("Qualification for #57");
    expect(after.trim()).toBe("");
  });

  it("changes nothing on a re-run, keeping ticked boxes, a new assignee and comments", () => {
    const state = baseState(description(declared, [12, 14, 15, 16, 17]));
    runApply(state);
    const ticked = state.issues["12"];

    if (ticked === undefined) {
      throw new Error("issue 12 is missing");
    }

    ticked.body = ticked.body?.replace("- [ ] Owner", "- [x] Owner") ?? null;
    ticked.assignees = [{ login: "someone" }];
    const issues = structuredClone(state.issues);
    const comments = structuredClone(state.comments);
    const patches = state.patches.length;
    const run = runApply(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/OK: #12: already applied by #57/u);
    expect(state.issues).toStrictEqual(issues);
    expect(state.comments).toStrictEqual(comments);
    expect(state.patches).toHaveLength(patches);
  });

  it("writes the Current acceptance when the label is missing, then fails", () => {
    const state = baseState(
      description("## Qualification\n\nFor #12:\n\n- [ ] One check.", [12])
    );

    state.labels = state.labels.filter(
      (name) => name !== "awaiting-qualification"
    );
    const run = runApply(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("docs/tooling.md#create-the-labels");
    expect({
      assignees: state.issues["12"]?.assignees,
      labels: labelsOf(state.issues["12"]),
      marker: state.issues["12"]?.body?.includes(
        "<!-- qualification: pr=57 -->"
      ),
      moved: marked(state, "12", "moved").length,
      repositoryLabel: state.labels.includes("awaiting-qualification"),
    }).toStrictEqual({
      assignees: [],
      labels: ["ready-for-agent", "flaky"],
      marker: true,
      moved: 0,
      repositoryLabel: false,
    });
  });

  it("finishes the move on a re-run once the label exists, keeping the body it wrote", () => {
    const state = baseState(
      description("## Qualification\n\nFor #12:\n\n- [ ] One check.", [12])
    );

    state.labels = state.labels.filter(
      (name) => name !== "awaiting-qualification"
    );
    runApply(state);
    state.labels.push("awaiting-qualification");
    const body = state.issues["12"]?.body;
    const run = runApply(state);
    expect(run.status).toBe(0);
    expect({
      body: state.issues["12"]?.body,
      labels: labelsOf(state.issues["12"]),
      moved: marked(state, "12", "moved").length,
    }).toStrictEqual({
      body,
      labels: ["flaky", "awaiting-qualification"],
      moved: 1,
    });
  });

  it("fails and posts nothing when the issue reads back different", () => {
    const state = baseState(
      description("## Qualification\n\nFor #12:\n\n- [ ] One check.", [12])
    );

    state.ignorePatch = [12];
    const run = runApply(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /#12: read back wrong after the update: the body/u
    );
    expect(marked(state, "12", "moved")).toStrictEqual([]);
  });

  it("re-plans from a second writer's change and overwrites none of it", () => {
    const state = baseState(
      description("## Qualification\n\nFor #12:\n\n- [ ] One check.", [12])
    );

    const other = `Issue 12.\n\n## Current acceptance\n\nStatus: delivered in #60; open for 1 later check.\n\n<!-- qualification: pr=60 -->\n\n- [ ] Its check.`;
    state.racer = { armed: false, issue: 12, writes: [{ body: other }] };
    const run = runApply(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /#12: left unchanged because the issue already has a Current acceptance/u
    );
    expect(state.issues["12"]?.body).toBe(other);
    expect(state.patches).toStrictEqual([]);
    expect(marked(state, "12", "conflict")).toHaveLength(1);
  });

  it("fails without writing when the issue changes again while it re-plans", () => {
    const state = baseState(
      description("## Qualification\n\nFor #12:\n\n- [ ] One check.", [12])
    );

    state.racer = {
      armed: false,
      issue: 12,
      writes: [{ assignees: ["first"] }, { assignees: ["second"] }],
    };
    const run = runApply(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /#12: changed again while it was being applied/u
    );
    expect(state.patches).toStrictEqual([]);
    expect(state.issues["12"]?.assignees).toStrictEqual([{ login: "second" }]);
  });

  it("does not take a person's quoted moved marker as the move", () => {
    const state = baseState(
      description("## Qualification\n\nFor #12:\n\n- [ ] One check.", [12])
    );

    state.comments["12"]?.push({
      body: "<!-- qualification:moved pr=57 -->",
      user: { login: "octo-person", type: "User" },
    });
    const run = runApply(state);
    expect(run.status).toBe(0);
    expect(labelsOf(state.issues["12"])).toStrictEqual([
      "flaky",
      "awaiting-qualification",
    ]);
  });

  it("does nothing for a description without a Qualification section", () => {
    const state = baseState(description(null, [12]));
    const run = runApply(state);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("#57 has no Qualification section");
    expect(state.calls).toStrictEqual([]);
  });

  it("changes no issue when the declaration breaks the verifier's rules", () => {
    const state = baseState(
      description("## Qualification\n\nFor #12:\n\n- [x] Ticked.", [12])
    );

    const run = runApply(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /cannot be applied, so no issue changed: .*ticked/u
    );
    expect(state.calls).toStrictEqual([]);
  });

  it("applies the description as merged, never an edit made after merge", () => {
    const state = baseState(
      description(
        "## Qualification\n\nFor #12:\n\n- [ ] Edited after merge.",
        [12]
      )
    );

    state.merged = description(
      "## Qualification\n\nFor #12:\n\n- [ ] Merged check.",
      [12]
    );
    const run = runApply(state);
    expect(run.status).toBe(0);
    expect(state.issues["12"]?.body).toContain("- [ ] Merged check.");
    expect(state.issues["12"]?.body).not.toContain("Edited after merge.");
    expect(state.calls).not.toContain("GET repos/owner/repo/pulls/57");
  });
});

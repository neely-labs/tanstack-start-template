// Pins the shape of .github/workflows/closed-issue-labels.yml, then runs its
// real step with a fake `gh` that keeps one issue's state and labels in a JSON
// file the way GitHub's REST API does, so each run can be read back. Needs
// `bash`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";

const root = path.join(import.meta.dirname, "..");
const workflowsDir = path.join(root, ".github/workflows");

const read = (name: string) =>
  fs.readFileSync(path.join(workflowsDir, name), "utf-8");

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
      if: z.string().optional(),
      permissions: z.unknown().optional(),
      steps: z.array(stepSchema),
    })
  ),
  on: z.unknown(),
  permissions: z.record(z.string(), z.string()),
});

const workflow = (name = "closed-issue-labels.yml") =>
  workflowSchema.parse(parse(read(name)));

function onlyJob() {
  const jobs = Object.values(workflow().jobs);
  expect(jobs).toHaveLength(1);
  const [job] = jobs;

  if (job === undefined) {
    throw new Error("closed-issue-labels.yml has no job");
  }

  return job;
}

describe("the closed issue labels workflow's shape", () => {
  it("runs whenever an issue closes, for any reason", () => {
    expect(workflow().on).toStrictEqual({ issues: { types: ["closed"] } });
    expect(onlyJob().if).toBeUndefined();
  });

  it("has exactly the permissions it needs, and no job overrides them", () => {
    expect(workflow().permissions).toStrictEqual({
      contents: "read",
      issues: "write",
    });
    expect(onlyJob().permissions).toBeUndefined();
  });

  it("queues in the qualification workflow's group instead of cancelling any run", () => {
    const { concurrency } = workflow();
    expect(concurrency.group).toBe(
      workflow("qualification.yml").concurrency.group
    );
    expect(concurrency.group).not.toContain("${{");
    expect(concurrency.queue).toBe("max");
    expect(concurrency["cancel-in-progress"]).toBeFalsy();
  });

  it("checks out the default branch without keeping the token, with the qualification workflow's pinned actions", () => {
    const steps = onlyJob().steps.filter((step) => step.uses !== undefined);
    const qualification = read("qualification.yml");

    expect(
      steps.filter(
        (step) => step.uses?.startsWith("actions/checkout@") === true
      )
    ).toHaveLength(1);
    expect(
      steps.find((step) => step.uses?.startsWith("actions/checkout@") === true)
        ?.with
    ).toStrictEqual({ "persist-credentials": false });
    expect(
      steps.filter(
        (step) =>
          !/@[0-9a-f]{40}$/u.test(step.uses ?? "") ||
          !qualification.includes(`uses: ${step.uses}`)
      )
    ).toStrictEqual([]);
  });

  it("reads only the issue number from the event, and never inside a script", () => {
    const expressions = [
      ...read("closed-issue-labels.yml").matchAll(/\$\{\{(?<expr>.*?)\}\}/gu),
    ].map((match) => match.groups?.expr.trim());

    expect(new Set(expressions)).toStrictEqual(
      new Set([
        "github.token",
        "github.repository",
        "github.event.issue.number",
      ])
    );

    for (const step of onlyJob().steps) {
      expect(step.run ?? "").not.toContain("${{");
    }
  });
});

// A stand-in for `gh api` over one issue in a JSON file. Like GitHub, deleting a
// label the issue lacks is Not Found.
const fakeGh = String.raw`#!/usr/bin/env node
const fs = require("node:fs");
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GH_STATE, "utf-8"));
const save = () => fs.writeFileSync(process.env.FAKE_GH_STATE, JSON.stringify(state));
const fail = (message, code) => { process.stderr.write(message + "\n"); process.exit(code); };
const args = process.argv.slice(2);
if (args.shift() !== "api") fail("fake gh: only api is faked", 2);
let method = "GET", endpoint;
while (args.length > 0) {
  const arg = args.shift();
  if (arg === "--method") method = args.shift();
  else if (arg.startsWith("-")) fail("fake gh: unexpected flag " + arg, 2);
  else endpoint = arg;
}
state.calls.push(method + " " + endpoint);
save();
if (state.serverError) fail("gh: Server Error (HTTP 500)", 1);
const issue = state.issue;
let match;
if (endpoint === "repos/owner/repo/issues/" + issue.number && method === "GET") {
  process.stdout.write(JSON.stringify(issue) + "\n");
} else if ((match = /^repos\/owner\/repo\/issues\/(\d+)\/labels\/(.+)$/.exec(endpoint)) && method === "DELETE") {
  if (Number(match[1]) !== issue.number) fail("gh: Not Found (HTTP 404)", 1);
  // Someone else removes this label just before the run does.
  if (state.removedFirst !== undefined) {
    issue.labels = issue.labels.filter((label) => label.name !== state.removedFirst);
    delete state.removedFirst;
  }
  const name = decodeURIComponent(match[2]);
  if (!issue.labels.some((label) => label.name === name)) { save(); fail("gh: Label does not exist (HTTP 404)", 1); }
  if (!state.ignoreDelete) issue.labels = issue.labels.filter((label) => label.name !== name);
  save();
  process.stdout.write(JSON.stringify(issue.labels) + "\n");
} else fail("fake gh: no route for " + method + " " + endpoint, 2);
`;

const temporary = fs.mkdtempSync(path.join(tmpdir(), "closed-labels-"));
const fakeBin = path.join(temporary, "bin");

fs.mkdirSync(fakeBin);

fs.writeFileSync(path.join(fakeBin, "gh"), fakeGh, { mode: 0o755 });

interface FakeState {
  issue: {
    number: number;
    state: "open" | "closed";
    state_reason: "completed" | "not_planned" | "reopened" | null;
    labels: { name: string }[];
  };
  calls: string[];
  removedFirst?: string;
  ignoreDelete?: boolean;
  serverError?: boolean;
}

function closedIssue(labels: string[], overrides: Partial<FakeState> = {}) {
  const state: FakeState = {
    calls: [],
    issue: {
      labels: labels.map((name) => ({ name })),
      number: 21,
      state: "closed",
      state_reason: "completed",
    },
    ...overrides,
  };

  return state;
}

let runCount = 0;

/** Runs the workflow's clear step against `state`, which the fake updates in place. */
function runClear(state: FakeState) {
  runCount += 1;
  const dir = path.join(temporary, String(runCount));
  fs.mkdirSync(dir);
  const stateFile = path.join(dir, "state.json");
  const summary = path.join(dir, "summary.md");
  fs.writeFileSync(stateFile, JSON.stringify(state));
  const steps = onlyJob().steps.filter((step) => step.id === "clear");
  const [step] = steps.length === 1 ? steps : [];

  if (step?.run === undefined || step.shell !== "bash") {
    throw new Error("closed-issue-labels.yml has no bash clear step");
  }

  const context = new Map([
    ["github.event.issue.number", String(state.issue.number)],
    ["github.repository", "owner/repo"],
    ["github.token", "fake-token"],
  ]);

  const env = Object.fromEntries(
    Object.entries(step.env ?? {}).map(([name, value]) => [
      name,
      value.replaceAll(/\$\{\{(?<expr>.*?)\}\}/gu, (_, expr: string) => {
        const expanded = context.get(expr.trim());

        if (expanded === undefined) {
          throw new Error(`Unexpected expression in the clear step: ${expr}`);
        }

        return expanded;
      }),
    ])
  );

  const script = path.join(dir, "step.sh");
  fs.writeFileSync(script, step.run);

  const result = spawnSync(
    "bash",
    ["--noprofile", "--norc", "-eo", "pipefail", script],
    {
      cwd: root,
      encoding: "utf-8",
      env: {
        ...env,
        FAKE_GH_STATE: stateFile,
        GITHUB_STEP_SUMMARY: summary,
        HOME: dir,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
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

const labelsOf = (state: FakeState) =>
  state.issue.labels.map((label) => label.name);

describe("the closed issue labels workflow's step", () => {
  afterAll(() => {
    fs.rmSync(temporary, { force: true, recursive: true });
  });

  it.each(["completed", "not_planned"] as const)(
    "removes each state label but wontfix and keeps every other label, closed as %s",
    (reason) => {
      const state = closedIssue([
        "bug",
        "awaiting-qualification",
        "ready-for-agent",
        "wontfix",
        "flaky",
      ]);

      state.issue.state_reason = reason;
      const run = runClear(state);
      expect(run.stderr).not.toMatch(/fake gh: /u);
      expect({
        labels: labelsOf(state),
        status: run.status,
        stdout: run.stdout.trim(),
        summary: run.summary.trim(),
      }).toStrictEqual({
        labels: ["bug", "wontfix", "flaky"],
        status: 0,
        stdout:
          "Closed issue labels: #21: removed `awaiting-qualification`, `ready-for-agent`.",
        summary:
          "Closed issue labels: #21: removed `awaiting-qualification`, `ready-for-agent`.",
      });
    }
  );

  it("changes nothing on an issue with no state label but wontfix", () => {
    const state = closedIssue(["wontfix", "enhancement"]);
    const run = runClear(state);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("#21 has no label to remove.");
    expect(labelsOf(state)).toStrictEqual(["wontfix", "enhancement"]);
    expect(state.calls).toStrictEqual(["GET repos/owner/repo/issues/21"]);
  });

  it("leaves an issue reopened before the run alone", () => {
    const state = closedIssue(["ready-for-agent"]);
    state.issue.state = "open";
    state.issue.state_reason = "reopened";
    const run = runClear(state);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("#21 is open, so its labels stay.");
    expect(labelsOf(state)).toStrictEqual(["ready-for-agent"]);
    expect(state.calls).toStrictEqual(["GET repos/owner/repo/issues/21"]);
  });

  it("passes when someone removes a label first, and changes nothing on a re-run", () => {
    const state = closedIssue(["needs-triage", "bug"], {
      removedFirst: "needs-triage",
    });

    expect(runClear(state).status).toBe(0);
    expect(labelsOf(state)).toStrictEqual(["bug"]);
    const calls = state.calls.length;
    const rerun = runClear(state);
    expect(rerun.status).toBe(0);
    expect(rerun.stdout).toContain("#21 has no label to remove.");
    expect(state.calls).toHaveLength(calls + 1);
  });

  it("fails when a label reads back still on the issue", () => {
    const state = closedIssue(["ready-for-human"], { ignoreDelete: true });
    const run = runClear(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain(
      "#21: still carries `ready-for-human` after removing it."
    );
  });

  it("fails with the API's error when a request fails", () => {
    const state = closedIssue(["ready-for-agent"], { serverError: true });
    const run = runClear(state);
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(
      /#21: GET repos\/owner\/repo\/issues\/21 failed: .*HTTP 500/u
    );
  });
});

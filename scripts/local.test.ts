import { execFileSync, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkoutOf,
  devServer,
  processStart,
  readOwner,
  retire,
  status,
} from "./local.ts";
import type { Checkout } from "./local.ts";

const temporary: string[] = [];
const children: ChildProcess[] = [];

/** A committed repository with a second worktree, ignoring local state. */
function repositoryWithWorktree(): [Checkout, Checkout] {
  const base = fs.mkdtempSync(path.join(tmpdir(), "local-env-"));
  temporary.push(base);
  const main = path.join(base, "main");
  const run = (...args: string[]) =>
    execFileSync("git", ["-C", main, ...args], { stdio: "ignore" });
  fs.mkdirSync(main);
  run("init", "--quiet");
  fs.writeFileSync(path.join(main, ".gitignore"), ".local/\n.output/\n");
  run("add", ".gitignore");
  run("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
  run("worktree", "add", "--quiet", path.join(base, "other"));
  return [checkoutOf(main), checkoutOf(path.join(base, "other"))];
}

/** Starts an unrelated long-lived process and returns its id. */
function startProcess(): number {
  const child = spawn("sleep", ["30"], { stdio: "ignore" });
  children.push(child);
  return child.pid ?? 0;
}

const isAlive = (pid: number) => processStart(pid) !== undefined;
const serverOf = (checkout: Checkout) =>
  status(checkout).resources["dev server"];

/** Records `pid` as the checkout's server; a wrong start time marks reuse. */
function own(checkout: Checkout, pid: number, startedAt = processStart(pid)) {
  const owner = { ...checkout, commit: "abc", pid, startedAt };
  fs.mkdirSync(path.dirname(checkout.ownerFile), { recursive: true });
  fs.writeFileSync(checkout.ownerFile, JSON.stringify(owner));
}

describe("local environment", () => {
  afterEach(() => {
    for (const child of children.splice(0)) {
      child.kill("SIGKILL");
    }
    for (const dir of temporary.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  it("derives stable ports from each checkout path", () => {
    const [main, other] = repositoryWithWorktree();
    expect(checkoutOf(main.root)).toStrictEqual(main);
    for (const checkout of [main, other]) {
      expect(checkout.appPort).toBeGreaterThanOrEqual(20_000);
      expect(checkout.appPort).toBeLessThan(25_000);
      expect(checkout.e2ePort).toBe(checkout.appPort + 5000);
    }
  });

  it("retires only the owned process and its build output", async () => {
    const [main, other] = repositoryWithWorktree();
    const [mine, theirs] = [startProcess(), startProcess()];
    own(main, mine);
    own(other, theirs);
    fs.mkdirSync(path.join(main.root, ".output"));

    await expect(retire(main)).resolves.toStrictEqual([
      `stopped dev server (pid ${mine})`,
      "removed .local/owner.json",
      "removed .output/",
    ]);
    expect(isAlive(mine)).toBeFalsy();
    expect(fs.existsSync(path.join(main.root, ".local"))).toBeFalsy();
    expect(serverOf(main)).toStrictEqual({ state: "stopped" });
    expect(serverOf(other)).toMatchObject({ pid: theirs, state: "running" });
  });

  it("refuses to retire untracked work and changes nothing", async () => {
    const [main] = repositoryWithWorktree();
    const mine = startProcess();
    own(main, mine);
    fs.mkdirSync(path.join(main.root, ".output"));
    fs.writeFileSync(path.join(main.root, "notes.txt"), "draft");

    await expect(retire(main)).rejects.toThrow(/Refusing.*notes\.txt/su);
    expect(isAlive(mine)).toBeTruthy();
    expect(readOwner(main)?.pid).toBe(mine);
    expect(fs.existsSync(path.join(main.root, ".output"))).toBeTruthy();
  });

  it("detects a reused process id and does not kill it", async () => {
    const [main] = repositoryWithWorktree();
    const unrelated = startProcess();
    own(main, unrelated, "Thu Jan  1 00:00:00 1970");
    expect(serverOf(main)).toMatchObject({ pid: unrelated, state: "stale" });

    await expect(retire(main)).resolves.toContain(
      `left pid ${unrelated} alone: it is now another process`
    );
    expect(isAlive(unrelated)).toBeTruthy();
    expect(readOwner(main)).toBeUndefined();
  });

  it("refuses a port that another worktree's live server owns", async () => {
    const [main, other] = repositoryWithWorktree();
    own({ ...other, appPort: main.appPort }, startProcess());

    await expect(devServer.setup(main)).rejects.toThrow(
      `Port ${main.appPort} belongs to ${other.root}`
    );
    expect(readOwner(main)).toBeUndefined();
  });
});

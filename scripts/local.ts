// Per-checkout local environment: ports derived from the checkout path and an
// ignored ownership file keep concurrent worktrees out of each other's way.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export type Checkout = ReturnType<typeof checkoutOf>;
/** What `dev` started, so status and retirement act only on that process. */
export type Owner = Pick<Checkout, "appPort" | "e2ePort" | "root"> & {
  commit: string;
  pid: number;
  startedAt: string;
};

/** A resource's state, such as `running`, plus details such as a URL. */
export interface ResourceStatus {
  [detail: string]: string | number;
  state: string;
}

/**
 * A local dependency of the app: `dev` sets resources up in order, `retire`
 * tears them down in reverse. Register a database, cookies or fixtures here.
 */
export interface Resource {
  name: string;
  setup: (checkout: Checkout) => Promise<void>;
  status: (checkout: Checkout) => ResourceStatus;
  /** Returns one line per action taken, for the retirement report. */
  teardown: (checkout: Checkout) => Promise<string[]>;
}

/** Stable per checkout path: app on 20000-24999, browser tests 5000 higher. */
export function checkoutOf(dir = path.join(import.meta.dirname, "..")) {
  const root = fs.realpathSync(dir);
  const hash = createHash("sha256").update(root).digest();
  const appPort = 20_000 + (hash.readUInt32BE(0) % 5000);
  const ownerFile = path.join(root, ".local", "owner.json");
  return { appPort, e2ePort: appPort + 5000, ownerFile, root };
}

function git(root: string, ...args: string[]) {
  const options = { encoding: "utf-8" } as const;
  return execFileSync("git", ["-C", root, ...args], options).trim();
}

/** Trimmed output of `read`, or "" when it throws. */
function readOrEmpty(read: () => string) {
  try {
    return read().trim();
  } catch {
    return "";
  }
}

/**
 * The process start time, which tells a reused process id apart. Linux reports
 * clock ticks since boot; `ps` there derives `lstart` from the wall clock,
 * which drifts when the clock is adjusted (as WSL does).
 */
export function processStart(pid: number) {
  const stat = readOrEmpty(() => fs.readFileSync(`/proc/${pid}/stat`, "utf-8"));
  if (stat) {
    // Fields after the parenthesized command name start at field 3.
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[22 - 3];
  }
  const env = { ...process.env, LC_ALL: "C" };
  const options = { encoding: "utf-8", env, stdio: "pipe" } as const;
  const args = ["-o", "lstart=", "-p", String(pid)];
  return readOrEmpty(() => execFileSync("ps", args, options)) || undefined;
}

/** Parses the ownership file; a missing or malformed one owns nothing. */
export function readOwner(checkout: Checkout): Owner | undefined {
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(checkout.ownerFile, "utf-8"));
  } catch {
    // No ownership file yet, or one that cannot be read.
  }
  const fields = new Map(Object.entries(value ?? {}));
  const owner = {
    appPort: Number(fields.get("appPort")),
    commit: String(fields.get("commit")),
    e2ePort: Number(fields.get("e2ePort")),
    pid: Number(fields.get("pid")),
    root: String(fields.get("root")),
    startedAt: String(fields.get("startedAt")),
  };
  return Number.isInteger(owner.pid) && owner.pid > 0 ? owner : undefined;
}

/** `stale` means the recorded process id now belongs to another process. */
export function serverState(owner?: Owner) {
  const started = owner && processStart(owner.pid);
  if (started === undefined) {
    return "stopped";
  }
  return started === owner?.startedAt ? "running" : "stale";
}

/** A live server from another worktree of this repository on the same port. */
function claimant(checkout: Checkout) {
  const list = git(checkout.root, "worktree", "list", "--porcelain");
  return [...list.matchAll(/^worktree (?<root>.+)$/gmu)]
    .map((match) => match.groups?.root ?? "")
    .filter((root) => fs.existsSync(root))
    .map((root) => readOwner(checkoutOf(root)))
    .find(
      (owner) =>
        owner?.root !== checkout.root &&
        owner?.appPort === checkout.appPort &&
        serverState(owner) === "running"
    );
}

/** Sends a signal to a process that may already have exited. */
function sendSignal(pid: number, name: NodeJS.Signals) {
  try {
    process.kill(pid, name);
  } catch {
    // Already gone.
  }
}

const appUrl = (checkout: Checkout) => `http://localhost:${checkout.appPort}`;

export const devServer: Resource = {
  name: "dev server",
  async setup(checkout) {
    const own = readOwner(checkout);
    if (own && serverState(own) === "running") {
      throw new Error(`Already serving ${appUrl(checkout)} (pid ${own.pid}).`);
    }
    const other = claimant(checkout);
    if (other) {
      const fix = "Retire it or start Vite with an explicit --port.";
      throw new Error(`Port ${other.appPort} belongs to ${other.root}. ${fix}`);
    }
    const vite = path.join(checkout.root, "node_modules/vite/bin/vite.js");
    const args = [vite, "dev", "--port", String(checkout.appPort)];
    const child = spawn(process.execPath, [...args, "--strictPort"], {
      cwd: checkout.root,
      stdio: "inherit",
    });
    const pid = child.pid ?? 0;
    const commit = git(checkout.root, "rev-parse", "HEAD");
    const startedAt = processStart(pid) ?? "";
    const { appPort, e2ePort, root } = checkout;
    const owner: Owner = { appPort, commit, e2ePort, pid, root, startedAt };
    fs.mkdirSync(path.dirname(checkout.ownerFile), { recursive: true });
    fs.writeFileSync(checkout.ownerFile, `${JSON.stringify(owner, null, 2)}\n`);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
      process.on(signal, () => {
        child.kill(signal);
      });
    }
    await once(child, "exit");
    if (readOwner(checkout)?.pid === pid) {
      fs.rmSync(checkout.ownerFile, { force: true });
    }
    process.exitCode = child.exitCode ?? 0;
  },
  status(checkout): ResourceStatus {
    const owner = readOwner(checkout);
    const state = serverState(owner);
    if (!owner || state === "stopped") {
      return { state };
    }
    return state === "running"
      ? { pid: owner.pid, state, url: appUrl(checkout) }
      : { pid: owner.pid, state };
  },
  async teardown(checkout) {
    const owner = readOwner(checkout);
    if (!owner) {
      return [];
    }
    const state = serverState(owner);
    const report = [];
    if (state === "running") {
      sendSignal(owner.pid, "SIGTERM");
      for (let i = 0; i < 50 && serverState(owner) === "running"; i += 1) {
        // oxlint-disable-next-line no-await-in-loop -- polls for the exit.
        await sleep(100);
      }
      if (serverState(owner) === "running") {
        sendSignal(owner.pid, "SIGKILL");
        await sleep(200);
      }
      if (serverState(owner) === "running") {
        throw new Error(`Could not stop the dev server (pid ${owner.pid}).`);
      }
      report.push(`stopped dev server (pid ${owner.pid})`);
    } else if (state === "stale") {
      report.push(`left pid ${owner.pid} alone: it is now another process`);
    }
    fs.rmSync(checkout.ownerFile, { force: true });
    return [...report, "removed .local/owner.json"];
  },
};

/**
 * Set up in order and torn down in reverse. Register new resources before
 * `devServer`: its setup runs the server in the foreground until it exits.
 */
export const resources: Resource[] = [devServer];

export function status(checkout: Checkout) {
  const states = new Map(
    resources.map((item) => [item.name, item.status(checkout)])
  );
  return {
    appUrl: appUrl(checkout),
    branch: git(checkout.root, "branch", "--show-current") || "(detached)",
    checkout: checkout.root,
    commit: git(checkout.root, "rev-parse", "--short", "HEAD"),
    dirty: git(checkout.root, "status", "--porcelain") !== "",
    e2ePort: checkout.e2ePort,
    resources: Object.fromEntries(states),
  };
}

/** Refuses on uncommitted or untracked work; otherwise removes local state. */
export async function retire(checkout: Checkout) {
  const work = git(checkout.root, "status", "--porcelain");
  if (work) {
    const reason = "commit or remove this work first";
    throw new Error(`Refusing to retire ${checkout.root}; ${reason}:\n${work}`);
  }
  const report: string[] = [];
  for (let index = resources.length - 1; index >= 0; index -= 1) {
    // oxlint-disable-next-line no-await-in-loop -- reverse dependency order.
    report.push(...((await resources[index]?.teardown(checkout)) ?? []));
  }
  for (const dir of [".output", ".tanstack"]) {
    if (fs.existsSync(path.join(checkout.root, dir))) {
      fs.rmSync(path.join(checkout.root, dir), { recursive: true });
      report.push(`removed ${dir}/`);
    }
  }
  fs.rmSync(path.dirname(checkout.ownerFile), { force: true, recursive: true });
  return report;
}

async function main(command: string | undefined, args: string[]) {
  const at = args.indexOf("--checkout");
  const dir = at === -1 ? import.meta.dirname : args.at(at + 1);
  if (dir === undefined || dir.startsWith("-")) {
    throw new Error("--checkout needs a path.");
  }
  const checkout = checkoutOf(git(dir, "rev-parse", "--show-toplevel"));
  if (command === "dev") {
    console.log(`${checkout.root} serves ${appUrl(checkout)}`);
    for (const resource of resources) {
      // oxlint-disable-next-line no-await-in-loop -- dependency order.
      await resource.setup(checkout);
    }
  } else if (command === "status") {
    const report = status(checkout);
    const lines = Object.entries(report).map(
      ([key, value]) => `${key}: ${JSON.stringify(value)}`
    );
    console.log(
      args.includes("--json") ? JSON.stringify(report) : lines.join("\n")
    );
  } else if (command === "retire") {
    const report = await retire(checkout);
    const lines = report.map((line) => `- ${line}`);
    console.log([`Retired ${checkout.root}`, ...lines].join("\n"));
  } else {
    throw new Error(
      "Usage: local.ts <dev|status|retire> [--json] [--checkout <path>]"
    );
  }
}

if (import.meta.main) {
  try {
    await main(process.argv[2], process.argv.slice(3));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

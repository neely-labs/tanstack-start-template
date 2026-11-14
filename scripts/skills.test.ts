// Committed skills live twice: most agents read `.agents/skills/`, and Claude
// Code reads `.claude/skills/`. Each must be a real copy, since a checkout
// without symlink support, as on Windows by default, turns a link into a text
// file. The copies must also match: `npx skills update` rewrites both, so a
// difference means one was edited by hand and one agent runs a stale skill.
//
// Dependencies can ship skills too. `pnpm approve` grants them in
// `pnpm-workspace.yaml` and links them, unreviewed, into both skill folders, so
// these tests fail on any grant the template has not adopted on purpose.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { z } from "zod";

const root = path.join(import.meta.dirname, "..");
const workspacePath = path.join(root, "pnpm-workspace.yaml");
const skillFolders = [".agents/skills", ".claude/skills"];

/** Dependencies whose skills this project has reviewed and adopted. */
const approvedSkills = new Set<string>();

const skillsLockSchema = z.object({
  skills: z.record(z.string(), z.looseObject({})),
});

/** Each skill in `skills-lock.json` under `dir` with its entry; none without a lock. */
function lockedSkills(dir = root) {
  const lockPath = path.join(dir, "skills-lock.json");
  if (!fs.existsSync(lockPath)) {
    return [];
  }
  const lock = skillsLockSchema.parse(
    JSON.parse(fs.readFileSync(lockPath, "utf-8"))
  );
  return Object.entries(lock.skills);
}

/**
 * Each entry in a skill folder under `dir` that the lock does not list, and
 * each locked skill a folder lacks. A skill added by hand, or kept in one
 * folder only, never reaches the copy checks below.
 */
function unlockedSkills(dir = root) {
  const locked = new Set(lockedSkills(dir).map(([name]) => name));
  const problems: string[] = [];
  for (const folder of skillFolders) {
    const listed = fs.existsSync(path.join(dir, folder))
      ? fs.readdirSync(path.join(dir, folder))
      : [];
    for (const name of listed.filter((entry) => !locked.has(entry))) {
      problems.push(`${folder}/${name} has no entry in skills-lock.json`);
    }
    for (const name of [...locked].filter((entry) => !listed.includes(entry))) {
      problems.push(`${folder}/${name} is missing for a locked skill`);
    }
  }
  return problems;
}

/** Each entry under `dir` by relative path: file contents, or "link". */
function tree(dir: string) {
  const entries = new Map<string, string>();
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    const file = path.join(dir, String(entry));
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) {
      entries.set(String(entry), "link");
    } else if (stat.isFile()) {
      entries.set(String(entry), fs.readFileSync(file, "utf-8"));
    }
  }
  return entries;
}

const skillDirs = (name: string) => ({
  claude: path.join(root, ".claude/skills", name),
  shared: path.join(root, ".agents/skills", name),
});

describe("committed skills", () => {
  it("are exactly the skills in the lock, in both folders", () => {
    expect(unlockedSkills()).toStrictEqual([]);
  });

  it("install as real directories for every agent", () => {
    for (const [name, skill] of lockedSkills()) {
      const { claude, shared } = skillDirs(name);
      expect(skill).toHaveProperty("installMode", "copy");
      expect(fs.lstatSync(shared).isDirectory()).toBeTruthy();
      expect(fs.lstatSync(claude).isDirectory()).toBeTruthy();
    }
  });

  it("hold the same files for every agent", () => {
    for (const [name] of lockedSkills()) {
      const { claude, shared } = skillDirs(name);
      const files = tree(shared);
      expect(files.has("SKILL.md")).toBeTruthy();
      expect([...files.values()]).not.toContain("link");
      expect(tree(claude)).toStrictEqual(files);
    }
  });
});

/** The same skills in both folders. */
const both = (...names: string[]) => ({
  ".agents/skills": names,
  ".claude/skills": names,
});

describe("the skill inventory", () => {
  const fixtures: string[] = [];
  afterEach(() => {
    for (const dir of fixtures.splice(0)) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });

  /** A checkout with `skills` in each folder and, unless undefined, a lock. */
  function checkout(skills: Record<string, string[]>, lock?: string[]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-"));
    fixtures.push(dir);
    for (const [folder, names] of Object.entries(skills)) {
      for (const name of names) {
        fs.mkdirSync(path.join(dir, folder, name), { recursive: true });
      }
    }
    if (lock !== undefined) {
      const entries = new Map(
        lock.map((name) => [name, { installMode: "copy" }])
      );
      fs.writeFileSync(
        path.join(dir, "skills-lock.json"),
        JSON.stringify({ skills: Object.fromEntries(entries), version: 2 })
      );
    }
    return dir;
  }

  it("accept matching folders and lock", () => {
    expect(unlockedSkills(checkout(both("a", "b"), ["a", "b"]))).toStrictEqual(
      []
    );
  });

  it("accept a checkout with every skill removed", () => {
    expect(unlockedSkills(checkout({}))).toStrictEqual([]);
    expect(unlockedSkills(checkout(both(), []))).toStrictEqual([]);
  });

  it("reject a skill in only one folder", () => {
    const dir = checkout({ ".agents/skills": ["a"], ".claude/skills": [] }, [
      "a",
    ]);
    expect(unlockedSkills(dir)).toStrictEqual([
      ".claude/skills/a is missing for a locked skill",
    ]);
  });

  it("reject a skill folder with no lock entry", () => {
    expect(unlockedSkills(checkout(both("a", "b"), ["a"]))).toStrictEqual([
      ".agents/skills/b has no entry in skills-lock.json",
      ".claude/skills/b has no entry in skills-lock.json",
    ]);
  });

  it("reject skill folders with no lock file", () => {
    expect(unlockedSkills(checkout(both("a")))).toStrictEqual([
      ".agents/skills/a has no entry in skills-lock.json",
      ".claude/skills/a has no entry in skills-lock.json",
    ]);
  });
});

/**
 * Each package that `pnpm-workspace.yaml` text grants agent skills. pnpm reads
 * YAML 1.1 booleans, so `yes`, `on` and `y` grant too. Only `skills: false`, or
 * an entry without `skills`, is not a grant; anything else counts as one. Keys
 * stay strings, as pnpm reads them, so a package named `on` is not `true`.
 */
function skillGrants(text: string) {
  const doc = parseDocument(text, { stringKeys: true, version: "1.1" });
  if (doc.errors.length > 0) {
    throw doc.errors[0];
  }
  const config: unknown = doc.toJS({ mapAsMap: true }) ?? new Map();
  if (!(config instanceof Map)) {
    throw new TypeError("pnpm-workspace.yaml is not a map of settings");
  }
  const permissions: unknown = config.get("permissions") ?? new Map();
  if (!(permissions instanceof Map)) {
    throw new TypeError("pnpm-workspace.yaml permissions is not a map");
  }
  const grants: string[] = [];
  for (const [name, entry] of new Map<unknown, unknown>(permissions)) {
    const skills: unknown =
      entry instanceof Map
        ? new Map<unknown, unknown>(entry).get("skills")
        : entry;
    if (skills !== false && skills !== undefined) {
      grants.push(String(name));
    }
  }
  return grants;
}

/** What to do about a grant, shown when the committed file has one. */
const grantMessage = (name: string) =>
  `pnpm-workspace.yaml grants agent skills to ${name}, linking them unreviewed into every checkout. Revert that change, or set \`skills: false\` for ${name} under \`permissions\`, then run \`pnpm install\` to unlink them. To adopt them on purpose, add ${name} to approvedSkills in scripts/skills.test.ts; see docs/tooling.md#skills.`;

const workspace = (permissions: string) =>
  `packages: []\n\npermissions:\n${permissions}\n`;

describe("dependency skills", () => {
  it("are granted to no package the project has not adopted", () => {
    const text = fs.readFileSync(workspacePath, "utf-8");
    const grants = skillGrants(text).filter(
      (name) => !approvedSkills.has(name)
    );
    expect(grants.map(grantMessage)).toStrictEqual([]);
  });

  it("find no grant without a permissions block", () => {
    expect(skillGrants("")).toStrictEqual([]);
    expect(
      skillGrants("packages: []\nallowBuilds:\n  esbuild: true\n")
    ).toStrictEqual([]);
    expect(skillGrants("packages: []\npermissions:\n")).toStrictEqual([]);
  });

  // The exact text `pnpm approve ultracite -y` appended on pnpm 12.15.0.
  it("find the grant `pnpm approve` writes", () => {
    expect(
      skillGrants(workspace("  ultracite:\n    skills: true"))
    ).toStrictEqual(["ultracite"]);
  });

  // The exact text `pnpm approve '!@tanstack/react-start' -y` appended.
  it("allow the denial `pnpm approve '!<package>'` writes", () => {
    expect(
      skillGrants(workspace("  '@tanstack/react-start':\n    skills: false"))
    ).toStrictEqual([]);
  });

  it.each([
    '  "@scope/pkg":\n    skills: true',
    "  '@scope/pkg': { skills: true }",
    "  '@scope/pkg':\n    # reviewed?\n    skills: True # yes",
    "  '@scope/pkg':\n      skills: TRUE",
    "  '@scope/pkg':\n    skills: yes",
    "  '@scope/pkg':\n    skills: on",
    "  '@scope/pkg':\n    skills: y",
    "  ? '@scope/pkg'\n  : skills: true",
    "  '@scope/pkg':\n    skills: &grant true",
    "  '@scope/pkg':\n    build: true\n    skills: true",
  ])("find a grant spelled %j", (entry) => {
    expect(skillGrants(workspace(entry))).toStrictEqual(["@scope/pkg"]);
  });

  it("find grants in flow maps and merged anchors", () => {
    expect(
      skillGrants('permissions: { "@scope/pkg": { skills: true } }\n')
    ).toStrictEqual(["@scope/pkg"]);
    expect(
      skillGrants(
        "grant: &grant { skills: true }\npermissions:\n  ultracite: { <<: *grant }\n"
      )
    ).toStrictEqual(["ultracite"]);
  });

  it.each(["false", "False", "no", "off"])(
    "allow a denial spelled %j",
    (spelling) => {
      expect(
        skillGrants(workspace(`  ultracite:\n    skills: ${spelling}`))
      ).toStrictEqual([]);
    }
  );

  it("ignore permissions other than skills", () => {
    expect(
      skillGrants(workspace("  ultracite:\n    build: true"))
    ).toStrictEqual([]);
  });

  it.each([
    "  ultracite: true",
    "  ultracite:",
    "  ultracite: [skills]",
    "  ultracite:\n    skills: 1",
    '  ultracite:\n    skills: "false"',
  ])("count an entry they cannot read, %j, as a grant", (entry) => {
    expect(skillGrants(workspace(entry))).toStrictEqual(["ultracite"]);
  });

  it("name each granted package and skip the denied ones", () => {
    const text = workspace(
      "  ultracite:\n    skills: true\n  msw:\n    skills: false\n  '@tanstack/react-start':\n    skills: true"
    );
    expect(skillGrants(text)).toStrictEqual([
      "ultracite",
      "@tanstack/react-start",
    ]);
  });

  // pnpm keeps an unquoted `on` or `010` as the package's name.
  it("name a package as written, not as a YAML boolean or number", () => {
    expect(
      skillGrants(
        workspace("  on:\n    skills: true\n  010:\n    skills: true")
      )
    ).toStrictEqual(["on", "010"]);
  });

  it("fail loudly on a file they cannot read", () => {
    expect(() => skillGrants("permissions: [ultracite]\n")).toThrow(
      "permissions is not a map"
    );
    expect(() => skillGrants("- packages\n")).toThrow(
      "is not a map of settings"
    );
    expect(() =>
      skillGrants(
        workspace(
          "  ultracite:\n    skills: false\n  ultracite:\n    skills: true"
        )
      )
    ).toThrow("Map keys must be unique");
  });

  it("explain how to deny a grant and how to adopt one on purpose", () => {
    const message = grantMessage("ultracite");
    expect(message).toContain("grants agent skills to ultracite");
    expect(message).toContain("set `skills: false` for ultracite");
    expect(message).toContain("add ultracite to approvedSkills");
    expect(message).toContain("docs/tooling.md#skills");
  });
});

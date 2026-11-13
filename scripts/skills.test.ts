// Committed skills live twice: most agents read `.agents/skills/`, and Claude
// Code reads `.claude/skills/`. Each must be a real copy, since a checkout
// without symlink support, as on Windows by default, turns a link into a text
// file. The copies must also match: `npx skills update` rewrites both, so a
// difference means one was edited by hand and one agent runs a stale skill.
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.join(import.meta.dirname, "..");
const lockPath = path.join(root, "skills-lock.json");

/** Each skill in `skills-lock.json` with its entry; none without a lock. */
function lockedSkills() {
  const text = fs.existsSync(lockPath)
    ? fs.readFileSync(lockPath, "utf-8")
    : "{}";
  const lock: unknown = JSON.parse(text);
  const skills: unknown = new Map(Object.entries(lock ?? {})).get("skills");
  return Object.entries(skills ?? {});
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

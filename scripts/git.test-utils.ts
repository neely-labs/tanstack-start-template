// The environment for tests that run Git, from docs/recipes/git-fixtures.md.
import { execFileSync } from "node:child_process";
import os from "node:os";

const local = new Set(
  execFileSync("git", ["rev-parse", "--local-env-vars"], {
    encoding: "utf-8",
  }).split("\n")
);

/** An environment for Git fixtures under `base`, a fresh temporary directory. */
export const fixtureEnv = (base: string) =>
  ({
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !local.has(key))
    ),
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_AUTHOR_NAME: "test",
    GIT_CEILING_DIRECTORIES: base,
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: "1",
  }) satisfies NodeJS.ProcessEnv;

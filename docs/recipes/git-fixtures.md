# Git fixtures: when a test runs Git

**Trigger:** a test that runs `git`, directly or through the code under test, such as a script that reads status or creates worktrees.

Git exports repository variables such as `GIT_DIR` and `GIT_INDEX_FILE` to its hooks, and the `pre-push` hook here runs the test suite. A test that inherits them acts on the real repository even with `git -C <fixture>`: its `init` reinitializes your repository and its commits land on your branch. When a fixture has no `.git`, Git also searches parent directories, which can reach a repository around the temporary directory, including one in your home directory.

## Add

Run every fixture Git command, and any code under test that runs Git, with a sanitized environment and a ceiling directory:

```ts
import { execFileSync } from "node:child_process";
import os from "node:os";

const local = new Set(
  execFileSync("git", ["rev-parse", "--local-env-vars"], {
    encoding: "utf-8",
  }).split("\n")
);

/** An environment for Git fixtures under `base`, a fresh temporary directory. */
export const fixtureEnv = (base: string): NodeJS.ProcessEnv => ({
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
});
```

- `--local-env-vars` lists the repository variables to drop, so the list stays right as Git adds more. `gitEnv` in `scripts/local.ts` strips the same list for production code.
- `GIT_CEILING_DIRECTORIES` stops discovery at `base`, so a fixture without `.git` fails instead of finding another repository.
- Empty global and system config keep a developer's signing, hooks path, or default branch from changing results; set what the test needs with `-c` or in the fixture's own config.

## Prove

Run the Git tests the way a hook would, aimed at a decoy repository so a leak cannot harm yours, then confirm the decoy is untouched:

```bash
decoy=$(mktemp -d) && git init -q "$decoy"
GIT_DIR="$decoy/.git" pnpm test path/to/git.test.ts
git -C "$decoy" rev-list --all | wc -l # 0: no commit leaked
```

Show the guard working: replace `fixtureEnv(base)` with `process.env` once, rerun, and the decoy gains commits or the tests fail. Restore it. A fixture command run in an empty directory under `base` must fail with "not a git repository".

## Remove

When no test runs Git, delete the helper.

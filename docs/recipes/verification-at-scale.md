# Verification at scale: when checks or worktrees cost too much

**Trigger:** one of the measurements below crosses its threshold. Measure before adding anything; each step trades some certainty for speed.

## Add

**Affected checks before push.** _Measure:_ time `pnpm validate` on ordinary pushes for a week. _Switch when_ it regularly takes more than about two minutes, or pushes start skipping the hook. Move the `pre-push` job in `lefthook.yml` to lint and types on every push plus the tests affected since the base branch, and keep CI's full `pnpm validate` as the required check:

```yaml
pre-push:
  jobs:
    - name: lint and types
      run: pnpm check && pnpm typecheck
    - name: affected tests
      run: pnpm test:changed origin/main
      exclude: "*.{md,css,svg,png,ico}"
```

Lefthook skips a job when its `exclude` leaves none of the pushed files, so a push of only docs, stylesheets, and images runs no tests, and CI checks it. List the file types the project ships that no unit test imports; drop one once a test imports it. Every other push runs the affected tests and fails when they select none. That includes a push of only untested code, such as a new module with no test: it fails until you add a relevant test, or run `pnpm validate` and push with `--no-verify`. [Check your changes](../development.md#check-your-changes) lists what affected selection misses.

**Named full-validation checkpoints.** _Measure:_ count the pull requests whose CI failed after local affected checks passed. With affected checks in the hook, full `pnpm validate` still runs at three named points: when a pull request becomes ready for review, after a rebase that brings in dependency or config changes, and in CI on the head to be merged. If more than about one pull request in ten fails CI that way, add a checkpoint or widen the hook.

**Reuse a full pass for an unchanged tree.** _Measure:_ log `git rev-parse HEAD^{tree}` on each full run; repeats are runs that proved nothing new, such as after a message-only amend or a rebase onto an unchanged base. Once repeats are common, record each clean pass and skip a tree that already passed:

```bash
key="$(git rev-parse 'HEAD^{tree}') $(node --version) $(cksum <node_modules/.modules.yaml)"
stamp=node_modules/.cache/validated
clean() { test -z "$(git status --porcelain)"; }
if clean && [ "$(cat "$stamp" 2>/dev/null)" = "$key" ]; then echo "Already validated: $key"; exit 0; fi
clean && before=clean
pnpm validate || exit
if [ "$before" = clean ] && clean; then mkdir -p "${stamp%/*}" && echo "$key" >"$stamp"; fi
```

A tree that was dirty before or after the run still validates but is never stamped. The key also covers the Node version and pnpm's install record, `node_modules/.modules.yaml`, so a different install, such as `--prod`, validates again. CI never reuses a pass.

**Sweep finished worktrees.** _Measure:_ `git worktree list | wc -l`, the disk those trees use, and servers that `pnpm local:status` still reports running. Once finished worktrees pile up faster than people retire them, sweep the ones whose pull request merged at exactly the commit the worktree holds:

```bash
git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r tree; do
  branch=$(git -C "$tree" branch --show-current)
  merged=$(gh pr view "$branch" --json state,headRefOid --jq '.state + " " + .headRefOid')
  [ -n "$branch" ] && [ "$merged" = "MERGED $(git -C "$tree" rev-parse HEAD)" ] || continue
  pnpm local:retire --checkout "$tree" && git worktree remove "$tree"
done
```

Run it from an up-to-date checkout. A branch with commits after its merge, an open pull request, or none at all stays. `local:retire` refuses a tree with uncommitted work, which keeps that tree; report it instead of forcing removal.

## Prove

- After switching the hook, push a change that breaks one module's test: the push fails. Push a change to a module no test imports: the push fails with no affected tests. Push a Markdown-only change and a stylesheet-only change: the affected tests are skipped, and each push passes.
- Run the reuse script twice on a clean tree: the second run skips. Change one file and it validates again.
- The sweep removes a worktree whose pull request merged at its head, and keeps one with a later commit, an unmerged one, and a dirty merged one with its refusal printed.

## Remove

Restore `pnpm validate` as the `pre-push` job, delete the reuse script and its stamp, and stop scheduling the sweep.

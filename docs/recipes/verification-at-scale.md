# Verification at scale: when checks or worktrees cost too much

**Trigger:** one of the measurements below crosses its threshold. Measure before adding anything; each step trades some certainty for speed.

## Add

**Affected checks before push.** _Measure:_ time `pnpm validate` on ordinary pushes for a week. _Switch when_ it regularly takes more than about two minutes, or pushes start skipping the hook. Move the `pre-push` job in `lefthook.yml` to lint, types, and the tests affected since the base branch, and keep CI's full `pnpm validate` as the required check:

```yaml
pre-push:
  jobs:
    - name: affected checks
      run: pnpm check && pnpm typecheck && pnpm test --changed origin/main
```

Affected selection misses files read at runtime, dependency and config changes, and a branch with nothing to compare. When you run it by hand to check a regression, add `--passWithNoTests=false`: zero selected tests means the selection missed, not that it passed.

**Named full-validation checkpoints.** _Measure:_ count the pull requests whose CI failed after local affected checks passed. With affected checks in the hook, full `pnpm validate` still runs at three named points: when a pull request becomes ready for review, after a rebase that brings in dependency or config changes, and in CI on the head to be merged. If more than about one pull request in ten fails CI that way, add a checkpoint or widen the hook.

**Reuse a full pass for an unchanged tree.** _Measure:_ log `git rev-parse HEAD^{tree}` on each full run; repeats are runs that proved nothing new, such as after a message-only amend or a rebase onto an unchanged base. Once repeats are common, record each clean pass and skip a tree that already passed:

```bash
key="$(git rev-parse 'HEAD^{tree}') $(node --version)" stamp=node_modules/.cache/validated
clean() { test -z "$(git status --porcelain)"; }
if clean && [ "$(cat "$stamp" 2>/dev/null)" = "$key" ]; then echo "Already validated: $key"; exit 0; fi
clean && before=clean
pnpm validate || exit
if [ "$before" = clean ] && clean; then mkdir -p "${stamp%/*}" && echo "$key" >"$stamp"; fi
```

A tree that was dirty before or after the run still validates but is never stamped. The key includes the Node version, and the stamp lives in `node_modules/`, so a reinstall discards it. CI never reuses a pass.

**Sweep finished worktrees.** _Measure:_ `git worktree list | wc -l`, the disk those trees use, and servers that `pnpm local:status` still reports running. Once finished worktrees pile up faster than people retire them, sweep the ones whose branch was merged and deleted upstream:

```bash
git fetch --prune origin
git worktree list --porcelain | sed -n 's/^worktree //p' | while read -r tree; do
  branch=$(git -C "$tree" branch --show-current)
  track=$(git -C "$tree" for-each-ref --format='%(upstream:track)' "refs/heads/$branch")
  [ -n "$branch" ] && [ "$track" = "[gone]" ] || continue
  pnpm local:retire --checkout "$tree" && git worktree remove "$tree"
done
```

Run it from an up-to-date checkout. `local:retire` refuses a tree with uncommitted work, which keeps that tree; report it instead of forcing removal. The sweep relies on the host deleting merged branches.

## Prove

- After switching the hook, push a change that breaks one module's test: the push fails. Push a docs-only change: it passes quickly, and CI still runs everything.
- Run the reuse script twice on a clean tree: the second run skips. Change one file and it validates again.
- With one merged and one active worktree, the sweep removes only the merged one, and a dirty merged one stays with its refusal printed.

## Remove

Restore `pnpm validate` as the `pre-push` job, delete the reuse script and its stamp, and stop scheduling the sweep.

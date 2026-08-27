# Repository rulesets

GitHub does not copy repository settings when someone uses this repository as a template. These importable rulesets make the important branch protections reviewable in the repository and repeatable in a new one.

See GitHub's [ruleset documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets) for plan requirements and the equivalent Settings > Rules > Rulesets import flow.

## Baseline

`default-branch.json` protects the default branch from deletion and force pushes, requires pull requests with resolved review conversations, allows squash and rebase merges, and requires the tracked `validate` GitHub Actions check. It starts with zero required approvals so a solo maintainer is not locked out; add an approval and code-owner requirement when the project has a review team. The repository-admin bypass is explicit for break-glass recovery; remove it if the project requires every change to use the protected path.

Apply it once the new repository exists and the authenticated GitHub account has repository administration permission:

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  "repos/$repo/rulesets" \
  --input .github/rulesets/default-branch.json
```

The API call creates a new ruleset each time it runs. Check first with `gh ruleset list`, or edit the existing ruleset in GitHub Settings when reapplying a policy.

## Optional deployment gate

`vercel-preview.json` is an additional ruleset for a repository connected to [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github). Apply it only after a preview deployment has completed and GitHub shows its deployment environment as exactly `Preview`:

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  "repos/$repo/rulesets" \
  --input .github/rulesets/vercel-preview.json
```

Vercel can use a project-suffixed or custom environment name. Change the `required_deployment_environments` value to the exact name GitHub reports before importing the file. Do not apply this file just because Vercel is the planned host: a deployment rule with no matching deployment blocks merges.

Cloudflare Workers and other hosts do not share one deployment environment name. Keep the baseline ruleset and add a separate `required_deployments` rule only after the chosen integration emits a stable GitHub deployment environment. The rule can also be added in Settings > Rules > Rulesets.

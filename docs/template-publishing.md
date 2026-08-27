# Template publishing checklist

Repository files are only part of a dependable template. Complete this checklist before making the repository public or enabling GitHub's template setting.

## Repository identity

- Confirm the root MIT license and vendored third-party license copies are present.
- Set a concise repository description and useful topics.
- Keep `main` as the default branch and mark the repository as a template.
- Confirm the README describes the template itself rather than a product created from it.

## Repository protections

- The files under `.github/rulesets` are importable repository-level policies; GitHub does not copy active settings through the template flow. Import `default-branch.json` into this source repository and rehearse the same command in a generated repository. It protects the default branch and requires the `validate` check without requiring an approval, which keeps a single-maintainer template usable.
- Do not import the optional `vercel-preview.json` until a connected Vercel project has emitted a successful `Preview` deployment in GitHub. Change the environment name first when a project uses a suffix or custom environment.
- Keep CodeQL on advanced setup. `.github/workflows/codeql.yml` is the tracked configuration and travels with every repository created from this template. GitHub refuses an advanced-setup upload wherever default setup is enabled, so a repository covered by an enforced organization configuration has to be allowed to override it before this workflow can report.
- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection when the repository plan supports them.
- Keep GitHub Actions restricted to the permissions each workflow needs.

The tracked Dependabot configuration updates GitHub Actions only. [GitHub currently documents pnpm version updates through v10](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories), so application dependency updates remain a reviewed local task while this template uses pnpm 11.

## Vercel

- Import the repository with **TanStack Start** as the Framework Preset. Keep the detected build and output settings; Nitro supplies the server build layer through `vite.config.ts`.
- Confirm the project uses Node.js 24.
- Configure the production domain and any application-specific environment variables.
- Run `pnpm validate`, deploy a preview, and verify the real public routes, metadata, social image, and error path before promoting it.

## Rehearse the template

1. Create a temporary repository through GitHub's **Use this template** flow.
2. Open the generated repository's **Actions** tab. If GitHub says workflows are not being run, click **Enable Actions on this repository**, then confirm CI and CodeQL can be started.
3. Install the pinned package manager with `npx get-pnpm 11.24.0` if needed.
4. Run `pnpm install --frozen-lockfile` and `pnpm validate`.
5. Import `.github/rulesets/default-branch.json` with the command in `.github/rulesets/README.md`, then run `gh ruleset check --default` and confirm `validate` is required. If the generated repository is intentionally left unprotected, record that as an explicit exception.
6. If the host is Vercel, connect the project, create a preview from a pull request, and verify the deployment environment name before optionally importing `vercel-preview.json`. Do not enable a deployment rule with no matching deployment.
7. Start the application and inspect the home, about, and not-found states on desktop and mobile. Temporarily throw an error from an example route to verify the global recovery state, then revert that throw.
8. Confirm the generated repository has its own unrelated Git history.
9. Remove the temporary rehearsal repository when the check is complete.

Repository secrets, Vercel links, active branch rulesets, and security settings do not travel with the template files. Configure them for every repository created from this template. Keep the JSON policy files when a project wants future changes to remain reviewable; an organization-managed ruleset can be the source of truth instead.

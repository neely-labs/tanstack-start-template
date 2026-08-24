# Template publishing checklist

Repository files are only part of a dependable template. Complete this checklist before making the repository public or enabling GitHub's template setting.

## Repository identity

- Confirm the root MIT license and vendored third-party license copies are present.
- Set a concise repository description and useful topics.
- Keep `main` as the default branch and mark the repository as a template.
- Confirm the README describes the template itself rather than a product created from it.

## Repository protections

- Add a branch ruleset that requires the `validate` job before merging.
- Enable CodeQL default setup for JavaScript and TypeScript.
- Enable Dependabot alerts and security updates.
- Enable secret scanning and push protection when the repository plan supports them.
- Keep GitHub Actions restricted to the permissions each workflow needs.

The tracked Dependabot configuration updates GitHub Actions only. [GitHub currently documents pnpm version updates through v10](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories), so application dependency updates remain a reviewed local task while this template uses pnpm 12.

## Vercel

- Import the repository without adding a `vercel.json` or overriding the detected build settings.
- Confirm the project uses Node.js 24.
- Configure the production domain and any application-specific environment variables.
- Run `pnpm validate`, deploy a preview, and verify the real public routes, metadata, social image, and error path before promoting it.

## Rehearse the template

1. Create a temporary repository through GitHub's **Use this template** flow.
2. Install the pinned package manager with `npx get-pnpm 12.0.0-rc.10` if needed.
3. Run `pnpm install --frozen-lockfile` and `pnpm validate`.
4. Start the application and inspect the home, about, and not-found states on desktop and mobile. Temporarily throw an error from an example route to verify the global recovery state, then revert that throw.
5. Confirm the generated repository has its own unrelated Git history.
6. Remove the temporary rehearsal repository when the check is complete.

Repository secrets, Vercel links, branch rulesets, and security settings do not travel with the template files. Configure them for every repository created from this template.

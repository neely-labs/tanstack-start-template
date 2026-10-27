# Deploy the app

Use this guide when choosing a host or preparing the first deployment. Run `pnpm validate` and the [production browser checks](development.md#check-your-changes) first, and verify the actual preview before promoting it.

Nitro handles the host-specific build through a preset in `vite.config.ts`. Each host uses the same `pnpm build` command. For another host, choose from [Nitro's presets](https://nitro.build/deploy).

## GitHub setup

After creating a repository from the template, open its Actions tab. If workflows are disabled, enable them, then run CI manually or push another commit so GitHub receives a new event.

Repository settings do not copy from a template. The optional policies in `.github/rulesets` protect the default branch and can require a successful preview deployment. Apply them after choosing the new repository's policy, following [the ruleset instructions](../.github/rulesets/README.md). Add a deployment requirement only after the host has emitted a successful GitHub deployment, using its exact environment name.

## Vercel

Import the repository with Framework Preset set to TanStack Start. Keep the generated build command and output directory, use `./` as the root for a root-level app, and select Node.js 24. The Nitro plugin detects Vercel; no `vercel.json` is needed.

If merges should wait for the Vercel preview, follow the [optional deployment rule](../.github/rulesets/README.md#optional-deployment-gate) after the first preview succeeds. Confirm the GitHub environment name, since custom or multi-project setups may use a different value from `Preview`.

## Cloudflare Workers

Add the Cloudflare preset to the existing Nitro configuration, preserving the route rules and prerender options:

```diff
     nitro({
+      preset: "cloudflare-module",
       routeRules: { "/**": { headers: securityHeaders } },
```

`pnpm build` prerenders through Wrangler and writes `.output/server/wrangler.json` with Node compatibility and static-asset bindings. Deploy that output:

```bash
cd .output/server && npx wrangler deploy
```

For a required deployment gate, wait until the chosen Cloudflare integration emits a stable GitHub environment, then use that exact name in the rule.

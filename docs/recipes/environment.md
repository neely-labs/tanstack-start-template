# Environment: when the app first reads a variable

**Trigger:** the first environment variable the app reads, such as `DATABASE_URL` from [the persistence recipe](persistence.md). Tooling ports such as `E2E_PORT` stay where they are.

## Add

The code lives in [`environment/`](environment/), beside this file, and uses T3 Env with Zod. The template already lists `@t3-oss/env-core` so that folder compiles, and Nitro bundles it into the server output. Copy the three files into `src/`, then replace the example variables with yours:

- **[`env.server.ts`](environment/env.server.ts)** declares every server variable and exports `serverEnv`. Its `.server.ts` suffix makes TanStack Start's import protection fail the build when browser code imports it, so read it in server functions, server routes and middleware.
- **[`env.ts`](environment/env.ts)** declares every variable browser code reads and exports `publicEnv`. Vite puts each `VITE_` value into the page at build time, so none may be secret. T3 Env makes a name without the prefix a type error here, and a name with it a type error in the server file.
- **[`env-check.ts`](environment/env-check.ts)** is a Nitro plugin that imports both. Register it in `vite.config.ts` as `nitro({ plugins: ["./src/env-check.ts"], ... })`. Nitro loads the app on the first request, so without the plugin the server starts and that request fails instead.

Each schema converts its value: `z.coerce.number()` for a number and `z.stringbool()` for a flag, since `z.coerce.boolean()` reads `"false"` as true. `emptyStringAsUndefined` makes `NAME=` count as missing.

Nothing else reads `process.env` or `import.meta.env` for configuration; Vite's own `import.meta.env.DEV` stays. Add an override to `oxlint.config.ts` so `pnpm check` enforces the server side:

```ts
{
  files: ["src/**"],
  excludeFiles: ["src/env.server.ts"],
  rules: { "node/no-process-env": "error" },
},
```

**Where values come from.** `pnpm dev` and `pnpm build` also read `.env`, which Git ignores. `pnpm start` reads only the real environment, so the host sets every value. The build prerenders pages by starting the server, so it checks and needs every value too, and a prerendered page keeps what it read then. Give CI's validate and smoke-test steps an `env:` block, with non-secret test values where they serve. Leave out T3 Env's `skipValidation`: a build that skips the check proves nothing about the values.

## Prove

With no `.env` file:

- `DATABASE_URL= pnpm build` exits non-zero, and its log names `DATABASE_URL`. After a good build, `DATABASE_URL= pnpm start` exits the same way before it listens.
- Import `serverEnv` into a page component and `pnpm build` fails with `Import denied in client environment`. Read inside a `createServerFn` handler in the same route file, it builds.
- `DATABASE_URL=postgres:///app DATABASE_POOL_SIZE=5 node -e 'import("./src/env.server.ts").then(({ serverEnv }) => console.log(typeof serverEnv.DATABASE_POOL_SIZE))'` prints `number`.
- A `process.env` read in any other file under `src/` fails `pnpm check`.

## Remove

Once the app reads no variable, delete the copied files, the plugin entry, the lint override and the CI `env:` values. Drop `@t3-oss/env-core` only together with this recipe's folder, which needs it to compile.

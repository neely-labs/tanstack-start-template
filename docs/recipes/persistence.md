# Persistence: when the app first stores data

**Trigger:** the first feature that reads or writes a database. Pick the database and its migration tool first; the examples assume Postgres and Drizzle.

## Add

**A disposable database per checkout.** Register it in `resources` in `scripts/local.ts`, before `devServer`, so `pnpm dev:local` creates and migrates it, `pnpm local:status` reports it, and `pnpm local:retire` drops it. Keep anything worth keeping in a seed script.

```ts
const dbName = (checkout: Checkout) =>
  `app_${createHash("sha256").update(checkout.root).digest("hex").slice(0, 12)}`;
const exists = (name: string) =>
  execFileSync("psql", ["-lqtA"], { encoding: "utf-8" })
    .split("\n")
    .some((row) => row.startsWith(`${name}|`));

export const database: Resource = {
  name: "database",
  async setup(checkout) {
    const name = dbName(checkout);
    if (!exists(name)) execFileSync("createdb", [name]);
    process.env.DATABASE_URL = `postgres:///${name}`; // the server inherits it
    execFileSync("pnpm", ["db:migrate"], { stdio: "inherit" });
  },
  status: (checkout) => ({
    state: exists(dbName(checkout)) ? "present" : "absent",
  }),
  async teardown(checkout) {
    execFileSync("dropdb", ["--if-exists", dbName(checkout)]);
    return [`dropped database ${dbName(checkout)}`];
  },
};
export const resources: Resource[] = [database, devServer];
```

**An integration-test command that fails without its database.** Name integration tests `*.integration.test.ts`, add `exclude: [...configDefaults.exclude, "**/*.integration.test.ts"]` to `vitest.config.ts`, and add `"test:integration": "vitest run --config vitest.integration.config.ts"`. That config includes only integration tests and sets a `globalSetup` that connects to `DATABASE_URL` and throws, naming the variable, when it is unset or unreachable. Never use `it.skipIf(!process.env.DATABASE_URL)`: a suite that skips everything reports green. CI runs the command against a database service as a required check.

**Pushed migrations are never regenerated.** Once a migration leaves your machine, some database may have applied it, so change the schema with a new migration. CI enforces this against the base branch, with its history fetched:

```bash
changed=$(git diff --name-only --diff-filter=DMR origin/main...HEAD -- drizzle/)
test -z "$changed" || { printf 'Pushed migrations changed:\n%s\n' "$changed"; exit 1; }
```

**Every migration is journaled.** Drizzle applies only the files listed in `drizzle/meta/_journal.json` and skips the rest silently. A unit test expects each journal entry's `tag` plus `.sql` to match the `.sql` files in `drizzle/`, both ways.

**Cookies namespaced per checkout, once auth exists.** Browsers share cookies across ports on one host, so two checkouts on `localhost` overwrite each other's sessions. In development, suffix the session cookie name with the request's port, such as `session_20417`; keep the plain name in production.

## Prove

- `pnpm local:status` shows the database `present` while serving and `absent` after `pnpm local:retire`, while another checkout's stays `present`.
- `DATABASE_URL= pnpm test:integration` exits non-zero and names the variable.
- On a scratch branch, edit a merged migration and the CI check fails; delete a journal entry and the unit test fails.
- Sign in on two checkouts at once; both stay signed in after reloading each.

## Remove

Run `pnpm local:retire` in each checkout so no database is orphaned. Then delete the resource, the integration config and command, the CI steps, and the cookie suffix.

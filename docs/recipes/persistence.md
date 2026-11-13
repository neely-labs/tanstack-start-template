# Persistence: when the app first stores data

**Trigger:** the first feature that reads or writes a database. Pick the database and its migration tool first; the examples assume Postgres and Drizzle.

## Add

**A disposable database per checkout.** Register it first in `resources` in `scripts/local.ts`, as `[database, devServer]`, so `pnpm dev:local` creates and migrates it, `pnpm local:status` reports it, and `pnpm local:retire` drops it. The snippet uses only imports and types that file already has. Setting `DATABASE_URL` in `setup` passes it to the migration and the dev server. Keep anything worth keeping in a seed script.

```ts
async function run(command: string, ...args: string[]) {
  const child = spawn(command, args, { stdio: "inherit" });
  await once(child, "exit");
  if (child.exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}
const dbName = (checkout: Checkout) =>
  `app_${createHash("sha256").update(checkout.root).digest("hex").slice(0, 12)}`;
const list = ["-d", "postgres", "-tAc", "SELECT datname FROM pg_database"];
const exists = (name: string) =>
  execFileSync("psql", list, { encoding: "utf-8" }).split("\n").includes(name);

export const database: Resource = {
  name: "database",
  async setup(checkout) {
    if (!exists(dbName(checkout))) {
      await run("createdb", dbName(checkout));
    }
    process.env.DATABASE_URL = `postgres:///${dbName(checkout)}`;
    await run("pnpm", "db:migrate");
  },
  status: (checkout) => ({
    state: exists(dbName(checkout)) ? "present" : "absent",
  }),
  async teardown(checkout) {
    if (!exists(dbName(checkout))) {
      return [];
    }
    await run("dropdb", dbName(checkout));
    return [`dropped database ${dbName(checkout)}`];
  },
};
```

**An integration-test command that fails without its database.** Name integration tests `*.integration.test.ts`, add `exclude: [...configDefaults.exclude, "**/*.integration.test.ts"]` to `vitest.config.ts`, importing `configDefaults` from `vitest/config`, and add `"test:integration": "vitest run --config vitest.integration.config.ts"`. That config includes only integration tests and sets a `globalSetup` that connects to `DATABASE_URL` and throws, naming the variable, when it is unset or unreachable. Never use `it.skipIf(!process.env.DATABASE_URL)`: a suite that skips everything reports green. CI runs the command against a database service as a required check. Rename `scripts/local.test.ts` to `scripts/local.integration.test.ts` as well: its retirement tests now reach the database.

**Pushed migrations are never regenerated, and every migration is journaled.** Once a migration leaves your machine, some database may have applied it, so change the schema with a new migration. In CI, with the base branch's history fetched, fail when `git diff --name-only --diff-filter=DMR origin/main...HEAD -- 'drizzle/*.sql'` prints anything; the journal is left out because each new migration appends to it. Drizzle applies only the files listed in `drizzle/meta/_journal.json` and skips the rest silently, so a unit test expects each journal entry's `tag` plus `.sql` to match the `.sql` files in `drizzle/`, both ways.

**Cookies namespaced per checkout, once auth exists.** Browsers share cookies across ports on one host, so two checkouts on `localhost` overwrite each other's sessions. In development, suffix the session cookie name with the request's port, such as `session_20417`; keep the plain name in production.

## Prove

- `pnpm local:status` shows the database `present` while serving and `absent` after `pnpm local:retire`, while another checkout's stays `present`.
- `DATABASE_URL= pnpm test:integration` exits non-zero and names the variable.
- On a scratch branch, edit a merged migration and the CI check fails; delete a journal entry and the unit test fails. Signed in on two checkouts at once, both stay signed in after reloading each.

## Remove

Run `pnpm local:retire` in each checkout so no database is orphaned. Then delete the resource, the integration config and command, the CI steps, and the cookie suffix.

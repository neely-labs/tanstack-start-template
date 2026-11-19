# Authorization proofs: when the app first checks a permission

**Trigger:** the first server function, loader, or route that acts only if the signed-in user may do so. Authentication comes first; this recipe makes skipping the check a compile error.

## Add

[GDP-ts](https://github.com/rauchg/gdp-ts) ("Ghosts of Departed Proofs") turns a permission check into a value. A sensitive function takes a proof about its exact arguments, and only the module that runs the check can create one. Its type names the user and resource it was checked for, so a proof for project A does not compile where project B is passed. At runtime a proof is a frozen `{ kind }`.

**The package and its lint preset.** Run `pnpm add @gdp-ts/core`, then add `gdp` from `ultracite/oxlint/gdp` to `extends` in `oxlint.config.ts`. Ultracite bundles the preset, but its plug-in loads from `@gdp-ts/core`, and without that dependency Oxlint fails to load it. The preset enforces four rules:

- Only files in `proofs/` may call `defineProof`.
- Files in `proofs/` may not export a prover.
- No file outside `proofs/` may assert a value to a proof type.
- No type assertion except `as const` outside `proofs/` and `lib/ids.ts`.

The last rule replaces anti-slop's `SAFETY:` comment rule everywhere else: an assertion with a reason still fails. Without the last rule, anyone could forge a proof with `as`. The paths are fixed, so put the folders at `src/proofs/` and `src/lib/ids.ts`.

**Branded ids in `src/lib/ids.ts`.** Parse each id at the boundary into its own type, such as `export const UserId = z.string().brand<"UserId">()`, so a project id never passes as a user id.

**One module per proof in `src/proofs/`.** Keep the prover private. Give it a different name from the exported interface, because core's `no-redeclare` rejects the shared name that GDP-ts's README uses:

```ts
import { defineProof, type Named, type Proof } from "@gdp-ts/core";

const prover = defineProof("UserIsProjectAdmin");

export interface UserIsProjectAdmin<U, P> extends Proof<
  "UserIsProjectAdmin",
  [U, P]
> {}

export async function userIsProjectAdmin<U, P>(
  user: Named<U, UserId>,
  project: Named<P, ProjectId>
) {
  const role = await db.roleInProject(user.value, project.value);
  return role === "owner" ? prover.prove(user, project) : null;
}
```

**Sensitive functions demand the proof.** Declare `_proof: UserIsProjectAdmin<U, P>` beside `project: Named<P, ProjectId>`. The underscore keeps the unused-variable rules quiet. A handler names its values with `name(user, project, async (u, p) => ...)`, runs the check, returns 403 on `null`, and passes the proof on.

## Prove

- `pnpm check` passes with the preset extended.
- In a scratch commit, call a sensitive function without a proof, then pass a proof for another project: `pnpm typecheck` fails both times. Add `as UserIsProjectAdmin<U, P>` outside `src/proofs/`, and `pnpm check` fails.
- A test calls the check with a member who lacks the role and expects `null`.

## Remove

Delete `src/proofs/`, the proof parameters, the `gdp` preset, and the dependency. Keep the branded ids; they stand on their own.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { STATE_LABELS } from "./state-labels.ts";

const byName = (left: string, right: string) => left.localeCompare(right);

describe("the state-label list", () => {
  const docs = path.join(import.meta.dirname, "../docs");

  /** The first or second column of each row in a `## heading` table of triage-labels.md. */
  function tableColumn(heading: string, column: number) {
    const text = fs.readFileSync(
      path.join(docs, "agents/triage-labels.md"),
      "utf-8"
    );

    const section = text.split(`## ${heading}\n`)[1]?.split("\n## ")[0] ?? "";

    return section
      .split("\n")
      .filter((line) => line.startsWith("| `"))
      .flatMap(
        (line) =>
          /`(?<name>[^`]+)`/u.exec(line.split("|")[column] ?? "")?.groups
            ?.name ?? []
      );
  }

  it("equals the state labels docs/tooling.md creates, which the triage guide lists", () => {
    const tooling = fs.readFileSync(path.join(docs, "tooling.md"), "utf-8");

    const created = [
      ...tooling.matchAll(/^gh label create (?<name>\S+)/gmu),
    ].map((match) => match.groups?.name);

    const categories = new Set(tableColumn("Category labels", 1));
    expect(categories).toStrictEqual(new Set(["bug", "flaky"]));

    const states = created.flatMap((name) =>
      name === undefined || categories.has(name) ? [] : name
    );

    expect(states.toSorted(byName)).toStrictEqual(
      [...STATE_LABELS].toSorted(byName)
    );
    expect(tableColumn("State labels", 2).toSorted(byName)).toStrictEqual(
      [...STATE_LABELS].toSorted(byName)
    );
  });
});

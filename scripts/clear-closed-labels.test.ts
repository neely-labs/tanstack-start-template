import { describe, expect, it } from "vitest";

import {
  KEPT_ON_CLOSE,
  clearedOnClose,
  decodeIssue,
} from "./clear-closed-labels.ts";
import { STATE_LABELS } from "./state-labels.ts";

describe(clearedOnClose, () => {
  it("removes every state label except wontfix", () => {
    expect(clearedOnClose([...STATE_LABELS])).toStrictEqual(
      STATE_LABELS.filter((label) => label !== "wontfix")
    );
    expect(KEPT_ON_CLOSE).toBe("wontfix");
  });

  it("keeps category and other labels", () => {
    expect(
      clearedOnClose(["bug", "ready-for-agent", "flaky", "wontfix", "docs"])
    ).toStrictEqual(["ready-for-agent"]);
  });

  it("removes nothing from an issue without a state label", () => {
    expect(clearedOnClose([])).toStrictEqual([]);
    expect(clearedOnClose(["enhancement"])).toStrictEqual([]);
  });
});

describe(decodeIssue, () => {
  it("reads the state and label names", () => {
    expect(
      decodeIssue(
        JSON.stringify({
          labels: [{ id: 1, name: "bug" }, { name: "needs-triage" }, {}],
          number: 4,
          state: "closed",
        })
      )
    ).toStrictEqual({ labels: ["bug", "needs-triage"], state: "closed" });
  });

  it("treats any state but closed as open", () => {
    expect(decodeIssue('{"state":"reopened"}')).toStrictEqual({
      labels: [],
      state: "open",
    });
  });

  it("throws when the response is not an issue", () => {
    expect(() => decodeIssue('{"message":"Not Found"}')).toThrow(
      "returned no issue"
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  KEPT_ON_CLOSE,
  clearedOnClose,
  decodeIssueLabels,
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

describe(decodeIssueLabels, () => {
  it("reads the state and label names", () => {
    expect(
      decodeIssueLabels(
        JSON.stringify({
          labels: [{ id: 1, name: "bug" }, { name: "needs-triage" }, {}],
          number: 4,
          state: "closed",
        })
      )
    ).toStrictEqual({
      isPullRequest: false,
      labels: ["bug", "needs-triage"],
      state: "closed",
    });
  });

  it("treats any state but closed as open", () => {
    expect(decodeIssueLabels('{"state":"reopened"}')).toStrictEqual({
      isPullRequest: false,
      labels: [],
      state: "open",
    });
  });

  it("marks a pull request, which the issues endpoint also returns", () => {
    expect(
      decodeIssueLabels('{"state":"closed","pull_request":{"url":"u"}}')
        .isPullRequest
    ).toBeTruthy();
    expect(
      decodeIssueLabels('{"state":"closed","pull_request":null}').isPullRequest
    ).toBeFalsy();
  });

  it("throws when the response is not an issue", () => {
    expect(() => decodeIssueLabels('{"message":"Not Found"}')).toThrow(
      "returned no issue"
    );
  });
});

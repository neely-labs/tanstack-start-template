import { describe, expect, it } from "vitest";

import { maxTextLength, parseTextInput, summarizeText } from "./text-stats.ts";

describe(summarizeText, () => {
  it("counts words across collapsed whitespace", () => {
    expect(summarizeText("  one   two\nthree\t four ")).toStrictEqual({
      characters: 21,
      readingMinutes: 1,
      words: 4,
    });
  });

  it("reports zero reading time for empty text", () => {
    expect(summarizeText("   ")).toStrictEqual({
      characters: 0,
      readingMinutes: 0,
      words: 0,
    });
  });
});

describe(parseTextInput, () => {
  it("trims accepted input", () => {
    expect(parseTextInput({ text: "  hello  " })).toStrictEqual({
      text: "hello",
    });
  });

  it("rejects blank input", () => {
    expect(() => parseTextInput({ text: "   " })).toThrow(/Enter some text/u);
  });

  it("rejects input over the length bound", () => {
    expect(() =>
      parseTextInput({ text: "a".repeat(maxTextLength + 1) })
    ).toThrow(/at most/u);
  });
});

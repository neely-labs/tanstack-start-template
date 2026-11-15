import { describe, expect, it, vi } from "vitest";

import {
  maxTextLength,
  summarizeText,
  textInputErrors,
  textInputSchema,
} from "./text-stats.ts";

describe(summarizeText, () => {
  it("counts words across collapsed whitespace", () => {
    expect(summarizeText("  one   two\nthree\t four ")).toStrictEqual({
      characters: 21,
      readingMinutes: 1,
      words: 4,
    });
  });

  it.each([
    {
      expected: 10,
      label: "Japanese written without spaces",
      text: "日本語のテキストです。今日はいい天気ですね。",
    },
    { expected: 2, label: "Chinese", text: "你好世界" },
    { expected: 4, label: "Thai", text: "สวัสดีครับ ยินดีต้อนรับ" },
    {
      expected: 6,
      label: "mixed scripts and an emoji",
      text: "Café naïve résumé 👋🏽 日本語のテキスト",
    },
    { expected: 2, label: "an apostrophe", text: "don't stop" },
  ])("counts words as a reader sees them, in $label", ({ expected, text }) => {
    expect(summarizeText(text).words).toBe(expected);
  });

  it("splits words at hyphens and @, as the word segmenter does", () => {
    // Intended: words come from Intl.Segmenter, which treats "-" and "@" as
    // boundaries. Splitting on spaces instead would miscount unspaced scripts.
    expect(summarizeText("e-mail me at a@b.com").words).toBe(6);
  });

  it("counts no words in punctuation alone", () => {
    expect(summarizeText("?!")).toStrictEqual({
      characters: 2,
      readingMinutes: 0,
      words: 0,
    });
  });

  it.each([
    {
      expected: 28,
      label: "accents, an emoji modifier and Japanese",
      text: "Café naïve résumé 👋🏽 日本語のテキスト",
    },
    { expected: 1, label: "a combining mark", text: "é".normalize("NFD") },
  ])(
    "counts characters as a person sees them, with $label",
    ({ expected, text }) => {
      expect(summarizeText(text).characters).toBe(expected);
    }
  );

  it("reports zero reading time for empty text", () => {
    expect(summarizeText("   ")).toStrictEqual({
      characters: 0,
      readingMinutes: 0,
      words: 0,
    });
  });
});

describe("the text stats module", () => {
  it("imports without Intl.Segmenter, as the page does in older browsers", async () => {
    const segmenter = Intl.Segmenter;
    Reflect.deleteProperty(Intl, "Segmenter");
    vi.resetModules();
    try {
      const fresh = await import("./text-stats.ts");

      expect(fresh.textInputErrors.tooLong).toContain(`${fresh.maxTextLength}`);
    } finally {
      Object.defineProperty(Intl, "Segmenter", {
        configurable: true,
        value: segmenter,
        writable: true,
      });
    }
  });
});

describe("the text input schema", () => {
  it("trims accepted input", () => {
    expect(textInputSchema.parse({ text: "  hello  " })).toStrictEqual({
      text: "hello",
    });
  });

  // Each case is the JSON a caller could send in place of `{ "text": "..." }`.
  it.each([
    { json: "null", label: "null" },
    { json: "5", label: "a primitive" },
    { json: "[]", label: "an array" },
    { json: "{}", label: "an object without text" },
    { json: '{ "text": 5 }', label: "a non-string text" },
  ])("rejects $label as a validation error", ({ json }) => {
    const result = textInputSchema.safeParse(JSON.parse(json));

    expect(result.success).toBeFalsy();
    expect(result.error?.issues[0]?.code).toBe("invalid_type");
  });

  it("rejects blank input", () => {
    const issues = textInputSchema.safeParse({ text: "   " }).error?.issues;

    expect(issues?.map((issue) => issue.message)).toStrictEqual([
      textInputErrors.blank,
    ]);
  });

  it("accepts text at the length bound and rejects one character more", () => {
    const atBound = "a".repeat(maxTextLength);

    expect(textInputSchema.parse({ text: atBound })).toStrictEqual({
      text: atBound,
    });
    const issues = textInputSchema.safeParse({ text: `${atBound}a` }).error
      ?.issues;
    expect(issues?.map((issue) => issue.message)).toStrictEqual([
      textInputErrors.tooLong,
    ]);
  });

  it("checks the length after trimming", () => {
    const padded = ` ${"a".repeat(maxTextLength)} `;

    expect(textInputSchema.safeParse({ text: padded }).success).toBeTruthy();
  });

  it("states the length bound it enforces", () => {
    // The message promises a limit, so its wording is a commitment worth checking.
    expect(textInputErrors.tooLong).toContain(`${maxTextLength} characters`);
  });
});

import { z } from "zod";

/** Upper bound applied before the server does any work on submitted text. */
export const maxTextLength = 2000;

const wordsPerMinute = 220;

/** What the analyzer tells a person whose input it rejects. Tests read it here. */
export const textInputErrors = {
  blank: "Enter some text to analyze.",
  tooLong: `Enter at most ${maxTextLength} characters.`,
} as const;

export interface TextStats {
  characters: number;
  readingMinutes: number;
  words: number;
}

export function summarizeText(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/u).length;

  return {
    characters: trimmed.length,
    readingMinutes:
      words === 0 ? 0 : Math.max(1, Math.round(words / wordsPerMinute)),
    words,
  };
}

/**
 * The validator for the `analyzeText` server function. TanStack Start runs it
 * before the handler, so the handler sees only text that passed.
 */
export const textInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, textInputErrors.blank)
    .max(maxTextLength, textInputErrors.tooLong),
});

/** What the analyzer shows for a failure that is not a rejected input. */
export const analyzerFailure = "The request could not be completed.";

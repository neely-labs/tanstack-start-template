/** Upper bound applied before the server does any work on submitted text. */
export const maxTextLength = 2000;

const wordsPerMinute = 220;

/** What the analyzer tells a person whose input it rejects. Tests read it here. */
export const textInputErrors = {
  blank: "Enter some text to analyze.",
  tooLong: `Enter at most ${maxTextLength} characters.`,
} as const;

export interface TextInput {
  text: string;
}

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
 * The validator seam for the `analyzeText` server function.
 *
 * TanStack Start hands validated data to the handler, so untrusted input is
 * rejected before the handler runs. This template deliberately ships no schema
 * library; a Standard Schema validator drops in here without touching the
 * handler.
 */
export function parseTextInput(input: TextInput): TextInput {
  const text = input.text.trim();

  if (text === "") {
    throw new Error(textInputErrors.blank);
  }

  if (text.length > maxTextLength) {
    throw new Error(textInputErrors.tooLong);
  }

  return { text };
}

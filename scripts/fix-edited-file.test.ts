import { describe, expect, it } from "vitest";

import { editedFilePath } from "./fix-edited-file.ts";

describe(editedFilePath, () => {
  it.each([
    ["Claude Code's tool_input", { tool_input: { file_path: "src/a.ts" } }],
    ["Cursor's root field", { file_path: "src/a.ts" }],
    ["a notebook edit", { tool_input: { notebook_path: "src/a.ts" } }],
    [
      "an empty root field, falling back to tool_input",
      { file_path: "", tool_input: { file_path: "src/a.ts" } },
    ],
    [
      "a non-string root field, falling back to tool_input",
      { file_path: 7, tool_input: { file_path: "src/a.ts" } },
    ],
  ])("reads %s", (_, value) => {
    expect(editedFilePath(JSON.stringify(value))).toBe("src/a.ts");
  });

  it.each([
    ["empty stdin", ""],
    ["malformed JSON", "{"],
    ["a JSON array", "[]"],
    ["no path", JSON.stringify({ tool_input: { command: "ls" } })],
    ["a non-object tool_input", JSON.stringify({ tool_input: "src/a.ts" })],
  ])("names no file for %s", (_, raw) => {
    expect(editedFilePath(raw)).toBeUndefined();
  });
});

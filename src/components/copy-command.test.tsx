// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyCommand } from "./copy-command.tsx";

function stubClipboard(writeText: Clipboard["writeText"]) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe(CopyCommand, () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("copies the command and announces success", async () => {
    const writeText = vi
      .fn<Clipboard["writeText"]>()
      .mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyCommand command="pnpm validate" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy pnpm validate" }));

    await expect(
      screen.findByText("Copied to clipboard")
    ).resolves.toBeDefined();
    expect(writeText).toHaveBeenCalledWith("pnpm validate");
  });

  it("announces a fallback when the clipboard rejects", async () => {
    stubClipboard(
      vi.fn<Clipboard["writeText"]>().mockRejectedValue(new Error("denied"))
    );
    render(<CopyCommand command="pnpm validate" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy pnpm validate" }));

    await expect(
      screen.findByText(
        "Could not copy. Select the command to copy it manually."
      )
    ).resolves.toBeDefined();
  });
});

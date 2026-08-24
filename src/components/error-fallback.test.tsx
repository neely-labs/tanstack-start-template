// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ErrorFallback } from "./error-fallback.tsx";

describe(ErrorFallback, () => {
  afterEach(cleanup);

  it("focuses the alert and invokes recovery", () => {
    let retryCount = 0;

    render(
      <ErrorFallback
        error={new Error("Loader failed")}
        onRetry={() => {
          retryCount += 1;
        }}
      />
    );

    const alert = screen.getByRole("alert");
    expect(document.activeElement).toBe(alert);
    expect(screen.queryByText("Loader failed")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryCount).toBe(1);
  });

  it("shows safe technical detail only when requested", () => {
    render(
      <ErrorFallback
        error={new Error("Loader failed")}
        onRetry={() => {}}
        showDetails
      />
    );

    expect(screen.getByText("Loader failed")).toBeDefined();
  });
});

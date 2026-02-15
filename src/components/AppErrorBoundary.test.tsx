import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { tauriMocks } from "../test/setup";
import { AppErrorBoundary } from "./AppErrorBoundary";

function CrashComponent() {
  throw new Error("Kaboom");
}

describe("AppErrorBoundary", () => {
  it("renders fallback UI and reports the error", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <CrashComponent />
      </AppErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    await waitFor(() => {
      expect(tauriMocks.invoke).toHaveBeenCalledWith(
        "report_frontend_error",
        expect.objectContaining({
          source: "react-error-boundary",
          message: "Kaboom",
        })
      );
    });

    errorSpy.mockRestore();
  });
});

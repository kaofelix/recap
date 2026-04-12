import { act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useToastStore } from "../../store/toastStore";
import { render, screen, userEvent } from "../../test/utils";
import { Toaster } from "./Toaster";

describe("Toaster", () => {
  afterEach(() => {
    act(() => {
      useToastStore.getState().clearToasts();
    });
  });

  it("should render nothing when there are no toasts", () => {
    render(<Toaster />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("should render error toasts with solid high-contrast styles", () => {
    act(() => {
      useToastStore.getState().addToast({ message: "Something went wrong" });
    });

    render(<Toaster />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("border-danger", "bg-danger", "text-white");
  });

  it("should render multiple toasts", () => {
    act(() => {
      useToastStore.getState().addToast({ message: "Error 1" });
      useToastStore.getState().addToast({ message: "Error 2" });
    });

    render(<Toaster />);

    expect(screen.getByText("Error 1")).toBeInTheDocument();
    expect(screen.getByText("Error 2")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("should dismiss a toast when its close button is clicked", async () => {
    const user = userEvent.setup();

    act(() => {
      useToastStore.getState().addToast({ message: "Error to dismiss" });
    });

    render(<Toaster />);

    expect(screen.getByText("Error to dismiss")).toBeInTheDocument();

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await user.click(dismissButton);

    expect(screen.queryByText("Error to dismiss")).not.toBeInTheDocument();
  });

  it("should only dismiss the clicked toast when there are multiple", async () => {
    const user = userEvent.setup();

    act(() => {
      useToastStore.getState().addToast({ message: "Keep this one" });
      useToastStore.getState().addToast({ message: "Dismiss this one" });
    });

    render(<Toaster />);

    const dismissButtons = screen.getAllByRole("button", { name: /dismiss/i });
    // Dismiss the second toast
    await user.click(dismissButtons[1]);

    expect(screen.getByText("Keep this one")).toBeInTheDocument();
    expect(screen.queryByText("Dismiss this one")).not.toBeInTheDocument();
  });

  it("should render warning toasts with solid high-contrast styles and preserve line breaks", () => {
    act(() => {
      useToastStore.getState().addToast({
        message:
          "Missing linked worktree.\n\nRun `git worktree prune` to remove stale references.",
        type: "warning",
      });
    });

    render(<Toaster />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("border-warning", "bg-warning", "text-black");
    expect(alert).toHaveTextContent(
      "Missing linked worktree. Run `git worktree prune` to remove stale references."
    );

    const message = screen.getByText(/Missing linked worktree\./i);
    expect(message).toHaveClass("whitespace-pre-line");
  });

  it("should update when a new toast is added after render", () => {
    render(<Toaster />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      useToastStore.getState().addToast({ message: "Late arrival" });
    });

    expect(screen.getByText("Late arrival")).toBeInTheDocument();
  });
});

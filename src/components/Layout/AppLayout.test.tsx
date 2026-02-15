import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { commandEmitter } from "../../commands";
import { useAppStore } from "../../store/appStore";
import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  beforeEach(() => {
    // Clear any stored panel layout
    localStorage.clear();
    // Reset store state
    useAppStore.setState({ viewMode: "history", isDiffMaximized: false });
  });

  it("renders the toolbar", () => {
    render(<AppLayout />);

    expect(screen.getByText("Repository:")).toBeInTheDocument();
    expect(screen.getByText("Branch:")).toBeInTheDocument();
  });

  it("renders the sidebar with view mode toggle", () => {
    render(<AppLayout />);

    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Changes" })).toBeInTheDocument();
  });

  it("renders the file list panel", () => {
    render(<AppLayout />);

    expect(screen.getByText("Files")).toBeInTheDocument();
  });

  it("shows empty state when no commit is selected", () => {
    render(<AppLayout />);

    expect(
      screen.getByText("Select a commit to view changed files")
    ).toBeInTheDocument();
  });

  it("renders the diff view panel", () => {
    render(<AppLayout />);

    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Split view" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unified view" })
    ).toBeInTheDocument();
  });

  it("shows empty state when no file is selected", () => {
    render(<AppLayout />);

    expect(screen.getByText("Select a file to view diff")).toBeInTheDocument();
  });

  it("shows empty state when no repo is selected", () => {
    render(<AppLayout />);

    // When no repo is selected, show prompt to select one
    expect(
      screen.getByText("Select a repository to view commits")
    ).toBeInTheDocument();
  });

  it("renders three resizable panels", () => {
    render(<AppLayout />);

    // With our mock, panels have data-testid="panel-{id}"
    expect(screen.getByTestId("panel-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("panel-file-list")).toBeInTheDocument();
    expect(screen.getByTestId("panel-diff-view")).toBeInTheDocument();
  });

  it("renders separator handles between panels", () => {
    render(<AppLayout />);

    // With our mock, separators have data-testid="panel-separator"
    const separators = screen.getAllByTestId("panel-separator");
    expect(separators.length).toBe(2);
  });

  it("advances to the next panel on consecutive navigation commands", () => {
    useAppStore.setState({ focusedRegion: null, viewMode: "history" });
    render(<AppLayout />);

    act(() => {
      commandEmitter.emit("navigation.focusNextPanel");
      commandEmitter.emit("navigation.focusNextPanel");
    });

    expect(useAppStore.getState().focusedRegion).toBe("files");
  });

  it("collapses and restores side panels when diff view is maximized", () => {
    render(<AppLayout />);

    const sidebarPanel = screen.getByTestId("panel-sidebar");
    const fileListPanel = screen.getByTestId("panel-file-list");

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
    expect(fileListPanel).toHaveAttribute("data-collapsed", "false");

    act(() => {
      screen.getByRole("button", { name: "Maximize diff view" }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");
    expect(fileListPanel).toHaveAttribute("data-collapsed", "true");

    act(() => {
      screen.getByRole("button", { name: "Restore panel layout" }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
    expect(fileListPanel).toHaveAttribute("data-collapsed", "false");
  });

  it("toggles diff maximize via keyboard shortcut", () => {
    render(<AppLayout />);

    const sidebarPanel = screen.getByTestId("panel-sidebar");

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true })
      );
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "true");

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", metaKey: true })
      );
    });

    expect(sidebarPanel).toHaveAttribute("data-collapsed", "false");
  });

  it("restores previous panel sizes after maximize toggle", () => {
    localStorage.setItem(
      "mock-panel-layout:main-layout",
      JSON.stringify({
        sidebar: 33,
        "file-list": 17,
        "diff-view": 50,
      })
    );

    render(<AppLayout />);

    const sidebarPanel = screen.getByTestId("panel-sidebar");
    const fileListPanel = screen.getByTestId("panel-file-list");

    expect(sidebarPanel).toHaveAttribute("data-size", "33");
    expect(fileListPanel).toHaveAttribute("data-size", "17");

    act(() => {
      screen.getByRole("button", { name: "Maximize diff view" }).click();
    });

    act(() => {
      screen.getByRole("button", { name: "Restore panel layout" }).click();
    });

    expect(sidebarPanel).toHaveAttribute("data-size", "33");
    expect(fileListPanel).toHaveAttribute("data-size", "17");
  });

  it("applies custom className", () => {
    const { container } = render(<AppLayout className="test-class" />);

    const layout = container.firstChild;
    expect(layout).toHaveClass("test-class");
  });
});

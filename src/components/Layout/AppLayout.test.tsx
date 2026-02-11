import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../store/appStore";
import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  beforeEach(() => {
    // Clear any stored panel layout
    localStorage.clear();
    // Reset store state
    useAppStore.setState({ viewMode: "history" });
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

  it("applies custom className", () => {
    const { container } = render(<AppLayout className="test-class" />);

    const layout = container.firstChild;
    expect(layout).toHaveClass("test-class");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  beforeEach(() => {
    // Clear any stored panel layout
    localStorage.clear();
  });

  it("renders the toolbar", () => {
    render(<AppLayout />);
    
    expect(screen.getByText("Repository:")).toBeInTheDocument();
    expect(screen.getByText("Branch:")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("renders the sidebar with commits header", () => {
    render(<AppLayout />);
    
    expect(screen.getByText("Commits")).toBeInTheDocument();
  });

  it("renders the file list panel", () => {
    render(<AppLayout />);
    
    expect(screen.getByText("Changed Files")).toBeInTheDocument();
    expect(screen.getByText("(5 files)")).toBeInTheDocument();
  });

  it("renders the diff view panel", () => {
    render(<AppLayout />);
    
    // Use getAllByText since src/App.tsx appears in both file list and diff header
    const appTsxElements = screen.getAllByText("src/App.tsx");
    expect(appTsxElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Split")).toBeInTheDocument();
    expect(screen.getByText("Unified")).toBeInTheDocument();
  });

  it("renders placeholder commit items", () => {
    render(<AppLayout />);
    
    // Check for placeholder commits
    expect(screen.getByText(/feat: add new feature #1/)).toBeInTheDocument();
    expect(screen.getByText(/abc1231/)).toBeInTheDocument();
  });

  it("renders placeholder file items with status indicators", () => {
    render(<AppLayout />);
    
    expect(screen.getByText("src/components/Button.tsx")).toBeInTheDocument();
    expect(screen.getByText("src/utils/helpers.ts")).toBeInTheDocument();
    expect(screen.getByText("package.json")).toBeInTheDocument();
  });

  it("renders diff content placeholder", () => {
    render(<AppLayout />);
    
    expect(screen.getByText(/@@ -1,7 \+1,9 @@/)).toBeInTheDocument();
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

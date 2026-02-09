import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileListItem } from "./FileListItem";
import type { ChangedFile } from "../../types/file";

describe("FileListItem", () => {
  const mockFile: ChangedFile = {
    path: "src/App.tsx",
    status: "Modified",
    additions: 10,
    deletions: 5,
    old_path: null,
  };

  it("renders directory in muted color and filename in primary color", () => {
    render(
      <FileListItem file={mockFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("src/")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();
    
    // Directory should have muted color
    expect(screen.getByText("src/")).toHaveClass("text-text-secondary");
    // Filename should have primary color and be bold
    expect(screen.getByText("App.tsx")).toHaveClass("text-text-primary", "font-medium");
  });

  it("renders only filename when no directory", () => {
    const rootFile: ChangedFile = { ...mockFile, path: "README.md" };
    render(
      <FileListItem file={rootFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });

  it("renders status badge with correct letter", () => {
    render(
      <FileListItem file={mockFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("renders additions and deletions", () => {
    render(
      <FileListItem file={mockFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(
      <FileListItem file={mockFile} isSelected={false} onClick={handleClick} />
    );

    fireEvent.click(screen.getByText("App.tsx"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies selected styles when isSelected is true", () => {
    const { container } = render(
      <FileListItem file={mockFile} isSelected={true} onClick={() => {}} />
    );

    const item = container.firstChild;
    expect(item).toHaveClass("bg-accent-muted");
  });

  it("does not apply selected styles when isSelected is false", () => {
    const { container } = render(
      <FileListItem file={mockFile} isSelected={false} onClick={() => {}} />
    );

    const item = container.firstChild;
    expect(item).not.toHaveClass("bg-accent-muted");
  });

  it("renders correct status letter for Added files", () => {
    const addedFile: ChangedFile = { ...mockFile, status: "Added" };
    render(
      <FileListItem file={addedFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders correct status letter for Deleted files", () => {
    const deletedFile: ChangedFile = { ...mockFile, status: "Deleted" };
    render(
      <FileListItem file={deletedFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("renders correct status letter for Untracked files", () => {
    const untrackedFile: ChangedFile = { ...mockFile, status: "Untracked" };
    render(
      <FileListItem file={untrackedFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("does not render stats when both are zero", () => {
    const noStatsFile: ChangedFile = { ...mockFile, additions: 0, deletions: 0 };
    render(
      <FileListItem file={noStatsFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.queryByText("+0")).not.toBeInTheDocument();
    expect(screen.queryByText("-0")).not.toBeInTheDocument();
  });

  it("only renders additions when deletions is zero", () => {
    const addOnlyFile: ChangedFile = { ...mockFile, additions: 5, deletions: 0 };
    render(
      <FileListItem file={addOnlyFile} isSelected={false} onClick={() => {}} />
    );

    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.queryByText("-0")).not.toBeInTheDocument();
  });
});

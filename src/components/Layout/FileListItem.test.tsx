import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChangedFile } from "../../types/file";
import { FileListItem } from "./FileListItem";

const noop = () => {
  /* noop for testing */
};

describe("FileListItem", () => {
  const mockFile: ChangedFile = {
    path: "src/App.tsx",
    status: "Modified",
    additions: 10,
    deletions: 5,
    old_path: null,
  };

  it("renders directory in muted color and filename in primary color", () => {
    render(<FileListItem file={mockFile} isSelected={false} onClick={noop} />);

    expect(screen.getByText("src/")).toBeInTheDocument();
    expect(screen.getByText("App.tsx")).toBeInTheDocument();

    // Directory should have muted color
    expect(screen.getByText("src/")).toHaveClass("text-text-secondary");
    // Filename should have primary color and be bold
    expect(screen.getByText("App.tsx")).toHaveClass(
      "text-text-primary",
      "font-medium"
    );
  });

  it("renders only filename when no directory", () => {
    const rootFile: ChangedFile = { ...mockFile, path: "README.md" };
    render(<FileListItem file={rootFile} isSelected={false} onClick={noop} />);

    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });

  it("renders status badge with correct letter", () => {
    render(<FileListItem file={mockFile} isSelected={false} onClick={noop} />);

    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("renders additions and deletions", () => {
    render(<FileListItem file={mockFile} isSelected={false} onClick={noop} />);

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
      <FileListItem file={mockFile} isSelected={true} onClick={noop} />
    );

    const item = container.firstChild;
    expect(item).toHaveClass("bg-accent-muted");
  });

  it("does not apply selected styles when isSelected is false", () => {
    const { container } = render(
      <FileListItem file={mockFile} isSelected={false} onClick={noop} />
    );

    const item = container.firstChild;
    expect(item).not.toHaveClass("bg-accent-muted");
  });

  it("renders correct status letter for Added files", () => {
    const addedFile: ChangedFile = { ...mockFile, status: "Added" };
    render(<FileListItem file={addedFile} isSelected={false} onClick={noop} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("renders correct status letter for Deleted files", () => {
    const deletedFile: ChangedFile = { ...mockFile, status: "Deleted" };
    render(
      <FileListItem file={deletedFile} isSelected={false} onClick={noop} />
    );

    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("renders correct status letter for Untracked files", () => {
    const untrackedFile: ChangedFile = { ...mockFile, status: "Untracked" };
    render(
      <FileListItem file={untrackedFile} isSelected={false} onClick={noop} />
    );

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("does not render stats when both are zero", () => {
    const noStatsFile: ChangedFile = {
      ...mockFile,
      additions: 0,
      deletions: 0,
    };
    render(
      <FileListItem file={noStatsFile} isSelected={false} onClick={noop} />
    );

    expect(screen.queryByText("+0")).not.toBeInTheDocument();
    expect(screen.queryByText("-0")).not.toBeInTheDocument();
  });

  it("only renders additions when deletions is zero", () => {
    const addOnlyFile: ChangedFile = {
      ...mockFile,
      additions: 5,
      deletions: 0,
    };
    render(
      <FileListItem file={addOnlyFile} isSelected={false} onClick={noop} />
    );

    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(screen.queryByText("-0")).not.toBeInTheDocument();
  });

  it("includes diff stats in tooltip", async () => {
    const user = userEvent.setup();
    render(<FileListItem file={mockFile} isSelected={false} onClick={noop} />);

    // Hover over the filename to trigger the tooltip
    await user.hover(screen.getByText("App.tsx"));

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        /src\/App\.tsx\s+\+10 -5/
      );
    });
  });

  it("tooltip shows only path when no stats", async () => {
    const user = userEvent.setup();
    const noStatsFile: ChangedFile = {
      ...mockFile,
      additions: 0,
      deletions: 0,
    };
    render(
      <FileListItem file={noStatsFile} isSelected={false} onClick={noop} />
    );

    await user.hover(screen.getByText("App.tsx"));

    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("src/App.tsx");
    });
  });

  it("has container query class for responsive stats hiding", () => {
    const { container } = render(
      <FileListItem file={mockFile} isSelected={false} onClick={noop} />
    );

    const button = container.firstChild as HTMLElement;
    expect(button).toHaveClass("file-list-item");

    const stats = container.querySelector(".file-list-item-stats");
    expect(stats).toBeInTheDocument();
  });

  it("path container has overflow-hidden", () => {
    render(<FileListItem file={mockFile} isSelected={false} onClick={noop} />);

    const filename = screen.getByText("App.tsx");
    const pathContainer = filename.parentElement;
    expect(pathContainer).toHaveClass("overflow-hidden");
  });
});

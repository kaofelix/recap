import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandEmitter } from "../../commands";
import { __testing as themeTesting } from "../../hooks/useTheme";
import { useAppStore } from "../../store/appStore";
import { tauriMocks } from "../../test/setup";
import { DiffView } from "./DiffView";

const mockInvoke = tauriMocks.invoke;

// Regex patterns for error matching
const FILE_NOT_FOUND_ERROR = /Error:.*File not found in commit/;

describe("DiffView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    themeTesting.resetState();
    document.documentElement.classList.remove("dark");
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
      selectedCommitIds: [],
      selectedFilePath: null,
      isDiffMaximized: false,
    });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState({
        repos: [],
        selectedRepoId: null,
        selectedCommitId: null,
        selectedCommitIds: [],
        selectedFilePath: null,
        isDiffMaximized: false,
      });
    });
  });

  it("shows prompt when no file is selected", async () => {
    const { container } = render(<DiffView />);

    // Wait for all effects to settle
    await waitFor(() => {
      expect(container.textContent).toContain("Select a file to view diff");
    });
  });

  it("toggles maximize state from toolbar button", async () => {
    render(<DiffView />);

    const maximizeButton = await screen.findByRole("button", {
      name: "Maximize diff view",
    });

    expect(useAppStore.getState().isDiffMaximized).toBe(false);

    fireEvent.click(maximizeButton);

    await waitFor(() => {
      expect(useAppStore.getState().isDiffMaximized).toBe(true);
    });
  });

  it("shows maximize shortcut in button tooltip text", async () => {
    render(<DiffView />);

    const maximizeButton = await screen.findByRole("button", {
      name: "Maximize diff view",
    });

    expect(maximizeButton).toHaveAttribute(
      "title",
      "Maximize diff view (⌘↵ / Ctrl+Enter)"
    );
  });

  it("shows loading state while fetching diff", () => {
    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    mockInvoke.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves - simulates loading state */
        })
    );

    render(<DiffView />);

    expect(screen.getByText("Loading diff...")).toBeInTheDocument();
  });

  it("displays diff when loaded successfully", async () => {
    const mockContents = {
      old_content:
        "import React from 'react';\nimport { useState } from 'react';",
      new_content:
        "import React from 'react';\nimport { useState, useEffect } from 'react';",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      // Check that the diff viewer is rendered
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });
  });

  it("provides explicit gutter hover colors for both light and dark diff themes", async () => {
    mockInvoke.mockResolvedValue({
      old_content: "line one",
      new_content: "line two",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    const viewer = await screen.findByTestId("diff-viewer");

    expect(viewer).toHaveAttribute(
      "data-gutter-background-dark-light",
      "var(--color-bg-hover)"
    );
    expect(viewer).toHaveAttribute(
      "data-gutter-background-dark-dark",
      "var(--color-bg-hover)"
    );
  });

  it("uses resolved theme to drive diff dark mode instead of DOM class", async () => {
    themeTesting.setThemeMode("dark");
    document.documentElement.classList.remove("dark");

    mockInvoke.mockResolvedValue({
      old_content: "line one",
      new_content: "line two",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    const viewer = await screen.findByTestId("diff-viewer");
    expect(viewer).toHaveAttribute("data-use-dark-theme", "true");
  });

  it("shows binary file message", async () => {
    const mockContents = {
      old_content: null,
      new_content: null,
      is_binary: true,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "image.png",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(
        screen.getByText("Binary file cannot be displayed")
      ).toBeInTheDocument();
    });
  });

  it("shows error message when fetch fails", async () => {
    mockInvoke.mockRejectedValue(new Error("File not found in commit"));

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "missing.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByText(FILE_NOT_FOUND_ERROR)).toBeInTheDocument();
    });
  });

  it("calls get_file_contents with correct parameters", async () => {
    mockInvoke.mockResolvedValue({
      old_content: null,
      new_content: "content",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        {
          id: "1",
          path: "/test/my-repo",
          name: "my-repo",
          addedAt: Date.now(),
        },
      ],
      selectedRepoId: "1",
      selectedCommitId: "commit123",
      selectedFilePath: "src/utils.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_file_contents", {
        repoPath: "/test/my-repo",
        commitId: "commit123",
        filePath: "src/utils.ts",
      });
    });
  });

  it("calls get_commit_range_file_contents when multiple commits are selected", async () => {
    mockInvoke.mockResolvedValue({
      old_content: "old content",
      new_content: "new content",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedCommitIds: ["abc123", "def456"],
      selectedFilePath: "src/first.ts",
      viewMode: "history",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "get_commit_range_file_contents",
        {
          repoPath: "/test/repo",
          commitIds: ["abc123", "def456"],
          filePath: "src/first.ts",
        }
      );
    });
  });

  it("shows clear error message for non-consecutive multi-select", async () => {
    mockInvoke.mockRejectedValue(
      new Error("Unable to display diff for multiple non-consecutive commits")
    );

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedCommitIds: ["abc123", "def456"],
      selectedFilePath: "src/first.ts",
      viewMode: "history",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Unable to display diff for multiple non-consecutive commits/
        )
      ).toBeInTheDocument();
    });
  });

  it("keeps previous diff visible while loading next file", async () => {
    let resolveSecond: (value: unknown) => void = () => {
      throw new Error("Second diff request resolver not initialized");
    };

    mockInvoke
      .mockResolvedValueOnce({
        old_content: "const a = 1;",
        new_content: "const a = 2;",
        is_binary: false,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/first.ts",
    });

    const { rerender } = render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    await act(async () => {
      useAppStore.setState({ selectedFilePath: "src/second.ts" });
      rerender(<DiffView />);
    });

    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    expect(screen.queryByText("Loading diff...")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_file_contents", {
        repoPath: "/test/repo",
        commitId: "abc123",
        filePath: "src/second.ts",
      });
    });

    await act(async () => {
      resolveSecond({
        old_content: "const b = 1;",
        new_content: "const b = 2;",
        is_binary: false,
      });
    });
  });

  it("toggles between split and unified view", async () => {
    const mockContents = {
      old_content: "old content",
      new_content: "new content",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    // Default is split
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "true"
    );

    // Click unified
    const unifiedButton = screen.getByRole("button", { name: "Unified view" });
    fireEvent.click(unifiedButton);

    // Check localStorage was updated
    expect(localStorage.getItem("diff-view-mode")).toBe("unified");
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );

    // Click split
    const splitButton = screen.getByRole("button", { name: "Split view" });
    fireEvent.click(splitButton);

    expect(localStorage.getItem("diff-view-mode")).toBe("split");
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "true"
    );
  });

  it("persists view mode preference", () => {
    localStorage.setItem("diff-view-mode", "unified");

    render(<DiffView />);

    // Unified button should be active (has active background class)
    const unifiedButton = screen.getByRole("button", { name: "Unified view" });
    expect(unifiedButton.className).toContain("bg-bg-tertiary");
  });

  it("shows | shortcut hint in split/unified button tooltips", () => {
    render(<DiffView />);

    expect(screen.getByRole("button", { name: "Split view" })).toHaveAttribute(
      "title",
      "Split view (toggle |)"
    );
    expect(
      screen.getByRole("button", { name: "Unified view" })
    ).toHaveAttribute("title", "Unified view (toggle |)");
  });

  it("toggles display mode when toggle command is emitted", async () => {
    mockInvoke.mockResolvedValue({
      old_content: "old content",
      new_content: "new content",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
        "data-split-view",
        "true"
      );
    });

    act(() => {
      commandEmitter.emit("layout.toggleDiffDisplayMode");
    });

    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );

    act(() => {
      commandEmitter.emit("layout.toggleDiffDisplayMode");
    });

    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "true"
    );
  });

  it("displays file path in header", async () => {
    mockInvoke.mockResolvedValue({
      old_content: null,
      new_content: "content",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/components/Button.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByText("src/components/Button.tsx")).toBeInTheDocument();
    });
  });

  it("shows no changes message when old and new content are the same", async () => {
    const mockContents = {
      old_content: "same content",
      new_content: "same content",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "unchanged.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByText("No changes")).toBeInTheDocument();
    });
  });

  it("handles added files (null old_content)", async () => {
    const mockContents = {
      old_content: null,
      new_content: "new file content",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "new-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });
  });

  it("handles deleted files (null new_content)", async () => {
    const mockContents = {
      old_content: "deleted file content",
      new_content: null,
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "deleted-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });
  });

  it("applies syntax highlighting to TypeScript files", async () => {
    const mockContents = {
      old_content: "const x = 1;",
      new_content: "const x = 2;",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/app.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    // Check that syntax highlighting tokens are present
    // Prism adds spans with class "token" for highlighted code
    const diffViewer = screen.getByTestId("diff-viewer");
    expect(diffViewer.innerHTML).toContain('class="token');
  });

  it("renders plain text for unknown file types", async () => {
    const mockContents = {
      old_content: "some text",
      new_content: "some other text",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "file.unknown",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    // Should not have syntax highlighting tokens
    const diffViewer = screen.getByTestId("diff-viewer");
    expect(diffViewer.innerHTML).not.toContain('class="token');
  });

  it("forces unified view for added files", async () => {
    // Set user preference to split
    localStorage.setItem("diff-view-mode", "split");

    const mockContents = {
      old_content: null,
      new_content: "new file content",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "new-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    // Should be unified despite user preference for split
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );
  });

  it("forces unified view for deleted files", async () => {
    // Set user preference to split
    localStorage.setItem("diff-view-mode", "split");

    const mockContents = {
      old_content: "deleted file content",
      new_content: null,
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "deleted-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    // Should be unified despite user preference for split
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );
  });

  it("disables view mode toggle for added files", async () => {
    const mockContents = {
      old_content: null,
      new_content: "new file content",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "new-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Split view" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unified view" })).toBeDisabled();
  });

  it("does not toggle display mode command for one-sided diffs", async () => {
    mockInvoke.mockResolvedValue({
      old_content: null,
      new_content: "new file content",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "new-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
        "data-split-view",
        "false"
      );
    });

    act(() => {
      commandEmitter.emit("layout.toggleDiffDisplayMode");
    });

    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );
    expect(localStorage.getItem("diff-view-mode")).toBe("split");
  });

  it("disables view mode toggle for deleted files", async () => {
    const mockContents = {
      old_content: "deleted content",
      new_content: null,
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "deleted-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Split view" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unified view" })).toBeDisabled();
  });

  it("enables view mode toggle for modified files", async () => {
    const mockContents = {
      old_content: "old content",
      new_content: "new content",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "modified-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Split view" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Unified view" })).toBeEnabled();
  });
});

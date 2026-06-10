import { HotkeysProvider } from "@tanstack/react-hotkeys";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusProvider } from "../../context/FocusContext";
import { __testing as themeTesting } from "../../hooks/useTheme";
import { useAppStore } from "../../store/appStore";
import { useSettingsStore } from "../../store/settingsStore";
import { tauriMocks } from "../../test/setup";
import type { WorkingFile } from "../../types/file";
import { DiffView } from "./DiffView";

const mockInvoke = tauriMocks.invoke;

// Regex patterns for error matching
const FILE_NOT_FOUND_ERROR = /Error:.*File not found in commit/;

describe("DiffView", () => {
  const makeFile = (
    path: string,
    status: "Modified" | "Added" | "Deleted" = "Modified"
  ) => ({
    path,
    status,
    additions: 0,
    deletions: 0,
    old_path: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (
      globalThis as typeof globalThis & { __mockDiffsWorkerPool?: unknown }
    ).__mockDiffsWorkerPool = undefined;
    (
      globalThis as typeof globalThis & { __mockDiffsMountCount?: number }
    ).__mockDiffsMountCount = undefined;
    themeTesting.resetState();
    useSettingsStore.setState({ themeMode: "system" });
    document.documentElement.classList.remove("dark");
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitIds: [],
      selectedFilePath: null,
      selectedChangeId: null,
      changedFiles: [],
      viewMode: "history",
      isDiffMaximized: false,
      diffDisplayMode: "split",
      wordWrap: true,
    });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState({
        repos: [],
        selectedRepoId: null,
        selectedCommitIds: [],
        selectedFilePath: null,
        selectedChangeId: null,
        changedFiles: [],
        viewMode: "history",
        isDiffMaximized: false,
        diffDisplayMode: "split",
        wordWrap: true,
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

  it("allows the diff panel itself to scroll", () => {
    const { container } = render(<DiffView />);

    expect(container.querySelector(".diff-scroll-wrapper")).toHaveClass(
      "overflow-auto"
    );
  });

  it("shows loading state while fetching diff", () => {
    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
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

  it("renders the selected file with MultiFileDiff inputs and Recap defaults", async () => {
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
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    const viewer = await screen.findByTestId("diff-viewer");

    expect(viewer).toHaveAttribute("data-old-file-name", "src/App.tsx");
    expect(viewer).toHaveAttribute("data-new-file-name", "src/App.tsx");
    expect(viewer).toHaveAttribute("data-diff-style", "split");
    expect(viewer).toHaveAttribute("data-overflow", "wrap");
    expect(viewer).toHaveAttribute("data-disable-file-header", "true");
    expect(screen.getByTestId("diff-old")).toHaveTextContent(
      "import React from 'react';"
    );
    expect(screen.getByTestId("diff-new")).toHaveTextContent(
      "useState, useEffect"
    );
  });

  it("uses selected change section for duplicate paths in changes view", async () => {
    mockInvoke.mockResolvedValue({
      old_content: "staged",
      new_content: "working",
      is_binary: false,
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitIds: [],
      selectedFilePath: "src/file.ts",
      selectedChangeId: "src/file.ts#unstaged",
      changedFiles: [
        {
          path: "src/file.ts",
          staged_status: "Modified",
          unstaged_status: null,
          staged_additions: 1,
          staged_deletions: 0,
          unstaged_additions: 0,
          unstaged_deletions: 0,
          old_path: null,
          section: "staged",
          mtime_ms: null,
        },
        {
          path: "src/file.ts",
          staged_status: null,
          unstaged_status: "Modified",
          staged_additions: 0,
          staged_deletions: 0,
          unstaged_additions: 1,
          unstaged_deletions: 0,
          old_path: null,
          section: "unstaged",
          mtime_ms: null,
        },
      ],
      viewMode: "changes",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_unstaged_file_contents", {
        repoPath: "/test/repo",
        filePath: "src/file.ts",
      });
    });
  });

  it("refetches changes-mode diff content from the updated worktree path after canonical repo upsert", async () => {
    mockInvoke.mockResolvedValue({
      old_content: "before",
      new_content: "after",
      is_binary: false,
    });

    const workingChange: WorkingFile = {
      path: "src/file.ts",
      staged_status: null,
      unstaged_status: "Modified",
      staged_additions: 0,
      staged_deletions: 0,
      unstaged_additions: 1,
      unstaged_deletions: 0,
      old_path: null,
      section: "unstaged" as const,
      mtime_ms: null,
    };

    useAppStore.setState({
      repos: [
        {
          id: "1",
          path: "/test/repo-main",
          canonicalPath: "/test/repo",
          name: "repo",
          addedAt: Date.now(),
        },
      ],
      selectedRepoId: "1",
      viewMode: "changes",
      workingChanges: [workingChange],
      changedFiles: [workingChange],
      selectedFilePath: "src/file.ts",
      selectedChangeId: "src/file.ts#unstaged",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_unstaged_file_contents", {
        repoPath: "/test/repo-main",
        filePath: "src/file.ts",
      });
    });

    await act(async () => {
      useAppStore.getState().addRepo({
        path: "/test/repo-feature",
        canonicalPath: "/test/repo",
        name: "repo",
      });
      useAppStore.setState({
        workingChanges: [workingChange],
        changedFiles: [workingChange],
      });
      useAppStore.getState().selectChange("src/file.ts#unstaged");
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_unstaged_file_contents", {
        repoPath: "/test/repo-feature",
        filePath: "src/file.ts",
      });
    });
  });

  it("uses Pierre Diffs default component styling", async () => {
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    const viewer = await screen.findByTestId("diff-viewer");

    expect(viewer).not.toHaveAttribute("style");
  });

  it("uses resolved theme to drive diff dark mode instead of DOM class", async () => {
    useSettingsStore.setState({ themeMode: "dark" });
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    const viewer = await screen.findByTestId("diff-viewer");
    expect(viewer).toHaveAttribute("data-theme-type", "dark");
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
      selectedCommitIds: ["abc123"],
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
      selectedCommitIds: ["abc123"],
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
      selectedCommitIds: ["commit123"],
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

  it("shows loading state instead of stale previous diff while loading next file", async () => {
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
      selectedCommitIds: ["abc123"],
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

    expect(screen.queryByTestId("diff-viewer")).not.toBeInTheDocument();
    expect(screen.getByText("Loading diff...")).toBeInTheDocument();

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
      selectedCommitIds: ["abc123"],
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

    // Check store was updated
    expect(useAppStore.getState().diffDisplayMode).toBe("unified");
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );

    // Click split
    const splitButton = screen.getByRole("button", { name: "Split view" });
    fireEvent.click(splitButton);

    expect(useAppStore.getState().diffDisplayMode).toBe("split");
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "true"
    );
  });

  it("persists view mode preference", () => {
    useAppStore.setState({ diffDisplayMode: "unified" });

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
      selectedCommitIds: ["abc123"],
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
      useAppStore.getState().setDiffDisplayMode("unified");
    });

    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );

    act(() => {
      useAppStore.getState().setDiffDisplayMode("split");
    });

    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "true"
    );
  });

  it("displays file path in header with muted directory", async () => {
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "src/components/Button.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      // Directory should be muted (text-text-secondary)
      expect(screen.getByText("src/components/")).toBeInTheDocument();
      // Filename should be prominent
      expect(screen.getByText("Button.tsx")).toBeInTheDocument();
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
      selectedCommitIds: ["abc123"],
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
      selectedCommitIds: ["abc123"],
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "deleted-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });
  });

  it("passes TypeScript file names to Pierre Diffs for language detection", async () => {
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "src/app.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    const diffViewer = screen.getByTestId("diff-viewer");
    expect(diffViewer).toHaveAttribute("data-old-file-name", "src/app.ts");
    expect(diffViewer).toHaveAttribute("data-new-file-name", "src/app.ts");
  });

  it("passes unknown file names through to Pierre Diffs", async () => {
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "file.unknown",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    const diffViewer = screen.getByTestId("diff-viewer");
    expect(diffViewer).toHaveAttribute("data-old-file-name", "file.unknown");
    expect(diffViewer).toHaveAttribute("data-new-file-name", "file.unknown");
  });

  it("forces unified view for added files", async () => {
    const mockContents = {
      old_content: null,
      new_content: "new file content",
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    // Set user preference to split via store
    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitIds: ["abc123"],
      selectedFilePath: "new-file.ts",
      diffDisplayMode: "split",
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
    const mockContents = {
      old_content: "deleted file content",
      new_content: null,
      is_binary: false,
    };

    mockInvoke.mockResolvedValue(mockContents);

    // Set user preference to split via store
    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitIds: ["abc123"],
      selectedFilePath: "deleted-file.ts",
      diffDisplayMode: "split",
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
      selectedCommitIds: ["abc123"],
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "new-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
        "data-split-view",
        "false"
      );
      expect(useAppStore.getState().diffDisplayMode).toBe("split");
    });

    // Try to toggle via keyboard — should be no-op for one-sided files
    act(() => {
      fireEvent.keyDown(document, { key: "|", shiftKey: true });
    });

    await waitFor(() => {
      // Still shows unified because one-sided files force unified
      expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
        "data-split-view",
        "false"
      );
      // Store still "split" because toggle was blocked by isOneSided guard
      expect(useAppStore.getState().diffDisplayMode).toBe("split");
    });
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
      selectedCommitIds: ["abc123"],
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
      selectedCommitIds: ["abc123"],
      selectedFilePath: "modified-file.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Split view" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Unified view" })).toBeEnabled();
  });

  describe("diff renderer options", () => {
    it("uses a worker pool for Pierre Diffs highlighting", async () => {
      mockInvoke.mockResolvedValue({
        old_content: "const x = 1;",
        new_content: "const x = 2;",
        is_binary: false,
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        selectedCommitIds: ["abc123"],
        selectedFilePath: "src/app.ts",
      });

      render(<DiffView />);

      const provider = await screen.findByTestId("worker-pool-provider");
      expect(provider).toHaveAttribute("data-pool-size", "4");
      expect(provider).toHaveAttribute("data-tokenize-max-line-length", "500");
      expect(provider).toHaveAttribute(
        "data-langs",
        "typescript,javascript,tsx,jsx,css,json,yaml,rust,python,go,markdown"
      );
    });

    it("remounts the diff after worker highlighting finishes so cached highlighted content is shown", async () => {
      let statsCallback:
        | ((stats: {
            busyWorkers: number;
            activeTasks: number;
            queuedTasks: number;
          }) => unknown)
        | null = null;
      (
        globalThis as typeof globalThis & { __mockDiffsWorkerPool?: unknown }
      ).__mockDiffsWorkerPool = {
        subscribeToStatChanges: vi.fn((callback) => {
          statsCallback = callback;
          return vi.fn();
        }),
      };

      mockInvoke.mockResolvedValue({
        old_content: "const x = 1;",
        new_content: "const x = 2;",
        is_binary: false,
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        selectedCommitIds: ["abc123"],
        selectedFilePath: "src/app.ts",
      });

      render(<DiffView />);

      await screen.findByTestId("diff-viewer");
      expect(
        (globalThis as typeof globalThis & { __mockDiffsMountCount?: number })
          .__mockDiffsMountCount
      ).toBe(1);

      act(() => {
        statsCallback?.({ busyWorkers: 1, activeTasks: 1, queuedTasks: 0 });
        statsCallback?.({ busyWorkers: 0, activeTasks: 0, queuedTasks: 0 });
      });

      await waitFor(() => {
        expect(
          (globalThis as typeof globalThis & { __mockDiffsMountCount?: number })
            .__mockDiffsMountCount
        ).toBe(2);
      });
    });

    it("uses Shiki-backed Pierre Diffs defaults for inline highlighting and hunk separators", async () => {
      mockInvoke.mockResolvedValue({
        old_content: "const x = 1;",
        new_content: "const x = 2;",
        is_binary: false,
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        selectedCommitIds: ["abc123"],
        selectedFilePath: "src/app.ts",
      });

      render(<DiffView />);

      const viewer = await screen.findByTestId("diff-viewer");
      expect(viewer).toHaveAttribute("data-line-diff-type", "word-alt");
      expect(viewer).toHaveAttribute("data-hunk-separators", "line-info");
      expect(viewer).toHaveAttribute("data-theme-dark", "pierre-dark");
      expect(viewer).toHaveAttribute("data-theme-light", "pierre-light");
    });
  });

  describe("file navigation", () => {
    it("shows up and down navigation buttons", () => {
      useAppStore.setState({
        changedFiles: [makeFile("src/a.ts"), makeFile("src/b.ts")],
        selectedFilePath: "src/a.ts",
      });

      render(<DiffView />);

      expect(
        screen.getByRole("button", { name: "Previous file" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Next file" })
      ).toBeInTheDocument();
    });

    it("disables up button when first file is selected", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/a.ts",
      });

      render(<DiffView />);

      expect(
        screen.getByRole("button", { name: "Previous file" })
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next file" })).toBeEnabled();
    });

    it("disables down button when last file is selected", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/c.ts",
      });

      render(<DiffView />);

      expect(
        screen.getByRole("button", { name: "Previous file" })
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: "Next file" })).toBeDisabled();
    });

    it("enables both buttons when middle file is selected", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/b.ts",
      });

      render(<DiffView />);

      expect(
        screen.getByRole("button", { name: "Previous file" })
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: "Next file" })).toBeEnabled();
    });

    it("disables both buttons when only one file exists", () => {
      useAppStore.setState({
        changedFiles: [makeFile("src/only.ts")],
        selectedFilePath: "src/only.ts",
      });

      render(<DiffView />);

      expect(
        screen.getByRole("button", { name: "Previous file" })
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next file" })).toBeDisabled();
    });

    it("selects next file when clicking down button", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/a.ts",
      });

      render(<DiffView />);

      fireEvent.click(screen.getByRole("button", { name: "Next file" }));

      expect(useAppStore.getState().selectedFilePath).toBe("src/b.ts");
    });

    it("selects previous file when clicking up button", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/b.ts",
      });

      render(<DiffView />);

      fireEvent.click(screen.getByRole("button", { name: "Previous file" }));

      expect(useAppStore.getState().selectedFilePath).toBe("src/a.ts");
    });

    it("disables both buttons when no files exist", () => {
      useAppStore.setState({
        changedFiles: [],
        selectedFilePath: null,
      });

      render(<DiffView />);

      expect(
        screen.getByRole("button", { name: "Previous file" })
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next file" })).toBeDisabled();
    });

    it("navigates to next file on ArrowDown when focused", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/a.ts",
        focusedRegion: "diff",
      });

      render(
        <HotkeysProvider>
          <FocusProvider region="diff">
            <DiffView />
          </FocusProvider>
        </HotkeysProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: "ArrowDown" });
      });

      expect(useAppStore.getState().selectedFilePath).toBe("src/b.ts");
    });

    it("navigates to previous file on ArrowUp when focused", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/b.ts",
        focusedRegion: "diff",
      });

      render(
        <HotkeysProvider>
          <FocusProvider region="diff">
            <DiffView />
          </FocusProvider>
        </HotkeysProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: "ArrowUp" });
      });

      expect(useAppStore.getState().selectedFilePath).toBe("src/a.ts");
    });

    it("does not navigate when diff view is not focused", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/a.ts",
        focusedRegion: "sidebar",
      });

      render(
        <HotkeysProvider>
          <FocusProvider region="diff">
            <DiffView />
          </FocusProvider>
        </HotkeysProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: "ArrowDown" });
      });

      // Should NOT change because diff is not focused
      expect(useAppStore.getState().selectedFilePath).toBe("src/a.ts");
    });

    it("does not navigate past first file on ArrowUp", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/a.ts",
        focusedRegion: "diff",
      });

      render(
        <HotkeysProvider>
          <FocusProvider region="diff">
            <DiffView />
          </FocusProvider>
        </HotkeysProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: "ArrowUp" });
      });

      // Should stay on first file
      expect(useAppStore.getState().selectedFilePath).toBe("src/a.ts");
    });

    it("does not navigate past last file on ArrowDown", () => {
      useAppStore.setState({
        changedFiles: [
          makeFile("src/a.ts"),
          makeFile("src/b.ts"),
          makeFile("src/c.ts"),
        ],
        selectedFilePath: "src/c.ts",
        focusedRegion: "diff",
      });

      render(
        <HotkeysProvider>
          <FocusProvider region="diff">
            <DiffView />
          </FocusProvider>
        </HotkeysProvider>
      );

      act(() => {
        fireEvent.keyDown(document, { key: "ArrowDown" });
      });

      // Should stay on last file
      expect(useAppStore.getState().selectedFilePath).toBe("src/c.ts");
    });
  });
});

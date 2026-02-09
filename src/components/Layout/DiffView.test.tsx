import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../store/appStore";
import { DiffView } from "./DiffView";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Regex patterns for error matching
const FILE_NOT_FOUND_ERROR = /Error:.*File not found in commit/;

describe("DiffView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
      selectedFilePath: null,
    });
  });

  afterEach(() => {
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
      selectedFilePath: null,
    });
  });

  it("shows prompt when no file is selected", () => {
    render(<DiffView />);

    expect(screen.getByText("Select a file to view diff")).toBeInTheDocument();
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
    const unifiedButton = screen.getByText("Unified");
    fireEvent.click(unifiedButton);

    // Check localStorage was updated
    expect(localStorage.getItem("diff-view-mode")).toBe("unified");
    expect(screen.getByTestId("diff-viewer")).toHaveAttribute(
      "data-split-view",
      "false"
    );

    // Click split
    const splitButton = screen.getByText("Split");
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

    // Unified button should be active (has accent-muted class)
    const unifiedButton = screen.getByText("Unified");
    expect(unifiedButton.className).toContain("bg-accent-muted");
  });

  it("displays file path in header", () => {
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

    expect(screen.getByText("src/components/Button.tsx")).toBeInTheDocument();
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
});

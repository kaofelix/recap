import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { DiffView } from "./DiffView";
import { useAppStore } from "../../store/appStore";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

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

  it("shows loading state while fetching diff", async () => {
    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    mockInvoke.mockImplementation(() => new Promise(() => {}));

    render(<DiffView />);

    expect(screen.getByText("Loading diff...")).toBeInTheDocument();
  });

  it("displays diff when loaded successfully", async () => {
    const mockDiff = {
      old_path: null,
      new_path: "src/App.tsx",
      is_binary: false,
      hunks: [
        {
          old_start: 1,
          old_lines: 3,
          new_start: 1,
          new_lines: 4,
          lines: [
            { content: "import React from 'react';", line_type: "Context", old_line_no: 1, new_line_no: 1 },
            { content: "import { useState } from 'react';", line_type: "Deletion", old_line_no: 2, new_line_no: null },
            { content: "import { useState, useEffect } from 'react';", line_type: "Addition", old_line_no: null, new_line_no: 2 },
          ],
        },
      ],
    };

    mockInvoke.mockResolvedValue(mockDiff);

    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      // In split view, context lines appear on both sides
      expect(screen.getAllByText("import React from 'react';").length).toBeGreaterThan(0);
    });
  });

  it("shows binary file message", async () => {
    const mockDiff = {
      old_path: null,
      new_path: "image.png",
      is_binary: true,
      hunks: [],
    };

    mockInvoke.mockResolvedValue(mockDiff);

    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "image.png",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByText("Binary file cannot be displayed")).toBeInTheDocument();
    });
  });

  it("shows error message when fetch fails", async () => {
    mockInvoke.mockRejectedValue(new Error("File not found in commit"));

    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "missing.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(screen.getByText(/Error:.*File not found in commit/)).toBeInTheDocument();
    });
  });

  it("calls get_file_diff with correct parameters", async () => {
    mockInvoke.mockResolvedValue({
      old_path: null,
      new_path: "src/App.tsx",
      is_binary: false,
      hunks: [],
    });

    useAppStore.setState({
      repos: [{ id: "1", path: "/test/my-repo", name: "my-repo", addedAt: Date.now() }],
      selectedRepoId: "1",
      selectedCommitId: "commit123",
      selectedFilePath: "src/utils.ts",
    });

    render(<DiffView />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_file_diff", {
        repoPath: "/test/my-repo",
        commitId: "commit123",
        filePath: "src/utils.ts",
      });
    });
  });

  it("toggles between split and unified view", async () => {
    const mockDiff = {
      old_path: null,
      new_path: "src/App.tsx",
      is_binary: false,
      hunks: [
        {
          old_start: 1,
          old_lines: 1,
          new_start: 1,
          new_lines: 1,
          lines: [
            { content: "test", line_type: "Context", old_line_no: 1, new_line_no: 1 },
          ],
        },
      ],
    };

    mockInvoke.mockResolvedValue(mockDiff);

    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/App.tsx",
    });

    render(<DiffView />);

    await waitFor(() => {
      // In split view, context lines appear on both sides
      expect(screen.getAllByText("test").length).toBeGreaterThan(0);
    });

    // Default is split, click unified
    const unifiedButton = screen.getByText("Unified");
    fireEvent.click(unifiedButton);

    // Check localStorage was updated
    expect(localStorage.getItem("diff-view-mode")).toBe("unified");

    // Click split
    const splitButton = screen.getByText("Split");
    fireEvent.click(splitButton);

    expect(localStorage.getItem("diff-view-mode")).toBe("split");
  });

  it("persists view mode preference", () => {
    localStorage.setItem("diff-view-mode", "unified");

    render(<DiffView />);

    // Unified button should be active (has accent-muted class)
    const unifiedButton = screen.getByText("Unified");
    expect(unifiedButton.className).toContain("bg-accent-muted");
  });

  it("displays file path in header", async () => {
    mockInvoke.mockResolvedValue({
      old_path: null,
      new_path: "src/components/Button.tsx",
      is_binary: false,
      hunks: [],
    });

    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: "src/components/Button.tsx",
    });

    render(<DiffView />);

    expect(screen.getByText("src/components/Button.tsx")).toBeInTheDocument();
  });
});

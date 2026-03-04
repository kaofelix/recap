import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../store/appStore";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Unmock useRepoPolling so we test the real implementation
vi.unmock("./useRepoPolling");
vi.unmock("./useAppVisibility");

describe("useRepoPolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock visibility as visible
    Object.defineProperty(document, "hidden", { value: false, writable: true });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    // Reset store state
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      viewMode: "history",
      commits: [],
      isLoadingCommits: false,
      commitsError: null,
      workingChanges: [],
      changedFiles: [],
      isLoadingChanges: false,
      changesError: null,
    });
  });

  afterEach(async () => {
    await act(async () => {
      vi.useRealTimers();
    });
  });

  it("fetches commits when repo is selected", async () => {
    const mockCommits = [
      {
        id: "abc123",
        message: "Test commit",
        author: "Test",
        email: "test@test.com",
        timestamp: Date.now() / 1000,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
      repoPath: "/test/repo",
      limit: 50,
    });

    expect(useAppStore.getState().commits).toEqual(mockCommits);
    expect(useAppStore.getState().isLoadingCommits).toBe(false);
  });

  it("fetches working changes when in changes mode", async () => {
    const mockChanges = [
      {
        path: "src/App.tsx",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 5,
        staged_deletions: 2,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged",
      },
    ];

    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_working_changes_ex") {
        return Promise.resolve(mockChanges);
      }
      return Promise.resolve([]);
    });

    useAppStore.setState({ viewMode: "changes" });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve(); // Extra tick for the second fetch
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_working_changes_ex", {
      repoPath: "/test/repo",
    });

    expect(useAppStore.getState().workingChanges).toEqual(mockChanges);
    expect(useAppStore.getState().changedFiles).toEqual(mockChanges);
  });

  it("polls at 2s interval when visible", async () => {
    mockInvoke.mockResolvedValue([]);

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    const initialCalls = mockInvoke.mock.calls.length;

    // Advance 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockInvoke.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it("clears data when repo is deselected", async () => {
    mockInvoke.mockResolvedValue([
      {
        id: "abc",
        message: "test",
        author: "a",
        email: "a@a.com",
        timestamp: 1,
      },
    ]);

    const { useRepoPolling } = await import("./useRepoPolling");
    type Repository = import("../types/repository").Repository;

    const repo: Repository = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    const { rerender } = renderHook<void, { selectedRepo: Repository | null }>(
      ({ selectedRepo }) => useRepoPolling(selectedRepo),
      { initialProps: { selectedRepo: repo } }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppStore.getState().commits.length).toBe(1);

    // Deselect repo
    rerender({ selectedRepo: null });

    expect(useAppStore.getState().commits).toEqual([]);
  });
});

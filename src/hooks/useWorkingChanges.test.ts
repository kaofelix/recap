import { invoke } from "@tauri-apps/api/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../store/appStore";
import type { WorkingFile } from "../types/file";
import { useWorkingChanges } from "./useWorkingChanges";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe("useWorkingChanges", () => {
  const mockRepo = {
    path: "/test/repo",
    name: "test-repo",
    branch: "main",
    id: "test-repo-id",
    addedAt: Date.now(),
  };

  const mockWorkingFiles: WorkingFile[] = [
    {
      path: "src/staged.ts",
      staged_status: "Modified",
      unstaged_status: null,
      staged_additions: 10,
      staged_deletions: 2,
      unstaged_additions: 0,
      unstaged_deletions: 0,
      old_path: null,
      section: "staged",
    },
    {
      path: "src/unstaged.ts",
      staged_status: null,
      unstaged_status: "Modified",
      staged_additions: 0,
      staged_deletions: 0,
      unstaged_additions: 5,
      unstaged_deletions: 1,
      old_path: null,
      section: "unstaged",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useAppStore.setState({
      selectedFilePath: null,
      selectedChangeId: null,
      changedFiles: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty state when repo is null", () => {
    const { result } = renderHook(() => useWorkingChanges(null, true));

    expect(result.current.changes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("returns empty state when not active", () => {
    const { result } = renderHook(() => useWorkingChanges(mockRepo, false));

    expect(result.current.changes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("fetches working changes when repo is provided and active", async () => {
    mockInvoke.mockResolvedValueOnce(mockWorkingFiles);

    const { result } = renderHook(() => useWorkingChanges(mockRepo, true));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_working_changes_ex", {
      repoPath: mockRepo.path,
    });
    expect(result.current.changes).toEqual(mockWorkingFiles);
    expect(result.current.error).toBeNull();
  });

  it("auto-selects first file when no file is selected", async () => {
    mockInvoke.mockResolvedValueOnce(mockWorkingFiles);

    renderHook(() => useWorkingChanges(mockRepo, true));

    await waitFor(() => {
      expect(useAppStore.getState().selectedFilePath).toBe("src/staged.ts");
      expect(useAppStore.getState().selectedChangeId).toBe(
        "src/staged.ts#staged"
      );
    });
  });

  it("preserves current selection when file still exists in changes", async () => {
    // Set initial selection
    useAppStore.setState({ selectedFilePath: "src/unstaged.ts" });

    mockInvoke.mockResolvedValueOnce(mockWorkingFiles);

    renderHook(() => useWorkingChanges(mockRepo, true));

    await waitFor(() => {
      expect(useAppStore.getState().selectedFilePath).toBe("src/unstaged.ts");
    });
  });

  it("selects first file when current selection no longer exists", async () => {
    // Set initial selection to a file that won't be in the result
    useAppStore.setState({ selectedFilePath: "deleted-file.ts" });

    mockInvoke.mockResolvedValueOnce(mockWorkingFiles);

    renderHook(() => useWorkingChanges(mockRepo, true));

    await waitFor(() => {
      expect(useAppStore.getState().selectedFilePath).toBe("src/staged.ts");
      expect(useAppStore.getState().selectedChangeId).toBe(
        "src/staged.ts#staged"
      );
    });
  });

  it("clears selection when there are no changes", async () => {
    // Set initial selection
    useAppStore.setState({ selectedFilePath: "some-file.ts" });

    mockInvoke.mockResolvedValueOnce([]);

    renderHook(() => useWorkingChanges(mockRepo, true));

    await waitFor(() => {
      expect(useAppStore.getState().selectedFilePath).toBeNull();
      expect(useAppStore.getState().selectedChangeId).toBeNull();
    });
  });

  it("stores changes in app store", async () => {
    mockInvoke.mockResolvedValueOnce(mockWorkingFiles);

    renderHook(() => useWorkingChanges(mockRepo, true));

    await waitFor(() => {
      expect(useAppStore.getState().changedFiles).toEqual(mockWorkingFiles);
    });
  });

  it("handles errors gracefully", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Failed to fetch changes"));

    const { result } = renderHook(() => useWorkingChanges(mockRepo, true));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.changes).toEqual([]);
    expect(result.current.error).toBe("Failed to fetch changes");
    expect(useAppStore.getState().changedFiles).toEqual([]);
  });

  it("polls for changes periodically when active", async () => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue(mockWorkingFiles);

    renderHook(() => useWorkingChanges(mockRepo, true));

    // Initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Advance past poll interval (2000ms)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledTimes(2);

    // Advance again
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it("stops polling when component unmounts", async () => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue(mockWorkingFiles);

    const { unmount } = renderHook(() => useWorkingChanges(mockRepo, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    unmount();

    // Advance past poll interval
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Should not have fetched again
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("handles same file appearing in both sections", async () => {
    const filesWithSamePath: WorkingFile[] = [
      {
        path: "src/file.ts",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 5,
        staged_deletions: 0,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged",
      },
      {
        path: "src/file.ts",
        staged_status: null,
        unstaged_status: "Modified",
        staged_additions: 0,
        staged_deletions: 0,
        unstaged_additions: 3,
        unstaged_deletions: 1,
        old_path: null,
        section: "unstaged",
      },
    ];

    useAppStore.setState({
      selectedFilePath: "src/file.ts",
      selectedChangeId: "src/file.ts#unstaged",
    });

    mockInvoke.mockResolvedValueOnce(filesWithSamePath);

    const { result } = renderHook(() => useWorkingChanges(mockRepo, true));

    await waitFor(() => {
      expect(result.current.changes).toHaveLength(2);
    });

    // Both entries should be present
    expect(result.current.changes[0].section).toBe("staged");
    expect(result.current.changes[1].section).toBe("unstaged");
    expect(useAppStore.getState().selectedChangeId).toBe(
      "src/file.ts#unstaged"
    );
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../store/appStore";
import type { ChangedFile } from "../types/file";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Unmock useRepoPolling so we test the real implementation
vi.unmock("./useRepoPolling");
vi.unmock("./useAppVisibility");

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushAsyncWork(iterations = 8) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

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

  it("fetches working changes in history mode without overwriting commit file selection", async () => {
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

    const commitFiles: ChangedFile[] = [
      {
        path: "src/commit-file.tsx",
        additions: 3,
        deletions: 1,
        status: "Modified",
        old_path: null,
      },
    ];

    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_working_changes_ex") {
        return Promise.resolve(mockChanges);
      }
      return Promise.resolve([]);
    });

    useAppStore.setState({
      viewMode: "history",
      changedFiles: commitFiles,
      selectedFilePath: "src/commit-file.tsx",
      selectedChangeId: null,
    });

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
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_working_changes_ex", {
      repoPath: "/test/repo",
    });

    expect(useAppStore.getState().workingChanges).toEqual(mockChanges);
    expect(useAppStore.getState().changedFiles).toEqual(commitFiles);
    expect(useAppStore.getState().selectedFilePath).toBe("src/commit-file.tsx");
    expect(useAppStore.getState().selectedChangeId).toBeNull();
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

  it("fetches current branch name and stores it", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_current_branch") {
        return Promise.resolve("feature-xyz");
      }
      return Promise.resolve([]);
    });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("get_current_branch", {
      repoPath: "/test/repo",
    });

    expect(useAppStore.getState().currentBranchName).toBe("feature-xyz");
  });

  it("clears current branch name when get_current_branch fails", async () => {
    useAppStore.setState({ currentBranchName: "old-branch" });

    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_current_branch") {
        return Promise.reject(new Error("detached HEAD"));
      }
      return Promise.resolve([]);
    });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useAppStore.getState().currentBranchName).toBeNull();
  });

  it("clears current branch name when repo is deselected", async () => {
    mockInvoke.mockImplementation((command: string) => {
      if (command === "get_current_branch") {
        return Promise.resolve("main");
      }
      return Promise.resolve([]);
    });

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
      await Promise.resolve();
    });

    expect(useAppStore.getState().currentBranchName).toBe("main");

    rerender({ selectedRepo: null });

    expect(useAppStore.getState().currentBranchName).toBeNull();
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

  it("uses commitLimit from store when fetching commits", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({ commitLimit: 100 });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
      repoPath: "/test/repo",
      limit: 100,
    });
  });

  it("sets hasMoreCommits to false when returned commits are fewer than limit", async () => {
    const fewCommits = Array.from({ length: 30 }, (_, i) => ({
      id: `commit-${i}`,
      message: `Commit ${i}`,
      author: "Test",
      email: "test@test.com",
      timestamp: Date.now() / 1000 - i,
    }));

    mockInvoke.mockImplementation((command: string) => {
      if (command === "list_commits") {
        return Promise.resolve(fewCommits);
      }
      return Promise.resolve([]);
    });

    useAppStore.setState({ commitLimit: 50, hasMoreCommits: true });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    await act(async () => {
      await Promise.resolve();
    });

    // 30 returned < 50 limit → no more commits
    expect(useAppStore.getState().hasMoreCommits).toBe(false);
  });

  it("keeps hasMoreCommits true when returned commits equal the limit", async () => {
    const fullPage = Array.from({ length: 50 }, (_, i) => ({
      id: `commit-${i}`,
      message: `Commit ${i}`,
      author: "Test",
      email: "test@test.com",
      timestamp: Date.now() / 1000 - i,
    }));

    mockInvoke.mockImplementation((command: string) => {
      if (command === "list_commits") {
        return Promise.resolve(fullPage);
      }
      return Promise.resolve([]);
    });

    useAppStore.setState({ commitLimit: 50, hasMoreCommits: true });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    await act(async () => {
      await Promise.resolve();
    });

    // 50 returned === 50 limit → might be more
    expect(useAppStore.getState().hasMoreCommits).toBe(true);
  });

  it("passes authorFilter to list_commits when set", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({
      authorFilter: ["alice@example.com", "bob@example.com"],
    });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
      repoPath: "/test/repo",
      limit: 50,
      authorEmails: ["alice@example.com", "bob@example.com"],
    });
  });

  it("does not let stale polling responses overwrite data after switching active worktrees", async () => {
    const initialPath = "/test/repo-main";
    const nextPath = "/test/repo-feature";
    const initialCommits =
      createDeferred<
        Array<{
          id: string;
          message: string;
          author: string;
          email: string;
          timestamp: number;
        }>
      >();

    const featureCommits = [
      {
        id: "feature-commit",
        message: "feature commit",
        author: "Feature",
        email: "feature@example.com",
        timestamp: 2,
      },
    ];
    const mainCommits = [
      {
        id: "main-commit",
        message: "main commit",
        author: "Main",
        email: "main@example.com",
        timestamp: 1,
      },
    ];
    const featureChanges = [
      {
        path: "src/feature.ts",
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
    ];
    const mainChanges = [
      {
        path: "src/main.ts",
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
    ];

    mockInvoke.mockImplementation(
      (command: string, args?: { repoPath?: string }) => {
        const repoPath = args?.repoPath;

        if (command === "list_commits") {
          if (repoPath === initialPath) {
            return initialCommits.promise;
          }
          if (repoPath === nextPath) {
            return Promise.resolve(featureCommits);
          }
        }

        if (command === "get_ahead_behind") {
          if (repoPath === initialPath) {
            return Promise.resolve({ ahead: 1, behind: 0 });
          }
          if (repoPath === nextPath) {
            return Promise.resolve({ ahead: 0, behind: 2 });
          }
        }

        if (command === "get_current_branch") {
          if (repoPath === initialPath) {
            return Promise.resolve("main");
          }
          if (repoPath === nextPath) {
            return Promise.resolve("feature");
          }
        }

        if (command === "get_working_changes_ex") {
          if (repoPath === initialPath) {
            return Promise.resolve(mainChanges);
          }
          if (repoPath === nextPath) {
            return Promise.resolve(featureChanges);
          }
        }

        return Promise.resolve([]);
      }
    );

    useAppStore.setState({
      repos: [
        {
          id: "1",
          path: initialPath,
          canonicalPath: "/test/repo",
          name: "repo",
          addedAt: Date.now(),
        },
      ],
      selectedRepoId: "1",
    });

    const { useRepoPolling } = await import("./useRepoPolling");
    const { useSelectedRepo } = await import("../store/appStore");

    renderHook(() => {
      const selectedRepo = useSelectedRepo();
      useRepoPolling(selectedRepo);
      return selectedRepo;
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      useAppStore.getState().selectRepoWorktree("1", nextPath);
    });

    await act(async () => {
      await flushAsyncWork();
    });

    expect(useAppStore.getState().commits).toEqual(featureCommits);
    expect(useAppStore.getState().workingChanges).toEqual(featureChanges);
    expect(useAppStore.getState().currentBranchName).toBe("feature");
    expect(useAppStore.getState().unpushedCount).toBe(0);
    expect(useAppStore.getState().behindCount).toBe(2);

    await act(async () => {
      initialCommits.resolve(mainCommits);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useAppStore.getState().commits).toEqual(featureCommits);
    expect(useAppStore.getState().workingChanges).toEqual(featureChanges);
    expect(useAppStore.getState().currentBranchName).toBe("feature");
    expect(useAppStore.getState().unpushedCount).toBe(0);
    expect(useAppStore.getState().behindCount).toBe(2);
  });

  it("re-polls using the updated worktree path when the selected repo is re-added via canonical upsert", async () => {
    mockInvoke.mockResolvedValue([]);

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
    });

    const { useRepoPolling } = await import("./useRepoPolling");
    const { useSelectedRepo } = await import("../store/appStore");

    renderHook(() => {
      const selectedRepo = useSelectedRepo();
      useRepoPolling(selectedRepo);
      return selectedRepo;
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      useAppStore.getState().addRepo({
        path: "/test/repo-feature",
        canonicalPath: "/test/repo",
        name: "repo",
      });
    });

    await act(async () => {
      await flushAsyncWork();
    });

    expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
      repoPath: "/test/repo-feature",
      limit: 50,
    });
    expect(mockInvoke).toHaveBeenCalledWith("get_working_changes_ex", {
      repoPath: "/test/repo-feature",
    });
  });

  it("does not pass authorEmails when authorFilter is empty", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({ authorFilter: [] });

    const { useRepoPolling } = await import("./useRepoPolling");

    const repo = {
      id: "1",
      path: "/test/repo",
      name: "repo",
      addedAt: Date.now(),
    };

    renderHook(() => useRepoPolling(repo));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
      repoPath: "/test/repo",
      limit: 50,
    });
  });
});

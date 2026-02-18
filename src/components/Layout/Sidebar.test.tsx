import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandEmitter } from "../../commands";
import { FocusProvider } from "../../context/FocusContext";
import { useAppStore } from "../../store/appStore";
import { Sidebar } from "./Sidebar";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

function mockChangesOnly(changes: unknown[]) {
  mockInvoke.mockImplementation((command: unknown) => {
    if (command === "get_working_changes") {
      return Promise.resolve(changes);
    }

    if (command === "list_commits") {
      return Promise.resolve([]);
    }

    return Promise.resolve([]);
  });
}

function mockChangesSequence(sequence: unknown[][]) {
  let callIndex = 0;

  mockInvoke.mockImplementation((command: unknown) => {
    if (command === "get_working_changes") {
      const index = Math.min(callIndex, sequence.length - 1);
      callIndex += 1;
      return Promise.resolve(sequence[index] ?? []);
    }

    if (command === "list_commits") {
      return Promise.resolve([]);
    }

    return Promise.resolve([]);
  });
}

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
      selectedCommitIds: [],
      viewMode: "history",
    });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState({
        repos: [],
        selectedRepoId: null,
        selectedCommitId: null,
        selectedCommitIds: [],
        viewMode: "history",
      });
    });
  });

  it("shows prompt when no repo is selected", () => {
    render(<Sidebar />);

    expect(
      screen.getByText("Select a repository to view commits")
    ).toBeInTheDocument();
  });

  it("shows view mode toggle buttons", () => {
    render(<Sidebar />);

    expect(screen.getByRole("tab", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Changes" })).toBeInTheDocument();
  });

  it("shows loading state while fetching commits", async () => {
    // Setup a repo and select it
    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    // Make invoke hang indefinitely
    mockInvoke.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        })
    );

    render(<Sidebar />);

    expect(screen.getByText("Loading commits...")).toBeInTheDocument();
  });

  it("displays commits when loaded successfully", async () => {
    const mockCommits = [
      {
        id: "abc123def456abc123def456abc123def456abc1",
        message: "feat: add new feature",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      },
      {
        id: "def456abc123def456abc123def456abc123def4",
        message: "fix: bug fix",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    });

    expect(screen.getByText("fix: bug fix")).toBeInTheDocument();
    expect(screen.getByText(/abc123d/)).toBeInTheDocument(); // Short SHA
  });

  it("supports cmd-click multi-select in history mode", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: first",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
      {
        id: "commit-b",
        message: "feat: second",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 1800,
      },
      {
        id: "commit-c",
        message: "feat: third",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      viewMode: "history",
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("feat: first")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("feat: first"));
    fireEvent.click(screen.getByText("feat: third"), { metaKey: true });

    expect(useAppStore.getState().selectedCommitIds).toEqual([
      "commit-a",
      "commit-c",
    ]);
  });

  it("supports shift-click range selection in history mode", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: first",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
      {
        id: "commit-b",
        message: "feat: second",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 1800,
      },
      {
        id: "commit-c",
        message: "feat: third",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      viewMode: "history",
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("feat: first")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("feat: first"));
    fireEvent.click(screen.getByText("feat: third"), { shiftKey: true });

    expect(useAppStore.getState().selectedCommitIds).toEqual([
      "commit-a",
      "commit-b",
      "commit-c",
    ]);
  });

  it("shows error message when fetch fails", async () => {
    mockInvoke.mockRejectedValue(new Error("Failed to open repository"));

    useAppStore.setState({
      repos: [
        { id: "1", path: "/invalid/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(
        screen.getByText(/Error:.*Failed to open repository/)
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when repo has no commits", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("No commits found")).toBeInTheDocument();
    });
  });

  it("calls list_commits with correct parameters", async () => {
    mockInvoke.mockResolvedValue([]);

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
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/test/my-repo",
        limit: 50,
      });
    });
  });

  it("refetches commits when selected repo changes", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo1", name: "repo1", addedAt: Date.now() },
        { id: "2", path: "/test/repo2", name: "repo2", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    const { rerender } = render(<Sidebar />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/test/repo1",
        limit: 50,
      });
    });

    // Change selected repo
    await act(async () => {
      useAppStore.setState({ selectedRepoId: "2" });
      rerender(<Sidebar />);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/test/repo2",
        limit: 50,
      });
    });
  });

  it("navigates commits with navigation commands when sidebar is focused", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: first",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
      {
        id: "commit-b",
        message: "feat: second",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 1800,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "commit-a",
      focusedRegion: "sidebar",
      viewMode: "history",
    });

    render(
      <FocusProvider region="sidebar">
        <Sidebar />
      </FocusProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("feat: first")).toBeInTheDocument();
    });

    act(() => {
      commandEmitter.emit("navigation.selectNext");
    });

    expect(useAppStore.getState().selectedCommitId).toBe("commit-b");
  });

  it("uses accent selected commit style when sidebar is focused", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: first",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "commit-a",
      selectedCommitIds: ["commit-a"],
      focusedRegion: "sidebar",
      viewMode: "history",
    });

    render(
      <FocusProvider region="sidebar">
        <Sidebar />
      </FocusProvider>
    );

    const row = await screen.findByText("feat: first");
    const rowButton = row.closest("button");
    expect(rowButton).toHaveClass("bg-accent-muted");
  });

  it("uses muted selected commit style when sidebar is unfocused", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: first",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "commit-a",
      selectedCommitIds: ["commit-a"],
      focusedRegion: "files",
      viewMode: "history",
    });

    render(
      <FocusProvider region="sidebar">
        <Sidebar />
      </FocusProvider>
    );

    const row = await screen.findByText("feat: first");
    const rowButton = row.closest("button");
    expect(rowButton).toHaveClass("bg-list-selected-unfocused");
    expect(rowButton).not.toHaveClass("bg-accent-muted");
  });

  it("uses desktop-style commit rows (no pointer cursor and no hover fill)", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: first",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "commit-a",
      viewMode: "history",
    });

    render(<Sidebar />);

    const row = await screen.findByText("feat: first");
    const rowButton = row.closest("button");
    expect(rowButton).toHaveClass("cursor-default");
    expect(rowButton).not.toHaveClass("cursor-pointer");
    expect(rowButton).not.toHaveClass("hover:bg-bg-hover");
  });

  describe("commit auto-refresh", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      await act(async () => {
        vi.useRealTimers();
      });
    });

    it("refreshes commit list during polling in History view", async () => {
      const initialCommits = [
        {
          id: "commit-a",
          message: "feat: first",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 3600,
        },
      ];

      const updatedCommits = [
        {
          id: "commit-b",
          message: "feat: latest",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 60,
        },
        ...initialCommits,
      ];

      mockInvoke
        .mockResolvedValueOnce(initialCommits)
        .mockResolvedValueOnce(updatedCommits);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      render(<Sidebar />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText("feat: first")).toBeInTheDocument();
      expect(screen.queryByText("feat: latest")).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      expect(screen.getByText("feat: latest")).toBeInTheDocument();
    });

    it("keeps polling commits while viewing Changes", async () => {
      mockInvoke.mockReset();
      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve([]);
        }

        if (command === "get_working_changes") {
          return Promise.resolve([]);
        }

        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "changes",
      });

      render(<Sidebar />);

      await act(async () => {
        await Promise.resolve();
      });

      const initialCommitCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === "list_commits"
      ).length;
      expect(initialCommitCalls).toBe(1);

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      const polledCommitCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === "list_commits"
      ).length;
      expect(polledCommitCalls).toBe(2);
    });
  });

  describe("Changes view", () => {
    it("switches to changes view when Changes button is clicked", async () => {
      mockInvoke.mockResolvedValue([]);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      render(<Sidebar />);

      fireEvent.click(screen.getByRole("tab", { name: "Changes" }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("get_working_changes", {
          repoPath: "/test/repo",
        });
      });
    });

    it("shows changes prompt when no repo is selected in changes view", () => {
      useAppStore.setState({ viewMode: "changes" });

      render(<Sidebar />);

      expect(
        screen.getByText("Select a repository to view changes")
      ).toBeInTheDocument();
    });

    it("shows empty state when no working changes", async () => {
      mockInvoke.mockResolvedValue([]);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "changes",
      });

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText("No changes here... ✓")).toBeInTheDocument();
      });
    });

    it("displays working changes when loaded successfully", async () => {
      const mockChanges = [
        {
          path: "src/App.tsx",
          status: "Modified",
          additions: 10,
          deletions: 5,
          old_path: null,
        },
        {
          path: "src/new-file.ts",
          status: "Untracked",
          additions: 20,
          deletions: 0,
          old_path: null,
        },
      ];

      mockChangesOnly(mockChanges);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "changes",
      });

      render(<Sidebar />);

      await waitFor(() => {
        // Filename is shown separately from directory
        expect(screen.getByText("App.tsx")).toBeInTheDocument();
      });

      expect(screen.getByText("new-file.ts")).toBeInTheDocument();
      expect(screen.getByText("M")).toBeInTheDocument(); // Modified indicator
      expect(screen.getByText("?")).toBeInTheDocument(); // Untracked indicator
    });

    it("auto-selects the first changed file when entering Changes view with no selection", async () => {
      const mockChanges = [
        {
          path: "src/App.tsx",
          status: "Modified",
          additions: 10,
          deletions: 5,
          old_path: null,
        },
        {
          path: "src/new-file.ts",
          status: "Untracked",
          additions: 20,
          deletions: 0,
          old_path: null,
        },
      ];

      mockChangesOnly(mockChanges);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        selectedFilePath: null,
        viewMode: "changes",
      });

      render(<Sidebar />);

      await waitFor(() => {
        expect(useAppStore.getState().selectedFilePath).toBe("src/App.tsx");
      });
    });

    it("does not override an existing valid file selection in Changes view", async () => {
      const mockChanges = [
        {
          path: "src/App.tsx",
          status: "Modified",
          additions: 10,
          deletions: 5,
          old_path: null,
        },
        {
          path: "src/new-file.ts",
          status: "Untracked",
          additions: 20,
          deletions: 0,
          old_path: null,
        },
      ];

      mockChangesOnly(mockChanges);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        selectedFilePath: "src/new-file.ts",
        viewMode: "changes",
      });

      render(<Sidebar />);

      await waitFor(() => {
        expect(useAppStore.getState().selectedFilePath).toBe("src/new-file.ts");
      });
    });

    it("navigates changed files with navigation commands when sidebar is focused", async () => {
      const mockChanges = [
        {
          path: "src/App.tsx",
          status: "Modified",
          additions: 10,
          deletions: 5,
          old_path: null,
        },
        {
          path: "src/new-file.ts",
          status: "Untracked",
          additions: 20,
          deletions: 0,
          old_path: null,
        },
      ];

      mockChangesOnly(mockChanges);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        selectedFilePath: "src/App.tsx",
        focusedRegion: "sidebar",
        viewMode: "changes",
      });

      render(
        <FocusProvider region="sidebar">
          <Sidebar />
        </FocusProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("App.tsx")).toBeInTheDocument();
      });

      act(() => {
        commandEmitter.emit("navigation.selectNext");
      });

      expect(useAppStore.getState().selectedFilePath).toBe("src/new-file.ts");
    });

    it("shows addition and deletion counts for changed files", async () => {
      const mockChanges = [
        {
          path: "src/App.tsx",
          status: "Modified",
          additions: 10,
          deletions: 5,
          old_path: null,
        },
      ];

      mockChangesOnly(mockChanges);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "changes",
      });

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText("+10")).toBeInTheDocument();
        expect(screen.getByText("-5")).toBeInTheDocument();
      });
    });

    describe("auto-refresh", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(async () => {
        await act(async () => {
          vi.useRealTimers();
        });
      });

      it("polls for changes every 2 seconds when in Changes view", async () => {
        const mockChanges = [
          {
            path: "src/App.tsx",
            status: "Modified",
            additions: 10,
            deletions: 5,
            old_path: null,
          },
        ];

        mockChangesOnly(mockChanges);

        useAppStore.setState({
          repos: [
            { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
          ],
          selectedRepoId: "1",
          viewMode: "changes",
        });

        render(<Sidebar />);

        // Initial fetch happens immediately - flush the promise
        await act(async () => {
          await Promise.resolve();
        });
        const initialChangesCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === "get_working_changes"
        ).length;
        expect(initialChangesCalls).toBe(1);

        // Advance time by 2 seconds - should trigger poll
        await act(async () => {
          vi.advanceTimersByTime(2000);
          await Promise.resolve();
        });
        const firstPolledChangesCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === "get_working_changes"
        ).length;
        expect(firstPolledChangesCalls).toBe(2);

        // Advance time by another 2 seconds
        await act(async () => {
          vi.advanceTimersByTime(2000);
          await Promise.resolve();
        });
        const secondPolledChangesCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === "get_working_changes"
        ).length;
        expect(secondPolledChangesCalls).toBe(3);
      });

      it("stops polling when switching to History view", async () => {
        mockInvoke.mockResolvedValue([]);

        useAppStore.setState({
          repos: [
            { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
          ],
          selectedRepoId: "1",
          viewMode: "changes",
        });

        render(<Sidebar />);

        // Initial fetch
        await act(async () => {
          await Promise.resolve();
        });

        const changesCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === "get_working_changes"
        ).length;

        // Switch to history view
        await act(async () => {
          useAppStore.setState({ viewMode: "history" });
        });

        // Advance time by 4 seconds
        await act(async () => {
          vi.advanceTimersByTime(4000);
          await Promise.resolve();
        });

        // Should not have made any more get_working_changes calls
        const newChangesCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === "get_working_changes"
        ).length;
        expect(newChangesCalls).toBe(changesCalls);
      });

      it("stops polling when component unmounts", async () => {
        mockInvoke.mockResolvedValue([]);

        useAppStore.setState({
          repos: [
            { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
          ],
          selectedRepoId: "1",
          viewMode: "changes",
        });

        const { unmount } = render(<Sidebar />);

        // Initial fetch
        await act(async () => {
          await Promise.resolve();
        });
        const initialChangesCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === "get_working_changes"
        ).length;
        expect(initialChangesCalls).toBe(1);

        // Unmount the component
        unmount();

        // Advance time by 4 seconds
        await act(async () => {
          vi.advanceTimersByTime(4000);
          await Promise.resolve();
        });

        // Should not have made any more get_working_changes calls
        const postUnmountChangesCalls = mockInvoke.mock.calls.filter(
          (call) => call[0] === "get_working_changes"
        ).length;
        expect(postUnmountChangesCalls).toBe(1);
      });

      it("updates display when file list changes", async () => {
        const initialChanges = [
          {
            path: "src/App.tsx",
            status: "Modified",
            additions: 5,
            deletions: 2,
            old_path: null,
          },
        ];

        const updatedChanges = [
          {
            path: "src/App.tsx",
            status: "Modified",
            additions: 5,
            deletions: 2,
            old_path: null,
          },
          {
            path: "src/NewFile.tsx",
            status: "Untracked",
            additions: 10,
            deletions: 0,
            old_path: null,
          },
        ];

        mockChangesSequence([initialChanges, updatedChanges]);

        useAppStore.setState({
          repos: [
            { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
          ],
          selectedRepoId: "1",
          viewMode: "changes",
        });

        render(<Sidebar />);

        // Initial fetch
        await act(async () => {
          await Promise.resolve();
        });

        expect(screen.getByText("App.tsx")).toBeInTheDocument();
        expect(screen.queryByText("NewFile.tsx")).not.toBeInTheDocument();

        // Advance time to trigger poll
        await act(async () => {
          vi.advanceTimersByTime(2000);
          await Promise.resolve();
        });

        // Should show the new file
        expect(screen.getByText("App.tsx")).toBeInTheDocument();
        expect(screen.getByText("NewFile.tsx")).toBeInTheDocument();
      });

      it("auto-selects the first remaining file when selected file disappears from changes", async () => {
        const initialChanges = [
          {
            path: "src/App.tsx",
            status: "Modified",
            additions: 5,
            deletions: 2,
            old_path: null,
          },
          {
            path: "src/Other.tsx",
            status: "Modified",
            additions: 3,
            deletions: 1,
            old_path: null,
          },
        ];

        // After poll, App.tsx is no longer in the list (user reverted changes)
        const updatedChanges = [
          {
            path: "src/Other.tsx",
            status: "Modified",
            additions: 3,
            deletions: 1,
            old_path: null,
          },
        ];

        mockChangesSequence([initialChanges, updatedChanges]);

        useAppStore.setState({
          repos: [
            { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
          ],
          selectedRepoId: "1",
          selectedFilePath: "src/App.tsx", // File is selected
          viewMode: "changes",
        });

        render(<Sidebar />);

        // Initial fetch
        await act(async () => {
          await Promise.resolve();
        });

        // App.tsx should be selected
        expect(useAppStore.getState().selectedFilePath).toBe("src/App.tsx");

        // Advance time to trigger poll - App.tsx disappears
        await act(async () => {
          vi.advanceTimersByTime(2000);
          await Promise.resolve();
        });

        // Selection should move to the first remaining file
        expect(useAppStore.getState().selectedFilePath).toBe("src/Other.tsx");
      });
    });
  });
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// Unmock useRepoPolling for this test file so we can test with mocked invoke
vi.unmock("../../hooks/useRepoPolling");

import type { ReactNode } from "react";
import { __testing as gravatarTesting } from "../../hooks/useGravatar";
// Import after unmocking
import { useRepoPolling } from "../../hooks/useRepoPolling";
import { useSelectedRepo } from "../../store/appStore";

/**
 * Wrapper component that provides polling context for Sidebar tests.
 * This mimics what AppLayout does in the real app.
 */
function SidebarWithPolling({ children }: { children?: ReactNode }) {
  const selectedRepo = useSelectedRepo();
  useRepoPolling(selectedRepo);
  return <>{children ?? <Sidebar />}</>;
}

/**
 * Render Sidebar with polling context.
 * Use this for tests that need to test the full data flow via mocked invoke.
 */
function renderWithPolling() {
  return render(<SidebarWithPolling />);
}

/**
 * Render Sidebar with polling and focus context.
 */
function renderWithPollingAndFocus(region: "sidebar" | "files" | "diff") {
  return render(
    <SidebarWithPolling>
      <FocusProvider region={region}>
        <Sidebar />
      </FocusProvider>
    </SidebarWithPolling>
  );
}

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gravatarTesting.resetAvatarCache();
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
      selectedCommitIds: [],
      selectedChangeId: null,
      viewMode: "history",
      // Reset polling state
      commits: [],
      isLoadingCommits: false,
      commitsError: null,
      workingChanges: [],
      isLoadingChanges: false,
      changesError: null,
      changedFiles: [],
    });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState({
        repos: [],
        selectedRepoId: null,
        selectedCommitId: null,
        selectedCommitIds: [],
        selectedChangeId: null,
        viewMode: "history",
        // Reset polling state
        commits: [],
        isLoadingCommits: false,
        commitsError: null,
        workingChanges: [],
        isLoadingChanges: false,
        changesError: null,
        changedFiles: [],
      });
    });
  });

  it("shows prompt when no repo is selected", () => {
    renderWithPolling();

    expect(
      screen.getByText("Select a repository to view commits")
    ).toBeInTheDocument();
  });

  it("shows uncommitted changes above commits and keeps the history list visible when selected", async () => {
    const mockCommits = [
      {
        id: "abc123def456abc123def456abc123def456abc1",
        message: "feat: add new feature",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
        is_pushed: true,
      },
    ];

    const mockChanges = [
      {
        path: "src/App.tsx",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 10,
        staged_deletions: 5,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged" as const,
      },
    ];

    mockInvoke.mockImplementation((command: unknown) => {
      if (command === "list_commits") {
        return Promise.resolve(mockCommits);
      }

      if (command === "get_working_changes_ex") {
        return Promise.resolve(mockChanges);
      }

      return Promise.resolve([]);
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    await waitFor(() => {
      expect(screen.getByText("Uncommitted changes")).toBeInTheDocument();
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    });

    const uncommitted = screen.getByText("Uncommitted changes");
    const commit = screen.getByText("feat: add new feature");

    expect(uncommitted.compareDocumentPosition(commit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    fireEvent.click(uncommitted.closest("button") as HTMLButtonElement);

    expect(useAppStore.getState().viewMode).toBe("changes");
    expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
  });

  it("renders uncommitted changes in sentence case and italic", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: latest",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 60,
        is_pushed: true,
      },
    ];

    const mockChanges = [
      {
        path: "src/App.tsx",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 10,
        staged_deletions: 5,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged" as const,
      },
    ];

    mockInvoke.mockImplementation((command: unknown) => {
      if (command === "list_commits") {
        return Promise.resolve(mockCommits);
      }

      if (command === "get_working_changes_ex") {
        return Promise.resolve(mockChanges);
      }

      return Promise.resolve([]);
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    const label = await screen.findByText("Uncommitted changes");
    expect(label).toHaveClass("italic");
    expect(screen.queryByText("Uncommitted Changes")).not.toBeInTheDocument();
  });

  it("renders an icon instead of the WT text badge for uncommitted changes", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: latest",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 60,
        is_pushed: true,
      },
    ];

    const mockChanges = [
      {
        path: "src/App.tsx",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 10,
        staged_deletions: 5,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged" as const,
      },
    ];

    mockInvoke.mockImplementation((command: unknown) => {
      if (command === "list_commits") {
        return Promise.resolve(mockCommits);
      }

      if (command === "get_working_changes_ex") {
        return Promise.resolve(mockChanges);
      }

      return Promise.resolve([]);
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    const row = (await screen.findByText("Uncommitted changes")).closest(
      "button"
    );
    expect(row).not.toBeNull();
    if (!row) {
      throw new Error("Expected uncommitted changes row");
    }

    expect(row.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("WT")).not.toBeInTheDocument();
  });

  it("fades uncommitted changes text similarly to unpushed commits", async () => {
    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: latest",
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 60,
        is_pushed: true,
      },
    ];

    const mockChanges = [
      {
        path: "src/App.tsx",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 10,
        staged_deletions: 5,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged" as const,
      },
    ];

    mockInvoke.mockImplementation((command: unknown) => {
      if (command === "list_commits") {
        return Promise.resolve(mockCommits);
      }

      if (command === "get_working_changes_ex") {
        return Promise.resolve(mockChanges);
      }

      return Promise.resolve([]);
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    const label = await screen.findByText("Uncommitted changes");
    const fadedContainer = label.closest("div.min-w-0");
    expect(fadedContainer).toHaveClass("opacity-65");
  });

  it("shows a left focus indicator on the history header when sidebar is focused", async () => {
    mockInvoke.mockImplementation((command: unknown) => {
      if (command === "list_commits") {
        return Promise.resolve([]);
      }

      if (command === "get_working_changes_ex") {
        return Promise.resolve([]);
      }

      return Promise.resolve([]);
    });

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      focusedRegion: "sidebar",
    });

    const { container } = renderWithPollingAndFocus("sidebar");

    await waitFor(() => {
      expect(screen.getByText("History")).toBeInTheDocument();
    });

    const header = container.querySelector(".bg-panel-header-bg");
    expect(header).toHaveClass("border-l-2", "border-l-accent-primary");
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

    renderWithPolling();

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

    renderWithPolling();

    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    });

    expect(screen.getByText("fix: bug fix")).toBeInTheDocument();
    expect(screen.getByText(/abc123d/)).toBeInTheDocument(); // Short SHA
  });

  it("shows author name in commit metadata line", async () => {
    const mockCommits = [
      {
        id: "abc123def456abc123def456abc123def456abc1",
        message: "feat: add new feature",
        author: "Jane Doe",
        email: "jane@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    await waitFor(() => {
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    });
  });

  it("shows a Gravatar avatar image for each commit", async () => {
    const originalImage = globalThis.Image;

    class SuccessfulImage {
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    // @ts-expect-error test stub
    globalThis.Image = SuccessfulImage;

    const mockCommits = [
      {
        id: "abc123def456abc123def456abc123def456abc1",
        message: "feat: add new feature",
        author: "Jane Doe",
        email: "jane@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
      const img = document.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img?.getAttribute("src")).toContain("gravatar.com/avatar/");
    });

    globalThis.Image = originalImage;
  });

  it("shows initial fallback when Gravatar image fails to load", async () => {
    const originalImage = globalThis.Image;

    class FailingImage {
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      set src(_value: string) {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }
    }

    // @ts-expect-error test stub
    globalThis.Image = FailingImage;

    const mockCommits = [
      {
        id: "abc123def456abc123def456abc123def456abc1",
        message: "feat: add new feature",
        author: "Jane Doe",
        email: "jane@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
      expect(screen.getByText("J")).toBeInTheDocument();
    });

    expect(document.querySelector("img")).toBeNull();

    globalThis.Image = originalImage;
  });

  it("loads a shared avatar once for repeated commit authors", async () => {
    const originalImage = globalThis.Image;
    let imageLoadCount = 0;

    class SuccessfulImage {
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      set src(_value: string) {
        imageLoadCount += 1;
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }

    // @ts-expect-error test stub
    globalThis.Image = SuccessfulImage;

    const mockCommits = [
      {
        id: "commit-a",
        message: "feat: first",
        author: "Jane Doe",
        email: "jane@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      },
      {
        id: "commit-b",
        message: "feat: second",
        author: "Jane Doe",
        email: "jane@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 1800,
      },
    ];

    mockInvoke.mockResolvedValue(mockCommits);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
    });

    renderWithPolling();

    await waitFor(() => {
      expect(screen.getByText("feat: first")).toBeInTheDocument();
      expect(screen.getByText("feat: second")).toBeInTheDocument();
      expect(document.querySelectorAll("img")).toHaveLength(2);
    });

    expect(imageLoadCount).toBe(1);

    globalThis.Image = originalImage;
  });

  describe("author filter", () => {
    const multiAuthorCommits = [
      {
        id: "commit-a",
        message: "feat: alice's change",
        author: "Alice",
        email: "alice@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 600,
      },
      {
        id: "commit-b",
        message: "fix: bob's fix",
        author: "Bob",
        email: "bob@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 1200,
      },
      {
        id: "commit-c",
        message: "feat: alice's second change",
        author: "Alice",
        email: "alice@example.com",
        timestamp: Math.floor(Date.now() / 1000) - 1800,
      },
    ];

    it("shows a filter button in history mode", async () => {
      mockInvoke.mockResolvedValue(multiAuthorCommits);

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: alice's change")).toBeInTheDocument();
      });

      expect(screen.getByTestId("author-filter-button")).toBeInTheDocument();
    });

    it("shows unique authors when filter button is clicked", async () => {
      mockInvoke.mockResolvedValue(multiAuthorCommits);
      const user = userEvent.setup();

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: alice's change")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("author-filter-button"));

      // Should show unique authors as menuitemcheckbox (Radix CheckboxItem)
      await waitFor(() => {
        expect(
          screen.getByRole("menuitemcheckbox", { name: /Alice/ })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("menuitemcheckbox", { name: /Bob/ })
        ).toBeInTheDocument();
      });
    });

    it("filters commits when an author is selected", async () => {
      const aliceCommits = multiAuthorCommits.filter(
        (c) => c.email === "alice@example.com"
      );

      mockInvoke.mockImplementation(
        (command: unknown, args: Record<string, unknown>) => {
          if (command === "list_commits") {
            if (args.authorEmails) {
              return Promise.resolve(aliceCommits);
            }
            return Promise.resolve(multiAuthorCommits);
          }
          return Promise.resolve([]);
        }
      );
      const user = userEvent.setup();

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: alice's change")).toBeInTheDocument();
      });

      // All 3 commits visible
      expect(screen.getByText("fix: bob's fix")).toBeInTheDocument();
      expect(
        screen.getByText("feat: alice's second change")
      ).toBeInTheDocument();

      // Open filter and select Alice
      await user.click(screen.getByTestId("author-filter-button"));
      await waitFor(() => {
        expect(
          screen.getByRole("menuitemcheckbox", { name: /Alice/ })
        ).toBeInTheDocument();
      });
      await user.click(screen.getByRole("menuitemcheckbox", { name: /Alice/ }));

      // Backend re-fetches with filter — only Alice's commits
      await waitFor(() => {
        expect(screen.queryByText("fix: bob's fix")).not.toBeInTheDocument();
      });
      expect(screen.getByText("feat: alice's change")).toBeInTheDocument();
      expect(
        screen.getByText("feat: alice's second change")
      ).toBeInTheDocument();
    });

    it("filters author list by search input", async () => {
      mockInvoke.mockResolvedValue(multiAuthorCommits);
      const user = userEvent.setup();

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: alice's change")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("author-filter-button"));

      await waitFor(() => {
        expect(
          screen.getByRole("menuitemcheckbox", { name: /Alice/ })
        ).toBeInTheDocument();
      });

      // Both authors visible
      expect(
        screen.getByRole("menuitemcheckbox", { name: /Bob/ })
      ).toBeInTheDocument();

      // Type in search
      await user.type(screen.getByPlaceholderText("Search authors…"), "bob");

      // Only Bob visible
      expect(
        screen.getByRole("menuitemcheckbox", { name: /Bob/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("menuitemcheckbox", { name: /Alice/ })
      ).not.toBeInTheDocument();
    });

    it("searches authors by email", async () => {
      mockInvoke.mockResolvedValue(multiAuthorCommits);
      const user = userEvent.setup();

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: alice's change")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("author-filter-button"));

      await waitFor(() => {
        expect(
          screen.getByRole("menuitemcheckbox", { name: /Alice/ })
        ).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText("Search authors…"), "alice@");

      expect(
        screen.getByRole("menuitemcheckbox", { name: /Alice/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("menuitemcheckbox", { name: /Bob/ })
      ).not.toBeInTheDocument();
    });

    it("shows pushed/unpushed indicators correctly with author filter", async () => {
      const aliceCommitsWithPushStatus = [
        {
          id: "commit-a",
          message: "feat: alice's unpushed change",
          author: "Alice",
          email: "alice@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 600,
          is_pushed: false,
        },
        {
          id: "commit-c",
          message: "feat: alice's pushed change",
          author: "Alice",
          email: "alice@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 1800,
          is_pushed: true,
        },
      ];

      mockInvoke.mockImplementation(
        (command: unknown, args: Record<string, unknown>) => {
          if (command === "list_commits") {
            if (args.authorEmails) {
              return Promise.resolve(aliceCommitsWithPushStatus);
            }
            return Promise.resolve(multiAuthorCommits);
          }
          if (command === "get_ahead_behind") {
            return Promise.resolve({ ahead: 1, behind: 0 });
          }
          return Promise.resolve([]);
        }
      );

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
        authorFilter: ["alice@example.com"],
      });

      renderWithPolling();

      await waitFor(() => {
        expect(
          screen.getByText("feat: alice's unpushed change")
        ).toBeInTheDocument();
      });

      // Divider should appear between unpushed and pushed
      expect(screen.getByTestId("push-divider")).toBeInTheDocument();

      // Unpushed commit should be faded
      const unpushedText = screen.getByText("feat: alice's unpushed change");
      expect(unpushedText.parentElement).toHaveClass("opacity-65");

      // Pushed commit should not be faded
      const pushedText = screen.getByText("feat: alice's pushed change");
      expect(pushedText.parentElement).not.toHaveClass("opacity-65");
    });

    it("shows all commits when filter is cleared", async () => {
      const aliceCommits = multiAuthorCommits.filter(
        (c) => c.email === "alice@example.com"
      );

      mockInvoke.mockImplementation(
        (command: unknown, args: Record<string, unknown>) => {
          if (command === "list_commits") {
            if (args.authorEmails) {
              return Promise.resolve(aliceCommits);
            }
            return Promise.resolve(multiAuthorCommits);
          }
          return Promise.resolve([]);
        }
      );

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
        authorFilter: ["alice@example.com"],
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: alice's change")).toBeInTheDocument();
      });

      // Bob's commit should be hidden (backend filtered)
      expect(screen.queryByText("fix: bob's fix")).not.toBeInTheDocument();

      // Clear filter
      act(() => {
        useAppStore.getState().clearAuthorFilter();
      });

      // All commits visible again (backend re-fetches without filter)
      await waitFor(() => {
        expect(screen.getByText("fix: bob's fix")).toBeInTheDocument();
      });
    });
  });

  describe("infinite scroll", () => {
    it("shows a 'Load more' indicator when there are more commits", async () => {
      const commits = Array.from({ length: 50 }, (_, i) => ({
        id: `commit-${i}`,
        message: `Commit ${i}`,
        author: "Test User",
        email: "test@example.com",
        timestamp: Math.floor(Date.now() / 1000) - i * 60,
      }));

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(commits);
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("Commit 0")).toBeInTheDocument();
      });

      // hasMoreCommits should be true (50 returned === 50 limit)
      expect(useAppStore.getState().hasMoreCommits).toBe(true);
      expect(screen.getByTestId("load-more-commits")).toBeInTheDocument();
    });

    it("does not show load more indicator when all commits are loaded", async () => {
      const commits = [
        {
          id: "commit-1",
          message: "Only commit",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 60,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(commits);
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("Only commit")).toBeInTheDocument();
      });

      // hasMoreCommits should be false (1 returned < 50 limit)
      expect(useAppStore.getState().hasMoreCommits).toBe(false);
      expect(screen.queryByTestId("load-more-commits")).not.toBeInTheDocument();
    });
  });

  describe("pushed/unpushed divider", () => {
    it("shows a divider between unpushed and pushed commits", async () => {
      const mockCommits = [
        {
          id: "unpushed-1",
          message: "feat: local change",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 600,
          is_pushed: false,
        },
        {
          id: "pushed-1",
          message: "feat: pushed change",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          is_pushed: true,
        },
        {
          id: "pushed-2",
          message: "fix: older fix",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 7200,
          is_pushed: true,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 1, behind: 0 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: local change")).toBeInTheDocument();
      });

      const divider = screen.getByTestId("push-divider");
      expect(divider).toBeInTheDocument();
      expect(divider).toHaveTextContent("unpushed");
    });

    it("fades commit message text for unpushed commits", async () => {
      const mockCommits = [
        {
          id: "unpushed-1",
          message: "feat: local change",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 600,
          is_pushed: false,
        },
        {
          id: "pushed-1",
          message: "feat: pushed change",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          is_pushed: true,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 1, behind: 0 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: local change")).toBeInTheDocument();
      });

      // Unpushed commit text container should be faded
      const unpushedMessage = screen.getByText("feat: local change");
      const unpushedTextBlock = unpushedMessage.parentElement;
      expect(unpushedTextBlock).toHaveClass("opacity-65");

      // Pushed commit text container should not be faded
      const pushedMessage = screen.getByText("feat: pushed change");
      const pushedTextBlock = pushedMessage.parentElement;
      expect(pushedTextBlock).not.toHaveClass("opacity-65");
    });

    it("does not show divider when all commits are pushed", async () => {
      const mockCommits = [
        {
          id: "pushed-1",
          message: "feat: pushed change",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 3600,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 0, behind: 0 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: pushed change")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("push-divider")).not.toBeInTheDocument();
    });

    it("does not show divider when no upstream is configured", async () => {
      const mockCommits = [
        {
          id: "commit-1",
          message: "feat: some change",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 3600,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }
        if (command === "get_ahead_behind") {
          return Promise.reject(new Error("No upstream tracking branch"));
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: some change")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("push-divider")).not.toBeInTheDocument();
    });
  });

  describe("ahead/behind badge in History tab", () => {
    it("shows ↑X when there are unpushed commits", async () => {
      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve([
            {
              id: "commit-1",
              message: "feat: local",
              author: "Test User",
              email: "test@example.com",
              timestamp: Math.floor(Date.now() / 1000) - 600,
            },
          ]);
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 3, behind: 0 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByTestId("ahead-behind-badge")).toHaveTextContent(
          "↑3"
        );
      });

      expect(screen.getByTestId("ahead-behind-badge")).not.toHaveTextContent(
        "↓"
      );
    });

    it("shows ↓Y when there are unpulled commits", async () => {
      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve([
            {
              id: "commit-1",
              message: "feat: pushed",
              author: "Test User",
              email: "test@example.com",
              timestamp: Math.floor(Date.now() / 1000) - 600,
            },
          ]);
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 0, behind: 5 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByTestId("ahead-behind-badge")).toHaveTextContent(
          "↓5"
        );
      });

      expect(screen.getByTestId("ahead-behind-badge")).not.toHaveTextContent(
        "↑"
      );
    });

    it("shows both ↑X ↓Y when ahead and behind", async () => {
      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve([
            {
              id: "commit-1",
              message: "feat: local",
              author: "Test User",
              email: "test@example.com",
              timestamp: Math.floor(Date.now() / 1000) - 600,
            },
          ]);
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 2, behind: 4 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        const badge = screen.getByTestId("ahead-behind-badge");
        expect(badge).toHaveTextContent("↑2");
        expect(badge).toHaveTextContent("↓4");
      });
    });

    it("does not show badge when fully synced", async () => {
      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve([
            {
              id: "commit-1",
              message: "feat: synced",
              author: "Test User",
              email: "test@example.com",
              timestamp: Math.floor(Date.now() / 1000) - 600,
            },
          ]);
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 0, behind: 0 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: synced")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("ahead-behind-badge")
      ).not.toBeInTheDocument();
    });

    it("does not show badge when no upstream is configured", async () => {
      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve([
            {
              id: "commit-1",
              message: "feat: no upstream",
              author: "Test User",
              email: "test@example.com",
              timestamp: Math.floor(Date.now() / 1000) - 600,
            },
          ]);
        }
        if (command === "get_ahead_behind") {
          return Promise.reject(new Error("No upstream tracking branch"));
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("feat: no upstream")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("ahead-behind-badge")
      ).not.toBeInTheDocument();
    });
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

    renderWithPolling();

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

    renderWithPolling();

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

    renderWithPolling();

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

    renderWithPolling();

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

    renderWithPolling();

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

    const { rerender } = renderWithPolling();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/test/repo1",
        limit: 50,
      });
    });

    // Change selected repo
    await act(async () => {
      useAppStore.setState({ selectedRepoId: "2" });
    });
    rerender(<SidebarWithPolling />);

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

    renderWithPollingAndFocus("sidebar");

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

    renderWithPollingAndFocus("sidebar");

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

    renderWithPollingAndFocus("sidebar");

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

    renderWithPolling();

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

      let commitCallCount = 0;
      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          commitCallCount++;
          return Promise.resolve(
            commitCallCount === 1 ? initialCommits : updatedCommits
          );
        }
        if (command === "get_ahead_behind") {
          return Promise.resolve({ ahead: 0, behind: 0 });
        }
        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
        viewMode: "history",
      });

      renderWithPolling();

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

        if (command === "get_working_changes_ex") {
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

      renderWithPolling();

      await act(async () => {
        await Promise.resolve();
      });

      const initialCommitCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === "list_commits"
      ).length;

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      const polledCommitCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === "list_commits"
      ).length;
      expect(polledCommitCalls).toBe(initialCommitCalls + 1);
    });
  });

  describe("uncommitted changes item", () => {
    it("shows the uncommitted changes item without replacing the history list", async () => {
      const mockCommits = [
        {
          id: "commit-a",
          message: "feat: latest",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 60,
          is_pushed: true,
        },
      ];

      const mockChanges = [
        {
          path: "src/App.tsx",
          staged_status: "Modified",
          unstaged_status: null,
          staged_additions: 10,
          staged_deletions: 5,
          unstaged_additions: 0,
          unstaged_deletions: 0,
          old_path: null,
          section: "staged" as const,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }

        if (command === "get_working_changes_ex") {
          return Promise.resolve(mockChanges);
        }

        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      await waitFor(() => {
        expect(screen.getByText("Uncommitted changes")).toBeInTheDocument();
        expect(screen.getByText("feat: latest")).toBeInTheDocument();
      });
    });

    it("clears commit highlight when uncommitted changes is selected", async () => {
      const mockCommits = [
        {
          id: "commit-a",
          message: "feat: latest",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 60,
          is_pushed: true,
        },
      ];

      const mockChanges = [
        {
          path: "src/App.tsx",
          staged_status: "Modified",
          unstaged_status: null,
          staged_additions: 10,
          staged_deletions: 5,
          unstaged_additions: 0,
          unstaged_deletions: 0,
          old_path: null,
          section: "staged" as const,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }

        if (command === "get_working_changes_ex") {
          return Promise.resolve(mockChanges);
        }

        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      const commitButton = (await screen.findByText("feat: latest")).closest(
        "button"
      );
      expect(commitButton).not.toBeNull();
      if (!commitButton) {
        throw new Error("Expected commit button");
      }

      expect(commitButton).toHaveClass("bg-list-selected-unfocused");

      const uncommittedButton = (
        await screen.findByText("Uncommitted changes")
      ).closest("button");
      expect(uncommittedButton).not.toBeNull();
      if (!uncommittedButton) {
        throw new Error("Expected uncommitted changes button");
      }

      fireEvent.click(uncommittedButton);

      await waitFor(() => {
        expect(uncommittedButton).toHaveClass("bg-list-selected-unfocused");
        expect(commitButton).not.toHaveClass("bg-list-selected-unfocused");
      });
    });

    it("selects the first working change immediately when uncommitted changes is clicked", async () => {
      const mockCommits = [
        {
          id: "commit-a",
          message: "feat: latest",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 60,
          is_pushed: true,
        },
      ];

      const mockChanges = [
        {
          path: "src/App.tsx",
          staged_status: "Modified",
          unstaged_status: null,
          staged_additions: 10,
          staged_deletions: 5,
          unstaged_additions: 0,
          unstaged_deletions: 0,
          old_path: null,
          section: "staged" as const,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }

        if (command === "get_working_changes_ex") {
          return Promise.resolve(mockChanges);
        }

        return Promise.resolve([]);
      });

      useAppStore.setState({
        repos: [
          { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
        ],
        selectedRepoId: "1",
      });

      renderWithPolling();

      const button = (await screen.findByText("Uncommitted changes")).closest(
        "button"
      );
      expect(button).not.toBeNull();
      if (!button) {
        throw new Error("Expected uncommitted changes button");
      }
      fireEvent.click(button);

      await waitFor(() => {
        expect(useAppStore.getState().selectedChangeId).toBe(
          "src/App.tsx#staged"
        );
        expect(useAppStore.getState().selectedFilePath).toBe("src/App.tsx");
      });
    });

    it("falls back to the latest commit when uncommitted changes disappear", async () => {
      const mockCommits = [
        {
          id: "commit-a",
          message: "feat: latest",
          author: "Test User",
          email: "test@example.com",
          timestamp: Math.floor(Date.now() / 1000) - 60,
          is_pushed: true,
        },
      ];

      mockInvoke.mockImplementation((command: unknown) => {
        if (command === "list_commits") {
          return Promise.resolve(mockCommits);
        }

        if (command === "get_working_changes_ex") {
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

      renderWithPolling();

      await waitFor(() => {
        expect(useAppStore.getState().viewMode).toBe("history");
        expect(useAppStore.getState().selectedCommitId).toBe("commit-a");
      });
    });
  });
});

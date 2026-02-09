import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "../../store/appStore";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ repos: [], selectedRepoId: null, viewMode: "history" });
  });

  afterEach(() => {
    useAppStore.setState({ repos: [], selectedRepoId: null, viewMode: "history" });
  });

  it("shows prompt when no repo is selected", () => {
    render(<Sidebar />);
    
    expect(screen.getByText("Select a repository to view commits")).toBeInTheDocument();
  });

  it("shows view mode toggle buttons", () => {
    render(<Sidebar />);
    
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Changes" })).toBeInTheDocument();
  });

  it("shows loading state while fetching commits", async () => {
    // Setup a repo and select it
    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
    });

    // Make invoke hang indefinitely
    mockInvoke.mockImplementation(() => new Promise(() => {}));

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
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText("feat: add new feature")).toBeInTheDocument();
    });

    expect(screen.getByText("fix: bug fix")).toBeInTheDocument();
    expect(screen.getByText(/abc123d/)).toBeInTheDocument(); // Short SHA
  });

  it("shows error message when fetch fails", async () => {
    mockInvoke.mockRejectedValue(new Error("Failed to open repository"));

    useAppStore.setState({
      repos: [{ id: "1", path: "/invalid/repo", name: "repo", addedAt: Date.now() }],
      selectedRepoId: "1",
    });

    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByText(/Error:.*Failed to open repository/)).toBeInTheDocument();
    });
  });

  it("shows empty state when repo has no commits", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({
      repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
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
      repos: [{ id: "1", path: "/test/my-repo", name: "my-repo", addedAt: Date.now() }],
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
    useAppStore.setState({ selectedRepoId: "2" });
    rerender(<Sidebar />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/test/repo2",
        limit: 50,
      });
    });
  });

  describe("Changes view", () => {
    it("switches to changes view when Changes button is clicked", async () => {
      mockInvoke.mockResolvedValue([]);

      useAppStore.setState({
        repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
        selectedRepoId: "1",
      });

      render(<Sidebar />);

      fireEvent.click(screen.getByRole("button", { name: "Changes" }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("get_working_changes", {
          repoPath: "/test/repo",
        });
      });
    });

    it("shows changes prompt when no repo is selected in changes view", () => {
      useAppStore.setState({ viewMode: "changes" });

      render(<Sidebar />);
      
      expect(screen.getByText("Select a repository to view changes")).toBeInTheDocument();
    });

    it("shows empty state when no working changes", async () => {
      mockInvoke.mockResolvedValue([]);

      useAppStore.setState({
        repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
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
        { path: "src/App.tsx", status: "Modified", additions: 10, deletions: 5, old_path: null },
        { path: "src/new-file.ts", status: "Untracked", additions: 20, deletions: 0, old_path: null },
      ];

      mockInvoke.mockResolvedValue(mockChanges);

      useAppStore.setState({
        repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
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

    it("shows addition and deletion counts for changed files", async () => {
      const mockChanges = [
        { path: "src/App.tsx", status: "Modified", additions: 10, deletions: 5, old_path: null },
      ];

      mockInvoke.mockResolvedValue(mockChanges);

      useAppStore.setState({
        repos: [{ id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() }],
        selectedRepoId: "1",
        viewMode: "changes",
      });

      render(<Sidebar />);

      await waitFor(() => {
        expect(screen.getByText("+10")).toBeInTheDocument();
        expect(screen.getByText("-5")).toBeInTheDocument();
      });
    });
  });
});

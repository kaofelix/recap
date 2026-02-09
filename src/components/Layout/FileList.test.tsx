import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../store/appStore";
import { FileList } from "./FileList";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Regex patterns for error matching
const COMMIT_FILES_ERROR = /Error:.*Failed to get commit files/;

describe("FileList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
    });
  });

  afterEach(() => {
    useAppStore.setState({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
    });
  });

  it("shows prompt when no commit is selected", () => {
    render(<FileList />);

    expect(
      screen.getByText("Select a commit to view changed files")
    ).toBeInTheDocument();
  });

  it("shows loading state while fetching files", () => {
    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
    });

    // Make invoke hang indefinitely
    mockInvoke.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves - simulates loading state */
        })
    );

    render(<FileList />);

    expect(screen.getByText("Loading files...")).toBeInTheDocument();
  });

  it("displays changed files when loaded successfully", async () => {
    const mockFiles = [
      {
        path: "src/App.tsx",
        status: "Modified",
        additions: 10,
        deletions: 5,
        old_path: null,
      },
      {
        path: "src/components/Button.tsx",
        status: "Added",
        additions: 25,
        deletions: 0,
        old_path: null,
      },
    ];

    mockInvoke.mockResolvedValue(mockFiles);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
    });

    render(<FileList />);

    await waitFor(() => {
      // Filename is shown separately from directory
      expect(screen.getByText("App.tsx")).toBeInTheDocument();
    });

    expect(screen.getByText("Button.tsx")).toBeInTheDocument();
    expect(screen.getByText("(2 files)")).toBeInTheDocument();
  });

  it("shows file status indicators", async () => {
    const mockFiles = [
      {
        path: "added.ts",
        status: "Added",
        additions: 10,
        deletions: 0,
        old_path: null,
      },
      {
        path: "modified.ts",
        status: "Modified",
        additions: 5,
        deletions: 3,
        old_path: null,
      },
      {
        path: "deleted.ts",
        status: "Deleted",
        additions: 0,
        deletions: 20,
        old_path: null,
      },
    ];

    mockInvoke.mockResolvedValue(mockFiles);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
    });

    render(<FileList />);

    await waitFor(() => {
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("shows line counts", async () => {
    const mockFiles = [
      {
        path: "file.ts",
        status: "Modified",
        additions: 15,
        deletions: 8,
        old_path: null,
      },
    ];

    mockInvoke.mockResolvedValue(mockFiles);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
    });

    render(<FileList />);

    await waitFor(() => {
      expect(screen.getByText("+15")).toBeInTheDocument();
    });

    expect(screen.getByText("-8")).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    mockInvoke.mockRejectedValue(new Error("Failed to get commit files"));

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
    });

    render(<FileList />);

    await waitFor(() => {
      expect(screen.getByText(COMMIT_FILES_ERROR)).toBeInTheDocument();
    });
  });

  it("shows empty state when commit has no changed files", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
    });

    render(<FileList />);

    await waitFor(() => {
      expect(screen.getByText("No files changed")).toBeInTheDocument();
    });
  });

  it("calls get_commit_files with correct parameters", async () => {
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
      selectedCommitId: "def456abc",
    });

    render(<FileList />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_commit_files", {
        repoPath: "/test/my-repo",
        commitId: "def456abc",
      });
    });
  });

  it("refetches files when selected commit changes", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "commit1",
    });

    const { rerender } = render(<FileList />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_commit_files", {
        repoPath: "/test/repo",
        commitId: "commit1",
      });
    });

    // Change selected commit
    useAppStore.setState({ selectedCommitId: "commit2" });
    rerender(<FileList />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_commit_files", {
        repoPath: "/test/repo",
        commitId: "commit2",
      });
    });
  });

  it("auto-selects first file when files are loaded", async () => {
    const mockFiles = [
      {
        path: "src/first.ts",
        status: "Modified",
        additions: 5,
        deletions: 2,
        old_path: null,
      },
      {
        path: "src/second.ts",
        status: "Added",
        additions: 10,
        deletions: 0,
        old_path: null,
      },
    ];

    mockInvoke.mockResolvedValue(mockFiles);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: null,
    });

    render(<FileList />);

    await waitFor(() => {
      expect(useAppStore.getState().selectedFilePath).toBe("src/first.ts");
    });
  });

  it("does not auto-select when commit has no files", async () => {
    mockInvoke.mockResolvedValue([]);

    useAppStore.setState({
      repos: [
        { id: "1", path: "/test/repo", name: "repo", addedAt: Date.now() },
      ],
      selectedRepoId: "1",
      selectedCommitId: "abc123",
      selectedFilePath: null,
    });

    render(<FileList />);

    await waitFor(() => {
      expect(screen.getByText("No files changed")).toBeInTheDocument();
    });

    expect(useAppStore.getState().selectedFilePath).toBeNull();
  });
});

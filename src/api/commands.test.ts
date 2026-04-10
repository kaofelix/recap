import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Commit } from "../types/commit";
import type { FileContents } from "../types/diff";
import type { ChangedFile, WorkingFile } from "../types/file";
import {
  checkoutBranch,
  createCommit,
  discardFile,
  getAheadBehind,
  getCommitFiles,
  getCommitMessage,
  getCommitRangeFileContents,
  getCommitRangeFiles,
  getCurrentBranch,
  getFileContents,
  getRemoteUrl,
  getStagedFileContents,
  getUnstagedFileContents,
  getWorkingChanges,
  getWorkingFileContents,
  listAuthors,
  listBranches,
  listCommits,
  listWorktrees,
  reportFrontendError,
  rewordCommit,
  stageAll,
  stageFile,
  unstageAll,
  unstageFile,
  validateRepo,
} from "./commands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe("API commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Commits
  // ==========================================================================

  describe("listCommits", () => {
    it("calls invoke with repoPath and limit", async () => {
      const commits: Commit[] = [];
      mockInvoke.mockResolvedValue(commits);

      const result = await listCommits("/repo", { limit: 50 });

      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/repo",
        limit: 50,
      });
      expect(result).toBe(commits);
    });

    it("includes authorEmails when provided", async () => {
      mockInvoke.mockResolvedValue([]);

      await listCommits("/repo", {
        limit: 50,
        authorEmails: ["a@b.com"],
      });

      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/repo",
        limit: 50,
        authorEmails: ["a@b.com"],
      });
    });

    it("omits authorEmails when empty", async () => {
      mockInvoke.mockResolvedValue([]);

      await listCommits("/repo", { limit: 50, authorEmails: [] });

      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/repo",
        limit: 50,
      });
    });

    it("works with no options", async () => {
      mockInvoke.mockResolvedValue([]);

      await listCommits("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("list_commits", {
        repoPath: "/repo",
      });
    });
  });

  describe("getCommitFiles", () => {
    it("calls invoke with correct args", async () => {
      const files: ChangedFile[] = [];
      mockInvoke.mockResolvedValue(files);

      const result = await getCommitFiles("/repo", "abc123");

      expect(mockInvoke).toHaveBeenCalledWith("get_commit_files", {
        repoPath: "/repo",
        commitId: "abc123",
      });
      expect(result).toBe(files);
    });
  });

  describe("getCommitRangeFiles", () => {
    it("calls invoke with correct args", async () => {
      const files: ChangedFile[] = [];
      mockInvoke.mockResolvedValue(files);

      const result = await getCommitRangeFiles("/repo", ["a", "b"]);

      expect(mockInvoke).toHaveBeenCalledWith("get_commit_range_files", {
        repoPath: "/repo",
        commitIds: ["a", "b"],
      });
      expect(result).toBe(files);
    });
  });

  describe("getCommitMessage", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue("fix: a bug");

      const result = await getCommitMessage("/repo", "abc123");

      expect(mockInvoke).toHaveBeenCalledWith("get_commit_message", {
        repoPath: "/repo",
        commitId: "abc123",
      });
      expect(result).toBe("fix: a bug");
    });
  });

  describe("rewordCommit", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await rewordCommit("/repo", "abc123", "new message");

      expect(mockInvoke).toHaveBeenCalledWith("reword_commit", {
        repoPath: "/repo",
        commitId: "abc123",
        newMessage: "new message",
      });
    });
  });

  describe("createCommit", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await createCommit("/repo", "initial commit");

      expect(mockInvoke).toHaveBeenCalledWith("create_commit", {
        repoPath: "/repo",
        message: "initial commit",
      });
    });
  });

  // ==========================================================================
  // File contents
  // ==========================================================================

  describe("getFileContents", () => {
    it("calls invoke with correct args", async () => {
      const contents: FileContents = {
        old_content: "old",
        new_content: "new",
        is_binary: false,
      };
      mockInvoke.mockResolvedValue(contents);

      const result = await getFileContents("/repo", "abc123", "src/file.ts");

      expect(mockInvoke).toHaveBeenCalledWith("get_file_contents", {
        repoPath: "/repo",
        commitId: "abc123",
        filePath: "src/file.ts",
      });
      expect(result).toBe(contents);
    });
  });

  describe("getCommitRangeFileContents", () => {
    it("calls invoke with correct args", async () => {
      const contents: FileContents = {
        old_content: null,
        new_content: "new",
        is_binary: false,
      };
      mockInvoke.mockResolvedValue(contents);

      const result = await getCommitRangeFileContents(
        "/repo",
        ["a", "b"],
        "src/file.ts"
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        "get_commit_range_file_contents",
        {
          repoPath: "/repo",
          commitIds: ["a", "b"],
          filePath: "src/file.ts",
        }
      );
      expect(result).toBe(contents);
    });
  });

  describe("getStagedFileContents", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue({
        old_content: null,
        new_content: "staged",
        is_binary: false,
      });

      await getStagedFileContents("/repo", "file.ts");

      expect(mockInvoke).toHaveBeenCalledWith("get_staged_file_contents", {
        repoPath: "/repo",
        filePath: "file.ts",
      });
    });
  });

  describe("getUnstagedFileContents", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue({
        old_content: null,
        new_content: "unstaged",
        is_binary: false,
      });

      await getUnstagedFileContents("/repo", "file.ts");

      expect(mockInvoke).toHaveBeenCalledWith("get_unstaged_file_contents", {
        repoPath: "/repo",
        filePath: "file.ts",
      });
    });
  });

  describe("getWorkingFileContents", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue({
        old_content: null,
        new_content: "working",
        is_binary: false,
      });

      await getWorkingFileContents("/repo", "file.ts");

      expect(mockInvoke).toHaveBeenCalledWith("get_working_file_contents", {
        repoPath: "/repo",
        filePath: "file.ts",
      });
    });
  });

  // ==========================================================================
  // Working changes
  // ==========================================================================

  describe("getWorkingChanges", () => {
    it("calls invoke with correct args", async () => {
      const changes: WorkingFile[] = [];
      mockInvoke.mockResolvedValue(changes);

      const result = await getWorkingChanges("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("get_working_changes_ex", {
        repoPath: "/repo",
      });
      expect(result).toBe(changes);
    });
  });

  describe("stageFile", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await stageFile("/repo", "src/file.ts");

      expect(mockInvoke).toHaveBeenCalledWith("stage_file", {
        repoPath: "/repo",
        filePath: "src/file.ts",
      });
    });
  });

  describe("unstageFile", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await unstageFile("/repo", "src/file.ts");

      expect(mockInvoke).toHaveBeenCalledWith("unstage_file", {
        repoPath: "/repo",
        filePath: "src/file.ts",
      });
    });
  });

  describe("discardFile", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await discardFile("/repo", "src/file.ts");

      expect(mockInvoke).toHaveBeenCalledWith("discard_file", {
        repoPath: "/repo",
        filePath: "src/file.ts",
      });
    });
  });

  describe("stageAll", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await stageAll("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("stage_all", {
        repoPath: "/repo",
      });
    });
  });

  describe("unstageAll", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await unstageAll("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("unstage_all", {
        repoPath: "/repo",
      });
    });
  });

  // ==========================================================================
  // Branches
  // ==========================================================================

  describe("getCurrentBranch", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue("main");

      const result = await getCurrentBranch("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("get_current_branch", {
        repoPath: "/repo",
      });
      expect(result).toBe("main");
    });
  });

  describe("getAheadBehind", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue({ ahead: 2, behind: 1 });

      const result = await getAheadBehind("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("get_ahead_behind", {
        repoPath: "/repo",
      });
      expect(result).toEqual({ ahead: 2, behind: 1 });
    });
  });

  describe("listBranches", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue([]);

      await listBranches("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("list_branches", {
        repoPath: "/repo",
      });
    });
  });

  describe("checkoutBranch", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await checkoutBranch("/repo", "feature-branch");

      expect(mockInvoke).toHaveBeenCalledWith("checkout_branch", {
        repoPath: "/repo",
        branchName: "feature-branch",
      });
    });
  });

  // ==========================================================================
  // Repository
  // ==========================================================================

  describe("validateRepo", () => {
    it("calls invoke with correct args", async () => {
      const info = {
        path: "/repo",
        name: "repo",
        branch: "main",
        canonical_path: "/repo",
        selected_worktree_path: "/repo",
        is_linked_worktree: false,
      };
      mockInvoke.mockResolvedValue(info);

      const result = await validateRepo("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("validate_repo", {
        path: "/repo",
      });
      expect(result).toBe(info);
    });
  });

  describe("listWorktrees", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue([]);

      await listWorktrees("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("list_worktrees", {
        repoPath: "/repo",
      });
    });
  });

  describe("getRemoteUrl", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue("https://github.com/user/repo.git");

      const result = await getRemoteUrl("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("get_remote_url", {
        repoPath: "/repo",
      });
      expect(result).toBe("https://github.com/user/repo.git");
    });
  });

  describe("listAuthors", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue([]);

      await listAuthors("/repo");

      expect(mockInvoke).toHaveBeenCalledWith("list_authors", {
        repoPath: "/repo",
      });
    });
  });

  // ==========================================================================
  // System
  // ==========================================================================

  describe("reportFrontendError", () => {
    it("calls invoke with correct args", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const report = {
        source: "test",
        message: "error",
        timestamp: "2024-01-01T00:00:00.000Z",
      };

      await reportFrontendError(report);

      expect(mockInvoke).toHaveBeenCalledWith("report_frontend_error", {
        report,
      });
    });
  });
});

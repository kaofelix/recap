/**
 * Typed API layer over Tauri invoke calls.
 *
 * All backend commands are wrapped here with proper TypeScript types
 * for arguments and return values. No component or hook should call
 * `invoke()` directly — use these functions instead.
 */
import { invoke } from "@tauri-apps/api/core";
import type { Branch } from "../types/branch";
import type { Commit } from "../types/commit";
import type { FileContents } from "../types/diff";
import type { ChangedFile, WorkingFile } from "../types/file";
import type { WorktreeInfo } from "../types/worktree";

// ============================================================================
// Types used by API layer (not shared elsewhere)
// ============================================================================

export interface AheadBehind {
  ahead: number;
  behind: number;
}

export interface RepoInfo {
  path: string;
  name: string;
  branch: string;
  canonical_path: string;
  selected_worktree_path: string;
  is_linked_worktree: boolean;
}

export interface AuthorInfo {
  name: string;
  email: string;
  commit_count: number;
  last_commit_timestamp: number;
}

export interface FrontendErrorReport {
  source: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
}

// ============================================================================
// Commits
// ============================================================================

export async function listCommits(
  repoPath: string,
  opts?: { limit?: number; authorEmails?: string[] }
): Promise<Commit[]> {
  const args: Record<string, unknown> = { repoPath };
  if (opts?.limit !== undefined) {
    args.limit = opts.limit;
  }
  if (opts?.authorEmails && opts.authorEmails.length > 0) {
    args.authorEmails = opts.authorEmails;
  }
  return invoke<Commit[]>("list_commits", args);
}

export async function getCommitFiles(
  repoPath: string,
  commitId: string
): Promise<ChangedFile[]> {
  return invoke<ChangedFile[]>("get_commit_files", { repoPath, commitId });
}

export async function getCommitRangeFiles(
  repoPath: string,
  commitIds: string[]
): Promise<ChangedFile[]> {
  return invoke<ChangedFile[]>("get_commit_range_files", {
    repoPath,
    commitIds,
  });
}

export async function getCommitMessage(
  repoPath: string,
  commitId: string
): Promise<string> {
  return invoke<string>("get_commit_message", { repoPath, commitId });
}

export async function rewordCommit(
  repoPath: string,
  commitId: string,
  newMessage: string
): Promise<void> {
  return invoke<void>("reword_commit", { repoPath, commitId, newMessage });
}

export async function createCommit(
  repoPath: string,
  message: string
): Promise<void> {
  return invoke<void>("create_commit", { repoPath, message });
}

// ============================================================================
// File contents (for diffs)
// ============================================================================

export async function getFileContents(
  repoPath: string,
  commitId: string,
  filePath: string
): Promise<FileContents> {
  return invoke<FileContents>("get_file_contents", {
    repoPath,
    commitId,
    filePath,
  });
}

export async function getCommitRangeFileContents(
  repoPath: string,
  commitIds: string[],
  filePath: string
): Promise<FileContents> {
  return invoke<FileContents>("get_commit_range_file_contents", {
    repoPath,
    commitIds,
    filePath,
  });
}

export async function getStagedFileContents(
  repoPath: string,
  filePath: string
): Promise<FileContents> {
  return invoke<FileContents>("get_staged_file_contents", {
    repoPath,
    filePath,
  });
}

export async function getUnstagedFileContents(
  repoPath: string,
  filePath: string
): Promise<FileContents> {
  return invoke<FileContents>("get_unstaged_file_contents", {
    repoPath,
    filePath,
  });
}

export async function getWorkingFileContents(
  repoPath: string,
  filePath: string
): Promise<FileContents> {
  return invoke<FileContents>("get_working_file_contents", {
    repoPath,
    filePath,
  });
}

// ============================================================================
// Working changes
// ============================================================================

export async function getWorkingChanges(
  repoPath: string
): Promise<WorkingFile[]> {
  return invoke<WorkingFile[]>("get_working_changes_ex", { repoPath });
}

export async function stageFile(
  repoPath: string,
  filePath: string
): Promise<void> {
  return invoke<void>("stage_file", { repoPath, filePath });
}

export async function unstageFile(
  repoPath: string,
  filePath: string
): Promise<void> {
  return invoke<void>("unstage_file", { repoPath, filePath });
}

export async function discardFile(
  repoPath: string,
  filePath: string
): Promise<void> {
  return invoke<void>("discard_file", { repoPath, filePath });
}

export async function stageAll(repoPath: string): Promise<void> {
  return invoke<void>("stage_all", { repoPath });
}

export async function unstageAll(repoPath: string): Promise<void> {
  return invoke<void>("unstage_all", { repoPath });
}

// ============================================================================
// Branches
// ============================================================================

export async function getCurrentBranch(repoPath: string): Promise<string> {
  return invoke<string>("get_current_branch", { repoPath });
}

export async function getAheadBehind(repoPath: string): Promise<AheadBehind> {
  return invoke<AheadBehind>("get_ahead_behind", { repoPath });
}

export async function listBranches(repoPath: string): Promise<Branch[]> {
  return invoke<Branch[]>("list_branches", { repoPath });
}

export async function listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
  return invoke<WorktreeInfo[]>("list_worktrees", { repoPath });
}

export async function checkoutBranch(
  repoPath: string,
  branchName: string
): Promise<void> {
  return invoke<void>("checkout_branch", { repoPath, branchName });
}

// ============================================================================
// Repository
// ============================================================================

export async function validateRepo(path: string): Promise<RepoInfo> {
  return invoke<RepoInfo>("validate_repo", { path });
}

export async function getRemoteUrl(repoPath: string): Promise<string> {
  return invoke<string>("get_remote_url", { repoPath });
}

export async function listAuthors(repoPath: string): Promise<AuthorInfo[]> {
  return invoke<AuthorInfo[]>("list_authors", { repoPath });
}

// ============================================================================
// System
// ============================================================================

export async function reportFrontendError(
  report: FrontendErrorReport
): Promise<void> {
  return invoke<void>("report_frontend_error", { report });
}

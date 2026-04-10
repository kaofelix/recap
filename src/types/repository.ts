export interface Repository {
  id: string;
  /** Effective path for git operations: the active worktree path. */
  path: string;
  /** Stable repository identity shared across all worktrees. */
  canonicalPath?: string;
  name: string;
  addedAt: number;
}

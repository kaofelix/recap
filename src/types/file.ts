/**
 * Status of a file in a commit or working directory.
 * Mirrors the Rust FileStatus enum from the backend.
 */
export type FileStatus =
  | "Added"
  | "Modified"
  | "Deleted"
  | "Renamed"
  | "Copied"
  | "Unmodified"
  | "Untracked";

/**
 * Represents a changed file in a commit.
 * Mirrors the Rust ChangedFile struct from the backend.
 */
export interface ChangedFile {
  /** Path to the file */
  path: string;
  /** Status of the file change */
  status: FileStatus;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Original path for renamed files */
  old_path: string | null;
}

/**
 * Section type for working directory files.
 * Indicates whether a file entry represents staged or unstaged changes.
 */
export type WorkingFileSection = "staged" | "unstaged";

/**
 * Represents a file in the working directory with separate staged and unstaged status.
 * Mirrors the Rust WorkingFile struct from the backend.
 * A file can appear twice (once per section) if it has both staged and unstaged changes.
 */
export interface WorkingFile {
  /** Path to the file */
  path: string;
  /** Status in the staging area (index), null if not staged */
  staged_status: FileStatus | null;
  /** Status in the working directory, null if no unstaged changes */
  unstaged_status: FileStatus | null;
  /** Number of staged additions */
  staged_additions: number;
  /** Number of staged deletions */
  staged_deletions: number;
  /** Number of unstaged additions */
  unstaged_additions: number;
  /** Number of unstaged deletions */
  unstaged_deletions: number;
  /** Original path for renamed files */
  old_path: string | null;
  /** Which section this entry belongs to */
  section: WorkingFileSection;
}

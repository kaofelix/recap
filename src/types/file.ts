/**
 * Status of a file in a commit.
 * Mirrors the Rust FileStatus enum from the backend.
 */
export type FileStatus =
  | "Added"
  | "Modified"
  | "Deleted"
  | "Renamed"
  | "Copied"
  | "Unmodified";

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

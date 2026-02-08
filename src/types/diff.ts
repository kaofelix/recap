/**
 * Type of diff line.
 * Mirrors the Rust LineType enum from the backend.
 */
export type LineType = "Context" | "Addition" | "Deletion";

/**
 * A single line in a diff.
 * Mirrors the Rust DiffLine struct from the backend.
 */
export interface DiffLine {
  /** The content of the line (without leading +/- marker) */
  content: string;
  /** The type of line */
  line_type: LineType;
  /** Line number in the old file (if applicable) */
  old_line_no: number | null;
  /** Line number in the new file (if applicable) */
  new_line_no: number | null;
}

/**
 * A hunk in a diff.
 * Mirrors the Rust DiffHunk struct from the backend.
 */
export interface DiffHunk {
  /** Starting line in old file */
  old_start: number;
  /** Number of lines in old file */
  old_lines: number;
  /** Starting line in new file */
  new_start: number;
  /** Number of lines in new file */
  new_lines: number;
  /** Lines in this hunk */
  lines: DiffLine[];
}

/**
 * The complete diff for a file.
 * Mirrors the Rust FileDiff struct from the backend.
 */
export interface FileDiff {
  /** Original path (for renames) */
  old_path: string | null;
  /** New/current path */
  new_path: string;
  /** Hunks in the diff */
  hunks: DiffHunk[];
  /** Whether this is a binary file */
  is_binary: boolean;
}

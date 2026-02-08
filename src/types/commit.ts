/**
 * Represents a git commit with essential metadata.
 * Mirrors the Rust Commit struct from the backend.
 */
export interface Commit {
  /** The SHA hash of the commit */
  id: string;
  /** The first line of the commit message */
  message: string;
  /** The author's name */
  author: string;
  /** The author's email */
  email: string;
  /** Unix timestamp of when the commit was authored */
  timestamp: number;
}

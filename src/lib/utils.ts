import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind CSS conflict resolution.
 * Combines clsx for conditional classes with tailwind-merge for deduplication.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Split a file path into directory and filename parts.
 * Returns { dir, filename } where dir includes the trailing slash.
 */
export function splitPath(path: string): { dir: string; filename: string } {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) {
    return { dir: "", filename: path };
  }
  return {
    dir: path.slice(0, lastSlash + 1),
    filename: path.slice(lastSlash + 1),
  };
}

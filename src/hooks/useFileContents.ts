import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { FileContents } from "../types/diff";
import type { Repository } from "../types/repository";

interface UseFileContentsResult {
  contents: FileContents | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch file contents for diffing, abstracting away the source.
 * Works for both commit-based diffs (history mode) and working directory diffs (changes mode).
 *
 * @param repo - The repository to fetch from
 * @param filePath - The file path to fetch
 * @param commitId - If provided, fetch from this commit. If null, fetch from working directory.
 */
export function useFileContents(
  repo: Repository | null,
  filePath: string | null,
  commitId: string | null
): UseFileContentsResult {
  const [contents, setContents] = useState<FileContents | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use repo.path for dependency to avoid object reference issues
  const repoPath = repo?.path ?? null;

  useEffect(() => {
    if (!(repoPath && filePath)) {
      setContents(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchContents = async (): Promise<FileContents> => {
      if (commitId) {
        return invoke<FileContents>("get_file_contents", {
          repoPath,
          commitId,
          filePath,
        });
      }
      return invoke<FileContents>("get_working_file_contents", {
        repoPath,
        filePath,
      });
    };

    fetchContents()
      .then((result) => {
        if (!cancelled) {
          setContents(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repoPath, filePath, commitId]);

  return { contents, isLoading, error };
}

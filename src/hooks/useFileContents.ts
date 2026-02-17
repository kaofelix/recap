import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import type { FileContents } from "../types/diff";
import type { Repository } from "../types/repository";

interface UseFileContentsResult {
  contents: FileContents | null;
  isLoading: boolean;
  error: string | null;
}

const DIFF_FETCH_DEBOUNCE_MS = 120;
const EMPTY_COMMIT_IDS: string[] = [];

/**
 * Fetch file contents for diffing, abstracting away the source.
 * Works for both commit-based diffs (history mode) and working directory diffs (changes mode).
 *
 * @param repo - The repository to fetch from
 * @param filePath - The file path to fetch
 * @param commitId - If provided, fetch from this commit. If null, fetch from working directory.
 * @param commitIds - Optional commit selection (single or range) for history mode.
 */
export function useFileContents(
  repo: Repository | null,
  filePath: string | null,
  commitId: string | null,
  commitIds: string[] = EMPTY_COMMIT_IDS
): UseFileContentsResult {
  const [contents, setContents] = useState<FileContents | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousTargetRef = useRef<string | null>(null);

  // Use repo.path for dependency to avoid object reference issues
  const repoPath = repo?.path ?? null;

  useEffect(() => {
    if (!(repoPath && filePath)) {
      previousTargetRef.current = null;
      setContents(null);
      setError(null);
      return;
    }

    let activeCommitIds: string[] = [];
    if (commitIds.length > 0) {
      activeCommitIds = commitIds;
    } else if (commitId) {
      activeCommitIds = [commitId];
    }

    const commitKey =
      activeCommitIds.length > 0 ? activeCommitIds.join("::") : "working";

    const targetKey = `${repoPath}::${commitKey}::${filePath}`;
    const shouldDebounce =
      previousTargetRef.current !== null &&
      previousTargetRef.current !== targetKey;
    previousTargetRef.current = targetKey;

    let cancelled = false;
    let timeoutId: number | null = null;

    setIsLoading(true);
    setError(null);

    const fetchContents = async (): Promise<FileContents> => {
      if (activeCommitIds.length > 1) {
        return invoke<FileContents>("get_commit_range_file_contents", {
          repoPath,
          commitIds: activeCommitIds,
          filePath,
        });
      }

      if (activeCommitIds.length === 1) {
        return invoke<FileContents>("get_file_contents", {
          repoPath,
          commitId: activeCommitIds[0],
          filePath,
        });
      }

      return invoke<FileContents>("get_working_file_contents", {
        repoPath,
        filePath,
      });
    };

    const runFetch = () => {
      fetchContents()
        .then((result) => {
          if (!cancelled) {
            setContents(result);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setContents(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    };

    if (shouldDebounce) {
      timeoutId = window.setTimeout(runFetch, DIFF_FETCH_DEBOUNCE_MS);
    } else {
      runFetch();
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [repoPath, filePath, commitId, commitIds]);

  return { contents, isLoading, error };
}

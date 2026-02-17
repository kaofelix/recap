import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import type { Commit } from "../types/commit";
import type { Repository } from "../types/repository";

interface UseCommitsResult {
  commits: Commit[];
  isLoading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Fetch commits for a repository with background polling when active.
 */
export function useCommits(
  selectedRepo: Repository | null,
  isActive: boolean
): UseCommitsResult {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCommits = useCallback(
    async (isInitialLoad: boolean) => {
      if (!selectedRepo) {
        return;
      }

      // Only show loading state for initial load, not background polling.
      if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await invoke<Commit[]>("list_commits", {
          repoPath: selectedRepo.path,
          limit: 50,
        });

        setCommits(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setCommits([]);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    },
    [selectedRepo]
  );

  useEffect(() => {
    if (!(selectedRepo && isActive)) {
      setCommits([]);
      setError(null);
      return;
    }

    fetchCommits(true);

    const intervalId = setInterval(() => fetchCommits(false), POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchCommits, isActive, selectedRepo]);

  return { commits, isLoading, error };
}

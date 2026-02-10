import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { Commit } from "../types/commit";
import type { Repository } from "../types/repository";

interface UseCommitsResult {
  commits: Commit[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetch commits for a repository when in history mode.
 */
export function useCommits(
  selectedRepo: Repository | null,
  isActive: boolean
): UseCommitsResult {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!(selectedRepo && isActive)) {
      setCommits([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchCommits() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<Commit[]>("list_commits", {
          repoPath: selectedRepo?.path,
          limit: 50,
        });

        if (!cancelled) {
          setCommits(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setCommits([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCommits();

    return () => {
      cancelled = true;
    };
  }, [selectedRepo, isActive]);

  return { commits, isLoading, error };
}

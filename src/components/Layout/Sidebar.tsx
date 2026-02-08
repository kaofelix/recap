import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/utils";
import { useSelectedRepo } from "../../store/appStore";
import type { Commit } from "../../types/commit";

export interface SidebarProps {
  className?: string;
}

/**
 * Format a Unix timestamp as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
}

/**
 * Shorten a commit SHA to 7 characters
 */
function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function Sidebar({ className }: SidebarProps) {
  const selectedRepo = useSelectedRepo();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRepo) {
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
          repoPath: selectedRepo!.path,
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
  }, [selectedRepo]);

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        "bg-panel-bg",
        className
      )}
    >
      <div
        className={cn(
          "h-10 flex items-center px-3",
          "border-b border-panel-border",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="text-sm font-semibold text-text-primary">Commits</h2>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {!selectedRepo && (
          <div className="text-sm text-text-secondary text-center py-8">
            Select a repository to view commits
          </div>
        )}

        {selectedRepo && isLoading && (
          <div className="text-sm text-text-secondary text-center py-8">
            Loading commits...
          </div>
        )}

        {selectedRepo && error && (
          <div className="text-sm text-red-500 text-center py-8">
            Error: {error}
          </div>
        )}

        {selectedRepo && !isLoading && !error && commits.length === 0 && (
          <div className="text-sm text-text-secondary text-center py-8">
            No commits found
          </div>
        )}

        {!isLoading && !error && commits.length > 0 && (
          <div className="space-y-1">
            {commits.map((commit, index) => (
              <div
                key={commit.id}
                className={cn(
                  "p-2 rounded cursor-pointer",
                  "hover:bg-bg-hover",
                  index === 0 && "bg-accent-muted"
                )}
              >
                <div className="text-sm font-medium text-text-primary truncate">
                  {commit.message}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {shortSha(commit.id)} · {formatRelativeTime(commit.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

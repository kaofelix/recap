import { invoke } from "@tauri-apps/api/core";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useSelectedCommitId,
  useSelectedFilePath,
  useSelectedRepo,
  useViewMode,
} from "../../store/appStore";
import type { Commit } from "../../types/commit";
import type { ChangedFile } from "../../types/file";
import { FileListItem } from "./FileListItem";

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
  const selectedCommitId = useSelectedCommitId();
  const selectedFilePath = useSelectedFilePath();
  const viewMode = useViewMode();
  const selectCommit = useAppStore((state) => state.selectCommit);
  const selectFile = useAppStore((state) => state.selectFile);
  const setViewMode = useAppStore((state) => state.setViewMode);

  // History mode state
  const [commits, setCommits] = useState<Commit[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [commitsError, setCommitsError] = useState<string | null>(null);

  // Changes mode state
  const [changes, setChanges] = useState<ChangedFile[]>([]);
  const [isLoadingChanges, setIsLoadingChanges] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);

  // Fetch commits for history mode
  useEffect(() => {
    if (!selectedRepo || viewMode !== "history") {
      setCommits([]);
      setCommitsError(null);
      return;
    }

    let cancelled = false;

    async function fetchCommits() {
      setIsLoadingCommits(true);
      setCommitsError(null);

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
          setCommitsError(err instanceof Error ? err.message : String(err));
          setCommits([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCommits(false);
        }
      }
    }

    fetchCommits();

    return () => {
      cancelled = true;
    };
  }, [selectedRepo, viewMode]);

  // Fetch changes for changes mode with polling
  useEffect(() => {
    if (!selectedRepo || viewMode !== "changes") {
      setChanges([]);
      setChangesError(null);
      return;
    }

    let cancelled = false;

    async function fetchChanges() {
      setIsLoadingChanges(true);
      setChangesError(null);

      try {
        const result = await invoke<ChangedFile[]>("get_working_changes", {
          repoPath: selectedRepo?.path,
        });

        if (!cancelled) {
          setChanges(result);
        }
      } catch (err) {
        if (!cancelled) {
          setChangesError(err instanceof Error ? err.message : String(err));
          setChanges([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingChanges(false);
        }
      }
    }

    // Initial fetch
    fetchChanges();

    // Poll every 2 seconds
    const intervalId = setInterval(fetchChanges, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedRepo, viewMode]);

  const isLoading =
    viewMode === "history" ? isLoadingCommits : isLoadingChanges;
  const error = viewMode === "history" ? commitsError : changesError;

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      {/* Header with view mode toggle */}
      <div
        className={cn(
          "flex h-10 items-center px-2",
          "border-panel-border border-b",
          "bg-panel-header-bg"
        )}
      >
        <div className="flex gap-1">
          <button
            className={cn(
              "rounded px-3 py-1 font-medium text-sm transition-colors",
              viewMode === "history"
                ? "bg-accent-muted text-text-primary"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
            onClick={() => setViewMode("history")}
            type="button"
          >
            History
          </button>
          <button
            className={cn(
              "rounded px-3 py-1 font-medium text-sm transition-colors",
              viewMode === "changes"
                ? "bg-accent-muted text-text-primary"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            )}
            onClick={() => setViewMode("changes")}
            type="button"
          >
            Changes
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-2">
        {!selectedRepo && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Select a repository to view{" "}
            {viewMode === "history" ? "commits" : "changes"}
          </div>
        )}

        {selectedRepo && isLoading && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Loading {viewMode === "history" ? "commits" : "changes"}...
          </div>
        )}

        {selectedRepo && error && (
          <div className="py-8 text-center text-red-500 text-sm">
            Error: {error}
          </div>
        )}

        {/* History mode: commit list */}
        {viewMode === "history" &&
          selectedRepo &&
          !isLoading &&
          !error &&
          commits.length === 0 && (
            <div className="py-8 text-center text-sm text-text-secondary">
              No commits found
            </div>
          )}

        {viewMode === "history" &&
          !isLoading &&
          !error &&
          commits.length > 0 && (
            <div className="space-y-1">
              {commits.map((commit) => (
                <button
                  className={cn(
                    "w-full cursor-pointer rounded p-2 text-left",
                    "hover:bg-bg-hover",
                    selectedCommitId === commit.id && "bg-accent-muted"
                  )}
                  key={commit.id}
                  onClick={() => selectCommit(commit.id)}
                  type="button"
                >
                  <div className="truncate font-medium text-sm text-text-primary">
                    {commit.message}
                  </div>
                  <div className="mt-0.5 text-text-secondary text-xs">
                    {shortSha(commit.id)} ·{" "}
                    {formatRelativeTime(commit.timestamp)}
                  </div>
                </button>
              ))}
            </div>
          )}

        {/* Changes mode: file list */}
        {viewMode === "changes" &&
          selectedRepo &&
          !isLoading &&
          !error &&
          changes.length === 0 && (
            <div className="py-8 text-center text-sm text-text-secondary">
              No changes here... ✓
            </div>
          )}

        {viewMode === "changes" &&
          !isLoading &&
          !error &&
          changes.length > 0 && (
            <div className="space-y-0.5">
              {changes.map((file) => (
                <FileListItem
                  file={file}
                  isSelected={selectedFilePath === file.path}
                  key={file.path}
                  onClick={() => selectFile(file.path)}
                />
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

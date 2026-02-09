import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useSelectedRepo,
  useSelectedCommitId,
  useViewMode,
  useSelectedFilePath,
} from "../../store/appStore";
import type { Commit } from "../../types/commit";
import type { ChangedFile } from "../../types/file";

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

/**
 * Get a short status indicator for a file
 */
function getStatusIndicator(status: ChangedFile["status"]): string {
  switch (status) {
    case "Added":
      return "A";
    case "Modified":
      return "M";
    case "Deleted":
      return "D";
    case "Renamed":
      return "R";
    case "Copied":
      return "C";
    case "Untracked":
      return "?";
    default:
      return "";
  }
}

/**
 * Get the color class for a file status
 */
function getStatusColor(status: ChangedFile["status"]): string {
  switch (status) {
    case "Added":
    case "Untracked":
      return "text-green-500";
    case "Modified":
      return "text-yellow-500";
    case "Deleted":
      return "text-red-500";
    case "Renamed":
    case "Copied":
      return "text-blue-500";
    default:
      return "text-text-secondary";
  }
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
          repoPath: selectedRepo!.path,
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

  // Fetch changes for changes mode
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
          repoPath: selectedRepo!.path,
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

    fetchChanges();

    return () => {
      cancelled = true;
    };
  }, [selectedRepo, viewMode]);

  const isLoading = viewMode === "history" ? isLoadingCommits : isLoadingChanges;
  const error = viewMode === "history" ? commitsError : changesError;

  return (
    <div
      className={cn(
        "h-full flex flex-col",
        "bg-panel-bg",
        className
      )}
    >
      {/* Header with view mode toggle */}
      <div
        className={cn(
          "h-10 flex items-center px-2",
          "border-b border-panel-border",
          "bg-panel-header-bg"
        )}
      >
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("history")}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded transition-colors",
              viewMode === "history"
                ? "bg-accent-muted text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
          >
            History
          </button>
          <button
            onClick={() => setViewMode("changes")}
            className={cn(
              "px-3 py-1 text-sm font-medium rounded transition-colors",
              viewMode === "changes"
                ? "bg-accent-muted text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
          >
            Changes
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-2">
        {!selectedRepo && (
          <div className="text-sm text-text-secondary text-center py-8">
            Select a repository to view {viewMode === "history" ? "commits" : "changes"}
          </div>
        )}

        {selectedRepo && isLoading && (
          <div className="text-sm text-text-secondary text-center py-8">
            Loading {viewMode === "history" ? "commits" : "changes"}...
          </div>
        )}

        {selectedRepo && error && (
          <div className="text-sm text-red-500 text-center py-8">
            Error: {error}
          </div>
        )}

        {/* History mode: commit list */}
        {viewMode === "history" && selectedRepo && !isLoading && !error && commits.length === 0 && (
          <div className="text-sm text-text-secondary text-center py-8">
            No commits found
          </div>
        )}

        {viewMode === "history" && !isLoading && !error && commits.length > 0 && (
          <div className="space-y-1">
            {commits.map((commit) => (
              <div
                key={commit.id}
                onClick={() => selectCommit(commit.id)}
                className={cn(
                  "p-2 rounded cursor-pointer",
                  "hover:bg-bg-hover",
                  selectedCommitId === commit.id && "bg-accent-muted"
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

        {/* Changes mode: file list */}
        {viewMode === "changes" && selectedRepo && !isLoading && !error && changes.length === 0 && (
          <div className="text-sm text-text-secondary text-center py-8">
            No changes here... ✓
          </div>
        )}

        {viewMode === "changes" && !isLoading && !error && changes.length > 0 && (
          <div className="space-y-1">
            {changes.map((file) => (
              <div
                key={file.path}
                onClick={() => selectFile(file.path)}
                className={cn(
                  "p-2 rounded cursor-pointer",
                  "hover:bg-bg-hover",
                  selectedFilePath === file.path && "bg-accent-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-mono font-bold", getStatusColor(file.status))}>
                    {getStatusIndicator(file.status)}
                  </span>
                  <span className="text-sm text-text-primary truncate flex-1">
                    {file.path}
                  </span>
                </div>
                {(file.additions > 0 || file.deletions > 0) && (
                  <div className="text-xs text-text-secondary mt-0.5 ml-5">
                    <span className="text-green-500">+{file.additions}</span>
                    {" "}
                    <span className="text-red-500">-{file.deletions}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { formatDistanceToNow } from "date-fns";
import { useCommits } from "../../hooks/useCommits";
import { useWorkingChanges } from "../../hooks/useWorkingChanges";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useSelectedCommitId,
  useSelectedFilePath,
  useSelectedRepo,
  useViewMode,
} from "../../store/appStore";
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

  const {
    commits,
    isLoading: isLoadingCommits,
    error: commitsError,
  } = useCommits(selectedRepo, viewMode === "history");

  const {
    changes,
    isLoading: isLoadingChanges,
    error: changesError,
  } = useWorkingChanges(selectedRepo, viewMode === "changes");

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

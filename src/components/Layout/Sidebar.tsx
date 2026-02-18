import { formatDistanceToNow } from "date-fns";
import { type MouseEvent, useCallback, useEffect, useRef } from "react";
import { useIsFocused } from "../../context/FocusContext";
import { useCommits } from "../../hooks/useCommits";
import { useNavigableList } from "../../hooks/useNavigableList";
import { useWorkingChanges } from "../../hooks/useWorkingChanges";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useSelectedCommitId,
  useSelectedCommitIds,
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

function getCommitRangeSelection(
  commitIds: string[],
  startId: string,
  endId: string
): string[] {
  const startIndex = commitIds.indexOf(startId);
  const endIndex = commitIds.indexOf(endId);

  if (startIndex === -1 || endIndex === -1) {
    return [endId];
  }

  const from = Math.min(startIndex, endIndex);
  const to = Math.max(startIndex, endIndex);

  return commitIds.slice(from, to + 1);
}

export function Sidebar({ className }: SidebarProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedCommitIds = useSelectedCommitIds();
  const selectedFilePath = useSelectedFilePath();
  const viewMode = useViewMode();
  const selectCommit = useAppStore((state) => state.selectCommit);
  const selectCommitRange = useAppStore((state) => state.selectCommitRange);
  const toggleCommitSelection = useAppStore(
    (state) => state.toggleCommitSelection
  );
  const selectFile = useAppStore((state) => state.selectFile);
  const setViewMode = useAppStore((state) => state.setViewMode);

  const {
    commits,
    isLoading: isLoadingCommits,
    error: commitsError,
  } = useCommits(selectedRepo, !!selectedRepo);

  const {
    changes,
    isLoading: isLoadingChanges,
    error: changesError,
  } = useWorkingChanges(selectedRepo, viewMode === "changes");

  const isLoading =
    viewMode === "history" ? isLoadingCommits : isLoadingChanges;
  const error = viewMode === "history" ? commitsError : changesError;

  const isFocused = useIsFocused();

  // Auto-select first commit when selected commit doesn't exist in the list
  useEffect(() => {
    if (viewMode !== "history" || isLoadingCommits || commitsError) {
      return;
    }
    if (commits.length === 0) {
      return;
    }

    const hasValidSelection =
      selectedCommitIds.length > 0 &&
      selectedCommitIds.every((id) =>
        commits.some((commit) => commit.id === id)
      );

    if (!hasValidSelection) {
      selectCommit(commits[0].id);
      commitSelectionAnchorRef.current = commits[0].id;
    }
  }, [
    commits,
    selectedCommitIds,
    selectCommit,
    viewMode,
    isLoadingCommits,
    commitsError,
  ]);

  const commitSelectionAnchorRef = useRef<string | null>(null);

  const handleSelectItem = useCallback(
    (id: string) => {
      if (viewMode === "history") {
        commitSelectionAnchorRef.current = id;
        selectCommit(id);
      } else {
        selectFile(id);
      }
    },
    [viewMode, selectCommit, selectFile]
  );

  const commitIds = commits.map((commit) => commit.id);

  const handleCommitClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, commitId: string) => {
      const isToggle = event.metaKey || event.ctrlKey;
      const isRange = event.shiftKey;

      if (isRange) {
        const anchorId =
          commitSelectionAnchorRef.current ?? selectedCommitIds[0] ?? commitId;
        const range = getCommitRangeSelection(commitIds, anchorId, commitId);
        selectCommitRange(range);
        return;
      }

      commitSelectionAnchorRef.current = commitId;

      if (isToggle) {
        toggleCommitSelection(commitId);
        return;
      }

      selectCommit(commitId);
    },
    [
      commitIds,
      selectedCommitIds,
      selectCommit,
      selectCommitRange,
      toggleCommitSelection,
    ]
  );

  const itemIds =
    viewMode === "history" ? commitIds : changes.map((file) => file.path);

  const effectiveSelectedCommitId =
    selectedCommitIds[0] ?? selectedCommitId ?? commits[0]?.id ?? null;
  const effectiveSelectedFilePath =
    selectedFilePath ?? changes[0]?.path ?? null;
  const selectedId =
    viewMode === "history"
      ? effectiveSelectedCommitId
      : effectiveSelectedFilePath;

  const { containerProps, getItemProps } = useNavigableList({
    itemIds,
    onSelect: handleSelectItem,
    selectedId,
  });

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      {/* Header with view mode toggle */}
      <div
        className={cn(
          "flex h-10 items-center px-2",
          "border-panel-border border-b",
          "bg-panel-header-bg",
          isFocused && "border-l-2 border-l-accent-primary"
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
      <div {...containerProps} className="flex-1 overflow-auto p-2">
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
              {commits.map((commit) => {
                const itemProps = getItemProps(commit.id);
                return (
                  <button
                    className={cn(
                      "w-full cursor-default rounded p-2 text-left",
                      selectedCommitIds.includes(commit.id) &&
                        (isFocused
                          ? "bg-accent-muted"
                          : "bg-list-selected-unfocused")
                    )}
                    key={commit.id}
                    type="button"
                    {...itemProps}
                    onClick={(event) => handleCommitClick(event, commit.id)}
                  >
                    <div className="truncate font-medium text-sm text-text-primary">
                      {commit.message}
                    </div>
                    <div className="mt-0.5 text-text-secondary text-xs">
                      {shortSha(commit.id)} ·{" "}
                      {formatRelativeTime(commit.timestamp)}
                    </div>
                  </button>
                );
              })}
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
              {changes.map((file) => {
                const itemProps = getItemProps(file.path);

                return (
                  <FileListItem
                    file={file}
                    isFocused={isFocused}
                    isSelected={effectiveSelectedFilePath === file.path}
                    itemId={itemProps["data-item-id"]}
                    key={file.path}
                    onClick={itemProps.onClick}
                  />
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}

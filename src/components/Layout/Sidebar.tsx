import { formatDistanceToNow } from "date-fns";
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useContextMenuState } from "../../context/ContextMenuContext";
import { useIsFocused } from "../../context/FocusContext";
import { useCommits } from "../../hooks/useCommits";
import { useEffectiveSelectedChangeId } from "../../hooks/useEffectiveSelectedChangeId";
import { useNavigableList } from "../../hooks/useNavigableList";
import { useWorkingChanges } from "../../hooks/useWorkingChanges";
import { useWorkingChangesListModel } from "../../hooks/useWorkingChangesListModel";
import {
  isContextMenuKeyboardEvent,
  showChangesContextMenu,
  showHistoryContextMenu,
} from "../../lib/contextMenuActions";
import { cn } from "../../lib/utils";
import type {
  WorkingChangeItem,
  WorkingChangesListModel,
} from "../../lib/workingChangesList";
import {
  useAppStore,
  useSelectedChangeId,
  useSelectedCommitId,
  useSelectedCommitIds,
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
 * Clear any text selection in the window.
 * Prevents ugly selection state when right-clicking.
 */
function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
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
  const selectedChangeId = useSelectedChangeId();
  const viewMode = useViewMode();
  const selectCommit = useAppStore((state) => state.selectCommit);
  const selectCommitRange = useAppStore((state) => state.selectCommitRange);
  const toggleCommitSelection = useAppStore(
    (state) => state.toggleCommitSelection
  );
  const selectChange = useAppStore((state) => state.selectChange);
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

  const commitIds = commits.map((commit) => commit.id);
  const changesListModel = useWorkingChangesListModel(changes);

  const handleSelectItem = useCallback(
    (id: string) => {
      if (viewMode === "history") {
        commitSelectionAnchorRef.current = id;
        selectCommit(id);
        return;
      }

      selectChange(id);
    },
    [viewMode, selectCommit, selectChange]
  );

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
    viewMode === "history"
      ? commitIds
      : changesListModel.items.map((item) => item.id);

  const effectiveSelectedCommitId =
    selectedCommitIds[0] ?? selectedCommitId ?? commits[0]?.id ?? null;
  const effectiveSelectedChangeId = useEffectiveSelectedChangeId(
    selectedChangeId,
    changesListModel
  );

  const selectedId =
    viewMode === "history"
      ? effectiveSelectedCommitId
      : effectiveSelectedChangeId;

  const { containerProps, getItemProps } = useNavigableList({
    itemIds,
    onSelect: handleSelectItem,
    selectedId,
  });

  const bumpWorkingChangesRevision = useAppStore(
    (state) => state.bumpWorkingChangesRevision
  );

  const { setOpen: setContextMenuOpen, setClosed: setContextMenuClosed } =
    useContextMenuState();

  // Track which item has the context menu open (for highlight)
  const [contextMenuTargetId, setContextMenuTargetId] = useState<string | null>(
    null
  );

  const handleCommitContextMenu = useCallback(
    (
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
      commitId: string
    ) => {
      event.preventDefault();
      clearTextSelection();
      setContextMenuOpen();
      setContextMenuTargetId(commitId);
      const element = event.currentTarget;
      showHistoryContextMenu({
        commitId,
        event,
        element,
        onClose: () => {
          // Only clear if this menu's target is still the active one
          // (prevents race condition when right-clicking another item)
          setContextMenuTargetId((current) => {
            if (current === commitId) {
              setContextMenuClosed();
              return null;
            }
            return current;
          });
        },
      });
    },
    [setContextMenuOpen, setContextMenuClosed]
  );

  const handleChangesContextMenu = useCallback(
    (
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
      item: WorkingChangeItem
    ) => {
      if (!selectedRepo) {
        return;
      }
      event.preventDefault();
      clearTextSelection();
      setContextMenuOpen();
      setContextMenuTargetId(item.id);
      const element = event.currentTarget;
      showChangesContextMenu({
        repoPath: selectedRepo.path,
        filePath: item.path,
        section: item.section,
        event,
        element,
        onWorkingChangesModified: bumpWorkingChangesRevision,
        onClose: () => {
          // Only clear if this menu's target is still the active one
          setContextMenuTargetId((current) => {
            if (current === item.id) {
              setContextMenuClosed();
              return null;
            }
            return current;
          });
        },
      });
    },
    [
      selectedRepo,
      bumpWorkingChangesRevision,
      setContextMenuOpen,
      setContextMenuClosed,
    ]
  );

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      {/* Header with view mode toggle */}
      <div
        className={cn(
          "flex h-10",
          "border-panel-border border-b",
          "bg-panel-header-bg"
        )}
        role="tablist"
      >
        <button
          aria-selected={viewMode === "history"}
          className={cn(
            "flex flex-1 items-center justify-center",
            "border-b-2 font-medium text-xs transition-colors",
            viewMode === "history"
              ? "border-accent-primary text-text-primary"
              : "border-transparent bg-bg-tertiary text-text-secondary hover:text-text-primary"
          )}
          onClick={() => setViewMode("history")}
          role="tab"
          type="button"
        >
          History
        </button>
        <button
          aria-selected={viewMode === "changes"}
          className={cn(
            "flex flex-1 items-center justify-center",
            "border-b-2 font-medium text-xs transition-colors",
            viewMode === "changes"
              ? "border-accent-primary text-text-primary"
              : "border-transparent bg-bg-tertiary text-text-secondary hover:text-text-primary"
          )}
          onClick={() => setViewMode("changes")}
          role="tab"
          type="button"
        >
          Changes
        </button>
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
                  <CommitListItem
                    commit={commit}
                    isContextMenuTarget={contextMenuTargetId === commit.id}
                    isFocused={isFocused}
                    isSelected={selectedCommitIds.includes(commit.id)}
                    itemProps={itemProps}
                    key={commit.id}
                    onClick={handleCommitClick}
                    onContextMenu={handleCommitContextMenu}
                  />
                );
              })}
            </div>
          )}

        {/* Changes mode: file list with staged/unstaged sections */}
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
            <ChangesFileList
              contextMenuTargetId={contextMenuTargetId}
              getItemProps={getItemProps}
              isFocused={isFocused}
              model={changesListModel}
              onContextMenu={handleChangesContextMenu}
              selectedId={effectiveSelectedChangeId}
            />
          )}
      </div>
    </div>
  );
}

interface ChangesFileListProps {
  model: WorkingChangesListModel;
  selectedId: string | null;
  getItemProps: (id: string) => {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
  isFocused: boolean;
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    item: WorkingChangeItem
  ) => void;
  contextMenuTargetId: string | null;
}

function ChangesSectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-1 border-panel-border/50 border-b px-2 py-1 font-medium text-text-secondary text-xs">
      {title}
    </div>
  );
}

function ChangesFileList({
  model,
  selectedId,
  getItemProps,
  isFocused,
  onContextMenu,
  contextMenuTargetId,
}: ChangesFileListProps) {
  const renderItems = (items: WorkingChangesListModel["items"]) => (
    <div className="space-y-0.5">
      {items.map((item) => {
        const itemProps = getItemProps(item.id);
        return (
          <FileListItem
            file={item.file}
            isContextMenuTarget={contextMenuTargetId === item.id}
            isFocused={isFocused}
            isSelected={selectedId === item.id}
            itemId={itemProps["data-item-id"]}
            key={item.id}
            onClick={itemProps.onClick}
            onContextMenu={(event) => onContextMenu(event, item)}
            onKeyDown={(event) => {
              if (isContextMenuKeyboardEvent(event)) {
                onContextMenu(event, item);
              }
            }}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      {model.sections.map((section) => {
        if (section.section !== "unstaged") {
          return (
            <div key={section.section}>
              <ChangesSectionHeader title={section.title} />
              {renderItems(section.items)}
            </div>
          );
        }

        const trackedItems = section.items.filter(
          (item) => item.file.unstaged_status !== "Untracked"
        );
        const untrackedItems = section.items.filter(
          (item) => item.file.unstaged_status === "Untracked"
        );

        return (
          <div key={section.section}>
            <ChangesSectionHeader title={section.title} />

            {trackedItems.length > 0 && renderItems(trackedItems)}

            {untrackedItems.length > 0 && (
              <div className="mt-2">
                <ChangesSectionHeader
                  title={`Untracked (${untrackedItems.length})`}
                />
                {renderItems(untrackedItems)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface CommitListItemProps {
  commit: { id: string; message: string; timestamp: number };
  isSelected: boolean;
  isFocused: boolean;
  isContextMenuTarget: boolean;
  itemProps: {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
  onClick: (event: MouseEvent<HTMLButtonElement>, commitId: string) => void;
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    commitId: string
  ) => void;
}

function CommitListItem({
  commit,
  isSelected,
  isFocused,
  isContextMenuTarget,
  itemProps,
  onClick,
  onContextMenu,
}: CommitListItemProps) {
  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    onContextMenu(event, commit.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isContextMenuKeyboardEvent(event)) {
      onContextMenu(event, commit.id);
    }
  };

  return (
    <button
      className={cn(
        "w-full cursor-default select-none rounded p-2 text-left",
        // Selected state: filled background
        isSelected &&
          (isFocused ? "bg-accent-muted" : "bg-list-selected-unfocused"),
        // Context menu target: outline highlight (like Finder)
        isContextMenuTarget &&
          !isSelected &&
          "outline outline-1 outline-[var(--color-text-secondary)] outline-offset-[-1px]"
      )}
      type="button"
      {...itemProps}
      onClick={(event) => onClick(event, commit.id)}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      <div className="truncate font-medium text-sm text-text-primary">
        {commit.message}
      </div>
      <div className="mt-0.5 text-text-secondary text-xs">
        {shortSha(commit.id)} · {formatRelativeTime(commit.timestamp)}
      </div>
    </button>
  );
}

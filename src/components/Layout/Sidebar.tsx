import { invoke } from "@tauri-apps/api/core";
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
import { useEffectiveSelectedChangeId } from "../../hooks/useEffectiveSelectedChangeId";
import { useInView } from "../../hooks/useInView";
import { useNavigableList } from "../../hooks/useNavigableList";
import { useWorkingChangesListModel } from "../../hooks/useWorkingChangesListModel";
import {
  isContextMenuKeyboardEvent,
  showChangesContextMenu,
  showHistoryContextMenu,
} from "../../lib/contextMenuActions";
import { gravatarUrl } from "../../lib/gravatar";
import { cn } from "../../lib/utils";
import type {
  WorkingChangeItem,
  WorkingChangesListModel,
} from "../../lib/workingChangesList";
import {
  useAppStore,
  useAuthorFilter,
  useBehindCount,
  useChangesError,
  useCommits,
  useCommitsError,
  useIsLoadingChanges,
  useIsLoadingCommits,
  useSelectedChangeId,
  useSelectedCommitId,
  useSelectedCommitIds,
  useSelectedRepo,
  useUnpushedCount,
  useViewMode,
  useWorkingChanges,
} from "../../store/appStore";
import { AuthorFilterDropdown } from "./AuthorFilterDropdown";
import { CreateCommitEditor } from "./CreateCommitEditor";
import { FileListItem } from "./FileListItem";
import { RewriteMessageEditor } from "./RewriteMessageEditor";

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: component delegates to extracted sub-components; further splitting would scatter related state
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

  // Read polling state from store (populated by useRepoPolling in AppLayout)
  const commits = useCommits();
  const isLoadingCommits = useIsLoadingCommits();
  const commitsError = useCommitsError();
  const unpushedCount = useUnpushedCount();
  const behindCount = useBehindCount();
  const changes = useWorkingChanges();
  const isLoadingChanges = useIsLoadingChanges();
  const changesError = useChangesError();

  const authorFilter = useAuthorFilter();
  const hasMoreCommits = useAppStore((state) => state.hasMoreCommits);
  const loadMoreCommits = useAppStore((state) => state.loadMoreCommits);

  const isLoading =
    viewMode === "history" ? isLoadingCommits : isLoadingChanges;
  const error = viewMode === "history" ? commitsError : changesError;

  const isFocused = useIsFocused();

  // Auto-select first commit when selected commit doesn't exist in the (filtered) list
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

  // Commit form state
  const [commitFormOpen, setCommitFormOpen] = useState(false);
  const hasStagedChanges = changes.some((c) => c.section === "staged");

  // Rewrite message editor state
  const [editingCommit, setEditingCommit] = useState<{
    id: string;
    message: string;
  } | null>(null);

  const handleRewriteMessage = useCallback(
    async (commitId: string, _summaryHint: string) => {
      if (!selectedRepo) {
        return;
      }
      try {
        // Fetch the full commit message (list_commits only has the summary)
        const fullMessage = await invoke<string>("get_commit_message", {
          repoPath: selectedRepo.path,
          commitId,
        });
        setEditingCommit({ id: commitId, message: fullMessage });
      } catch {
        // If we can't fetch the full message, fall back to the summary
        setEditingCommit({ id: commitId, message: _summaryHint });
      }
    },
    [selectedRepo]
  );

  const handleCommitContextMenu = useCallback(
    (
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
      commitId: string,
      isUnpushed: boolean,
      commitMessage: string
    ) => {
      if (!selectedRepo) {
        return;
      }
      event.preventDefault();
      clearTextSelection();
      setContextMenuOpen();
      setContextMenuTargetId(commitId);
      const element = event.currentTarget;
      showHistoryContextMenu({
        commitId,
        commitMessage,
        repoPath: selectedRepo.path,
        event,
        element,
        isUnpushed,
        onRewriteMessage: handleRewriteMessage,
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
    [
      selectedRepo,
      setContextMenuOpen,
      setContextMenuClosed,
      handleRewriteMessage,
    ]
  );

  const handleSectionAction = useCallback(
    async (section: "staged" | "unstaged") => {
      if (!selectedRepo) {
        return;
      }
      try {
        if (section === "staged") {
          await invoke("unstage_all", { repoPath: selectedRepo.path });
        } else {
          await invoke("stage_all", { repoPath: selectedRepo.path });
        }
        bumpWorkingChangesRevision();
      } catch (err) {
        console.error(
          `Failed to ${section === "staged" ? "unstage" : "stage"} all:`,
          err
        );
      }
    },
    [selectedRepo, bumpWorkingChangesRevision]
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
            "flex flex-1 items-center justify-center gap-1.5",
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
          <AheadBehindBadge ahead={unpushedCount} behind={behindCount} />
        </button>
        {viewMode === "history" && commits.length > 0 && (
          <div className="flex items-center pr-1.5">
            <AuthorFilterDropdown commits={commits} />
          </div>
        )}
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
            <CommitList
              commits={commits}
              contextMenuTargetId={contextMenuTargetId}
              getItemProps={getItemProps}
              isFocused={isFocused}
              onCommitClick={handleCommitClick}
              onCommitContextMenu={handleCommitContextMenu}
              selectedCommitIds={selectedCommitIds}
              unpushedCount={authorFilter.length > 0 ? null : unpushedCount}
            />
          )}

        {viewMode === "history" && !isLoading && !error && hasMoreCommits && (
          <LoadMoreSentinel onLoadMore={loadMoreCommits} />
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
              onSectionAction={handleSectionAction}
              selectedId={effectiveSelectedChangeId}
            />
          )}
      </div>

      {/* Commit form — docked at bottom of Changes view */}
      {viewMode === "changes" && selectedRepo && hasStagedChanges && (
        <>
          {!commitFormOpen && (
            <button
              className={cn(
                "flex w-full items-center justify-center gap-1 py-1.5",
                "border-panel-border border-t",
                "bg-panel-header-bg",
                "font-medium text-text-secondary text-xs",
                "hover:text-text-primary"
              )}
              data-testid="commit-form-toggle"
              onClick={() => setCommitFormOpen(true)}
              type="button"
            >
              Commit…
            </button>
          )}
          {commitFormOpen && (
            <CreateCommitEditor
              onCancel={() => setCommitFormOpen(false)}
              onCommitted={() => {
                setCommitFormOpen(false);
                bumpWorkingChangesRevision();
              }}
              repoPath={selectedRepo.path}
            />
          )}
        </>
      )}

      {/* Rewrite message editor — docked at bottom */}
      {editingCommit && selectedRepo && viewMode === "history" && (
        <RewriteMessageEditor
          commitId={editingCommit.id}
          initialMessage={editingCommit.message}
          onClose={() => setEditingCommit(null)}
          repoPath={selectedRepo.path}
        />
      )}
    </div>
  );
}

interface AheadBehindBadgeProps {
  ahead: number | null;
  behind: number | null;
}

function AheadBehindBadge({ ahead, behind }: AheadBehindBadgeProps) {
  const showAhead = ahead !== null && ahead > 0;
  const showBehind = behind !== null && behind > 0;

  if (!(showAhead || showBehind)) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-text-secondary"
      data-testid="ahead-behind-badge"
    >
      {showAhead && <span>↑{ahead}</span>}
      {showBehind && <span>↓{behind}</span>}
    </span>
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
  onSectionAction?: (section: "staged" | "unstaged") => void;
}

function ChangesSectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-1 flex items-center justify-between border-panel-border/50 border-b px-2 py-1">
      <span className="font-medium text-text-secondary text-xs">{title}</span>
      {actionLabel && onAction && (
        <button
          className="text-[10px] text-text-secondary hover:text-text-primary"
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      )}
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
  onSectionAction,
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
        const actionLabel =
          section.section === "staged" ? "Unstage All" : "Stage All";
        const handleAction = onSectionAction
          ? () => onSectionAction(section.section)
          : undefined;

        if (section.section !== "unstaged") {
          return (
            <div key={section.section}>
              <ChangesSectionHeader
                actionLabel={actionLabel}
                onAction={handleAction}
                title={section.title}
              />
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
            {trackedItems.length > 0 && (
              <>
                <ChangesSectionHeader
                  actionLabel={actionLabel}
                  onAction={handleAction}
                  title={`Unstaged Changes (${trackedItems.length})`}
                />
                {renderItems(trackedItems)}
              </>
            )}

            {untrackedItems.length > 0 && (
              <div className={trackedItems.length > 0 ? "mt-2" : undefined}>
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

function LoadMoreSentinel({ onLoadMore }: { onLoadMore: () => void }) {
  const sentinelRef = useInView(onLoadMore);

  return (
    <div
      className="py-4 text-center text-text-secondary text-xs"
      data-testid="load-more-commits"
      ref={sentinelRef}
    >
      Loading more…
    </div>
  );
}

interface CommitListProps {
  commits: {
    id: string;
    message: string;
    author: string;
    email: string;
    timestamp: number;
  }[];
  unpushedCount: number | null;
  selectedCommitIds: string[];
  isFocused: boolean;
  contextMenuTargetId: string | null;
  getItemProps: (id: string) => {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
  onCommitClick: (
    event: MouseEvent<HTMLButtonElement>,
    commitId: string
  ) => void;
  onCommitContextMenu: (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    commitId: string,
    isUnpushed: boolean,
    commitMessage: string
  ) => void;
}

function CommitList({
  commits,
  unpushedCount,
  selectedCommitIds,
  isFocused,
  contextMenuTargetId,
  getItemProps,
  onCommitClick,
  onCommitContextMenu,
}: CommitListProps) {
  const hasDivider =
    unpushedCount !== null &&
    unpushedCount > 0 &&
    unpushedCount < commits.length;

  return (
    <div className="space-y-1">
      {commits.map((commit, index) => {
        const isUnpushed = unpushedCount !== null && index < unpushedCount;
        const showDivider = hasDivider && index === unpushedCount;
        const itemProps = getItemProps(commit.id);

        return (
          <div key={commit.id}>
            {showDivider && <PushDivider />}
            <CommitListItem
              commit={commit}
              isContextMenuTarget={contextMenuTargetId === commit.id}
              isFocused={isFocused}
              isSelected={selectedCommitIds.includes(commit.id)}
              isUnpushed={isUnpushed}
              itemProps={itemProps}
              onClick={onCommitClick}
              onContextMenu={onCommitContextMenu}
            />
          </div>
        );
      })}
    </div>
  );
}

function PushDivider() {
  return (
    <div
      className="my-1 flex items-center gap-2 px-2"
      data-testid="push-divider"
    >
      <div className="h-px flex-1 bg-text-secondary/30" />
      <span className="flex-shrink-0 text-[10px] text-text-secondary/60">
        ↑ unpushed
      </span>
      <div className="h-px flex-1 bg-text-secondary/30" />
    </div>
  );
}

interface CommitListItemProps {
  commit: {
    id: string;
    message: string;
    author: string;
    email: string;
    timestamp: number;
  };
  isSelected: boolean;
  isFocused: boolean;
  isContextMenuTarget: boolean;
  isUnpushed: boolean;
  itemProps: {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
  onClick: (event: MouseEvent<HTMLButtonElement>, commitId: string) => void;
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    commitId: string,
    isUnpushed: boolean,
    commitMessage: string
  ) => void;
}

function CommitListItem({
  commit,
  isSelected,
  isFocused,
  isContextMenuTarget,
  isUnpushed,
  itemProps,
  onClick,
  onContextMenu,
}: CommitListItemProps) {
  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    onContextMenu(event, commit.id, isUnpushed, commit.message);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isContextMenuKeyboardEvent(event)) {
      onContextMenu(event, commit.id, isUnpushed, commit.message);
    }
  };

  const [imgError, setImgError] = useState(false);
  const avatarSrc = gravatarUrl(commit.email);
  const initial = (commit.author[0] ?? "?").toUpperCase();

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
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-tertiary">
          {imgError ? (
            <span className="font-medium text-[10px] text-text-secondary leading-none">
              {initial}
            </span>
          ) : (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError is a lifecycle event, not user interaction — Biome doesn't distinguish these
            <img
              alt=""
              className="h-5 w-5 rounded-full"
              height={20}
              onError={() => setImgError(true)}
              src={avatarSrc}
              width={20}
            />
          )}
        </div>

        {/* Text content */}
        <div className={cn("min-w-0 flex-1", isUnpushed && "opacity-65")}>
          <div className="truncate font-medium text-sm text-text-primary">
            {commit.message}
          </div>
          <div className="mt-0.5 truncate text-text-secondary text-xs">
            {shortSha(commit.id)} · {commit.author} ·{" "}
            {formatRelativeTime(commit.timestamp)}
          </div>
        </div>
      </div>
    </button>
  );
}

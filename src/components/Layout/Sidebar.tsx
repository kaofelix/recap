import { invoke } from "@tauri-apps/api/core";
import { formatDistanceToNow } from "date-fns";
import { PencilLine } from "lucide-react";
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
import { useGravatar } from "../../hooks/useGravatar";
import { useInView } from "../../hooks/useInView";
import { useNavigableList } from "../../hooks/useNavigableList";
import {
  isContextMenuKeyboardEvent,
  showHistoryContextMenu,
} from "../../lib/contextMenuActions";
import {
  buildSidebarHistoryItems,
  isUncommittedChangesItemId,
  type SidebarHistoryItem,
  UNCOMMITTED_CHANGES_ITEM_ID,
} from "../../lib/sidebarHistoryList";
import { cn } from "../../lib/utils";
import { buildWorkingChangesListModel } from "../../lib/workingChangesList";
import {
  useAppStore,
  useBehindCount,
  useCommits,
  useCommitsError,
  useIsLoadingCommits,
  useSelectedCommitId,
  useSelectedCommitIds,
  useSelectedRepo,
  useUnpushedCount,
  useViewMode,
  useWorkingChanges,
} from "../../store/appStore";
import { AuthorFilterDropdown } from "./AuthorFilterDropdown";
import { RewriteMessageEditor } from "./RewriteMessageEditor";

export interface SidebarProps {
  className?: string;
}

function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp * 1000), { addSuffix: true });
}

function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

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
  const viewMode = useViewMode();
  const selectCommit = useAppStore((state) => state.selectCommit);
  const selectCommitRange = useAppStore((state) => state.selectCommitRange);
  const toggleCommitSelection = useAppStore(
    (state) => state.toggleCommitSelection
  );
  const selectChange = useAppStore((state) => state.selectChange);
  const setViewMode = useAppStore((state) => state.setViewMode);

  const commits = useCommits();
  const isLoadingCommits = useIsLoadingCommits();
  const commitsError = useCommitsError();
  const unpushedCount = useUnpushedCount();
  const behindCount = useBehindCount();
  const workingChanges = useWorkingChanges();

  const hasMoreCommits = useAppStore((state) => state.hasMoreCommits);
  const loadMoreCommits = useAppStore((state) => state.loadMoreCommits);

  const isFocused = useIsFocused();
  const commitSelectionAnchorRef = useRef<string | null>(null);
  const historyItems = buildSidebarHistoryItems(commits, workingChanges);
  const workingChangesModel = buildWorkingChangesListModel(workingChanges);
  const commitIds = commits.map((commit) => commit.id);

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

  useEffect(() => {
    if (!(viewMode === "changes" && workingChanges.length === 0)) {
      return;
    }

    setViewMode("history");
    const nextCommitId = commits[0]?.id ?? null;
    selectCommit(nextCommitId);
    commitSelectionAnchorRef.current = nextCommitId;
  }, [workingChanges.length, viewMode, commits, setViewMode, selectCommit]);

  const handleSelectItem = useCallback(
    (id: string) => {
      if (isUncommittedChangesItemId(id)) {
        setViewMode("changes");
        selectChange(workingChangesModel.items[0]?.id ?? null);
        return;
      }

      commitSelectionAnchorRef.current = id;
      selectCommit(id);
      setViewMode("history");
    },
    [selectCommit, selectChange, setViewMode, workingChangesModel]
  );

  const handleCommitClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, commitId: string) => {
      const isToggle = event.metaKey || event.ctrlKey;
      const isRange = event.shiftKey;

      setViewMode("history");

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
      setViewMode,
    ]
  );

  const effectiveSelectedCommitId =
    selectedCommitIds[0] ?? selectedCommitId ?? commits[0]?.id ?? null;
  const selectedId =
    viewMode === "changes"
      ? UNCOMMITTED_CHANGES_ITEM_ID
      : effectiveSelectedCommitId;

  const { containerProps, getItemProps } = useNavigableList({
    itemIds: historyItems.map((item) => item.id),
    onSelect: handleSelectItem,
    selectedId,
  });

  const { setOpen: setContextMenuOpen, setClosed: setContextMenuClosed } =
    useContextMenuState();
  const [contextMenuTargetId, setContextMenuTargetId] = useState<string | null>(
    null
  );
  const [editingCommit, setEditingCommit] = useState<{
    id: string;
    message: string;
  } | null>(null);

  const handleRewriteMessage = useCallback(
    async (commitId: string, summaryHint: string) => {
      if (!selectedRepo) {
        return;
      }
      try {
        const fullMessage = await invoke<string>("get_commit_message", {
          repoPath: selectedRepo.path,
          commitId,
        });
        setEditingCommit({ id: commitId, message: fullMessage });
      } catch {
        setEditingCommit({ id: commitId, message: summaryHint });
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

  const isInitialLoading =
    selectedRepo !== null && isLoadingCommits && historyItems.length === 0;

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "flex h-10 items-center justify-between gap-2 border-panel-border border-b bg-panel-header-bg px-3",
          isFocused && "border-l-2 border-l-accent-primary"
        )}
      >
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm text-text-primary">History</h2>
          <AheadBehindBadge ahead={unpushedCount} behind={behindCount} />
        </div>
        {commits.length > 0 && <AuthorFilterDropdown commits={commits} />}
      </div>

      <div {...containerProps} className="flex-1 overflow-auto p-2">
        {!selectedRepo && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Select a repository to view commits
          </div>
        )}

        {selectedRepo && isInitialLoading && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Loading commits...
          </div>
        )}

        {selectedRepo && commitsError && commits.length === 0 && (
          <div className="py-8 text-center text-red-500 text-sm">
            Error: {commitsError}
          </div>
        )}

        {selectedRepo &&
          !isInitialLoading &&
          !commitsError &&
          historyItems.length === 0 && (
            <div className="py-8 text-center text-sm text-text-secondary">
              No commits found
            </div>
          )}

        {selectedRepo && !commitsError && historyItems.length > 0 && (
          <HistoryList
            contextMenuTargetId={contextMenuTargetId}
            getItemProps={getItemProps}
            isFocused={isFocused}
            items={historyItems}
            onCommitClick={handleCommitClick}
            onCommitContextMenu={handleCommitContextMenu}
            selectedCommitIds={selectedCommitIds}
            selectedId={selectedId}
          />
        )}

        {selectedRepo &&
          !commitsError &&
          hasMoreCommits &&
          commits.length > 0 && (
            <LoadMoreSentinel
              currentCount={commits.length}
              onLoadMore={loadMoreCommits}
            />
          )}
      </div>

      {editingCommit && selectedRepo && (
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

interface HistoryListProps {
  items: SidebarHistoryItem[];

  selectedCommitIds: string[];
  selectedId: string | null;
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

function HistoryList({
  items,
  selectedCommitIds,
  selectedId,
  isFocused,
  contextMenuTargetId,
  getItemProps,
  onCommitClick,
  onCommitContextMenu,
}: HistoryListProps) {
  return (
    <div className="space-y-1">
      {items.map((item, index) => {
        if (item.kind === "uncommitted") {
          const itemProps = getItemProps(item.id);
          return (
            <UncommittedChangesItem
              changeCount={item.changeCount}
              isFocused={isFocused}
              isSelected={selectedId === item.id}
              itemProps={itemProps}
              key={item.id}
            />
          );
        }

        const commit = item.commit;
        const isUnpushed = !commit.is_pushed;
        const prevCommit = index > 0 ? items[index - 1] : null;
        const prevCommitItem =
          prevCommit?.kind === "commit" ? prevCommit.commit : null;
        const showDivider =
          commit.is_pushed &&
          prevCommitItem !== null &&
          !prevCommitItem.is_pushed;
        const itemProps = getItemProps(commit.id);

        return (
          <div key={commit.id}>
            {showDivider && <PushDivider />}
            <CommitListItem
              commit={commit}
              isContextMenuTarget={contextMenuTargetId === commit.id}
              isFocused={isFocused}
              isSelected={
                selectedId !== UNCOMMITTED_CHANGES_ITEM_ID &&
                selectedCommitIds.includes(commit.id)
              }
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

function UncommittedChangesItem({
  changeCount,
  isSelected,
  isFocused,
  itemProps,
}: {
  changeCount: number;
  isSelected: boolean;
  isFocused: boolean;
  itemProps: {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
}) {
  const changeLabel = `${changeCount} changed file${changeCount === 1 ? "" : "s"}`;

  return (
    <button
      className={cn(
        "w-full cursor-default select-none rounded p-2 text-left",
        isSelected &&
          (isFocused ? "bg-accent-muted" : "bg-list-selected-unfocused")
      )}
      type="button"
      {...itemProps}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-text-secondary">
          <PencilLine className="h-3 w-3" />
        </div>

        <div className="min-w-0 flex-1 opacity-65">
          <div className="truncate font-medium text-sm text-text-primary italic">
            Uncommitted changes
          </div>
          <div className="mt-0.5 truncate text-text-secondary text-xs">
            {changeLabel} · Working tree
          </div>
        </div>
      </div>
    </button>
  );
}

function LoadMoreSentinel({
  onLoadMore,
  currentCount,
}: {
  onLoadMore: () => void;
  currentCount: number;
}) {
  const triggeredAtCountRef = useRef<number | null>(null);

  const handleInView = useCallback(() => {
    if (triggeredAtCountRef.current === currentCount) {
      return;
    }
    triggeredAtCountRef.current = currentCount;
    onLoadMore();
  }, [onLoadMore, currentCount]);

  const sentinelRef = useInView(handleInView);

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

  const { isLoaded: hasLoadedAvatar, src: avatarSrc } = useGravatar(
    commit.email
  );
  const initial = (commit.author[0] ?? "?").toUpperCase();

  return (
    <button
      className={cn(
        "w-full cursor-default select-none rounded p-2 text-left",
        isSelected &&
          (isFocused ? "bg-accent-muted" : "bg-list-selected-unfocused"),
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
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-tertiary">
          {hasLoadedAvatar ? (
            <img
              alt=""
              className="h-5 w-5 rounded-full"
              height={20}
              src={avatarSrc}
              width={20}
            />
          ) : (
            <span className="font-medium text-[10px] text-text-secondary leading-none">
              {initial}
            </span>
          )}
        </div>

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

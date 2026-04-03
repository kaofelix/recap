import { invoke } from "@tauri-apps/api/core";
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useState,
} from "react";
import { useContextMenuState } from "../../context/ContextMenuContext";
import { useIsFocused } from "../../context/FocusContext";
import { useCommitFiles } from "../../hooks/useCommitFiles";
import { useEffectiveSelectedChangeId } from "../../hooks/useEffectiveSelectedChangeId";
import { useNavigableList } from "../../hooks/useNavigableList";
import { useWorkingChangesListModel } from "../../hooks/useWorkingChangesListModel";
import {
  isContextMenuKeyboardEvent,
  showChangesContextMenu,
  showFileContextMenu,
} from "../../lib/contextMenuActions";
import { cn } from "../../lib/utils";
import type {
  WorkingChangeItem,
  WorkingChangesListModel,
} from "../../lib/workingChangesList";
import {
  useAppStore,
  useChangedFiles,
  useChangesError,
  useCommitFilesError,
  useIsLoadingChanges,
  useIsLoadingCommitFiles,
  useSelectedChangeId,
  useSelectedCommitIds,
  useSelectedFilePath,
  useSelectedRepo,
  useViewMode,
  useWorkingChanges,
} from "../../store/appStore";
import type { ChangedFile, WorkingFile } from "../../types/file";
import { CreateCommitEditor } from "./CreateCommitEditor";
import { FileListItem } from "./FileListItem";

export interface FileListProps {
  className?: string;
}

const NON_CONSECUTIVE_SELECTION_ERROR =
  "Unable to display diff for multiple non-consecutive commits";

function CommitFileListContent({
  hasCommit,
  isLoading,
  error,
  files,
  selectedFilePath,
  getItemProps,
  isFocused,
  onContextMenu,
  contextMenuTargetId,
}: {
  hasCommit: boolean;
  isLoading: boolean;
  error: string | null;
  files: (ChangedFile | WorkingFile)[];
  selectedFilePath: string | null;
  isFocused: boolean;
  getItemProps: (id: string) => {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    filePath: string
  ) => void;
  contextMenuTargetId: string | null;
}) {
  if (!hasCommit) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        Select a commit to view changed files
      </div>
    );
  }

  if (isLoading && files.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        Loading files...
      </div>
    );
  }

  if (error && files.length === 0) {
    if (error.includes(NON_CONSECUTIVE_SELECTION_ERROR)) {
      return (
        <div className="py-8 text-center text-sm text-text-secondary">
          {NON_CONSECUTIVE_SELECTION_ERROR}
        </div>
      );
    }

    return (
      <div className="py-8 text-center text-red-500 text-sm">
        Error: {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        No files changed
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {files.map((file) => {
        const itemProps = getItemProps(file.path);

        return (
          <FileListItem
            file={file}
            isContextMenuTarget={contextMenuTargetId === file.path}
            isFocused={isFocused}
            isSelected={selectedFilePath === file.path}
            itemId={itemProps["data-item-id"]}
            key={file.path}
            onClick={itemProps.onClick}
            onContextMenu={(event) => onContextMenu(event, file.path)}
            onKeyDown={(event) => {
              if (isContextMenuKeyboardEvent(event)) {
                onContextMenu(event, file.path);
              }
            }}
          />
        );
      })}
    </div>
  );
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

function WorkingChangesContent({
  hasRepo,
  isLoading,
  error,
  model,
  selectedId,
  getItemProps,
  isFocused,
  onContextMenu,
  contextMenuTargetId,
  onSectionAction,
}: {
  hasRepo: boolean;
  isLoading: boolean;
  error: string | null;
  model: WorkingChangesListModel;
  selectedId: string | null;
  isFocused: boolean;
  getItemProps: (id: string) => {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
  onContextMenu: (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    item: WorkingChangeItem
  ) => void;
  contextMenuTargetId: string | null;
  onSectionAction?: (section: "staged" | "unstaged") => void;
}) {
  if (!hasRepo) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        Select a repository to view changed files
      </div>
    );
  }

  if (isLoading && model.items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        Loading changes...
      </div>
    );
  }

  if (error && model.items.length === 0) {
    return (
      <div className="py-8 text-center text-red-500 text-sm">
        Error: {error}
      </div>
    );
  }

  if (model.items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        No changes here... ✓
      </div>
    );
  }

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
                  actionLabel={
                    trackedItems.length === 0 ? actionLabel : undefined
                  }
                  onAction={
                    trackedItems.length === 0 ? handleAction : undefined
                  }
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

export function FileList({ className }: FileListProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitIds = useSelectedCommitIds();
  const selectedFilePath = useSelectedFilePath();
  const selectedChangeId = useSelectedChangeId();
  const viewMode = useViewMode();
  const selectFile = useAppStore((state) => state.selectFile);
  const selectChange = useAppStore((state) => state.selectChange);
  const bumpWorkingChangesRevision = useAppStore(
    (state) => state.bumpWorkingChangesRevision
  );
  // Side-effect hook: fetches commit files and writes to the store
  useCommitFiles();
  const commitFiles = useChangedFiles();
  const isLoadingCommitFiles = useIsLoadingCommitFiles();
  const commitFilesError = useCommitFilesError();
  const workingChanges = useWorkingChanges();
  const isLoadingChanges = useIsLoadingChanges();
  const changesError = useChangesError();
  const workingChangesModel = useWorkingChangesListModel(workingChanges);
  const effectiveSelectedChangeId = useEffectiveSelectedChangeId(
    selectedChangeId,
    workingChangesModel
  );
  const isFocused = useIsFocused();
  const [commitFormOpen, setCommitFormOpen] = useState(false);

  const isMultiCommitSelection = selectedCommitIds.length > 1;
  const isShowingWorkingChanges = viewMode === "changes";
  const hasStagedChanges = workingChanges.some((c) => c.section === "staged");

  const itemIds = isShowingWorkingChanges
    ? workingChangesModel.items.map((item) => item.id)
    : commitFiles.map((file) => file.path);
  const effectiveSelectedFilePath =
    selectedFilePath ?? commitFiles[0]?.path ?? null;

  const { containerProps, getItemProps } = useNavigableList({
    itemIds,
    onSelect: isShowingWorkingChanges ? selectChange : selectFile,
    selectedId: isShowingWorkingChanges
      ? effectiveSelectedChangeId
      : effectiveSelectedFilePath,
  });

  const { setOpen: setContextMenuOpen, setClosed: setContextMenuClosed } =
    useContextMenuState();

  const [contextMenuTargetId, setContextMenuTargetId] = useState<string | null>(
    null
  );

  const handleCommitFileContextMenu = useCallback(
    (
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
      filePath: string
    ) => {
      if (!selectedRepo) {
        return;
      }
      event.preventDefault();
      setContextMenuOpen();
      setContextMenuTargetId(filePath);
      const element = event.currentTarget;
      showFileContextMenu({
        repoPath: selectedRepo.path,
        filePath,
        event,
        element,
        onClose: () => {
          setContextMenuTargetId((current) => {
            if (current === filePath) {
              setContextMenuClosed();
              return null;
            }
            return current;
          });
        },
      });
    },
    [selectedRepo, setContextMenuOpen, setContextMenuClosed]
  );

  const handleWorkingChangesContextMenu = useCallback(
    (
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
      item: WorkingChangeItem
    ) => {
      if (!selectedRepo) {
        return;
      }
      event.preventDefault();
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
      setContextMenuOpen,
      setContextMenuClosed,
      bumpWorkingChangesRevision,
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

  const headerTitle = "Files";
  const itemCount = isShowingWorkingChanges
    ? workingChangesModel.items.length
    : commitFiles.length;

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "flex h-10 items-center gap-2 px-3",
          "border-panel-border border-b",
          "bg-panel-header-bg",
          isFocused && "border-l-2 border-l-accent-primary"
        )}
      >
        <h2 className="shrink-0 font-semibold text-sm text-text-primary">
          {headerTitle}
        </h2>
        {itemCount > 0 && (
          <span className="shrink-0 text-text-secondary text-xs">
            ({itemCount})
          </span>
        )}
        {!isShowingWorkingChanges && isMultiCommitSelection && (
          <span className="min-w-0 truncate text-text-secondary text-xs">
            Showing changes from {selectedCommitIds.length} commits
          </span>
        )}
      </div>

      <div {...containerProps} className="min-h-0 flex-1 overflow-auto p-2">
        {isShowingWorkingChanges ? (
          <WorkingChangesContent
            contextMenuTargetId={contextMenuTargetId}
            error={changesError}
            getItemProps={getItemProps}
            hasRepo={!!selectedRepo}
            isFocused={isFocused}
            isLoading={isLoadingChanges}
            model={workingChangesModel}
            onContextMenu={handleWorkingChangesContextMenu}
            onSectionAction={handleSectionAction}
            selectedId={effectiveSelectedChangeId}
          />
        ) : (
          <CommitFileListContent
            contextMenuTargetId={contextMenuTargetId}
            error={commitFilesError}
            files={commitFiles}
            getItemProps={getItemProps}
            hasCommit={selectedCommitIds.length > 0}
            isFocused={isFocused}
            isLoading={isLoadingCommitFiles}
            onContextMenu={handleCommitFileContextMenu}
            selectedFilePath={effectiveSelectedFilePath}
          />
        )}
      </div>

      {isShowingWorkingChanges && selectedRepo && hasStagedChanges && (
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
    </div>
  );
}

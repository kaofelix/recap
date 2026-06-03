import {
  type FileContents,
  MultiFileDiff,
  type MultiFileDiffProps,
  useWorkerPool,
  WorkerPoolContextProvider,
} from "@pierre/diffs/react";
import {
  Content,
  Portal,
  Provider,
  Root,
  Trigger,
} from "@radix-ui/react-tooltip";
import { useHotkeys } from "@tanstack/react-hotkeys";
import {
  ChevronDown,
  ChevronUp,
  Maximize,
  Minimize,
  Rows3,
  SquareSplitHorizontal,
  WrapText,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "../../context/FocusContext";
import { useFileContents } from "../../hooks/useFileContents";
import { useTheme } from "../../hooks/useTheme";
import { useWorkingChangesListModel } from "../../hooks/useWorkingChangesListModel";
import { workerFactory } from "../../lib/diffsWorker";
import { cn, splitPath } from "../../lib/utils";
import { parseWorkingChangeId } from "../../lib/workingChangesList";
import {
  useAppStore,
  useChangedFiles,
  useDiffDisplayMode,
  useIsDiffMaximized,
  useOverlayOpen,
  useSelectedChangeId,
  useSelectedCommitId,
  useSelectedCommitIds,
  useSelectedFilePath,
  useSelectedRepo,
  useViewMode,
  useWordWrap,
  useWorkingChanges,
  useWorkingChangesFingerprint,
} from "../../store/appStore";
import type {
  ChangedFile,
  WorkingFile,
  WorkingFileSection,
} from "../../types/file";

export interface DiffViewProps {
  className?: string;
}

const NON_CONSECUTIVE_SELECTION_ERROR =
  "Unable to display diff for multiple non-consecutive commits";

/** Stable empty array reference to avoid triggering useFileContents re-fetches */
const EMPTY_COMMIT_IDS: string[] = [];

const workerPoolLanguages = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "css",
  "json",
  "yaml",
  "rust",
  "python",
  "go",
  "markdown",
] as const;

const diffWorkerPoolOptions = {
  poolSize: 4,
  totalASTLRUCacheSize: 200,
  workerFactory,
};

const diffHighlighterOptions = {
  langs: [...workerPoolLanguages],
  lineDiffType: "word-alt" as const,
  maxLineDiffLength: 500,
  theme: { dark: "pierre-dark", light: "pierre-light" },
  tokenizeMaxLineLength: 500,
};

function hashDiffContent(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) % 4_294_967_291;
  }

  return hash.toString(16);
}

const diffStyleVariables = {
  "--diffs-font-family":
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
  "--diffs-font-size": "12px",
  "--diffs-line-height": "1.5",
  "--diffs-header-font-family":
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--diffs-deletion-color-override": "var(--color-diff-delete-text)",
  "--diffs-addition-color-override": "var(--color-diff-add-text)",
  "--diffs-bg-selection-override": "var(--color-bg-hover)",
  "--diffs-selection-color-override": "var(--color-accent-primary)",
} as CSSProperties;

/** Placeholder message component */
function DiffPlaceholder({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-text-secondary">
      {message}
    </div>
  );
}

/** Hook for file navigation logic */
function useFileNavigation(
  changedFiles: (ChangedFile | WorkingFile)[],
  selectedFilePath: string | null,
  selectedChangeId: string | null,
  viewMode: "history" | "changes"
) {
  const selectFile = useAppStore((s) => s.selectFile);
  const selectChange = useAppStore((s) => s.selectChange);

  const workingChangesModel = useWorkingChangesListModel(changedFiles);

  const navigationItems =
    viewMode === "changes"
      ? workingChangesModel.items.map((item) => ({
          id: item.id,
          path: item.path,
        }))
      : changedFiles.map((file) => ({ id: file.path, path: file.path }));

  let currentFileIndex = -1;

  if (viewMode === "changes") {
    if (selectedChangeId) {
      currentFileIndex = navigationItems.findIndex(
        (item) => item.id === selectedChangeId
      );
    }
  } else if (selectedFilePath) {
    currentFileIndex = navigationItems.findIndex(
      (item) => item.path === selectedFilePath
    );
  }

  const isFirstFile = currentFileIndex <= 0;
  const isLastFile =
    currentFileIndex === -1 || currentFileIndex >= navigationItems.length - 1;
  const canNavigate = navigationItems.length > 1;

  const selectPreviousFile = useCallback(() => {
    if (!isFirstFile && currentFileIndex > 0) {
      const previous = navigationItems[currentFileIndex - 1];
      if (viewMode === "changes") {
        selectChange(previous.id);
      } else {
        selectFile(previous.path);
      }
    }
  }, [
    isFirstFile,
    currentFileIndex,
    navigationItems,
    viewMode,
    selectChange,
    selectFile,
  ]);

  const selectNextFile = useCallback(() => {
    if (!isLastFile && currentFileIndex < navigationItems.length - 1) {
      const next = navigationItems[currentFileIndex + 1];
      if (viewMode === "changes") {
        selectChange(next.id);
      } else {
        selectFile(next.path);
      }
    }
  }, [
    isLastFile,
    currentFileIndex,
    navigationItems,
    viewMode,
    selectChange,
    selectFile,
  ]);

  return {
    isFirstFile,
    isLastFile,
    canNavigate,
    selectPreviousFile,
    selectNextFile,
  };
}

/** File navigation buttons component */
function FileNavigationButtons({
  isFirstFile,
  isLastFile,
  canNavigate,
  onPrevious,
  onNext,
}: {
  isFirstFile: boolean;
  isLastFile: boolean;
  canNavigate: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex overflow-hidden rounded border border-border-primary">
      <Root>
        <Trigger asChild>
          <button
            aria-label="Previous file"
            className={cn(
              "flex items-center justify-center p-1",
              "transition-colors",
              "bg-bg-secondary text-text-tertiary",
              !isFirstFile &&
                canNavigate &&
                "hover:bg-bg-hover hover:text-text-secondary",
              (isFirstFile || !canNavigate) && "cursor-not-allowed opacity-50"
            )}
            disabled={isFirstFile || !canNavigate}
            onClick={onPrevious}
            type="button"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </Trigger>
        <Portal>
          <Content
            className={cn(
              "z-50 rounded px-2 py-1 text-xs",
              "bg-bg-tertiary text-text-primary",
              "border border-panel-border shadow-lg",
              "fade-in-0 zoom-in-95 animate-in duration-100"
            )}
            sideOffset={5}
          >
            Previous file (↑)
          </Content>
        </Portal>
      </Root>
      <Root>
        <Trigger asChild>
          <button
            aria-label="Next file"
            className={cn(
              "flex items-center justify-center p-1",
              "border-border-primary border-l",
              "transition-colors",
              "bg-bg-secondary text-text-tertiary",
              !isLastFile &&
                canNavigate &&
                "hover:bg-bg-hover hover:text-text-secondary",
              (isLastFile || !canNavigate) && "cursor-not-allowed opacity-50"
            )}
            disabled={isLastFile || !canNavigate}
            onClick={onNext}
            type="button"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </Trigger>
        <Portal>
          <Content
            className={cn(
              "z-50 rounded px-2 py-1 text-xs",
              "bg-bg-tertiary text-text-primary",
              "border border-panel-border shadow-lg",
              "fade-in-0 zoom-in-95 animate-in duration-100"
            )}
            sideOffset={5}
          >
            Next file (↓)
          </Content>
        </Portal>
      </Root>
    </div>
  );
}

/** Display file path with muted directory */
function DiffFilePath({ path }: { path: string | null }) {
  if (!path) {
    return <span className="font-semibold text-text-primary">Diff</span>;
  }

  const { dir, filename } = splitPath(path);
  return (
    <>
      {dir && (
        <span className="shrink truncate text-text-secondary">{dir}</span>
      )}
      <span className="shrink-0 font-semibold text-text-primary">
        {filename}
      </span>
    </>
  );
}

function resolveChangesSection(
  viewMode: "history" | "changes",
  selectedChangeId: string | null
): WorkingFileSection | null {
  if (!(viewMode === "changes" && selectedChangeId)) {
    return null;
  }

  return parseWorkingChangeId(selectedChangeId)?.section ?? null;
}

function getMaximizeLabels(isDiffMaximized: boolean) {
  if (isDiffMaximized) {
    return {
      buttonLabel: "Restore panel layout",
      tooltipLabel: "Restore layout (⌘↵ / Ctrl+Enter)",
    };
  }

  return {
    buttonLabel: "Maximize diff view",
    tooltipLabel: "Maximize diff view (⌘↵ / Ctrl+Enter)",
  };
}

/** Error message component */
function DiffError({ message }: { message: string }) {
  if (message.includes(NON_CONSECUTIVE_SELECTION_ERROR)) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        {NON_CONSECUTIVE_SELECTION_ERROR}
      </div>
    );
  }

  return (
    <div className="py-8 text-center text-red-500 text-sm">
      Error: {message}
    </div>
  );
}

interface DiffContentProps {
  hasFile: boolean;
  isLoading: boolean;
  error: string | null;
  isBinary: boolean;
  hasChanges: boolean;
  hasData: boolean;
  oldValue: string;
  newValue: string;
  splitView: boolean;
  wordWrap: boolean;
  isDarkTheme: boolean;
  filePath: string | null;
  cacheKeyBase: string;
}

function useWorkerHighlightRefreshKey(diffInstanceKey: string): string {
  const workerPool = useWorkerPool();
  const [refreshState, setRefreshState] = useState({
    diffInstanceKey,
    count: 0,
  });
  const sawWorkRef = useRef(false);

  const refreshCount =
    refreshState.diffInstanceKey === diffInstanceKey ? refreshState.count : 0;

  useEffect(() => {
    if (workerPool == null) {
      return;
    }

    return workerPool.subscribeToStatChanges((stats) => {
      const isWorking =
        stats.busyWorkers > 0 || stats.activeTasks > 0 || stats.queuedTasks > 0;

      if (isWorking) {
        sawWorkRef.current = true;
        return;
      }

      if (sawWorkRef.current) {
        sawWorkRef.current = false;
        setRefreshState((current) => ({
          diffInstanceKey,
          count:
            current.diffInstanceKey === diffInstanceKey ? current.count + 1 : 1,
        }));
      }
    });
  }, [diffInstanceKey, workerPool]);

  return `${diffInstanceKey}:${refreshCount}`;
}

function DiffContent({
  hasFile,
  isLoading,
  error,
  isBinary,
  hasChanges,
  hasData,
  oldValue,
  newValue,
  splitView,
  wordWrap,
  isDarkTheme,
  filePath,
  cacheKeyBase,
}: DiffContentProps) {
  const diffOptions = useMemo<
    NonNullable<MultiFileDiffProps<undefined>["options"]>
  >(
    () => ({
      diffStyle: splitView ? "split" : "unified",
      overflow: wordWrap ? "wrap" : "scroll",
      disableFileHeader: true,
      theme: { dark: "pierre-dark", light: "pierre-light" },
      themeType: isDarkTheme ? "dark" : "light",
      hunkSeparators: "line-info",
      lineDiffType: "word-alt",
    }),
    [isDarkTheme, splitView, wordWrap]
  );

  const oldContentHash = useMemo(() => hashDiffContent(oldValue), [oldValue]);
  const newContentHash = useMemo(() => hashDiffContent(newValue), [newValue]);
  const diffInstanceKey = useWorkerHighlightRefreshKey(
    `${cacheKeyBase}:${oldContentHash}:${newContentHash}`
  );

  const oldFile = useMemo<FileContents>(
    () => ({
      name: filePath ?? "file",
      contents: oldValue,
      cacheKey: `${cacheKeyBase}:old:${oldContentHash}`,
    }),
    [cacheKeyBase, filePath, oldContentHash, oldValue]
  );

  const newFile = useMemo<FileContents>(
    () => ({
      name: filePath ?? "file",
      contents: newValue,
      cacheKey: `${cacheKeyBase}:new:${newContentHash}`,
    }),
    [cacheKeyBase, filePath, newContentHash, newValue]
  );

  if (!hasFile) {
    return <DiffPlaceholder message="Select a file to view diff" />;
  }
  if (isLoading) {
    return <DiffPlaceholder message="Loading diff..." />;
  }
  if (!hasData && error) {
    return <DiffError message={error} />;
  }
  if (!hasData) {
    return null;
  }
  if (isBinary) {
    return <DiffPlaceholder message="Binary file cannot be displayed" />;
  }
  if (!hasChanges) {
    return <DiffPlaceholder message="No changes" />;
  }

  return (
    <MultiFileDiff
      key={diffInstanceKey}
      newFile={newFile}
      oldFile={oldFile}
      options={diffOptions}
      style={diffStyleVariables}
    />
  );
}

/** Extracted hotkey registrations to keep DiffView below complexity threshold */
function useDiffViewHotkeys({
  toggleDiffDisplayMode,
  selectNextFile,
  selectPreviousFile,
  isFocused,
}: {
  toggleDiffDisplayMode: () => void;
  selectNextFile: () => void;
  selectPreviousFile: () => void;
  isFocused: boolean;
}) {
  const overlayOpen = useOverlayOpen();

  useHotkeys(
    [
      {
        hotkey: { key: "\\", shift: true },
        callback: toggleDiffDisplayMode,
      },
      {
        hotkey: "ArrowDown",
        callback: selectNextFile,
        options: { enabled: isFocused && !overlayOpen },
      },
      {
        hotkey: "ArrowUp",
        callback: selectPreviousFile,
        options: { enabled: isFocused && !overlayOpen },
      },
    ],
    { enabled: !overlayOpen, conflictBehavior: "allow" }
  );
}

export function DiffView({ className }: DiffViewProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedCommitIds = useSelectedCommitIds();
  const selectedFilePath = useSelectedFilePath();
  const selectedChangeId = useSelectedChangeId();
  const viewMode = useViewMode();
  const workingChangesFingerprint = useWorkingChangesFingerprint();
  const isFocused = useIsFocused();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";
  const isDiffMaximized = useIsDiffMaximized();
  const toggleDiffMaximized = useAppStore((s) => s.toggleDiffMaximized);
  const changedFiles = useChangedFiles();
  const workingChanges = useWorkingChanges();
  const activeFiles = viewMode === "changes" ? workingChanges : changedFiles;

  // File navigation
  const {
    isFirstFile,
    isLastFile,
    canNavigate,
    selectPreviousFile,
    selectNextFile,
  } = useFileNavigation(
    activeFiles,
    selectedFilePath,
    selectedChangeId,
    viewMode
  );

  // In history mode, use selected commit(s). In changes mode, use working directory.
  const commitId = viewMode === "history" ? selectedCommitId : null;
  // Use stable empty array reference to avoid triggering useFileContents re-fetches
  const activeCommitIds =
    viewMode === "history" ? selectedCommitIds : EMPTY_COMMIT_IDS;

  // Refresh key triggers diff reload when the working changes fingerprint changes.
  // The fingerprint is data-driven (computed from file metadata during polling),
  // so diffs refresh automatically without manual coordination from mutation sites.
  const refreshKey = viewMode === "changes" ? workingChangesFingerprint : 0;

  // Determine the section for changes mode (staged vs unstaged)
  const selectedFileSection = resolveChangesSection(viewMode, selectedChangeId);

  const { contents, isLoading, error } = useFileContents(
    selectedRepo,
    selectedFilePath,
    commitId,
    activeCommitIds,
    refreshKey,
    selectedFileSection
  );

  const diffDisplayMode = useDiffDisplayMode();
  const setDiffDisplayMode = useAppStore((s) => s.setDiffDisplayMode);
  const wordWrap = useWordWrap();
  const toggleWordWrap = useAppStore((s) => s.toggleWordWrap);

  // Determine old/new values from contents
  const oldValue = contents?.old_content ?? "";
  const newValue = contents?.new_content ?? "";
  const isBinary = contents?.is_binary ?? false;

  const hasChanges = oldValue !== newValue;
  const hasData = contents !== null;

  // Detect if file is added or deleted (one side is empty)
  const isOneSided =
    hasData && (oldValue === "" || newValue === "") && hasChanges;

  // Force unified view for added/deleted files (split view wastes space)
  const effectiveDisplayMode = isOneSided ? "unified" : diffDisplayMode;

  const toggleDiffDisplayMode = () => {
    if (isOneSided) {
      return;
    }

    setDiffDisplayMode(diffDisplayMode === "split" ? "unified" : "split");
  };

  useDiffViewHotkeys({
    toggleDiffDisplayMode,
    selectNextFile,
    selectPreviousFile,
    isFocused,
  });

  const diffCacheKeyBase = useMemo(() => {
    const revisionKey =
      viewMode === "history"
        ? activeCommitIds.join(",") || commitId || "working-tree"
        : `${selectedChangeId ?? selectedFilePath ?? "working-tree"}:${refreshKey}`;

    return [
      selectedRepo?.id ?? "no-repo-id",
      selectedRepo?.path ?? "no-repo-path",
      revisionKey,
      selectedFilePath ?? "no-file",
    ].join(":");
  }, [
    activeCommitIds,
    commitId,
    refreshKey,
    selectedChangeId,
    selectedFilePath,
    selectedRepo?.id,
    selectedRepo?.path,
    viewMode,
  ]);

  const {
    buttonLabel: maximizeButtonLabel,
    tooltipLabel: maximizeTooltipLabel,
  } = getMaximizeLabels(isDiffMaximized);

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "flex h-10 items-center justify-between gap-2 pr-3 pl-2",
          "border-panel-border border-b",
          "bg-panel-header-bg",
          isFocused && "border-l-2 border-l-accent-primary"
        )}
      >
        <Provider delayDuration={1000}>
          <Root>
            <Trigger asChild>
              <button
                aria-label={maximizeButtonLabel}
                className={cn(
                  "mr-0.5 flex items-center justify-center rounded p-0.5",
                  "text-text-tertiary transition-colors",
                  "hover:bg-bg-hover hover:text-text-secondary"
                )}
                onClick={toggleDiffMaximized}
                title={maximizeTooltipLabel}
                type="button"
              >
                {isDiffMaximized ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            </Trigger>
            <Portal>
              <Content
                className={cn(
                  "z-50 rounded px-2 py-1 text-xs",
                  "bg-bg-tertiary text-text-primary",
                  "border border-panel-border shadow-lg",
                  "fade-in-0 zoom-in-95 animate-in duration-100"
                )}
                sideOffset={5}
              >
                {maximizeTooltipLabel}
              </Content>
            </Portal>
          </Root>

          {/* File navigation buttons */}
          <FileNavigationButtons
            canNavigate={canNavigate}
            isFirstFile={isFirstFile}
            isLastFile={isLastFile}
            onNext={selectNextFile}
            onPrevious={selectPreviousFile}
          />

          <h2 className="flex min-w-0 flex-1 overflow-hidden text-sm">
            <DiffFilePath path={selectedFilePath} />
          </h2>

          <div className="flex shrink-0 items-center gap-3">
            <div className="flex overflow-hidden rounded border border-border-primary">
              <Root>
                <Trigger asChild>
                  <button
                    aria-label="Split view"
                    className={cn(
                      "flex items-center justify-center p-1.5",
                      "transition-colors",
                      effectiveDisplayMode === "split"
                        ? "bg-bg-tertiary text-text-primary"
                        : "bg-bg-secondary text-text-tertiary",
                      !isOneSided &&
                        effectiveDisplayMode !== "split" &&
                        "hover:bg-bg-hover hover:text-text-secondary",
                      isOneSided && "cursor-not-allowed opacity-50"
                    )}
                    disabled={isOneSided}
                    onClick={() => setDiffDisplayMode("split")}
                    title="Split view (toggle |)"
                    type="button"
                  >
                    <SquareSplitHorizontal className="h-4 w-4" />
                  </button>
                </Trigger>
                <Portal>
                  <Content
                    className={cn(
                      "z-50 rounded px-2 py-1 text-xs",
                      "bg-bg-tertiary text-text-primary",
                      "border border-panel-border shadow-lg",
                      "fade-in-0 zoom-in-95 animate-in duration-100"
                    )}
                    sideOffset={5}
                  >
                    Split view (toggle |)
                  </Content>
                </Portal>
              </Root>
              <Root>
                <Trigger asChild>
                  <button
                    aria-label="Unified view"
                    className={cn(
                      "flex items-center justify-center p-1.5",
                      "border-border-primary border-l",
                      "transition-colors",
                      effectiveDisplayMode === "unified"
                        ? "bg-bg-tertiary text-text-primary"
                        : "bg-bg-secondary text-text-tertiary",
                      !isOneSided &&
                        effectiveDisplayMode !== "unified" &&
                        "hover:bg-bg-hover hover:text-text-secondary",
                      isOneSided && "cursor-not-allowed opacity-50"
                    )}
                    disabled={isOneSided}
                    onClick={() => setDiffDisplayMode("unified")}
                    title="Unified view (toggle |)"
                    type="button"
                  >
                    <Rows3 className="h-4 w-4" />
                  </button>
                </Trigger>
                <Portal>
                  <Content
                    className={cn(
                      "z-50 rounded px-2 py-1 text-xs",
                      "bg-bg-tertiary text-text-primary",
                      "border border-panel-border shadow-lg",
                      "fade-in-0 zoom-in-95 animate-in duration-100"
                    )}
                    sideOffset={5}
                  >
                    Unified view (toggle |)
                  </Content>
                </Portal>
              </Root>
            </div>
            <Root>
              <Trigger asChild>
                <button
                  aria-label="Toggle word wrap"
                  className={cn(
                    "flex items-center justify-center rounded p-1.5",
                    "border transition-colors",
                    wordWrap
                      ? "border-border-primary bg-bg-tertiary text-text-primary"
                      : "border-border-primary bg-bg-secondary text-text-tertiary hover:bg-bg-hover hover:text-text-secondary"
                  )}
                  onClick={toggleWordWrap}
                  type="button"
                >
                  <WrapText className="h-4 w-4" />
                </button>
              </Trigger>
              <Portal>
                <Content
                  className={cn(
                    "z-50 rounded px-2 py-1 text-xs",
                    "bg-bg-tertiary text-text-primary",
                    "border border-panel-border shadow-lg",
                    "fade-in-0 zoom-in-95 animate-in duration-100"
                  )}
                  sideOffset={5}
                >
                  {wordWrap ? "Word wrap on" : "Word wrap off"}
                </Content>
              </Portal>
            </Root>
          </div>
        </Provider>
      </div>

      <div className="diff-scroll-wrapper min-h-0 flex-1 select-text overflow-auto overscroll-none">
        <WorkerPoolContextProvider
          highlighterOptions={diffHighlighterOptions}
          poolOptions={diffWorkerPoolOptions}
        >
          <DiffContent
            cacheKeyBase={diffCacheKeyBase}
            error={error}
            filePath={selectedFilePath}
            hasChanges={hasChanges}
            hasData={hasData}
            hasFile={!!selectedFilePath}
            isBinary={isBinary}
            isDarkTheme={isDarkTheme}
            isLoading={isLoading}
            newValue={newValue}
            oldValue={oldValue}
            splitView={effectiveDisplayMode === "split"}
            wordWrap={wordWrap}
          />
        </WorkerPoolContextProvider>
      </div>
    </div>
  );
}

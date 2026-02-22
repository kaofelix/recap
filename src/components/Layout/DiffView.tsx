import {
  Content,
  Portal,
  Provider,
  Root,
  Trigger,
} from "@radix-ui/react-tooltip";
import {
  ChevronDown,
  ChevronUp,
  Maximize,
  Minimize,
  Rows3,
  SquareSplitHorizontal,
  WrapText,
} from "lucide-react";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useIsFocused } from "../../context/FocusContext";
import { useCommand } from "../../hooks/useCommand";
import { useFileContents } from "../../hooks/useFileContents";
import { useGlobalCommand } from "../../hooks/useGlobalCommand";
import { useTheme } from "../../hooks/useTheme";
import { getLanguageFromPath, highlightCode } from "../../lib/syntax";
import { cn, splitPath } from "../../lib/utils";
import {
  useAppStore,
  useChangedFiles,
  useIsDiffMaximized,
  useSelectedCommitId,
  useSelectedCommitIds,
  useSelectedFilePath,
  useSelectedRepo,
  useViewMode,
  useWorkingChangesRevision,
} from "../../store/appStore";
import type { ChangedFile } from "../../types/file";

export interface DiffViewProps {
  className?: string;
}

type DiffDisplayMode = "split" | "unified";

const NON_CONSECUTIVE_SELECTION_ERROR =
  "Unable to display diff for multiple non-consecutive commits";
const WORKING_DIFF_POLL_INTERVAL_MS = 2000;

/** Theme variables for the diff viewer using CSS variables */
const themeVariables = {
  light: {
    diffViewerBackground: "var(--color-panel-bg)",
    diffViewerColor: "var(--color-text-primary)",
    diffViewerTitleBackground: "var(--color-panel-header-bg)",
    diffViewerTitleColor: "var(--color-text-primary)",
    diffViewerTitleBorderColor: "var(--color-border-primary)",
    addedBackground: "var(--color-diff-add-bg)",
    addedColor: "var(--color-diff-add-text)",
    removedBackground: "var(--color-diff-delete-bg)",
    removedColor: "var(--color-diff-delete-text)",
    changedBackground: "var(--color-bg-hover)",
    wordAddedBackground: "var(--color-diff-add-word-bg)",
    wordRemovedBackground: "var(--color-diff-delete-word-bg)",
    addedGutterBackground: "var(--color-diff-add-gutter-bg)",
    removedGutterBackground: "var(--color-diff-delete-gutter-bg)",
    gutterBackground: "var(--color-panel-header-bg)",
    gutterBackgroundDark: "var(--color-bg-hover)",
    highlightBackground: "var(--color-bg-hover)",
    highlightGutterBackground: "var(--color-bg-hover)",
    gutterColor: "var(--color-text-tertiary)",
    addedGutterColor: "var(--color-text-primary)",
    removedGutterColor: "var(--color-text-primary)",
    codeFoldContentColor: "var(--color-text-secondary)",
    codeFoldBackground: "var(--color-bg-secondary)",
    codeFoldGutterBackground: "var(--color-bg-secondary)",
    emptyLineBackground: "var(--color-bg-secondary)",
  },
  dark: {
    diffViewerBackground: "var(--color-panel-bg)",
    diffViewerColor: "var(--color-text-primary)",
    diffViewerTitleBackground: "var(--color-panel-header-bg)",
    diffViewerTitleColor: "var(--color-text-primary)",
    diffViewerTitleBorderColor: "var(--color-border-primary)",
    addedBackground: "var(--color-diff-add-bg)",
    addedColor: "var(--color-diff-add-text)",
    removedBackground: "var(--color-diff-delete-bg)",
    removedColor: "var(--color-diff-delete-text)",
    changedBackground: "var(--color-bg-hover)",
    wordAddedBackground: "var(--color-diff-add-word-bg)",
    wordRemovedBackground: "var(--color-diff-delete-word-bg)",
    addedGutterBackground: "var(--color-diff-add-gutter-bg)",
    removedGutterBackground: "var(--color-diff-delete-gutter-bg)",
    gutterBackground: "var(--color-panel-header-bg)",
    gutterBackgroundDark: "var(--color-bg-hover)",
    highlightBackground: "var(--color-bg-hover)",
    highlightGutterBackground: "var(--color-bg-hover)",
    gutterColor: "var(--color-text-tertiary)",
    addedGutterColor: "var(--color-text-primary)",
    removedGutterColor: "var(--color-text-primary)",
    codeFoldContentColor: "var(--color-text-secondary)",
    codeFoldBackground: "var(--color-bg-secondary)",
    codeFoldGutterBackground: "var(--color-bg-secondary)",
    emptyLineBackground: "var(--color-bg-secondary)",
  },
};

/** Generate diff styles based on word wrap setting */
function getDiffStyles(wordWrap: boolean) {
  if (wordWrap) {
    // Word wrap enabled: always fit, no horizontal scroll
    return {
      variables: themeVariables,
      diffContainer: {
        minWidth: "unset",
        width: "100%",
        overflowX: "hidden" as const,
        tableLayout: "fixed" as const,
      },
      contentText: {
        whiteSpace: "pre-wrap" as const,
        wordBreak: "break-word" as const,
      },
    };
  }

  // Word wrap disabled: whole table scrolls horizontally together
  return {
    variables: themeVariables,
    diffContainer: {
      minWidth: "max-content",
      overflowX: "visible" as const,
      tableLayout: "auto" as const,
    },
    contentText: {
      whiteSpace: "pre" as const,
    },
  };
}

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
  changedFiles: ChangedFile[],
  selectedFilePath: string | null
) {
  const selectFile = useAppStore((s) => s.selectFile);

  const currentFileIndex = selectedFilePath
    ? changedFiles.findIndex((f) => f.path === selectedFilePath)
    : -1;
  const isFirstFile = currentFileIndex <= 0;
  const isLastFile =
    currentFileIndex === -1 || currentFileIndex >= changedFiles.length - 1;
  const canNavigate = changedFiles.length > 1;

  const selectPreviousFile = useCallback(() => {
    if (!isFirstFile && currentFileIndex > 0) {
      selectFile(changedFiles[currentFileIndex - 1].path);
    }
  }, [isFirstFile, currentFileIndex, changedFiles, selectFile]);

  const selectNextFile = useCallback(() => {
    if (!isLastFile && currentFileIndex < changedFiles.length - 1) {
      selectFile(changedFiles[currentFileIndex + 1].path);
    }
  }, [isLastFile, currentFileIndex, changedFiles, selectFile]);

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
  renderContent: (source: string) => ReactElement;
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
  renderContent,
}: DiffContentProps) {
  const diffStyles = useMemo(() => getDiffStyles(wordWrap), [wordWrap]);

  if (!hasFile) {
    return <DiffPlaceholder message="Select a file to view diff" />;
  }
  if (!hasData && isLoading) {
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
    <ReactDiffViewer
      compareMethod={DiffMethod.WORDS}
      hideLineNumbers={false}
      hideSummary
      infiniteLoading={{ pageSize: 100, containerHeight: "100%" }}
      newValue={newValue}
      oldValue={oldValue}
      renderContent={renderContent}
      splitView={splitView}
      styles={diffStyles}
      useDarkTheme={isDarkTheme}
    />
  );
}

export function DiffView({ className }: DiffViewProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedCommitIds = useSelectedCommitIds();
  const selectedFilePath = useSelectedFilePath();
  const viewMode = useViewMode();
  const workingChangesRevision = useWorkingChangesRevision();
  const isFocused = useIsFocused();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";
  const isDiffMaximized = useIsDiffMaximized();
  const toggleDiffMaximized = useAppStore((s) => s.toggleDiffMaximized);
  const changedFiles = useChangedFiles();

  // File navigation
  const {
    isFirstFile,
    isLastFile,
    canNavigate,
    selectPreviousFile,
    selectNextFile,
  } = useFileNavigation(changedFiles, selectedFilePath);

  const [workingDiffPollTick, setWorkingDiffPollTick] = useState(0);

  // In history mode, use selected commit(s). In changes mode, use working directory.
  const commitId = viewMode === "history" ? selectedCommitId : null;
  const activeCommitIds = viewMode === "history" ? selectedCommitIds : [];

  useEffect(() => {
    if (!(viewMode === "changes" && selectedRepo && selectedFilePath)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setWorkingDiffPollTick((tick) => tick + 1);
    }, WORKING_DIFF_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [selectedFilePath, selectedRepo, viewMode]);

  const refreshKey =
    viewMode === "changes" ? workingChangesRevision + workingDiffPollTick : 0;

  const { contents, isLoading, error } = useFileContents(
    selectedRepo,
    selectedFilePath,
    commitId,
    activeCommitIds,
    refreshKey
  );

  const [diffDisplayMode, setDiffDisplayMode] = useState<DiffDisplayMode>(
    () => {
      const saved = localStorage.getItem("diff-view-mode");
      return saved === "unified" || saved === "split" ? saved : "split";
    }
  );

  const [wordWrap, setWordWrap] = useState<boolean>(() => {
    const saved = localStorage.getItem("diff-word-wrap");
    return saved === null ? true : saved === "true";
  });

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem("diff-view-mode", diffDisplayMode);
  }, [diffDisplayMode]);

  // Persist word wrap preference
  useEffect(() => {
    localStorage.setItem("diff-word-wrap", String(wordWrap));
  }, [wordWrap]);

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

    setDiffDisplayMode((current) =>
      current === "split" ? "unified" : "split"
    );
  };

  useGlobalCommand("layout.toggleDiffDisplayMode", toggleDiffDisplayMode);

  // Keyboard navigation for files when diff view is focused
  useCommand("navigation.selectNext", selectNextFile);
  useCommand("navigation.selectPrev", selectPreviousFile);

  // Memoize the syntax highlighting render function
  const renderContent = useMemo(() => {
    const language = selectedFilePath
      ? getLanguageFromPath(selectedFilePath)
      : null;

    return (source: string) => (
      <span
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Prism output is safe
        dangerouslySetInnerHTML={{ __html: highlightCode(source, language) }}
      />
    );
  }, [selectedFilePath]);

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
        <Provider delayDuration={300}>
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
                  onClick={() => setWordWrap(!wordWrap)}
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

      <div className="min-h-0 flex-1 overflow-hidden">
        <DiffContent
          error={error}
          hasChanges={hasChanges}
          hasData={hasData}
          hasFile={!!selectedFilePath}
          isBinary={isBinary}
          isDarkTheme={isDarkTheme}
          isLoading={isLoading}
          newValue={newValue}
          oldValue={oldValue}
          renderContent={renderContent}
          splitView={effectiveDisplayMode === "split"}
          wordWrap={wordWrap}
        />
      </div>
    </div>
  );
}

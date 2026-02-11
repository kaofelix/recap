import {
  Content,
  Portal,
  Provider,
  Root,
  Trigger,
} from "@radix-ui/react-tooltip";
import { Rows3, SquareSplitHorizontal, WrapText } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useFileContents } from "../../hooks/useFileContents";
import { getLanguageFromPath, highlightCode } from "../../lib/syntax";
import { cn } from "../../lib/utils";
import {
  useSelectedCommitId,
  useSelectedFilePath,
  useSelectedRepo,
  useViewMode,
} from "../../store/appStore";

export interface DiffViewProps {
  className?: string;
}

type DiffDisplayMode = "split" | "unified";

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
    wordAddedBackground: "var(--color-diff-add-word-bg)",
    wordRemovedBackground: "var(--color-diff-delete-word-bg)",
    addedGutterBackground: "var(--color-diff-add-gutter-bg)",
    removedGutterBackground: "var(--color-diff-delete-gutter-bg)",
    gutterBackground: "var(--color-panel-header-bg)",
    gutterColor: "var(--color-text-tertiary)",
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
    wordAddedBackground: "var(--color-diff-add-word-bg)",
    wordRemovedBackground: "var(--color-diff-delete-word-bg)",
    addedGutterBackground: "var(--color-diff-add-gutter-bg)",
    removedGutterBackground: "var(--color-diff-delete-gutter-bg)",
    gutterBackground: "var(--color-panel-header-bg)",
    gutterColor: "var(--color-text-tertiary)",
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

/** Error message component */
function DiffError({ message }: { message: string }) {
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
  renderContent,
}: DiffContentProps) {
  const diffStyles = useMemo(() => getDiffStyles(wordWrap), [wordWrap]);

  if (!hasFile) {
    return <DiffPlaceholder message="Select a file to view diff" />;
  }
  if (isLoading) {
    return <DiffPlaceholder message="Loading diff..." />;
  }
  if (error) {
    return <DiffError message={error} />;
  }
  if (isBinary) {
    return <DiffPlaceholder message="Binary file cannot be displayed" />;
  }
  if (hasData && !hasChanges) {
    return <DiffPlaceholder message="No changes" />;
  }
  if (!hasData) {
    return null;
  }

  return (
    <ReactDiffViewer
      compareMethod={DiffMethod.WORDS}
      hideLineNumbers={false}
      newValue={newValue}
      oldValue={oldValue}
      renderContent={renderContent}
      splitView={splitView}
      styles={diffStyles}
      useDarkTheme={document.documentElement.classList.contains("dark")}
    />
  );
}

export function DiffView({ className }: DiffViewProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedFilePath = useSelectedFilePath();
  const viewMode = useViewMode();

  // In history mode, use the selected commit. In changes mode, use null (working directory).
  const commitId = viewMode === "history" ? selectedCommitId : null;

  const { contents, isLoading, error } = useFileContents(
    selectedRepo,
    selectedFilePath,
    commitId
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

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "flex h-10 items-center justify-between gap-2 px-3",
          "border-panel-border border-b",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="min-w-0 flex-1 truncate font-semibold text-sm text-text-primary">
          {selectedFilePath ?? "Diff"}
        </h2>
        <Provider delayDuration={300}>
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
                    Split view
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
                    Unified view
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

      <div className="flex-1 overflow-auto">
        <DiffContent
          error={error}
          hasChanges={hasChanges}
          hasData={hasData}
          hasFile={!!selectedFilePath}
          isBinary={isBinary}
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

import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { cn } from "../../lib/utils";
import {
  useSelectedCommitId,
  useSelectedFilePath,
  useSelectedRepo,
  useViewMode,
} from "../../store/appStore";
import type { FileContents, FileDiff } from "../../types/diff";

export interface DiffViewProps {
  className?: string;
}

type DiffDisplayMode = "split" | "unified";

/**
 * Convert a FileDiff (from working directory diff) to old/new content strings
 */
function fileDiffToContents(diff: FileDiff): {
  oldContent: string;
  newContent: string;
} {
  // Reconstruct the old and new content from the diff hunks
  // This is a simplification - for a proper implementation, we'd need
  // to fetch the actual file contents and apply the diff
  const oldLines: string[] = [];
  const newLines: string[] = [];

  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.line_type === "Context") {
        oldLines.push(line.content);
        newLines.push(line.content);
      } else if (line.line_type === "Deletion") {
        oldLines.push(line.content);
      } else if (line.line_type === "Addition") {
        newLines.push(line.content);
      }
    }
  }

  return {
    oldContent: oldLines.join(""),
    newContent: newLines.join(""),
  };
}

export function DiffView({ className }: DiffViewProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedFilePath = useSelectedFilePath();
  const appViewMode = useViewMode();

  const [fileContents, setFileContents] = useState<FileContents | null>(null);
  const [workingDiff, setWorkingDiff] = useState<FileDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffDisplayMode, setDiffDisplayMode] = useState<DiffDisplayMode>(
    () => {
      const saved = localStorage.getItem("diff-view-mode");
      return saved === "unified" || saved === "split" ? saved : "split";
    }
  );

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem("diff-view-mode", diffDisplayMode);
  }, [diffDisplayMode]);

  // Fetch diff for history mode (commit-based)
  useEffect(() => {
    if (
      appViewMode !== "history" ||
      !selectedRepo ||
      !selectedCommitId ||
      !selectedFilePath
    ) {
      setFileContents(null);
      return;
    }

    let cancelled = false;

    async function fetchFileContents() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<FileContents>("get_file_contents", {
          repoPath: selectedRepo?.path,
          commitId: selectedCommitId,
          filePath: selectedFilePath,
        });

        if (!cancelled) {
          setFileContents(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setFileContents(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchFileContents();

    return () => {
      cancelled = true;
    };
  }, [appViewMode, selectedRepo, selectedCommitId, selectedFilePath]);

  // Fetch diff for changes mode (working directory)
  useEffect(() => {
    if (appViewMode !== "changes" || !selectedRepo || !selectedFilePath) {
      setWorkingDiff(null);
      return;
    }

    let cancelled = false;

    async function fetchWorkingDiff() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<FileDiff>("get_working_file_diff", {
          repoPath: selectedRepo?.path,
          filePath: selectedFilePath,
        });

        if (!cancelled) {
          setWorkingDiff(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setWorkingDiff(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchWorkingDiff();

    return () => {
      cancelled = true;
    };
  }, [appViewMode, selectedRepo, selectedFilePath]);

  // Determine old/new values based on view mode
  let oldValue = "";
  let newValue = "";
  let isBinary = false;

  if (appViewMode === "history" && fileContents) {
    oldValue = fileContents.old_content ?? "";
    newValue = fileContents.new_content ?? "";
    isBinary = fileContents.is_binary;
  } else if (appViewMode === "changes" && workingDiff) {
    const contents = fileDiffToContents(workingDiff);
    oldValue = contents.oldContent;
    newValue = contents.newContent;
    isBinary = workingDiff.is_binary;
  }

  const hasChanges = oldValue !== newValue;
  const hasData =
    appViewMode === "history" ? fileContents !== null : workingDiff !== null;

  // Custom styles for the diff viewer
  const diffStyles = {
    variables: {
      light: {
        diffViewerBackground: "var(--color-panel-bg)",
        diffViewerColor: "var(--color-text-primary)",
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
    },
  };

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "flex h-10 items-center justify-between px-3",
          "border-panel-border border-b",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="truncate font-semibold text-sm text-text-primary">
          {selectedFilePath ?? "Diff"}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <button
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              "border border-border-primary",
              diffDisplayMode === "split"
                ? "bg-accent-muted text-text-primary"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-hover"
            )}
            onClick={() => setDiffDisplayMode("split")}
            type="button"
          >
            Split
          </button>
          <button
            className={cn(
              "rounded px-2 py-0.5 text-xs",
              "border border-border-primary",
              diffDisplayMode === "unified"
                ? "bg-accent-muted text-text-primary"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-hover"
            )}
            onClick={() => setDiffDisplayMode("unified")}
            type="button"
          >
            Unified
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!selectedFilePath && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Select a file to view diff
          </div>
        )}

        {selectedFilePath && isLoading && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Loading diff...
          </div>
        )}

        {selectedFilePath && error && (
          <div className="py-8 text-center text-red-500 text-sm">
            Error: {error}
          </div>
        )}

        {selectedFilePath && !isLoading && !error && isBinary && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Binary file cannot be displayed
          </div>
        )}

        {selectedFilePath &&
          !isLoading &&
          !error &&
          hasData &&
          !isBinary &&
          !hasChanges && (
            <div className="py-8 text-center text-sm text-text-secondary">
              No changes
            </div>
          )}

        {!(isLoading || error) && hasData && !isBinary && hasChanges && (
          <ReactDiffViewer
            compareMethod={DiffMethod.WORDS}
            hideLineNumbers={false}
            newValue={newValue}
            oldValue={oldValue}
            splitView={diffDisplayMode === "split"}
            styles={diffStyles}
            useDarkTheme={document.documentElement.classList.contains("dark")}
          />
        )}
      </div>
    </div>
  );
}

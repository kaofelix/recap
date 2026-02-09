import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { cn } from "../../lib/utils";
import {
  useSelectedRepo,
  useSelectedCommitId,
  useSelectedFilePath,
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
function fileDiffToContents(diff: FileDiff): { oldContent: string; newContent: string } {
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
  const [diffDisplayMode, setDiffDisplayMode] = useState<DiffDisplayMode>(() => {
    const saved = localStorage.getItem("diff-view-mode");
    return saved === "unified" || saved === "split" ? saved : "split";
  });

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem("diff-view-mode", diffDisplayMode);
  }, [diffDisplayMode]);

  // Fetch diff for history mode (commit-based)
  useEffect(() => {
    if (appViewMode !== "history" || !selectedRepo || !selectedCommitId || !selectedFilePath) {
      setFileContents(null);
      return;
    }

    let cancelled = false;

    async function fetchFileContents() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<FileContents>("get_file_contents", {
          repoPath: selectedRepo!.path,
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
          repoPath: selectedRepo!.path,
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
  const hasData = appViewMode === "history" ? fileContents !== null : workingDiff !== null;

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
    <div className={cn("h-full flex flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "h-10 flex items-center px-3 justify-between",
          "border-b border-panel-border",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="text-sm font-semibold text-text-primary truncate">
          {selectedFilePath ?? "Diff"}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setDiffDisplayMode("split")}
            className={cn(
              "px-2 py-0.5 rounded text-xs",
              "border border-border-primary",
              diffDisplayMode === "split"
                ? "bg-accent-muted text-text-primary"
                : "bg-bg-secondary hover:bg-bg-hover text-text-secondary"
            )}
          >
            Split
          </button>
          <button
            onClick={() => setDiffDisplayMode("unified")}
            className={cn(
              "px-2 py-0.5 rounded text-xs",
              "border border-border-primary",
              diffDisplayMode === "unified"
                ? "bg-accent-muted text-text-primary"
                : "bg-bg-secondary hover:bg-bg-hover text-text-secondary"
            )}
          >
            Unified
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {!selectedFilePath && (
          <div className="text-sm text-text-secondary text-center py-8">
            Select a file to view diff
          </div>
        )}

        {selectedFilePath && isLoading && (
          <div className="text-sm text-text-secondary text-center py-8">
            Loading diff...
          </div>
        )}

        {selectedFilePath && error && (
          <div className="text-sm text-red-500 text-center py-8">
            Error: {error}
          </div>
        )}

        {selectedFilePath && !isLoading && !error && isBinary && (
          <div className="text-sm text-text-secondary text-center py-8">
            Binary file cannot be displayed
          </div>
        )}

        {selectedFilePath && !isLoading && !error && hasData && !isBinary && !hasChanges && (
          <div className="text-sm text-text-secondary text-center py-8">
            No changes
          </div>
        )}

        {!isLoading && !error && hasData && !isBinary && hasChanges && (
          <ReactDiffViewer
            oldValue={oldValue}
            newValue={newValue}
            splitView={diffDisplayMode === "split"}
            useDarkTheme={document.documentElement.classList.contains("dark")}
            compareMethod={DiffMethod.WORDS}
            styles={diffStyles}
            hideLineNumbers={false}
          />
        )}
      </div>
    </div>
  );
}

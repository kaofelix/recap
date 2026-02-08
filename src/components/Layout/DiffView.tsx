import { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { cn } from "../../lib/utils";
import { useSelectedRepo, useSelectedCommitId, useSelectedFilePath } from "../../store/appStore";
import type { FileDiff } from "../../types/diff";

export interface DiffViewProps {
  className?: string;
}

type ViewMode = "split" | "unified";

/**
 * Convert our FileDiff hunks into old/new text strings for react-diff-viewer
 */
function diffToStrings(diff: FileDiff): { oldValue: string; newValue: string } {
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
    oldValue: oldLines.join("\n"),
    newValue: newLines.join("\n"),
  };
}

export function DiffView({ className }: DiffViewProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedFilePath = useSelectedFilePath();
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("diff-view-mode");
    return (saved === "unified" || saved === "split") ? saved : "split";
  });

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem("diff-view-mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!selectedRepo || !selectedCommitId || !selectedFilePath) {
      setDiff(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchDiff() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<FileDiff>("get_file_diff", {
          repoPath: selectedRepo!.path,
          commitId: selectedCommitId,
          filePath: selectedFilePath,
        });

        if (!cancelled) {
          setDiff(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setDiff(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchDiff();

    return () => {
      cancelled = true;
    };
  }, [selectedRepo, selectedCommitId, selectedFilePath]);

  // Convert diff to strings for the viewer
  const { oldValue, newValue } = useMemo(() => {
    if (!diff || diff.is_binary || diff.hunks.length === 0) {
      return { oldValue: "", newValue: "" };
    }
    return diffToStrings(diff);
  }, [diff]);

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
    <div
      className={cn(
        "h-full flex flex-col",
        "bg-panel-bg",
        className
      )}
    >
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
            onClick={() => setViewMode("split")}
            className={cn(
              "px-2 py-0.5 rounded text-xs",
              "border border-border-primary",
              viewMode === "split" 
                ? "bg-accent-muted text-text-primary" 
                : "bg-bg-secondary hover:bg-bg-hover text-text-secondary"
            )}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode("unified")}
            className={cn(
              "px-2 py-0.5 rounded text-xs",
              "border border-border-primary",
              viewMode === "unified" 
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

        {selectedFilePath && !isLoading && !error && diff?.is_binary && (
          <div className="text-sm text-text-secondary text-center py-8">
            Binary file cannot be displayed
          </div>
        )}

        {selectedFilePath && !isLoading && !error && diff && !diff.is_binary && diff.hunks.length === 0 && (
          <div className="text-sm text-text-secondary text-center py-8">
            No changes
          </div>
        )}

        {!isLoading && !error && diff && !diff.is_binary && diff.hunks.length > 0 && (
          <ReactDiffViewer
            oldValue={oldValue}
            newValue={newValue}
            splitView={viewMode === "split"}
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

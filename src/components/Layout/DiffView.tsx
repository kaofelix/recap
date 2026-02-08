import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { cn } from "../../lib/utils";
import { useSelectedRepo, useSelectedCommitId, useSelectedFilePath } from "../../store/appStore";
import type { FileContents } from "../../types/diff";

export interface DiffViewProps {
  className?: string;
}

type ViewMode = "split" | "unified";

export function DiffView({ className }: DiffViewProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedFilePath = useSelectedFilePath();
  const [fileContents, setFileContents] = useState<FileContents | null>(null);
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
      setFileContents(null);
      setError(null);
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
  }, [selectedRepo, selectedCommitId, selectedFilePath]);

  // Get old and new values for the diff viewer
  const oldValue = fileContents?.old_content ?? "";
  const newValue = fileContents?.new_content ?? "";
  const hasChanges = oldValue !== newValue;

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

        {selectedFilePath && !isLoading && !error && fileContents?.is_binary && (
          <div className="text-sm text-text-secondary text-center py-8">
            Binary file cannot be displayed
          </div>
        )}

        {selectedFilePath && !isLoading && !error && fileContents && !fileContents.is_binary && !hasChanges && (
          <div className="text-sm text-text-secondary text-center py-8">
            No changes
          </div>
        )}

        {!isLoading && !error && fileContents && !fileContents.is_binary && hasChanges && (
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

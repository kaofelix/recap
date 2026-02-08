import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";
import { useSelectedRepo, useSelectedCommitId, useSelectedFilePath } from "../../store/appStore";
import type { FileDiff, DiffHunk, DiffLine } from "../../types/diff";

export interface DiffViewProps {
  className?: string;
}

type ViewMode = "split" | "unified";

/**
 * Render a single diff line
 */
function DiffLineRow({ line, showOldLineNo, showNewLineNo }: { 
  line: DiffLine; 
  showOldLineNo?: boolean;
  showNewLineNo?: boolean;
}) {
  const bgClass = 
    line.line_type === "Addition" ? "bg-diff-add-bg" :
    line.line_type === "Deletion" ? "bg-diff-delete-bg" :
    "";
  
  const textClass =
    line.line_type === "Addition" ? "text-diff-add-text" :
    line.line_type === "Deletion" ? "text-diff-delete-text" :
    "text-text-primary";

  const prefix =
    line.line_type === "Addition" ? "+" :
    line.line_type === "Deletion" ? "-" :
    " ";

  return (
    <div className={cn("flex", bgClass)}>
      {showOldLineNo !== false && (
        <span className="w-12 px-2 text-right text-text-tertiary select-none shrink-0 border-r border-panel-border">
          {line.old_line_no ?? ""}
        </span>
      )}
      {showNewLineNo !== false && (
        <span className="w-12 px-2 text-right text-text-tertiary select-none shrink-0 border-r border-panel-border">
          {line.new_line_no ?? ""}
        </span>
      )}
      <span className={cn("px-1 select-none shrink-0", textClass)}>{prefix}</span>
      <pre className={cn("flex-1 px-1", textClass)}>
        {line.content}
      </pre>
    </div>
  );
}

/**
 * Render a hunk header
 */
function HunkHeader({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="bg-diff-hunk-bg text-text-secondary px-2 py-1 text-xs">
      @@ -{hunk.old_start},{hunk.old_lines} +{hunk.new_start},{hunk.new_lines} @@
    </div>
  );
}

/**
 * Render diff in unified view
 */
function UnifiedDiff({ diff }: { diff: FileDiff }) {
  return (
    <div className="font-mono text-sm">
      {diff.hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx}>
          <HunkHeader hunk={hunk} />
          {hunk.lines.map((line, lineIdx) => (
            <DiffLineRow key={lineIdx} line={line} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * A row in the split view - either a line or an empty placeholder
 */
interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/**
 * Convert hunk lines into paired rows for split view.
 * Context lines appear on both sides, deletions on left only, additions on right only.
 */
function createSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    if (line.line_type === "Context") {
      // Context lines go on both sides
      rows.push({ left: line, right: line });
      i++;
    } else if (line.line_type === "Deletion") {
      // Collect consecutive deletions
      const deletions: DiffLine[] = [];
      while (i < lines.length && lines[i].line_type === "Deletion") {
        deletions.push(lines[i]);
        i++;
      }
      // Collect consecutive additions that follow
      const additions: DiffLine[] = [];
      while (i < lines.length && lines[i].line_type === "Addition") {
        additions.push(lines[i]);
        i++;
      }
      // Pair them up
      const maxLen = Math.max(deletions.length, additions.length);
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          left: deletions[j] ?? null,
          right: additions[j] ?? null,
        });
      }
    } else if (line.line_type === "Addition") {
      // Addition without preceding deletion
      rows.push({ left: null, right: line });
      i++;
    }
  }
  
  return rows;
}

/**
 * Render a single side of a split row
 */
function SplitCell({ line, side }: { line: DiffLine | null; side: "left" | "right" }) {
  if (!line) {
    // Empty placeholder
    return (
      <div className="flex bg-bg-secondary/50">
        <span className="w-12 px-2 text-right text-text-tertiary select-none shrink-0 border-r border-panel-border">
          
        </span>
        <span className="px-1 select-none shrink-0"> </span>
        <pre className="flex-1 px-1"> </pre>
      </div>
    );
  }

  const bgClass = 
    line.line_type === "Addition" ? "bg-diff-add-bg" :
    line.line_type === "Deletion" ? "bg-diff-delete-bg" :
    "";
  
  const textClass =
    line.line_type === "Addition" ? "text-diff-add-text" :
    line.line_type === "Deletion" ? "text-diff-delete-text" :
    "text-text-primary";

  const prefix =
    line.line_type === "Addition" ? "+" :
    line.line_type === "Deletion" ? "-" :
    " ";

  const lineNo = side === "left" ? line.old_line_no : line.new_line_no;

  return (
    <div className={cn("flex", bgClass)}>
      <span className="w-12 px-2 text-right text-text-tertiary select-none shrink-0 border-r border-panel-border">
        {lineNo ?? ""}
      </span>
      <span className={cn("px-1 select-none shrink-0", textClass)}>{prefix}</span>
      <pre className={cn("flex-1 px-1", textClass)}>
        {line.content}
      </pre>
    </div>
  );
}

/**
 * Render diff in split (side-by-side) view
 */
function SplitDiff({ diff }: { diff: FileDiff }) {
  return (
    <div className="font-mono text-sm">
      {diff.hunks.map((hunk, hunkIdx) => {
        const rows = createSplitRows(hunk.lines);
        return (
          <div key={hunkIdx}>
            {/* Hunk header spanning both sides */}
            <div className="flex">
              <div className="flex-1 bg-diff-hunk-bg text-text-secondary px-2 py-1 text-xs border-r border-panel-border">
                @@ -{hunk.old_start},{hunk.old_lines} @@
              </div>
              <div className="flex-1 bg-diff-hunk-bg text-text-secondary px-2 py-1 text-xs">
                @@ +{hunk.new_start},{hunk.new_lines} @@
              </div>
            </div>
            {/* Paired rows */}
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex">
                <div className="flex-1 border-r border-panel-border overflow-hidden">
                  <SplitCell line={row.left} side="left" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <SplitCell line={row.right} side="right" />
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
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
          viewMode === "split" ? <SplitDiff diff={diff} /> : <UnifiedDiff diff={diff} />
        )}
      </div>
    </div>
  );
}

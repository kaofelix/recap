import {
  Content,
  Portal,
  Provider,
  Root,
  Trigger,
} from "@radix-ui/react-tooltip";
import { useState } from "react";
import { useContextMenuState } from "../../context/ContextMenuContext";
import { cn, splitPath } from "../../lib/utils";
import type { ChangedFile, FileStatus, WorkingFile } from "../../types/file";

export interface FileListItemProps {
  file: ChangedFile | WorkingFile;
  isSelected: boolean;
  isFocused?: boolean;
  onClick: () => void;
  itemId?: string;
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  /** Whether this item has the context menu open */
  isContextMenuTarget?: boolean;
}

/**
 * Clear any text selection in the window.
 * Prevents ugly selection state when right-clicking.
 */
function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

/**
 * Get the status letter indicator
 */
function getStatusLetter(status: FileStatus): string {
  switch (status) {
    case "Added":
      return "A";
    case "Modified":
      return "M";
    case "Deleted":
      return "D";
    case "Renamed":
      return "R";
    case "Copied":
      return "C";
    case "Untracked":
      return "?";
    default:
      return "?";
  }
}

/**
 * Get the badge color classes for a file status
 */
function getStatusBadgeClasses(status: FileStatus): string {
  switch (status) {
    case "Added":
      return "bg-success/20 text-success";
    case "Modified":
      return "bg-warning/20 text-warning";
    case "Deleted":
      return "bg-danger/20 text-danger";
    case "Renamed":
    case "Copied":
      return "bg-info/20 text-info";
    case "Untracked":
      return "bg-success/20 text-success";
    default:
      return "bg-text-secondary/20 text-text-secondary";
  }
}

/**
 * Format diff stats for display in tooltip
 */
function formatStatsTooltip(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0) {
    parts.push(`+${additions}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }
  return parts.length > 0 ? `  ${parts.join(" ")}` : "";
}

/**
 * Check if file is a WorkingFile
 */
function isWorkingFile(file: ChangedFile | WorkingFile): file is WorkingFile {
  return "section" in file;
}

/**
 * Get display status for a file (handles both ChangedFile and WorkingFile)
 */
function getDisplayStatus(file: ChangedFile | WorkingFile): FileStatus {
  if (isWorkingFile(file)) {
    return file.section === "staged"
      ? (file.staged_status ?? "Unmodified")
      : (file.unstaged_status ?? "Unmodified");
  }
  return file.status;
}

/**
 * Get display stats for a file (handles both ChangedFile and WorkingFile)
 */
function getDisplayStats(file: ChangedFile | WorkingFile): {
  additions: number;
  deletions: number;
} {
  if (isWorkingFile(file)) {
    return file.section === "staged"
      ? { additions: file.staged_additions, deletions: file.staged_deletions }
      : {
          additions: file.unstaged_additions,
          deletions: file.unstaged_deletions,
        };
  }
  return { additions: file.additions, deletions: file.deletions };
}

export function FileListItem({
  file,
  isSelected,
  isFocused = false,
  onClick,
  itemId,
  onContextMenu,
  onKeyDown,
  isContextMenuTarget = false,
}: FileListItemProps) {
  const { dir, filename } = splitPath(file.path);
  const displayStatus = getDisplayStatus(file);
  const { additions, deletions } = getDisplayStats(file);
  const tooltipText = `${file.path}${formatStatsTooltip(additions, deletions)}`;

  // Global context menu state to disable tooltips when any menu is open
  const { isOpen: isAnyContextMenuOpen } = useContextMenuState();

  const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Clear text selection before showing context menu
    clearTextSelection();
    // Call the provided handler
    onContextMenu?.(event);
  };

  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <button
      className={cn(
        "file-list-item flex w-full cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-left",
        // Selected state: filled background
        isSelected &&
          (isFocused ? "bg-accent-muted" : "bg-list-selected-unfocused"),
        // Context menu target: outline highlight (like Finder)
        isContextMenuTarget &&
          !isSelected &&
          "outline outline-1 outline-[var(--color-text-secondary)] outline-offset-[-1px]"
      )}
      data-item-id={itemId}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onKeyDown={onKeyDown}
      type="button"
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded font-medium text-xs",
          getStatusBadgeClasses(displayStatus)
        )}
        title={displayStatus}
      >
        {getStatusLetter(displayStatus)}
      </span>
      {isAnyContextMenuOpen ? (
        // Skip tooltip entirely when context menu is open (avoids timer issues)
        <span className="flex min-w-0 flex-1 overflow-hidden text-sm">
          {dir && (
            <span className="shrink truncate text-text-secondary">{dir}</span>
          )}
          <span className="shrink-0 font-medium text-text-primary">
            {filename}
          </span>
        </span>
      ) : (
        <Provider delayDuration={1000}>
          <Root onOpenChange={setTooltipOpen} open={tooltipOpen}>
            <Trigger asChild>
              <span className="flex min-w-0 flex-1 overflow-hidden text-sm">
                {dir && (
                  <span className="shrink truncate text-text-secondary">
                    {dir}
                  </span>
                )}
                <span className="shrink-0 font-medium text-text-primary">
                  {filename}
                </span>
              </span>
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
                {tooltipText}
              </Content>
            </Portal>
          </Root>
        </Provider>
      )}
      {(additions > 0 || deletions > 0) && (
        <span className="file-list-item-stats flex shrink-0 gap-1 text-xs">
          {additions > 0 && <span className="text-success">+{additions}</span>}
          {deletions > 0 && <span className="text-danger">-{deletions}</span>}
        </span>
      )}
    </button>
  );
}

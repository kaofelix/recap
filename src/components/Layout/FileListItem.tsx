import { cn } from "../../lib/utils";
import type { ChangedFile, FileStatus } from "../../types/file";

export interface FileListItemProps {
  file: ChangedFile;
  isSelected: boolean;
  onClick: () => void;
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
 * Split a file path into directory and filename parts.
 * Returns { dir, filename } where dir includes the trailing slash.
 */
function splitPath(path: string): { dir: string; filename: string } {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) {
    return { dir: "", filename: path };
  }
  return {
    dir: path.slice(0, lastSlash + 1),
    filename: path.slice(lastSlash + 1),
  };
}

export function FileListItem({ file, isSelected, onClick }: FileListItemProps) {
  const { dir, filename } = splitPath(file.path);

  return (
    <div
      onClick={onClick}
      className={cn(
        "px-2 py-1.5 rounded cursor-pointer flex items-center gap-2",
        "hover:bg-bg-hover",
        isSelected && "bg-accent-muted"
      )}
    >
      <span
        className={cn(
          "w-5 h-5 rounded text-xs font-medium flex items-center justify-center shrink-0",
          getStatusBadgeClasses(file.status)
        )}
        title={file.status}
      >
        {getStatusLetter(file.status)}
      </span>
      <span className="text-sm truncate flex-1 min-w-0">
        {dir && <span className="text-text-secondary">{dir}</span>}
        <span className="text-text-primary font-medium">{filename}</span>
      </span>
      {(file.additions > 0 || file.deletions > 0) && (
        <span className="text-xs shrink-0 flex gap-1">
          {file.additions > 0 && (
            <span className="text-success">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-danger">-{file.deletions}</span>
          )}
        </span>
      )}
    </div>
  );
}

import {
  Content,
  Portal,
  Provider,
  Root,
  Trigger,
} from "@radix-ui/react-tooltip";
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
    <button
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left",
        "hover:bg-bg-hover",
        isSelected && "bg-accent-muted"
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded font-medium text-xs",
          getStatusBadgeClasses(file.status)
        )}
        title={file.status}
      >
        {getStatusLetter(file.status)}
      </span>
      <Provider delayDuration={300}>
        <Root>
          <Trigger asChild>
            <span className="flex min-w-0 flex-1 text-sm">
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
                "rounded px-2 py-1 text-xs",
                "bg-bg-tertiary text-text-primary",
                "border border-panel-border shadow-lg",
                "fade-in-0 zoom-in-95 animate-in duration-100"
              )}
              sideOffset={5}
            >
              {file.path}
            </Content>
          </Portal>
        </Root>
      </Provider>
      {(file.additions > 0 || file.deletions > 0) && (
        <span className="flex shrink-0 gap-1 text-xs">
          {file.additions > 0 && (
            <span className="text-success">+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className="text-danger">-{file.deletions}</span>
          )}
        </span>
      )}
    </button>
  );
}

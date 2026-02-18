import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "../../context/FocusContext";
import { useNavigableList } from "../../hooks/useNavigableList";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useSelectedCommitId,
  useSelectedCommitIds,
  useSelectedFilePath,
  useSelectedRepo,
} from "../../store/appStore";
import type { ChangedFile } from "../../types/file";
import { FileListItem } from "./FileListItem";

export interface FileListProps {
  className?: string;
}

interface UseCommitFilesResult {
  files: ChangedFile[];
  isLoading: boolean;
  error: string | null;
}

const COMMIT_FETCH_DEBOUNCE_MS = 120;
const NON_CONSECUTIVE_SELECTION_ERROR =
  "Unable to display diff for multiple non-consecutive commits";

async function fetchCommitFiles(
  repoPath: string,
  commitId: string
): Promise<ChangedFile[]> {
  return invoke<ChangedFile[]>("get_commit_files", { repoPath, commitId });
}

async function fetchCommitRangeFiles(
  repoPath: string,
  commitIds: string[]
): Promise<ChangedFile[]> {
  return invoke<ChangedFile[]>("get_commit_range_files", {
    repoPath,
    commitIds,
  });
}

function useCommitFiles(): UseCommitFilesResult {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedCommitIds = useSelectedCommitIds();
  const selectFile = useAppStore((state) => state.selectFile);
  const setChangedFiles = useAppStore((state) => state.setChangedFiles);
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousSelectionRef = useRef<{
    repoPath: string | null;
    commitKey: string | null;
  }>({
    repoPath: null,
    commitKey: null,
  });

  useEffect(() => {
    if (!(selectedRepo && selectedCommitId)) {
      previousSelectionRef.current = { repoPath: null, commitKey: null };
      setFiles([]);
      setError(null);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    const repoPath = selectedRepo.path;
    const activeCommitIds =
      selectedCommitIds.length > 0 ? selectedCommitIds : [selectedCommitId];
    const commitKey = activeCommitIds.join("::");

    const previousSelection = previousSelectionRef.current;
    const shouldDebounce =
      previousSelection.repoPath === repoPath &&
      previousSelection.commitKey !== null &&
      previousSelection.commitKey !== commitKey;

    previousSelectionRef.current = { repoPath, commitKey };

    setIsLoading(true);
    setError(null);

    const runFetch = () => {
      const request =
        activeCommitIds.length > 1
          ? fetchCommitRangeFiles(repoPath, activeCommitIds)
          : fetchCommitFiles(repoPath, activeCommitIds[0]);

      request
        .then((result) => {
          if (cancelled) {
            return;
          }
          setFiles(result);
          setChangedFiles(result);
          if (result.length > 0) {
            selectFile(result[0].path);
          }
        })
        .catch((err) => {
          if (cancelled) {
            return;
          }
          setError(err instanceof Error ? err.message : String(err));
          setFiles([]);
          setChangedFiles([]);
          selectFile(null);
        })
        .finally(() => {
          if (cancelled) {
            return;
          }
          setIsLoading(false);
        });
    };

    if (shouldDebounce) {
      timeoutId = window.setTimeout(runFetch, COMMIT_FETCH_DEBOUNCE_MS);
    } else {
      runFetch();
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    selectedRepo,
    selectedCommitId,
    selectedCommitIds,
    selectFile,
    setChangedFiles,
  ]);

  return { files, isLoading, error };
}

function FileListContent({
  hasCommit,
  isLoading,
  error,
  files,
  selectedFilePath,
  getItemProps,
  isFocused,
}: {
  hasCommit: boolean;
  isLoading: boolean;
  error: string | null;
  files: ChangedFile[];
  selectedFilePath: string | null;
  isFocused: boolean;
  getItemProps: (id: string) => {
    "aria-selected": boolean;
    "data-item-id": string;
    onClick: () => void;
  };
}) {
  if (!hasCommit) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        Select a commit to view changed files
      </div>
    );
  }

  if (isLoading && files.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        Loading files...
      </div>
    );
  }

  if (error && files.length === 0) {
    if (error.includes(NON_CONSECUTIVE_SELECTION_ERROR)) {
      return (
        <div className="py-8 text-center text-sm text-text-secondary">
          {NON_CONSECUTIVE_SELECTION_ERROR}
        </div>
      );
    }

    return (
      <div className="py-8 text-center text-red-500 text-sm">
        Error: {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        No files changed
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {files.map((file) => {
        const itemProps = getItemProps(file.path);

        return (
          <FileListItem
            file={file}
            isFocused={isFocused}
            isSelected={selectedFilePath === file.path}
            itemId={itemProps["data-item-id"]}
            key={file.path}
            onClick={itemProps.onClick}
          />
        );
      })}
    </div>
  );
}

export function FileList({ className }: FileListProps) {
  const selectedCommitId = useSelectedCommitId();
  const selectedCommitIds = useSelectedCommitIds();
  const selectedFilePath = useSelectedFilePath();
  const selectFile = useAppStore((state) => state.selectFile);
  const { files, isLoading, error } = useCommitFiles();
  const isFocused = useIsFocused();
  let activeCommitIds: string[] = [];
  if (selectedCommitIds.length > 0) {
    activeCommitIds = selectedCommitIds;
  } else if (selectedCommitId) {
    activeCommitIds = [selectedCommitId];
  }

  const isMultiCommitSelection = activeCommitIds.length > 1;

  const itemIds = files.map((file) => file.path);
  const effectiveSelectedFilePath = selectedFilePath ?? files[0]?.path ?? null;

  const { containerProps, getItemProps } = useNavigableList({
    itemIds,
    onSelect: selectFile,
    selectedId: effectiveSelectedFilePath,
  });

  return (
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "flex h-10 items-center gap-2 px-3",
          "border-panel-border border-b",
          "bg-panel-header-bg",
          isFocused && "border-l-2 border-l-accent-primary"
        )}
      >
        <h2 className="shrink-0 font-semibold text-sm text-text-primary">
          Files
        </h2>
        {files.length > 0 && (
          <span className="shrink-0 text-text-secondary text-xs">
            ({files.length})
          </span>
        )}
        {isMultiCommitSelection && (
          <span className="min-w-0 truncate text-text-secondary text-xs">
            Showing changes from {activeCommitIds.length} commits
          </span>
        )}
      </div>

      <div {...containerProps} className="flex-1 overflow-auto p-2">
        <FileListContent
          error={error}
          files={files}
          getItemProps={getItemProps}
          hasCommit={!!selectedCommitId}
          isFocused={isFocused}
          isLoading={isLoading}
          selectedFilePath={effectiveSelectedFilePath}
        />
      </div>
    </div>
  );
}

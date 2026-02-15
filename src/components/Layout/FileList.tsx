import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { useIsFocused } from "../../context/FocusContext";
import { useNavigableList } from "../../hooks/useNavigableList";
import { cn } from "../../lib/utils";
import {
  useAppStore,
  useSelectedCommitId,
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

async function fetchCommitFiles(
  repoPath: string,
  commitId: string
): Promise<ChangedFile[]> {
  return invoke<ChangedFile[]>("get_commit_files", { repoPath, commitId });
}

function useCommitFiles(): UseCommitFilesResult {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectFile = useAppStore((state) => state.selectFile);
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!(selectedRepo && selectedCommitId)) {
      setFiles([]);
      setError(null);
      return;
    }

    let cancelled = false;
    const repoPath = selectedRepo.path;

    setIsLoading(true);
    setError(null);

    fetchCommitFiles(repoPath, selectedCommitId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setFiles(result);
        if (result.length > 0) {
          selectFile(result[0].path);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRepo, selectedCommitId, selectFile]);

  return { files, isLoading, error };
}

function FileListContent({
  hasCommit,
  isLoading,
  error,
  files,
  selectedFilePath,
  getItemProps,
}: {
  hasCommit: boolean;
  isLoading: boolean;
  error: string | null;
  files: ChangedFile[];
  selectedFilePath: string | null;
  getItemProps: (id: string) => {
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
  const selectedFilePath = useSelectedFilePath();
  const selectFile = useAppStore((state) => state.selectFile);
  const { files, isLoading, error } = useCommitFiles();
  const isFocused = useIsFocused();

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
      </div>

      <div {...containerProps} className="flex-1 overflow-auto p-2">
        <FileListContent
          error={error}
          files={files}
          getItemProps={getItemProps}
          hasCommit={!!selectedCommitId}
          isLoading={isLoading}
          selectedFilePath={effectiveSelectedFilePath}
        />
      </div>
    </div>
  );
}

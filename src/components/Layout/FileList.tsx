import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../../lib/utils";
import { useAppStore, useSelectedRepo, useSelectedCommitId, useSelectedFilePath } from "../../store/appStore";
import { FileListItem } from "./FileListItem";
import type { ChangedFile } from "../../types/file";

export interface FileListProps {
  className?: string;
}

export function FileList({ className }: FileListProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedFilePath = useSelectedFilePath();
  const selectFile = useAppStore((state) => state.selectFile);
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedRepo || !selectedCommitId) {
      setFiles([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchFiles() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<ChangedFile[]>("get_commit_files", {
          repoPath: selectedRepo!.path,
          commitId: selectedCommitId,
        });

        if (!cancelled) {
          setFiles(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setFiles([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchFiles();

    return () => {
      cancelled = true;
    };
  }, [selectedRepo, selectedCommitId]);

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
          "h-10 flex items-center px-3",
          "border-b border-panel-border",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="text-sm font-semibold text-text-primary">
          Changed Files
        </h2>
        {files.length > 0 && (
          <span className="ml-2 text-xs text-text-secondary">
            ({files.length} {files.length === 1 ? "file" : "files"})
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2">
        {!selectedCommitId && (
          <div className="text-sm text-text-secondary text-center py-8">
            Select a commit to view changed files
          </div>
        )}

        {selectedCommitId && isLoading && (
          <div className="text-sm text-text-secondary text-center py-8">
            Loading files...
          </div>
        )}

        {selectedCommitId && error && (
          <div className="text-sm text-red-500 text-center py-8">
            Error: {error}
          </div>
        )}

        {selectedCommitId && !isLoading && !error && files.length === 0 && (
          <div className="text-sm text-text-secondary text-center py-8">
            No files changed
          </div>
        )}

        {!isLoading && !error && files.length > 0 && (
          <div className="space-y-0.5">
            {files.map((file) => (
              <FileListItem
                key={file.path}
                file={file}
                isSelected={selectedFilePath === file.path}
                onClick={() => selectFile(file.path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

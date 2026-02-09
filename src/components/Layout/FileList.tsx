import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
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

export function FileList({ className }: FileListProps) {
  const selectedRepo = useSelectedRepo();
  const selectedCommitId = useSelectedCommitId();
  const selectedFilePath = useSelectedFilePath();
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

    async function fetchFiles() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<ChangedFile[]>("get_commit_files", {
          repoPath: selectedRepo?.path,
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
    <div className={cn("flex h-full flex-col", "bg-panel-bg", className)}>
      <div
        className={cn(
          "flex h-10 items-center px-3",
          "border-panel-border border-b",
          "bg-panel-header-bg"
        )}
      >
        <h2 className="font-semibold text-sm text-text-primary">
          Changed Files
        </h2>
        {files.length > 0 && (
          <span className="ml-2 text-text-secondary text-xs">
            ({files.length} {files.length === 1 ? "file" : "files"})
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-2">
        {!selectedCommitId && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Select a commit to view changed files
          </div>
        )}

        {selectedCommitId && isLoading && (
          <div className="py-8 text-center text-sm text-text-secondary">
            Loading files...
          </div>
        )}

        {selectedCommitId && error && (
          <div className="py-8 text-center text-red-500 text-sm">
            Error: {error}
          </div>
        )}

        {selectedCommitId && !isLoading && !error && files.length === 0 && (
          <div className="py-8 text-center text-sm text-text-secondary">
            No files changed
          </div>
        )}

        {!(isLoading || error) && files.length > 0 && (
          <div className="space-y-0.5">
            {files.map((file) => (
              <FileListItem
                file={file}
                isSelected={selectedFilePath === file.path}
                key={file.path}
                onClick={() => selectFile(file.path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

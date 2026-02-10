import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "../store/appStore";
import type { ChangedFile } from "../types/file";
import type { Repository } from "../types/repository";

interface UseWorkingChangesResult {
  changes: ChangedFile[];
  isLoading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Clear file selection if the selected file is no longer in the changes list.
 */
function clearStaleSelection(
  changes: ChangedFile[],
  selectFile: (path: string | null) => void
): void {
  const currentSelectedFile = useAppStore.getState().selectedFilePath;
  const fileStillExists = changes.some(
    (file) => file.path === currentSelectedFile
  );

  if (currentSelectedFile && !fileStillExists) {
    selectFile(null);
  }
}

/**
 * Fetch working changes for a repository with auto-polling when active.
 * Clears file selection when the selected file is no longer in the changes list.
 */
export function useWorkingChanges(
  selectedRepo: Repository | null,
  isActive: boolean
): UseWorkingChangesResult {
  const [changes, setChanges] = useState<ChangedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectFile = useAppStore((state) => state.selectFile);

  const fetchChanges = useCallback(
    async (isInitialLoad: boolean) => {
      if (!selectedRepo) {
        return;
      }

      // Only show loading state on initial load, not during background refreshes
      if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await invoke<ChangedFile[]>("get_working_changes", {
          repoPath: selectedRepo.path,
        });
        setChanges(result);
        clearStaleSelection(result, selectFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setChanges([]);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    },
    [selectFile, selectedRepo]
  );

  useEffect(() => {
    if (!(selectedRepo && isActive)) {
      setChanges([]);
      setError(null);
      return;
    }

    fetchChanges(true);

    const intervalId = setInterval(() => fetchChanges(false), POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchChanges, isActive, selectedRepo]);

  return { changes, isLoading, error };
}

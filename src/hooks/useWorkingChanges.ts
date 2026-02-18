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
 * Keep file selection aligned with available changes.
 * - Preserve current selection when it still exists.
 * - Auto-select the first change when there is no valid selection.
 * - Clear selection when there are no changes.
 */
function reconcileSelection(
  changes: ChangedFile[],
  selectFile: (path: string | null) => void
): void {
  const currentSelectedFile = useAppStore.getState().selectedFilePath;

  if (changes.length === 0) {
    if (currentSelectedFile !== null) {
      selectFile(null);
    }
    return;
  }

  const fileStillExists = changes.some(
    (file) => file.path === currentSelectedFile
  );

  if (fileStillExists) {
    return;
  }

  selectFile(changes[0].path);
}

/**
 * Fetch working changes for a repository with auto-polling when active.
 * Keeps file selection synchronized with the current changes list.
 */
export function useWorkingChanges(
  selectedRepo: Repository | null,
  isActive: boolean
): UseWorkingChangesResult {
  const [changes, setChanges] = useState<ChangedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectFile = useAppStore((state) => state.selectFile);
  const setChangedFiles = useAppStore((state) => state.setChangedFiles);
  const bumpWorkingChangesRevision = useAppStore(
    (state) => state.bumpWorkingChangesRevision
  );

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
        setChangedFiles(result);
        reconcileSelection(result, selectFile);

        // Trigger diff refresh for the selected file during background polling.
        if (!isInitialLoad) {
          bumpWorkingChangesRevision();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setChanges([]);
        setChangedFiles([]);
      } finally {
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    },
    [bumpWorkingChangesRevision, selectFile, selectedRepo, setChangedFiles]
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

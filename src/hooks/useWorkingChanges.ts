import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { buildWorkingChangesListModel } from "../lib/workingChangesList";
import { useAppStore } from "../store/appStore";
import type { WorkingFile } from "../types/file";
import type { Repository } from "../types/repository";

interface UseWorkingChangesResult {
  changes: WorkingFile[];
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
  changes: WorkingFile[],
  selectChange: (id: string | null) => void
): void {
  const { selectedChangeId, selectedFilePath } = useAppStore.getState();
  const listModel = buildWorkingChangesListModel(changes);

  if (listModel.items.length === 0) {
    if (selectedChangeId !== null || selectedFilePath !== null) {
      selectChange(null);
    }
    return;
  }

  if (
    selectedChangeId !== null &&
    listModel.items.some((item) => item.id === selectedChangeId)
  ) {
    return;
  }

  if (selectedFilePath) {
    const firstMatchingPathItem = listModel.items.find(
      (item) => item.path === selectedFilePath
    );

    if (firstMatchingPathItem) {
      selectChange(firstMatchingPathItem.id);
      return;
    }
  }

  selectChange(listModel.items[0].id);
}

/**
 * Fetch working changes for a repository with auto-polling when active.
 * Keeps file selection synchronized with the current changes list.
 */
export function useWorkingChanges(
  selectedRepo: Repository | null,
  isActive: boolean
): UseWorkingChangesResult {
  const [changes, setChanges] = useState<WorkingFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectChange = useAppStore((state) => state.selectChange);
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
        const result = await invoke<WorkingFile[]>("get_working_changes_ex", {
          repoPath: selectedRepo.path,
        });
        setChanges(result);
        setChangedFiles(result);
        reconcileSelection(result, selectChange);

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
    [bumpWorkingChangesRevision, selectChange, selectedRepo, setChangedFiles]
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

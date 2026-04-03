import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import {
  useAppStore,
  useSelectedCommitIds,
  useSelectedRepo,
} from "../store/appStore";
import type { ChangedFile } from "../types/file";

const COMMIT_FETCH_DEBOUNCE_MS = 120;

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

/**
 * Select the first file after commit files are loaded.
 *
 * This is the history-mode equivalent of `reconcileSelection` in
 * `useRepoPolling` — a clear, separate reconciliation step rather than
 * an inline side effect mixed with fetching logic.
 */
function reconcileCommitFileSelection(
  files: ChangedFile[],
  selectFile: (path: string | null) => void
): void {
  if (files.length > 0) {
    selectFile(files[0].path);
  }
}

/**
 * Side-effect hook that fetches commit files and writes them to the store.
 *
 * This hook owns the store fields: `changedFiles`, `isLoadingCommitFiles`,
 * and `commitFilesError` when in history mode. It has no local state —
 * consumers read everything from the store via selectors.
 */
export function useCommitFiles(): void {
  const selectedRepo = useSelectedRepo();
  const selectedCommitIds = useSelectedCommitIds();
  const selectFile = useAppStore((state) => state.selectFile);
  const setChangedFiles = useAppStore((state) => state.setChangedFiles);
  const setCommitFilesLoading = useAppStore(
    (state) => state.setCommitFilesLoading
  );
  const setCommitFilesError = useAppStore((state) => state.setCommitFilesError);
  const previousSelectionRef = useRef<{
    repoPath: string | null;
    commitKey: string | null;
  }>({
    repoPath: null,
    commitKey: null,
  });

  useEffect(() => {
    if (!(selectedRepo && selectedCommitIds.length > 0)) {
      previousSelectionRef.current = { repoPath: null, commitKey: null };
      setChangedFiles([]);
      setCommitFilesLoading(false);
      setCommitFilesError(null);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;
    const repoPath = selectedRepo.path;
    const commitKey = selectedCommitIds.join("::");

    const previousSelection = previousSelectionRef.current;
    const shouldDebounce =
      previousSelection.repoPath === repoPath &&
      previousSelection.commitKey !== null &&
      previousSelection.commitKey !== commitKey;

    previousSelectionRef.current = { repoPath, commitKey };

    setCommitFilesLoading(true);
    setCommitFilesError(null);

    const runFetch = () => {
      const request =
        selectedCommitIds.length > 1
          ? fetchCommitRangeFiles(repoPath, selectedCommitIds)
          : fetchCommitFiles(repoPath, selectedCommitIds[0]);

      request
        .then((result) => {
          if (cancelled) {
            return;
          }
          setChangedFiles(result);
          setCommitFilesLoading(false);
          setCommitFilesError(null);
          reconcileCommitFileSelection(result, selectFile);
        })
        .catch((err) => {
          if (cancelled) {
            return;
          }
          setChangedFiles([]);
          setCommitFilesLoading(false);
          setCommitFilesError(err instanceof Error ? err.message : String(err));
          selectFile(null);
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
    selectedCommitIds,
    selectFile,
    setChangedFiles,
    setCommitFilesLoading,
    setCommitFilesError,
  ]);
}

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef } from "react";
import { buildWorkingChangesListModel } from "../lib/workingChangesList";
import { useAppStore } from "../store/appStore";
import type { Commit } from "../types/commit";
import type { WorkingFile } from "../types/file";
import type { Repository } from "../types/repository";
import { useAppVisibility } from "./useAppVisibility";

const POLL_INTERVAL_MS = 2000;
const POLL_INTERVAL_BACKGROUND_MS = 30_000;

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
 * Unified polling hook for repository data.
 *
 * This hook manages all background data fetching for the app:
 * - Commits: Always polled when a repo is selected
 * - Working changes: Polled when in "changes" view mode
 *
 * Uses visibility-aware polling:
 * - Fast (2s) when app is visible and focused
 * - Slow (30s) when app is in background
 *
 * Should be called once at app level (e.g., in AppLayout).
 */
export function useRepoPolling(selectedRepo: Repository | null): void {
  const isAppVisible = useAppVisibility();
  const viewMode = useAppStore((state) => state.viewMode);
  const commitLimit = useAppStore((state) => state.commitLimit);
  const authorFilter = useAppStore((state) => state.authorFilter);

  // Store actions
  const setCommits = useAppStore((state) => state.setCommits);
  const setCommitsLoading = useAppStore((state) => state.setCommitsLoading);
  const setCommitsError = useAppStore((state) => state.setCommitsError);
  const setWorkingChanges = useAppStore((state) => state.setWorkingChanges);
  const setChangesLoading = useAppStore((state) => state.setChangesLoading);
  const setChangesError = useAppStore((state) => state.setChangesError);
  const setChangedFiles = useAppStore((state) => state.setChangedFiles);
  const setUnpushedCount = useAppStore((state) => state.setUnpushedCount);
  const setBehindCount = useAppStore((state) => state.setBehindCount);
  const setCurrentBranchName = useAppStore(
    (state) => state.setCurrentBranchName
  );
  const setHasMoreCommits = useAppStore((state) => state.setHasMoreCommits);
  const selectChange = useAppStore((state) => state.selectChange);
  const bumpWorkingChangesRevision = useAppStore(
    (state) => state.bumpWorkingChangesRevision
  );

  // Track if this is the initial load (for loading states)
  const isInitialCommitsLoad = useRef(true);
  const isInitialChangesLoad = useRef(true);
  // Track previous working changes to detect actual changes
  const prevWorkingChangesRef = useRef<string | null>(null);

  const fetchCommits = useCallback(async () => {
    if (!selectedRepo) {
      return;
    }

    const isInitial = isInitialCommitsLoad.current;
    if (isInitial) {
      setCommitsLoading(true);
      isInitialCommitsLoad.current = false;
    }

    const listCommitsArgs: Record<string, unknown> = {
      repoPath: selectedRepo.path,
      limit: commitLimit,
    };
    if (authorFilter.length > 0) {
      listCommitsArgs.authorEmails = authorFilter;
    }

    try {
      const result = await invoke<Commit[]>("list_commits", listCommitsArgs);
      setCommits(result);
      setCommitsError(null);
      setHasMoreCommits(result.length >= commitLimit);
    } catch (err) {
      setCommitsError(err instanceof Error ? err.message : String(err));
      setCommits([]);
    } finally {
      if (isInitial) {
        setCommitsLoading(false);
      }
    }

    // Fetch ahead/behind in parallel (non-blocking — errors just clear the count)
    try {
      const ab = await invoke<{ ahead: number; behind: number }>(
        "get_ahead_behind",
        { repoPath: selectedRepo.path }
      );
      setUnpushedCount(ab.ahead);
      setBehindCount(ab.behind);
    } catch {
      // No upstream or detached HEAD — clear the indicator
      setUnpushedCount(null);
      setBehindCount(null);
    }

    // Fetch current branch name (non-blocking — errors clear it)
    try {
      const branchName = await invoke<string>("get_current_branch", {
        repoPath: selectedRepo.path,
      });
      setCurrentBranchName(branchName);
    } catch {
      setCurrentBranchName(null);
    }
  }, [
    selectedRepo,
    commitLimit,
    authorFilter,
    setCommits,
    setCommitsLoading,
    setCommitsError,
    setUnpushedCount,
    setBehindCount,
    setCurrentBranchName,
    setHasMoreCommits,
  ]);

  const fetchWorkingChanges = useCallback(async () => {
    if (!selectedRepo) {
      return;
    }

    const isInitial = isInitialChangesLoad.current;
    if (isInitial) {
      setChangesLoading(true);
      isInitialChangesLoad.current = false;
    }

    try {
      const result = await invoke<WorkingFile[]>("get_working_changes_ex", {
        repoPath: selectedRepo.path,
      });
      setWorkingChanges(result);
      setChangedFiles(result);
      setChangesError(null);
      reconcileSelection(result, selectChange);

      // Only bump revision if working changes actually changed
      // This prevents unnecessary re-fetches of file contents
      const fingerprint = JSON.stringify(
        result.map((f) => ({
          path: f.path,
          section: f.section,
          staged_additions: f.staged_additions,
          staged_deletions: f.staged_deletions,
          unstaged_additions: f.unstaged_additions,
          unstaged_deletions: f.unstaged_deletions,
        }))
      );

      if (!isInitial && fingerprint !== prevWorkingChangesRef.current) {
        bumpWorkingChangesRevision();
      }
      prevWorkingChangesRef.current = fingerprint;
    } catch (err) {
      setChangesError(err instanceof Error ? err.message : String(err));
      setWorkingChanges([]);
      setChangedFiles([]);
    } finally {
      if (isInitial) {
        setChangesLoading(false);
      }
    }
  }, [
    selectedRepo,
    setWorkingChanges,
    setChangedFiles,
    setChangesLoading,
    setChangesError,
    selectChange,
    bumpWorkingChangesRevision,
  ]);

  // Combined fetch function
  const poll = useCallback(async () => {
    // Always fetch commits when repo is selected
    await fetchCommits();

    // Only fetch working changes when in changes mode
    if (viewMode === "changes") {
      await fetchWorkingChanges();
    }
  }, [fetchCommits, fetchWorkingChanges, viewMode]);

  // Reset initial load flags when repo changes
  useEffect(() => {
    isInitialCommitsLoad.current = true;
    isInitialChangesLoad.current = true;

    if (!selectedRepo) {
      // Clear all data when no repo selected
      setCommits([]);
      setCommitsError(null);
      setCommitsLoading(false);
      setWorkingChanges([]);
      setChangedFiles([]);
      setChangesError(null);
      setChangesLoading(false);
      setUnpushedCount(null);
      setBehindCount(null);
      setCurrentBranchName(null);
    }
  }, [
    selectedRepo,
    setCommits,
    setCommitsError,
    setCommitsLoading,
    setWorkingChanges,
    setChangedFiles,
    setChangesError,
    setChangesLoading,
    setUnpushedCount,
    setBehindCount,
    setCurrentBranchName,
  ]);

  // Reset initial changes load flag when switching to changes mode
  useEffect(() => {
    if (viewMode === "changes") {
      isInitialChangesLoad.current = true;
    }
  }, [viewMode]);

  // Main polling effect
  useEffect(() => {
    if (!selectedRepo) {
      return;
    }

    // Initial fetch
    poll();

    // Set up polling interval (faster when visible, slower in background)
    const interval = isAppVisible
      ? POLL_INTERVAL_MS
      : POLL_INTERVAL_BACKGROUND_MS;

    const intervalId = setInterval(poll, interval);

    return () => {
      clearInterval(intervalId);
    };
  }, [selectedRepo, isAppVisible, poll]);
}

import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import {
  getAheadBehind,
  getCurrentBranch,
  getWorkingChanges,
  listCommits,
} from "../api/commands";
import { buildWorkingChangesListModel } from "../lib/workingChangesList";
import { useAppStore } from "../store/appStore";
import type { WorkingFile } from "../types/file";
import type { Repository } from "../types/repository";
import { useAppVisibility } from "./useAppVisibility";

const POLL_INTERVAL_MS = 2000;
const POLL_INTERVAL_BACKGROUND_MS = 30_000;

function isLatestRequest(
  latestRepoPathRef: React.MutableRefObject<string | null>,
  requestIdRef: React.MutableRefObject<number>,
  repoPath: string,
  requestId: number
): boolean {
  return (
    latestRepoPathRef.current === repoPath && requestIdRef.current === requestId
  );
}

/**
 * Keep file selection aligned with available changes.
 * - Preserve current selection when it still exists.
 * - Auto-select the first change when there is no valid selection.
 * - Clear selection when there are no changes.
 */
function reconcileSelection(
  changes: WorkingFile[],
  selectChange: (id: string | null) => void,
  selectedChangeId: string | null,
  selectedFilePath: string | null
): void {
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
 * - Working changes: Always polled when a repo is selected
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
  const selectedChangeId = useAppStore((state) => state.selectedChangeId);
  const selectedFilePath = useAppStore((state) => state.selectedFilePath);
  const setChangedFiles = useAppStore((state) => state.setChangedFiles);

  const setUnpushedCount = useAppStore((state) => state.setUnpushedCount);
  const setBehindCount = useAppStore((state) => state.setBehindCount);
  const setCurrentBranchName = useAppStore(
    (state) => state.setCurrentBranchName
  );
  const setHasMoreCommits = useAppStore((state) => state.setHasMoreCommits);
  const selectChange = useAppStore((state) => state.selectChange);
  const setWorkingChangesFingerprint = useAppStore(
    (state) => state.setWorkingChangesFingerprint
  );
  const workingChangesPollRequest = useAppStore(
    (state) => state.workingChangesPollRequest
  );

  // Track if this is the initial load (for loading states)
  const isInitialCommitsLoad = useRef(true);
  const isInitialChangesLoad = useRef(true);
  const latestRepoPathRef = useRef<string | null>(selectedRepo?.path ?? null);
  const commitsRequestIdRef = useRef(0);
  const changesRequestIdRef = useRef(0);

  useEffect(() => {
    latestRepoPathRef.current = selectedRepo?.path ?? null;
  }, [selectedRepo]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: polling coordinates multiple async requests with stale-request guards.
  const fetchCommits = useCallback(async () => {
    if (!selectedRepo) {
      return;
    }

    const repoPath = selectedRepo.path;
    const requestId = commitsRequestIdRef.current + 1;
    commitsRequestIdRef.current = requestId;

    const isInitial = isInitialCommitsLoad.current;
    if (isInitial) {
      setCommitsLoading(true);
      isInitialCommitsLoad.current = false;
    }

    try {
      const result = await listCommits(repoPath, {
        limit: commitLimit,
        authorEmails: authorFilter.length > 0 ? authorFilter : undefined,
      });
      if (
        !isLatestRequest(
          latestRepoPathRef,
          commitsRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
      setCommits(result);
      setCommitsError(null);
      setHasMoreCommits(result.length >= commitLimit);
    } catch (err) {
      if (
        !isLatestRequest(
          latestRepoPathRef,
          commitsRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
      setCommitsError(err instanceof Error ? err.message : String(err));
      setCommits([]);
    } finally {
      if (
        isInitial &&
        isLatestRequest(
          latestRepoPathRef,
          commitsRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        setCommitsLoading(false);
      }
    }

    // Fetch ahead/behind in parallel (non-blocking — errors just clear the count)
    try {
      const ab = await getAheadBehind(repoPath);
      if (
        !isLatestRequest(
          latestRepoPathRef,
          commitsRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
      setUnpushedCount(ab.ahead);
      setBehindCount(ab.behind);
    } catch {
      if (
        !isLatestRequest(
          latestRepoPathRef,
          commitsRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
      // No upstream or detached HEAD — clear the indicator
      setUnpushedCount(null);
      setBehindCount(null);
    }

    // Fetch current branch name (non-blocking — errors clear it)
    try {
      const branchName = await getCurrentBranch(repoPath);
      if (
        !isLatestRequest(
          latestRepoPathRef,
          commitsRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
      setCurrentBranchName(branchName);
    } catch {
      if (
        !isLatestRequest(
          latestRepoPathRef,
          commitsRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
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

    const repoPath = selectedRepo.path;
    const requestId = changesRequestIdRef.current + 1;
    changesRequestIdRef.current = requestId;

    const isInitial = isInitialChangesLoad.current;
    if (isInitial) {
      setChangesLoading(true);
      isInitialChangesLoad.current = false;
    }

    try {
      const result = await getWorkingChanges(repoPath);
      if (
        !isLatestRequest(
          latestRepoPathRef,
          changesRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
      setWorkingChanges(result);
      if (viewMode === "changes") {
        reconcileSelection(
          result,
          selectChange,
          selectedChangeId,
          selectedFilePath
        );
      }
      setChangesError(null);

      // Compute a data-driven fingerprint of the working changes.
      // mtime_ms is included so edits that don't change line counts
      // (e.g., modifying the content of an already-modified line) still
      // trigger a diff refresh.
      // Zustand only re-renders subscribers when the value actually changes,
      // so setting the same fingerprint is a no-op for consumers.
      const fingerprint = JSON.stringify(
        result.map((f) => ({
          path: f.path,
          section: f.section,
          staged_additions: f.staged_additions,
          staged_deletions: f.staged_deletions,
          unstaged_additions: f.unstaged_additions,
          unstaged_deletions: f.unstaged_deletions,
          mtime_ms: f.mtime_ms,
        }))
      );
      setWorkingChangesFingerprint(fingerprint);
    } catch (err) {
      if (
        !isLatestRequest(
          latestRepoPathRef,
          changesRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        return;
      }
      setChangesError(err instanceof Error ? err.message : String(err));
      setWorkingChanges([]);
    } finally {
      if (
        isInitial &&
        isLatestRequest(
          latestRepoPathRef,
          changesRequestIdRef,
          repoPath,
          requestId
        )
      ) {
        setChangesLoading(false);
      }
    }
  }, [
    selectedRepo,
    viewMode,
    selectedChangeId,
    selectedFilePath,
    setWorkingChanges,
    setChangesLoading,
    setChangesError,
    selectChange,
    setWorkingChangesFingerprint,
  ]);

  // Combined fetch function
  const poll = useCallback(async () => {
    // Always fetch commits when repo is selected
    await fetchCommits();

    // Always fetch working changes so the sidebar can surface them immediately
    await fetchWorkingChanges();
  }, [fetchCommits, fetchWorkingChanges]);

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

  // Respond to explicit poll requests from mutation sites (stage/unstage/discard/commit)
  // This provides immediate feedback rather than waiting for the next poll cycle.
  useEffect(() => {
    if (!selectedRepo || workingChangesPollRequest === 0) {
      return;
    }
    fetchWorkingChanges();
  }, [selectedRepo, workingChangesPollRequest, fetchWorkingChanges]);

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

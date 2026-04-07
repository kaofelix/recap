import { create } from "zustand";
import { persist } from "zustand/middleware";
import { parseWorkingChangeId } from "../lib/workingChangesList";
import type { Commit } from "../types/commit";
import type { ChangedFile, WorkingFile } from "../types/file";
import type { FocusRegion } from "../types/focus";
import type { Repository } from "../types/repository";

export type ViewMode = "history" | "changes";
export type DiffDisplayMode = "split" | "unified";

export interface PollingState {
  commits: Commit[];
  isLoadingCommits: boolean;
  commitsError: string | null;
  workingChanges: WorkingFile[];
  isLoadingChanges: boolean;
  changesError: string | null;
}

export interface AppState {
  repos: Repository[];
  selectedRepoId: string | null;
  selectedCommitIds: string[];
  selectedFilePath: string | null;
  selectedChangeId: string | null;
  changedFiles: (ChangedFile | WorkingFile)[];
  isLoadingCommitFiles: boolean;
  commitFilesError: string | null;
  viewMode: ViewMode;
  focusedRegion: FocusRegion | null;
  isDiffMaximized: boolean;
  workingChangesFingerprint: string;
  workingChangesPollRequest: number;

  // Polling state (managed by useRepoPolling)
  commits: Commit[];
  isLoadingCommits: boolean;
  commitsError: string | null;
  workingChanges: WorkingFile[];
  isLoadingChanges: boolean;
  changesError: string | null;
  /** Number of local commits not yet pushed to the upstream branch, or null if unknown */
  unpushedCount: number | null;
  /** Number of upstream commits not yet merged locally, or null if unknown */
  behindCount: number | null;
  /** Name of the currently checked-out branch, or null if unknown */
  currentBranchName: string | null;
  /** Author emails selected for filtering commits (empty = show all) */
  authorFilter: string[];
  /** Number of commits to fetch from the backend */
  commitLimit: number;
  /** Whether there are more commits to load beyond the current limit */
  hasMoreCommits: boolean;

  /** Whether any overlay (dropdown, context menu) is currently open */
  overlayOpen: boolean;

  // DiffView preferences
  /** Whether the diff viewer shows split or unified mode */
  diffDisplayMode: DiffDisplayMode;
  /** Whether word wrap is enabled in the diff viewer */
  wordWrap: boolean;

  addRepo: (path: string) => void;
  removeRepo: (id: string) => void;
  selectRepo: (id: string | null) => void;
  selectCommit: (id: string | null) => void;
  selectCommitRange: (ids: string[]) => void;
  toggleCommitSelection: (id: string) => void;
  selectFile: (path: string | null) => void;
  selectChange: (id: string | null) => void;
  setChangedFiles: (files: (ChangedFile | WorkingFile)[]) => void;
  setCommitFilesLoading: (isLoading: boolean) => void;
  setCommitFilesError: (error: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setFocusedRegion: (region: FocusRegion | null) => void;
  setDiffMaximized: (maximized: boolean) => void;
  toggleDiffMaximized: () => void;
  setWorkingChangesFingerprint: (fingerprint: string) => void;
  requestWorkingChangesPoll: () => void;
  clearRepos: () => void;

  // Polling actions
  setCommits: (commits: Commit[]) => void;
  setCommitsLoading: (isLoading: boolean) => void;
  setCommitsError: (error: string | null) => void;
  setWorkingChanges: (changes: WorkingFile[]) => void;
  setChangesLoading: (isLoading: boolean) => void;
  setChangesError: (error: string | null) => void;
  setUnpushedCount: (count: number | null) => void;
  setBehindCount: (count: number | null) => void;
  setCurrentBranchName: (name: string | null) => void;
  toggleAuthorFilter: (email: string) => void;
  clearAuthorFilter: () => void;
  loadMoreCommits: () => void;
  setHasMoreCommits: (hasMore: boolean) => void;
  setOverlayOpen: (open: boolean) => void;
  setDiffDisplayMode: (mode: DiffDisplayMode) => void;
  toggleWordWrap: () => void;
}

/**
 * Extract repository name from path.
 * Takes the last segment of the path as the repo name.
 */
function extractRepoName(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/");
  return segments.at(-1) || path;
}

/**
 * Generate a unique ID for a repository.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      repos: [],
      selectedRepoId: null,
      selectedCommitIds: [],
      selectedFilePath: null,
      selectedChangeId: null,
      changedFiles: [],
      isLoadingCommitFiles: false,
      commitFilesError: null,
      viewMode: "history" as ViewMode,
      focusedRegion: null,
      isDiffMaximized: false,
      workingChangesFingerprint: "",
      workingChangesPollRequest: 0,

      // Polling state
      commits: [],
      isLoadingCommits: false,
      commitsError: null,
      workingChanges: [],
      isLoadingChanges: false,
      changesError: null,
      unpushedCount: null,
      behindCount: null,
      currentBranchName: null,
      authorFilter: [],
      commitLimit: 50,
      hasMoreCommits: true,

      overlayOpen: false,

      // DiffView preferences
      diffDisplayMode: "split" as DiffDisplayMode,
      wordWrap: true,

      addRepo: (path: string) => {
        const { repos } = get();

        // Don't add duplicates
        if (repos.some((r) => r.path === path)) {
          return;
        }

        const newRepo: Repository = {
          id: generateId(),
          path,
          name: extractRepoName(path),
          addedAt: Date.now(),
        };

        // Auto-select the newly added repo
        set({ repos: [...repos, newRepo], selectedRepoId: newRepo.id });
      },

      removeRepo: (id: string) => {
        const { repos, selectedRepoId } = get();
        const newRepos = repos.filter((r) => r.id !== id);

        // Auto-select first remaining repo if removed repo was selected
        let newSelectedId = selectedRepoId;
        if (selectedRepoId === id) {
          newSelectedId = newRepos.length > 0 ? newRepos[0].id : null;
        }

        set({
          repos: newRepos,
          selectedRepoId: newSelectedId,
          // Clear commit/file selection when repo changes
          ...(newSelectedId !== selectedRepoId && {
            selectedCommitIds: [],
            selectedFilePath: null,
            selectedChangeId: null,
            changedFiles: [],
            isLoadingCommitFiles: false,
            commitFilesError: null,
          }),
        });
      },

      selectRepo: (id: string | null) => {
        const { repos } = get();

        // Only select if repo exists or if clearing selection
        if (id === null || repos.some((r) => r.id === id)) {
          // Clear commit and file selection when repo changes
          set({
            selectedRepoId: id,
            selectedCommitIds: [],
            selectedFilePath: null,
            selectedChangeId: null,
            changedFiles: [],
            isLoadingCommitFiles: false,
            commitFilesError: null,
            authorFilter: [],
            commitLimit: 50,
            hasMoreCommits: true,
          });
        }
      },

      selectCommit: (id: string | null) => {
        // Clear file selection when commit changes.
        // changedFiles is managed exclusively by the commit-files hook
        // so we don't clear it here — the hook will replace it after fetching.
        set({
          selectedCommitIds: id ? [id] : [],
          selectedFilePath: null,
          selectedChangeId: null,
        });
      },

      selectCommitRange: (ids: string[]) => {
        const normalized = [...new Set(ids)];
        set({
          selectedCommitIds: normalized,
          selectedFilePath: null,
          selectedChangeId: null,
        });
      },

      toggleCommitSelection: (id: string) => {
        set((state) => {
          const exists = state.selectedCommitIds.includes(id);
          const selectedCommitIds = exists
            ? state.selectedCommitIds.filter((commitId) => commitId !== id)
            : [...state.selectedCommitIds, id];

          return {
            selectedCommitIds,
            selectedFilePath: null,
            selectedChangeId: null,
          };
        });
      },

      selectFile: (path: string | null) => {
        set({ selectedFilePath: path, selectedChangeId: null });
      },

      selectChange: (id: string | null) => {
        if (id === null) {
          set({ selectedFilePath: null, selectedChangeId: null });
          return;
        }

        const parsed = parseWorkingChangeId(id);
        if (!parsed) {
          set({ selectedFilePath: null, selectedChangeId: null });
          return;
        }

        set({ selectedFilePath: parsed.path, selectedChangeId: id });
      },

      setChangedFiles: (files: (ChangedFile | WorkingFile)[]) => {
        set({ changedFiles: files });
      },

      setCommitFilesLoading: (isLoadingCommitFiles: boolean) =>
        set({ isLoadingCommitFiles }),
      setCommitFilesError: (commitFilesError: string | null) =>
        set({ commitFilesError }),

      setViewMode: (mode: ViewMode) => {
        // Don't clear changedFiles — each mode's writer will manage it:
        // - history: useCommitFiles replaces changedFiles on fetch
        // - changes: DiffView reads workingChanges directly
        set({
          viewMode: mode,
          selectedFilePath: null,
          selectedChangeId: null,
          isDiffMaximized: false,
        });
      },

      setFocusedRegion: (region: FocusRegion | null) => {
        set({ focusedRegion: region });
      },

      setDiffMaximized: (maximized: boolean) => {
        set({ isDiffMaximized: maximized });
      },

      toggleDiffMaximized: () => {
        set((state) => {
          const willBeMaximized = !state.isDiffMaximized;
          return {
            isDiffMaximized: willBeMaximized,
            // Auto-focus diff panel when maximizing
            ...(willBeMaximized && { focusedRegion: "diff" as FocusRegion }),
          };
        });
      },

      setWorkingChangesFingerprint: (workingChangesFingerprint: string) => {
        set({ workingChangesFingerprint });
      },

      requestWorkingChangesPoll: () => {
        set((state) => ({
          workingChangesPollRequest: state.workingChangesPollRequest + 1,
        }));
      },

      clearRepos: () => {
        set({
          repos: [],
          selectedRepoId: null,
          selectedCommitIds: [],
          selectedFilePath: null,
          selectedChangeId: null,
          changedFiles: [],
          isLoadingCommitFiles: false,
          commitFilesError: null,
          isDiffMaximized: false,
          workingChangesFingerprint: "",
          workingChangesPollRequest: 0,
          commits: [],
          isLoadingCommits: false,
          commitsError: null,
          workingChanges: [],
          isLoadingChanges: false,
          changesError: null,
          unpushedCount: null,
          behindCount: null,
          currentBranchName: null,
          authorFilter: [],
          commitLimit: 50,
          hasMoreCommits: true,
          overlayOpen: false,
        });
      },

      // Polling actions
      setCommits: (commits: Commit[]) => set({ commits }),
      setCommitsLoading: (isLoadingCommits: boolean) =>
        set({ isLoadingCommits }),
      setCommitsError: (commitsError: string | null) => set({ commitsError }),
      setWorkingChanges: (workingChanges: WorkingFile[]) =>
        set({ workingChanges }),
      setChangesLoading: (isLoadingChanges: boolean) =>
        set({ isLoadingChanges }),
      setChangesError: (changesError: string | null) => set({ changesError }),
      setUnpushedCount: (unpushedCount: number | null) =>
        set({ unpushedCount }),
      setBehindCount: (behindCount: number | null) => set({ behindCount }),
      setCurrentBranchName: (currentBranchName: string | null) =>
        set({ currentBranchName }),
      toggleAuthorFilter: (email: string) =>
        set((state) => {
          const exists = state.authorFilter.includes(email);
          return {
            authorFilter: exists
              ? state.authorFilter.filter((e) => e !== email)
              : [...state.authorFilter, email],
            commitLimit: 50,
            hasMoreCommits: true,
          };
        }),
      clearAuthorFilter: () =>
        set({ authorFilter: [], commitLimit: 50, hasMoreCommits: true }),
      loadMoreCommits: () =>
        set((state) => {
          if (!state.hasMoreCommits) {
            return {};
          }
          return { commitLimit: state.commitLimit + 50 };
        }),
      setHasMoreCommits: (hasMoreCommits: boolean) => set({ hasMoreCommits }),
      setOverlayOpen: (overlayOpen: boolean) => set({ overlayOpen }),
      setDiffDisplayMode: (diffDisplayMode: DiffDisplayMode) =>
        set({ diffDisplayMode }),
      toggleWordWrap: () => set((state) => ({ wordWrap: !state.wordWrap })),
    }),
    {
      name: "recap-storage",
      version: 3,
      partialize: (state) => ({
        repos: state.repos,
        selectedRepoId: state.selectedRepoId,
        viewMode: state.viewMode,
        authorFilter: state.authorFilter,
        diffDisplayMode: state.diffDisplayMode,
        wordWrap: state.wordWrap,
      }),
      migrate: (persisted: unknown, version: number) => {
        const persistedState = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          // v0 → v1: remove old selectedCommitId field
          const { selectedCommitId: _selectedCommitId, ...state } =
            persistedState;
          return state;
        }
        if (version < 2) {
          // v1 → v2: strip volatile fields (now handled by partialize,
          // but clean up any stale data from old persisted state)
          const { repos, selectedRepoId, viewMode, authorFilter } =
            persistedState;
          return {
            repos: repos ?? [],
            selectedRepoId: selectedRepoId ?? null,
            viewMode: viewMode ?? "history",
            authorFilter: authorFilter ?? [],
            diffDisplayMode: "split",
            wordWrap: true,
          };
        }
        // v2 → v3: add diffDisplayMode and wordWrap preferences
        return {
          ...persistedState,
          diffDisplayMode: persistedState.diffDisplayMode ?? "split",
          wordWrap: persistedState.wordWrap ?? true,
        };
      },
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) {
            return;
          }
          // Reconcile: clear selectedRepoId if it references a nonexistent repo
          const { selectedRepoId, repos } = state;
          if (selectedRepoId && !repos.some((r) => r.id === selectedRepoId)) {
            state.selectedRepoId = null;
          }
        };
      },
    }
  )
);

// Selector hooks for common patterns
export const useRepos = () => useAppStore((state) => state.repos);
export const useSelectedRepoId = () =>
  useAppStore((state) => state.selectedRepoId);
export const useSelectedRepo = () =>
  useAppStore(
    (state) => state.repos.find((r) => r.id === state.selectedRepoId) ?? null
  );
export const useSelectedCommitId = () =>
  useAppStore((state) => state.selectedCommitIds[0] ?? null);
export const useSelectedCommitIds = () =>
  useAppStore((state) => state.selectedCommitIds);
export const useSelectedFilePath = () =>
  useAppStore((state) => state.selectedFilePath);
export const useSelectedChangeId = () =>
  useAppStore((state) => state.selectedChangeId);
export const useViewMode = () => useAppStore((state) => state.viewMode);
export const useFocusedRegion = () =>
  useAppStore((state) => state.focusedRegion);
export const useIsDiffMaximized = () =>
  useAppStore((state) => state.isDiffMaximized);
export const useWorkingChangesFingerprint = () =>
  useAppStore((state) => state.workingChangesFingerprint);
export const useChangedFiles = () => useAppStore((state) => state.changedFiles);
export const useIsLoadingCommitFiles = () =>
  useAppStore((state) => state.isLoadingCommitFiles);
export const useCommitFilesError = () =>
  useAppStore((state) => state.commitFilesError);

// Polling state selectors
export const useCommits = () => useAppStore((state) => state.commits);
export const useIsLoadingCommits = () =>
  useAppStore((state) => state.isLoadingCommits);
export const useCommitsError = () => useAppStore((state) => state.commitsError);
export const useWorkingChanges = () =>
  useAppStore((state) => state.workingChanges);
export const useIsLoadingChanges = () =>
  useAppStore((state) => state.isLoadingChanges);
export const useChangesError = () => useAppStore((state) => state.changesError);
export const useUnpushedCount = () =>
  useAppStore((state) => state.unpushedCount);
export const useBehindCount = () => useAppStore((state) => state.behindCount);
export const useCurrentBranchName = () =>
  useAppStore((state) => state.currentBranchName);
export const useAuthorFilter = () => useAppStore((state) => state.authorFilter);

// Overlay state selector
export const useOverlayOpen = () => useAppStore((state) => state.overlayOpen);

// DiffView preference selectors
export const useDiffDisplayMode = () =>
  useAppStore((state) => state.diffDisplayMode);
export const useWordWrap = () => useAppStore((state) => state.wordWrap);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FocusRegion } from "../types/focus";
import type { Repository } from "../types/repository";

export type ViewMode = "history" | "changes";

export interface AppState {
  repos: Repository[];
  selectedRepoId: string | null;
  selectedCommitId: string | null;
  selectedFilePath: string | null;
  viewMode: ViewMode;
  focusedRegion: FocusRegion | null;
  isDiffMaximized: boolean;
  addRepo: (path: string) => void;
  removeRepo: (id: string) => void;
  selectRepo: (id: string | null) => void;
  selectCommit: (id: string | null) => void;
  selectFile: (path: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setFocusedRegion: (region: FocusRegion | null) => void;
  setDiffMaximized: (maximized: boolean) => void;
  toggleDiffMaximized: () => void;
  focusNextPanel: () => void;
  focusPrevPanel: () => void;
  clearRepos: () => void;
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

function getVisiblePanels(viewMode: ViewMode): FocusRegion[] {
  if (viewMode === "history") {
    return ["sidebar", "files", "diff"];
  }

  return ["sidebar", "diff"];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      repos: [],
      selectedRepoId: null,
      selectedCommitId: null,
      selectedFilePath: null,
      viewMode: "history" as ViewMode,
      focusedRegion: null,
      isDiffMaximized: false,

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
            selectedCommitId: null,
            selectedFilePath: null,
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
            selectedCommitId: null,
            selectedFilePath: null,
          });
        }
      },

      selectCommit: (id: string | null) => {
        // Clear file selection when commit changes
        set({ selectedCommitId: id, selectedFilePath: null });
      },

      selectFile: (path: string | null) => {
        set({ selectedFilePath: path });
      },

      setViewMode: (mode: ViewMode) => {
        set((state) => {
          const visiblePanels = getVisiblePanels(mode);
          const focusedRegion =
            state.focusedRegion === null ||
            visiblePanels.includes(state.focusedRegion)
              ? state.focusedRegion
              : visiblePanels[0];

          return {
            viewMode: mode,
            selectedFilePath: null,
            focusedRegion,
            isDiffMaximized: false,
          };
        });
      },

      setFocusedRegion: (region: FocusRegion | null) => {
        set({ focusedRegion: region });
      },

      setDiffMaximized: (maximized: boolean) => {
        set({ isDiffMaximized: maximized });
      },

      toggleDiffMaximized: () => {
        set((state) => ({ isDiffMaximized: !state.isDiffMaximized }));
      },

      focusNextPanel: () => {
        set((state) => {
          const visiblePanels = getVisiblePanels(state.viewMode);
          const rawIndex = state.focusedRegion
            ? visiblePanels.indexOf(state.focusedRegion)
            : -1;
          const currentIndex = rawIndex >= 0 ? rawIndex : -1;
          const nextIndex = (currentIndex + 1) % visiblePanels.length;

          return { focusedRegion: visiblePanels[nextIndex] };
        });
      },

      focusPrevPanel: () => {
        set((state) => {
          const visiblePanels = getVisiblePanels(state.viewMode);
          const rawIndex = state.focusedRegion
            ? visiblePanels.indexOf(state.focusedRegion)
            : 0;
          const currentIndex = rawIndex >= 0 ? rawIndex : 0;
          const prevIndex =
            (currentIndex - 1 + visiblePanels.length) % visiblePanels.length;

          return { focusedRegion: visiblePanels[prevIndex] };
        });
      },

      clearRepos: () => {
        set({
          repos: [],
          selectedRepoId: null,
          selectedCommitId: null,
          selectedFilePath: null,
          isDiffMaximized: false,
        });
      },
    }),
    {
      name: "recap-storage",
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
  useAppStore((state) => state.selectedCommitId);
export const useSelectedFilePath = () =>
  useAppStore((state) => state.selectedFilePath);
export const useViewMode = () => useAppStore((state) => state.viewMode);
export const useFocusedRegion = () =>
  useAppStore((state) => state.focusedRegion);
export const useIsDiffMaximized = () =>
  useAppStore((state) => state.isDiffMaximized);

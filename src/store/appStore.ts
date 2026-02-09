import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Repository } from "../types/repository";

export type ViewMode = "history" | "changes";

export interface AppState {
  repos: Repository[];
  selectedRepoId: string | null;
  selectedCommitId: string | null;
  selectedFilePath: string | null;
  viewMode: ViewMode;
  addRepo: (path: string) => void;
  removeRepo: (id: string) => void;
  selectRepo: (id: string | null) => void;
  selectCommit: (id: string | null) => void;
  selectFile: (path: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  clearRepos: () => void;
}

/**
 * Extract repository name from path.
 * Takes the last segment of the path as the repo name.
 */
function extractRepoName(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || path;
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
      selectedCommitId: null,
      selectedFilePath: null,
      viewMode: "history" as ViewMode,

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

        set({ repos: [...repos, newRepo] });
      },

      removeRepo: (id: string) => {
        const { repos, selectedRepoId } = get();
        const newRepos = repos.filter((r) => r.id !== id);
        
        set({
          repos: newRepos,
          // Clear selection if removed repo was selected
          selectedRepoId: selectedRepoId === id ? null : selectedRepoId,
        });
      },

      selectRepo: (id: string | null) => {
        const { repos } = get();
        
        // Only select if repo exists or if clearing selection
        if (id === null || repos.some((r) => r.id === id)) {
          // Clear commit and file selection when repo changes
          set({ selectedRepoId: id, selectedCommitId: null, selectedFilePath: null });
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
        // Clear file selection when switching modes
        set({ viewMode: mode, selectedFilePath: null });
      },

      clearRepos: () => {
        set({ repos: [], selectedRepoId: null, selectedCommitId: null, selectedFilePath: null });
      },
    }),
    {
      name: "code-review-storage",
    }
  )
);

// Selector hooks for common patterns
export const useRepos = () => useAppStore((state) => state.repos);
export const useSelectedRepoId = () => useAppStore((state) => state.selectedRepoId);
export const useSelectedRepo = () =>
  useAppStore((state) =>
    state.repos.find((r) => r.id === state.selectedRepoId) ?? null
  );
export const useSelectedCommitId = () => useAppStore((state) => state.selectedCommitId);
export const useSelectedFilePath = () => useAppStore((state) => state.selectedFilePath);
export const useViewMode = () => useAppStore((state) => state.viewMode);

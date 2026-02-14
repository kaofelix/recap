import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useAppStore,
  useRepos,
  useSelectedCommitId,
  useSelectedFilePath,
  useSelectedRepo,
  useSelectedRepoId,
  useViewMode,
} from "./appStore";

describe("appStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useAppStore.getState().clearRepos();
      useAppStore.getState().setViewMode("history");
      useAppStore.getState().setFocusedRegion(null);
    });
  });

  describe("addRepo", () => {
    it("should add a repository", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/my-repo");
      });

      expect(result.current.repos).toHaveLength(1);
      expect(result.current.repos[0].path).toBe("/path/to/my-repo");
      expect(result.current.repos[0].name).toBe("my-repo");
    });

    it("should extract repo name from path", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/Users/dev/projects/awesome-project");
      });

      expect(result.current.repos[0].name).toBe("awesome-project");
    });

    it("should handle Windows paths", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("C:\\Users\\dev\\repos\\my-app");
      });

      expect(result.current.repos[0].name).toBe("my-app");
    });

    it("should handle trailing slashes", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo/");
      });

      expect(result.current.repos[0].name).toBe("repo");
    });

    it("should not add duplicate paths", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo");
        result.current.addRepo("/path/to/repo");
      });

      expect(result.current.repos).toHaveLength(1);
    });

    it("should generate unique IDs", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      expect(result.current.repos[0].id).not.toBe(result.current.repos[1].id);
    });

    it("should set addedAt timestamp", () => {
      const before = Date.now();
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo");
      });

      const after = Date.now();
      expect(result.current.repos[0].addedAt).toBeGreaterThanOrEqual(before);
      expect(result.current.repos[0].addedAt).toBeLessThanOrEqual(after);
    });

    it("should auto-select the newly added repo", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo");
      });

      expect(result.current.selectedRepoId).toBe(result.current.repos[0].id);
    });

    it("should auto-select the second repo when added", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
      });

      const firstId = result.current.repos[0].id;
      expect(result.current.selectedRepoId).toBe(firstId);

      act(() => {
        result.current.addRepo("/path/two");
      });

      const secondId = result.current.repos[1].id;
      expect(result.current.selectedRepoId).toBe(secondId);
    });
  });

  describe("removeRepo", () => {
    it("should remove a repository by id", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      const idToRemove = result.current.repos[0].id;

      act(() => {
        result.current.removeRepo(idToRemove);
      });

      expect(result.current.repos).toHaveLength(1);
      expect(result.current.repos[0].path).toBe("/path/two");
    });

    it("should auto-select first remaining repo when removing selected repo", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      const [repo1, repo2] = result.current.repos;

      // repo2 is auto-selected (last added)
      expect(result.current.selectedRepoId).toBe(repo2.id);

      act(() => {
        result.current.removeRepo(repo2.id);
      });

      // Should auto-select repo1
      expect(result.current.selectedRepoId).toBe(repo1.id);
    });

    it("should clear selection when removing the last repo", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo");
      });

      const repoId = result.current.repos[0].id;

      act(() => {
        result.current.removeRepo(repoId);
      });

      expect(result.current.selectedRepoId).toBeNull();
      expect(result.current.repos).toHaveLength(0);
    });

    it("should not affect selection when removing different repo", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      const [repo1, repo2] = result.current.repos;

      act(() => {
        result.current.selectRepo(repo2.id);
      });

      act(() => {
        result.current.removeRepo(repo1.id);
      });

      expect(result.current.selectedRepoId).toBe(repo2.id);
    });
  });

  describe("selectRepo", () => {
    it("should select a repository by id", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo");
      });

      const repoId = result.current.repos[0].id;

      act(() => {
        result.current.selectRepo(repoId);
      });

      expect(result.current.selectedRepoId).toBe(repoId);
    });

    it("should clear selection when passed null", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo");
      });

      act(() => {
        result.current.selectRepo(result.current.repos[0].id);
      });

      act(() => {
        result.current.selectRepo(null);
      });

      expect(result.current.selectedRepoId).toBeNull();
    });

    it("should not select non-existent repo", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectRepo("non-existent-id");
      });

      expect(result.current.selectedRepoId).toBeNull();
    });
  });

  describe("selectCommit", () => {
    it("should select a commit by id", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectCommit("abc123");
      });

      expect(result.current.selectedCommitId).toBe("abc123");
    });

    it("should clear selection when passed null", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectCommit("abc123");
      });

      act(() => {
        result.current.selectCommit(null);
      });

      expect(result.current.selectedCommitId).toBeNull();
    });

    it("should be cleared when repo selection changes", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      const [repo1, repo2] = result.current.repos;

      act(() => {
        result.current.selectRepo(repo1.id);
        result.current.selectCommit("abc123");
      });

      expect(result.current.selectedCommitId).toBe("abc123");

      act(() => {
        result.current.selectRepo(repo2.id);
      });

      expect(result.current.selectedCommitId).toBeNull();
    });
  });

  describe("selectFile", () => {
    it("should select a file by path", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectFile("src/App.tsx");
      });

      expect(result.current.selectedFilePath).toBe("src/App.tsx");
    });

    it("should clear selection when passed null", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectFile("src/App.tsx");
      });

      act(() => {
        result.current.selectFile(null);
      });

      expect(result.current.selectedFilePath).toBeNull();
    });

    it("should be cleared when commit selection changes", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectCommit("abc123");
        result.current.selectFile("src/App.tsx");
      });

      expect(result.current.selectedFilePath).toBe("src/App.tsx");

      act(() => {
        result.current.selectCommit("def456");
      });

      expect(result.current.selectedFilePath).toBeNull();
    });

    it("should be cleared when repo selection changes", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      const [repo1, repo2] = result.current.repos;

      act(() => {
        result.current.selectRepo(repo1.id);
        result.current.selectCommit("abc123");
        result.current.selectFile("src/App.tsx");
      });

      expect(result.current.selectedFilePath).toBe("src/App.tsx");

      act(() => {
        result.current.selectRepo(repo2.id);
      });

      expect(result.current.selectedFilePath).toBeNull();
    });
  });

  describe("clearRepos", () => {
    it("should remove all repos and clear all selections", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      act(() => {
        result.current.selectRepo(result.current.repos[0].id);
        result.current.selectCommit("abc123");
        result.current.selectFile("src/App.tsx");
      });

      expect(result.current.repos).toHaveLength(2);
      expect(result.current.selectedRepoId).not.toBeNull();
      expect(result.current.selectedCommitId).not.toBeNull();
      expect(result.current.selectedFilePath).not.toBeNull();

      act(() => {
        result.current.clearRepos();
      });

      expect(result.current.repos).toHaveLength(0);
      expect(result.current.selectedRepoId).toBeNull();
      expect(result.current.selectedCommitId).toBeNull();
      expect(result.current.selectedFilePath).toBeNull();
    });
  });

  describe("selector hooks", () => {
    it("useRepos should return repos array", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: reposResult } = renderHook(() => useRepos());

      act(() => {
        storeResult.current.addRepo("/path/to/repo");
      });

      expect(reposResult.current).toHaveLength(1);
    });

    it("useSelectedRepoId should return selected id", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: selectedIdResult } = renderHook(() =>
        useSelectedRepoId()
      );

      act(() => {
        storeResult.current.addRepo("/path/to/repo");
      });

      act(() => {
        storeResult.current.selectRepo(storeResult.current.repos[0].id);
      });

      expect(selectedIdResult.current).toBe(storeResult.current.repos[0].id);
    });

    it("useSelectedRepo should return selected repo object", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: selectedRepoResult } = renderHook(() =>
        useSelectedRepo()
      );

      act(() => {
        storeResult.current.addRepo("/path/to/repo");
      });

      act(() => {
        storeResult.current.selectRepo(storeResult.current.repos[0].id);
      });

      expect(selectedRepoResult.current).not.toBeNull();
      expect(selectedRepoResult.current?.path).toBe("/path/to/repo");
    });

    it("useSelectedRepo should return null when nothing selected", () => {
      const { result } = renderHook(() => useSelectedRepo());

      expect(result.current).toBeNull();
    });

    it("useSelectedCommitId should return selected commit id", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: selectedCommitResult } = renderHook(() =>
        useSelectedCommitId()
      );

      act(() => {
        storeResult.current.selectCommit("abc123def456");
      });

      expect(selectedCommitResult.current).toBe("abc123def456");
    });

    it("useSelectedFilePath should return selected file path", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: selectedFileResult } = renderHook(() =>
        useSelectedFilePath()
      );

      act(() => {
        storeResult.current.selectFile("src/components/Button.tsx");
      });

      expect(selectedFileResult.current).toBe("src/components/Button.tsx");
    });

    it("useViewMode should return current view mode", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: viewModeResult } = renderHook(() => useViewMode());

      expect(viewModeResult.current).toBe("history");

      act(() => {
        storeResult.current.setViewMode("changes");
      });

      expect(viewModeResult.current).toBe("changes");
    });
  });

  describe("panel focus navigation", () => {
    const setFocusState = (
      viewMode: "history" | "changes",
      focusedRegion: "sidebar" | "files" | "diff" | null = null
    ) => {
      act(() => {
        const store = useAppStore.getState();
        store.setViewMode(viewMode);
        store.setFocusedRegion(focusedRegion);
      });
    };

    const focusNext = (times = 1) => {
      act(() => {
        const store = useAppStore.getState();
        for (let i = 0; i < times; i++) {
          store.focusNextPanel();
        }
      });
    };

    const focusPrev = () => {
      act(() => {
        useAppStore.getState().focusPrevPanel();
      });
    };

    it("focusNextPanel should cycle visible panels in history mode", () => {
      setFocusState("history");

      focusNext();
      expect(useAppStore.getState().focusedRegion).toBe("sidebar");

      focusNext();
      expect(useAppStore.getState().focusedRegion).toBe("files");

      focusNext();
      expect(useAppStore.getState().focusedRegion).toBe("diff");

      focusNext();
      expect(useAppStore.getState().focusedRegion).toBe("sidebar");
    });

    it("focusPrevPanel should wrap to last visible panel when no focus", () => {
      setFocusState("history");

      focusPrev();

      expect(useAppStore.getState().focusedRegion).toBe("diff");
    });

    it("focusNextPanel should skip files panel in changes mode", () => {
      setFocusState("changes");

      focusNext();
      expect(useAppStore.getState().focusedRegion).toBe("sidebar");

      focusNext();
      expect(useAppStore.getState().focusedRegion).toBe("diff");
    });
  });

  describe("setViewMode", () => {
    it("should set view mode to changes", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setViewMode("changes");
      });

      expect(result.current.viewMode).toBe("changes");
    });

    it("should set view mode to history", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setViewMode("changes");
      });

      act(() => {
        result.current.setViewMode("history");
      });

      expect(result.current.viewMode).toBe("history");
    });

    it("should clear file selection when switching modes", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectFile("src/App.tsx");
      });

      expect(result.current.selectedFilePath).toBe("src/App.tsx");

      act(() => {
        result.current.setViewMode("changes");
      });

      expect(result.current.selectedFilePath).toBeNull();
    });

    it("should normalize focused region if current panel is hidden in next mode", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setViewMode("history");
        result.current.setFocusedRegion("files");
        result.current.setViewMode("changes");
      });

      expect(result.current.focusedRegion).toBe("sidebar");
    });

    it("should preserve focused region if still visible in next mode", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setFocusedRegion("diff");
        result.current.setViewMode("changes");
      });

      expect(result.current.focusedRegion).toBe("diff");
    });

    it("should default to history mode", () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.viewMode).toBe("history");
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  useAppStore,
  useRepos,
  useSelectedRepoId,
  useSelectedRepo,
  useSelectedCommitId,
  useSelectedFilePath,
} from "./appStore";

describe("appStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useAppStore.getState().clearRepos();
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

    it("should clear selection if removed repo was selected", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addRepo("/path/to/repo");
      });

      const repoId = result.current.repos[0].id;

      act(() => {
        result.current.selectRepo(repoId);
      });

      expect(result.current.selectedRepoId).toBe(repoId);

      act(() => {
        result.current.removeRepo(repoId);
      });

      expect(result.current.selectedRepoId).toBeNull();
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
      const { result: selectedIdResult } = renderHook(() => useSelectedRepoId());

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
      const { result: selectedRepoResult } = renderHook(() => useSelectedRepo());

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
      const { result: selectedCommitResult } = renderHook(() => useSelectedCommitId());

      act(() => {
        storeResult.current.selectCommit("abc123def456");
      });

      expect(selectedCommitResult.current).toBe("abc123def456");
    });

    it("useSelectedFilePath should return selected file path", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: selectedFileResult } = renderHook(() => useSelectedFilePath());

      act(() => {
        storeResult.current.selectFile("src/components/Button.tsx");
      });

      expect(selectedFileResult.current).toBe("src/components/Button.tsx");
    });
  });
});

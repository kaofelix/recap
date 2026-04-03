import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  useAppStore,
  useAuthorFilter,
  useCurrentBranchName,
  useIsDiffMaximized,
  useRepos,
  useSelectedCommitId,
  useSelectedCommitIds,
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
      useAppStore.getState().setDiffMaximized(false);
      useAppStore.getState().setChangedFiles([]);
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

      expect(result.current.selectedCommitIds[0] ?? null).toBe("abc123");
      expect(result.current.selectedCommitIds).toEqual(["abc123"]);
    });

    it("should clear selection when passed null", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectCommit("abc123");
      });

      act(() => {
        result.current.selectCommit(null);
      });

      expect(result.current.selectedCommitIds[0] ?? null).toBeNull();
      expect(result.current.selectedCommitIds).toEqual([]);
    });

    it("should replace selection when selecting a commit range", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.selectCommit("abc123");
      });

      act(() => {
        result.current.selectCommitRange(["def456", "ghi789"]);
      });

      expect(result.current.selectedCommitIds).toEqual(["def456", "ghi789"]);
      expect(result.current.selectedCommitIds[0] ?? null).toBe("def456");
    });

    it("should toggle commit selection on and off", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.toggleCommitSelection("abc123");
      });

      expect(result.current.selectedCommitIds).toEqual(["abc123"]);

      act(() => {
        result.current.toggleCommitSelection("def456");
      });

      expect(result.current.selectedCommitIds).toEqual(["abc123", "def456"]);

      act(() => {
        result.current.toggleCommitSelection("abc123");
      });

      expect(result.current.selectedCommitIds).toEqual(["def456"]);
      expect(result.current.selectedCommitIds[0] ?? null).toBe("def456");
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

      expect(result.current.selectedCommitIds[0] ?? null).toBe("abc123");
      expect(result.current.selectedCommitIds).toEqual(["abc123"]);

      act(() => {
        result.current.selectRepo(repo2.id);
      });

      expect(result.current.selectedCommitIds[0] ?? null).toBeNull();
      expect(result.current.selectedCommitIds).toEqual([]);
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
      expect(result.current.selectedCommitIds[0] ?? null).not.toBeNull();
      expect(result.current.selectedFilePath).not.toBeNull();

      act(() => {
        result.current.clearRepos();
      });

      expect(result.current.repos).toHaveLength(0);
      expect(result.current.selectedRepoId).toBeNull();
      expect(result.current.selectedCommitIds[0] ?? null).toBeNull();
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

    it("useSelectedCommitId should derive the first selected commit id", () => {
      const { result: selectedCommitResult } = renderHook(() =>
        useSelectedCommitId()
      );

      act(() => {
        useAppStore.setState({ selectedCommitIds: ["abc123", "def456"] });
      });

      expect(selectedCommitResult.current).toBe("abc123");
    });

    it("useSelectedCommitIds should return all selected commit ids", () => {
      const { result: storeResult } = renderHook(() => useAppStore());
      const { result: selectedCommitIdsResult } = renderHook(() =>
        useSelectedCommitIds()
      );

      act(() => {
        storeResult.current.selectCommitRange(["abc123", "def456"]);
      });

      expect(selectedCommitIdsResult.current).toEqual(["abc123", "def456"]);
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

  describe("diff maximize state", () => {
    it("should default diff maximize state to false", () => {
      const { result } = renderHook(() => useIsDiffMaximized());

      expect(result.current).toBe(false);
    });

    it("should toggle diff maximize state", () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.isDiffMaximized).toBe(false);

      act(() => {
        result.current.toggleDiffMaximized();
      });

      expect(result.current.isDiffMaximized).toBe(true);

      act(() => {
        result.current.toggleDiffMaximized();
      });

      expect(result.current.isDiffMaximized).toBe(false);
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

    it("should reset diff maximize state when switching modes", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setDiffMaximized(true);
      });

      expect(result.current.isDiffMaximized).toBe(true);

      act(() => {
        result.current.setViewMode("changes");
      });

      expect(result.current.isDiffMaximized).toBe(false);
    });

    it("should preserve focused region when switching to changes mode with files focused", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setViewMode("history");
        result.current.setFocusedRegion("files");
        result.current.setViewMode("changes");
      });

      expect(result.current.focusedRegion).toBe("files");
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

  describe("working changes revision", () => {
    it("increments revision when bumpWorkingChangesRevision is called", () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.workingChangesRevision).toBe(0);

      act(() => {
        result.current.bumpWorkingChangesRevision();
      });

      expect(result.current.workingChangesRevision).toBe(1);
    });
  });

  describe("changedFiles", () => {
    const makeFile = (
      path: string,
      status: "Modified" | "Added" | "Deleted" = "Modified"
    ) => ({
      path,
      status,
      additions: 0,
      deletions: 0,
      old_path: null,
    });

    it("should default to empty array", () => {
      const { result } = renderHook(() => useAppStore());

      expect(result.current.changedFiles).toEqual([]);
    });

    it("should update changedFiles via setChangedFiles", () => {
      const { result } = renderHook(() => useAppStore());
      const files = [
        makeFile("src/App.tsx", "Modified"),
        makeFile("src/index.ts", "Added"),
      ];

      act(() => {
        result.current.setChangedFiles(files);
      });

      expect(result.current.changedFiles).toEqual(files);
    });

    it("should be cleared when commit selection changes", () => {
      const { result } = renderHook(() => useAppStore());
      const files = [makeFile("src/App.tsx")];

      act(() => {
        result.current.selectCommit("abc123");
        result.current.setChangedFiles(files);
      });

      expect(result.current.changedFiles).toEqual(files);

      act(() => {
        result.current.selectCommit("def456");
      });

      expect(result.current.changedFiles).toEqual([]);
    });

    it("should be cleared when commit range selection changes", () => {
      const { result } = renderHook(() => useAppStore());
      const files = [makeFile("src/App.tsx")];

      act(() => {
        result.current.selectCommit("abc123");
        result.current.setChangedFiles(files);
      });

      expect(result.current.changedFiles).toEqual(files);

      act(() => {
        result.current.selectCommitRange(["def456", "ghi789"]);
      });

      expect(result.current.changedFiles).toEqual([]);
    });

    it("should be cleared when toggling commit selection", () => {
      const { result } = renderHook(() => useAppStore());
      const files = [makeFile("src/App.tsx")];

      act(() => {
        result.current.selectCommit("abc123");
        result.current.setChangedFiles(files);
      });

      expect(result.current.changedFiles).toEqual(files);

      act(() => {
        result.current.toggleCommitSelection("def456");
      });

      expect(result.current.changedFiles).toEqual([]);
    });

    it("should be cleared when view mode changes", () => {
      const { result } = renderHook(() => useAppStore());
      const files = [makeFile("src/App.tsx")];

      act(() => {
        result.current.setChangedFiles(files);
      });

      expect(result.current.changedFiles).toEqual(files);

      act(() => {
        result.current.setViewMode("changes");
      });

      expect(result.current.changedFiles).toEqual([]);
    });

    it("should be cleared when repo selection changes", () => {
      const { result } = renderHook(() => useAppStore());
      const files = [makeFile("src/App.tsx")];

      act(() => {
        result.current.addRepo("/path/one");
        result.current.addRepo("/path/two");
      });

      const [repo1, repo2] = result.current.repos;

      act(() => {
        result.current.selectRepo(repo1.id);
        result.current.setChangedFiles(files);
      });

      expect(result.current.changedFiles).toEqual(files);

      act(() => {
        result.current.selectRepo(repo2.id);
      });

      expect(result.current.changedFiles).toEqual([]);
    });
  });

  describe("toggleDiffMaximized focus behavior", () => {
    it("should set focusedRegion to diff when maximizing", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setFocusedRegion("sidebar");
      });

      expect(result.current.focusedRegion).toBe("sidebar");

      act(() => {
        result.current.toggleDiffMaximized();
      });

      expect(result.current.isDiffMaximized).toBe(true);
      expect(result.current.focusedRegion).toBe("diff");
    });

    it("should not change focusedRegion when un-maximizing", () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setDiffMaximized(true);
        result.current.setFocusedRegion("diff");
      });

      act(() => {
        result.current.toggleDiffMaximized();
      });

      expect(result.current.isDiffMaximized).toBe(false);
      expect(result.current.focusedRegion).toBe("diff");
    });
  });

  describe("currentBranchName", () => {
    it("should default to null", () => {
      expect(useAppStore.getState().currentBranchName).toBeNull();
    });

    it("should update via setCurrentBranchName", () => {
      act(() => {
        useAppStore.getState().setCurrentBranchName("main");
      });

      expect(useAppStore.getState().currentBranchName).toBe("main");
    });

    it("should be cleared by clearRepos", () => {
      act(() => {
        useAppStore.getState().setCurrentBranchName("feature-x");
      });

      expect(useAppStore.getState().currentBranchName).toBe("feature-x");

      act(() => {
        useAppStore.getState().clearRepos();
      });

      expect(useAppStore.getState().currentBranchName).toBeNull();
    });

    it("should expose useCurrentBranchName selector", () => {
      const { result } = renderHook(() => useCurrentBranchName());

      expect(result.current).toBeNull();

      act(() => {
        useAppStore.getState().setCurrentBranchName("develop");
      });

      expect(result.current).toBe("develop");
    });
  });

  describe("authorFilter", () => {
    it("should start with an empty author filter", () => {
      expect(useAppStore.getState().authorFilter).toEqual([]);
    });

    it("should add an author email via toggleAuthorFilter", () => {
      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
      });

      expect(useAppStore.getState().authorFilter).toEqual([
        "alice@example.com",
      ]);
    });

    it("should remove an author email when toggled again", () => {
      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
        useAppStore.getState().toggleAuthorFilter("bob@example.com");
      });

      expect(useAppStore.getState().authorFilter).toEqual([
        "alice@example.com",
        "bob@example.com",
      ]);

      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
      });

      expect(useAppStore.getState().authorFilter).toEqual(["bob@example.com"]);
    });

    it("should be cleared via clearAuthorFilter", () => {
      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
        useAppStore.getState().toggleAuthorFilter("bob@example.com");
      });

      expect(useAppStore.getState().authorFilter).toHaveLength(2);

      act(() => {
        useAppStore.getState().clearAuthorFilter();
      });

      expect(useAppStore.getState().authorFilter).toEqual([]);
    });

    it("should be cleared when selecting a different repo", () => {
      act(() => {
        useAppStore.getState().addRepo("/test/repo1");
        useAppStore.getState().addRepo("/test/repo2");
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
      });

      expect(useAppStore.getState().authorFilter).toHaveLength(1);

      const repo2 = useAppStore
        .getState()
        .repos.find((r) => r.path === "/test/repo2");
      expect(repo2).toBeDefined();

      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: guarded by the assertion above
        useAppStore.getState().selectRepo(repo2!.id);
      });

      expect(useAppStore.getState().authorFilter).toEqual([]);
    });

    it("should be cleared by clearRepos", () => {
      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
      });

      expect(useAppStore.getState().authorFilter).toHaveLength(1);

      act(() => {
        useAppStore.getState().clearRepos();
      });

      expect(useAppStore.getState().authorFilter).toEqual([]);
    });

    it("should reset commitLimit when toggling author filter", () => {
      act(() => {
        useAppStore.getState().loadMoreCommits();
        useAppStore.getState().loadMoreCommits();
      });

      expect(useAppStore.getState().commitLimit).toBe(150);

      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
      });

      expect(useAppStore.getState().commitLimit).toBe(50);
      expect(useAppStore.getState().hasMoreCommits).toBe(true);
    });

    it("should reset commitLimit when clearing author filter", () => {
      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
        useAppStore.getState().loadMoreCommits();
        useAppStore.getState().loadMoreCommits();
      });

      expect(useAppStore.getState().commitLimit).toBe(150);

      act(() => {
        useAppStore.getState().clearAuthorFilter();
      });

      expect(useAppStore.getState().commitLimit).toBe(50);
      expect(useAppStore.getState().hasMoreCommits).toBe(true);
    });

    it("should expose useAuthorFilter selector", () => {
      const { result } = renderHook(() => useAuthorFilter());

      expect(result.current).toEqual([]);

      act(() => {
        useAppStore.getState().toggleAuthorFilter("alice@example.com");
      });

      expect(result.current).toEqual(["alice@example.com"]);
    });
  });

  describe("commitLimit", () => {
    it("should start with a default limit of 50", () => {
      expect(useAppStore.getState().commitLimit).toBe(50);
    });

    it("should increase limit by 50 via loadMoreCommits", () => {
      act(() => {
        useAppStore.getState().loadMoreCommits();
      });

      expect(useAppStore.getState().commitLimit).toBe(100);

      act(() => {
        useAppStore.getState().loadMoreCommits();
      });

      expect(useAppStore.getState().commitLimit).toBe(150);
    });

    it("should reset to 50 when selecting a different repo", () => {
      act(() => {
        useAppStore.getState().addRepo("/test/repo1");
        useAppStore.getState().addRepo("/test/repo2");
        useAppStore.getState().loadMoreCommits();
        useAppStore.getState().loadMoreCommits();
      });

      expect(useAppStore.getState().commitLimit).toBe(150);

      const repo2 = useAppStore
        .getState()
        .repos.find((r) => r.path === "/test/repo2");
      expect(repo2).toBeDefined();

      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: guarded by the assertion above
        useAppStore.getState().selectRepo(repo2!.id);
      });

      expect(useAppStore.getState().commitLimit).toBe(50);
    });

    it("should reset to 50 via clearRepos", () => {
      act(() => {
        useAppStore.getState().loadMoreCommits();
      });

      expect(useAppStore.getState().commitLimit).toBe(100);

      act(() => {
        useAppStore.getState().clearRepos();
      });

      expect(useAppStore.getState().commitLimit).toBe(50);
    });

    it("should not load more when hasMoreCommits is false", () => {
      act(() => {
        useAppStore.setState({ hasMoreCommits: false });
      });

      act(() => {
        useAppStore.getState().loadMoreCommits();
      });

      // Should stay at 50, not increase
      expect(useAppStore.getState().commitLimit).toBe(50);
    });
  });

  describe("hasMoreCommits", () => {
    it("should default to true", () => {
      expect(useAppStore.getState().hasMoreCommits).toBe(true);
    });

    it("should be settable via setHasMoreCommits", () => {
      act(() => {
        useAppStore.getState().setHasMoreCommits(false);
      });

      expect(useAppStore.getState().hasMoreCommits).toBe(false);
    });

    it("should reset to true when selecting a different repo", () => {
      act(() => {
        useAppStore.getState().addRepo("/test/repo1");
        useAppStore.getState().addRepo("/test/repo2");
        useAppStore.getState().setHasMoreCommits(false);
      });

      expect(useAppStore.getState().hasMoreCommits).toBe(false);

      const repo2 = useAppStore
        .getState()
        .repos.find((r) => r.path === "/test/repo2");
      expect(repo2).toBeDefined();

      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: guarded by the assertion above
        useAppStore.getState().selectRepo(repo2!.id);
      });

      expect(useAppStore.getState().hasMoreCommits).toBe(true);
    });
  });
});

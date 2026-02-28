import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChangedFile, WorkingFile } from "../types/file";
import { useWorkingChangesListModel } from "./useWorkingChangesListModel";

describe("useWorkingChangesListModel", () => {
  it("orders items staged first and then unstaged", () => {
    const changes: WorkingFile[] = [
      {
        path: "src/unstaged.ts",
        staged_status: null,
        unstaged_status: "Modified",
        staged_additions: 0,
        staged_deletions: 0,
        unstaged_additions: 1,
        unstaged_deletions: 0,
        old_path: null,
        section: "unstaged",
      },
      {
        path: "src/staged.ts",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 1,
        staged_deletions: 0,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged",
      },
    ];

    const { result } = renderHook(() => useWorkingChangesListModel(changes));

    expect(result.current.items.map((item) => item.id)).toEqual([
      "src/staged.ts#staged",
      "src/unstaged.ts#unstaged",
    ]);
  });

  it("orders unstaged tracked files before unstaged untracked files", () => {
    const changes: WorkingFile[] = [
      {
        path: "src/untracked.ts",
        staged_status: null,
        unstaged_status: "Untracked",
        staged_additions: 0,
        staged_deletions: 0,
        unstaged_additions: 1,
        unstaged_deletions: 0,
        old_path: null,
        section: "unstaged",
      },
      {
        path: "src/modified.ts",
        staged_status: null,
        unstaged_status: "Modified",
        staged_additions: 0,
        staged_deletions: 0,
        unstaged_additions: 2,
        unstaged_deletions: 1,
        old_path: null,
        section: "unstaged",
      },
    ];

    const { result } = renderHook(() => useWorkingChangesListModel(changes));

    expect(result.current.items.map((item) => item.id)).toEqual([
      "src/modified.ts#unstaged",
      "src/untracked.ts#unstaged",
    ]);
  });

  it("filters out non-working changed files", () => {
    const changedFiles: (ChangedFile | WorkingFile)[] = [
      {
        path: "src/history.ts",
        status: "Modified",
        additions: 1,
        deletions: 0,
        old_path: null,
      },
      {
        path: "src/staged.ts",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 1,
        staged_deletions: 0,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged",
      },
    ];

    const { result } = renderHook(() =>
      useWorkingChangesListModel(changedFiles)
    );

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("src/staged.ts#staged");
  });
});

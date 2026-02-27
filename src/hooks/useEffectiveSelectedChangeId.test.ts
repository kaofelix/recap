import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkingChangesListModel } from "../lib/workingChangesList";
import { useEffectiveSelectedChangeId } from "./useEffectiveSelectedChangeId";

const model: WorkingChangesListModel = {
  items: [
    {
      id: "src/a.ts#staged",
      path: "src/a.ts",
      section: "staged",
      file: {
        path: "src/a.ts",
        staged_status: "Modified",
        unstaged_status: null,
        staged_additions: 1,
        staged_deletions: 0,
        unstaged_additions: 0,
        unstaged_deletions: 0,
        old_path: null,
        section: "staged",
      },
    },
    {
      id: "src/b.ts#unstaged",
      path: "src/b.ts",
      section: "unstaged",
      file: {
        path: "src/b.ts",
        staged_status: null,
        unstaged_status: "Modified",
        staged_additions: 0,
        staged_deletions: 0,
        unstaged_additions: 1,
        unstaged_deletions: 0,
        old_path: null,
        section: "unstaged",
      },
    },
  ],
  sections: [],
};

describe("useEffectiveSelectedChangeId", () => {
  it("keeps selected id when it exists in the model", () => {
    const { result } = renderHook(() =>
      useEffectiveSelectedChangeId("src/b.ts#unstaged", model)
    );

    expect(result.current).toBe("src/b.ts#unstaged");
  });

  it("falls back to first item when selected id is missing", () => {
    const { result } = renderHook(() =>
      useEffectiveSelectedChangeId("src/missing.ts#staged", model)
    );

    expect(result.current).toBe("src/a.ts#staged");
  });

  it("returns null when list is empty", () => {
    const { result } = renderHook(() =>
      useEffectiveSelectedChangeId(null, { items: [], sections: [] })
    );

    expect(result.current).toBeNull();
  });
});

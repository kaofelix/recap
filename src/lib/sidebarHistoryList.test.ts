import { describe, expect, it } from "vitest";
import type { Commit } from "../types/commit";
import type { WorkingFile } from "../types/file";
import {
  buildSidebarHistoryItems,
  isUncommittedChangesItemId,
  UNCOMMITTED_CHANGES_ITEM_ID,
} from "./sidebarHistoryList";

const commit = (id: string, message: string): Commit => ({
  id,
  message,
  author: "Test User",
  email: "test@example.com",
  timestamp: 1,
  is_pushed: true,
});

const workingFile = (
  path: string,
  section: "staged" | "unstaged"
): WorkingFile => ({
  path,
  staged_status: section === "staged" ? "Modified" : null,
  unstaged_status: section === "unstaged" ? "Modified" : null,
  staged_additions: section === "staged" ? 1 : 0,
  staged_deletions: 0,
  unstaged_additions: section === "unstaged" ? 1 : 0,
  unstaged_deletions: 0,
  old_path: null,
  section,
});

describe("sidebarHistoryList", () => {
  it("places uncommitted changes at the top when working changes exist", () => {
    const items = buildSidebarHistoryItems(
      [commit("commit-b", "Second"), commit("commit-a", "First")],
      [workingFile("src/app.ts", "staged")]
    );

    expect(items.map((item) => item.id)).toEqual([
      UNCOMMITTED_CHANGES_ITEM_ID,
      "commit-b",
      "commit-a",
    ]);
    expect(items[0]).toMatchObject({
      id: UNCOMMITTED_CHANGES_ITEM_ID,
      kind: "uncommitted",
      changeCount: 1,
      title: "Uncommitted changes",
    });
  });

  it("omits the synthetic item when there are no working changes", () => {
    const items = buildSidebarHistoryItems([commit("commit-a", "First")], []);

    expect(items.map((item) => item.id)).toEqual(["commit-a"]);
  });

  it("identifies the uncommitted changes item id", () => {
    expect(isUncommittedChangesItemId(UNCOMMITTED_CHANGES_ITEM_ID)).toBe(true);
    expect(isUncommittedChangesItemId("commit-a")).toBe(false);
  });
});

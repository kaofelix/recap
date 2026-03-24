import type { Commit } from "../types/commit";
import type { WorkingFile } from "../types/file";

export const UNCOMMITTED_CHANGES_ITEM_ID = "uncommitted-changes";

export type SidebarHistoryItem =
  | {
      id: typeof UNCOMMITTED_CHANGES_ITEM_ID;
      kind: "uncommitted";
      title: "Uncommitted changes";
      changeCount: number;
    }
  | {
      id: string;
      kind: "commit";
      commit: Commit;
    };

export function isUncommittedChangesItemId(id: string): boolean {
  return id === UNCOMMITTED_CHANGES_ITEM_ID;
}

export function buildSidebarHistoryItems(
  commits: Commit[],
  workingChanges: WorkingFile[]
): SidebarHistoryItem[] {
  const items: SidebarHistoryItem[] = commits.map((commit) => ({
    id: commit.id,
    kind: "commit",
    commit,
  }));

  if (workingChanges.length === 0) {
    return items;
  }

  return [
    {
      id: UNCOMMITTED_CHANGES_ITEM_ID,
      kind: "uncommitted",
      title: "Uncommitted changes",
      changeCount: workingChanges.length,
    },
    ...items,
  ];
}

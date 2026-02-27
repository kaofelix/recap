import { useMemo } from "react";
import type { WorkingChangesListModel } from "../lib/workingChangesList";

export function useEffectiveSelectedChangeId(
  selectedChangeId: string | null,
  model: WorkingChangesListModel
): string | null {
  return useMemo(() => {
    if (
      selectedChangeId &&
      model.items.some((item) => item.id === selectedChangeId)
    ) {
      return selectedChangeId;
    }

    return model.items[0]?.id ?? null;
  }, [model, selectedChangeId]);
}

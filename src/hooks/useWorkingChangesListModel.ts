import { useMemo } from "react";
import {
  buildWorkingChangesListModel,
  type WorkingChangesListModel,
} from "../lib/workingChangesList";
import type { ChangedFile, WorkingFile } from "../types/file";

function isWorkingFile(file: ChangedFile | WorkingFile): file is WorkingFile {
  return "section" in file;
}

export function useWorkingChangesListModel(
  changedFiles: (ChangedFile | WorkingFile)[]
): WorkingChangesListModel {
  return useMemo(() => {
    const workingChanges = changedFiles.filter(isWorkingFile);
    return buildWorkingChangesListModel(workingChanges);
  }, [changedFiles]);
}

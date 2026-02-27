import type { WorkingFile, WorkingFileSection } from "../types/file";

export interface WorkingChangeItem {
  id: string;
  path: string;
  section: WorkingFileSection;
  file: WorkingFile;
}

export interface WorkingChangeSection {
  section: WorkingFileSection;
  title: string;
  items: WorkingChangeItem[];
}

export interface WorkingChangesListModel {
  items: WorkingChangeItem[];
  sections: WorkingChangeSection[];
}

export function getWorkingChangeId(
  path: string,
  section: WorkingFileSection
): string {
  return `${path}#${section}`;
}

export function parseWorkingChangeId(
  id: string
): { path: string; section: WorkingFileSection } | null {
  const separatorIndex = id.lastIndexOf("#");
  if (separatorIndex <= 0 || separatorIndex === id.length - 1) {
    return null;
  }

  const path = id.slice(0, separatorIndex);
  const section = id.slice(separatorIndex + 1);

  if (section !== "staged" && section !== "unstaged") {
    return null;
  }

  return { path, section };
}

export function buildWorkingChangesListModel(
  changes: WorkingFile[]
): WorkingChangesListModel {
  const toItem = (file: WorkingFile): WorkingChangeItem => ({
    id: getWorkingChangeId(file.path, file.section),
    path: file.path,
    section: file.section,
    file,
  });

  const stagedItems = changes
    .filter((file) => file.section === "staged")
    .map(toItem);
  const unstagedItems = changes
    .filter((file) => file.section === "unstaged")
    .map(toItem);

  const items = [...stagedItems, ...unstagedItems];
  const sections: WorkingChangeSection[] = [];

  if (stagedItems.length > 0) {
    sections.push({
      section: "staged",
      title: `Staged Changes (${stagedItems.length})`,
      items: stagedItems,
    });
  }

  if (unstagedItems.length > 0) {
    sections.push({
      section: "unstaged",
      title: `Unstaged Changes (${unstagedItems.length})`,
      items: unstagedItems,
    });
  }

  return { items, sections };
}

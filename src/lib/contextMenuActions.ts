import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { WorkingFileSection } from "../types/file";
import {
  type ContextMenuAction,
  getMenuPositionFromElement,
  getMenuPositionFromMouseEvent,
  showContextMenu,
} from "./contextMenu";
import { getForgeCommitUrl } from "./forgeUrl";

// ============================================================================
// Clipboard utilities
// ============================================================================

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// ============================================================================
// History list context menu
// ============================================================================

export interface HistoryContextMenuOptions {
  commitId: string;
  repoPath: string;
  event: React.MouseEvent | React.KeyboardEvent;
  element: HTMLElement;
  /** Whether this commit has not been pushed to the remote yet */
  isUnpushed?: boolean;
  /** The current commit message (used to pre-fill the rewrite prompt) */
  commitMessage?: string;
  /** Called when the user selects "Rewrite Message…" */
  onRewriteMessage?: (commitId: string, currentMessage: string) => void;
  /** Called when the menu closes (regardless of action taken) */
  onClose?: () => void;
}

export async function showHistoryContextMenu(
  options: HistoryContextMenuOptions
): Promise<void> {
  const {
    commitId,
    repoPath,
    event,
    element,
    isUnpushed,
    commitMessage,
    onRewriteMessage,
    onClose,
  } = options;

  // Resolve forge URL before showing the menu so we can disable if unavailable
  let forgeUrl: string | null = null;
  try {
    const remoteUrl = await invoke<string>("get_remote_url", { repoPath });
    forgeUrl = getForgeCommitUrl(remoteUrl, commitId);
  } catch {
    // No origin remote or unparseable URL — disable action
  }

  const actions: ContextMenuAction[] = [
    { id: "copy-hash", label: "Copy Commit Hash" },
    {
      id: "open-in-forge",
      label: "Open in Forge",
      disabled: forgeUrl === null || isUnpushed === true,
    },
    {
      id: "rewrite-message",
      label: "Rewrite Message…",
      disabled: isUnpushed !== true,
    },
  ];

  const position =
    "clientX" in event
      ? getMenuPositionFromMouseEvent(event)
      : getMenuPositionFromElement(element);

  try {
    await showContextMenu({
      actions,
      position,
      onAction: async (actionId) => {
        try {
          switch (actionId) {
            case "copy-hash":
              await copyToClipboard(commitId);
              break;
            case "open-in-forge":
              if (forgeUrl) {
                await openUrl(forgeUrl);
              }
              break;
            case "rewrite-message":
              onRewriteMessage?.(commitId, commitMessage ?? "");
              break;
            default:
              break;
          }
        } catch (err) {
          console.error(`Failed to execute action ${actionId}:`, err);
        }
      },
    });
  } finally {
    onClose?.();
  }
}

// ============================================================================
// File list context menu (history mode)
// ============================================================================

export interface FileContextMenuOptions {
  repoPath: string;
  filePath: string;
  event: React.MouseEvent | React.KeyboardEvent;
  element: HTMLElement;
  /** Called when the menu closes (regardless of action taken) */
  onClose?: () => void;
}

export async function showFileContextMenu(
  options: FileContextMenuOptions
): Promise<void> {
  const { repoPath, filePath, event, element, onClose } = options;

  const actions: ContextMenuAction[] = [
    { id: "copy-path", label: "Copy Relative Path" },
    { id: "copy-full-path", label: "Copy Full Path" },
    { id: "reveal", label: "Reveal in Finder" },
  ];

  const position =
    "clientX" in event
      ? getMenuPositionFromMouseEvent(event)
      : getMenuPositionFromElement(element);

  try {
    await showContextMenu({
      actions,
      position,
      onAction: async (actionId) => {
        try {
          switch (actionId) {
            case "copy-path":
              await copyToClipboard(filePath);
              break;
            case "copy-full-path": {
              const fullPath = await join(repoPath, filePath);
              await copyToClipboard(fullPath);
              break;
            }
            case "reveal": {
              const fullPath = await join(repoPath, filePath);
              await revealItemInDir(fullPath);
              break;
            }
            default:
              break;
          }
        } catch (err) {
          console.error(`Failed to execute action ${actionId}:`, err);
        }
      },
    });
  } finally {
    onClose?.();
  }
}

// ============================================================================
// Changes mode context menu
// ============================================================================

export interface ChangesContextMenuOptions {
  repoPath: string;
  filePath: string;
  section: WorkingFileSection;
  event: React.MouseEvent | React.KeyboardEvent;
  element: HTMLElement;
  /** Called after a successful unstage/discard action to trigger refresh */
  onWorkingChangesModified?: () => void;
  /** Called when the menu closes (regardless of action taken) */
  onClose?: () => void;
}

export async function showChangesContextMenu(
  options: ChangesContextMenuOptions
): Promise<void> {
  const {
    repoPath,
    filePath,
    section,
    event,
    element,
    onWorkingChangesModified,
    onClose,
  } = options;

  const actions: ContextMenuAction[] = [
    { id: "copy-path", label: "Copy Relative Path" },
    { id: "copy-full-path", label: "Copy Full Path" },
    { id: "reveal", label: "Reveal in Finder" },
  ];

  // Add section-specific action
  if (section === "staged") {
    actions.push({ id: "unstage", label: "Unstage" });
  } else {
    actions.push({ id: "discard", label: "Discard" });
  }

  const position =
    "clientX" in event
      ? getMenuPositionFromMouseEvent(event)
      : getMenuPositionFromElement(element);

  try {
    await showContextMenu({
      actions,
      position,
      onAction: async (actionId) => {
        try {
          switch (actionId) {
            case "copy-path":
              await copyToClipboard(filePath);
              break;
            case "copy-full-path": {
              const fullPath = await join(repoPath, filePath);
              await copyToClipboard(fullPath);
              break;
            }
            case "reveal": {
              const fullPath = await join(repoPath, filePath);
              await revealItemInDir(fullPath);
              break;
            }
            case "unstage":
              await invoke("unstage_file", { repoPath, filePath });
              onWorkingChangesModified?.();
              break;
            case "discard":
              await invoke("discard_file", { repoPath, filePath });
              onWorkingChangesModified?.();
              break;
            default:
              break;
          }
        } catch (err) {
          console.error(`Failed to execute action ${actionId}:`, err);
        }
      },
    });
  } finally {
    onClose?.();
  }
}

// ============================================================================
// Keyboard event helper
// ============================================================================

export { isContextMenuKeyboardEvent } from "./contextMenu";

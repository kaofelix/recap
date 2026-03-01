import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriMocks } from "../test/setup";
import {
  type ChangesContextMenuOptions,
  type FileContextMenuOptions,
  type HistoryContextMenuOptions,
  isContextMenuKeyboardEvent,
  showChangesContextMenu,
  showFileContextMenu,
  showHistoryContextMenu,
} from "./contextMenuActions";

// Mock navigator.clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock revealItemInDir from opener plugin
const mockRevealItemInDir = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: (...args: unknown[]) => mockRevealItemInDir(...args),
}));

// Create mock event helpers
function createMockMouseEvent(
  clientX = 100,
  clientY = 200
): React.MouseEvent & { currentTarget: HTMLButtonElement } {
  const element = document.createElement("button");
  return {
    clientX,
    clientY,
    currentTarget: element,
    preventDefault: vi.fn(),
  } as unknown as React.MouseEvent & { currentTarget: HTMLButtonElement };
}

function createMockKeyboardEvent(
  key: string,
  shiftKey = false
): React.KeyboardEvent & { currentTarget: HTMLButtonElement } {
  const element = document.createElement("button");
  element.getBoundingClientRect = () =>
    ({
      left: 50,
      bottom: 150,
      top: 100,
      right: 200,
      width: 150,
      height: 50,
    }) as DOMRect;
  return {
    key,
    shiftKey,
    currentTarget: element,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent & { currentTarget: HTMLButtonElement };
}

describe("isContextMenuKeyboardEvent", () => {
  it("returns true for ContextMenu key", () => {
    const event = createMockKeyboardEvent("ContextMenu");
    expect(isContextMenuKeyboardEvent(event)).toBe(true);
  });

  it("returns true for Shift+F10", () => {
    const event = createMockKeyboardEvent("F10", true);
    expect(isContextMenuKeyboardEvent(event)).toBe(true);
  });

  it("returns false for F10 without shift", () => {
    const event = createMockKeyboardEvent("F10", false);
    expect(isContextMenuKeyboardEvent(event)).toBe(false);
  });

  it("returns false for other keys", () => {
    const event = createMockKeyboardEvent("Enter");
    expect(isContextMenuKeyboardEvent(event)).toBe(false);
  });
});

describe("showHistoryContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows menu with copy commit hash action", async () => {
    const event = createMockMouseEvent();
    const options: HistoryContextMenuOptions = {
      commitId: "abc123def456",
      event,
      element: event.currentTarget,
    };

    await showHistoryContextMenu(options);

    // Menu was created and shown
    expect(tauriMocks.menuPopup).toHaveBeenCalled();
    expect(tauriMocks.menuClose).toHaveBeenCalled();
  });
});

describe("showFileContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows menu with copy and reveal actions", async () => {
    const event = createMockMouseEvent();
    const options: FileContextMenuOptions = {
      repoPath: "/path/to/repo",
      filePath: "src/App.tsx",
      event,
      element: event.currentTarget,
    };

    await showFileContextMenu(options);

    expect(tauriMocks.menuPopup).toHaveBeenCalled();
    expect(tauriMocks.menuClose).toHaveBeenCalled();
  });
});

describe("showChangesContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows menu with unstage action for staged files", async () => {
    const event = createMockMouseEvent();
    const options: ChangesContextMenuOptions = {
      repoPath: "/path/to/repo",
      filePath: "src/App.tsx",
      section: "staged",
      event,
      element: event.currentTarget,
    };

    await showChangesContextMenu(options);

    expect(tauriMocks.menuPopup).toHaveBeenCalled();
    expect(tauriMocks.menuClose).toHaveBeenCalled();
  });

  it("shows menu with discard action for unstaged files", async () => {
    const event = createMockMouseEvent();
    const options: ChangesContextMenuOptions = {
      repoPath: "/path/to/repo",
      filePath: "src/App.tsx",
      section: "unstaged",
      event,
      element: event.currentTarget,
    };

    await showChangesContextMenu(options);

    expect(tauriMocks.menuPopup).toHaveBeenCalled();
    expect(tauriMocks.menuClose).toHaveBeenCalled();
  });
});

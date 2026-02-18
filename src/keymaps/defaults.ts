import type { KeyBinding } from "./types";

export const defaultKeymap: KeyBinding[] = [
  // Panel navigation
  { key: "ArrowRight", command: "navigation.focusNextPanel" },
  { key: "ArrowLeft", command: "navigation.focusPrevPanel" },

  // Item navigation within focused panel
  { key: "ArrowDown", command: "navigation.selectNext" },
  { key: "ArrowUp", command: "navigation.selectPrev" },
  { key: "ctrl+n", command: "navigation.selectNext" },
  { key: "ctrl+p", command: "navigation.selectPrev" },

  // Activate/select current item
  { key: "Enter", command: "navigation.activate" },

  // Diff layout controls
  { key: "meta+Enter", command: "layout.toggleDiffMaximized" },
  { key: "ctrl+Enter", command: "layout.toggleDiffMaximized" },
  { key: "|", command: "layout.toggleDiffDisplayMode" },
  { key: "shift+|", command: "layout.toggleDiffDisplayMode" },
];

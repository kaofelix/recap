import { useEffect, useMemo } from "react";
import { commandEmitter } from "../commands";
import { eventToKeyString } from "../keymaps/parser";
import type { KeyBinding } from "../keymaps/types";

/**
 * Check if the event target is an editable element where we should not intercept keys.
 */
function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" || tagName === "textarea" || target.isContentEditable
  );
}

/**
 * Sets up a global keyboard event listener that maps key presses to commands.
 */
export function useKeyboardHandler(keymap: KeyBinding[]): void {
  // Build a lookup map for fast key -> command resolution
  const keymapLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const binding of keymap) {
      map.set(binding.key, binding.command);
    }
    return map;
  }, [keymap]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept keys when typing in inputs
      if (isEditableElement(event.target)) {
        return;
      }

      const keyString = eventToKeyString(event);
      const command = keymapLookup.get(keyString);

      if (command) {
        commandEmitter.emit(command);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [keymapLookup]);
}

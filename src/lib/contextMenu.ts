import { LogicalPosition } from "@tauri-apps/api/dpi";
import { Menu, MenuItem } from "@tauri-apps/api/menu";

export interface ContextMenuAction {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface ContextMenuOptions {
  /** Actions to show in the menu */
  actions: ContextMenuAction[];
  /** Position to show the menu at (in logical pixels, relative to window) */
  position?: { x: number; y: number };
  /** Callback when an action is selected */
  onAction: (actionId: string) => void;
}

/**
 * Shows a native context menu with the given options.
 * Returns a promise that resolves when the menu is closed.
 */
export async function showContextMenu(
  options: ContextMenuOptions
): Promise<void> {
  const { actions, position, onAction } = options;

  // Build menu items
  const menuItems = await Promise.all(
    actions.map((action) =>
      MenuItem.new({
        id: action.id,
        text: action.label,
        enabled: action.disabled !== true,
        action: () => onAction(action.id),
      })
    )
  );

  // Create and show the menu
  const menu = await Menu.new({ items: menuItems });

  // Show at position if provided, otherwise at cursor
  if (position) {
    await menu.popup(new LogicalPosition(position.x, position.y));
  } else {
    await menu.popup();
  }

  // Clean up menu resources after it closes
  await menu.close();
}

/**
 * Get the position for a context menu from a mouse event.
 */
export function getMenuPositionFromMouseEvent(event: React.MouseEvent): {
  x: number;
  y: number;
} {
  return { x: event.clientX, y: event.clientY };
}

/**
 * Get the position for a context menu from a keyboard event,
 * using the bounding rect of the target element.
 */
export function getMenuPositionFromElement(element: HTMLElement): {
  x: number;
  y: number;
} {
  const rect = element.getBoundingClientRect();
  // Position menu at the bottom-left of the element
  return { x: rect.left, y: rect.bottom };
}

/**
 * Check if a keyboard event is a context menu trigger.
 */
export function isContextMenuKeyboardEvent(
  event: React.KeyboardEvent
): boolean {
  // ContextMenu key
  if (event.key === "ContextMenu") {
    return true;
  }
  // Shift+F10
  if (event.key === "F10" && event.shiftKey) {
    return true;
  }
  return false;
}

import { useCallback } from "react";
import { useAppStore } from "../store/appStore";

/**
 * Returns an `onOpenChange` handler for Radix UI dropdown menus
 * that manages the global `overlayOpen` state and blurs the trigger
 * on close to prevent arrow keys from reopening the dropdown.
 *
 * Accepts an optional callback for component-specific open/close logic.
 */
export function useOverlayOpenChange(
  onOpenChange?: (open: boolean) => void
): (open: boolean) => void {
  return useCallback(
    (open: boolean) => {
      useAppStore.getState().setOverlayOpen(open);
      onOpenChange?.(open);
      if (!open) {
        // Blur trigger after Radix restores focus to prevent arrow keys
        // from reopening the dropdown
        requestAnimationFrame(() => {
          (document.activeElement as HTMLElement | null)?.blur?.();
        });
      }
    },
    [onOpenChange]
  );
}

import { Root } from "@radix-ui/react-dropdown-menu";
import { type ComponentProps, useCallback } from "react";
import { useAppStore } from "../store/appStore";

type RootProps = ComponentProps<typeof Root>;

/**
 * Drop-in replacement for Radix DropdownMenu.Root that automatically
 * manages global overlay state (suppresses hotkeys while open) and
 * blurs the trigger on close to prevent arrow keys from reopening.
 */
export function DropdownMenu({ onOpenChange, ...props }: RootProps) {
  const handleOpenChange = useCallback(
    (open: boolean) => {
      useAppStore.getState().setOverlayOpen(open);
      onOpenChange?.(open);
      if (!open) {
        requestAnimationFrame(() => {
          (document.activeElement as HTMLElement | null)?.blur?.();
        });
      }
    },
    [onOpenChange]
  );

  return <Root onOpenChange={handleOpenChange} {...props} />;
}

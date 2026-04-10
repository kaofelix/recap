import {
  Content,
  type ContentProps,
  Root,
} from "@radix-ui/react-dropdown-menu";
import {
  type ComponentProps,
  type ElementRef,
  forwardRef,
  useCallback,
} from "react";
import { useAppStore } from "../store/appStore";

type RootProps = ComponentProps<typeof Root>;
type DropdownMenuContentProps = ComponentProps<typeof Content>;

function blurActiveElement() {
  requestAnimationFrame(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
}

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
        blurActiveElement();
      }
    },
    [onOpenChange]
  );

  return <Root onOpenChange={handleOpenChange} {...props} />;
}

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof Content>,
  DropdownMenuContentProps
>(({ onCloseAutoFocus, ...props }, ref) => {
  const handleCloseAutoFocus: ContentProps["onCloseAutoFocus"] = (event) => {
    onCloseAutoFocus?.(event);
    event.preventDefault();
    blurActiveElement();
  };

  return (
    <Content {...props} onCloseAutoFocus={handleCloseAutoFocus} ref={ref} />
  );
});

DropdownMenuContent.displayName = "DropdownMenuContent";

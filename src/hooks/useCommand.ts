import { useEffect } from "react";
import { commandEmitter } from "../commands";
import { useIsFocused } from "../context/FocusContext";

/**
 * Subscribe to a command that only fires when the current focus region is active.
 */
export function useCommand(commandId: string, handler: () => void): void {
  const isFocused = useIsFocused();

  useEffect(() => {
    return commandEmitter.subscribe(commandId, () => {
      if (isFocused) {
        handler();
      }
    });
  }, [commandId, handler, isFocused]);
}

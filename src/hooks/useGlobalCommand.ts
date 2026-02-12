import { useEffect } from "react";
import { commandEmitter } from "../commands";

/**
 * Subscribe to a command that fires regardless of focus state.
 */
export function useGlobalCommand(commandId: string, handler: () => void): void {
  useEffect(() => {
    return commandEmitter.subscribe(commandId, handler);
  }, [commandId, handler]);
}

import { createContext, type ReactNode, useContext } from "react";
import { useAppStore, useFocusedRegion } from "../store/appStore";
import type { FocusRegion } from "../types/focus";

const FocusContext = createContext<FocusRegion | null>(null);

export interface FocusProviderProps {
  region: FocusRegion;
  children: ReactNode;
}

export function FocusProvider({ region, children }: FocusProviderProps) {
  const setFocusedRegion = useAppStore((s) => s.setFocusedRegion);

  const handleClick = () => {
    setFocusedRegion(region);
  };

  return (
    <FocusContext.Provider value={region}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Focus is set via keyboard navigation system */}
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: This is a focus tracking container */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: This is a focus tracking container */}
      <div className="h-full" onClick={handleClick}>
        {children}
      </div>
    </FocusContext.Provider>
  );
}

export function useFocusRegion(): FocusRegion | null {
  return useContext(FocusContext);
}

export function useIsFocused(): boolean {
  const region = useFocusRegion();
  const focusedRegion = useFocusedRegion();
  return region !== null && region === focusedRegion;
}

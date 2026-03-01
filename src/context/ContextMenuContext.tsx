import { createContext, useCallback, useContext, useState } from "react";

interface ContextMenuState {
  /** Whether any context menu is currently open */
  isOpen: boolean;
  /** Mark context menu as open */
  setOpen: () => void;
  /** Mark context menu as closed */
  setClosed: () => void;
}

const ContextMenuContext = createContext<ContextMenuState | null>(null);

export function ContextMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const setOpen = useCallback(() => setIsOpen(true), []);
  const setClosed = useCallback(() => setIsOpen(false), []);

  return (
    <ContextMenuContext.Provider value={{ isOpen, setOpen, setClosed }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenuState(): ContextMenuState {
  const context = useContext(ContextMenuContext);
  if (!context) {
    // Return a no-op implementation if not wrapped in provider
    return {
      isOpen: false,
      setOpen: () => undefined,
      setClosed: () => undefined,
    };
  }
  return context;
}

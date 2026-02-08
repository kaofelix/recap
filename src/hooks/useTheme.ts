import { useCallback, useEffect, useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme-mode";

// Get the system preference
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Get stored theme from localStorage
function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

// Resolve the actual theme to apply
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

// Apply theme to DOM
function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// Store for managing theme state
type ThemeState = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
};

let currentState: ThemeState = {
  mode: "system",
  resolved: "light",
};

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ThemeState {
  return currentState;
}

function getServerSnapshot(): ThemeState {
  return { mode: "system", resolved: "light" };
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setThemeMode(mode: ThemeMode): void {
  const resolved = resolveTheme(mode);
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(resolved);
  currentState = { mode, resolved };
  emitChange();
}

// Initialize theme on module load
function initializeTheme(): void {
  if (typeof window === "undefined") return;
  
  const mode = getStoredTheme();
  const resolved = resolveTheme(mode);
  applyTheme(resolved);
  currentState = { mode, resolved };

  // Listen for system preference changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (): void => {
    if (currentState.mode === "system") {
      const newResolved = getSystemTheme();
      applyTheme(newResolved);
      currentState = { ...currentState, resolved: newResolved };
      emitChange();
    }
  };
  mediaQuery.addEventListener("change", handleChange);
}

// Track if initialized
let initialized = false;

// Initialize on first use (not module load to support SSR/testing)
function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  initializeTheme();
}

export interface UseThemeReturn {
  /** Current theme mode setting (light, dark, or system) */
  mode: ThemeMode;
  /** Resolved theme being applied (light or dark) */
  resolvedTheme: ResolvedTheme;
  /** Set the theme mode */
  setTheme: (mode: ThemeMode) => void;
  /** Toggle between light and dark modes */
  toggleTheme: () => void;
}

export function useTheme(): UseThemeReturn {
  ensureInitialized();
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = currentState.resolved;
    setThemeMode(current === "dark" ? "light" : "dark");
  }, []);

  // Re-initialize on mount to ensure SSR hydration works
  useEffect(() => {
    const mode = getStoredTheme();
    const resolved = resolveTheme(mode);
    if (currentState.mode !== mode || currentState.resolved !== resolved) {
      applyTheme(resolved);
      currentState = { mode, resolved };
      emitChange();
    }
  }, []);

  return {
    mode: state.mode,
    resolvedTheme: state.resolved,
    setTheme,
    toggleTheme,
  };
}

// Re-export for testing
export const __testing = {
  initializeTheme,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  applyTheme,
  setThemeMode,
  resetState: () => {
    currentState = { mode: "system", resolved: "light" };
    listeners.clear();
    initialized = false;
  },
};

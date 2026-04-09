import { useCallback, useSyncExternalStore } from "react";
import type { ResolvedTheme, ThemeMode } from "../store/settingsStore";
import { useSettingsStore } from "../store/settingsStore";

export type { ResolvedTheme, ThemeMode } from "../store/settingsStore";

// Get the system preference
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
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
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// ─── System theme external store (for useSyncExternalStore) ──────────

const systemThemeListeners = new Set<() => void>();

function subscribeSystemTheme(callback: () => void): () => void {
  systemThemeListeners.add(callback);
  return () => systemThemeListeners.delete(callback);
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return getSystemTheme();
}

function getServerSnapshot(): ResolvedTheme {
  return "light";
}

// ─── Theme engine setup ─────────────────────────────────────────────

let initialized = false;

/**
 * Set up theme application. Call once from each window's entry point
 * (main.tsx, settings-main.tsx) to ensure the theme is applied immediately
 * and stays in sync with settings changes and system preference changes.
 */
export function setupTheme(): void {
  if (initialized || typeof window === "undefined") {
    return;
  }
  initialized = true;

  // Apply initial theme immediately (before React renders, avoids flash)
  const initialMode = useSettingsStore.getState().themeMode;
  applyTheme(resolveTheme(initialMode));

  // Re-apply whenever settings change (local or cross-window sync)
  useSettingsStore.subscribe((state, prevState) => {
    if (state.themeMode !== prevState.themeMode) {
      applyTheme(resolveTheme(state.themeMode));
    }
  });

  // Listen for system preference changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    // Notify React subscribers so resolvedTheme re-derives
    for (const listener of systemThemeListeners) {
      listener();
    }
    // Apply DOM update if in system mode
    if (useSettingsStore.getState().themeMode === "system") {
      applyTheme(getSystemTheme());
    }
  });
}

// ─── React hook ─────────────────────────────────────────────────────

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
  setupTheme();

  const mode = useSettingsStore((s) => s.themeMode);

  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getServerSnapshot
  );

  const resolvedTheme: ResolvedTheme = mode === "system" ? systemTheme : mode;

  const setTheme = useCallback((newMode: ThemeMode) => {
    useSettingsStore.getState().setThemeMode(newMode);
    applyTheme(resolveTheme(newMode));
  }, []);

  const toggleTheme = useCallback(() => {
    const currentResolved = resolveTheme(useSettingsStore.getState().themeMode);
    const newMode: ThemeMode = currentResolved === "dark" ? "light" : "dark";
    useSettingsStore.getState().setThemeMode(newMode);
    applyTheme(newMode);
  }, []);

  return { mode, resolvedTheme, setTheme, toggleTheme };
}

// ─── Testing helpers ────────────────────────────────────────────────

export const __testing = {
  resetState: () => {
    initialized = false;
    systemThemeListeners.clear();
  },
};

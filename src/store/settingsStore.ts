import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "recap-settings";

export interface SettingsState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: "system" as ThemeMode,
      setThemeMode: (themeMode: ThemeMode) => set({ themeMode }),
    }),
    {
      name: STORAGE_KEY,
      version: 0,
      partialize: (state) => ({ themeMode: state.themeMode }),
    }
  )
);

// Cross-window sync: when another window writes to our localStorage key,
// rehydrate the store so all windows stay in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      useSettingsStore.persist.rehydrate();
    }
  });
}

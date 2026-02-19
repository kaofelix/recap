import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";

export interface UpdaterState {
  checking: boolean;
  updateAvailable: Update | null;
  downloading: boolean;
  error: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    checking: false,
    updateAvailable: null,
    downloading: false,
    error: null,
  });

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));

    try {
      const update = await check();
      setState((prev) => ({
        ...prev,
        checking: false,
        updateAvailable: update,
      }));
      return update;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        checking: false,
        error:
          err instanceof Error ? err.message : "Failed to check for updates",
      }));
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!state.updateAvailable) {
      return;
    }

    setState((prev) => ({
      ...prev,
      downloading: true,
      error: null,
    }));

    try {
      await state.updateAvailable.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
          case "Progress":
          case "Finished":
            // Progress events - could be used to show download progress
            break;
          default:
            break;
        }
      });

      await relaunch();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: err instanceof Error ? err.message : "Failed to download update",
      }));
    }
  }, [state.updateAvailable]);

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({ ...prev, updateAvailable: null }));
  }, []);

  // Check for updates on mount (after a short delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}

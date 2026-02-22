import { listen } from "@tauri-apps/api/event";
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

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    let unlisten: null | (() => void) = null;

    const setup = async () => {
      unlisten = await listen("menu://check-for-updates", () => {
        checkForUpdates().catch((error) => {
          console.error("Failed to check for updates from menu event", error);
        });
      });
    };

    setup().catch((error) => {
      console.error("Failed to set up check-for-updates menu listener", error);
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [checkForUpdates]);

  // Check for updates on mount (after a short delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates().catch((error) => {
        console.error("Failed to check for updates on startup", error);
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
    dismissError,
  };
}

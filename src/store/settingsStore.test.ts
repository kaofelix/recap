import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settingsStore";

const STORAGE_KEY = "recap-settings";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useSettingsStore.setState({ themeMode: "system" });
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("has default themeMode of system", () => {
    expect(useSettingsStore.getState().themeMode).toBe("system");
  });

  it("updates themeMode via setThemeMode", () => {
    act(() => {
      useSettingsStore.getState().setThemeMode("dark");
    });

    expect(useSettingsStore.getState().themeMode).toBe("dark");
  });

  it("persists themeMode to localStorage", () => {
    act(() => {
      useSettingsStore.getState().setThemeMode("dark");
    });

    const storedJson = localStorage.getItem(STORAGE_KEY);
    expect(storedJson).not.toBeNull();

    const stored = JSON.parse(storedJson ?? "{}");
    expect(stored.state.themeMode).toBe("dark");
  });

  it("rehydrates themeMode from localStorage", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { themeMode: "light" }, version: 0 })
    );

    await act(async () => {
      await useSettingsStore.persist.rehydrate();
    });

    expect(useSettingsStore.getState().themeMode).toBe("light");
  });

  it("syncs when another window changes localStorage", async () => {
    expect(useSettingsStore.getState().themeMode).toBe("system");

    const newValue = JSON.stringify({
      state: { themeMode: "dark" },
      version: 0,
    });
    localStorage.setItem(STORAGE_KEY, newValue);

    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue,
        })
      );
    });

    expect(useSettingsStore.getState().themeMode).toBe("dark");
  });

  it("ignores storage events for other keys", async () => {
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "some-other-key",
          newValue: "whatever",
        })
      );
    });

    expect(useSettingsStore.getState().themeMode).toBe("system");
  });
});

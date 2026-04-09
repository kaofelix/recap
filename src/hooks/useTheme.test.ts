import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "../store/settingsStore";
import { __testing, useTheme } from "./useTheme";

describe("useTheme", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();

    // Reset theme engine
    __testing.resetState();

    // Reset settings store
    useSettingsStore.setState({ themeMode: "system" });

    // Mock matchMedia
    originalMatchMedia = window.matchMedia;
    mockMediaQueryList = {
      matches: false, // Default to light system preference
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList);

    // Clear any existing dark class
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("should default to system mode", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe("system");
  });

  it("should resolve system mode to light when system prefers light", () => {
    mockMediaQueryList.matches = false;
    const { result } = renderHook(() => useTheme());

    expect(result.current.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should resolve system mode to dark when system prefers dark", () => {
    mockMediaQueryList.matches = true;
    const { result } = renderHook(() => useTheme());

    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should persist theme choice to settings store", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme("dark");
    });

    expect(useSettingsStore.getState().themeMode).toBe("dark");
  });

  it("should read theme from settings store", () => {
    act(() => {
      useSettingsStore.setState({ themeMode: "dark" });
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  it("should apply dark class when theme is dark", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme("dark");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should remove dark class when theme is light", () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme("light");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should toggle between light and dark", () => {
    const { result } = renderHook(() => useTheme());

    // Start with light (system default with mocked light preference)
    expect(result.current.resolvedTheme).toBe("light");

    // Toggle to dark
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.resolvedTheme).toBe("dark");
    expect(result.current.mode).toBe("dark");

    // Toggle back to light
    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.resolvedTheme).toBe("light");
    expect(result.current.mode).toBe("light");
  });

  it("should handle system preference change when in system mode", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedTheme).toBe("light");

    // Simulate system preference change
    act(() => {
      mockMediaQueryList.matches = true;
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls.find(
        (call) => call[0] === "change"
      )?.[1];
      if (changeHandler) {
        changeHandler();
      }
    });

    // Mode should still be system, but resolved should change
    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  it("should react when settings store changes externally", () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe("system");

    // Simulate settings store being updated (e.g. cross-window sync)
    act(() => {
      useSettingsStore.setState({ themeMode: "dark" });
    });

    expect(result.current.mode).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
  });
});

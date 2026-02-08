import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme, __testing } from "./useTheme";

describe("useTheme", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Reset internal state
    __testing.resetState();

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
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.mode).toBe("system");
  });

  it("should resolve system mode to light when system prefers light", () => {
    mockMediaQueryList.matches = false;
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should resolve system mode to dark when system prefers dark", () => {
    mockMediaQueryList.matches = true;
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should persist theme choice to localStorage", () => {
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });
    
    expect(localStorage.getItem("theme-mode")).toBe("dark");
  });

  it("should load theme from localStorage on init", () => {
    localStorage.setItem("theme-mode", "dark");
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.mode).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  it("should apply dark class when theme is dark", () => {
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("dark");
    });
    
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should remove dark class when theme is light", () => {
    document.documentElement.classList.add("dark");
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("light");
    });
    
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("should toggle between light and dark", () => {
    __testing.initializeTheme();
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
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme("system");
    });
    
    expect(result.current.mode).toBe("system");
    expect(result.current.resolvedTheme).toBe("light");
    
    // Simulate system preference change
    act(() => {
      mockMediaQueryList.matches = true;
      // Get the change handler that was registered
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

  it("should ignore invalid localStorage values", () => {
    localStorage.setItem("theme-mode", "invalid");
    __testing.initializeTheme();
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.mode).toBe("system");
  });
});

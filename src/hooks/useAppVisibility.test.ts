import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Don't use the global mock for this test file - test the real implementation
vi.unmock("../hooks/useAppVisibility");

describe("useAppVisibility", () => {
  it("returns true when document is visible and focused", async () => {
    // Setup: document is visible and focused
    Object.defineProperty(document, "hidden", { value: false, writable: true });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    const { useAppVisibility } = await import("./useAppVisibility");
    const { result } = renderHook(() => useAppVisibility());

    expect(result.current).toBe(true);
  });

  it("returns false when document is hidden", async () => {
    Object.defineProperty(document, "hidden", { value: true, writable: true });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    const { useAppVisibility } = await import("./useAppVisibility");
    const { result } = renderHook(() => useAppVisibility());

    expect(result.current).toBe(false);
  });

  it("returns false when document is not focused", async () => {
    Object.defineProperty(document, "hidden", { value: false, writable: true });
    vi.spyOn(document, "hasFocus").mockReturnValue(false);

    const { useAppVisibility } = await import("./useAppVisibility");
    const { result } = renderHook(() => useAppVisibility());

    expect(result.current).toBe(false);
  });

  it("updates when visibility changes", async () => {
    Object.defineProperty(document, "hidden", { value: false, writable: true });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    const { useAppVisibility } = await import("./useAppVisibility");
    const { result } = renderHook(() => useAppVisibility());

    expect(result.current).toBe(true);

    // Simulate document becoming hidden
    act(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current).toBe(false);
  });

  it("updates when focus changes", async () => {
    Object.defineProperty(document, "hidden", { value: false, writable: true });
    const hasFocusMock = vi.spyOn(document, "hasFocus").mockReturnValue(true);

    const { useAppVisibility } = await import("./useAppVisibility");
    const { result } = renderHook(() => useAppVisibility());

    expect(result.current).toBe(true);

    // Simulate window losing focus
    act(() => {
      hasFocusMock.mockReturnValue(false);
      window.dispatchEvent(new Event("blur"));
    });

    expect(result.current).toBe(false);

    // Simulate window regaining focus
    act(() => {
      hasFocusMock.mockReturnValue(true);
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current).toBe(true);
  });

  it("cleans up event listeners on unmount", async () => {
    Object.defineProperty(document, "hidden", { value: false, writable: true });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    const documentRemoveSpy = vi.spyOn(document, "removeEventListener");
    const windowRemoveSpy = vi.spyOn(window, "removeEventListener");

    const { useAppVisibility } = await import("./useAppVisibility");
    const { unmount } = renderHook(() => useAppVisibility());

    unmount();

    expect(documentRemoveSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
    expect(windowRemoveSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(windowRemoveSpy).toHaveBeenCalledWith("blur", expect.any(Function));
  });
});

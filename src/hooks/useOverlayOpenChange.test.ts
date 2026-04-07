import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../store/appStore";
import { useOverlayOpenChange } from "./useOverlayOpenChange";

describe("useOverlayOpenChange", () => {
  beforeEach(() => {
    useAppStore.setState({ overlayOpen: false });
  });

  it("sets overlayOpen to true when called with true", () => {
    const { result } = renderHook(() => useOverlayOpenChange());

    act(() => {
      result.current(true);
    });

    expect(useAppStore.getState().overlayOpen).toBe(true);
  });

  it("sets overlayOpen to false when called with false", () => {
    useAppStore.setState({ overlayOpen: true });
    const { result } = renderHook(() => useOverlayOpenChange());

    act(() => {
      result.current(false);
    });

    expect(useAppStore.getState().overlayOpen).toBe(false);
  });

  it("blurs active element on close via requestAnimationFrame", async () => {
    const { result } = renderHook(() => useOverlayOpenChange());

    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    expect(document.activeElement).toBe(button);

    act(() => {
      result.current(false);
    });

    // Flush requestAnimationFrame
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(document.activeElement).not.toBe(button);
    document.body.removeChild(button);
  });

  it("does not blur on open", () => {
    const { result } = renderHook(() => useOverlayOpenChange());

    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();

    act(() => {
      result.current(true);
    });

    expect(document.activeElement).toBe(button);
    document.body.removeChild(button);
  });

  it("calls the provided onOpenChange callback", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useOverlayOpenChange(callback));

    act(() => {
      result.current(true);
    });

    expect(callback).toHaveBeenCalledWith(true);

    act(() => {
      result.current(false);
    });

    expect(callback).toHaveBeenCalledWith(false);
  });
});

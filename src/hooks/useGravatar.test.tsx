import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __testing, useGravatar } from "./useGravatar";

describe("useGravatar", () => {
  const originalImage = globalThis.Image;

  beforeEach(() => {
    __testing.resetAvatarCache();
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    __testing.resetAvatarCache();
  });

  it("retries a previously failed avatar load on the next subscription", async () => {
    let loadAttempts = 0;

    class RetryImage {
      onerror: null | (() => void) = null;
      onload: null | (() => void) = null;

      set src(_value: string) {
        loadAttempts += 1;
        queueMicrotask(() => {
          if (loadAttempts === 1) {
            this.onerror?.();
            return;
          }

          this.onload?.();
        });
      }
    }

    // @ts-expect-error test stub
    globalThis.Image = RetryImage;

    const first = renderHook(() => useGravatar("jane@example.com"));

    await waitFor(() => {
      expect(first.result.current.hasFailed).toBe(true);
    });

    first.unmount();

    const second = renderHook(() => useGravatar("jane@example.com"));

    await waitFor(() => {
      expect(second.result.current.isLoaded).toBe(true);
    });

    expect(loadAttempts).toBe(2);
  });
});

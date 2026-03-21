import { useCallback, useEffect, useRef } from "react";

/**
 * Calls `onInView` when the sentinel element becomes visible in the viewport.
 * Returns a ref callback to attach to the sentinel element.
 */
export function useInView(
  onInView: () => void
): (node: HTMLElement | null) => void {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const callbackRef = useRef(onInView);
  callbackRef.current = onInView;

  // Clean up observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const setRef = useCallback((node: HTMLElement | null) => {
    // Disconnect previous observer
    observerRef.current?.disconnect();

    if (!node) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callbackRef.current();
        }
      },
      { threshold: 0 }
    );

    observerRef.current.observe(node);
  }, []);

  return setRef;
}

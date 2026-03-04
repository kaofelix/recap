import { useEffect, useState } from "react";

/**
 * Track whether the app is visible and focused.
 * Returns false when:
 * - Document is hidden (tab switched, minimized)
 * - Window is not focused (user clicked elsewhere)
 *
 * Use this to pause expensive operations when the app isn't actively used.
 */
export function useAppVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(
    () => !document.hidden && document.hasFocus()
  );

  useEffect(() => {
    const update = () => {
      setIsVisible(!document.hidden && document.hasFocus());
    };

    // Visibility API (tab switches, minimize)
    document.addEventListener("visibilitychange", update);
    // Focus events (window blur/focus)
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);

    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);

  return isVisible;
}

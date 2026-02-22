import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useUpdater } from "../../hooks/useUpdater";
import { cn } from "../../lib/utils";

/** Minimum time to show the "Checking" state for visual feedback (ms) */
const MIN_CHECKING_DURATION = 1000;
/** How long to show the "Up to date" message before fading out (ms) */
const UP_TO_DATE_DISPLAY_DURATION = 3000;

export function UpdaterStatus() {
  const { checking, updateAvailable, downloading, downloadAndInstall } =
    useUpdater();

  // Track visual checking state (may persist longer than actual check)
  const [showChecking, setShowChecking] = useState(false);
  const [checkingStartTime, setCheckingStartTime] = useState<number | null>(
    null
  );

  // Track "up to date" feedback state
  const [showUpToDate, setShowUpToDate] = useState(false);
  const [upToDateFading, setUpToDateFading] = useState(false);

  // Handle checking state transitions
  useEffect(() => {
    if (checking && !showChecking) {
      // Started checking
      setShowChecking(true);
      setCheckingStartTime(Date.now());
      setShowUpToDate(false);
      setUpToDateFading(false);
    } else if (!checking && showChecking && checkingStartTime) {
      // Finished checking - ensure minimum display time
      const elapsed = Date.now() - checkingStartTime;
      const remaining = MIN_CHECKING_DURATION - elapsed;

      if (remaining > 0) {
        const timer = setTimeout(() => {
          setShowChecking(false);
          setCheckingStartTime(null);
          if (!updateAvailable) {
            setShowUpToDate(true);
          }
        }, remaining);
        return () => clearTimeout(timer);
      }

      setShowChecking(false);
      setCheckingStartTime(null);
      if (!updateAvailable) {
        setShowUpToDate(true);
      }
    }
  }, [checking, showChecking, checkingStartTime, updateAvailable]);

  // Handle "up to date" fade out
  useEffect(() => {
    if (!showUpToDate) {
      return;
    }

    // Start fade out after display duration
    const fadeTimer = setTimeout(() => {
      setUpToDateFading(true);
    }, UP_TO_DATE_DISPLAY_DURATION);

    // Remove from DOM after fade animation completes
    const removeTimer = setTimeout(() => {
      setShowUpToDate(false);
      setUpToDateFading(false);
    }, UP_TO_DATE_DISPLAY_DURATION + 500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [showUpToDate]);

  if (showChecking) {
    return (
      <span className="flex items-center gap-1.5 text-text-tertiary text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking for updates…
      </span>
    );
  }

  if (downloading) {
    return (
      <span className="flex items-center gap-1.5 text-text-tertiary text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Installing update…
      </span>
    );
  }

  if (updateAvailable) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <span className="text-text-secondary">Update available.</span>
        <button
          className="text-accent-primary underline underline-offset-2 hover:text-accent-primary/80"
          onClick={downloadAndInstall}
          type="button"
        >
          Update and restart
        </button>
      </div>
    );
  }

  if (showUpToDate) {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 text-text-tertiary text-xs transition-opacity duration-500",
          upToDateFading && "opacity-0"
        )}
      >
        <Check className="h-3 w-3" />
        Up to date!
      </span>
    );
  }

  return null;
}

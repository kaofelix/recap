import { AlertCircle, Check, Download, RefreshCw, X } from "lucide-react";
import { useUpdater } from "../hooks/useUpdater";

export function UpdateNotification() {
  const {
    checking,
    updateAvailable,
    downloading,
    error,
    downloadAndInstall,
    dismissUpdate,
    dismissError,
  } = useUpdater();

  // Show checking state briefly
  if (checking && !updateAvailable) {
    return (
      <div className="fixed right-4 bottom-4 flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-3 text-sm text-white shadow-lg">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Checking for updates...
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="fixed right-4 bottom-4 flex max-w-sm items-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{error}</span>
        <button
          aria-label="Dismiss"
          className="rounded p-1 hover:bg-red-700"
          onClick={dismissError}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Show update available
  if (updateAvailable) {
    return (
      <div className="fixed right-4 bottom-4 flex max-w-sm items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-sm text-white shadow-lg">
        {downloading ? (
          <>
            <RefreshCw className="h-4 w-4 flex-shrink-0 animate-spin" />
            <span className="flex-1">Downloading update...</span>
          </>
        ) : (
          <>
            <Download className="h-4 w-4 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">Update Available</div>
              <div className="text-blue-200 text-xs">
                Version {updateAvailable.version}
              </div>
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          {!downloading && (
            <>
              <button
                className="flex items-center gap-1 rounded bg-white px-3 py-1.5 font-medium text-blue-600 transition-colors hover:bg-blue-50"
                onClick={downloadAndInstall}
                type="button"
              >
                <Check className="h-3.5 w-3.5" />
                Install
              </button>
              <button
                aria-label="Dismiss"
                className="rounded p-1.5 transition-colors hover:bg-blue-700"
                onClick={dismissUpdate}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}

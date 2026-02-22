import { useUpdater } from "../../hooks/useUpdater";

export function UpdaterStatus() {
  const { checking, updateAvailable, downloading, downloadAndInstall } =
    useUpdater();

  if (checking && !updateAvailable) {
    return (
      <span className="text-text-tertiary text-xs">Checking for updates…</span>
    );
  }

  if (downloading) {
    return (
      <span className="text-text-tertiary text-xs">Installing update…</span>
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

  return null;
}

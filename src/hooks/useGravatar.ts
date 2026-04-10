import { useCallback, useMemo, useSyncExternalStore } from "react";
import { gravatarUrl } from "../lib/gravatar";

type AvatarStatus = "loading" | "loaded" | "failed";

interface CacheEntry {
  status: AvatarStatus;
  listeners: Set<() => void>;
}

const avatarCache = new Map<string, CacheEntry>();

function notify(entry: CacheEntry) {
  for (const listener of entry.listeners) {
    listener();
  }
}

function createEntry(src: string): CacheEntry {
  const entry: CacheEntry = {
    status: "loading",
    listeners: new Set(),
  };
  avatarCache.set(src, entry);

  const image = new Image();
  image.onload = () => {
    entry.status = "loaded";
    notify(entry);
  };
  image.onerror = () => {
    entry.status = "failed";
    notify(entry);
  };
  image.src = src;

  return entry;
}

function ensureEntry(src: string): CacheEntry {
  return avatarCache.get(src) ?? createEntry(src);
}

function subscribe(src: string, listener: () => void): () => void {
  const entry = ensureEntry(src);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.status === "failed" && entry.listeners.size === 0) {
      avatarCache.delete(src);
    }
  };
}

function getSnapshot(src: string): AvatarStatus {
  return ensureEntry(src).status;
}

export function useGravatar(email: string, size = 40) {
  const src = useMemo(() => gravatarUrl(email, size), [email, size]);
  const subscribeToAvatar = useCallback(
    (listener: () => void) => subscribe(src, listener),
    [src]
  );
  const getAvatarSnapshot = useCallback(() => getSnapshot(src), [src]);
  const status = useSyncExternalStore(
    subscribeToAvatar,
    getAvatarSnapshot,
    getAvatarSnapshot
  );

  return {
    src,
    status,
    isLoaded: status === "loaded",
    hasFailed: status === "failed",
  };
}

export const __testing = {
  resetAvatarCache() {
    avatarCache.clear();
  },
};

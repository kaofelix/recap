/**
 * Converts a KeyboardEvent to a normalized key string.
 * Format: "modifier+modifier+key" (e.g., "ctrl+shift+a")
 * Modifier order: ctrl, shift, alt, meta
 */
export function eventToKeyString(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey) {
    parts.push("ctrl");
  }
  if (event.shiftKey) {
    parts.push("shift");
  }
  if (event.altKey) {
    parts.push("alt");
  }
  if (event.metaKey) {
    parts.push("meta");
  }

  parts.push(event.key);

  return parts.join("+");
}

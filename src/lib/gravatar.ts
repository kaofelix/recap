import md5 from "md5";

/**
 * Build a Gravatar URL from an email address.
 *
 * @param email  – the author's email (case-insensitive, trimmed)
 * @param size   – image size in pixels (default 40, rendered at 20px with 2× for retina)
 * @returns the full Gravatar URL with `retro` fallback
 */
export function gravatarUrl(email: string, size = 40): string {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=retro`;
}

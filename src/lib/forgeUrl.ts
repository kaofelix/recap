/**
 * Parses a git remote URL and constructs the web URL for a commit on the
 * corresponding forge (GitHub, GitLab, Bitbucket, etc.).
 */

interface ParsedRemote {
  /** e.g. "github.com", "gitlab.com", "bitbucket.org" */
  host: string;
  /** e.g. "owner/repo" */
  path: string;
}

/**
 * Parse a git remote URL (SSH or HTTPS) into host + path.
 *
 * Supports:
 * - `git@github.com:owner/repo.git`
 * - `https://github.com/owner/repo.git`
 * - `ssh://git@github.com/owner/repo.git`
 * - `git://github.com/owner/repo.git`
 */
export function parseRemoteUrl(remoteUrl: string): ParsedRemote | null {
  // Strip trailing .git
  const cleaned = remoteUrl.replace(/\.git$/, "");

  // SSH shorthand: git@host:owner/repo
  const sshMatch = cleaned.match(/^[\w-]+@([^:]+):(.+)$/);
  if (sshMatch) {
    return { host: sshMatch[1], path: sshMatch[2] };
  }

  // HTTPS / SSH / git protocol: scheme://host/owner/repo
  try {
    const url = new URL(cleaned);
    // Remove leading slash from pathname
    const path = url.pathname.replace(/^\//, "");
    if (url.hostname && path) {
      return { host: url.hostname, path };
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

type ForgeType = "github" | "gitlab" | "bitbucket" | "unknown";

/**
 * Detect the forge type from the hostname.
 */
export function detectForge(host: string): ForgeType {
  const lower = host.toLowerCase();
  if (lower === "github.com" || lower.includes("github")) {
    return "github";
  }
  if (lower === "gitlab.com" || lower.includes("gitlab")) {
    return "gitlab";
  }
  if (lower === "bitbucket.org" || lower.includes("bitbucket")) {
    return "bitbucket";
  }
  return "unknown";
}

/**
 * Build the web URL for viewing a commit on a forge.
 *
 * Commit URL patterns:
 * - GitHub:    https://github.com/{owner}/{repo}/commit/{sha}
 * - GitLab:    https://gitlab.com/{owner}/{repo}/-/commit/{sha}
 * - Bitbucket: https://bitbucket.org/{owner}/{repo}/commits/{sha}
 * - Unknown:   falls back to GitHub-style (most common pattern)
 */
export function buildCommitUrl(remote: ParsedRemote, commitId: string): string {
  const base = `https://${remote.host}/${remote.path}`;
  const forge = detectForge(remote.host);

  if (forge === "gitlab") {
    return `${base}/-/commit/${commitId}`;
  }
  if (forge === "bitbucket") {
    return `${base}/commits/${commitId}`;
  }
  // GitHub and unknown forges use the most common pattern
  return `${base}/commit/${commitId}`;
}

/**
 * Given a raw git remote URL and a commit SHA, returns the web URL
 * to view that commit on the forge, or null if the URL can't be parsed.
 */
export function getForgeCommitUrl(
  remoteUrl: string,
  commitId: string
): string | null {
  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) {
    return null;
  }
  return buildCommitUrl(parsed, commitId);
}

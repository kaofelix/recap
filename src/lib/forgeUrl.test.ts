import { describe, expect, it } from "vitest";
import {
  buildCommitUrl,
  detectForge,
  getForgeCommitUrl,
  parseRemoteUrl,
} from "./forgeUrl";

describe("parseRemoteUrl", () => {
  it("parses SSH shorthand (git@)", () => {
    const result = parseRemoteUrl("git@github.com:owner/repo.git");
    expect(result).toEqual({ host: "github.com", path: "owner/repo" });
  });

  it("parses HTTPS URL", () => {
    const result = parseRemoteUrl("https://github.com/owner/repo.git");
    expect(result).toEqual({ host: "github.com", path: "owner/repo" });
  });

  it("parses HTTPS URL without .git suffix", () => {
    const result = parseRemoteUrl("https://github.com/owner/repo");
    expect(result).toEqual({ host: "github.com", path: "owner/repo" });
  });

  it("parses SSH protocol URL", () => {
    const result = parseRemoteUrl("ssh://git@github.com/owner/repo.git");
    expect(result).toEqual({ host: "github.com", path: "owner/repo" });
  });

  it("parses git protocol URL", () => {
    const result = parseRemoteUrl("git://github.com/owner/repo.git");
    expect(result).toEqual({ host: "github.com", path: "owner/repo" });
  });

  it("handles nested paths (GitLab subgroups)", () => {
    const result = parseRemoteUrl("git@gitlab.com:group/subgroup/repo.git");
    expect(result).toEqual({
      host: "gitlab.com",
      path: "group/subgroup/repo",
    });
  });

  it("returns null for invalid URLs", () => {
    expect(parseRemoteUrl("not-a-url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRemoteUrl("")).toBeNull();
  });
});

describe("detectForge", () => {
  it("detects GitHub", () => {
    expect(detectForge("github.com")).toBe("github");
  });

  it("detects GitHub Enterprise", () => {
    expect(detectForge("github.example.com")).toBe("github");
  });

  it("detects GitLab", () => {
    expect(detectForge("gitlab.com")).toBe("gitlab");
  });

  it("detects self-hosted GitLab", () => {
    expect(detectForge("gitlab.example.com")).toBe("gitlab");
  });

  it("detects Bitbucket", () => {
    expect(detectForge("bitbucket.org")).toBe("bitbucket");
  });

  it("returns unknown for other hosts", () => {
    expect(detectForge("example.com")).toBe("unknown");
  });
});

describe("buildCommitUrl", () => {
  const sha = "abc123def456";

  it("builds GitHub commit URL", () => {
    const url = buildCommitUrl({ host: "github.com", path: "owner/repo" }, sha);
    expect(url).toBe("https://github.com/owner/repo/commit/abc123def456");
  });

  it("builds GitLab commit URL with /-/ prefix", () => {
    const url = buildCommitUrl({ host: "gitlab.com", path: "owner/repo" }, sha);
    expect(url).toBe("https://gitlab.com/owner/repo/-/commit/abc123def456");
  });

  it("builds Bitbucket commit URL with /commits/ path", () => {
    const url = buildCommitUrl(
      { host: "bitbucket.org", path: "owner/repo" },
      sha
    );
    expect(url).toBe("https://bitbucket.org/owner/repo/commits/abc123def456");
  });

  it("falls back to GitHub-style for unknown forges", () => {
    const url = buildCommitUrl(
      { host: "example.com", path: "owner/repo" },
      sha
    );
    expect(url).toBe("https://example.com/owner/repo/commit/abc123def456");
  });
});

describe("getForgeCommitUrl", () => {
  const sha = "abc123def456";

  it("returns full URL for GitHub SSH remote", () => {
    const url = getForgeCommitUrl("git@github.com:owner/repo.git", sha);
    expect(url).toBe("https://github.com/owner/repo/commit/abc123def456");
  });

  it("returns full URL for GitLab HTTPS remote", () => {
    const url = getForgeCommitUrl("https://gitlab.com/owner/repo.git", sha);
    expect(url).toBe("https://gitlab.com/owner/repo/-/commit/abc123def456");
  });

  it("returns null for unparseable remote", () => {
    const url = getForgeCommitUrl("not-a-url", sha);
    expect(url).toBeNull();
  });
});

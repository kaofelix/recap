import md5 from "md5";
import { describe, expect, it } from "vitest";
import { gravatarUrl } from "./gravatar";

describe("gravatarUrl", () => {
  it("returns a Gravatar URL with the MD5 hash of the lowercased, trimmed email", () => {
    const url = gravatarUrl("Test@Example.COM");
    const expectedHash = md5("test@example.com");
    expect(url).toBe(
      `https://www.gravatar.com/avatar/${expectedHash}?s=40&d=retro`
    );
  });

  it("trims whitespace from the email", () => {
    const url = gravatarUrl("  user@example.com  ");
    const expectedHash = md5("user@example.com");
    expect(url).toContain(expectedHash);
  });

  it("uses the provided size parameter", () => {
    const url = gravatarUrl("user@example.com", 80);
    expect(url).toContain("s=80");
  });

  it("defaults to size 40", () => {
    const url = gravatarUrl("user@example.com");
    expect(url).toContain("s=40");
  });

  it("uses retro as the default fallback", () => {
    const url = gravatarUrl("user@example.com");
    expect(url).toContain("d=retro");
  });

  it("produces the same URL for different casings of the same email", () => {
    expect(gravatarUrl("User@Example.com")).toBe(
      gravatarUrl("user@example.com")
    );
  });
});
